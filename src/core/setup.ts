import { initialCycle } from './board';
import type { GameState, Piece, PieceKind, Side } from './types';
import { UNITS } from './units';

/** One board column, index = row (rank 1..9). null leaves the square empty. */
type Column = readonly (PieceKind | null)[];

const LIGHT_BACK: Column = [
  'valkyrie', 'golem', 'unicorn', 'sylph', 'wizard', 'phoenix', 'unicorn', 'golem', 'valkyrie',
];
const LIGHT_FRONT: Column = [
  'archer', 'knight', 'knight', 'knight', 'knight', 'knight', 'knight', 'knight', 'archer',
];
const DARK_BACK: Column = [
  'banshee', 'troll', 'serpent', 'shapeshifter', 'sorceress', 'dragon', 'serpent', 'troll', 'banshee',
];
const DARK_FRONT: Column = [
  'manticore', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'manticore',
];

export function createPiece(id: string, kind: PieceKind, col: number, row: number): Piece {
  const stats = UNITS[kind];
  return { id, kind, side: stats.side, hp: stats.maxHp, pos: { col, row }, imprisoned: false };
}

function placeColumn(side: Side, kinds: Column, col: number, counter: Map<string, number>): Piece[] {
  return kinds.flatMap((kind, row) => {
    if (kind === null) return [];
    const n = (counter.get(kind) ?? 0) + 1;
    counter.set(kind, n);
    return [createPiece(`${side}-${kind}-${n}`, kind, col, row)];
  });
}

export function createInitialPieces(): Piece[] {
  const counter = new Map<string, number>();
  return [
    ...placeColumn('light', LIGHT_BACK, 0, counter),
    ...placeColumn('light', LIGHT_FRONT, 1, counter),
    ...placeColumn('dark', DARK_FRONT, 7, counter),
    ...placeColumn('dark', DARK_BACK, 8, counter),
  ];
}

export function createInitialState(): GameState {
  return {
    pieces: createInitialPieces(),
    fallen: [],
    turn: 'light',
    turnNumber: 1,
    cycle: initialCycle,
    winner: null,
  };
}
