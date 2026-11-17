import type { ArenaFighter, ArenaState, Shot } from '../combat/arena';
import { ARENA_W, FIGHTER_SIZE, SHOT_RADIUS } from '../combat/arena';
import type { Boulder } from '../combat/boulders';
import { BOULDER_HP } from '../combat/boulders';
import type { Side } from '../core/types';
import { UNITS } from '../core/units';
import { SPRITE_CELL, nativeHeading, spriteCell } from './sprites';
import { drawWeaponSwing } from './weapons';

export interface ArenaLook {
  readonly sprites: CanvasImageSource | null;
  /** Floor colour: the board square's colour at the moment of battle. */
  readonly floor: string;
}

const SIDE_COLOR: Record<Side, string> = { light: '#3a6fd8', dark: '#c8402f' };
const SHOT_COLOR: Record<Side, string> = { light: '#fff3a0', dark: '#d070ff' };
const FIRE_COLOR = '#ff8a2a';
const SPRITE_PX = 72;
const SPECKLES = 14;

/** Cheap deterministic hash in [0, 1) for render-only texture detail. */
const hash = (n: number): number => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

function drawBoulder(ctx: CanvasRenderingContext2D, b: Boulder): void {
  ctx.fillStyle = '#7d6e5c';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  for (let i = 0; i < SPECKLES; i++) {
    const seed = b.id * 97 + i * 7;
    const s = 3 + Math.floor(hash(seed + 3) * 5);
    ctx.fillStyle = hash(seed + 4) < 0.5 ? '#5f5244' : '#988a76';
    ctx.fillRect(b.x + hash(seed + 1) * (b.w - s), b.y + hash(seed + 2) * (b.h - s), s, s);
  }
  const heat = (BOULDER_HP - b.hp) / BOULDER_HP;
  if (heat > 0) {
    ctx.fillStyle = `rgba(255, 110, 30, ${0.25 + heat * 0.45})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.strokeStyle = '#3b3129';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
}

function drawShot(ctx: CanvasRenderingContext2D, s: Shot): void {
  ctx.beginPath();
  ctx.arc(s.pos.x, s.pos.y, s.melts ? SHOT_RADIUS + 2 : SHOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = s.melts ? FIRE_COLOR : SHOT_COLOR[s.owner];
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: ArenaFighter, sheet: CanvasImageSource | null): void {
  const { x, y } = f.pos;
  const half = FIGHTER_SIZE / 2;
  ctx.beginPath();
  ctx.ellipse(x, y + half, half + 4, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = SIDE_COLOR[f.side];
  ctx.fill();
  if (sheet) {
    const { sx, sy } = spriteCell(f.form);
    ctx.save();
    ctx.translate(x, 0);
    if (f.heading !== nativeHeading(f.form)) ctx.scale(-1, 1); // mirror so it always moves forward
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, sx, sy, SPRITE_CELL, SPRITE_CELL, -SPRITE_PX / 2, y + half + 4 - SPRITE_PX, SPRITE_PX, SPRITE_PX);
    ctx.restore();
  } else {
    ctx.fillStyle = SIDE_COLOR[f.side];
    ctx.fillRect(x - half, y - half, FIGHTER_SIZE, FIGHTER_SIZE);
  }
  if (f.hp <= 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x - half - 8, y - half - 20, FIGHTER_SIZE + 16, FIGHTER_SIZE + 28);
  }
}

const fighterName = (f: ArenaFighter): string =>
  f.form === f.pieceKind ? UNITS[f.pieceKind].name : `${UNITS[f.pieceKind].name} (as ${UNITS[f.form].name})`;

function drawHud(ctx: CanvasRenderingContext2D, f: ArenaFighter): void {
  const w = 220;
  const x = f.side === 'light' ? 16 : ARENA_W - 16 - w;
  const frac = Math.max(0, f.hp) / f.maxHp;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 6, 8, w + 12, 40);
  ctx.fillStyle = '#300';
  ctx.fillRect(x, 32, w, 10);
  ctx.fillStyle = frac > 0.5 ? '#3c3' : frac > 0.25 ? '#dc3' : '#d33';
  ctx.fillRect(x, 32, w * frac, 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = f.side === 'light' ? 'left' : 'right';
  ctx.fillText(`${fighterName(f)}  ${Math.max(0, f.hp)} HP`, f.side === 'light' ? x : x + w, 26);
}

function resultText(a: ArenaState): string {
  const { light, dark } = a.fighters;
  if (light.hp <= 0 && dark.hp <= 0) return 'Both fall!';
  return `${light.hp > 0 ? 'Light' : 'Dark'} wins!`;
}

function drawResult(ctx: CanvasRenderingContext2D, a: ArenaState): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, ctx.canvas.height / 2 - 40, ARENA_W, 80);
  ctx.fillStyle = '#ffe48a';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(resultText(a), ARENA_W / 2, ctx.canvas.height / 2);
}

export function drawArena(ctx: CanvasRenderingContext2D, arena: ArenaState, look: ArenaLook): void {
  ctx.fillStyle = look.floor;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  arena.boulders.forEach((b) => drawBoulder(ctx, b));
  drawFighter(ctx, arena.fighters.light, look.sprites);
  drawFighter(ctx, arena.fighters.dark, look.sprites);
  drawWeaponSwing(ctx, arena.fighters.light);
  drawWeaponSwing(ctx, arena.fighters.dark);
  arena.shots.forEach((s) => drawShot(ctx, s));
  drawHud(ctx, arena.fighters.light);
  drawHud(ctx, arena.fighters.dark);
  if (arena.endedAt !== null) drawResult(ctx, arena);
}
