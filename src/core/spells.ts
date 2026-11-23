import { BOARD_SIZE, chebyshev, isSpellImmune, samePos, shiftTime } from './board';
import { pieceAt } from './movement';
import type { Battle } from './turn';
import { endTurn, requirePiece } from './turn';
import type { GameState, Piece, Pos, Side, SpellId } from './types';
import { ELEMENTALS, UNITS, isElemental } from './units';

/** Every side has each of these once per game. */
export const SPELLS: readonly SpellId[] = ['teleport', 'heal', 'shiftTime', 'exchange', 'summonElemental', 'revive', 'imprison'];

export const SPELL_NAMES: Readonly<Record<SpellId, string>> = {
  teleport: 'Teleport',
  heal: 'Heal',
  shiftTime: 'Shift Time',
  exchange: 'Exchange',
  summonElemental: 'Summon Elemental',
  revive: 'Revive',
  imprison: 'Imprison',
};

/** Maximum HP the caster loses in its future fights, per spell cast. */
export const SPELL_HP_COST = 1;

/** A spell with its targets, as a serialisable action (sent over the network like a move). */
export type SpellCast =
  | { readonly spell: 'teleport'; readonly pieceId: string; readonly to: Pos }
  | { readonly spell: 'heal'; readonly pieceId: string }
  | { readonly spell: 'shiftTime' }
  | { readonly spell: 'exchange'; readonly firstId: string; readonly secondId: string }
  | { readonly spell: 'summonElemental'; readonly to: Pos }
  | { readonly spell: 'revive'; readonly fallenId: string; readonly to: Pos }
  | { readonly spell: 'imprison'; readonly targetId: string };

/** Most spells end the turn at once; Teleport onto an enemy starts a fight. */
export type SpellResult =
  | { readonly kind: 'done'; readonly state: GameState }
  | { readonly kind: 'battle'; readonly state: GameState; readonly battle: Battle };

export const casterOf = (state: GameState, side: Side): Piece | undefined =>
  state.pieces.find((p) => p.side === side && UNITS[p.kind].isLeader);

/** A dead or imprisoned Wizard/Sorceress cannot cast. */
export function canCast(state: GameState, side: Side): boolean {
  const caster = casterOf(state, side);
  return !state.winner && caster !== undefined && !caster.imprisoned;
}

/** The caster's maximum HP in a fight, lowered by every spell it has cast. */
export function casterMaxHp(state: GameState, piece: Piece): number {
  const max = UNITS[piece.kind].maxHp;
  return UNITS[piece.kind].isLeader ? Math.max(1, max - state.spellsUsed[piece.side].length * SPELL_HP_COST) : max;
}

const magicReaches = (p: Piece): boolean => !isSpellImmune(p.pos);

const allSquares = (): Pos[] =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({ col: i % BOARD_SIZE, row: Math.floor(i / BOARD_SIZE) }));

// --- valid targets, used both to validate a cast and to highlight choices in the UI ---

export const teleportPieces = (state: GameState, side: Side): Piece[] =>
  state.pieces.filter((p) => p.side === side && magicReaches(p) && !p.imprisoned);

/** Any empty square, or an enemy (not on a power point) to fight at once. */
export function teleportDestinations(state: GameState, piece: Piece): Pos[] {
  return allSquares().filter((sq) => {
    const occupant = pieceAt(state.pieces, sq);
    return !occupant || (occupant.side !== piece.side && magicReaches(occupant));
  });
}

export const healTargets = (state: GameState, side: Side): Piece[] =>
  state.pieces.filter((p) => p.side === side && magicReaches(p) && p.hp < UNITS[p.kind].maxHp);

export const exchangeTargets = (state: GameState): Piece[] =>
  state.pieces.filter((p) => magicReaches(p) && !p.imprisoned);

/** Any empty square that is not a power point. */
export const summonSquares = (state: GameState): Pos[] =>
  allSquares().filter((sq) => !pieceAt(state.pieces, sq) && !isSpellImmune(sq));

export const reviveCandidates = (state: GameState, side: Side): Piece[] =>
  state.fallen.filter((p) => p.side === side && !UNITS[p.kind].isLeader && !isElemental(p.kind));

/** Empty squares next to (including diagonally) the caster. */
export function reviveSquares(state: GameState, side: Side): Pos[] {
  const caster = casterOf(state, side);
  if (!caster) return [];
  return allSquares().filter((sq) => chebyshev(sq, caster.pos) === 1 && !pieceAt(state.pieces, sq));
}

export const imprisonTargets = (state: GameState, side: Side): Piece[] =>
  state.pieces.filter((p) => p.side !== side && magicReaches(p) && !p.imprisoned);

function hasTarget(state: GameState, side: Side, spell: SpellId): boolean {
  switch (spell) {
    case 'teleport': return teleportPieces(state, side).length > 0;
    case 'heal': return healTargets(state, side).length > 0;
    case 'shiftTime': return true;
    case 'exchange': return exchangeTargets(state).length >= 2;
    case 'summonElemental': return summonSquares(state).length > 0;
    case 'revive': return reviveCandidates(state, side).length > 0 && reviveSquares(state, side).length > 0;
    case 'imprison': return imprisonTargets(state, side).length > 0;
  }
}

export const unusedSpells = (state: GameState, side: Side): SpellId[] =>
  SPELLS.filter((s) => !state.spellsUsed[side].includes(s));

/** Spells the side can cast right now: unused, caster free, and something to cast it on. */
export const availableSpells = (state: GameState, side: Side): SpellId[] =>
  canCast(state, side) ? unusedSpells(state, side).filter((s) => hasTarget(state, side, s)) : [];

// --- casting ---

const includesPiece = (pieces: readonly Piece[], id: string): boolean => pieces.some((p) => p.id === id);
const includesPos = (squares: readonly Pos[], pos: Pos): boolean => squares.some((s) => samePos(s, pos));

function check(ok: boolean, what: string): void {
  if (!ok) throw new Error(`Illegal spell: ${what}`);
}

const withPiece = (state: GameState, id: string, change: (p: Piece) => Piece): GameState => ({
  ...state,
  pieces: state.pieces.map((p) => (p.id === id ? change(p) : p)),
});

/** Deterministic, so both players in a network game summon the same elemental. */
function elementalFor(state: GameState, at: Pos): Piece['kind'] {
  const n = Math.imul(state.turnNumber * 92821 + at.col * 9 + at.row + 7, 0x9e3779b1) >>> 0;
  return ELEMENTALS[(n >>> 16) % ELEMENTALS.length]!;
}

/** Puts a random elemental of the caster's side on the board, a temporary piece until its first fight. */
function summon(state: GameState, side: Side, to: Pos): SpellResult {
  check(includesPos(summonSquares(state), to), 'must be an empty square off the power points');
  const kind = elementalFor(state, to);
  const elemental: Piece = { id: `${side}-elemental-${state.turnNumber}`, kind, side, hp: UNITS[kind].maxHp, pos: to, imprisoned: false };
  return { kind: 'done', state: endTurn({ ...state, pieces: [...state.pieces, elemental] }) };
}

function teleport(state: GameState, side: Side, pieceId: string, to: Pos): SpellResult {
  const piece = requirePiece(state, pieceId);
  check(includesPiece(teleportPieces(state, side), pieceId), 'that piece cannot be teleported');
  check(includesPos(teleportDestinations(state, piece), to) && !samePos(piece.pos, to), 'cannot teleport there');
  const enemy = pieceAt(state.pieces, to);
  if (enemy) return { kind: 'battle', state, battle: { attackerId: piece.id, defenderId: enemy.id, square: to } };
  return { kind: 'done', state: endTurn(withPiece(state, pieceId, (p) => ({ ...p, pos: to }))) };
}

function revive(state: GameState, side: Side, fallenId: string, to: Pos): SpellResult {
  const piece = reviveCandidates(state, side).find((p) => p.id === fallenId);
  check(piece !== undefined, 'nothing to revive');
  check(includesPos(reviveSquares(state, side), to), 'must be an empty square next to the caster');
  const revived = { ...piece!, hp: UNITS[piece!.kind].maxHp, pos: to, imprisoned: false };
  return {
    kind: 'done',
    state: endTurn({ ...state, pieces: [...state.pieces, revived], fallen: state.fallen.filter((p) => p.id !== fallenId) }),
  };
}

function cast(state: GameState, side: Side, c: SpellCast): SpellResult {
  const done = (s: GameState): SpellResult => ({ kind: 'done', state: endTurn(s) });
  switch (c.spell) {
    case 'teleport':
      return teleport(state, side, c.pieceId, c.to);
    case 'heal':
      check(includesPiece(healTargets(state, side), c.pieceId), 'no wounded friendly piece there');
      return done(withPiece(state, c.pieceId, (p) => ({ ...p, hp: UNITS[p.kind].maxHp })));
    case 'shiftTime':
      return done({ ...state, cycle: shiftTime(state.cycle) });
    case 'exchange': {
      const targets = exchangeTargets(state);
      check(c.firstId !== c.secondId && includesPiece(targets, c.firstId) && includesPiece(targets, c.secondId), 'cannot exchange those');
      const a = requirePiece(state, c.firstId).pos;
      const b = requirePiece(state, c.secondId).pos;
      return done(withPiece(withPiece(state, c.firstId, (p) => ({ ...p, pos: b })), c.secondId, (p) => ({ ...p, pos: a })));
    }
    case 'summonElemental':
      return summon(state, side, c.to);
    case 'revive':
      return revive(state, side, c.fallenId, c.to);
    case 'imprison':
      check(includesPiece(imprisonTargets(state, side), c.targetId), 'no enemy to imprison there');
      return done(withPiece(state, c.targetId, (p) => ({ ...p, imprisoned: true })));
  }
}

/** Casts a spell for the side to move. Uses the turn and the spell. Throws if it is not allowed. */
export function castSpell(state: GameState, c: SpellCast): SpellResult {
  const side = state.turn;
  check(canCast(state, side), 'the caster is dead or imprisoned');
  check(!state.spellsUsed[side].includes(c.spell), `${SPELL_NAMES[c.spell]} was already cast`);
  const used = { ...state, spellsUsed: { ...state.spellsUsed, [side]: [...state.spellsUsed[side], c.spell] } };
  return cast(used, side, c);
}
