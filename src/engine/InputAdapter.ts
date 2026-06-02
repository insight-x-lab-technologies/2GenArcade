import type { Direction, InputAdapter, InputEvent, InputHandler } from '@/types';
import {
  classifyPointerGesture,
  DEFAULT_GESTURE_OPTIONS,
  type GestureOptions,
  type PointerSample,
} from './gesture';

export interface PointerInputOptions extends Partial<GestureOptions> {
  /** Press duration (ms) after which a stationary pointer becomes a hold. */
  holdThreshold?: number;
}

/**
 * Normalizes raw pointer + keyboard input on a target element into logical
 * `InputEvent`s. On-screen controls (virtual d-pad / buttons rendered in React)
 * feed the same pipeline via `dispatch`, so games consume one uniform stream.
 */
export class PointerInputAdapter implements InputAdapter {
  private readonly handlers = new Set<InputHandler>();
  private readonly held = new Set<Direction>();
  private readonly gestureOptions: GestureOptions;
  private readonly holdThreshold: number;

  private start: PointerSample | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdActive = false;
  private moved = false;
  private attached = false;

  constructor(
    private readonly target: HTMLElement,
    options: PointerInputOptions = {},
  ) {
    this.gestureOptions = {
      swipeThreshold: options.swipeThreshold ?? DEFAULT_GESTURE_OPTIONS.swipeThreshold,
      tapMaxDistance: options.tapMaxDistance ?? DEFAULT_GESTURE_OPTIONS.tapMaxDistance,
      tapMaxDuration: options.tapMaxDuration ?? DEFAULT_GESTURE_OPTIONS.tapMaxDuration,
    };
    this.holdThreshold = options.holdThreshold ?? 350;
  }

  subscribe(handler: InputHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isHeld(direction: Direction): boolean {
    return this.held.has(direction);
  }

  /** Inject an event from on-screen controls (or tests). */
  dispatch(event: InputEvent): void {
    if (event.kind === 'dpad') {
      if (event.phase === 'press') this.held.add(event.direction);
      else this.held.delete(event.direction);
    }
    this.emit(event);
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('pointerdown', this.onPointerDown);
    this.target.addEventListener('pointermove', this.onPointerMove);
    this.target.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.clearHoldTimer();
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  destroy(): void {
    this.detach();
    this.handlers.clear();
    this.held.clear();
  }

  private emit(event: InputEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.start = { x: e.clientX, y: e.clientY, timeMs: e.timeStamp };
    this.moved = false;
    this.holdActive = false;
    this.clearHoldTimer();
    this.holdTimer = setTimeout(() => {
      if (!this.moved) {
        this.holdActive = true;
        this.emit({ kind: 'hold', phase: 'start' });
      }
    }, this.holdThreshold);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.start) return;
    const dist = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);
    if (dist > this.gestureOptions.tapMaxDistance) {
      this.moved = true;
      this.clearHoldTimer();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.clearHoldTimer();
    if (this.holdActive) {
      this.holdActive = false;
      this.emit({ kind: 'hold', phase: 'end' });
      this.start = null;
      return;
    }
    if (!this.start) return;
    const end: PointerSample = { x: e.clientX, y: e.clientY, timeMs: e.timeStamp };
    const gesture = classifyPointerGesture(this.start, end, this.gestureOptions);
    if (gesture) this.emit(gesture);
    this.start = null;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const dir = arrowDirection(e.key);
    if (dir) {
      if (!e.repeat) {
        this.held.add(dir);
        this.emit({ kind: 'dpad', direction: dir, phase: 'press' });
      }
      e.preventDefault();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) this.emit({ kind: 'button', id: 'action', phase: 'press' });
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const dir = arrowDirection(e.key);
    if (dir) {
      this.held.delete(dir);
      this.emit({ kind: 'dpad', direction: dir, phase: 'release' });
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      this.emit({ kind: 'button', id: 'action', phase: 'release' });
    }
  };

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }
}

function arrowDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}
