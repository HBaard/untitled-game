import { describe, expect, it } from 'vitest';
import { DIRECTIONS, DIRECTION_COUNT, TURN_STEP, directionOf, startAngle, turn, walk } from './steering';

const NONE = { left: false, right: false, up: false, down: false };

describe('DIRECTIONS', () => {
  it('has one unit vector per direction', () => {
    expect(DIRECTIONS).toHaveLength(DIRECTION_COUNT);
    for (const d of DIRECTIONS) expect(Math.abs(d.x * d.x + d.y * d.y - 1)).toBeLessThan(1e-12);
  });

  it('hits the four axes exactly, turning clockwise on screen', () => {
    const q = DIRECTION_COUNT / 4;
    expect(directionOf(0)).toEqual({ x: 1, y: 0 });
    expect(directionOf(q)).toEqual({ x: 0, y: 1 });
    expect(directionOf(2 * q)).toEqual({ x: -1, y: 0 });
    expect(directionOf(3 * q)).toEqual({ x: 0, y: -1 });
  });

  it('spaces the directions evenly', () => {
    const step = (2 * Math.PI) / DIRECTION_COUNT;
    DIRECTIONS.forEach((d, i) => {
      expect(d.x).toBeCloseTo(Math.cos(i * step), 12);
      expect(d.y).toBeCloseTo(Math.sin(i * step), 12);
    });
  });
});

describe('turn and walk', () => {
  it('starts light facing right and dark facing left', () => {
    expect(directionOf(startAngle(true)).x).toBe(1);
    expect(directionOf(startAngle(false)).x).toBe(-1);
  });

  it('turns right clockwise, left anticlockwise, wrapping around', () => {
    expect(turn(0, { ...NONE, right: true })).toBe(TURN_STEP);
    expect(turn(0, { ...NONE, left: true })).toBe(DIRECTION_COUNT - TURN_STEP);
    expect(turn(5, { ...NONE, left: true, right: true })).toBe(5);
  });

  it('walks forwards, backwards or not at all', () => {
    expect(walk({ ...NONE, up: true })).toBe(1);
    expect(walk({ ...NONE, down: true })).toBe(-1);
    expect(walk({ ...NONE, up: true, down: true })).toBe(0);
    expect(walk(NONE)).toBe(0);
  });
});
