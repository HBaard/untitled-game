import { describe, expect, it } from 'vitest';
import { CYCLE_MAX } from './board';
import {
  SPELLS, SPELL_HP_COST, availableSpells, canCast, castSpell, casterMaxHp, reviveSquares, teleportDestinations,
} from './spells';
import { piece, stateWith } from './testUtils';
import { endTurn, resolveBattle } from './turn';
import type { GameState, Piece } from './types';
import { UNITS, isElemental } from './units';

/** Light to move. Wizard at C3, away from power points; dark sorceress far off. */
function setup(extra: Piece[] = [], state: Partial<GameState> = {}) {
  const wizard = piece('wizard', 2, 2);
  const sorceress = piece('sorceress', 6, 6);
  return { wizard, sorceress, state: stateWith([wizard, sorceress, ...extra], state) };
}

const find = (s: GameState, id: string) => s.pieces.find((p) => p.id === id);
const done = (r: ReturnType<typeof castSpell>) => {
  if (r.kind !== 'done') throw new Error('expected the spell to finish');
  return r.state;
};

describe('who can cast what', () => {
  it('offers spells only while the caster is alive and free', () => {
    const { state, wizard } = setup();
    expect(canCast(state, 'light')).toBe(true);
    expect(canCast(stateWith(state.pieces.filter((p) => p.id !== wizard.id)), 'light')).toBe(false);
    const jailed = { ...state, pieces: state.pieces.map((p) => (p.id === wizard.id ? { ...p, imprisoned: true } : p)) };
    expect(availableSpells(jailed, 'light')).toEqual([]);
  });

  it('each spell can be cast once per game, 7 in all', () => {
    expect(SPELLS).toHaveLength(7);
    const { state } = setup();
    const after = done(castSpell(state, { spell: 'shiftTime' }));
    expect(after.spellsUsed.light).toEqual(['shiftTime']);
    const lightAgain = { ...after, turn: 'light' as const };
    expect(availableSpells(lightAgain, 'light')).not.toContain('shiftTime');
    expect(() => castSpell(lightAgain, { spell: 'shiftTime' })).toThrow(/already cast/);
  });

  it('only lists spells that have something to cast on', () => {
    const { state } = setup(); // nobody wounded, nobody fallen
    const spells = availableSpells(state, 'light');
    expect(spells).not.toContain('heal');
    expect(spells).not.toContain('revive');
    expect(spells).toContain('teleport');
  });

  it('casting uses the turn', () => {
    const { state } = setup();
    const after = done(castSpell(state, { spell: 'shiftTime' }));
    expect(after.turn).toBe('dark');
    expect(after.turnNumber).toBe(state.turnNumber + 1);
  });
});

describe('power points are immune to all magic', () => {
  it('pieces on a power point cannot be targeted, friend or foe', () => {
    const knightOnPP = piece('knight', 4, 4, { hp: 1 });
    const goblinOnPP = piece('goblin', 4, 0);
    const { state } = setup([knightOnPP, goblinOnPP]);
    expect(() => castSpell(state, { spell: 'heal', pieceId: knightOnPP.id })).toThrow();
    expect(() => castSpell(state, { spell: 'imprison', targetId: goblinOnPP.id })).toThrow();
    expect(() => castSpell(state, { spell: 'summonElemental', to: { col: 4, row: 8 } })).toThrow();
    expect(() => castSpell(state, { spell: 'teleport', pieceId: knightOnPP.id, to: { col: 1, row: 1 } })).toThrow();
  });
});

describe('Teleport', () => {
  it('moves one of your pieces to any empty square', () => {
    const k = piece('knight', 1, 1);
    const { state } = setup([k]);
    const after = done(castSpell(state, { spell: 'teleport', pieceId: k.id, to: { col: 7, row: 1 } }));
    expect(find(after, k.id)!.pos).toEqual({ col: 7, row: 1 });
  });

  it('onto an enemy (off a power point) starts a fight at once', () => {
    const k = piece('knight', 1, 1);
    const g = piece('goblin', 7, 2);
    const { state } = setup([k, g]);
    const r = castSpell(state, { spell: 'teleport', pieceId: k.id, to: g.pos });
    expect(r).toMatchObject({ kind: 'battle', battle: { attackerId: k.id, defenderId: g.id, square: g.pos } });
    expect(teleportDestinations(state, k).some((p) => p.col === 4 && p.row === 0)).toBe(true); // empty power point is fine
  });
});

describe('Heal', () => {
  it('restores a wounded friendly piece to full health', () => {
    const k = piece('golem', 1, 1, { hp: 2 });
    const { state } = setup([k]);
    expect(find(done(castSpell(state, { spell: 'heal', pieceId: k.id })), k.id)!.hp).toBe(UNITS.golem.maxHp);
  });

  it('will not heal an enemy or an unhurt piece', () => {
    const g = piece('goblin', 7, 2, { hp: 1 });
    const k = piece('knight', 1, 1);
    const { state } = setup([g, k]);
    expect(() => castSpell(state, { spell: 'heal', pieceId: g.id })).toThrow();
    expect(() => castSpell(state, { spell: 'heal', pieceId: k.id })).toThrow();
  });
});

describe('Shift Time', () => {
  it('reverses the cycle (and at a peak jumps to the other extreme) before the turn advances it', () => {
    const { state } = setup([], { cycle: { level: 3, rising: true } });
    expect(done(castSpell(state, { spell: 'shiftTime' })).cycle).toEqual({ level: 2, rising: false });
    const peak = setup([], { cycle: { level: CYCLE_MAX, rising: false } }).state;
    expect(done(castSpell(peak, { spell: 'shiftTime' })).cycle).toEqual({ level: 1, rising: true });
  });
});

describe('Exchange', () => {
  it('swaps any two pieces, friend or enemy', () => {
    const k = piece('knight', 1, 1);
    const g = piece('goblin', 7, 2);
    const { state } = setup([k, g]);
    const after = done(castSpell(state, { spell: 'exchange', firstId: k.id, secondId: g.id }));
    expect(find(after, k.id)!.pos).toEqual(g.pos);
    expect(find(after, g.id)!.pos).toEqual(k.pos);
  });

  it('not with an imprisoned piece or one on a power point', () => {
    const k = piece('knight', 1, 1);
    const jailed = piece('goblin', 7, 2, { imprisoned: true });
    const onPP = piece('goblin', 4, 8);
    const { state } = setup([k, jailed, onPP]);
    expect(() => castSpell(state, { spell: 'exchange', firstId: k.id, secondId: jailed.id })).toThrow();
    expect(() => castSpell(state, { spell: 'exchange', firstId: k.id, secondId: onPP.id })).toThrow();
    expect(() => castSpell(state, { spell: 'exchange', firstId: k.id, secondId: k.id })).toThrow();
  });
});

describe('Summon Elemental', () => {
  const g = piece('troll', 7, 2);
  const { state } = setup([g]);
  const to = { col: 5, row: 2 };
  const after = done(castSpell(state, { spell: 'summonElemental', to }));
  const elemental = after.pieces.find((p) => isElemental(p.kind))!;

  it('puts a random elemental of the caster\'s side on an empty square, and uses the turn', () => {
    expect(elemental).toMatchObject({ side: 'light', pos: to, hp: UNITS[elemental.kind].maxHp });
    expect(after.turn).toBe('dark');
  });

  it('is the same elemental every time for the same game moment (network play stays in sync)', () => {
    const again = done(castSpell(state, { spell: 'summonElemental', to }));
    expect(again.pieces.find((p) => isElemental(p.kind))!.kind).toBe(elemental.kind);
  });

  it('not onto a piece or a power point', () => {
    expect(() => castSpell(state, { spell: 'summonElemental', to: g.pos })).toThrow();
    expect(() => castSpell(state, { spell: 'summonElemental', to: { col: 4, row: 4 } })).toThrow();
  });

  it('flies up to 4 squares like a piece', () => {
    expect(UNITS[elemental.kind]).toMatchObject({ move: 'fly', range: 4 });
  });

  const lightAgain = { ...after, turn: 'light' as const };
  const attack = { attackerId: elemental.id, defenderId: g.id, square: g.pos };

  it('vanishes after winning its fight, leaving the square empty', () => {
    const won = resolveBattle(lightAgain, attack, { attackerHp: 5, defenderHp: 0 });
    expect(find(won, elemental.id)).toBeUndefined();
    expect(find(won, g.id)).toBeUndefined();
    expect(won.pieces.some((p) => p.pos.col === g.pos.col && p.pos.row === g.pos.row)).toBe(false);
    expect(won.fallen.map((p) => p.id)).toEqual([g.id]);
  });

  it('vanishes after losing too, and is never counted as fallen', () => {
    const lost = resolveBattle(lightAgain, attack, { attackerHp: 0, defenderHp: 4 });
    expect(find(lost, elemental.id)).toBeUndefined();
    expect(find(lost, g.id)).toMatchObject({ hp: 4, pos: g.pos });
    expect(lost.fallen).toEqual([]);
  });

  it('also vanishes when it is attacked and wins, leaving its square empty', () => {
    const defended = resolveBattle(after, { attackerId: g.id, defenderId: elemental.id, square: to }, { attackerHp: 0, defenderHp: 3 });
    expect(find(defended, elemental.id)).toBeUndefined();
    expect(defended.fallen.map((p) => p.id)).toEqual([g.id]);
  });
});

describe('Revive', () => {
  const dead = { ...piece('golem', 0, 0), hp: 0 };
  const deadEnemy = { ...piece('troll', 0, 0), hp: 0 };

  it('brings back a fallen piece at full health next to the caster', () => {
    const { state } = setup([], { fallen: [dead, deadEnemy] });
    const to = reviveSquares(state, 'light')[0]!;
    const after = done(castSpell(state, { spell: 'revive', fallenId: dead.id, to }));
    expect(find(after, dead.id)).toMatchObject({ hp: UNITS.golem.maxHp, pos: to });
    expect(after.fallen.map((p) => p.id)).toEqual([deadEnemy.id]);
  });

  it('only onto an empty square adjacent to the caster, and not enemy pieces', () => {
    const { state } = setup([], { fallen: [dead, deadEnemy] });
    expect(reviveSquares(state, 'light')).toHaveLength(8);
    expect(() => castSpell(state, { spell: 'revive', fallenId: dead.id, to: { col: 5, row: 5 } })).toThrow();
    expect(() => castSpell(state, { spell: 'revive', fallenId: deadEnemy.id, to: { col: 1, row: 1 } })).toThrow();
  });
});

describe('Imprison', () => {
  it('locks an enemy in place until the cycle reaches the colour opposite its side', () => {
    const g = piece('goblin', 7, 2);
    const { state } = setup([g], { cycle: { level: 2, rising: true } });
    let s = done(castSpell(state, { spell: 'imprison', targetId: g.id }));
    expect(find(s, g.id)!.imprisoned).toBe(true);
    for (let i = 0; i < 20 && s.cycle.level !== CYCLE_MAX; i++) {
      expect(find(s, g.id)!.imprisoned).toBe(true);
      s = endTurn(s);
    }
    expect(s.cycle.level).toBe(CYCLE_MAX);
    expect(find(s, g.id)!.imprisoned).toBe(false);
  });

  it('an imprisoned enemy caster cannot cast', () => {
    const { state, sorceress } = setup();
    const s = done(castSpell(state, { spell: 'imprison', targetId: sorceress.id }));
    expect(canCast(s, 'dark')).toBe(false);
    expect(availableSpells(s, 'dark')).toEqual([]);
  });
});

describe('the hidden cost', () => {
  it('every spell cast lowers the caster\'s maximum HP in later fights', () => {
    const { state, wizard } = setup();
    expect(casterMaxHp(state, wizard)).toBe(UNITS.wizard.maxHp);
    const two = { ...state, spellsUsed: { light: ['heal', 'shiftTime'] as const, dark: [] } } as unknown as GameState;
    expect(casterMaxHp(two, wizard)).toBe(UNITS.wizard.maxHp - 2 * SPELL_HP_COST);
    expect(casterMaxHp(two, piece('knight', 1, 1))).toBe(UNITS.knight.maxHp);
  });
});
