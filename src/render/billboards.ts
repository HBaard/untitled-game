import type { ArenaFighter, ArenaState, Fire, Shot } from '../combat/arena';
import { BURST_TICKS } from '../combat/arena';
import type { ShotStyle } from '../combat/attacks';
import { FIRE_RADIUS, FIRE_TICKS, flameRadius } from '../combat/shots';
import { SIDE_COLOR } from './arenaView';
import { drawElemental, hasElementalShape } from './elementals';
import type { Frame, Lens } from './raster3d';
import { EYE, hash } from './raster3d';
import type { Camera } from './raycast';
import { project, rightOf } from './raycast';
import { SPRITE_CELL, nativeHeading, spriteCell } from './sprites';

/** A flat picture standing in the world, always turned to face the camera (Wolfenstein's sprites). */
export interface Billboard {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Height of its lower edge above the floor. */
  readonly lift: number;
  readonly src: CanvasImageSource;
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly flip: boolean;
  readonly alpha: number;
}

/** Fighters stand a little shorter than the walls. */
const FIGHTER_TALL = 58;
/** Sprites closer than this are skipped (your own shot leaving your hand). */
const NEAR_CLIP = 30;

function offscreen(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

const SHOT_COLOR: Record<ShotStyle, string> = {
  arrow: '230, 205, 150', spear: '235, 235, 245', spike: '215, 190, 120', bolt: '190, 240, 255',
  venom: '130, 230, 120', boulder: '140, 122, 102', whirlwind: '210, 235, 255', lightning: '200, 185, 255',
  fireball: '255, 140, 40', flame: '255, 120, 30', water: '90, 170, 255',
};

const GLOW_PX = 32;
const glowCache = new Map<string, HTMLCanvasElement>();

/** A soft glowing ball: shots and burst rings in the 3D view. */
function glow(rgb: string, ring = false): HTMLCanvasElement {
  const key = `${rgb}|${ring}`;
  const cached = glowCache.get(key);
  if (cached) return cached;
  const c = offscreen(GLOW_PX, GLOW_PX, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    if (ring) {
      g.addColorStop(0, `rgba(${rgb}, 0)`);
      g.addColorStop(0.7, `rgba(${rgb}, 0.25)`);
      g.addColorStop(0.92, `rgba(${rgb}, 0.9)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
    } else {
      g.addColorStop(0, 'rgba(255, 255, 240, 1)');
      g.addColorStop(0.35, `rgba(${rgb}, 1)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_PX, GLOW_PX);
  });
  glowCache.set(key, c);
  return c;
}

let rockCanvas: HTMLCanvasElement | null = null;
const rock = (): HTMLCanvasElement =>
  (rockCanvas ??= offscreen(GLOW_PX, GLOW_PX, (ctx) => {
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#8a7a66';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3b3129';
    ctx.stroke();
    ctx.fillStyle = '#a89880';
    ctx.fillRect(9, 8, 6, 5);
  }));

let flameCanvas: HTMLCanvasElement | null = null;
/** Tongues of fire for the wizard's burning ground. */
const flames = (): HTMLCanvasElement =>
  (flameCanvas ??= offscreen(GLOW_PX, GLOW_PX, (ctx) => {
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 4.3;
      const tall = 14 + hash(i + 11) * 16;
      ctx.beginPath();
      ctx.moveTo(x - 4, 32);
      ctx.quadraticCurveTo(x, 32 - tall * 2, x + 4, 32);
      ctx.closePath();
      ctx.fillStyle = i % 3 ? 'rgba(255, 120, 20, 0.85)' : 'rgba(255, 220, 90, 0.95)';
      ctx.fill();
    }
  }));

const ELEMENTAL_W = 60;
const ELEMENTAL_H = 64;
const elementalCanvases = new Map<string, HTMLCanvasElement>();

/** Elementals are drawn procedurally; repaint one into a small canvas each frame (it animates). */
function elementalSource(f: ArenaFighter, tick: number): HTMLCanvasElement {
  let c = elementalCanvases.get(f.form);
  if (!c) {
    c = offscreen(ELEMENTAL_W, ELEMENTAL_H, () => undefined);
    elementalCanvases.set(f.form, c);
  }
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, ELEMENTAL_W, ELEMENTAL_H);
  drawElemental(ctx, f.form, ELEMENTAL_W / 2, ELEMENTAL_H, tick);
  return c;
}

const fallbackCanvases = new Map<string, HTMLCanvasElement>();
const fallback = (color: string): HTMLCanvasElement => {
  const c = fallbackCanvases.get(color) ?? offscreen(8, 8, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, 8);
  });
  fallbackCanvases.set(color, c);
  return c;
};

/** The opponent, mirrored so it seems to walk the way it is heading across your screen. */
export function fighterBillboard(f: ArenaFighter, cam: Camera, sheet: CanvasImageSource | null, tick: number): Billboard {
  const right = rightOf(cam.dir);
  const screenHeading = f.facing.x * right.x + f.facing.y * right.y >= 0 ? 1 : -1;
  const base = { x: f.pos.x, y: f.pos.y, width: FIGHTER_TALL, height: FIGHTER_TALL, lift: 0, flip: false };
  const alpha = f.hp <= 0 ? 0.35 : f.immune > 0 && f.immune % 10 < 5 ? 0.6 : 1;
  const cell = spriteCell(f.form);
  if (hasElementalShape(f.form)) {
    return { ...base, src: elementalSource(f, tick), sx: 0, sy: 0, sw: ELEMENTAL_W, sh: ELEMENTAL_H, alpha };
  }
  if (!cell || !sheet) return { ...base, src: fallback(SIDE_COLOR[f.side]), sx: 0, sy: 0, sw: 8, sh: 8, alpha };
  return {
    ...base, src: sheet, sx: cell.sx, sy: cell.sy, sw: SPRITE_CELL, sh: SPRITE_CELL,
    flip: screenHeading !== nativeHeading(f.form), alpha,
  };
}

function shotBillboard(s: Shot): Billboard {
  const r = s.grows ? flameRadius(s.travelled) : s.radius;
  const size = Math.max(10, r * 2.4);
  const src = s.style === 'boulder' ? rock() : glow(SHOT_COLOR[s.style]);
  return {
    x: s.pos.x, y: s.pos.y, width: size, height: size, lift: Math.max(0, EYE - 6 - size / 2),
    src, sx: 0, sy: 0, sw: GLOW_PX, sh: GLOW_PX, flip: false, alpha: 1,
  };
}

function fireBillboard(f: Fire, tick: number): Billboard {
  const fade = Math.min(1, (FIRE_TICKS - f.age) / 60);
  const flicker = 0.8 + hash(f.id * 31 + Math.floor(tick / 5)) * 0.4;
  return {
    x: f.pos.x, y: f.pos.y, width: FIRE_RADIUS * 2, height: 30 * flicker, lift: 0,
    src: flames(), sx: 0, sy: 0, sw: GLOW_PX, sh: GLOW_PX, flip: false, alpha: fade,
  };
}

/** The phoenix blast or banshee scream around the opponent, as an expanding glowing ring. */
function burstBillboard(f: ArenaFighter): Billboard | null {
  if (f.attack.kind !== 'burst' || f.anim <= 0) return null;
  const progress = 1 - f.anim / BURST_TICKS;
  const size = f.attack.radius * 2 * (0.3 + 0.7 * progress);
  const rgb = f.attack.style === 'blast' ? '255, 170, 60' : '220, 225, 255';
  return {
    x: f.pos.x, y: f.pos.y, width: size, height: size, lift: Math.max(0, EYE - size / 2),
    src: glow(rgb, true), sx: 0, sy: 0, sw: GLOW_PX, sh: GLOW_PX, flip: false, alpha: 1 - progress,
  };
}

/** Everything the viewer can see besides walls: the opponent, every shot, fires and the opponent's burst. */
export function billboardsFor(arena: ArenaState, other: ArenaFighter, cam: Camera, sheet: CanvasImageSource | null): Billboard[] {
  const burst = burstBillboard(other);
  return [
    ...arena.fires.map((f) => fireBillboard(f, arena.tick)),
    fighterBillboard(other, cam, sheet, arena.tick),
    ...(burst ? [burst] : []),
    ...arena.shots.map(shotBillboard),
  ];
}

/**
 * Draws billboards far to near, one pixel column at a time, skipping columns where a wall is nearer
 * (the classic z-buffer trick that lets boulders hide what is behind them).
 */
export function drawBillboards(ctx: CanvasRenderingContext2D, frame: Frame, cam: Camera, lens: Lens, boards: readonly Billboard[]): void {
  const placed = boards
    .map((b) => ({ b, ...project(cam, b) }))
    .filter((p) => p.depth > NEAR_CLIP)
    .sort((p, q) => q.depth - p.depth);
  ctx.imageSmoothingEnabled = false;
  for (const { b, depth, camX } of placed) {
    const scale = lens.focal / depth;
    const w = b.width * scale;
    const left = (frame.w / 2) * (1 + camX) - w / 2;
    const top = lens.horizon - (b.lift + b.height - EYE) * scale;
    const h = b.height * scale;
    ctx.globalAlpha = b.alpha;
    const first = Math.max(0, Math.floor(left));
    const last = Math.min(frame.w - 1, Math.ceil(left + w) - 1);
    for (let col = first; col <= last; col++) {
      if (depth >= frame.zbuf[col]!) continue;
      const u = Math.min(b.sw - 1, Math.floor(((col + 0.5 - left) / w) * b.sw));
      ctx.drawImage(b.src, b.sx + (b.flip ? b.sw - 1 - u : u), b.sy, 1, b.sh, col, top, 1, h);
    }
  }
  ctx.globalAlpha = 1;
}
