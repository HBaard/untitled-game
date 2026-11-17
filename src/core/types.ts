export type Side = 'light' | 'dark';

export type PieceKind =
  | 'wizard' | 'phoenix' | 'sylph' | 'unicorn' | 'golem' | 'valkyrie' | 'archer' | 'knight'
  | 'sorceress' | 'dragon' | 'manticore' | 'troll' | 'banshee' | 'goblin' | 'shapeshifter' | 'serpent';

export type MoveMode = 'ground' | 'fly' | 'teleport';

export interface Pos {
  readonly col: number;
  readonly row: number;
}

export interface Piece {
  readonly id: string;
  readonly kind: PieceKind;
  readonly side: Side;
  readonly hp: number;
  readonly pos: Pos;
  readonly imprisoned: boolean;
}

/** Luminance cycle of the shifting tiles: level 0 (darkest) .. CYCLE_MAX (lightest). */
export interface Cycle {
  readonly level: number;
  readonly rising: boolean;
}

export type Winner = Side | 'draw' | null;

export interface GameState {
  readonly pieces: readonly Piece[];
  readonly fallen: readonly Piece[];
  readonly turn: Side;
  readonly turnNumber: number;
  readonly cycle: Cycle;
  readonly winner: Winner;
}

export const opposite = (side: Side): Side => (side === 'light' ? 'dark' : 'light');
