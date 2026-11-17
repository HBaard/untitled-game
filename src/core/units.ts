import type { MoveMode, PieceKind, Side } from './types';

/** Battle-time profile. Speed and recovery are 1..6, higher is faster. */
export interface CombatStats {
  readonly damage: number;
  /** 6 = strikes almost at once, 1 = long wind-up before each hit. */
  readonly speed: number;
  /** 6 = short pause between hits, 1 = long pause. */
  readonly recovery: number;
}

export interface UnitStats extends CombatStats {
  readonly name: string;
  readonly side: Side;
  readonly maxHp: number;
  readonly move: MoveMode;
  readonly range: number;
  readonly isLeader: boolean;
  /** HP regained per heal tick (see turn.ts). */
  readonly regen: number;
}

/** Life is listed on a 1..6 scale and multiplied by this for actual HP. */
export const LIFE_SCALE = 3;

interface UnitDef {
  readonly name: string;
  readonly side: Side;
  /** [life, damage, speed, recovery] */
  readonly combat: readonly [number, number, number, number];
  readonly move: MoveMode;
  readonly range: number;
  readonly isLeader?: boolean;
  readonly regen?: number;
}

const unit = ({ name, side, combat, move, range, isLeader = false, regen = 1 }: UnitDef): UnitStats => {
  const [life, damage, speed, recovery] = combat;
  return { name, side, maxHp: life * LIFE_SCALE, damage, speed, recovery, move, range, isLeader, regen };
};

/** Shapeshifter combat numbers are unused: it copies its opponent in battle. */
export const UNITS: Readonly<Record<PieceKind, UnitStats>> = {
  wizard: unit({ name: 'Wizard', side: 'light', combat: [3, 5, 3, 3], move: 'teleport', range: 3, isLeader: true }),
  sylph: unit({ name: 'Sylph', side: 'light', combat: [5, 3, 3, 3], move: 'fly', range: 4 }),
  phoenix: unit({ name: 'Phoenix', side: 'light', combat: [5, 5, 1, 1], move: 'fly', range: 5 }),
  unicorn: unit({ name: 'Unicorn', side: 'light', combat: [3, 3, 5, 5], move: 'ground', range: 4 }),
  golem: unit({ name: 'Golem', side: 'light', combat: [5, 5, 1, 1], move: 'ground', range: 3 }),
  valkyrie: unit({ name: 'Valkyrie', side: 'light', combat: [3, 3, 1, 3], move: 'fly', range: 3 }),
  archer: unit({ name: 'Archer', side: 'light', combat: [1, 1, 3, 3], move: 'ground', range: 3 }),
  knight: unit({ name: 'Knight', side: 'light', combat: [1, 1, 6, 6], move: 'ground', range: 3 }),
  sorceress: unit({ name: 'Sorceress', side: 'dark', combat: [3, 3, 5, 3], move: 'teleport', range: 3, isLeader: true }),
  dragon: unit({ name: 'Dragon', side: 'dark', combat: [6, 6, 3, 1], move: 'fly', range: 5 }),
  shapeshifter: unit({ name: 'Shapeshifter', side: 'dark', combat: [4, 1, 1, 1], move: 'ground', range: 3 }),
  serpent: unit({ name: 'Serpent', side: 'dark', combat: [1, 5, 5, 5], move: 'ground', range: 3 }),
  troll: unit({ name: 'Troll', side: 'dark', combat: [5, 5, 1, 1], move: 'ground', range: 3, regen: 2 }),
  banshee: unit({ name: 'Banshee', side: 'dark', combat: [3, 3, 6, 1], move: 'fly', range: 3 }),
  manticore: unit({ name: 'Manticore', side: 'dark', combat: [3, 1, 1, 3], move: 'ground', range: 4 }),
  goblin: unit({ name: 'Goblin', side: 'dark', combat: [1, 1, 6, 6], move: 'ground', range: 3 }),
};
