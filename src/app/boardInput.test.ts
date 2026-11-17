import { describe, expect, it } from 'vitest';
import { piece, stateWith } from '../core/testUtils';
import { clickTile, finishBattle, initialUi } from './boardInput';

const k = piece('knight', 1, 1);
const g = piece('goblin', 2, 1);
const g2 = piece('goblin', 8, 8);
const ui0 = initialUi(stateWith([k, g, g2]));

describe('clickTile', () => {
  it('selects own piece, ignores enemy pieces', () => {
    expect(clickTile(ui0, k.pos).selectedId).toBe(k.id);
    expect(clickTile(ui0, g.pos).selectedId).toBeNull();
  });

  it('clicking the selected piece again deselects it', () => {
    expect(clickTile(clickTile(ui0, k.pos), k.pos).selectedId).toBeNull();
  });

  it('moves to a highlighted empty square', () => {
    const ui = clickTile(clickTile(ui0, k.pos), { col: 1, row: 2 });
    expect(ui.game.turn).toBe('dark');
    expect(ui.selectedId).toBeNull();
    expect(ui.lastBattle).toBeNull();
  });

  it('attacking freezes the board with a pending battle', () => {
    const ui = clickTile(clickTile(ui0, k.pos), g.pos);
    expect(ui.pendingBattle).toEqual({ attackerId: k.id, defenderId: g.id, square: g.pos });
    expect(ui.game.turn).toBe('light');
    expect(clickTile(ui, k.pos)).toBe(ui);
  });

  it('finishBattle applies the arena outcome and records it', () => {
    const pending = clickTile(clickTile(ui0, k.pos), g.pos);
    const ui = finishBattle(pending, { attackerHp: 2, defenderHp: 0 });
    expect(ui.pendingBattle).toBeNull();
    expect(ui.lastBattle?.defender.id).toBe(g.id);
    expect(ui.game.pieces.find((p) => p.id === k.id)?.pos).toEqual(g.pos);
    expect(ui.game.turn).toBe('dark');
  });

  it('finishBattle without a pending battle throws', () => {
    expect(() => finishBattle(ui0, { attackerHp: 1, defenderHp: 0 })).toThrow();
  });
});
