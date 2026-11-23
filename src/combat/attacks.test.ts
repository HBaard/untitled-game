import { describe, expect, it } from 'vitest';
import { piece, stateWith } from '../core/testUtils';
import type { PieceKind } from '../core/types';
import type { ArenaState, Vec } from './arena';
import { ARENA_H, ARENA_W, FIGHTER_SIZE, createArena, stepArena } from './arena';
import type { ShotAttack } from './attacks';
import { ATTACKS, BURST_RADIUS, FLAME_NARROW, FLAME_RANGE, PHOENIX_IMMUNITY } from './attacks';
import type { Boulder } from './boulders';
import { BOULDER_HP } from './boulders';
import type { ArenaInput, ArenaInputs } from './controls';
import { NO_INPUT } from './controls';
import { BURN_DAMAGE, BURN_INTERVAL, FIRE_TICKS, flameRadius } from './shots';

const IDLE: ArenaInputs = { light: NO_INPUT, dark: NO_INPUT };
const FIRE: ArenaInput = { ...NO_INPUT, fire: true };
const lightFires: ArenaInputs = { light: FIRE, dark: NO_INPUT };
const darkFires: ArenaInputs = { light: NO_INPUT, dark: FIRE };

/** A fight between two kinds at chosen spots (light faces right, dark faces left), no random boulders. */
function duel(light: PieceKind, dark: PieceKind, lightAt: Vec, darkAt: Vec, boulders: Boulder[] = []): ArenaState {
  const l = piece(light, 1, 0); // battle square (2,0) is a light square
  const d = piece(dark, 2, 0);
  const a = createArena(stateWith([l, d]), { attackerId: l.id, defenderId: d.id, square: d.pos });
  return {
    ...a,
    boulders,
    fighters: { light: { ...a.fighters.light, pos: lightAt }, dark: { ...a.fighters.dark, pos: darkAt } },
  };
}

const run = (s: ArenaState, inputs: ArenaInputs, ticks: number): ArenaState =>
  Array.from({ length: ticks }).reduce<ArenaState>((acc) => stepArena(acc, inputs), s);

/** Fire once, then idle until the shot is gone (or `limit` ticks pass). */
function volley(s: ArenaState, inputs: ArenaInputs, limit = 400): ArenaState {
  let cur = stepArena(s, inputs);
  for (let i = 0; i < limit && cur.shots.length > 0; i++) cur = stepArena(cur, IDLE);
  return cur;
}

const boulder = (x: number, y: number, size = 50): Boulder => ({ id: 0, x, y, w: size, h: size, hp: BOULDER_HP });
const mid = ARENA_H / 2;
const speedOf = (k: PieceKind): number => (ATTACKS[k] as ShotAttack).speed;

describe('projectile speeds follow the unit descriptions', () => {
  it('boulder < fireball < lightning < arrow < manticore spike < unicorn bolt < basilisk', () => {
    const order: PieceKind[] = ['golem', 'wizard', 'sorceress', 'archer', 'manticore', 'unicorn', 'serpent'];
    const speeds = order.map(speedOf);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    expect(new Set(speeds).size).toBe(speeds.length);
    expect(speedOf('troll')).toBe(speedOf('golem'));
    expect(speedOf('valkyrie')).toBe(speedOf('archer'));
    expect(speedOf('sylph')).toBeGreaterThan(speedOf('archer'));
  });

  it('the djinn whirlwind is big, but smaller than a hurled boulder', () => {
    expect((ATTACKS.sylph as ShotAttack).radius).toBeLessThan((ATTACKS.golem as ShotAttack).radius);
    expect((ATTACKS.sylph as ShotAttack).radius).toBeGreaterThan((ATTACKS.archer as ShotAttack).radius);
  });
});

describe('straight shots', () => {
  it('an arrow crosses the whole arena', () => {
    const s0 = duel('archer', 'troll', { x: 30, y: mid }, { x: ARENA_W - 30, y: mid });
    const s = volley(s0, lightFires);
    expect(s.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
  });

  it('a manticore spike arrives sooner than an arrow over the same distance', () => {
    const ticksToHit = (shooter: PieceKind, target: PieceKind, firing: ArenaInputs) => {
      let s = stepArena(duel(shooter === 'archer' ? 'archer' : target, shooter === 'archer' ? target : shooter,
        { x: 100, y: mid }, { x: 700, y: mid }), firing);
      let t = 1;
      while (s.shots.length > 0) { s = stepArena(s, IDLE); t++; }
      return t;
    };
    expect(ticksToHit('manticore', 'golem', darkFires)).toBeLessThan(ticksToHit('archer', 'troll', lightFires));
  });

  it('an arrow stops at a boulder and leaves it unharmed', () => {
    const rock = boulder(300, mid - 25);
    const s0 = duel('archer', 'troll', { x: 100, y: mid }, { x: 700, y: mid }, [rock]);
    const s = volley(s0, lightFires);
    expect(s.boulders).toEqual([rock]);
    expect(s.fighters.dark.hp).toBe(s0.fighters.dark.hp);
  });
});

describe('boulder wear', () => {
  /** Shots fired at a boulder in front until it is gone. */
  function hitsToBreak(shooter: PieceKind): number {
    let s = duel(shooter, 'troll', { x: 100, y: mid }, { x: 800, y: mid }, [boulder(200, mid - 25)]);
    for (let hits = 1; hits <= 10; hits++) {
      s = volley({ ...s, fighters: { ...s.fighters, light: { ...s.fighters.light, cooldown: 0 } } }, lightFires);
      if (s.boulders.length === 0) return hits;
    }
    return Infinity;
  }

  it('a golem boulder breaks one in 3 hits', () => expect(hitsToBreak('golem')).toBe(3));

  it('dragon fire melts one in 2 hits', () => {
    // The dragon is dark: mirror the set-up so it fires left at the boulder.
    let s = duel('golem', 'dragon', { x: 100, y: mid }, { x: 380, y: mid }, [boulder(250, mid - 25)]);
    let hits = 0;
    while (s.boulders.length > 0 && hits < 10) {
      s = volley({ ...s, fighters: { ...s.fighters, dark: { ...s.fighters.dark, cooldown: 0 } } }, darkFires);
      hits++;
    }
    expect(hits).toBe(2);
  });
});

describe('bouncing shots (djinn whirlwind, sorceress lightning)', () => {
  it('lightning bounces back off a boulder instead of stopping', () => {
    const rock = boulder(400, mid - 25);
    const s0 = duel('golem', 'sorceress', { x: 100, y: mid }, { x: 600, y: mid }, [rock]);
    let s = stepArena(s0, darkFires);
    expect(s.shots[0]!.vel.x).toBeLessThan(0);
    s = run(s, IDLE, 40);
    expect(s.shots[0]!.vel.x).toBeGreaterThan(0);
    expect(s.boulders).toEqual([rock]);
  });

  it('a whirlwind can hit after a bounce', () => {
    // Light djinn fires right into a boulder; the target stands behind the djinn.
    const s0 = duel('sylph', 'troll', { x: 300, y: mid }, { x: 100, y: mid }, [boulder(380, mid - 25)]);
    const s = volley(s0, lightFires);
    expect(s.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
  });
});

describe('dragon flame cone', () => {
  it('stays narrow for 2 steps, then widens', () => {
    expect(flameRadius(FLAME_NARROW)).toBe(flameRadius(0));
    expect(flameRadius(FLAME_RANGE)).toBeGreaterThan(flameRadius(FLAME_NARROW) * 3);
  });

  it('hits a nearby opponent exactly once', () => {
    const near = duel('golem', 'dragon', { x: 200, y: mid }, { x: 330, y: mid });
    const s = volley(near, darkFires);
    expect(s.fighters.light.hp).toBe(near.fighters.light.hp - near.fighters.dark.damage);
  });

  it('dies out after FLAME_RANGE, before reaching the far wall', () => {
    const s0 = duel('golem', 'dragon', { x: 60, y: 30 }, { x: 900, y: ARENA_H - 30 });
    const ticks = Math.floor(FLAME_RANGE / speedOf('dragon'));
    const flying = run(stepArena(s0, darkFires), IDLE, ticks - 3);
    expect(flying.shots).toHaveLength(1);
    expect(flying.shots[0]!.pos.x).toBeGreaterThan(0);
    expect(run(flying, IDLE, 6).shots).toEqual([]);
  });

  it('misses an opponent off to the side up close, but its wide end catches them further out', () => {
    const close = duel('golem', 'dragon', { x: 550, y: mid + 60 }, { x: 700, y: mid });
    expect(volley(close, darkFires).fighters.light.hp).toBe(close.fighters.light.hp);
    const far = duel('golem', 'dragon', { x: 330, y: mid + 60 }, { x: 700, y: mid });
    expect(volley(far, darkFires).fighters.light.hp).toBeLessThan(far.fighters.light.hp);
  });
});

describe('wizard fireball', () => {
  it('explodes on impact and leaves fire that keeps burning for 3 seconds', () => {
    const s0 = duel('wizard', 'troll', { x: 200, y: mid }, { x: 400, y: mid });
    const hit = volley(s0, lightFires);
    expect(hit.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
    expect(hit.fires).toHaveLength(1);
    const burned = run(hit, IDLE, BURN_INTERVAL * 2);
    expect(burned.fighters.dark.hp).toBe(hit.fighters.dark.hp - 2 * BURN_DAMAGE);
    expect(run(hit, IDLE, FIRE_TICKS).fires).toEqual([]);
  });

  it('the fire stops hurting once the target walks out, and never hurts the wizard', () => {
    const s0 = duel('wizard', 'troll', { x: 200, y: mid }, { x: 400, y: mid });
    const hit = volley(s0, lightFires);
    const escaped = run(hit, { light: NO_INPUT, dark: { ...NO_INPUT, right: true } }, BURN_INTERVAL * 2);
    expect(escaped.fighters.dark.hp).toBeGreaterThanOrEqual(hit.fighters.dark.hp - BURN_DAMAGE);
    const wizardInFire = {
      ...hit,
      fighters: { ...hit.fighters, light: { ...hit.fighters.light, pos: hit.fires[0]!.pos } },
    };
    expect(run(wizardInFire, IDLE, BURN_INTERVAL * 3).fighters.light.hp).toBe(s0.fighters.light.hp);
  });

  it('also bursts into fire when it hits a boulder', () => {
    const s = volley(duel('wizard', 'troll', { x: 200, y: mid }, { x: 700, y: mid }, [boulder(350, mid - 25)]), lightFires);
    expect(s.fires).toHaveLength(1);
  });
});

describe('phoenix blast', () => {
  it('hurts an opponent within two fighter-widths and gives one second of immunity', () => {
    const s0 = duel('phoenix', 'troll', { x: 300, y: mid }, { x: 300 + BURST_RADIUS - 2, y: mid });
    const s1 = stepArena(s0, lightFires);
    expect(s1.fighters.dark.hp).toBe(s0.fighters.dark.hp - s0.fighters.light.damage);
    expect(s1.fighters.light.immune).toBe(PHOENIX_IMMUNITY);
    const out = duel('phoenix', 'troll', { x: 300, y: mid }, { x: 300 + BURST_RADIUS + 10, y: mid });
    expect(stepArena(out, lightFires).fighters.dark.hp).toBe(out.fighters.dark.hp);
  });

  it('shots do nothing while immune, and hurt again once it wears off', () => {
    const s0 = duel('phoenix', 'serpent', { x: 300, y: mid }, { x: 600, y: mid });
    const blasted = stepArena(s0, lightFires);
    const shielded = volley(blasted, darkFires);
    expect(shielded.fighters.light.hp).toBe(s0.fighters.light.hp);
    const later = run(shielded, IDLE, PHOENIX_IMMUNITY);
    expect(later.fighters.light.immune).toBe(0);
    const ready = { ...later, fighters: { ...later.fighters, dark: { ...later.fighters.dark, cooldown: 0 } } };
    expect(volley(ready, darkFires).fighters.light.hp).toBeLessThan(s0.fighters.light.hp);
  });

  it('reloads slower than its immunity lasts, so it can never stay immune', () => {
    const s0 = duel('phoenix', 'troll', { x: 300, y: mid }, { x: 600, y: mid });
    expect(s0.fighters.light.reload).toBeGreaterThan(PHOENIX_IMMUNITY);
    let s = s0;
    let vulnerableTicks = 0;
    for (let i = 0; i < 600; i++) {
      s = stepArena(s, lightFires);
      if (s.fighters.light.immune === 0) vulnerableTicks++;
    }
    expect(vulnerableTicks).toBeGreaterThan(100);
  });
});

describe('banshee', () => {
  it('floats through boulders, which still block a troll', () => {
    const rock = boulder(400, mid - 25);
    const right = { light: NO_INPUT, dark: { ...NO_INPUT, left: true } };
    const banshee = run(duel('golem', 'banshee', { x: 100, y: mid }, { x: 480, y: mid }, [rock]), right, 30);
    expect(banshee.fighters.dark.pos.x).toBeLessThan(450 - FIGHTER_SIZE / 2);
    const troll = run(duel('golem', 'troll', { x: 100, y: mid }, { x: 480, y: mid }, [rock]), right, 30);
    expect(troll.fighters.dark.pos.x).toBeGreaterThanOrEqual(450 + FIGHTER_SIZE / 2);
  });

  it('screams through boulders and steals half the damage it deals', () => {
    const s0 = duel('golem', 'banshee', { x: 300, y: mid }, { x: 370, y: mid }, [boulder(320, mid - 25, 30)]);
    const hurtBanshee = { ...s0, fighters: { ...s0.fighters, dark: { ...s0.fighters.dark, hp: 2 } } };
    const s1 = stepArena(hurtBanshee, darkFires);
    const dealt = s0.fighters.dark.damage;
    expect(s1.fighters.light.hp).toBe(s0.fighters.light.hp - dealt);
    expect(s1.fighters.dark.hp).toBe(2 + Math.floor(dealt / 2));
    expect(s1.fighters.dark.immune).toBe(0);
  });

  it('a scream at full health heals nothing', () => {
    const s0 = duel('golem', 'banshee', { x: 300, y: mid }, { x: 370, y: mid });
    expect(stepArena(s0, darkFires).fighters.dark.hp).toBe(s0.fighters.dark.maxHp);
  });
});
