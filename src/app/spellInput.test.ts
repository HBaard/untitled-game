import { describe, expect, it } from 'vitest';
import { piece, stateWith } from '../core/testUtils';
import type { GameState } from '../core/types';
import { UNITS, isElemental } from '../core/units';
import type { BoardUi, ClickResult } from './boardInput';
import { applyClick, clickTile, initialUi } from './boardInput';
import {
  cancelSpell, chooseFallen, fallenToOffer, spellPrompt, spellTargets, startSpell,
} from './spellInput';

const wizard = piece('wizard', 2, 2);
const knight = piece('knight', 1, 1);
const golem = piece('golem', 3, 3, { hp: 3 });
const goblin = piece('goblin', 7, 2);
const sorceress = piece('sorceress', 6, 6);
const fallen = { ...piece('archer', 0, 0), hp: 0 };
const game: GameState = stateWith([wizard, knight, golem, goblin, sorceress], { fallen: [fallen] });
const ui0 = initialUi(game);

const selectUi = (r: ClickResult): BoardUi => {
  if (r.kind !== 'select') throw new Error(`expected a selection, got ${r.kind}`);
  return r.ui;
};

describe('starting spells', () => {
  it('Shift Time is cast straight from the menu', () => {
    expect(startSpell(ui0, 'shiftTime')).toEqual({ kind: 'spell', cast: { spell: 'shiftTime' } });
  });

  it('a spell with nothing to target cannot be started', () => {
    const noWounded = initialUi(stateWith([wizard, knight, sorceress]));
    expect(selectUi(startSpell(noWounded, 'heal')).spell).toBeNull();
  });
});

describe('aiming', () => {
  it('Teleport: pick your piece, then a square; the cast plays through applyClick', () => {
    const aiming = selectUi(startSpell(ui0, 'teleport'));
    expect(spellPrompt(aiming)).toMatch(/Choose one of your pieces/);
    expect(spellTargets(aiming)).toContainEqual(knight.pos);
    expect(spellTargets(aiming)).not.toContainEqual(goblin.pos);
    const picked = clickTile(aiming, knight.pos);
    expect(picked.spell?.pieceId).toBe(knight.id);
    expect(spellTargets(picked)).toContainEqual({ col: 8, row: 8 });
    expect(spellTargets(picked)).not.toContainEqual(knight.pos);
    const done = clickTile(picked, { col: 8, row: 0 });
    expect(done.game.pieces.find((p) => p.id === knight.id)!.pos).toEqual({ col: 8, row: 0 });
    expect(done.spell).toBeNull();
    expect(done.game.turn).toBe('dark');
  });

  it('Teleport onto an enemy leaves a battle pending', () => {
    const picked = clickTile(selectUi(startSpell(ui0, 'teleport')), knight.pos);
    expect(clickTile(picked, goblin.pos).pendingBattle).toMatchObject({ attackerId: knight.id, defenderId: goblin.id });
  });

  it('clicking off target keeps aiming; Cancel stops', () => {
    const aiming = selectUi(startSpell(ui0, 'heal'));
    expect(clickTile(aiming, { col: 5, row: 5 })).toEqual(aiming);
    expect(cancelSpell(aiming).spell).toBeNull();
  });

  it('Heal targets only the wounded', () => {
    const aiming = selectUi(startSpell(ui0, 'heal'));
    expect(spellTargets(aiming)).toEqual([golem.pos]);
    expect(clickTile(aiming, golem.pos).game.pieces.find((p) => p.id === golem.id)!.hp).toBe(UNITS.golem.maxHp);
  });

  it('Revive: choose the fallen piece from the list, then a square next to the caster', () => {
    const aiming = selectUi(startSpell(ui0, 'revive'));
    expect(fallenToOffer(aiming).map((p) => p.id)).toEqual([fallen.id]);
    expect(spellTargets(aiming)).toEqual([]);
    const chosen = chooseFallen(aiming, fallen.id);
    expect(spellTargets(chosen)).toContainEqual({ col: 2, row: 1 });
    const done = clickTile(chosen, { col: 2, row: 1 });
    expect(done.game.pieces.find((p) => p.id === fallen.id)!.pos).toEqual({ col: 2, row: 1 });
  });

  it('Exchange takes two clicks and swaps', () => {
    const first = clickTile(selectUi(startSpell(ui0, 'exchange')), knight.pos);
    expect(spellTargets(first)).not.toContainEqual(knight.pos);
    const r = applyClick(first, { kind: 'spell', cast: { spell: 'exchange', firstId: knight.id, secondId: goblin.id } });
    expect(r.game.pieces.find((p) => p.id === knight.id)!.pos).toEqual(goblin.pos);
  });

  it('Summon Elemental: click an empty square off the power points', () => {
    const aiming = selectUi(startSpell(ui0, 'summonElemental'));
    expect(spellTargets(aiming)).not.toContainEqual(goblin.pos);
    expect(spellTargets(aiming)).not.toContainEqual({ col: 4, row: 4 });
    const done = clickTile(aiming, { col: 5, row: 1 });
    expect(done.game.pieces.find((p) => isElemental(p.kind))).toMatchObject({ side: 'light', pos: { col: 5, row: 1 } });
    expect(done.pendingBattle).toBeNull();
  });
});
