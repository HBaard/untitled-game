import type { Vec } from './field';

/**
 * First-person ("tank") steering for the 3D arena: left/right turn, up/down walk forwards/backwards.
 * Directions come from a fixed table so turning is exact on every machine (network lockstep).
 */
export const DIRECTION_COUNT = 1024;
/** Keyboard turning, table steps per tick: a full turn takes DIRECTION_COUNT / TURN_STEP ticks (~1 s). */
export const TURN_STEP = 16;

const QUARTER = DIRECTION_COUNT / 4;

const normalize = (v: Vec): Vec => {
  // Only + * / and sqrt: exactly rounded everywhere, unlike sin/cos.
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return { x: v.x / len, y: v.y / len };
};

/** Fills a quarter turn from (1, 0) to (0, 1) by repeatedly halving the angle between neighbours. */
function quarterTurn(): Vec[] {
  const out: Vec[] = new Array<Vec>(QUARTER + 1);
  out[0] = { x: 1, y: 0 };
  out[QUARTER] = { x: 0, y: 1 };
  const fill = (lo: number, hi: number): void => {
    if (hi - lo < 2) return;
    const mid = (lo + hi) / 2;
    out[mid] = normalize({ x: out[lo]!.x + out[hi]!.x, y: out[lo]!.y + out[hi]!.y });
    fill(lo, mid);
    fill(mid, hi);
  };
  fill(0, QUARTER);
  return out;
}

/** Rotating by a quarter turn clockwise on screen (y points down) is exact: (x, y) -> (-y, x). */
const rotateQuarter = (v: Vec): Vec => ({ x: -v.y + 0, y: v.x + 0 });

function buildDirections(): readonly Vec[] {
  const quarter = quarterTurn().slice(0, QUARTER);
  const out: Vec[] = [];
  let current = quarter;
  for (let q = 0; q < 4; q++) {
    out.push(...current);
    current = current.map(rotateQuarter);
  }
  return out;
}

/** Unit vectors; index 0 points right (+x), increasing indices turn clockwise on screen. */
export const DIRECTIONS: readonly Vec[] = buildDirections();

/** Index facing right for light, left for dark. */
export const startAngle = (facingRight: boolean): number => (facingRight ? 0 : DIRECTION_COUNT / 2);

export const directionOf = (angle: number): Vec => DIRECTIONS[angle]!;

export interface TankInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

/** New angle after one tick of turning; holding both turn keys cancels out. */
export function turn(angle: number, input: TankInput): number {
  const delta = (input.right ? TURN_STEP : 0) - (input.left ? TURN_STEP : 0);
  return (angle + delta + DIRECTION_COUNT) % DIRECTION_COUNT;
}

/** Mouse turning: any whole number of steps, either way (anything else from the wire counts as 0). */
export function turnBy(angle: number, steps: number): number {
  const whole = Number.isInteger(steps) ? steps : 0;
  return (((angle + whole) % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT;
}

/** 1 = to the right, -1 = to the left, 0 = neither (or both keys held). */
export const strafe = (input: TankInput): -1 | 0 | 1 => (input.left === input.right ? 0 : input.right ? 1 : -1);

/** 1 = forwards, -1 = backwards, 0 = standing (or both keys held). */
export const walk = (input: TankInput): -1 | 0 | 1 => (input.up === input.down ? 0 : input.up ? 1 : -1);
