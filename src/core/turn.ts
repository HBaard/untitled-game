import { POWER_POINTS, advanceCycle, isPowerPoint, tileLuminance } from './board';
import { isLegalMove, pieceAt } from './movement';
import type { Cycle, GameState, Piece, Pos, Side, Winner } from './types';
import { opposite } from './types';
import { UNITS } from './units';

export interface Battle {
  readonly attackerId: string;
  readonly defenderId: string;
  readonly square: Pos;
}

/** Remaining HP after a fight; 0 or less means the piece died. */
export interface BattleOutcome {
  readonly attackerHp: number;
  readonly defenderHp: number;
}

export type MoveResult =
  | { readonly kind: 'moved'; readonly state: GameState }
  | { readonly kind: 'battle'; readonly state: GameState; readonly battle: Battle };

export function requirePiece(state: GameState, id: string): Piece {
  const piece = state.pieces.find((p) => p.id === id);
  if (!piece) throw new Error(`No piece with id ${id}`);
  return piece;
}

const movePiece = (state: GameState, id: string, to: Pos): GameState => ({
  ...state,
  pieces: state.pieces.map((p) => (p.id === id ? { ...p, pos: to } : p)),
});

export function applyMove(state: GameState, pieceId: string, to: Pos): MoveResult {
  if (state.winner) throw new Error('Game is over');
  const piece = requirePiece(state, pieceId);
  if (piece.side !== state.turn) throw new Error(`Not ${piece.side}'s turn`);
  if (!isLegalMove(state, piece, to)) throw new Error('Illegal move');
  const defender = pieceAt(state.pieces, to);
  if (defender) {
    return { kind: 'battle', state, battle: { attackerId: piece.id, defenderId: defender.id, square: to } };
  }
  return { kind: 'moved', state: endTurn(movePiece(state, pieceId, to)) };
}

const isAlive = (p: Piece): boolean => p.hp > 0;

export function resolveBattle(state: GameState, battle: Battle, outcome: BattleOutcome): GameState {
  const attacker = { ...requirePiece(state, battle.attackerId), hp: outcome.attackerHp };
  const defender = { ...requirePiece(state, battle.defenderId), hp: outcome.defenderHp };
  const attackerTakesSquare = isAlive(attacker) && !isAlive(defender);
  const fighters = [attackerTakesSquare ? { ...attacker, pos: battle.square } : attacker, defender];
  const others = state.pieces.filter((p) => p.id !== attacker.id && p.id !== defender.id);
  const dead = fighters.filter((p) => !isAlive(p)).map((p) => ({ ...p, hp: 0, imprisoned: false }));
  return endTurn({
    ...state,
    pieces: [...others, ...fighters.filter(isAlive)],
    fallen: [...state.fallen, ...dead],
  });
}

/** An imprisoned piece is freed once its tile reaches its own side's colour. */
function isReleased(piece: Piece, cycle: Cycle): boolean {
  const home = piece.side === 'light' ? 1 : 0;
  return tileLuminance(piece.pos, cycle) === home;
}

export const releasePrisoners = (pieces: readonly Piece[], cycle: Cycle): Piece[] =>
  pieces.map((p) => (p.imprisoned && isReleased(p, cycle) ? { ...p, imprisoned: false } : p));

/** Every piece regains its regen (1, trolls 2) each HEAL_INTERVAL turns; on a power point, every turn. */
export const HEAL_INTERVAL = 4;

const healsThisTurn = (piece: Piece, turnNumber: number): boolean =>
  isPowerPoint(piece.pos) || turnNumber % HEAL_INTERVAL === 0;

export const healPieces = (pieces: readonly Piece[], turnNumber: number): Piece[] =>
  pieces.map((p) => (healsThisTurn(p, turnNumber)
    ? { ...p, hp: Math.min(UNITS[p.kind].maxHp, p.hp + UNITS[p.kind].regen) }
    : p));

const holdsAllPowerPoints = (pieces: readonly Piece[], side: Side): boolean =>
  POWER_POINTS.every((pp) => pieceAt(pieces, pp)?.side === side);

export function checkWinner(pieces: readonly Piece[]): Winner {
  const light = pieces.some((p) => p.side === 'light');
  const dark = pieces.some((p) => p.side === 'dark');
  if (!light && !dark) return 'draw';
  if (!light) return 'dark';
  if (!dark) return 'light';
  if (holdsAllPowerPoints(pieces, 'light')) return 'light';
  if (holdsAllPowerPoints(pieces, 'dark')) return 'dark';
  return null;
}

export function endTurn(state: GameState): GameState {
  const cycle = advanceCycle(state.cycle);
  const turnNumber = state.turnNumber + 1;
  const pieces = healPieces(releasePrisoners(state.pieces, cycle), turnNumber);
  return {
    ...state,
    pieces,
    cycle,
    turn: opposite(state.turn),
    turnNumber,
    winner: checkWinner(pieces),
  };
}
