/** Axis-aligned rectangle; x/y is the top-left corner. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Boulder extends Rect {
  readonly id: number;
  /** Hits from a boulder-melting attack (dragon fire) it can take. */
  readonly hp: number;
}

export const BOULDER_HP = 3;
export const BOULDER_CELL = 64;
export const BOULDER_COUNT = 9;
/** Cell columns kept free of boulders at each end, so both fighters start in the open. */
export const CLEAR_COLS = 3;
const MIN_SIZE = 44;
const SIZE_SPREAD = 17;

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Deterministic PRNG (mulberry32); same seed, same sequence. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One boulder per chosen grid cell, so they never overlap and always leave gaps. */
export function placeBoulders(seed: number, width: number, height: number): Boulder[] {
  const rand = rng(seed);
  const cols = Math.floor(width / BOULDER_CELL);
  const rows = Math.floor(height / BOULDER_CELL);
  const cells: [number, number][] = [];
  for (let c = CLEAR_COLS; c < cols - CLEAR_COLS; c++) for (let r = 0; r < rows; r++) cells.push([c, r]);
  return shuffled(cells, rand).slice(0, BOULDER_COUNT).map(([c, r], id) => {
    const size = MIN_SIZE + Math.floor(rand() * SIZE_SPREAD);
    const slack = BOULDER_CELL - size;
    return {
      id,
      x: c * BOULDER_CELL + Math.floor(rand() * slack),
      y: r * BOULDER_CELL + Math.floor(rand() * slack),
      w: size,
      h: size,
      hp: BOULDER_HP,
    };
  });
}
