import { BOARD_SIZE, POWER_POINTS, tileLuminance } from '../core/board';
import type { Cycle, Piece, PieceKind, Pos } from '../core/types';
import { UNITS } from '../core/units';
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
};

export interface BoardView {
  readonly pieces: readonly Piece[];
  readonly cycle: Cycle;
  readonly selected: Piece | null;
  readonly moves: readonly Pos[];
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
  const { sx, sy } = spriteCell(piece.kind);
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

export function drawBoard(ctx: CanvasRenderingContext2D, view: BoardView): void {
  drawTiles(ctx, view.cycle);
  drawDividers(ctx);
  drawPowerPoints(ctx);
  drawHighlights(ctx, view);
  view.pieces.forEach((p) => drawPiece(ctx, p, view.sprites ?? null));
}
