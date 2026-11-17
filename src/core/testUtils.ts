import { initialCycle } from './board';
import { createPiece } from './setup';
import type { GameState, Piece, PieceKind } from './types';

let nextId = 0;

export const piece = (kind: PieceKind, col: number, row: number, extra: Partial<Piece> = {}): Piece => ({
  ...createPiece(`${kind}-${++nextId}`, kind, col, row),
  ...extra,
});

export const stateWith = (pieces: Piece[], extra: Partial<GameState> = {}): GameState => ({
  pieces,
  fallen: [],
  turn: 'light',
  turnNumber: 1,
  cycle: initialCycle,
  winner: null,
  ...extra,
});
