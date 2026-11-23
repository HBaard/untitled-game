import { samePos } from '../core/board';
import { legalMoves, pieceAt } from '../core/movement';
import type { SpellCast } from '../core/spells';
import { castSpell } from '../core/spells';
import { applyMove, requirePiece, resolveBattle } from '../core/turn';
import type { Battle, BattleOutcome } from '../core/turn';
import type { GameState, Piece, Pos } from '../core/types';
import type { SpellDraft } from './spellInput';
import { planSpellClick } from './spellInput';
import { opensWheel } from './spellWheel';

/** The fighters as they were before the battle, plus how it ended. */
export interface BattleSummary {
  readonly attacker: Piece;
  readonly defender: Piece;
  readonly outcome: BattleOutcome;
}

export interface BoardUi {
  readonly game: GameState;
  readonly selectedId: string | null;
  /** An attack waiting for the arena to be fought; the board is frozen meanwhile. */
  readonly pendingBattle: Battle | null;
  readonly lastBattle: BattleSummary | null;
  /** A spell being aimed; board clicks pick its targets instead of moving. */
  readonly spell: SpellDraft | null;
  /** The spell wheel is open around the selected caster (its moves are hidden meanwhile). */
  readonly wheel: boolean;
}

export const initialUi = (game: GameState): BoardUi =>
  ({ game, selectedId: null, pendingBattle: null, lastBattle: null, spell: null, wheel: false });

export function selectedPiece(ui: BoardUi): Piece | null {
  return ui.selectedId ? requirePiece(ui.game, ui.selectedId) : null;
}

export function highlightedMoves(ui: BoardUi): Pos[] {
  if (ui.wheel) return [];
  const piece = selectedPiece(ui);
  return piece ? legalMoves(ui.game, piece) : [];
}

/** A board move as a serialisable action, so it can be sent over the network. */
export interface MoveAction {
  readonly type: 'move';
  readonly pieceId: string;
  readonly to: Pos;
}

/** What a click means: a new selection or spell aim (local only), a move, or a spell to cast. */
export type ClickResult =
  | { readonly kind: 'select'; readonly ui: BoardUi }
  | { readonly kind: 'move'; readonly action: MoveAction }
  | { readonly kind: 'spell'; readonly cast: SpellCast };

/** Select own piece, move or attack a highlighted square, or deselect. Applies nothing. */
export function planClick(ui: BoardUi, pos: Pos): ClickResult {
  if (ui.game.winner || ui.pendingBattle) return { kind: 'select', ui };
  if (ui.spell) return planSpellClick(ui, pos);
  if (ui.selectedId && highlightedMoves(ui).some((m) => samePos(m, pos))) {
    return { kind: 'move', action: { type: 'move', pieceId: ui.selectedId, to: pos } };
  }
  const clicked = pieceAt(ui.game.pieces, pos);
  // Clicking the selected caster again cycles: moves -> spell wheel -> deselected.
  if (clicked && clicked.id === ui.selectedId && !ui.wheel && opensWheel(ui, clicked)) {
    return { kind: 'select', ui: { ...ui, wheel: true } };
  }
  const canSelect = clicked !== undefined && clicked.side === ui.game.turn && clicked.id !== ui.selectedId;
  return { kind: 'select', ui: { ...ui, selectedId: canSelect ? clicked.id : null, wheel: false } };
}

/** Plays a move; an attack leaves the board frozen with a pending battle. Throws if illegal. */
export function applyMoveAction(ui: BoardUi, action: MoveAction): BoardUi {
  const result = applyMove(ui.game, action.pieceId, action.to);
  return result.kind === 'battle'
    ? { ...ui, selectedId: null, spell: null, wheel: false, pendingBattle: result.battle }
    : { ...ui, selectedId: null, spell: null, wheel: false, lastBattle: null, game: result.state };
}

/** Casts a spell; Teleport onto an enemy or Summon Elemental leaves a pending battle. Throws if illegal. */
export function applySpellCast(ui: BoardUi, c: SpellCast): BoardUi {
  const result = castSpell(ui.game, c);
  const base = { ...ui, selectedId: null, spell: null, wheel: false, game: result.state };
  return result.kind === 'battle' ? { ...base, pendingBattle: result.battle } : { ...base, lastBattle: null };
}

/** Plays whatever a click resolved to. */
export function applyClick(ui: BoardUi, r: ClickResult): BoardUi {
  switch (r.kind) {
    case 'select': return r.ui;
    case 'move': return applyMoveAction(ui, r.action);
    case 'spell': return applySpellCast(ui, r.cast);
  }
}

/** Hot-seat click handler: plan the click and play any move or spell straight away. */
export const clickTile = (ui: BoardUi, pos: Pos): BoardUi => applyClick(ui, planClick(ui, pos));

/** Applies the arena result to the board; the tile cycle advances with the turn. */
export function finishBattle(ui: BoardUi, outcome: BattleOutcome): BoardUi {
  const battle = ui.pendingBattle;
  if (!battle) throw new Error('No battle in progress');
  const lastBattle = {
    attacker: requirePiece(ui.game, battle.attackerId),
    defender: requirePiece(ui.game, battle.defenderId),
    outcome,
  };
  return {
    selectedId: null, pendingBattle: null, spell: null, wheel: false, lastBattle, game: resolveBattle(ui.game, battle, outcome),
  };
}
