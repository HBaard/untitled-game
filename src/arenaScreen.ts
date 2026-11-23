import type { ArenaState } from './combat/arena';
import { ARENA_H, ARENA_W, TICK_HZ, isFinished, stepArena } from './combat/arena';
import type { ArenaInputs, LocalControls } from './combat/controls';
import { inputsFrom, isArenaKey } from './combat/controls';
import { MOUSE_STEPS_PER_PX, MouseAim } from './mouseAim';
import type { ArenaLook } from './render/arenaView';
import { drawArena } from './render/arenaView';
import { drawArena3d } from './render/arena3d';

const STEP_MS = 1000 / TICK_HZ;
/** Catch-up limit per frame, so a backgrounded tab doesn't fast-forward the fight. */
const MAX_STEPS_PER_FRAME = 5;

/** Supplies both fighters' inputs for each tick; null means "not known yet, wait" (network play). */
export interface ArenaDriver {
  inputsFor(tick: number, local: LocalControls): ArenaInputs | null;
}

/** Two players on one keyboard: both inputs are always known. */
export const hotSeatDriver: ArenaDriver = { inputsFor: (_tick, local) => inputsFrom(local.pressed) };

const arenaUsesMouse = (a: ArenaState): boolean => a.steering === 'fps';

function drawCaptureHint(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(ARENA_W / 2 - 230, 150, 460, 56);
  ctx.fillStyle = '#ffe48a';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Click here to aim with the mouse', ARENA_W / 2, 178);
}

/**
 * Shows the arena popup and runs the fight in real time; calls onDone with the final state.
 * Returns a function that closes the arena early without calling onDone.
 */
export function runArena(
  initial: ArenaState, look: ArenaLook, driver: ArenaDriver, onDone: (final: ArenaState) => void,
): () => void {
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
  // Online first-person: capture the mouse to aim, left button fires.
  const mouse = arenaUsesMouse(initial) ? new MouseAim(canvas, MOUSE_STEPS_PER_PX) : null;
  const local: LocalControls = mouse ?? { pressed, mouseFire: false, takeTurn: () => 0 };
  if (mouse) mouse.pressed = pressed;

  const draw = look.view === '3d' ? drawArena3d : drawArena;
  let arena = initial;
  let last = performance.now();
  let pending = 0;
  let stopped = false;
  const close = (): void => {
    stopped = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    mouse?.release();
    overlay.hidden = true;
  };
  const frame = (now: number): void => {
    if (stopped) return;
    pending += Math.min(now - last, STEP_MS * MAX_STEPS_PER_FRAME);
    last = now;
    while (pending >= STEP_MS) {
      const inputs = driver.inputsFor(arena.tick + 1, local);
      if (!inputs) {
        pending = Math.min(pending, STEP_MS); // waiting for the opponent: don't bank time
        break;
      }
      arena = stepArena(arena, inputs);
      pending -= STEP_MS;
    }
    draw(ctx, arena, look);
    if (mouse && !mouse.captured) drawCaptureHint(ctx);
    if (!isFinished(arena)) {
      requestAnimationFrame(frame);
      return;
    }
    close();
    onDone(arena);
  };
  draw(ctx, arena, look);
  requestAnimationFrame(frame);
  return close;
}
