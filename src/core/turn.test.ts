import { describe, expect, it } from 'vitest';
import { POWER_POINTS } from './board';
import { piece, stateWith } from './testUtils';
import { HEAL_INTERVAL, applyMove, checkWinner, endTurn, resolveBattle } from './turn';
import { UNITS } from './units';

describe('applyMove', () => {
  it('moves to an empty square and passes the turn', () => {
    const k = piece('knight', 1, 1);
    const g = piece('goblin', 7, 7);
    const result = applyMove(stateWith([k, g]), k.id, { col: 2, row: 1 });
    expect(result.kind).toBe('moved');
    expect(result.state.pieces.find((p) => p.id === k.id)!.pos).toEqual({ col: 2, row: 1 });
    expect(result.state.turn).toBe('dark');
    expect(result.state.turnNumber).toBe(2);
  });

  it('starts a battle when entering an enemy square, without changing state', () => {
    const k = piece('knight', 1, 1);
    const g = piece('goblin', 2, 1);
    const state = stateWith([k, g]);
    const result = applyMove(state, k.id, g.pos);
    expect(result).toEqual({
      kind: 'battle', state, battle: { attackerId: k.id, defenderId: g.id, square: g.pos },
    });
  });

  it('rejects moving the wrong side or illegal squares', () => {
    const k = piece('knight', 1, 1);
    const g = piece('goblin', 7, 7);
    const state = stateWith([k, g]);
    expect(() => applyMove(state, g.id, { col: 7, row: 6 })).toThrow(/turn/);
    expect(() => applyMove(state, k.id, { col: 8, row: 8 })).toThrow(/Illegal/);
  });
});

describe('resolveBattle', () => {
  const k = piece('knight', 1, 1);
  const g = piece('goblin', 2, 1);
  const extra = piece('troll', 8, 8);
  const extraLight = piece('golem', 0, 8);
  const state = stateWith([k, g, extra, extraLight]);
  const battle = { attackerId: k.id, defenderId: g.id, square: g.pos };

  it('winning attacker takes the square and keeps its damage', () => {
    const next = resolveBattle(state, battle, { attackerHp: 2, defenderHp: 0 });
    const knight = next.pieces.find((p) => p.id === k.id)!;
    expect(knight.pos).toEqual(g.pos);
    expect(knight.hp).toBe(2);
    expect(next.fallen.map((p) => p.id)).toEqual([g.id]);
    expect(next.turn).toBe('dark');
  });

  it('winning defender stays put and the attacker falls', () => {
    const next = resolveBattle(state, battle, { attackerHp: 0, defenderHp: 3 });
    expect(next.pieces.find((p) => p.id === g.id)!.hp).toBe(3);
    expect(next.pieces.find((p) => p.id === k.id)).toBeUndefined();
  });

  it('both can die', () => {
    const next = resolveBattle(state, battle, { attackerHp: 0, defenderHp: -1 });
    expect(next.pieces).toHaveLength(2);
    expect(next.fallen).toHaveLength(2);
  });
});

describe('imprisonment', () => {
  it('releases a light piece when its tile becomes fully light', () => {
    const k = piece('knight', 4, 3, { imprisoned: true });
    const g = piece('goblin', 8, 8);
    const almostLight = stateWith([k, g], { cycle: { level: 4, rising: true } });
    expect(endTurn(almostLight).pieces.find((p) => p.id === k.id)!.imprisoned).toBe(false);
    const darkening = stateWith([k, g], { cycle: { level: 4, rising: false } });
    expect(endTurn(darkening).pieces.find((p) => p.id === k.id)!.imprisoned).toBe(true);
  });

  it('never releases on a fixed square of the enemy colour', () => {
    const g = piece('goblin', 0, 4, { imprisoned: true });
    let s = stateWith([g, piece('knight', 8, 8)]);
    for (let i = 0; i < 20; i++) s = endTurn(s);
    expect(s.pieces.find((p) => p.id === g.id)!.imprisoned).toBe(true);
  });
});

describe('healing', () => {
  const hpAfter = (col: number, row: number, turns: number): number => {
    const k = piece('knight', col, row, { hp: 1 });
    let s = stateWith([k, piece('goblin', 8, 8)]);
    for (let i = 0; i < turns; i++) s = endTurn(s);
    return s.pieces.find((p) => p.id === k.id)!.hp;
  };

  it('heals slowly off power points', () => {
    expect(hpAfter(0, 0, HEAL_INTERVAL)).toBe(2);
  });

  it('heals every turn on a power point, capped at max HP', () => {
    expect(hpAfter(4, 4, 2)).toBe(3);
    expect(hpAfter(4, 4, 20)).toBe(UNITS.knight.maxHp);
  });
});

describe('checkWinner', () => {
  it('a side with no pieces loses', () => {
    expect(checkWinner([piece('knight', 0, 0)])).toBe('light');
    expect(checkWinner([piece('goblin', 0, 0)])).toBe('dark');
    expect(checkWinner([])).toBe('draw');
  });

  it('holding all five power points wins', () => {
    const holders = POWER_POINTS.map((pp) => piece('goblin', pp.col, pp.row));
    expect(checkWinner([...holders, piece('knight', 0, 0)])).toBe('dark');
    expect(checkWinner([...holders.slice(1), piece('knight', 0, 0)])).toBeNull();
  });
});

describe('troll regeneration', () => {
  it('heals twice as fast as other pieces', () => {
    const t = piece('troll', 7, 0, { hp: 1 });
    let s = stateWith([t, piece('knight', 0, 8)]);
    for (let i = 0; i < HEAL_INTERVAL; i++) s = endTurn(s);
    expect(s.pieces.find((p) => p.id === t.id)!.hp).toBe(1 + 2);
  });
});
