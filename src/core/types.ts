export type Side = 'light' | 'dark';

export type PieceKind =
  | 'wizard' | 'phoenix' | 'sylph' | 'unicorn' | 'golem' | 'valkyrie' | 'archer' | 'knight'
  | 'sorceress' | 'dragon' | 'manticore' | 'troll' | 'banshee' | 'goblin' | 'shapeshifter' | 'serpent'
  // Summoned for a single fight by the Summon Elemental spell; never on the board for long.
  | 'fireElemental' | 'waterElemental' | 'airElemental' | 'earthElemental';

export type SpellId = 'teleport' | 'heal' | 'shiftTime' | 'exchange' | 'summonElemental' | 'revive' | 'imprison';

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
  /** Spells each side has cast this game; each spell can be cast once. */
  readonly spellsUsed: Readonly<Record<Side, readonly SpellId[]>>;
}

export const opposite = (side: Side): Side => (side === 'light' ? 'dark' : 'light');
