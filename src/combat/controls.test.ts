import { describe, expect, it } from 'vitest';
import { NO_INPUT, inputsFrom, isArenaKey, keysOnly, localInput } from './controls';

describe('controls', () => {
  it('maps WASD+G to light and IJKL+Ä to dark', () => {
    const i = inputsFrom(new Set(['KeyW', 'KeyA', 'KeyG', 'KeyI', 'KeyL', 'Quote']));
    expect(i.light).toEqual({ ...NO_INPUT, up: true, left: true, fire: true });
    expect(i.dark).toEqual({ ...NO_INPUT, up: true, right: true, fire: true });
    expect(inputsFrom(new Set(['KeyS', 'KeyD', 'KeyK', 'KeyJ']))).toEqual({
      light: { ...NO_INPUT, down: true, right: true },
      dark: { ...NO_INPUT, down: true, left: true },
    });
  });

  it('localInput accepts either key set', () => {
    expect(localInput(keysOnly(new Set(['KeyW', 'Quote'])))).toEqual({ ...NO_INPUT, up: true, fire: true });
    expect(localInput(keysOnly(new Set(['KeyJ', 'KeyD'])))).toEqual({ ...NO_INPUT, left: true, right: true });
  });

  it('localInput adds the mouse: left button fires, movement turns (consumed once)', () => {
    let pending = 7;
    const mouse = { pressed: new Set<string>(), mouseFire: true, takeTurn: () => { const t = pending; pending = 0; return t; } };
    expect(localInput(mouse)).toEqual({ ...NO_INPUT, fire: true, turn: 7 });
    expect(localInput(mouse).turn).toBe(0);
  });

  it('recognises only arena keys', () => {
    expect(isArenaKey('Quote')).toBe(true);
    expect(isArenaKey('KeyS')).toBe(true);
    expect(isArenaKey('KeyQ')).toBe(false);
    expect(isArenaKey('KeyF')).toBe(false);
    expect(isArenaKey('Semicolon')).toBe(false);
  });
});
