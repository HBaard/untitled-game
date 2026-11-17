import { boardHp, colorAffinity, hitDamage, hitInterval, toFighter } from '../core/autoBattle';
import type { Battle, BattleOutcome } from '../core/turn';
import { requirePiece } from '../core/turn';
import type { Cycle, GameState, Piece, PieceKind, Pos, Side } from '../core/types';
import { opposite } from '../core/types';
import { UNITS } from '../core/units';
import type { AttackKind } from './attacks';
import { ATTACKS } from './attacks';
import type { Boulder, Rect } from './boulders';
import { placeBoulders, rectsOverlap } from './boulders';
import type { ArenaInput, ArenaInputs } from './controls';

export const TICK_HZ = 60;
export const ARENA_W = 960;
export const ARENA_H = 640;
export const FIGHTER_SIZE = 44;
/** Pixels per tick. Same for everyone until per-unit movement is designed. */
export const MOVE_SPEED = 3;
export const SHOT_SPEED = 7;
export const SHOT_RADIUS = 6;
export const SHOT_RANGE = 700;
/** Reload ticks per unit of the stat-based hit interval (2..12). */
export const RELOAD_SCALE = 8;
/** Ticks a melee swing stays visible. */
export const SWING_TICKS = 12;
/** Ticks the result stays on screen before the arena closes. */
export const OUTRO_TICKS = 90;
const START_INSET = 60;

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface ArenaFighter {
  readonly side: Side;
  readonly pieceKind: PieceKind;
  /** What it fights as: its own kind, or its opponent's for a shapeshifter. */
  readonly form: PieceKind;
  readonly hp: number;
  readonly maxHp: number;
  /** Per-hit damage including the square's colour bonus. */
  readonly damage: number;
  readonly reload: number;
  readonly cooldown: number;
  readonly meltsBoulders: boolean;
  readonly attack: AttackKind;
  /** Ticks left of the current melee swing animation; 0 when not swinging. */
  readonly swing: number;
  /** Centre of the fighter. */
  readonly pos: Vec;
  readonly facing: Vec;
  /** Last horizontal direction moved (1 = right); vertical moves keep it. Sprites face this way. */
  readonly heading: 1 | -1;
}

export interface Shot {
  readonly id: number;
  readonly owner: Side;
  readonly pos: Vec;
  readonly vel: Vec;
  readonly damage: number;
  readonly melts: boolean;
  readonly travelled: number;
}

export interface ArenaState {
  readonly tick: number;
  readonly attackerSide: Side;
  readonly fighters: Readonly<Record<Side, ArenaFighter>>;
  readonly shots: readonly Shot[];
  readonly boulders: readonly Boulder[];
  readonly nextShotId: number;
  /** Tick on which a fighter fell; null while the fight is on. */
  readonly endedAt: number | null;
}

const startPos = (side: Side): Vec => ({
  x: side === 'light' ? START_INSET : ARENA_W - START_INSET,
  y: ARENA_H / 2,
});

function createFighter(piece: Piece, opponent: Piece, square: Pos, cycle: Cycle): ArenaFighter {
  const stats = toFighter(piece, opponent);
  const form = piece.kind === 'shapeshifter' ? opponent.kind : piece.kind;
  return {
    side: piece.side,
    pieceKind: piece.kind,
    form,
    hp: stats.hp,
    maxHp: UNITS[form].maxHp,
    damage: hitDamage(stats.damage, colorAffinity(piece.side, square, cycle)),
    reload: hitInterval(stats) * RELOAD_SCALE,
    cooldown: 0,
    meltsBoulders: form === 'dragon',
    attack: ATTACKS[form],
    swing: 0,
    pos: startPos(piece.side),
    facing: { x: piece.side === 'light' ? 1 : -1, y: 0 },
    heading: piece.side === 'light' ? 1 : -1,
  };
}

/** Same game moment, same battlefield: keeps replays and network play in sync. */
export const arenaSeed = (state: GameState, square: Pos): number =>
  state.turnNumber * 1000 + square.col * 10 + square.row;

export function createArena(state: GameState, battle: Battle): ArenaState {
  const attacker = requirePiece(state, battle.attackerId);
  const defender = requirePiece(state, battle.defenderId);
  const a = createFighter(attacker, defender, battle.square, state.cycle);
  const d = createFighter(defender, attacker, battle.square, state.cycle);
  return {
    tick: 0,
    attackerSide: attacker.side,
    fighters: attacker.side === 'light' ? { light: a, dark: d } : { light: d, dark: a },
    shots: [],
    boulders: placeBoulders(arenaSeed(state, battle.square), ARENA_W, ARENA_H),
    nextShotId: 0,
    endedAt: null,
  };
}

export const fighterRect = (pos: Vec): Rect => ({
  x: pos.x - FIGHTER_SIZE / 2,
  y: pos.y - FIGHTER_SIZE / 2,
  w: FIGHTER_SIZE,
  h: FIGHTER_SIZE,
});

const shotRect = (pos: Vec): Rect => ({
  x: pos.x - SHOT_RADIUS, y: pos.y - SHOT_RADIUS, w: SHOT_RADIUS * 2, h: SHOT_RADIUS * 2,
});

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const clampToArena = (p: Vec): Vec => ({
  x: clamp(p.x, FIGHTER_SIZE / 2, ARENA_W - FIGHTER_SIZE / 2),
  y: clamp(p.y, FIGHTER_SIZE / 2, ARENA_H - FIGHTER_SIZE / 2),
});

const inputDir = (i: ArenaInput): Vec => ({
  x: (i.right ? 1 : 0) - (i.left ? 1 : 0),
  y: (i.down ? 1 : 0) - (i.up ? 1 : 0),
});

/** Moves one axis at a time so a fighter slides along obstacles instead of sticking. */
function moveFighter(f: ArenaFighter, input: ArenaInput, obstacles: readonly Rect[]): ArenaFighter {
  const dir = inputDir(input);
  if (dir.x === 0 && dir.y === 0) return f;
  const len = Math.hypot(dir.x, dir.y);
  const free = (p: Vec): boolean => !obstacles.some((o) => rectsOverlap(fighterRect(p), o));
  const tryX = clampToArena({ x: f.pos.x + (dir.x / len) * MOVE_SPEED, y: f.pos.y });
  const afterX = free(tryX) ? tryX : f.pos;
  const tryY = clampToArena({ x: afterX.x, y: afterX.y + (dir.y / len) * MOVE_SPEED });
  const heading = dir.x === 0 ? f.heading : dir.x > 0 ? 1 : -1;
  return { ...f, pos: free(tryY) ? tryY : afterX, facing: { x: dir.x / len, y: dir.y / len }, heading };
}

/** The square in front of a fighter, one fighter-width out along its facing. */
export const meleeRect = (f: ArenaFighter): Rect =>
  fighterRect({ x: f.pos.x + f.facing.x * FIGHTER_SIZE, y: f.pos.y + f.facing.y * FIGHTER_SIZE });

function makeShot(f: ArenaFighter, id: number): Shot {
  const muzzle = FIGHTER_SIZE / 2 + SHOT_RADIUS + 1;
  return {
    id,
    owner: f.side,
    pos: { x: f.pos.x + f.facing.x * muzzle, y: f.pos.y + f.facing.y * muzzle },
    vel: { x: f.facing.x * SHOT_SPEED, y: f.facing.y * SHOT_SPEED },
    damage: f.damage,
    melts: f.meltsBoulders,
    travelled: 0,
  };
}

interface AttackResult {
  readonly fighter: ArenaFighter;
  readonly shot: Shot | null;
  /** Area a melee swing hits this tick. */
  readonly strike: Rect | null;
}

function attack(f: ArenaFighter, input: ArenaInput, id: number): AttackResult {
  const idle = { ...f, swing: Math.max(0, f.swing - 1) };
  if (idle.cooldown > 0) return { fighter: { ...idle, cooldown: idle.cooldown - 1 }, shot: null, strike: null };
  if (!input.fire) return { fighter: idle, shot: null, strike: null };
  const fighter = { ...idle, cooldown: f.reload };
  return f.attack === 'melee'
    ? { fighter: { ...fighter, swing: SWING_TICKS }, shot: null, strike: meleeRect(f) }
    : { fighter, shot: makeShot(f, id), strike: null };
}

/** A swing hurts the opponent if it overlaps the struck square. */
function applyStrike(fighters: Field['fighters'], by: Side, strike: Rect | null): Field['fighters'] {
  const target = fighters[opposite(by)];
  if (!strike || !rectsOverlap(strike, fighterRect(target.pos))) return fighters;
  return { ...fighters, [target.side]: { ...target, hp: target.hp - fighters[by].damage } };
}

const outOfArena = (p: Vec): boolean => p.x < 0 || p.y < 0 || p.x > ARENA_W || p.y > ARENA_H;

interface Field {
  readonly fighters: Readonly<Record<Side, ArenaFighter>>;
  readonly boulders: readonly Boulder[];
  readonly shots: readonly Shot[];
}

/** A melting hit wears a boulder down; at 0 it is gone. */
const meltBoulder = (boulders: readonly Boulder[], id: number): Boulder[] =>
  boulders.flatMap((b) => (b.id !== id ? [b] : b.hp > 1 ? [{ ...b, hp: b.hp - 1 }] : []));

function advanceShot(field: Field, shot: Shot): Field {
  const pos = { x: shot.pos.x + shot.vel.x, y: shot.pos.y + shot.vel.y };
  const moved = { ...shot, pos, travelled: shot.travelled + SHOT_SPEED };
  if (outOfArena(pos) || moved.travelled > SHOT_RANGE) return field;
  const rect = shotRect(pos);
  const boulder = field.boulders.find((b) => rectsOverlap(rect, b));
  if (boulder) return moved.melts ? { ...field, boulders: meltBoulder(field.boulders, boulder.id) } : field;
  const target = field.fighters[opposite(shot.owner)];
  if (rectsOverlap(rect, fighterRect(target.pos))) {
    const hit = { ...target, hp: target.hp - shot.damage };
    return { ...field, fighters: { ...field.fighters, [hit.side]: hit } };
  }
  return { ...field, shots: [...field.shots, moved] };
}

const someoneFell = (f: Field['fighters']): boolean => f.light.hp <= 0 || f.dark.hp <= 0;

/** One fixed timestep. Pure: same state and inputs always give the same result. */
export function stepArena(s: ArenaState, inputs: ArenaInputs): ArenaState {
  const tick = s.tick + 1;
  if (s.endedAt !== null) return { ...s, tick };
  const light0 = moveFighter(s.fighters.light, inputs.light, [...s.boulders, fighterRect(s.fighters.dark.pos)]);
  const dark0 = moveFighter(s.fighters.dark, inputs.dark, [...s.boulders, fighterRect(light0.pos)]);
  const la = attack(light0, inputs.light, s.nextShotId);
  const da = attack(dark0, inputs.dark, s.nextShotId + (la.shot ? 1 : 0));
  const newShots = [la.shot, da.shot].filter((x): x is Shot => x !== null);
  const struck = applyStrike(applyStrike({ light: la.fighter, dark: da.fighter }, 'light', la.strike), 'dark', da.strike);
  const start: Field = { fighters: struck, boulders: s.boulders, shots: [] };
  const field = [...s.shots, ...newShots].reduce(advanceShot, start);
  return {
    ...s,
    ...field,
    tick,
    nextShotId: s.nextShotId + newShots.length,
    endedAt: someoneFell(field.fighters) ? tick : null,
  };
}

export const isFinished = (s: ArenaState): boolean =>
  s.endedAt !== null && s.tick - s.endedAt >= OUTRO_TICKS;

/** Board HP for each piece once a fighter has fallen; null while the fight is on. */
export function arenaOutcome(s: ArenaState): BattleOutcome | null {
  if (s.endedAt === null) return null;
  const a = s.fighters[s.attackerSide];
  const d = s.fighters[opposite(s.attackerSide)];
  return { attackerHp: boardHp(a.pieceKind, a.hp), defenderHp: boardHp(d.pieceKind, d.hp) };
}
