import { describe, expect, it } from 'vitest';
import { createRoom, isFull, join, leave, otherSide } from './room.mjs';

describe('room', () => {
  it('gives the first player a random side and the second the other', () => {
    const asLight = join(createRoom(), 'a', () => 0.1);
    expect(asLight.side).toBe('light');
    expect(join(asLight.room, 'b').side).toBe('dark');
    const asDark = join(createRoom(), 'a', () => 0.9);
    expect(asDark.side).toBe('dark');
    expect(join(asDark.room, 'b').side).toBe('light');
  });

  it('turns away a third player', () => {
    const two = join(join(createRoom(), 'a').room, 'b').room;
    expect(isFull(two)).toBe(true);
    expect(join(two, 'c')).toEqual({ room: two, side: null });
  });

  it('frees the seat of a player who leaves, for the next one to take', () => {
    const r1 = join(createRoom(), 'a', () => 0.1).room;
    const r2 = join(r1, 'b').room;
    const left = leave(r2, 'a');
    expect(left.side).toBe('light');
    expect(join(left.room, 'c').side).toBe('light');
    expect(leave(r2, 'nobody')).toEqual({ room: r2, side: null });
  });

  it('otherSide', () => {
    expect(otherSide('light')).toBe('dark');
    expect(otherSide('dark')).toBe('light');
  });
});
