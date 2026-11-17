import type { Side } from '../core/types';

/** One side's held buttons for a single tick. */
export interface ArenaInput {
  readonly left: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly right: boolean;
  readonly fire: boolean;
}

export type ArenaInputs = Readonly<Record<Side, ArenaInput>>;

export const NO_INPUT: ArenaInput = { left: false, up: false, down: false, right: false, fire: false };

/**
 * Physical key codes (KeyboardEvent.code), so they work on any layout.
 * On a Swedish keyboard Quote is Ä.
 */
export const KEYMAP: Readonly<Record<Side, Readonly<Record<keyof ArenaInput, string>>>> = {
  light: { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', fire: 'KeyG' },
  dark: { up: 'KeyI', left: 'KeyJ', down: 'KeyK', right: 'KeyL', fire: 'Quote' },
};

const ALL_CODES = new Set(Object.values(KEYMAP).flatMap((m) => Object.values(m)));

export const isArenaKey = (code: string): boolean => ALL_CODES.has(code);

const inputFor = (pressed: ReadonlySet<string>, side: Side): ArenaInput => {
  const m = KEYMAP[side];
  return {
    left: pressed.has(m.left),
    up: pressed.has(m.up),
    down: pressed.has(m.down),
    right: pressed.has(m.right),
    fire: pressed.has(m.fire),
  };
};

export const inputsFrom = (pressed: ReadonlySet<string>): ArenaInputs => ({
  light: inputFor(pressed, 'light'),
  dark: inputFor(pressed, 'dark'),
});
