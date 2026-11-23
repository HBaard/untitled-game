import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../combat/controls';
import { createLockstep, dropBefore, inputsAt, recordInput } from './lockstep';

const FIRE = { ...NO_INPUT, fire: true };
const UP = { ...NO_INPUT, up: true };

describe('lockstep', () => {
  it('the first `delay` ticks run with no input', () => {
    const ls = createLockstep(3);
    expect(inputsAt(ls, 1)).toEqual({ light: NO_INPUT, dark: NO_INPUT });
    expect(inputsAt(ls, 3)).toEqual({ light: NO_INPUT, dark: NO_INPUT });
    expect(inputsAt(ls, 4)).toBeNull();
  });

  it('waits until both sides have sent input for a tick', () => {
    const one = recordInput(createLockstep(3), 'light', 4, FIRE);
    expect(inputsAt(one, 4)).toBeNull();
    const both = recordInput(one, 'dark', 4, UP);
    expect(inputsAt(both, 4)).toEqual({ light: FIRE, dark: UP });
  });

  it('does not change the original when recording', () => {
    const ls = createLockstep(3);
    recordInput(ls, 'light', 4, FIRE);
    expect(ls.inputs.size).toBe(0);
  });

  it('dropBefore forgets simulated ticks only', () => {
    let ls = createLockstep(0);
    for (const t of [1, 2, 3]) ls = recordInput(recordInput(ls, 'light', t, FIRE), 'dark', t, UP);
    const pruned = dropBefore(ls, 3);
    expect([...pruned.inputs.keys()]).toEqual([3]);
    expect(inputsAt(pruned, 3)).toEqual({ light: FIRE, dark: UP });
  });
});
