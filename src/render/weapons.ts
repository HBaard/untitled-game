import type { ArenaFighter } from '../combat/arena';
import { FIGHTER_SIZE, SWING_TICKS } from '../combat/arena';
import type { PieceKind } from '../core/types';

type Weapon = 'sword' | 'club';

const WEAPONS: Partial<Record<PieceKind, Weapon>> = { knight: 'sword', goblin: 'club' };

/** Half-width of the sweep either side of the facing direction. */
const SWING_ARC = Math.PI / 3;
/** The weapon pivots at the fighter's hand, a little ahead of its centre. */
const HAND_OFFSET = FIGHTER_SIZE * 0.3;
const OUTLINE = '#1a1208';

type Ctx = CanvasRenderingContext2D;

/** Filled rectangle with a dark outline; all weapon parts are built from these. */
function block(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/** Drawn along +x from the grip; about 56px long. */
function drawSword(ctx: Ctx): void {
  block(ctx, -4, -3, 4, 6, '#d4af37'); // pommel
  block(ctx, 0, -2, 10, 4, '#6b4423'); // grip
  block(ctx, 10, -9, 4, 18, '#d4af37'); // crossguard
  block(ctx, 14, -3, 36, 6, '#cfd6e0'); // blade
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(14, -3, 36, 2); // edge highlight
  ctx.beginPath(); // tip
  ctx.moveTo(50, -3);
  ctx.lineTo(57, 0);
  ctx.lineTo(50, 3);
  ctx.closePath();
  ctx.fillStyle = '#cfd6e0';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** Drawn along +x from the grip; a knobbly head about 46px out. */
function drawClub(ctx: Ctx): void {
  block(ctx, 0, -2.5, 16, 5, '#7a4a22'); // handle
  ctx.beginPath(); // tapered head
  ctx.moveTo(14, -4);
  ctx.lineTo(40, -9);
  ctx.lineTo(46, -6);
  ctx.lineTo(46, 6);
  ctx.lineTo(40, 9);
  ctx.lineTo(14, 4);
  ctx.closePath();
  ctx.fillStyle = '#9a6633';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = '#5c3a1a'; // knots
  ctx.fillRect(24, -3, 4, 3);
  ctx.fillRect(34, 2, 4, 3);
  ctx.fillRect(40, -5, 3, 3);
  ctx.fillStyle = '#c8c8c8'; // studs
  ctx.fillRect(30, -8, 3, 3);
  ctx.fillRect(43, 0, 3, 3);
}

const TRAIL: Record<Weapon, string> = { sword: '255, 255, 255', club: '200, 160, 110' };

/** Motion trail from where the swing started to where the weapon is now. */
function drawTrail(ctx: Ctx, weapon: Weapon, from: number, to: number, fade: number, reach: number): void {
  ctx.beginPath();
  ctx.arc(0, 0, reach, from, to);
  ctx.lineWidth = weapon === 'sword' ? 6 : 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${TRAIL[weapon]}, ${0.5 * fade})`;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

const REACH: Record<Weapon, number> = { sword: HAND_OFFSET + 50, club: HAND_OFFSET + 40 };

/** Sweeps the unit's weapon across the square in front while a swing is running. */
export function drawWeaponSwing(ctx: Ctx, f: ArenaFighter): void {
  if (f.attack.kind !== 'melee' || f.anim <= 0) return;
  const weapon = WEAPONS[f.form] ?? 'sword';
  const progress = 1 - f.anim / SWING_TICKS;
  const facing = Math.atan2(f.facing.y, f.facing.x);
  // Light swings clockwise, dark counter-clockwise, so the two read as mirror images.
  const dir = f.side === 'light' ? 1 : -1;
  const start = facing - dir * SWING_ARC;
  const now = start + dir * 2 * SWING_ARC * Math.min(1, progress * 1.4);
  ctx.save();
  ctx.translate(f.pos.x, f.pos.y);
  drawTrail(ctx, weapon, Math.min(start, now), Math.max(start, now), f.anim / SWING_TICKS, REACH[weapon]);
  ctx.rotate(now);
  ctx.translate(HAND_OFFSET, 0);
  if (weapon === 'sword') drawSword(ctx);
  else drawClub(ctx);
  ctx.restore();
}
