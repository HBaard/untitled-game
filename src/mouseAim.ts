import type { LocalControls } from './combat/controls';

/** Direction-table steps per pixel of mouse movement (1024 steps per turn: ~0.18 degrees per pixel). */
export const MOUSE_STEPS_PER_PX = 0.5;
/** Ignore absurd jumps (some browsers spike movementX when the pointer is captured). */
const MAX_PX_PER_EVENT = 300;

/**
 * First-person-shooter mouse: click the arena to capture the pointer (Esc releases it),
 * then sideways movement turns and the left button fires.
 */
export class MouseAim implements LocalControls {
  pressed: ReadonlySet<string> = new Set();
  mouseFire = false;
  /** Turn gathered but not yet sent, in (fractional) steps; whole steps are handed out, the rest kept. */
  private pending = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly stepsPerPx: number) {
    canvas.addEventListener('mousedown', this.onDown);
    document.addEventListener('mouseup', this.onUp);
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  get captured(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  takeTurn(): number {
    const whole = Math.trunc(this.pending);
    this.pending -= whole;
    return whole;
  }

  release(): void {
    this.canvas.removeEventListener('mousedown', this.onDown);
    document.removeEventListener('mouseup', this.onUp);
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    if (this.captured) document.exitPointerLock();
  }

  private readonly onDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!this.captured) {
      void this.canvas.requestPointerLock();
      return; // the capturing click doesn't fire
    }
    this.mouseFire = true;
  };

  private readonly onUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseFire = false;
  };

  private readonly onMove = (e: MouseEvent): void => {
    if (!this.captured) return;
    const dx = Math.max(-MAX_PX_PER_EVENT, Math.min(MAX_PX_PER_EVENT, e.movementX));
    this.pending += dx * this.stepsPerPx;
  };

  private readonly onLockChange = (): void => {
    if (!this.captured) this.mouseFire = false;
  };

  private readonly onContextMenu = (e: Event): void => e.preventDefault();
}
