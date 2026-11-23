import { describe, expect, it } from 'vitest';
import type { ArenaInput } from '../combat/controls';
import { NO_INPUT } from '../combat/controls';
import { INPUT_DELAY } from './lockstep';
import { InputBook, onlineDriver } from './onlineArena';

const UP = { ...NO_INPUT, up: true };

/** Two drivers wired back to back, as two browsers would be through the server. */
function pair() {
  const books = { light: new InputBook(), dark: new InputBook() };
  const wire: { to: 'light' | 'dark'; tick: number; input: ArenaInput }[] = [];
  const driver = (side: 'light' | 'dark') =>
    onlineDriver(1, side, books[side], (tick, input) => wire.push({ to: side === 'light' ? 'dark' : 'light', tick, input }));
  const deliver = () => {
    for (const m of wire.splice(0)) books[m.to].record(1, m.to === 'light' ? 'dark' : 'light', m.tick, m.input);
  };
  return { light: driver('light'), dark: driver('dark'), deliver };
}

describe('onlineDriver', () => {
  it('runs the first INPUT_DELAY ticks without waiting', () => {
    const { light } = pair();
    for (let t = 1; t <= INPUT_DELAY; t++) expect(light.inputsFor(t, new Set())).not.toBeNull();
  });

  it('waits for the opponent, then both sides see identical inputs', () => {
    const { light, dark, deliver } = pair();
    const t = INPUT_DELAY + 1;
    for (let i = 1; i <= INPUT_DELAY; i++) {
      light.inputsFor(i, new Set(['KeyW']));
      dark.inputsFor(i, new Set());
    }
    expect(light.inputsFor(t, new Set())).toBeNull();
    deliver();
    const seenByLight = light.inputsFor(t, new Set());
    const seenByDark = dark.inputsFor(t, new Set());
    expect(seenByLight).toEqual({ light: UP, dark: NO_INPUT });
    expect(seenByDark).toEqual(seenByLight);
  });

  it('keeps input for an arena that has not opened here yet, and ignores closed arenas', () => {
    const book = new InputBook();
    book.record(2, 'dark', 4, UP);
    expect(book.get(2).inputs.get(4)).toEqual({ dark: UP });
    book.close(2);
    book.record(2, 'dark', 5, UP);
    expect(book.get(2).inputs.size).toBe(0);
  });
});
