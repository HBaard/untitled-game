import { SPELLS, availableSpells, casterOf } from '../core/spells';
import type { Piece, SpellId } from '../core/types';
import type { BoardUi } from './boardInput';
import { fallenToOffer } from './spellInput';

/** One square of the wheel: a spell, or (for Revive) a fallen piece. */
export type WheelItem =
  | { readonly kind: 'spell'; readonly spell: SpellId; readonly enabled: boolean }
  | { readonly kind: 'fallen'; readonly piece: Piece };

/** A wheel square, centred at (x, y) in board pixels. */
export interface WheelSlot {
  readonly item: WheelItem;
  readonly x: number;
  readonly y: number;
}

/** True when clicking this (selected) piece again should open the spell wheel: the side's caster, with a spell to cast. */
export function opensWheel(ui: BoardUi, piece: Piece): boolean {
  const caster = casterOf(ui.game, ui.game.turn);
  return caster?.id === piece.id && availableSpells(ui.game, ui.game.turn).length > 0;
}

/** What the wheel shows right now: the 7 spells, Revive's fallen pieces, or nothing. */
export function wheelItems(ui: BoardUi): WheelItem[] {
  if (ui.spell?.spell === 'revive' && !ui.spell.fallenId) {
    return fallenToOffer(ui).map((piece) => ({ kind: 'fallen', piece }));
  }
  if (!ui.wheel || ui.spell) return [];
  const offered = availableSpells(ui.game, ui.game.turn);
  return SPELLS.map((spell): WheelItem => ({ kind: 'spell', spell, enabled: offered.includes(spell) }));
}

/** Angular resolution used to find where squares fit on the board. */
const STEPS = 360;
/** Centres this far apart can never overlap (a square's diagonal is ~1.414 tiles). */
const SPACING = 1.45;

/**
 * Places n squares of size `tile` around (cx, cy), the caster, without covering it: on a full
 * circle when one fits on the board, otherwise spread over the widest arc that does (a caster on
 * an edge gets a half circle, one in a corner a quarter). The radius grows until neighbouring
 * squares are far enough apart never to overlap.
 */
export function layoutWheel(items: readonly WheelItem[], cx: number, cy: number, tile: number, boardPx: number): WheelSlot[] {
  const n = items.length;
  if (n === 0) return [];
  const half = tile / 2;
  const at = (r: number, a: number) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  const fits = (r: number, a: number): boolean => {
    const p = at(r, a);
    return p.x - half >= 0 && p.y - half >= 0 && p.x + half <= boardPx && p.y + half <= boardPx;
  };
  const place = (r: number, first: number, step: number): WheelSlot[] =>
    items.map((item, i) => ({ item, ...at(r, first + i * step) }));
  for (let r = tile * 1.5; r <= boardPx; r += tile / 8) {
    const minStep = 2 * Math.asin(Math.min(1, (tile * SPACING) / (2 * r)));
    const ok = Array.from({ length: STEPS }, (_, i) => fits(r, (i / STEPS) * 2 * Math.PI));
    if (ok.every(Boolean)) {
      if ((2 * Math.PI) / n >= minStep) return place(r, -Math.PI / 2, (2 * Math.PI) / n);
      continue;
    }
    const run = widestRun(ok);
    const arc = ((run.length - 1) / STEPS) * 2 * Math.PI;
    if (n === 1 || arc / (n - 1) >= minStep) {
      const step = n === 1 ? 0 : Math.min(arc / (n - 1), Math.PI / 2);
      const mid = ((run.start + (run.length - 1) / 2) / STEPS) * 2 * Math.PI;
      return place(r, mid - ((n - 1) / 2) * step, step);
    }
  }
  return clampedCircle(items, cx, cy, tile, boardPx);
}

/**
 * Fallback when no arc around the caster is wide enough (many fallen pieces, caster in a corner):
 * a circle big enough for every square, pushed onto the board. It may cover the caster.
 */
function clampedCircle(items: readonly WheelItem[], cx: number, cy: number, tile: number, boardPx: number): WheelSlot[] {
  const n = items.length;
  const radius = Math.max(tile * 1.5, (n * tile * SPACING) / (2 * Math.PI));
  const clamp = (v: number): number => Math.min(boardPx - radius - tile / 2, Math.max(radius + tile / 2, v));
  const ox = clamp(cx);
  const oy = clamp(cy);
  return items.map((item, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { item, x: ox + Math.cos(angle) * radius, y: oy + Math.sin(angle) * radius };
  });
}

/** Longest run of true values in a circular array. */
function widestRun(ok: readonly boolean[]): { start: number; length: number } {
  let best = { start: 0, length: 0 };
  const n = ok.length;
  const firstFalse = ok.indexOf(false);
  for (let i = 0, start = -1, len = 0; i < n; i++) {
    const idx = (firstFalse + 1 + i) % n;
    if (ok[idx]) {
      if (len === 0) start = idx;
      len++;
      if (len > best.length) best = { start, length: len };
    } else len = 0;
  }
  return best;
}

/** The wheel around the side's caster, in board pixels. */
export function wheelSlots(ui: BoardUi, tile: number, boardPx: number): WheelSlot[] {
  const items = wheelItems(ui);
  const caster = casterOf(ui.game, ui.game.turn);
  if (!caster || items.length === 0) return [];
  return layoutWheel(items, (caster.pos.col + 0.5) * tile, (caster.pos.row + 0.5) * tile, tile, boardPx);
}

export function slotAt(slots: readonly WheelSlot[], x: number, y: number, tile: number): WheelSlot | null {
  return slots.find((s) => Math.abs(x - s.x) <= tile / 2 && Math.abs(y - s.y) <= tile / 2) ?? null;
}

export const closeWheel = (ui: BoardUi): BoardUi => ({ ...ui, wheel: false });
