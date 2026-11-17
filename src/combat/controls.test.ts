import { describe, expect, it } from 'vitest';
import { NO_INPUT, inputsFrom, isArenaKey } from './controls';

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

  it('recognises only arena keys', () => {
    expect(isArenaKey('Quote')).toBe(true);
    expect(isArenaKey('KeyS')).toBe(true);
    expect(isArenaKey('KeyQ')).toBe(false);
    expect(isArenaKey('KeyF')).toBe(false);
    expect(isArenaKey('Semicolon')).toBe(false);
  });
});
