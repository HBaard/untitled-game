import { samePos } from '../core/board';
import { pieceAt } from '../core/movement';
import type { SpellCast } from '../core/spells';
import {
  SPELL_NAMES, availableSpells, exchangeTargets, healTargets, imprisonTargets, reviveCandidates,
  reviveSquares, summonSquares, teleportDestinations, teleportPieces,
} from '../core/spells';
import { requirePiece } from '../core/turn';
import type { Piece, Pos, SpellId } from '../core/types';
import { UNITS } from '../core/units';
import type { BoardUi, ClickResult } from './boardInput';

/** A spell being aimed: which spell, and the first target chosen so far (for two-step spells). */
export interface SpellDraft {
  readonly spell: SpellId;
  /** Teleport: the piece to move. Exchange: the first piece. */
  readonly pieceId: string | null;
  /** Revive: the fallen piece to bring back (chosen from a list, not the board). */
  readonly fallenId: string | null;
}

const positions = (pieces: readonly Piece[]): Pos[] => pieces.map((p) => p.pos);
const select = (ui: BoardUi): ClickResult => ({ kind: 'select', ui });
const aim = (ui: BoardUi, draft: SpellDraft): ClickResult => select({ ...ui, selectedId: null, wheel: false, spell: draft });
const cast = (c: SpellCast): ClickResult => ({ kind: 'spell', cast: c });

/** Picks a spell from the wheel. Shift Time needs no target, so it is cast straight away. */
export function startSpell(ui: BoardUi, spell: SpellId): ClickResult {
  if (!availableSpells(ui.game, ui.game.turn).includes(spell)) return select(ui);
  if (spell === 'shiftTime') return cast({ spell });
  return aim(ui, { spell, pieceId: null, fallenId: null });
}

export const cancelSpell = (ui: BoardUi): BoardUi => ({ ...ui, spell: null });

/** Revive: choose which fallen piece to bring back; then click a square next to the caster. */
export function chooseFallen(ui: BoardUi, fallenId: string): BoardUi {
  if (ui.spell?.spell !== 'revive') return ui;
  return { ...ui, spell: { ...ui.spell, fallenId } };
}

/** Squares the next click may target, for highlighting. */
export function spellTargets(ui: BoardUi): Pos[] {
  const d = ui.spell;
  if (!d) return [];
  const { game } = ui;
  const side = game.turn;
  switch (d.spell) {
    case 'teleport':
      return d.pieceId
        ? teleportDestinations(game, requirePiece(game, d.pieceId)).filter((p) => !samePos(p, requirePiece(game, d.pieceId!).pos))
        : positions(teleportPieces(game, side));
    case 'heal': return positions(healTargets(game, side));
    case 'exchange': return positions(exchangeTargets(game).filter((p) => p.id !== d.pieceId));
    case 'summonElemental': return summonSquares(game);
    case 'revive': return d.fallenId ? reviveSquares(game, side) : [];
    case 'imprison': return positions(imprisonTargets(game, side));
    case 'shiftTime': return [];
  }
}

/** Fallen pieces Revive can bring back, for the list in the spell panel. */
export const fallenToOffer = (ui: BoardUi): Piece[] =>
  ui.spell?.spell === 'revive' ? reviveCandidates(ui.game, ui.game.turn) : [];

const PROMPTS: Readonly<Record<SpellId, readonly [string, string]>> = {
  teleport: ['Choose one of your pieces to teleport', 'Choose where to send it (an enemy starts a fight)'],
  heal: ['Choose a wounded piece to heal', ''],
  exchange: ['Choose the first piece to swap', 'Choose the piece to swap it with'],
  summonElemental: ['Choose an empty square for the elemental (it fights once, then vanishes)', ''],
  revive: ['Choose a fallen piece to bring back', 'Choose an empty square next to your caster'],
  imprison: ['Choose an enemy to imprison', ''],
  shiftTime: ['', ''],
};

export function spellPrompt(ui: BoardUi): string {
  const d = ui.spell;
  if (!d) return '';
  const second = d.spell === 'revive' ? d.fallenId !== null : d.pieceId !== null;
  return `${SPELL_NAMES[d.spell]}: ${PROMPTS[d.spell][second ? 1 : 0]}`;
}

/** A board click while aiming a spell: picks a target, casts, or (off target) does nothing. */
export function planSpellClick(ui: BoardUi, pos: Pos): ClickResult {
  const d = ui.spell!;
  if (!spellTargets(ui).some((t) => samePos(t, pos))) return select(ui);
  const id = pieceAt(ui.game.pieces, pos)?.id;
  switch (d.spell) {
    case 'teleport':
      return d.pieceId ? cast({ spell: 'teleport', pieceId: d.pieceId, to: pos }) : aim(ui, { ...d, pieceId: id! });
    case 'exchange':
      return d.pieceId ? cast({ spell: 'exchange', firstId: d.pieceId, secondId: id! }) : aim(ui, { ...d, pieceId: id! });
    case 'heal': return cast({ spell: 'heal', pieceId: id! });
    case 'summonElemental': return cast({ spell: 'summonElemental', to: pos });
    case 'imprison': return cast({ spell: 'imprison', targetId: id! });
    case 'revive': return cast({ spell: 'revive', fallenId: d.fallenId!, to: pos });
    case 'shiftTime': return select(ui);
  }
}

export const fallenLabel = (p: Piece): string => UNITS[p.kind].name;
