import type { ArenaFighter, ArenaState } from '../combat/arena';
import { ARENA_H, ARENA_W, BURST_TICKS, SWING_TICKS } from '../combat/arena';
import type { Side } from '../core/types';
import { opposite } from '../core/types';
import type { ArenaLook } from './arenaView';
import { SIDE_COLOR, drawField, drawResult, fighterName } from './arenaView';
import { billboardsFor, drawBillboards } from './billboards';
import type { Frame, Lens } from './raster3d';
import { makeFrame, parseRgb, rasterize } from './raster3d';
import type { Camera } from './raycast';

/** Screen pixels per rendered pixel: chunky, like the real thing (and cheap). */
const PIXEL = 2;
/** Widest horizontal field of view, as tan(half angle); narrow views get a proportionally smaller one. */
const MAX_PLANE = 0.75;
const VIEW_H = 420;
const GAP = 4;
const STRIP_H = 640 - VIEW_H;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Hot-seat: light's eyes on the left, dark's on the right. Online: only your own, full width. */
function viewBoxes(viewer: Side | null): [Side, Box][] {
  if (viewer) return [[viewer, { x: 0, y: 0, w: ARENA_W, h: VIEW_H }]];
  const half = (ARENA_W - GAP) / 2;
  return [
    ['light', { x: 0, y: 0, w: half, h: VIEW_H }],
    ['dark', { x: half + GAP, y: 0, w: half, h: VIEW_H }],
  ];
}

/** One reusable low-res canvas + pixel frame per view size. */
interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly frame: Frame;
}

const surfaces = new Map<string, Surface>();

function surfaceFor(w: number, h: number): Surface {
  const key = `${w}x${h}`;
  const found = surfaces.get(key);
  if (found) return found;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const made = { canvas, ctx: canvas.getContext('2d')!, frame: makeFrame(w, h) };
  surfaces.set(key, made);
  return made;
}

function lensFor(w: number, h: number): Lens {
  const focal = Math.max(h * 0.9, w / 2 / MAX_PLANE);
  return { focal, horizon: h / 2 };
}

/** Red flash when hurt: remembers each side's HP from the previous frame. */
const hurtFlash: Record<Side, { hp: number; tick: number; flash: number }> = {
  light: { hp: 0, tick: -1, flash: 0 },
  dark: { hp: 0, tick: -1, flash: 0 },
};

function updateFlash(f: ArenaFighter, tick: number): number {
  const memo = hurtFlash[f.side];
  const sameFight = tick >= memo.tick;
  memo.flash = sameFight && f.hp < memo.hp ? 1 : Math.max(0, memo.flash - 0.06);
  memo.hp = f.hp;
  memo.tick = tick;
  return memo.flash;
}

/** Crosshair, own melee swing / burst, immunity glow and the hurt flash, over a finished view. */
function drawOverlays(ctx: CanvasRenderingContext2D, me: ArenaFighter, box: Box, tick: number): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy);
  ctx.lineTo(cx - 3, cy);
  ctx.moveTo(cx + 3, cy);
  ctx.lineTo(cx + 9, cy);
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx, cy - 3);
  ctx.moveTo(cx, cy + 3);
  ctx.lineTo(cx, cy + 9);
  ctx.stroke();
  if (me.attack.kind === 'melee' && me.anim > 0) drawSwing(ctx, box, 1 - me.anim / SWING_TICKS);
  if (me.attack.kind === 'burst' && me.anim > 0) {
    const a = (me.anim / BURST_TICKS) * 0.45;
    ctx.fillStyle = me.attack.style === 'blast' ? `rgba(255, 140, 30, ${a})` : `rgba(210, 220, 255, ${a})`;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  if (me.immune > 0) {
    ctx.strokeStyle = `rgba(255, 215, 90, ${me.immune % 10 < 5 ? 0.8 : 0.4})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
  }
  const flash = updateFlash(me, tick);
  if (flash > 0) {
    ctx.fillStyle = `rgba(220, 20, 20, ${flash * 0.4})`;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
}

/** A blade sweeping right to left across the lower view. */
function drawSwing(ctx: CanvasRenderingContext2D, box: Box, progress: number): void {
  const pivotX = box.x + box.w * 0.5;
  const pivotY = box.y + box.h * 1.15;
  const reach = box.h * 0.75;
  const angle = -Math.PI * (0.2 + 0.6 * progress);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - progress)})`;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, reach * 0.85, -Math.PI * 0.2, angle, true);
  ctx.stroke();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = '#d8dde6';
  ctx.fillRect(-6, -reach, 12, reach * 0.8);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(-14, -reach * 0.22, 28, 8);
  ctx.restore();
}

function drawView(ctx: CanvasRenderingContext2D, arena: ArenaState, look: ArenaLook, side: Side, box: Box): void {
  const me = arena.fighters[side];
  const other = arena.fighters[opposite(side)];
  const s = surfaceFor(Math.round(box.w / PIXEL), Math.round(box.h / PIXEL));
  const lens = lensFor(s.frame.w, s.frame.h);
  const cam: Camera = { pos: me.pos, dir: me.facing, plane: s.frame.w / 2 / lens.focal };
  rasterize(s.frame, cam, lens, arena.boulders, parseRgb(look.floor));
  s.ctx.putImageData(s.frame.image, 0, 0);
  drawBillboards(s.ctx, s.frame, cam, lens, billboardsFor(arena, other, cam, look.sprites));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, box.x, box.y, box.w, box.h);
  drawOverlays(ctx, me, box, arena.tick);
}

const MINIMAP_SCALE = STRIP_H / ARENA_H;

/** The top-down battlefield, shrunk, with a pointer showing which way each fighter looks. */
function drawMinimap(ctx: CanvasRenderingContext2D, arena: ArenaState, look: ArenaLook): void {
  const w = ARENA_W * MINIMAP_SCALE;
  const x = (ARENA_W - w) / 2;
  ctx.save();
  ctx.translate(x, VIEW_H);
  ctx.scale(MINIMAP_SCALE, MINIMAP_SCALE);
  drawField(ctx, arena, look);
  for (const f of [arena.fighters.light, arena.fighters.dark]) {
    ctx.strokeStyle = SIDE_COLOR[f.side];
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(f.pos.x, f.pos.y);
    ctx.lineTo(f.pos.x + f.facing.x * 70, f.pos.y + f.facing.y * 70);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, VIEW_H, w, STRIP_H);
}

/** Name and health bar beside the minimap. */
function drawPanel(ctx: CanvasRenderingContext2D, f: ArenaFighter, x: number, w: number): void {
  const y = VIEW_H + 24;
  const frac = Math.max(0, f.hp) / f.maxHp;
  ctx.fillStyle = SIDE_COLOR[f.side];
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(f.side === 'light' ? 'LIGHT' : 'DARK', x, y + 14);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(fighterName(f), x, y + 40);
  ctx.fillStyle = '#300';
  ctx.fillRect(x, y + 68, w, 18);
  ctx.fillStyle = frac > 0.5 ? '#3c3' : frac > 0.25 ? '#dc3' : '#d33';
  ctx.fillRect(x, y + 68, w * frac, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`${Math.max(0, f.hp)} / ${f.maxHp} HP`, x + 6, y + 70);
  const reload = f.reload > 0 ? 1 - f.cooldown / f.reload : 1;
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y + 94, w, 6);
  ctx.fillStyle = reload >= 1 ? '#8cf' : '#468';
  ctx.fillRect(x, y + 94, w * reload, 6);
}

/** First-person arena: split screen (or your own view online), minimap and health panels below. */
export function drawArena3d(ctx: CanvasRenderingContext2D, arena: ArenaState, look: ArenaLook): void {
  ctx.fillStyle = '#0c0a12';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const [side, box] of viewBoxes(look.viewer)) drawView(ctx, arena, look, side, box);
  drawMinimap(ctx, arena, look);
  const panelW = (ARENA_W - ARENA_W * MINIMAP_SCALE) / 2 - 48;
  drawPanel(ctx, arena.fighters.light, 24, panelW);
  drawPanel(ctx, arena.fighters.dark, ARENA_W - 24 - panelW, panelW);
  if (arena.endedAt !== null) drawResult(ctx, arena);
}
