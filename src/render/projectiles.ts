import type { ArenaFighter, Fire, Shot } from '../combat/arena';
import { BURST_TICKS } from '../combat/arena';
import { FIRE_RADIUS, FIRE_TICKS } from '../combat/shots';

type Ctx = CanvasRenderingContext2D;
const INK = '#1a1208';

/** Deterministic [0, 1) noise for flicker, so frames don't depend on Math.random. */
const noise = (n: number): number => {
  let x = Math.imul(n ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  return ((Math.imul(x, 0x85ebca6b) ^ (x >>> 13)) >>> 0) / 4294967296;
};

/** Runs `draw` in a frame centred on the shot and rotated to its flight direction (+x forward). */
function aligned(ctx: Ctx, s: Shot, draw: () => void): void {
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(Math.atan2(s.vel.y, s.vel.x));
  draw();
  ctx.restore();
}

function outlinedRect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function tip(ctx: Ctx, x: number, half: number, len: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x, -half);
  ctx.lineTo(x + len, 0);
  ctx.lineTo(x, half);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawArrow(ctx: Ctx): void {
  outlinedRect(ctx, -16, -1, 18, 2, '#8a5a2b');
  outlinedRect(ctx, -18, -4, 5, 3, '#e8e8e8'); // fletching
  outlinedRect(ctx, -18, 1, 5, 3, '#e8e8e8');
  tip(ctx, 2, 3, 7, '#c9ced6');
}

function drawSpear(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(160, 200, 255, 0.35)'; // magic glow
  ctx.fillRect(-26, -5, 40, 10);
  outlinedRect(ctx, -24, -1.5, 28, 3, '#d4af37');
  tip(ctx, 4, 4, 11, '#e6f0ff');
}

/** A bone-white spike with a blood-red base, big enough to see on dark and light floors. */
function drawSpike(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(255, 230, 200, 0.35)';
  ctx.fillRect(-26, -2, 16, 4); // faint trail
  tip(ctx, -12, 5, 22, '#f0e4c4');
  outlinedRect(ctx, -14, -3, 5, 6, '#a3262a');
}

function drawStreak(ctx: Ctx, length: number, glow: string, core: string, width: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = glow;
  ctx.lineWidth = width * 2.2;
  ctx.beginPath();
  ctx.moveTo(-length, 0);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawBoulderShot(ctx: Ctx, s: Shot): void {
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(s.travelled / 20); // tumbling
  ctx.fillStyle = INK;
  ctx.fillRect(-s.radius - 1.5, -s.radius - 1.5, s.radius * 2 + 3, s.radius * 2 + 3);
  ctx.fillStyle = '#7d6e5c';
  ctx.fillRect(-s.radius, -s.radius, s.radius * 2, s.radius * 2);
  ctx.fillStyle = '#5f5244';
  ctx.fillRect(-s.radius + 3, -s.radius + 4, 6, 5);
  ctx.fillRect(2, 1, 7, 6);
  ctx.fillStyle = '#988a76';
  ctx.fillRect(-4, -s.radius + 2, 5, 4);
  ctx.restore();
}

function drawWhirlwind(ctx: Ctx, s: Shot): void {
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(-s.travelled / 6);
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 1 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(150, 210, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, s.radius - i * 3, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLightning(ctx: Ctx, s: Shot): void {
  aligned(ctx, s, () => {
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    for (let i = 1; i <= 5; i++) ctx.lineTo(-22 + i * 5, (noise(s.id * 31 + Math.floor(s.travelled / 9) * 7 + i) - 0.5) * 12);
    ctx.lineTo(6, 0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200, 120, 255, 0.6)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.lineCap = 'butt';
  });
}

function drawFireball(ctx: Ctx, s: Shot): void {
  aligned(ctx, s, () => {
    ctx.fillStyle = 'rgba(255, 120, 20, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-6, 0, s.radius + 8, s.radius, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(s.pos.x, s.pos.y, s.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ff7a1a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s.pos.x, s.pos.y, s.radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe680';
  ctx.fill();
}

/** Size of one flame "pixel"; cells sit on the screen grid whichever way the dragon faces. */
const FLAME_CELL = 6;
const FLAME_COLORS = ['#ffe680', '#ffb030', '#ff7a1a', '#d8401a', '#8a2208'];

/**
 * The dragon's breath as a burst of fire flying forward: a cone with its wide, rounded
 * end at the flame front (s.radius across, the size that hits) and a tail trailing
 * behind it, built from square cells so it reads as pixel art.
 */
function drawFlame(ctx: Ctx, s: Shot): void {
  const dir = { x: s.vel.x / s.speed, y: s.vel.y / s.speed };
  const tail = Math.min(s.travelled + 10, 40 + s.radius * 1.5);
  const reach = tail + s.radius;
  const frame = Math.floor(s.travelled / 8);
  const snap = (v: number): number => Math.floor(v / FLAME_CELL) * FLAME_CELL;
  for (let gy = snap(s.pos.y - reach); gy <= s.pos.y + reach; gy += FLAME_CELL) {
    for (let gx = snap(s.pos.x - reach); gx <= s.pos.x + reach; gx += FLAME_CELL) {
      // Cell centre in the flame's frame: u forward from the front, v sideways.
      const dx = gx + FLAME_CELL / 2 - s.pos.x;
      const dy = gy + FLAME_CELL / 2 - s.pos.y;
      const u = dx * dir.x + dy * dir.y;
      const v = Math.abs(dx * -dir.y + dy * dir.x);
      const along = u >= 0 ? 1 : 1 + u / tail; // 1 at the front, 0 at the tip of the tail
      if (u < -tail || along <= 0) continue;
      const halfWidth = u >= 0 ? Math.sqrt(Math.max(0, s.radius * s.radius - u * u)) : s.radius * along;
      if (v > halfWidth) continue;
      const edge = v / Math.max(1, halfWidth); // 0 on the centre line, 1 at the edge
      const flicker = noise(s.id * 977 + Math.floor(gx / FLAME_CELL) * 131 + Math.floor(gy / FLAME_CELL) * 71 + frame);
      if (edge > 0.7 && flicker < 0.35) continue; // ragged, flickering edges
      const heat = edge * 0.7 + (1 - along) * 0.6 + (flicker - 0.5) * 0.3;
      const shade = Math.min(FLAME_COLORS.length - 1, Math.max(0, Math.floor(heat * FLAME_COLORS.length)));
      ctx.fillStyle = FLAME_COLORS[shade]!;
      ctx.fillRect(gx, gy, FLAME_CELL, FLAME_CELL);
    }
  }
}

/** A blob of water with a splashing tail of droplets. */
function drawWater(ctx: Ctx, s: Shot): void {
  aligned(ctx, s, () => {
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(-i * 9, (noise(s.id * 5 + i + Math.floor(s.travelled / 10)) - 0.5) * 8, s.radius * (0.55 - i * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120, 190, 255, 0.6)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, s.radius * 1.2, s.radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a8ee8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#123a6a';
    ctx.stroke();
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(2, -s.radius * 0.55, 4, 3);
  });
}

export function drawShot(ctx: Ctx, s: Shot): void {
  switch (s.style) {
    case 'arrow': return aligned(ctx, s, () => drawArrow(ctx));
    case 'spear': return aligned(ctx, s, () => drawSpear(ctx));
    case 'spike': return aligned(ctx, s, () => drawSpike(ctx));
    case 'bolt': return aligned(ctx, s, () => drawStreak(ctx, 26, 'rgba(160, 230, 255, 0.5)', '#ffffff', 4));
    case 'venom': return aligned(ctx, s, () => drawStreak(ctx, 34, 'rgba(90, 220, 90, 0.5)', '#d8ffb0', 3));
    case 'boulder': return drawBoulderShot(ctx, s);
    case 'whirlwind': return drawWhirlwind(ctx, s);
    case 'lightning': return drawLightning(ctx, s);
    case 'fireball': return drawFireball(ctx, s);
    case 'flame': return drawFlame(ctx, s);
    case 'water': return drawWater(ctx, s);
  }
}

/** Burning ground: flickering flames that die down over its last second. */
export function drawFire(ctx: Ctx, f: Fire): void {
  const fade = Math.min(1, (FIRE_TICKS - f.age) / 60);
  ctx.beginPath();
  ctx.arc(f.pos.x, f.pos.y, FIRE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(120, 30, 0, ${0.35 * fade})`;
  ctx.fill();
  const frame = Math.floor(f.age / 5);
  for (let i = 0; i < 9; i++) {
    const a = noise(f.id * 17 + i) * Math.PI * 2;
    const d = noise(f.id * 29 + i) * FIRE_RADIUS * 0.8;
    const h = 6 + noise(f.id * 41 + i * 5 + frame) * 10;
    const x = f.pos.x + Math.cos(a) * d;
    const y = f.pos.y + Math.sin(a) * d;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x, y - h * 2, x + 4, y);
    ctx.closePath();
    ctx.fillStyle = i % 3 ? `rgba(255, 120, 20, ${0.8 * fade})` : `rgba(255, 220, 90, ${0.9 * fade})`;
    ctx.fill();
  }
}

/** The phoenix blast or banshee scream: a ring expanding out to the attack's reach. */
export function drawBurst(ctx: Ctx, f: ArenaFighter): void {
  if (f.attack.kind !== 'burst' || f.anim <= 0) return;
  const progress = 1 - f.anim / BURST_TICKS;
  const r = f.attack.radius * (0.3 + 0.7 * progress);
  const alpha = 1 - progress;
  const blast = f.attack.style === 'blast';
  ctx.beginPath();
  ctx.arc(f.pos.x, f.pos.y, r, 0, Math.PI * 2);
  ctx.fillStyle = blast ? `rgba(255, 120, 20, ${0.35 * alpha})` : `rgba(190, 200, 255, ${0.25 * alpha})`;
  ctx.fill();
  ctx.lineWidth = blast ? 8 : 4;
  ctx.strokeStyle = blast ? `rgba(255, 210, 80, ${alpha})` : `rgba(230, 235, 255, ${alpha})`;
  ctx.stroke();
  if (!blast) {
    for (const k of [0.7, 0.45]) {
      ctx.beginPath();
      ctx.arc(f.pos.x, f.pos.y, r * k, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Golden shimmer while the phoenix cannot be hurt. */
export function drawImmunity(ctx: Ctx, f: ArenaFighter, size: number): void {
  if (f.immune <= 0) return;
  ctx.beginPath();
  ctx.arc(f.pos.x, f.pos.y, size * 0.75, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(255, 215, 90, ${0.4 + 0.4 * (f.immune % 10 < 5 ? 1 : 0)})`;
  ctx.stroke();
}
