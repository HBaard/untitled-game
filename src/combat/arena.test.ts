import { describe, expect, it } from 'vitest';
import { piece, stateWith } from '../core/testUtils';
import type { Piece } from '../core/types';
import { UNITS } from '../core/units';
import type { ArenaState } from './arena';
import {
  ARENA_H, ARENA_W, COUNTDOWN_TICKS, FIGHTER_SIZE, GO_TICKS, TICK_HZ, countdownLabel, MOVE_SPEED, OUTRO_TICKS, SWING_TICKS, arenaOutcome, createArena, isFinished,
  stepArena,
} from './arena';
import { BOULDER_HP } from './boulders';
import type { ArenaInput, ArenaInputs } from './controls';
import { NO_INPUT } from './controls';
import { DIRECTION_COUNT, TURN_STEP } from './steering';

const IDLE: ArenaInputs = { light: NO_INPUT, dark: NO_INPUT };
const lightDoes = (i: Partial<ArenaInput>): ArenaInputs => ({ light: { ...NO_INPUT, ...i }, dark: NO_INPUT });

function arenaFor(attacker: Piece, defender: Piece): ArenaState {
  const state = stateWith([attacker, defender]);
  return skipCountdown(createArena(state, { attackerId: attacker.id, defenderId: defender.id, square: defender.pos }));
}

/** Most tests are about the fight itself, so they start right after "GO". */
const skipCountdown = (a: ArenaState): ArenaState => ({ ...a, tick: COUNTDOWN_TICKS });

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

  it('a shapeshifter fights in its opponent form; it copies the attack too', () => {

    const b = arenaFor(piece('knight', 0, 0), piece('shapeshifter', 1, 0));
    expect(b.fighters.dark.form).toBe('knight');
    expect(b.fighters.dark.hp).toBe(UNITS.knight.maxHp);
    expect(b.fighters.dark.attack.kind).toBe('melee');
  });

  it('builds the same battlefield for the same game moment', () => {
    const k = piece('knight', 0, 0);
    const g = piece('goblin', 1, 0);
    expect(arenaFor(k, g).boulders).toEqual(arenaFor(k, g).boulders);
  });
});

describe('spell cost', () => {
  it('a caster fights with its maximum HP lowered by each spell it has cast', () => {
    const wizard = piece('wizard', 1, 0);
    const goblin = piece('goblin', 2, 0);
    const state = stateWith([wizard, goblin], { spellsUsed: { light: ['heal', 'imprison', 'shiftTime'], dark: [] } });
    const a = createArena(state, { attackerId: wizard.id, defenderId: goblin.id, square: goblin.pos });
    expect(a.fighters.light.maxHp).toBe(UNITS.wizard.maxHp - 3);
    expect(a.fighters.light.hp).toBe(UNITS.wizard.maxHp - 3);
    expect(a.fighters.dark.maxHp).toBe(UNITS.goblin.maxHp);
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

});

/** Melee duel with dark placed `gap` pixels from light's body edge, straight ahead. */
function meleeDuel(gap: number): ArenaState {
  const d = duel('knight', 'goblin');
  return { ...d, fighters: { ...d.fighters, dark: { ...d.fighters.dark, pos: { x: 300 + FIGHTER_SIZE + gap, y: 300 } } } };
}

describe('melee (knight, goblin)', () => {
  it('knights and goblins swing instead of shooting', () => {
    const s0 = meleeDuel(0);
    expect(s0.fighters.light.attack.kind).toBe('melee');
    expect(s0.fighters.dark.attack.kind).toBe('melee');
    const s1 = stepArena(s0, lightDoes({ fire: true }));
    expect(s1.shots).toEqual([]);
    expect(s1.fighters.light.anim).toBe(SWING_TICKS);
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
    expect(s.fighters.light.anim).toBe(0);
  });

  it('a shapeshifter facing a knight swings too; other units still shoot', () => {
    expect(arenaFor(piece('knight', 0, 0), piece('shapeshifter', 1, 0)).fighters.dark.attack.kind).toBe('melee');
    expect(duel('golem', 'troll').fighters.light.attack.kind).toBe('shot');
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

describe('tank steering (3D view)', () => {
  const tank = (s: ArenaState): ArenaState => ({ ...s, steering: 'tank' });

  it('up walks forwards along the facing, down backs up without turning', () => {
    const fwd = stepArena(tank(duel('archer', 'goblin')), lightDoes({ up: true }));
    expect(fwd.fighters.light.pos).toEqual({ x: 300 + MOVE_SPEED, y: 300 });
    const back = stepArena(tank(duel('archer', 'goblin')), lightDoes({ down: true }));
    expect(back.fighters.light.pos).toEqual({ x: 300 - MOVE_SPEED, y: 300 });
    expect(back.fighters.light.facing).toEqual({ x: 1, y: 0 });
  });

  it('left/right turn in place; a quarter turn later it walks down the screen', () => {
    const q = DIRECTION_COUNT / 4 / TURN_STEP;
    const turned = run(tank(duel('archer', 'goblin')), lightDoes({ right: true }), q);
    expect(turned.fighters.light.pos).toEqual({ x: 300, y: 300 });
    expect(turned.fighters.light.facing).toEqual({ x: 0, y: 1 });
    const walked = stepArena(turned, lightDoes({ up: true }));
    expect(walked.fighters.light.pos).toEqual({ x: 300, y: 300 + MOVE_SPEED });
  });

  it('shots fly along an in-between angle', () => {
    const s = stepArena(tank(duel('archer', 'goblin')), lightDoes({ right: true, fire: true }));
    const shot = s.shots[0]!;
    expect(shot.vel.y).toBeGreaterThan(0);
    expect(shot.vel.x).toBeGreaterThan(shot.vel.y);
  });

  it('keeps the old compass movement unless asked', () => {
    const s = stepArena(duel('archer', 'goblin'), lightDoes({ down: true }));
    expect(s.steering).toBe('compass');
    expect(s.fighters.light.pos).toEqual({ x: 300, y: 300 + MOVE_SPEED });
  });
});

describe('fps steering (online 3D: mouse aims, keys walk and strafe)', () => {
  const fps = (s: ArenaState): ArenaState => ({ ...s, steering: 'fps' });
  const Q = DIRECTION_COUNT / 4;

  it('the mouse turn sets the facing; A/D strafe instead of turning', () => {
    const turned = stepArena(fps(duel('archer', 'goblin')), lightDoes({ turn: Q }));
    expect(turned.fighters.light.facing).toEqual({ x: 0, y: 1 });
    expect(turned.fighters.light.pos).toEqual({ x: 300, y: 300 });
    const strafed = stepArena(fps(duel('archer', 'goblin')), lightDoes({ right: true }));
    expect(strafed.fighters.light.facing).toEqual({ x: 1, y: 0 });
    expect(strafed.fighters.light.pos).toEqual({ x: 300, y: 300 + MOVE_SPEED });
  });

  it('walking while strafing is no faster than either', () => {
    const s = stepArena(fps(duel('archer', 'goblin')), lightDoes({ up: true, left: true }));
    const { x, y } = s.fighters.light.pos;
    expect(x - 300).toBeCloseTo(MOVE_SPEED * Math.SQRT1_2, 12);
    expect(y - 300).toBeCloseTo(-MOVE_SPEED * Math.SQRT1_2, 12);
  });

  it('turns either way, wrapping, and ignores a non-integer turn from the wire', () => {
    const left = stepArena(fps(duel('archer', 'goblin')), lightDoes({ turn: -Q }));
    expect(left.fighters.light.facing).toEqual({ x: 0, y: -1 });
    const junk = stepArena(fps(duel('archer', 'goblin')), lightDoes({ turn: 0.5 }));
    expect(junk.fighters.light.angle).toBe(0);
  });
});

describe('countdown', () => {
  const fresh = (): ArenaState => {
    const l = piece('archer', 0, 0);
    const d = piece('manticore', 1, 0);
    return createArena(stateWith([l, d]), { attackerId: l.id, defenderId: d.id, square: d.pos });
  };

  it('nobody moves or fires until the countdown is over', () => {
    const go = { light: { ...NO_INPUT, right: true, fire: true }, dark: { ...NO_INPUT, left: true, fire: true } };
    const waited = run(fresh(), go, COUNTDOWN_TICKS);
    expect(waited.fighters).toEqual(fresh().fighters);
    expect(waited.shots).toEqual([]);
    const started = stepArena(waited, go);
    expect(started.fighters.light.pos.x).toBe(fresh().fighters.light.pos.x + MOVE_SPEED);
    expect(started.shots).toHaveLength(2);
  });

  it('counts 3, 2, 1, then shows GO! briefly', () => {
    expect(countdownLabel(0)).toBe('3');
    expect(countdownLabel(TICK_HZ - 1)).toBe('3');
    expect(countdownLabel(TICK_HZ)).toBe('2');
    expect(countdownLabel(2 * TICK_HZ)).toBe('1');
    expect(countdownLabel(COUNTDOWN_TICKS)).toBe('GO!');
    expect(countdownLabel(COUNTDOWN_TICKS + GO_TICKS)).toBeNull();
  });
});
