import type { PieceKind } from '../core/types';

type Ctx = CanvasRenderingContext2D;

/** Elementals are drawn procedurally from square cells, matching the pixel-art sprites. */
const CELL = 4;
const COLS = 15;
const ROWS = 16;

/**
 * Colour of one cell, or null for empty. u: -1..1 left to right; v: 0 at the feet, 1 at the top;
 * t: arena tick, for animation.
 */
type Shape = (u: number, v: number, t: number) => string | null;

const pick = (palette: readonly string[], x: number): string =>
  palette[Math.min(palette.length - 1, Math.max(0, Math.floor(x * palette.length)))]!;

const isEye = (u: number, v: number, eyeV: number, gap: number): boolean =>
  Math.abs(v - eyeV) < 0.04 && Math.abs(Math.abs(u) - gap) < 0.09;

const FIRE = ['#fff2a0', '#ffd040', '#ff9a20', '#f0601a', '#b02a0c'];
const fire: Shape = (u, v, t) => {
  const hw = 0.9 * Math.pow(1 - v, 0.65) + Math.sin(v * 9 - t * 0.35) * 0.08;
  if (Math.abs(u) > hw) return null;
  if (isEye(u, v, 0.5, 0.22)) return '#3a0a00';
  return pick(FIRE, (Math.abs(u) / hw) * 0.75 + v * 0.35);
};

const WATER = ['#d6efff', '#7cc4ff', '#3a8ee8', '#1f5fb0', '#123a6a'];
const water: Shape = (u, v, t) => {
  const head = v > 0.72 ? Math.sqrt(Math.max(0, 1 - ((v - 0.72) / 0.26) ** 2)) * 0.48 : 0;
  const body = v <= 0.72 ? 0.5 + v * 0.25 + Math.sin(v * 7 + t * 0.2) * 0.08 : 0;
  const hw = Math.max(head, body);
  if (Math.abs(u) > hw) return null;
  if (isEye(u, v, 0.8, 0.18)) return '#ffffff';
  const ripple = Math.sin((u + v) * 9 - t * 0.25) > 0.75;
  return ripple ? WATER[0]! : pick(WATER.slice(1), (Math.abs(u) / hw) * 0.9);
};

const air: Shape = (u, v, t) => {
  const y = (v - 0.5) * 2;
  const r = Math.sqrt(u * u + y * y);
  if (r > 0.98) return null;
  const a = Math.atan2(y, u);
  const swirl = Math.sin(a * 3 + r * 9 - t * 0.3);
  if (swirl < -0.25 && r > 0.25) return null;
  if (isEye(u, v, 0.58, 0.2)) return '#33506e';
  return swirl > 0.6 ? '#ffffff' : r < 0.5 ? '#e2ecf6' : '#b8c8da';
};

const EARTH = ['#a8865c', '#8a6a44', '#6e5234', '#4a3722'];
const earth: Shape = (u, v, t) => {
  const au = Math.abs(u);
  const legs = v < 0.22 && au > 0.12 && au < 0.55;
  const torso = v >= 0.22 && v < 0.72 && au < 0.6;
  const arms = v >= 0.3 && v < 0.66 && au >= 0.68 && au < 0.95;
  const head = v >= 0.72 && v < 0.95 && au < 0.34;
  if (!(legs || torso || arms || head)) return null;
  if (isEye(u, v, 0.84, 0.15)) return t % 40 < 30 ? '#ffb020' : '#ff7010';
  const crack = Math.abs(Math.sin(u * 13 + v * 7)) < 0.12;
  return crack ? EARTH[3]! : pick(EARTH, (au + (1 - v) * 0.4) * 0.6);
};

export const hasElementalShape = (kind: PieceKind): boolean => SHAPES[kind] !== undefined;

const SHAPES: Partial<Record<PieceKind, Shape>> = {
  fireElemental: fire,
  waterElemental: water,
  airElemental: air,
  earthElemental: earth,
};

/** Draws an elemental standing with its feet at (x, footY); cell is the pixel size (board pieces use 3). */
export function drawElemental(ctx: Ctx, kind: PieceKind, x: number, footY: number, tick: number, cell = CELL): void {
  const shape = SHAPES[kind];
  if (!shape) return;
  const left = Math.round(x - (COLS * cell) / 2);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const u = ((col + 0.5) / COLS) * 2 - 1;
      const v = 1 - (row + 0.5) / ROWS;
      const color = shape(u, v, tick);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(left + col * cell, footY - (ROWS - row) * cell, cell, cell);
    }
  }
}
