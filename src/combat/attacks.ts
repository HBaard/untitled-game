import type { PieceKind } from '../core/types';
import { FIGHTER_SIZE } from './field';

export type ShotStyle =
  | 'arrow' | 'spear' | 'spike' | 'bolt' | 'venom' | 'boulder' | 'whirlwind' | 'lightning' | 'fireball' | 'flame' | 'water';

/** A projectile fired in the facing direction. Speeds are pixels per tick. */
export interface ShotAttack {
  readonly kind: 'shot';
  readonly style: ShotStyle;
  readonly speed: number;
  readonly radius: number;
  /** Pixels travelled before it is spent. */
  readonly range: number;
  /** Bounces off boulders instead of stopping. */
  readonly bounce: boolean;
  /** Wears boulders it hits, by the shooter's base damage. */
  readonly wearsBoulders: boolean;
  /** Bursts into burning ground where it lands. */
  readonly explodes: boolean;
  /** The dragon's cone: narrow at first, then widening. */
  readonly grows: boolean;
}

/** Instant hit on the fighter-sized square directly in front. */
export interface MeleeAttack {
  readonly kind: 'melee';
}

/** Instant ring around the fighter that ignores boulders. */
export interface BurstAttack {
  readonly kind: 'burst';
  readonly style: 'blast' | 'scream';
  /** Centre-to-centre reach. */
  readonly radius: number;
  /** Ticks of immunity the burst gives its user. */
  readonly immunity: number;
  /** Share of the damage dealt that the user regains as HP. */
  readonly drain: number;
}

export type Attack = ShotAttack | MeleeAttack | BurstAttack;

/** Long enough to cross the arena, corner to corner. */
const FULL_SCREEN = 1200;
/** Bouncing shots fizzle out after this much travel. */
const BOUNCE_RANGE = 1500;
/** The dragon's flame goes about 4 steps narrow, then widens over ~5 more. */
export const FLAME_RANGE = FIGHTER_SIZE * 9;
export const FLAME_NARROW = FIGHTER_SIZE * 4;
export const FLAME_MAX_RADIUS = 72;
export const FLAME_START_RADIUS = 16;
export const BURST_RADIUS = FIGHTER_SIZE * 2;
/** One second of immunity per phoenix explosion. */
export const PHOENIX_IMMUNITY = 60;

const shot = (style: ShotStyle, speed: number, radius: number, extra: Partial<ShotAttack> = {}): ShotAttack => ({
  kind: 'shot', style, speed, radius, range: FULL_SCREEN, bounce: false, wearsBoulders: false, explodes: false, grows: false,
  ...extra,
});

const MELEE: MeleeAttack = { kind: 'melee' };
const HURLED_BOULDER = shot('boulder', 4, 14, { wearsBoulders: true });

/** Per-unit attack. Listed in full so every unit gets a deliberate choice. */
export const ATTACKS: Readonly<Record<PieceKind, Attack>> = {
  knight: MELEE,
  goblin: MELEE,
  archer: shot('arrow', 8, 4),
  valkyrie: shot('spear', 8, 5),
  manticore: shot('spike', 10, 4),
  unicorn: shot('bolt', 12, 5),
  serpent: shot('venom', 18, 4),
  golem: HURLED_BOULDER,
  troll: HURLED_BOULDER,
  sylph: shot('whirlwind', 9, 11, { bounce: true, range: BOUNCE_RANGE }),
  sorceress: shot('lightning', 6, 6, { bounce: true, range: BOUNCE_RANGE }),
  wizard: shot('fireball', 5, 13, { explodes: true }),
  dragon: shot('flame', 6, FLAME_START_RADIUS, { wearsBoulders: true, grows: true, range: FLAME_RANGE }),
  phoenix: { kind: 'burst', style: 'blast', radius: BURST_RADIUS, immunity: PHOENIX_IMMUNITY, drain: 0 },
  banshee: { kind: 'burst', style: 'scream', radius: BURST_RADIUS, immunity: 0, drain: 0.5 },
  shapeshifter: MELEE, // never used: it fights with its opponent's attack
  fireElemental: shot('fireball', 6, 13, { explodes: true }),
  waterElemental: shot('water', 9, 10),
  airElemental: shot('whirlwind', 10, 11, { bounce: true, range: BOUNCE_RANGE }),
  earthElemental: HURLED_BOULDER,
};

/** Units that float through boulders. */
export const PASSES_BOULDERS: ReadonlySet<PieceKind> = new Set(['banshee']);
