import type { ArenaInput, ArenaInputs } from '../combat/controls';
import { NO_INPUT } from '../combat/controls';
import type { Side } from '../core/types';

/**
 * Ticks between pressing a key and it taking effect. Each player's input for tick t is
 * sent while they are simulating tick t - INPUT_DELAY, so it has that long to arrive.
 * 3 ticks = 50 ms: unnoticeable on a local network.
 */
export const INPUT_DELAY = 3;

type TickInputs = Readonly<Partial<Record<Side, ArenaInput>>>;

/** Both players' known inputs for one arena, by tick. */
export interface Lockstep {
  readonly delay: number;
  readonly inputs: ReadonlyMap<number, TickInputs>;
}

export const createLockstep = (delay = INPUT_DELAY): Lockstep => ({ delay, inputs: new Map() });

export function recordInput(ls: Lockstep, side: Side, tick: number, input: ArenaInput): Lockstep {
  const inputs = new Map(ls.inputs);
  inputs.set(tick, { ...inputs.get(tick), [side]: input });
  return { ...ls, inputs };
}

/**
 * Both inputs for `tick`, or null while one is still in flight (the caller waits).
 * The first `delay` ticks have no input from anyone: nobody could have sent any yet.
 */
export function inputsAt(ls: Lockstep, tick: number): ArenaInputs | null {
  if (tick <= ls.delay) return { light: NO_INPUT, dark: NO_INPUT };
  const t = ls.inputs.get(tick);
  return t?.light && t.dark ? { light: t.light, dark: t.dark } : null;
}

/** Forgets ticks already simulated. */
export function dropBefore(ls: Lockstep, tick: number): Lockstep {
  return { ...ls, inputs: new Map([...ls.inputs].filter(([t]) => t >= tick)) };
}
