import { opposite } from '../core/types';
import type { Side } from '../core/types';
import type { ShotAttack } from './attacks';
import { FLAME_MAX_RADIUS, FLAME_NARROW, FLAME_START_RADIUS } from './attacks';
import type { Boulder } from './boulders';
import { rectsOverlap } from './boulders';
import type { ArenaFighter, Field, Fire, Shot, Vec } from './field';
import { FIGHTER_SIZE, circleRect, distSq, fighterRect, hurt, outOfArena } from './field';

/** Longest move between collision checks, so fast shots can't skip past anything. */
const SUBSTEP = 6;
/** The flame widens by this many pixels of radius per pixel travelled once past FLAME_NARROW. */
const FLAME_SPREAD = 0.3;

/** Wizard fire: 3 seconds on the ground, burning the opponent every half second. */
export const FIRE_TICKS = 180;
export const FIRE_RADIUS = 34;
export const BURN_INTERVAL = 30;
export const BURN_DAMAGE = 1;

export function makeShot(f: ArenaFighter, spec: ShotAttack, id: number): Shot {
  const muzzle = FIGHTER_SIZE / 2 + spec.radius + 1;
  const pos = { x: f.pos.x + f.facing.x * muzzle, y: f.pos.y + f.facing.y * muzzle };
  return {
    id,
    owner: f.side,
    style: spec.style,
    origin: pos,
    pos,
    vel: { x: f.facing.x * spec.speed, y: f.facing.y * spec.speed },
    speed: spec.speed,
    radius: spec.radius,
    damage: f.damage,
    wear: spec.wearsBoulders ? f.wear : 0,
    bounce: spec.bounce,
    explodes: spec.explodes,
    grows: spec.grows,
    travelled: 0,
    range: spec.range,
  };
}

/** The dragon's cone: narrow for the first FLAME_NARROW pixels, then widening. */
export const flameRadius = (travelled: number): number =>
  travelled <= FLAME_NARROW
    ? FLAME_START_RADIUS
    : Math.min(FLAME_MAX_RADIUS, FLAME_START_RADIUS + (travelled - FLAME_NARROW) * FLAME_SPREAD);

/** A wearing hit takes `wear` off a boulder; at 0 it is gone. */
export const wearBoulder = (boulders: readonly Boulder[], id: number, wear: number): Boulder[] =>
  boulders.flatMap((b) => (b.id !== id ? [b] : b.hp > wear ? [{ ...b, hp: b.hp - wear }] : []));

const addFire = (field: Field, pos: Vec, owner: Side): Field => ({
  ...field,
  fires: [...field.fires, { id: field.nextId, owner, pos, age: 0 }],
  nextId: field.nextId + 1,
});

const boulderAt = (boulders: readonly Boulder[], pos: Vec, r: number): Boulder | undefined =>
  boulders.find((b) => rectsOverlap(circleRect(pos, r), b));

/** Flips the velocity on whichever axis ran into the boulder (both at a corner). */
function reflect(boulders: readonly Boulder[], shot: Shot, next: Vec): Vec {
  const flipX = boulderAt(boulders, { x: next.x, y: shot.pos.y }, shot.radius) !== undefined;
  const flipY = boulderAt(boulders, { x: shot.pos.x, y: next.y }, shot.radius) !== undefined;
  const corner = !flipX && !flipY;
  return { x: flipX || corner ? -shot.vel.x : shot.vel.x, y: flipY || corner ? -shot.vel.y : shot.vel.y };
}

/** What a shot does when it stops on a boulder or at the end of its range. */
function spend(field: Field, shot: Shot, at: Vec, boulder?: Boulder): Field {
  const worn = boulder && shot.wear > 0 ? { ...field, boulders: wearBoulder(field.boulders, boulder.id, shot.wear) } : field;
  return shot.explodes ? addFire(worn, at, shot.owner) : worn;
}

type Sub = { readonly field: Field; readonly shot: Shot | null };

function subStep(field: Field, shot: Shot, frac: number): Sub {
  const next = { x: shot.pos.x + shot.vel.x * frac, y: shot.pos.y + shot.vel.y * frac };
  const travelled = shot.travelled + shot.speed * frac;
  if (outOfArena(next)) return { field, shot: null };
  if (travelled > shot.range) return { field: spend(field, shot, shot.pos), shot: null };
  const radius = shot.grows ? flameRadius(travelled) : shot.radius;
  const boulder = boulderAt(field.boulders, next, radius);
  // A bouncing shot that starts inside a boulder (fired point-blank) just flies out of it.
  const stuck = boulderAt(field.boulders, shot.pos, radius) !== undefined;
  if (boulder && shot.bounce && !stuck) {
    return { field, shot: { ...shot, vel: reflect(field.boulders, shot, next), travelled } };
  }
  if (boulder && !shot.bounce) return { field: spend(field, shot, shot.pos, boulder), shot: null };
  const target = opposite(shot.owner);
  if (rectsOverlap(circleRect(next, radius), fighterRect(field.fighters[target].pos))) {
    const hit = { ...field, fighters: hurt(field.fighters, target, shot.damage).fighters };
    return { field: shot.explodes ? addFire(hit, next, shot.owner) : hit, shot: null };
  }
  return { field, shot: { ...shot, pos: next, travelled, radius } };
}

/** Moves one shot for a tick in small sub-steps: it flies on, bounces, or is spent. */
export function advanceShot(field: Field, shot: Shot): Field {
  const steps = Math.max(1, Math.ceil(shot.speed / SUBSTEP));
  let sub: Sub = { field, shot };
  for (let i = 0; i < steps && sub.shot; i++) sub = subStep(sub.field, sub.shot, 1 / steps);
  return sub.shot ? { ...sub.field, shots: [...sub.field.shots, sub.shot] } : sub.field;
}

const inFire = (fire: Fire, pos: Vec): boolean =>
  distSq(fire.pos, pos) <= (FIRE_RADIUS + FIGHTER_SIZE / 2) * (FIRE_RADIUS + FIGHTER_SIZE / 2);

/** Ages the burning ground; every BURN_INTERVAL ticks it burns the owner's opponent if inside. */
export function tickFires(field: Field): Field {
  let fighters = field.fighters;
  const fires: Fire[] = [];
  for (const fire of field.fires) {
    const age = fire.age + 1;
    if (age >= FIRE_TICKS) continue;
    const target = opposite(fire.owner);
    if (age % BURN_INTERVAL === 0 && inFire(fire, fighters[target].pos)) {
      fighters = hurt(fighters, target, BURN_DAMAGE).fighters;
    }
    fires.push({ ...fire, age });
  }
  return { ...field, fighters, fires };
}
