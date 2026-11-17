import { describe, expect, it } from 'vitest';
import {
  COLOR_BONUS, autoBattle, colorAffinity, fightTimed, hitDamage, hitInterval, windUp,
} from './autoBattle';
import { CYCLE_MAX } from './board';
import { piece, stateWith } from './testUtils';
import { resolveBattle } from './turn';
import type { Piece } from './types';
import { LIFE_SCALE, UNITS } from './units';

const LIGHT_SQ = { col: 0, row: 0 };
const DARK_SQ = { col: 1, row: 0 };
const SHIFTING_SQ = { col: 4, row: 3 };

const setup = (attacker: Piece, defender: Piece, cycleLevel = 3) => {
  const state = stateWith([attacker, defender], { cycle: { level: cycleLevel, rising: true } });
  return { state, battle: { attackerId: attacker.id, defenderId: defender.id, square: defender.pos } };
};

describe('unit table', () => {
  it('scales life by LIFE_SCALE and gives trolls double regen', () => {
    expect(UNITS.knight.maxHp).toBe(1 * LIFE_SCALE);
    expect(UNITS.dragon.maxHp).toBe(6 * LIFE_SCALE);
    expect(UNITS.troll.regen).toBe(2);
    expect(UNITS.golem.regen).toBe(1);
  });
});

describe('timing', () => {
  it('turns speed and recovery into ticks (6 = fastest)', () => {
    expect(windUp(UNITS.knight)).toBe(1);
    expect(hitInterval(UNITS.knight)).toBe(2);
    expect(windUp(UNITS.golem)).toBe(6);
    expect(hitInterval(UNITS.golem)).toBe(12);
  });

  it('lets a fast fighter win before the slow one ever hits', () => {
    const fast = { hp: 3, damage: 9, speed: 6, recovery: 1 };
    const slow = { hp: 9, damage: 9, speed: 1, recovery: 6 };
    expect(fightTimed(fast, slow)).toEqual({ aHp: 3, dHp: 0, aHits: 1, dHits: 0, time: 1 });
  });

  it('lands hits on the same tick together, so both can fall', () => {
    const f = { hp: 2, damage: 2, speed: 3, recovery: 3 };
    expect(fightTimed(f, f)).toMatchObject({ aHp: 0, dHp: 0, aHits: 1, dHits: 1 });
  });

  it('lets many quick light hits beat one slow heavy hitter', () => {
    const quick = { hp: 6, damage: 1, speed: 6, recovery: 6 };
    const heavy = { hp: 4, damage: 5, speed: 1, recovery: 1 };
    expect(fightTimed(quick, heavy)).toMatchObject({ aHp: 1, dHp: 0, aHits: 4, dHits: 1, time: 7 });
  });
});

describe('colour', () => {
  it('gives full affinity on your own colour and none on the enemy colour', () => {
    const cycle = { level: 0, rising: true };
    expect(colorAffinity('light', LIGHT_SQ, cycle)).toBe(1);
    expect(colorAffinity('dark', LIGHT_SQ, cycle)).toBe(0);
    expect(colorAffinity('dark', SHIFTING_SQ, cycle)).toBe(1);
    expect(colorAffinity('light', SHIFTING_SQ, { level: CYCLE_MAX, rising: false })).toBe(1);
  });

  it('adds up to COLOR_BONUS damage per hit', () => {
    expect(hitDamage(2, 1)).toBe(2 + COLOR_BONUS);
    expect(hitDamage(2, 0)).toBe(2);
  });

  it('decides the mirror matchup by the square colour', () => {
    const onLight = setup(piece('knight', 1, 1), piece('goblin', LIGHT_SQ.col, LIGHT_SQ.row));
    expect(autoBattle(onLight.state, onLight.battle)).toMatchObject({ attackerHp: 1, defenderHp: -1 });
    const onDark = setup(piece('knight', 1, 1), piece('goblin', DARK_SQ.col, DARK_SQ.row));
    expect(autoBattle(onDark.state, onDark.battle)).toMatchObject({ attackerHp: -1, defenderHp: 1 });
  });

  it('uses the colour before the fight, not after the cycle advances', () => {
    const { state, battle } = setup(piece('knight', 3, 3), piece('goblin', SHIFTING_SQ.col, SHIFTING_SQ.row), 0);
    const report = autoBattle(state, battle);
    expect(report.defenderDamage).toBe(UNITS.goblin.damage + COLOR_BONUS);
    expect(resolveBattle(state, battle, report).cycle.level).toBe(1);
  });
});

describe('damage carries over', () => {
  it('starts from current HP', () => {
    const { state, battle } = setup(piece('golem', 1, 1), piece('goblin', DARK_SQ.col, DARK_SQ.row, { hp: 1 }));
    expect(autoBattle(state, battle)).toMatchObject({
      attackerHp: UNITS.golem.maxHp - 6, attackerHits: 1, defenderHits: 3,
    });
  });
});

describe('shapeshifter', () => {
  it('takes the opponent form, then keeps damage within its own max', () => {
    const { state, battle } = setup(piece('knight', 1, 1), piece('shapeshifter', DARK_SQ.col, DARK_SQ.row));
    const report = autoBattle(state, battle);
    expect(report.defenderDamage).toBe(UNITS.knight.damage + COLOR_BONUS);
    expect(report).toMatchObject({ attackerHp: -1, defenderHp: 1 });
  });
});
