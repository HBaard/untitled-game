import type { Boulder } from '../combat/boulders';
import { BOULDER_HP } from '../combat/boulders';
import { ARENA_H, ARENA_W } from '../combat/field';
import type { Camera, RayHit } from './raycast';
import { cameraRay, castRay } from './raycast';

/** World heights in arena pixels: every wall is the same height and the eye sits halfway up, as in Wolfenstein. */
export const WALL_H = 64;
export const EYE = 32;
/** Distance at which the fog is thickest. */
const FOG_DIST = 1100;
const MIN_LIGHT = 0.28;
const FLOOR_CELL = 64;

/** A view's low-res frame: pixels for walls/floor/ceiling plus the per-column wall depth for sprites. */
export interface Frame {
  readonly w: number;
  readonly h: number;
  readonly image: ImageData;
  readonly pixels: Uint32Array;
  readonly zbuf: Float64Array;
}

export function makeFrame(w: number, h: number): Frame {
  const image = new ImageData(w, h);
  return { w, h, image, pixels: new Uint32Array(image.data.buffer), zbuf: new Float64Array(w) };
}

/** Projection for a frame: focal length in pixels and the horizon row. */
export interface Lens {
  readonly focal: number;
  readonly horizon: number;
}

export type Rgb = readonly [number, number, number];

/** ImageData is RGBA bytes; on little-endian machines (all browsers in practice) that's ABGR as a uint32. */
const pack = (r: number, g: number, b: number): number => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

const shade = (c: Rgb, k: number): number => pack(Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0);

const fog = (dist: number): number => Math.max(MIN_LIGHT, 1 - dist / FOG_DIST);

/** Integer hash in [0, 1) for texture detail. */
export const hash = (n: number): number => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const BRICK: Rgb = [96, 80, 118];
const MORTAR: Rgb = [44, 38, 56];
const STONE: readonly Rgb[] = [[125, 110, 92], [95, 82, 68], [152, 138, 118]];
const STONE_EDGE: Rgb = [59, 49, 41];
const HOT: Rgb = [255, 110, 30];

/** Purple-grey brick for the arena's outer wall. */
function brick(u: number, z: number): Rgb {
  const row = Math.floor(z / 16);
  const shifted = u + (row % 2 ? 16 : 0);
  if (z % 16 < 2 || shifted % 32 < 2) return MORTAR;
  const k = 0.85 + hash(row * 131 + Math.floor(shifted / 32)) * 0.3;
  return [BRICK[0] * k, BRICK[1] * k, BRICK[2] * k];
}

/** Speckled stone, glowing orange as dragon fire or boulders wear it down. */
function stone(b: Boulder, u: number, z: number, faceLen: number): Rgb {
  if (u < 2 || u > faceLen - 2 || z > WALL_H - 3) return STONE_EDGE;
  const pick = hash(b.id * 7919 + Math.floor(u / 6) * 131 + Math.floor(z / 6));
  const base = STONE[pick < 0.6 ? 0 : pick < 0.8 ? 1 : 2]!;
  const heat = ((BOULDER_HP - b.hp) / BOULDER_HP) * 0.6;
  return [base[0] + (HOT[0] - base[0]) * heat, base[1] + (HOT[1] - base[1]) * heat, base[2] + (HOT[2] - base[2]) * heat];
}

function wallColor(hit: RayHit, boulders: readonly Boulder[], z: number): Rgb {
  if (hit.wall < 0) return brick(hit.u, z);
  const b = boulders[hit.wall]!;
  return stone(b, hit.u, z, hit.face === 'x' ? b.h : b.w);
}

/** Checkered floor tinted with the battle square's colour, with faint grid lines to show motion. */
function floorShade(x: number, y: number): number {
  const fx = ((x % FLOOR_CELL) + FLOOR_CELL) % FLOOR_CELL;
  const fy = ((y % FLOOR_CELL) + FLOOR_CELL) % FLOOR_CELL;
  if (fx < 1.5 || fy < 1.5) return 0.72;
  return (Math.floor(x / FLOOR_CELL) + Math.floor(y / FLOOR_CELL)) & 1 ? 1 : 0.88;
}

const SKY_TOP: Rgb = [16, 12, 28];
const SKY_LOW: Rgb = [58, 48, 82];

function ceilingRow(row: number, horizon: number): number {
  const t = Math.min(1, row / Math.max(1, horizon));
  return pack(
    (SKY_TOP[0] + (SKY_LOW[0] - SKY_TOP[0]) * t) | 0,
    (SKY_TOP[1] + (SKY_LOW[1] - SKY_TOP[1]) * t) | 0,
    (SKY_TOP[2] + (SKY_LOW[2] - SKY_TOP[2]) * t) | 0,
  );
}

/** Fills the frame with ceiling, walls and floor as seen by cam, and records each column's wall depth. */
export function rasterize(frame: Frame, cam: Camera, lens: Lens, boulders: readonly Boulder[], floor: Rgb): void {
  const { w, h, pixels, zbuf } = frame;
  const { focal, horizon } = lens;
  for (let col = 0; col < w; col++) {
    const ray = cameraRay(cam, (2 * (col + 0.5)) / w - 1);
    const hit = castRay(cam.pos, ray, boulders, ARENA_W, ARENA_H);
    zbuf[col] = hit.dist;
    const top = horizon - ((WALL_H - EYE) * focal) / hit.dist;
    const bottom = horizon + (EYE * focal) / hit.dist;
    const wallLight = fog(hit.dist) * (hit.face === 'y' ? 0.78 : 1);
    for (let row = 0; row < h; row++) {
      const y = row + 0.5;
      let c: number;
      if (y < top) {
        c = ceilingRow(row, horizon);
      } else if (y < bottom) {
        const z = EYE + ((horizon - y) * hit.dist) / focal;
        c = shade(wallColor(hit, boulders, z), wallLight);
      } else {
        const dist = (EYE * focal) / (y - horizon);
        const fx = cam.pos.x + ray.x * dist;
        const fy = cam.pos.y + ray.y * dist;
        c = shade(floor, floorShade(fx, fy) * fog(dist));
      }
      pixels[row * w + col] = c;
    }
  }
}

/** "rgb(r,g,b)" (as boardView's lerpColor makes) to components; grey if it can't be read. */
export function parseRgb(css: string): Rgb {
  const m = css.match(/\d+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}
