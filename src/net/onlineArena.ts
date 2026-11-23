import type { ArenaDriver } from '../arenaScreen';
import type { ArenaInput } from '../combat/controls';
import { NO_INPUT } from '../combat/controls';
import { localInput } from '../combat/controls';
import type { Side } from '../core/types';
import type { Lockstep } from './lockstep';
import { createLockstep, dropBefore, inputsAt, recordInput } from './lockstep';

/**
 * Lockstep buffers per arena. The opponent may open an arena (and start sending input)
 * a moment before we do, so input for arenas we haven't reached yet is kept too.
 */
export class InputBook {
  private readonly books = new Map<number, Lockstep>();
  /** Arenas at or below this number are over; late input for them is ignored. */
  private closedUpTo = -1;

  get(arena: number): Lockstep {
    return this.books.get(arena) ?? createLockstep();
  }

  record(arena: number, side: Side, tick: number, input: ArenaInput): void {
    if (arena <= this.closedUpTo) return;
    this.books.set(arena, recordInput(this.get(arena), side, tick, input));
  }

  forgetBefore(arena: number, tick: number): void {
    this.books.set(arena, dropBefore(this.get(arena), tick));
  }

  close(arena: number): void {
    this.closedUpTo = Math.max(this.closedUpTo, arena);
    for (const a of [...this.books.keys()]) if (a <= arena) this.books.delete(a);
  }
}

/**
 * Before simulating tick t, sends this player's input for t + delay (sampled now),
 * then runs tick t only once the opponent's input for it has arrived.
 */
export function onlineDriver(
  arena: number,
  local: Side,
  book: InputBook,
  send: (tick: number, input: ArenaInput) => void,
): ArenaDriver {
  const { delay } = book.get(arena);
  let sentUpTo = delay; // ticks 1..delay are implicitly "no input"
  return {
    inputsFor(tick, controls) {
      const target = tick + delay;
      if (target > sentUpTo) {
        const input = localInput(controls);
        for (let t = sentUpTo + 1; t <= target; t++) {
          // Held keys repeat on every tick sent now; the mouse turn happens once, on the first.
          const sent = t === sentUpTo + 1 ? input : { ...input, turn: NO_INPUT.turn };
          book.record(arena, local, t, sent);
          send(t, sent);
        }
        sentUpTo = target;
      }
      const inputs = inputsAt(book.get(arena), tick);
      if (inputs) book.forgetBefore(arena, tick);
      return inputs;
    },
  };
}
