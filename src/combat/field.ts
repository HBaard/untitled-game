import type { PieceKind, Side } from '../core/types';
import type { Attack, ShotStyle } from './attacks';
import type { Boulder, Rect } from './boulders';

export const TICK_HZ = 60;
export const ARENA_W = 960;
export const ARENA_H = 640;
export const FIGHTER_SIZE = 44;

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
  /** How much one hit wears a boulder: base damage, so colour never changes the hit count. */
  readonly wear: number;
  readonly attack: Attack;
  readonly reload: number;
  readonly cooldown: number;
  /** Ticks left of the current melee swing or burst animation; 0 when idle. */
  readonly anim: number;
  /** Ticks left during which no damage is taken (the phoenix's explosion). */
  readonly immune: number;
  /** Centre of the fighter. */
  readonly pos: Vec;
  readonly facing: Vec;
  /** Last horizontal direction moved (1 = right); vertical moves keep it. Sprites face this way. */
  readonly heading: 1 | -1;
}

export interface Shot {
  readonly id: number;
  readonly owner: Side;
  readonly style: ShotStyle;
  /** Where it was fired from (the dragon's cone is drawn from here). */
  readonly origin: Vec;
  readonly pos: Vec;
  readonly vel: Vec;
  /** Pixels per tick (the length of vel). */
  readonly speed: number;
  readonly radius: number;
  readonly damage: number;
  /** Boulder wear per hit; 0 when it cannot harm boulders. */
  readonly wear: number;
  readonly bounce: boolean;
  readonly explodes: boolean;
  readonly grows: boolean;
  readonly travelled: number;
  readonly range: number;
}

/** Burning ground left by the wizard's fireball; hurts the owner's opponent only. */
export interface Fire {
  readonly id: number;
  readonly owner: Side;
  readonly pos: Vec;
  readonly age: number;
}

export type Fighters = Readonly<Record<Side, ArenaFighter>>;

export interface Field {
  readonly fighters: Fighters;
  readonly boulders: readonly Boulder[];
  readonly shots: readonly Shot[];
  readonly fires: readonly Fire[];
  readonly nextId: number;
}

export const fighterRect = (pos: Vec): Rect => ({
  x: pos.x - FIGHTER_SIZE / 2,
  y: pos.y - FIGHTER_SIZE / 2,
  w: FIGHTER_SIZE,
  h: FIGHTER_SIZE,
});

export const circleRect = (pos: Vec, r: number): Rect => ({ x: pos.x - r, y: pos.y - r, w: r * 2, h: r * 2 });

export const distSq = (a: Vec, b: Vec): number => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

export const outOfArena = (p: Vec): boolean => p.x < 0 || p.y < 0 || p.x > ARENA_W || p.y > ARENA_H;

/** Damages one fighter unless it is immune. Returns the new fighters and the damage done. */
export function hurt(fighters: Fighters, side: Side, amount: number): { fighters: Fighters; dealt: number } {
  const f = fighters[side];
  if (f.immune > 0 || amount <= 0) return { fighters, dealt: 0 };
  return { fighters: { ...fighters, [side]: { ...f, hp: f.hp - amount } }, dealt: amount };
}

export function heal(fighters: Fighters, side: Side, amount: number): Fighters {
  const f = fighters[side];
  if (amount <= 0 || f.hp <= 0) return fighters;
  return { ...fighters, [side]: { ...f, hp: Math.min(f.maxHp, f.hp + amount) } };
}
