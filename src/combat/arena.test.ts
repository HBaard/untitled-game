import { describe, expect, it } from 'vitest';
import { piece, stateWith } from '../core/testUtils';
import type { Piece } from '../core/types';
import { UNITS } from '../core/units';
import type { ArenaState } from './arena';
import {
  ARENA_H, ARENA_W, FIGHTER_SIZE, MOVE_SPEED, OUTRO_TICKS, SWING_TICKS, arenaOutcome, createArena, isFinished,
  stepArena,
} from './arena';
import { BOULDER_HP } from './boulders';
import type { ArenaInput, ArenaInputs } from './controls';
import { NO_INPUT } from './controls';

const IDLE: ArenaInputs = { light: NO_INPUT, dark: NO_INPUT };
const lightDoes = (i: Partial<ArenaInput>): ArenaInputs => ({ light: { ...NO_INPUT, ...i }, dark: NO_INPUT });

function arenaFor(attacker: Piece, defender: Piece): ArenaState {
  const state = stateWith([attacker, defender]);
  return createArena(state, { attackerId: attacker.id, defenderId: defender.id, square: defender.pos });
}

/** Light at the centre-left, dark straight to its right, nothing in between. */
function duel(lightKind: Piece['kind'], darkKind: Piece['kind']): ArenaState {
  const a = arenaFor(piece(lightKind, 0, 0), piece(darkKind, 1, 0));
  return {
    ...a,
    boulders: [],
    fighters: {
      light: { ...a.fighters.light, pos: { x: 300, y: 300 } },
      dark: { ...a.fighters.dark, pos: { x: 500, y: 300 } },
    },
  };
}

const run = (s: ArenaState, inputs: ArenaInputs, ticks: number): ArenaState =>
  Array.from({ length: ticks }).reduce<ArenaState>((acc) => stepArena(acc, inputs), s);

describe('createArena', () => {
  it('puts light on the left and dark on the right whoever attacks', () => {
    const a = arenaFor(piece('goblin', 1, 0), piece('knight', 0, 0));
    expect(a.attackerSide).toBe('dark');
    expect(a.fighters.light.pos.x).toBeLessThan(ARENA_W / 2);
    expect(a.fighters.dark.pos.x).toBeGreaterThan(ARENA_W / 2);
    expect(a.fighters.light.facing.x).toBe(1);
    expect(a.fighters.dark.facing.x).toBe(-1);
  });

  it('carries board HP into the fight and adds the colour bonus', () => {
    const a = arenaFor(piece('golem', 1, 0, { hp: 4 }), piece('troll', 2, 0));
    expect(a.fighters.light.hp).toBe(4);
    expect(a.fighters.light.damage).toBe(UNITS.golem.damage + 1); // battle on C1, a light square
    expect(a.fighters.dark.damage).toBe(UNITS.troll.damage);
  });

  it('a shapeshifter fights in its opponent form; only a dragon melts boulders', () => {
    expect(arenaFor(piece('dragon', 1, 0), piece('knight', 2, 0)).fighters.dark.meltsBoulders).toBe(true);
    const b = arenaFor(piece('knight', 0, 0), piece('shapeshifter', 1, 0));
    expect(b.fighters.dark.form).toBe('knight');
    expect(b.fighters.dark.hp).toBe(UNITS.knight.maxHp);
    expect(b.fighters.dark.meltsBoulders).toBe(false);
  });

  it('builds the same battlefield for the same game moment', () => {
    const k = piece('knight', 0, 0);
    const g = piece('goblin', 1, 0);
    expect(arenaFor(k, g).boulders).toEqual(arenaFor(k, g).boulders);
  });
});

describe('movement', () => {
  it('moves at MOVE_SPEED and turns to face the direction moved', () => {
    const s = stepArena(duel('knight', 'goblin'), lightDoes({ up: true }));
    expect(s.fighters.light.pos).toEqual({ x: 300, y: 300 - MOVE_SPEED });
    expect(s.fighters.light.facing).toEqual({ x: 0, y: -1 });
  });

  it('heading follows horizontal movement and survives vertical moves', () => {
    const s0 = duel('knight', 'goblin');
    expect([s0.fighters.light.heading, s0.fighters.dark.heading]).toEqual([1, -1]);
    const back = stepArena(s0, lightDoes({ left: true }));
    expect(back.fighters.light.heading).toBe(-1);
    expect(stepArena(back, lightDoes({ up: true })).fighters.light.heading).toBe(-1);
    expect(stepArena(back, lightDoes({ right: true, down: true })).fighters.light.heading).toBe(1);
  });

  it('cannot leave the arena', () => {
    const s = run(duel('knight', 'goblin'), lightDoes({ up: true, left: true }), 400);
    expect(s.fighters.light.pos.x).toBeGreaterThan(0);
    expect(s.fighters.light.pos.y).toBeGreaterThan(0);
    const down = run(duel('knight', 'goblin'), lightDoes({ down: true }), 400);
    expect(down.fighters.light.pos.y).toBeLessThan(ARENA_H);
  });

  it('is stopped by a boulder and by the other fighter', () => {
    const base = duel('knight', 'goblin');
    const walled = { ...base, boulders: [{ id: 0, x: 340, y: 250, w: 50, h: 100, hp: BOULDER_HP }] };
    expect(run(walled, lightDoes({ right: true }), 60).fighters.light.pos.x).toBeLessThanOrEqual(340 - 22);
    expect(run(base, lightDoes({ right: true }), 200).fighters.light.pos.x).toBeLessThanOrEqual(500 - 44);
  });
});

describe('shooting', () => {
  it('fires in the facing direction, then waits for the reload', () => {
    const s0 = duel('golem', 'troll');
    const s1 = stepArena(s0, lightDoes({ fire: true }));
    expect(s1.shots).toHaveLength(1);
    expect(s1.shots[0]!.vel.x).toBeGreaterThan(0);
    expect(s1.fighters.light.cooldown).toBe(s0.fighters.light.reload);
    expect(stepArena(s1, lightDoes({ fire: true })).shots).toHaveLength(1);
  });

  it('a hit takes the shot damage off the target', () => {
    const s0 = duel('golem', 'troll');
    const s = run(stepArena(s0, lightDoes({ fire: true })), IDLE, 40);
    expect(s.shots).toHaveLength(0);
    expect(s.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
  });

  it('boulders stop shots; only dragon fire wears them down', () => {
    const rock = { id: 0, x: 380, y: 270, w: 50, h: 60, hp: BOULDER_HP };
    const golem = { ...duel('golem', 'troll'), boulders: [rock] };
    const g = run(stepArena(golem, lightDoes({ fire: true })), IDLE, 40);
    expect(g.boulders).toEqual([rock]);
    expect(g.fighters.dark.hp).toBe(golem.fighters.dark.hp);

    const dragonDuel = duel('knight', 'dragon');
    const dragon = {
      ...dragonDuel,
      boulders: [rock],
      fighters: { ...dragonDuel.fighters, dark: { ...dragonDuel.fighters.dark, reload: 1 } },
    };
    const breathe: ArenaInputs = { light: NO_INPUT, dark: { ...NO_INPUT, fire: true } };
    const melted = run(dragon, breathe, 30);
    expect(melted.boulders).toEqual([]);
  });
});

/** Melee duel with dark placed `gap` pixels from light's body edge, straight ahead. */
function meleeDuel(gap: number): ArenaState {
  const d = duel('knight', 'goblin');
  return { ...d, fighters: { ...d.fighters, dark: { ...d.fighters.dark, pos: { x: 300 + FIGHTER_SIZE + gap, y: 300 } } } };
}

describe('melee (knight, goblin)', () => {
  it('knights and goblins swing instead of shooting', () => {
    const s0 = meleeDuel(0);
    expect(s0.fighters.light.attack).toBe('melee');
    expect(s0.fighters.dark.attack).toBe('melee');
    const s1 = stepArena(s0, lightDoes({ fire: true }));
    expect(s1.shots).toEqual([]);
    expect(s1.fighters.light.swing).toBe(SWING_TICKS);
    expect(s1.fighters.light.cooldown).toBe(s0.fighters.light.reload);
  });

  it('hits an opponent standing right in front', () => {
    const s0 = meleeDuel(0);
    const s1 = stepArena(s0, lightDoes({ fire: true }));
    expect(s1.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
  });

  it('misses one square away, behind, or off to the side', () => {
    const far = meleeDuel(FIGHTER_SIZE);
    expect(stepArena(far, lightDoes({ fire: true })).fighters.dark.hp).toBe(far.fighters.dark.hp);
    const near = meleeDuel(0);
    const facingAway = { ...near, fighters: { ...near.fighters, light: { ...near.fighters.light, facing: { x: -1, y: 0 } } } };
    expect(stepArena(facingAway, lightDoes({ fire: true })).fighters.dark.hp).toBe(near.fighters.dark.hp);
    const above = { ...near, fighters: { ...near.fighters, dark: { ...near.fighters.dark, pos: { x: 300, y: 300 - FIGHTER_SIZE * 2 } } } };
    expect(stepArena(above, lightDoes({ fire: true })).fighters.dark.hp).toBe(near.fighters.dark.hp);
  });

  it('both can land a blow on the same tick', () => {
    const s0 = meleeDuel(0);
    const s1 = stepArena(s0, { light: { ...NO_INPUT, fire: true }, dark: { ...NO_INPUT, fire: true } });
    expect(s1.fighters.light.hp).toBe(s0.fighters.light.hp - s0.fighters.dark.damage);
    expect(s1.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
  });

  it('the swing fades out over SWING_TICKS', () => {
    const s = run(stepArena(meleeDuel(FIGHTER_SIZE), lightDoes({ fire: true })), IDLE, SWING_TICKS);
    expect(s.fighters.light.swing).toBe(0);
  });

  it('a shapeshifter facing a knight swings too; other units still shoot', () => {
    expect(arenaFor(piece('knight', 0, 0), piece('shapeshifter', 1, 0)).fighters.dark.attack).toBe('melee');
    expect(duel('golem', 'troll').fighters.light.attack).toBe('shot');
  });
});

describe('ending', () => {
  it('ends when a fighter falls, holds for the outro, then reports board HP', () => {
    const s0 = duel('golem', 'goblin');
    const killed = run(stepArena(s0, lightDoes({ fire: true })), IDLE, 40);
    expect(killed.endedAt).not.toBeNull();
    expect(arenaOutcome(killed)).toEqual({ attackerHp: s0.fighters.light.hp, defenderHp: expect.any(Number) });
    expect(arenaOutcome(killed)!.defenderHp).toBeLessThanOrEqual(0);
    expect(isFinished(killed)).toBe(false);
    const frozen = run(killed, lightDoes({ right: true }), OUTRO_TICKS);
    expect(isFinished(frozen)).toBe(true);
    expect(frozen.fighters).toEqual(killed.fighters);
  });

  it('has no outcome while the fight is on', () => {
    expect(arenaOutcome(duel('knight', 'goblin'))).toBeNull();
  });

  it('a surviving shapeshifter keeps at most its own max HP', () => {
    const a = arenaFor(piece('golem', 1, 0), piece('shapeshifter', 2, 0));
    expect(a.fighters.dark.hp).toBe(UNITS.golem.maxHp);
    const ended = { ...a, endedAt: 5, fighters: { ...a.fighters, light: { ...a.fighters.light, hp: 0 } } };
    expect(arenaOutcome(ended)!.defenderHp).toBe(UNITS.shapeshifter.maxHp);
  });
});
