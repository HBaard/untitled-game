import { describe, expect, it } from 'vitest';
import { legalMoves } from './movement';
import { createInitialState } from './setup';
import { piece, stateWith } from './testUtils';
import type { Pos } from './types';

const sorted = (ps: Pos[]) => ps.map((p) => `${p.col},${p.row}`).sort();

describe('ground movement', () => {
  it('reaches every square within orthogonal range on an empty board', () => {
    const k = piece('knight', 4, 4);
    // Diamond of radius 3 minus the origin: 1 + 4 + 8 + 12 = 25 squares.
    expect(legalMoves(stateWith([k]), k)).toHaveLength(24);
  });

  it('cannot pass through pieces but can end on an enemy', () => {
    const k = piece('knight', 0, 0);
    const wall = piece('knight', 1, 0);
    const enemy = piece('goblin', 0, 1);
    const moves = sorted(legalMoves(stateWith([k, wall, enemy]), k));
    expect(moves).toEqual(['0,1']);
  });

  it('routes around blockers within range', () => {
    const k = piece('knight', 0, 0);
    const wall = piece('knight', 1, 0);
    expect(sorted(legalMoves(stateWith([k, wall]), k))).toContain('1,1');
    expect(sorted(legalMoves(stateWith([k, wall]), k))).not.toContain('2,0');
  });
});

describe('flying and teleport movement', () => {
  it('ignores blockers and allows diagonals', () => {
    const v = piece('valkyrie', 0, 0);
    const blockers = [piece('knight', 1, 0), piece('knight', 0, 1), piece('knight', 1, 1)];
    const moves = sorted(legalMoves(stateWith([v, ...blockers]), v));
    expect(moves).toContain('3,3');
    expect(moves).not.toContain('1,1');
    expect(moves).toHaveLength(16 - 1 - 3);
  });
});

describe('restrictions', () => {
  it('imprisoned pieces cannot move', () => {
    const k = piece('knight', 4, 4, { imprisoned: true });
    expect(legalMoves(stateWith([k]), k)).toEqual([]);
  });

  it('back-row ground pieces are boxed in at the start', () => {
    const state = createInitialState();
    const golem = state.pieces.find((p) => p.kind === 'golem')!;
    expect(legalMoves(state, golem)).toEqual([]);
  });
});
