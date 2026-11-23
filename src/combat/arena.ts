import { boardHp, colorAffinity, hitDamage, hitInterval, toFighter } from '../core/autoBattle';
import { casterMaxHp } from '../core/spells';
import type { Battle, BattleOutcome } from '../core/turn';
import { requirePiece } from '../core/turn';
import type { Cycle, GameState, Piece, Pos, Side } from '../core/types';
import { opposite } from '../core/types';
import { UNITS } from '../core/units';
import type { BurstAttack } from './attacks';
import { ATTACKS, PASSES_BOULDERS } from './attacks';
import type { Boulder, Rect } from './boulders';
import { placeBoulders, rectsOverlap } from './boulders';
import type { ArenaInput, ArenaInputs } from './controls';
import type { ArenaFighter, Field, Fighters, Shot, Vec } from './field';
import { ARENA_H, ARENA_W, FIGHTER_SIZE, distSq, fighterRect, heal, hurt } from './field';
import { advanceShot, makeShot, tickFires } from './shots';
import { directionOf, startAngle, strafe, turn, turnBy, walk } from './steering';

import { TICK_HZ } from './field';
export { ARENA_H, ARENA_W, FIGHTER_SIZE, TICK_HZ } from './field';
export type { ArenaFighter, Fire, Shot, Vec } from './field';

/** Pixels per tick. Same for everyone until per-unit movement is designed. */
export const MOVE_SPEED = 3;
/** Reload ticks per unit of the stat-based hit interval (2..12). */
export const RELOAD_SCALE = 8;
/** Ticks a melee swing stays visible. */
export const SWING_TICKS = 12;
/** Ticks a phoenix blast or banshee scream ring stays visible. */
export const BURST_TICKS = 20;
/** 3 .. 2 .. 1: one second each, during which nobody can move or attack. */
export const COUNTDOWN_TICKS = 3 * TICK_HZ;
/** How long "GO!" stays up once the fight is on. */
export const GO_TICKS = TICK_HZ / 2;
/** Ticks the result stays on screen before the arena closes. */
export const OUTRO_TICKS = 90;
const START_INSET = 60;

/**
 * compass: the top-down view's keys move up/left/down/right on screen.
 * tank: the first-person view's keys walk forwards/backwards and turn (hot-seat 3D: one keyboard, no mouse).
 * fps: first-person shooter (online 3D): the mouse turns, keys walk and strafe.
 */
export type Steering = 'compass' | 'tank' | 'fps';

export interface ArenaState extends Field {
  readonly tick: number;
  readonly steering: Steering;
  readonly attackerSide: Side;
  /** Tick on which a fighter fell; null while the fight is on. */
  readonly endedAt: number | null;
}

const startPos = (side: Side): Vec => ({
  x: side === 'light' ? START_INSET : ARENA_W - START_INSET,
  y: ARENA_H / 2,
});

/** maxHp: the fighter's ceiling for this fight (a caster's is lowered by every spell it cast). */
function createFighter(piece: Piece, opponent: Piece, square: Pos, cycle: Cycle, maxHp: number): ArenaFighter {
  const stats = toFighter(piece, opponent);
  const form = piece.kind === 'shapeshifter' ? opponent.kind : piece.kind;
  return {
    side: piece.side,
    pieceKind: piece.kind,
    form,
    hp: Math.min(stats.hp, maxHp),
    maxHp,
    damage: hitDamage(stats.damage, colorAffinity(piece.side, square, cycle)),
    wear: UNITS[form].damage,
    attack: ATTACKS[form],
    reload: hitInterval(stats) * RELOAD_SCALE,
    cooldown: 0,
    anim: 0,
    immune: 0,
    pos: startPos(piece.side),
    facing: { x: piece.side === 'light' ? 1 : -1, y: 0 },
    heading: piece.side === 'light' ? 1 : -1,
    angle: startAngle(piece.side === 'light'),
  };
}

/** Same game moment, same battlefield: keeps replays and network play in sync. */
export const arenaSeed = (state: GameState, square: Pos): number =>
  state.turnNumber * 1000 + square.col * 10 + square.row;

export function createArena(state: GameState, battle: Battle, steering: Steering = 'compass'): ArenaState {
  const attacker = requirePiece(state, battle.attackerId);
  const defender = requirePiece(state, battle.defenderId);
  const ceiling = (p: Piece, opponent: Piece): number =>
    p.kind === 'shapeshifter' ? UNITS[opponent.kind].maxHp : casterMaxHp(state, p);
  const a = createFighter(attacker, defender, battle.square, state.cycle, ceiling(attacker, defender));
  const d = createFighter(defender, attacker, battle.square, state.cycle, ceiling(defender, attacker));
  return {
    tick: 0,
    steering,
    attackerSide: attacker.side,
    fighters: attacker.side === 'light' ? { light: a, dark: d } : { light: d, dark: a },
    shots: [],
    fires: [],
    boulders: placeBoulders(arenaSeed(state, battle.square), ARENA_W, ARENA_H),
    nextId: 0,
    endedAt: null,
  };
}

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
function slide(pos: Vec, step: Vec, obstacles: readonly Rect[]): Vec {
  const free = (p: Vec): boolean => !obstacles.some((o) => rectsOverlap(fighterRect(p), o));
  const tryX = clampToArena({ x: pos.x + step.x, y: pos.y });
  const afterX = free(tryX) ? tryX : pos;
  const tryY = clampToArena({ x: afterX.x, y: afterX.y + step.y });
  return free(tryY) ? tryY : afterX;
}

function moveCompass(f: ArenaFighter, input: ArenaInput, obstacles: readonly Rect[]): ArenaFighter {
  const dir = inputDir(input);
  if (dir.x === 0 && dir.y === 0) return f;
  // Math.sqrt is exactly rounded everywhere; Math.hypot may differ between browsers and desync play.
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  const facing = { x: dir.x / len, y: dir.y / len };
  const heading = dir.x === 0 ? f.heading : dir.x > 0 ? 1 : -1;
  return { ...f, pos: slide(f.pos, { x: facing.x * MOVE_SPEED, y: facing.y * MOVE_SPEED }, obstacles), facing, heading };
}

/** Turns first, then walks along the new facing; backing up keeps the facing. */
function moveTank(f: ArenaFighter, input: ArenaInput, obstacles: readonly Rect[]): ArenaFighter {
  const angle = turn(f.angle, input);
  const facing = directionOf(angle);
  const speed = walk(input) * MOVE_SPEED;
  const pos = speed === 0 ? f.pos : slide(f.pos, { x: facing.x * speed, y: facing.y * speed }, obstacles);
  const heading = facing.x === 0 ? f.heading : facing.x > 0 ? 1 : -1;
  return { ...f, angle, facing, heading, pos };
}

/** Mouse turns first; then forwards/backwards plus strafing, at the same speed in every direction. */
function moveFps(f: ArenaFighter, input: ArenaInput, obstacles: readonly Rect[]): ArenaFighter {
  const angle = turnBy(f.angle, input.turn);
  const facing = directionOf(angle);
  const heading = facing.x === 0 ? f.heading : facing.x > 0 ? 1 : -1;
  const ahead = walk(input);
  const side = strafe(input);
  if (ahead === 0 && side === 0) return { ...f, angle, facing, heading };
  // Diagonals are scaled by an exact constant so walking + strafing is no faster than either alone.
  const k = (ahead !== 0 && side !== 0 ? Math.SQRT1_2 : 1) * MOVE_SPEED;
  const step = { x: (facing.x * ahead - facing.y * side) * k, y: (facing.y * ahead + facing.x * side) * k };
  return { ...f, angle, facing, heading, pos: slide(f.pos, step, obstacles) };
}

function moveFighter(steering: Steering, f: ArenaFighter, input: ArenaInput, obstacles: readonly Rect[]): ArenaFighter {
  switch (steering) {
    case 'tank': return moveTank(f, input, obstacles);
    case 'fps': return moveFps(f, input, obstacles);
    case 'compass': return moveCompass(f, input, obstacles);
  }
}

const obstaclesFor = (f: ArenaFighter, boulders: readonly Boulder[], other: ArenaFighter): Rect[] =>
  [...(PASSES_BOULDERS.has(f.form) ? [] : boulders), fighterRect(other.pos)];

/** The square in front of a fighter, one fighter-width out along its facing. */
export const meleeRect = (f: ArenaFighter): Rect =>
  fighterRect({ x: f.pos.x + f.facing.x * FIGHTER_SIZE, y: f.pos.y + f.facing.y * FIGHTER_SIZE });

/** Instant attacks resolve after both fighters have acted, so neither side goes first. */
type Effect = { readonly kind: 'strike'; readonly area: Rect } | { readonly kind: 'burst'; readonly spec: BurstAttack };

interface AttackResult {
  readonly fighter: ArenaFighter;
  readonly shot: Shot | null;
  readonly effect: Effect | null;
}

const countDown = (f: ArenaFighter): ArenaFighter => ({
  ...f,
  anim: Math.max(0, f.anim - 1),
  immune: Math.max(0, f.immune - 1),
  cooldown: Math.max(0, f.cooldown - 1),
});

function attack(f: ArenaFighter, input: ArenaInput, id: number): AttackResult {
  const ready = f.cooldown === 0;
  const idle = countDown(f);
  if (!ready || !input.fire) return { fighter: idle, shot: null, effect: null };
  const fighter = { ...idle, cooldown: f.reload };
  const a = f.attack;
  switch (a.kind) {
    case 'melee':
      return { fighter: { ...fighter, anim: SWING_TICKS }, shot: null, effect: { kind: 'strike', area: meleeRect(f) } };
    case 'burst':
      return {
        fighter: { ...fighter, anim: BURST_TICKS, immune: Math.max(fighter.immune, a.immunity) },
        shot: null,
        effect: { kind: 'burst', spec: a },
      };
    case 'shot':
      return { fighter, shot: makeShot(f, a, id), effect: null };
  }
}

function applyEffect(fighters: Fighters, by: Side, effect: Effect | null): Fighters {
  if (!effect) return fighters;
  const me = fighters[by];
  const target = opposite(by);
  const targetPos = fighters[target].pos;
  if (effect.kind === 'strike') {
    return rectsOverlap(effect.area, fighterRect(targetPos)) ? hurt(fighters, target, me.damage).fighters : fighters;
  }
  if (distSq(me.pos, targetPos) > effect.spec.radius * effect.spec.radius) return fighters;
  const hit = hurt(fighters, target, me.damage);
  return heal(hit.fighters, by, Math.floor(hit.dealt * effect.spec.drain));
}

const someoneFell = (f: Fighters): boolean => f.light.hp <= 0 || f.dark.hp <= 0;

/** One fixed timestep. Pure: same state and inputs always give the same result. */
export function stepArena(s: ArenaState, inputs: ArenaInputs): ArenaState {
  const tick = s.tick + 1;
  if (s.endedAt !== null || tick <= COUNTDOWN_TICKS) return { ...s, tick };
  const light0 = moveFighter(s.steering, s.fighters.light, inputs.light, obstaclesFor(s.fighters.light, s.boulders, s.fighters.dark));
  const dark0 = moveFighter(s.steering, s.fighters.dark, inputs.dark, obstaclesFor(s.fighters.dark, s.boulders, light0));
  const la = attack(light0, inputs.light, s.nextId);
  const da = attack(dark0, inputs.dark, s.nextId + 1);
  const newShots = [la.shot, da.shot].filter((x): x is Shot => x !== null);
  const fighters = applyEffect(applyEffect({ light: la.fighter, dark: da.fighter }, 'light', la.effect), 'dark', da.effect);
  const start: Field = { fighters, boulders: s.boulders, shots: [], fires: s.fires, nextId: s.nextId + 2 };
  const field = tickFires([...s.shots, ...newShots].reduce(advanceShot, start));
  return { ...s, ...field, tick, endedAt: someoneFell(field.fighters) ? tick : null };
}

/** What the countdown shows on this tick: "3", "2", "1", then "GO!" briefly; null once fighting. */
export function countdownLabel(tick: number): string | null {
  if (tick < COUNTDOWN_TICKS) return String(Math.ceil((COUNTDOWN_TICKS - tick) / TICK_HZ));
  return tick < COUNTDOWN_TICKS + GO_TICKS ? 'GO!' : null;
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
