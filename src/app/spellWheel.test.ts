import { describe, expect, it } from 'vitest';
import { SPELLS } from '../core/spells';
import { piece, stateWith } from '../core/testUtils';
import { applyClick, clickTile, highlightedMoves, initialUi } from './boardInput';
import { chooseFallen, startSpell } from './spellInput';
import type { WheelItem } from './spellWheel';
import { closeWheel, layoutWheel, slotAt, wheelItems, wheelSlots } from './spellWheel';

const TILE = 64;
const BOARD = TILE * 9;
const wizard = piece('wizard', 2, 2);
const knight = piece('knight', 1, 1);
const sorceress = piece('sorceress', 6, 6);
const fallen = { ...piece('archer', 0, 0), hp: 0 };
const ui0 = initialUi(stateWith([wizard, knight, sorceress], { fallen: [fallen] }));
const selected = clickTile(ui0, wizard.pos);
const opened = clickTile(selected, wizard.pos);

describe('clicking the caster cycles: moves, spells, deselected', () => {
  it('first click selects it and shows its moves', () => {
    expect(selected).toMatchObject({ selectedId: wizard.id, wheel: false });
    expect(highlightedMoves(selected).length).toBeGreaterThan(0);
  });

  it('second click opens the wheel and hides the moves', () => {
    expect(opened).toMatchObject({ selectedId: wizard.id, wheel: true });
    expect(highlightedMoves(opened)).toEqual([]);
  });

  it('third click deselects', () => {
    expect(clickTile(opened, wizard.pos)).toMatchObject({ selectedId: null, wheel: false });
  });

  it('with no spell left to cast, the second click deselects', () => {
    const allUsed = initialUi(stateWith([wizard, sorceress], { spellsUsed: { light: [...SPELLS], dark: [] } }));
    const again = clickTile(clickTile(allUsed, wizard.pos), wizard.pos);
    expect(again).toMatchObject({ selectedId: null, wheel: false });
  });

  it('other pieces just toggle selected / deselected', () => {
    const k = clickTile(ui0, knight.pos);
    expect(k).toMatchObject({ selectedId: knight.id, wheel: false });
    expect(clickTile(k, knight.pos).selectedId).toBeNull();
  });

  it('the wheel holds the 7 spells; ones with nothing to cast on are disabled (grey)', () => {
    const items = wheelItems(opened);
    expect(items).toHaveLength(SPELLS.length);
    expect(items.find((i) => i.kind === 'spell' && i.spell === 'heal')).toEqual({ kind: 'spell', spell: 'heal', enabled: false });
    expect(items.find((i) => i.kind === 'spell' && i.spell === 'teleport')).toMatchObject({ enabled: true });
  });

  it('used spells are disabled', () => {
    const used = initialUi(stateWith([wizard, knight, sorceress], { spellsUsed: { light: ['teleport'], dark: [] } }));
    const wheel = clickTile(clickTile(used, wizard.pos), wizard.pos);
    expect(wheelItems(wheel).find((i) => i.kind === 'spell' && i.spell === 'teleport')).toMatchObject({ enabled: false });
  });

  it('closes when a spell is picked, Esc is pressed, or another piece is clicked', () => {
    const r = startSpell(opened, 'teleport');
    expect(r.kind === 'select' && r.ui.wheel).toBe(false);
    expect(closeWheel(opened).wheel).toBe(false);
    expect(clickTile(opened, knight.pos)).toMatchObject({ selectedId: knight.id, wheel: false });
  });
});

describe('Revive picks its fallen piece from a wheel too', () => {
  it('shows the fallen pieces, then closes once one is chosen', () => {
    const r = applyClick(opened, startSpell(opened, 'revive'));
    expect(wheelItems(r)).toEqual([{ kind: 'fallen', piece: fallen }]);
    expect(wheelItems(chooseFallen(r, fallen.id))).toEqual([]);
  });
});

describe('layout', () => {
  const items = (n: number): WheelItem[] => Array.from({ length: n }, () => ({ kind: 'spell', spell: 'heal', enabled: true }));

  it('keeps every square fully on the board, even around a corner piece', () => {
    for (const [cx, cy] of [[32, 32], [BOARD - 32, BOARD / 2], [BOARD / 2, BOARD / 2]] as const) {
      for (const s of layoutWheel(items(8), cx, cy, TILE, BOARD)) {
        expect(s.x - TILE / 2).toBeGreaterThanOrEqual(0);
        expect(s.y - TILE / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + TILE / 2).toBeLessThanOrEqual(BOARD);
        expect(s.y + TILE / 2).toBeLessThanOrEqual(BOARD);
      }
    }
  });

  it('never covers the caster\'s own square', () => {
    for (const [cx, cy] of [[32, 32], [32, BOARD / 2], [BOARD / 2, BOARD / 2], [BOARD - 32, BOARD - 32]] as const) {
      for (const s of layoutWheel(items(8), cx, cy, TILE, BOARD)) {
        expect(Math.abs(s.x - cx) >= TILE || Math.abs(s.y - cy) >= TILE).toBe(true);
      }
    }
  });

  it('squares never overlap, however many there are, even in a corner', () => {
    for (const [cx, cy] of [[BOARD / 2, BOARD / 2], [32, 32], [32, BOARD / 2]] as const) {
      for (const n of [8, 12, 17]) {
        const slots = layoutWheel(items(n), cx, cy, TILE, BOARD);
        for (const a of slots) {
          for (const b of slots) {
            if (a === b) continue;
            expect(Math.abs(a.x - b.x) >= TILE || Math.abs(a.y - b.y) >= TILE).toBe(true);
          }
        }
      }
    }
  });

  it('squares never overlap (centre, many squares)', () => {
    for (const n of [8, 12, 17]) {
      const slots = layoutWheel(items(n), BOARD / 2, BOARD / 2, TILE, BOARD);
      for (const a of slots) {
        for (const b of slots) {
          if (a === b) continue;
          expect(Math.abs(a.x - b.x) >= TILE || Math.abs(a.y - b.y) >= TILE).toBe(true);
        }
      }
    }
  });

  it('slotAt finds the square under a click', () => {
    const slots = wheelSlots(opened, TILE, BOARD);
    expect(slots).toHaveLength(7);
    const s = slots[3]!;
    expect(slotAt(slots, s.x + 20, s.y - 20, TILE)).toBe(s);
    expect(slotAt(slots, -100, -100, TILE)).toBeNull();
  });
});
