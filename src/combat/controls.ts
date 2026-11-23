import type { Side } from '../core/types';

/** One side's held buttons for a single tick. */
export interface ArenaInput {
  readonly left: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly right: boolean;
  readonly fire: boolean;
  /** Mouse aim (first-person shooter steering only): direction-table steps to turn this tick, + = right. */
  readonly turn: number;
}

export type ArenaInputs = Readonly<Record<Side, ArenaInput>>;

export const NO_INPUT: ArenaInput = { left: false, up: false, down: false, right: false, fire: false, turn: 0 };

/** What this player's own keyboard and mouse are doing right now. */
export interface LocalControls {
  readonly pressed: ReadonlySet<string>;
  /** Left mouse button held (only while the mouse is captured by the arena). */
  readonly mouseFire: boolean;
  /** Mouse turn gathered since the last call, in whole direction steps; the call consumes it. */
  takeTurn(): number;
}

/** Keys only, no mouse: hot-seat play and tests. */
export const keysOnly = (pressed: ReadonlySet<string>): LocalControls => ({ pressed, mouseFire: false, takeTurn: () => 0 });

/**
 * Physical key codes (KeyboardEvent.code), so they work on any layout.
 * On a Swedish keyboard Quote is Ä.
 */
type KeyAction = Exclude<keyof ArenaInput, 'turn'>;

export const KEYMAP: Readonly<Record<Side, Readonly<Record<KeyAction, string>>>> = {
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
    turn: 0,
  };
};

export const inputsFrom = (pressed: ReadonlySet<string>): ArenaInputs => ({
  light: inputFor(pressed, 'light'),
  dark: inputFor(pressed, 'dark'),
});

/** Network play: each player has the keyboard (and mouse) to themselves, so either key set works. */
export function localInput(c: LocalControls): ArenaInput {
  const { light: a, dark: b } = inputsFrom(c.pressed);
  return {
    left: a.left || b.left,
    up: a.up || b.up,
    down: a.down || b.down,
    right: a.right || b.right,
    fire: a.fire || b.fire || c.mouseFire,
    turn: c.takeTurn(),
  };
}
