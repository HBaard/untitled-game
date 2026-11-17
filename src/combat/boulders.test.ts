import { describe, expect, it } from 'vitest';
import { BOULDER_CELL, BOULDER_COUNT, BOULDER_HP, CLEAR_COLS, placeBoulders, rectsOverlap, rng } from './boulders';

const W = 960;
const H = 640;

describe('rng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(43)()).not.toBe(xs[0]);
  });
});

describe('placeBoulders', () => {
  const boulders = placeBoulders(7, W, H);

  it('places the same boulders for the same seed', () => {
    expect(placeBoulders(7, W, H)).toEqual(boulders);
    expect(placeBoulders(8, W, H)).not.toEqual(boulders);
  });

  it('places BOULDER_COUNT full-health square boulders inside the arena', () => {
    expect(boulders).toHaveLength(BOULDER_COUNT);
    for (const b of boulders) {
      expect(b.w).toBe(b.h);
      expect(b.hp).toBe(BOULDER_HP);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h).toBeLessThanOrEqual(H);
    }
  });

  it('keeps both start zones clear and never overlaps boulders', () => {
    const clear = CLEAR_COLS * BOULDER_CELL;
    for (const b of boulders) {
      expect(b.x).toBeGreaterThanOrEqual(clear);
      expect(b.x + b.w).toBeLessThanOrEqual(W - clear);
      expect(boulders.filter((o) => o !== b && rectsOverlap(o, b))).toEqual([]);
    }
  });
});
