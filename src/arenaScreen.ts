import type { ArenaState } from './combat/arena';
import { ARENA_H, ARENA_W, TICK_HZ, isFinished, stepArena } from './combat/arena';
import { inputsFrom, isArenaKey } from './combat/controls';
import type { ArenaLook } from './render/arenaView';
import { drawArena } from './render/arenaView';

const STEP_MS = 1000 / TICK_HZ;
/** Catch-up limit per frame, so a backgrounded tab doesn't fast-forward the fight. */
const MAX_STEPS_PER_FRAME = 5;

/** Shows the arena popup and runs the fight in real time; calls onDone with the final state. */
export function runArena(initial: ArenaState, look: ArenaLook, onDone: (final: ArenaState) => void): void {
  const overlay = document.querySelector<HTMLElement>('#arena-overlay')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#arena')!;
  const ctx = canvas.getContext('2d')!;
  canvas.width = ARENA_W;
  canvas.height = ARENA_H;

  const pressed = new Set<string>();
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!isArenaKey(e.code)) return;
    e.preventDefault();
    pressed.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => void pressed.delete(e.code);
  const onBlur = (): void => pressed.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  overlay.hidden = false;

  let arena = initial;
  let last = performance.now();
  let pending = 0;
  const frame = (now: number): void => {
    pending += Math.min(now - last, STEP_MS * MAX_STEPS_PER_FRAME);
    last = now;
    for (; pending >= STEP_MS; pending -= STEP_MS) arena = stepArena(arena, inputsFrom(pressed));
    drawArena(ctx, arena, look);
    if (!isFinished(arena)) {
      requestAnimationFrame(frame);
      return;
    }
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    overlay.hidden = true;
    onDone(arena);
  };
  drawArena(ctx, arena, look);
  requestAnimationFrame(frame);
}
