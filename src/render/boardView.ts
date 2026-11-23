import { BOARD_SIZE, POWER_POINTS, tileLuminance } from '../core/board';
import type { Cycle, Piece, PieceKind, Pos } from '../core/types';
import { UNITS } from '../core/units';
import type { WheelSlot } from '../app/spellWheel';
import type { SpellId } from '../core/types';
import { drawElemental, hasElementalShape } from './elementals';
import { ICON_SIZE, drawIcon } from './spellIcons';
import { SPRITE_CELL, spriteCell } from './sprites';

export const TILE = 64;
export const BOARD_PX = TILE * BOARD_SIZE;

const SIDE_COLOR: Record<Piece['side'], string> = { light: '#3a6fd8', dark: '#c8402f' };

// Neutral grey ramp so shifting tiles blend between the same black and white as fixed ones.
const DARK_RGB = [34, 34, 38];
const LIGHT_RGB = [236, 236, 230];
const DIVIDER = '#7a7a80';
const DIVIDER_WIDTH = 2;

const GLYPH: Record<PieceKind, string> = {
  wizard: 'Wz', phoenix: 'Ph', sylph: 'Sy', unicorn: 'Un', golem: 'Go', valkyrie: 'Va', archer: 'Ar', knight: 'Kn',
  sorceress: 'So', dragon: 'Dr', manticore: 'Ma', troll: 'Tr', banshee: 'Ba', goblin: 'Gb', shapeshifter: 'Sh', serpent: 'Se',
  fireElemental: 'Fi', waterElemental: 'Wa', airElemental: 'Ai', earthElemental: 'Ea',
};

export interface BoardView {
  readonly pieces: readonly Piece[];
  readonly cycle: Cycle;
  readonly selected: Piece | null;
  readonly moves: readonly Pos[];
  /** Squares a spell being aimed can target (drawn in purple). */
  readonly spellTargets?: readonly Pos[];
  /** A piece already picked as a spell's first target. */
  readonly spellPicked?: Piece | null;
  /** The spell wheel's squares, drawn over the board. */
  readonly wheel?: readonly WheelSlot[];
  /** Sprite sheet; null (not loaded yet / failed) draws text glyphs instead. */
  readonly sprites?: CanvasImageSource | null;
}

export const lerpColor = (t: number): string =>
  `rgb(${DARK_RGB.map((d, i) => Math.round(d + (LIGHT_RGB[i]! - d) * t)).join(',')})`;

export const pixelToTile = (x: number, y: number): Pos => ({
  col: Math.floor(x / TILE),
  row: Math.floor(y / TILE),
});

function drawTiles(ctx: CanvasRenderingContext2D, cycle: Cycle): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      ctx.fillStyle = lerpColor(tileLuminance({ col, row }, cycle));
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
}

/** Thin lines between tiles so neighbours of the same colour stay distinguishable. */
function drawDividers(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = DIVIDER_WIDTH;
  ctx.beginPath();
  for (let i = 1; i < BOARD_SIZE; i++) {
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, BOARD_PX);
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(BOARD_PX, i * TILE);
  }
  ctx.stroke();
}

function drawPowerPoints(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 3;
  for (const p of POWER_POINTS) {
    ctx.beginPath();
    ctx.arc((p.col + 0.5) * TILE, (p.row + 0.5) * TILE, TILE * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHighlights(ctx: CanvasRenderingContext2D, view: BoardView): void {
  ctx.fillStyle = 'rgba(80, 200, 120, 0.45)';
  for (const m of view.moves) ctx.fillRect(m.col * TILE + 4, m.row * TILE + 4, TILE - 8, TILE - 8);
  ctx.fillStyle = 'rgba(170, 90, 255, 0.45)';
  for (const t of view.spellTargets ?? []) ctx.fillRect(t.col * TILE + 4, t.row * TILE + 4, TILE - 8, TILE - 8);
  if (view.spellPicked) {
    ctx.strokeStyle = '#b070ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(view.spellPicked.pos.col * TILE + 2, view.spellPicked.pos.row * TILE + 2, TILE - 4, TILE - 4);
  }
  if (!view.selected) return;
  ctx.strokeStyle = '#4fd18b';
  ctx.lineWidth = 3;
  ctx.strokeRect(view.selected.pos.col * TILE + 2, view.selected.pos.row * TILE + 2, TILE - 4, TILE - 4);
}

function drawHpBar(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number): void {
  const frac = piece.hp / UNITS[piece.kind].maxHp;
  ctx.fillStyle = '#300';
  ctx.fillRect(x - 22, y + 20, 44, 5);
  ctx.fillStyle = frac > 0.5 ? '#3c3' : frac > 0.25 ? '#dc3' : '#d33';
  ctx.fillRect(x - 22, y + 20, 44 * frac, 5);
}

function drawGlyph(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number): void {
  const light = piece.side === 'light';
  ctx.beginPath();
  ctx.arc(x, y - 4, TILE * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = light ? '#f4f1ff' : '#1a0f1f';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = SIDE_COLOR[piece.side];
  ctx.stroke();
  ctx.fillStyle = light ? '#1d2a55' : '#f0c0b0';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(GLYPH[piece.kind], x, y - 4);
}

const SPRITE_PX = 52;

function drawSprite(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource, piece: Piece, x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 20, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = SIDE_COLOR[piece.side];
  ctx.fill();
  const cell = spriteCell(piece.kind);
  if (!cell) {
    if (hasElementalShape(piece.kind)) drawElemental(ctx, piece.kind, x, y + 12, 0, 3); // feet above the side-colour base
    else drawGlyph(ctx, piece, x, y);
    return;
  }
  const { sx, sy } = cell;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, sx, sy, SPRITE_CELL, SPRITE_CELL, x - SPRITE_PX / 2, y + 18 - SPRITE_PX, SPRITE_PX, SPRITE_PX);
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, sheet: CanvasImageSource | null): void {
  const x = (piece.pos.col + 0.5) * TILE;
  const y = (piece.pos.row + 0.5) * TILE;
  if (sheet) drawSprite(ctx, sheet, piece, x, y);
  else drawGlyph(ctx, piece, x, y);
  if (piece.imprisoned) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#888';
    ctx.strokeRect(x - 22, y - 28, 44, 46);
  }
  drawHpBar(ctx, piece, x, y);
}

/** Short names that fit under an icon in a board-sized square. */
const SPELL_LABELS: Record<SpellId, string> = {
  teleport: 'Teleport', heal: 'Heal', shiftTime: 'Shift Time', exchange: 'Exchange',
  summonElemental: 'Summon', revive: 'Revive', imprison: 'Imprison',
};
const ICON_PX = 3;

function drawWheelSlot(ctx: CanvasRenderingContext2D, slot: WheelSlot, sheet: CanvasImageSource | null): void {
  const { item } = slot;
  const left = Math.round(slot.x - TILE / 2);
  const top = Math.round(slot.y - TILE / 2);
  const enabled = item.kind !== 'spell' || item.enabled;
  ctx.fillStyle = enabled ? '#221c30' : '#3a3a3e';
  ctx.fillRect(left, top, TILE, TILE);
  ctx.lineWidth = 2;
  ctx.strokeStyle = enabled ? '#c9a227' : '#6a6a70';
  ctx.strokeRect(left + 1, top + 1, TILE - 2, TILE - 2);
  const iconLeft = left + (TILE - ICON_SIZE * ICON_PX) / 2;
  if (item.kind === 'fallen') {
    const cell = spriteCell(item.piece.kind);
    if (sheet && cell) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, cell.sx, cell.sy, SPRITE_CELL, SPRITE_CELL, left + 10, top + 2, 44, 44);
    }
  } else {
    drawIcon(ctx, item.spell, iconLeft, top + 6, ICON_PX, !enabled);
  }
  const label = item.kind === 'spell' ? SPELL_LABELS[item.spell] : UNITS[item.piece.kind].name;
  ctx.fillStyle = enabled ? '#f0e6c8' : '#9a9aa0';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, left + TILE / 2, top + TILE - 6, TILE - 6);
}

function drawWheel(ctx: CanvasRenderingContext2D, slots: readonly WheelSlot[], sheet: CanvasImageSource | null): void {
  if (slots.length === 0) return;
  ctx.fillStyle = 'rgba(10, 8, 18, 0.45)';
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);
  slots.forEach((s) => drawWheelSlot(ctx, s, sheet));
}

export function drawBoard(ctx: CanvasRenderingContext2D, view: BoardView): void {
  drawTiles(ctx, view.cycle);
  drawDividers(ctx);
  drawPowerPoints(ctx);
  drawHighlights(ctx, view);
  view.pieces.forEach((p) => drawPiece(ctx, p, view.sprites ?? null));
  drawWheel(ctx, view.wheel ?? [], view.sprites ?? null);
}
