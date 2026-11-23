import type { Rect } from '../combat/boulders';
import type { Vec } from '../combat/field';

/**
 * Wolfenstein-style raycasting over the arena: the outer edge and the boulders are the walls.
 * Render-only, so it may use any Math function (the sim's determinism rule doesn't apply).
 */

export interface RayHit {
  /** Distance along the ray in units of its direction vector (perpendicular depth for camera rays). */
  readonly dist: number;
  /** Which kind of face: 'x' = a vertical (left/right) face, 'y' = a horizontal one. */
  readonly face: 'x' | 'y';
  /** Position along the face in world pixels, for texturing. */
  readonly u: number;
  /** Index of the boulder hit, or -1 for the arena's outer wall. */
  readonly wall: number;
}

/** Entry parameter of the ray into one axis slab, or null if it never enters. */
function slab(o: number, d: number, lo: number, hi: number): [number, number] | null {
  if (d === 0) return o > lo && o < hi ? [-Infinity, Infinity] : null;
  const a = (lo - o) / d;
  const b = (hi - o) / d;
  return a < b ? [a, b] : [b, a];
}

/** Where a ray from o enters rect r (slab method), or null; a ray starting inside sees through it. */
export function hitRect(o: Vec, d: Vec, r: Rect, wall: number): RayHit | null {
  const sx = slab(o.x, d.x, r.x, r.x + r.w);
  const sy = slab(o.y, d.y, r.y, r.y + r.h);
  if (!sx || !sy) return null;
  const near = Math.max(sx[0], sy[0]);
  const far = Math.min(sx[1], sy[1]);
  if (near > far || near <= 0) return null;
  const face = sx[0] > sy[0] ? 'x' : 'y';
  const u = face === 'x' ? o.y + d.y * near - r.y : o.x + d.x * near - r.x;
  return { dist: near, face, u, wall };
}

/** Where a ray from inside the w x h arena meets its outer wall. */
export function hitBounds(o: Vec, d: Vec, w: number, h: number): RayHit {
  const tx = d.x > 0 ? (w - o.x) / d.x : d.x < 0 ? -o.x / d.x : Infinity;
  const ty = d.y > 0 ? (h - o.y) / d.y : d.y < 0 ? -o.y / d.y : Infinity;
  return tx < ty
    ? { dist: tx, face: 'x', u: o.y + d.y * tx, wall: -1 }
    : { dist: ty, face: 'y', u: o.x + d.x * ty, wall: -1 };
}

/** Nearest wall along the ray. */
export function castRay(o: Vec, d: Vec, rects: readonly Rect[], w: number, h: number): RayHit {
  let best = hitBounds(o, d, w, h);
  rects.forEach((r, i) => {
    const hit = hitRect(o, d, r, i);
    if (hit && hit.dist < best.dist) best = hit;
  });
  return best;
}

/** A camera: where the eye is, which way it looks (unit vector) and how wide (tan of half the FOV). */
export interface Camera {
  readonly pos: Vec;
  readonly dir: Vec;
  readonly plane: number;
}

/** To the camera's right on screen (y points down, so clockwise). */
export const rightOf = (d: Vec): Vec => ({ x: -d.y, y: d.x });

/** Ray direction for screen column camX in [-1, 1] (left edge to right edge). */
export function cameraRay(cam: Camera, camX: number): Vec {
  const r = rightOf(cam.dir);
  return { x: cam.dir.x + r.x * cam.plane * camX, y: cam.dir.y + r.y * cam.plane * camX };
}

/** A world point in camera space: depth ahead and camX across the screen (-1..1 inside the view). */
export function project(cam: Camera, p: Vec): { depth: number; camX: number } {
  const rel = { x: p.x - cam.pos.x, y: p.y - cam.pos.y };
  const depth = rel.x * cam.dir.x + rel.y * cam.dir.y;
  const r = rightOf(cam.dir);
  const across = rel.x * r.x + rel.y * r.y;
  return { depth, camX: across / (depth * cam.plane) };
}
