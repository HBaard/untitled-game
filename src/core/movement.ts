import { BOARD_SIZE, chebyshev, inBounds, samePos } from './board';
import type { GameState, Piece, Pos } from './types';
import { UNITS } from './units';

const ORTHOGONAL: readonly Pos[] = [
  { col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 },
];

const key = (p: Pos): string => `${p.col},${p.row}`;

export const pieceAt = (pieces: readonly Piece[], pos: Pos): Piece | undefined =>
  pieces.find((p) => samePos(p.pos, pos));

const neighbours = (p: Pos): Pos[] =>
  ORTHOGONAL.map((d) => ({ col: p.col + d.col, row: p.row + d.row })).filter(inBounds);

/** Orthogonal steps through empty squares; may end on (but not pass) an enemy. */
function groundMoves(pieces: readonly Piece[], piece: Piece, range: number): Pos[] {
  const seen = new Set([key(piece.pos)]);
  const result: Pos[] = [];
  let frontier: Pos[] = [piece.pos];
  for (let step = 0; step < range; step++) {
    const next: Pos[] = [];
    for (const n of frontier.flatMap(neighbours)) {
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      const occupant = pieceAt(pieces, n);
      if (occupant?.side === piece.side) continue;
      result.push(n);
      if (!occupant) next.push(n);
    }
    frontier = next;
  }
  return result;
}

/** Fliers and teleporters: any square within range (incl. diagonals), ignoring blockers. */
function jumpMoves(pieces: readonly Piece[], piece: Piece, range: number): Pos[] {
  const result: Pos[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const to = { col, row };
      const dist = chebyshev(piece.pos, to);
      if (dist === 0 || dist > range) continue;
      if (pieceAt(pieces, to)?.side === piece.side) continue;
      result.push(to);
    }
  }
  return result;
}

export function legalMoves(state: GameState, piece: Piece): Pos[] {
  if (piece.imprisoned) return [];
  const { move, range } = UNITS[piece.kind];
  return move === 'ground'
    ? groundMoves(state.pieces, piece, range)
    : jumpMoves(state.pieces, piece, range);
}

export const isLegalMove = (state: GameState, piece: Piece, to: Pos): boolean =>
  legalMoves(state, piece).some((p) => samePos(p, to));
