import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE, CYCLE_MAX, DARK_HOME, LIGHT_HOME, POWER_POINTS, advanceCycle, initialCycle,
  invertCycle, isSpellImmune, tileKind, tileLuminance,
} from './board';
import type { TileKind } from './board';
import type { Pos } from './types';

const allSquares: Pos[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
  col: i % BOARD_SIZE, row: Math.floor(i / BOARD_SIZE),
}));

const countKinds = (squares: Pos[]): Record<TileKind, number> =>
  squares.reduce((acc, p) => ({ ...acc, [tileKind(p)]: acc[tileKind(p)] + 1 }),
    { light: 0, dark: 0, cycling: 0 });

const quadrant = (c0: number, r0: number): Pos[] =>
  allSquares.filter((p) => p.col >= c0 && p.col < c0 + 4 && p.row >= r0 && p.row < r0 + 4);

describe('tileKind', () => {
  it('places power points at the edge centres and the board centre', () => {
    const names = POWER_POINTS.map((p) => `${'ABCDEFGHI'[p.col]}${p.row + 1}`).sort();
    expect(names).toEqual(['A5', 'E1', 'E5', 'E9', 'I5']);
  });

  it('fixes the leader homes to their side colour', () => {
    expect(tileKind(LIGHT_HOME)).toBe('light');
    expect(tileKind(DARK_HOME)).toBe('dark');
  });

  it('makes the rest of column E and row 5 shift, including the E power points', () => {
    const cross = allSquares.filter((p) => p.col === 4 || p.row === 4);
    const shifting = cross.filter((p) => tileKind(p) === 'cycling');
    expect(shifting).toHaveLength(cross.length - 2);
  });

  it.each([[0, 0], [5, 0], [0, 5], [5, 5]])('quadrant at %i,%i has 6 light, 6 dark, 4 shifting', (c, r) => {
    expect(countKinds(quadrant(c, r))).toEqual({ light: 6, dark: 6, cycling: 4 });
  });

  it('has 31 shifting squares in total', () => {
    expect(countKinds(allSquares).cycling).toBe(31);
  });
});

describe('isSpellImmune', () => {
  it('protects pieces on power points from enemy spells only', () => {
    expect(isSpellImmune({ col: 4, row: 4 }, 'light', 'dark')).toBe(true);
    expect(isSpellImmune({ col: 4, row: 4 }, 'light', 'light')).toBe(false);
    expect(isSpellImmune({ col: 3, row: 4 }, 'light', 'dark')).toBe(false);
  });
});

describe('cycle', () => {
  it('ping-pongs between 0 and CYCLE_MAX', () => {
    const levels: number[] = [];
    let c = { level: 0, rising: true };
    for (let i = 0; i < 12; i++) {
      levels.push(c.level);
      c = advanceCycle(c);
    }
    expect(levels).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1]);
  });

  it('invert mirrors the level and direction', () => {
    expect(invertCycle({ level: 1, rising: true })).toEqual({ level: CYCLE_MAX - 1, rising: false });
  });

  it('luminance follows tile kind', () => {
    const c = { level: CYCLE_MAX, rising: false };
    expect(tileLuminance({ col: 0, row: 0 }, initialCycle)).toBe(1);
    expect(tileLuminance({ col: 1, row: 0 }, initialCycle)).toBe(0);
    expect(tileLuminance({ col: 4, row: 4 }, c)).toBe(1);
    expect(tileLuminance({ col: 4, row: 4 }, { level: 0, rising: true })).toBe(0);
  });
});
