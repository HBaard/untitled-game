import { describe, expect, it } from 'vitest';
import { createInitialState } from './setup';

const countBy = (kinds: string[]) =>
  kinds.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});

describe('createInitialState', () => {
  const state = createInitialState();
  const light = state.pieces.filter((p) => p.side === 'light');
  const dark = state.pieces.filter((p) => p.side === 'dark');

  it('fields 18 pieces per side with the right composition', () => {
    expect(light).toHaveLength(18);
    expect(dark).toHaveLength(18);
    expect(countBy(light.map((p) => p.kind))).toEqual({
      wizard: 1, phoenix: 1, sylph: 1, unicorn: 2, golem: 2, valkyrie: 2, archer: 2, knight: 7,
    });
    expect(countBy(dark.map((p) => p.kind))).toEqual({
      sorceress: 1, dragon: 1, manticore: 2, troll: 2, banshee: 2, goblin: 7, shapeshifter: 1, serpent: 2,
    });
  });

  it('gives every piece a unique id and square', () => {
    expect(new Set(state.pieces.map((p) => p.id)).size).toBe(36);
    expect(new Set(state.pieces.map((p) => `${p.pos.col},${p.pos.row}`)).size).toBe(36);
  });

  it('lines the inner columns with ranged flankers and 7 pawns', () => {
    const column = (col: number) => state.pieces
      .filter((p) => p.pos.col === col)
      .sort((a, b) => a.pos.row - b.pos.row)
      .map((p) => p.kind);
    expect(column(1)).toEqual(['archer', ...Array(7).fill('knight'), 'archer']);
    expect(column(7)).toEqual(['manticore', ...Array(7).fill('goblin'), 'manticore']);
  });

  it('starts with light to move and no winner', () => {
    expect(state.turn).toBe('light');
    expect(state.winner).toBeNull();
  });
});

describe('back columns', () => {
  const column = (col: number) => createInitialState().pieces
    .filter((p) => p.pos.col === col)
    .sort((a, b) => a.pos.row - b.pos.row)
    .map((p) => p.kind);

  it('puts the leaders on their home power points flanked by sylph/shapeshifter and phoenix/dragon', () => {
    expect(column(0)).toEqual(
      ['valkyrie', 'golem', 'unicorn', 'sylph', 'wizard', 'phoenix', 'unicorn', 'golem', 'valkyrie']);
    expect(column(8)).toEqual(
      ['banshee', 'troll', 'serpent', 'shapeshifter', 'sorceress', 'dragon', 'serpent', 'troll', 'banshee']);
  });
});
