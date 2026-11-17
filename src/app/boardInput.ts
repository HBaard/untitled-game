import { samePos } from '../core/board';
import { legalMoves, pieceAt } from '../core/movement';
import { applyMove, requirePiece, resolveBattle } from '../core/turn';
import type { Battle, BattleOutcome } from '../core/turn';
import type { GameState, Piece, Pos } from '../core/types';

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
}

export const initialUi = (game: GameState): BoardUi =>
  ({ game, selectedId: null, pendingBattle: null, lastBattle: null });

export function selectedPiece(ui: BoardUi): Piece | null {
  return ui.selectedId ? requirePiece(ui.game, ui.selectedId) : null;
}

export function highlightedMoves(ui: BoardUi): Pos[] {
  const piece = selectedPiece(ui);
  return piece ? legalMoves(ui.game, piece) : [];
}

function tryMove(ui: BoardUi, pos: Pos): BoardUi | null {
  if (!highlightedMoves(ui).some((m) => samePos(m, pos))) return null;
  const result = applyMove(ui.game, ui.selectedId!, pos);
  return result.kind === 'battle'
    ? { ...ui, selectedId: null, pendingBattle: result.battle }
    : { ...ui, selectedId: null, lastBattle: null, game: result.state };
}

/** Pure click handler: select own piece, move or attack a highlighted square, or deselect. */
export function clickTile(ui: BoardUi, pos: Pos): BoardUi {
  if (ui.game.winner || ui.pendingBattle) return ui;
  const moved = tryMove(ui, pos);
  if (moved) return moved;
  const clicked = pieceAt(ui.game.pieces, pos);
  const canSelect = clicked && clicked.side === ui.game.turn && clicked.id !== ui.selectedId;
  return { ...ui, selectedId: canSelect ? clicked.id : null };
}

/** Applies the arena result to the board; the tile cycle advances with the turn. */
export function finishBattle(ui: BoardUi, outcome: BattleOutcome): BoardUi {
  const battle = ui.pendingBattle;
  if (!battle) throw new Error('No battle in progress');
  const lastBattle = {
    attacker: requirePiece(ui.game, battle.attackerId),
    defender: requirePiece(ui.game, battle.defenderId),
    outcome,
  };
  return { selectedId: null, pendingBattle: null, lastBattle, game: resolveBattle(ui.game, battle, outcome) };
}
