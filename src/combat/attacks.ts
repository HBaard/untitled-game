import type { PieceKind } from '../core/types';

/**
 * shot:  straight projectile in the facing direction (placeholder for units not designed yet).
 * melee: instant strike on the one-fighter-sized square directly in front.
 */
export type AttackKind = 'shot' | 'melee';

/** Per-unit attack. Listed in full so every unit gets a deliberate choice. */
export const ATTACKS: Readonly<Record<PieceKind, AttackKind>> = {
  knight: 'melee',
  goblin: 'melee',
  wizard: 'shot',
  sylph: 'shot',
  phoenix: 'shot',
  unicorn: 'shot',
  golem: 'shot',
  valkyrie: 'shot',
  archer: 'shot',
  sorceress: 'shot',
  dragon: 'shot',
  shapeshifter: 'shot', // never used: it fights with its opponent's attack
  serpent: 'shot',
  troll: 'shot',
  banshee: 'shot',
  manticore: 'shot',
};
