import type { Cycle, Pos } from './types';

export const BOARD_SIZE = 9;
const CENTER = 4;
export const CYCLE_MAX = 5;

/** Leader start squares on the side edges; their colour never changes. */
export const LIGHT_HOME: Pos = { col: 0, row: CENTER };
export const DARK_HOME: Pos = { col: BOARD_SIZE - 1, row: CENTER };

/** Centre of each edge plus the centre of the board. */
export const POWER_POINTS: readonly Pos[] = [
  { col: CENTER, row: CENTER },
  { col: CENTER, row: 0 },
  { col: CENTER, row: BOARD_SIZE - 1 },
  LIGHT_HOME,
  DARK_HOME,
];

export type TileKind = 'light' | 'dark' | 'cycling';

export const samePos = (a: Pos, b: Pos): boolean => a.col === b.col && a.row === b.row;

export const inBounds = (p: Pos): boolean =>
  p.col >= 0 && p.col < BOARD_SIZE && p.row >= 0 && p.row < BOARD_SIZE;

export const isPowerPoint = (p: Pos): boolean => POWER_POINTS.some((pp) => samePos(pp, p));

export const chebyshev = (a: Pos, b: Pos): number =>
  Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

const onCentralCross = (p: Pos): boolean => p.col === CENTER || p.row === CENTER;

/** The 2x2 core of each 4x4 corner quadrant (e.g. B2:C3) shifts colour. */
const inQuadrantCore = (n: number): boolean => n === 1 || n === 2 || n === 6 || n === 7;

/**
 * Corner quadrants: fixed checkerboard (6 light, 6 dark) around a 2x2 shifting core.
 * The central column and row shift too, except the two leader homes.
 */
export function tileKind(p: Pos): TileKind {
  if (samePos(p, LIGHT_HOME)) return 'light';
  if (samePos(p, DARK_HOME)) return 'dark';
  if (onCentralCross(p)) return 'cycling';
  if (inQuadrantCore(p.col) && inQuadrantCore(p.row)) return 'cycling';
  return (p.col + p.row) % 2 === 0 ? 'light' : 'dark';
}

/** A piece on a power point is immune to all magic, friendly or not. */
export const isSpellImmune = (pos: Pos): boolean => isPowerPoint(pos);

export const initialCycle: Cycle = { level: 3, rising: true };

/** Ping-pong between 0 and CYCLE_MAX, one step per turn. */
export function advanceCycle(c: Cycle): Cycle {
  if (c.rising && c.level >= CYCLE_MAX) return { level: CYCLE_MAX - 1, rising: false };
  if (!c.rising && c.level <= 0) return { level: 1, rising: true };
  return { level: c.level + (c.rising ? 1 : -1), rising: c.rising };
}

/**
 * The Shift Time spell: squares getting lighter start getting darker and vice versa.
 * At a peak (fully light or fully dark) it jumps straight to the opposite extreme.
 */
export function shiftTime(c: Cycle): Cycle {
  if (c.level >= CYCLE_MAX) return { level: 0, rising: true };
  if (c.level <= 0) return { level: CYCLE_MAX, rising: false };
  return { level: c.level, rising: !c.rising };
}

/** 0 = fully dark, 1 = fully light. */
export function tileLuminance(p: Pos, cycle: Cycle): number {
  switch (tileKind(p)) {
    case 'light': return 1;
    case 'dark': return 0;
    case 'cycling': return cycle.level / CYCLE_MAX;
  }
}
