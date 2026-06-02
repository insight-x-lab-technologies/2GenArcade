import type { Direction, InputEvent } from '@/types';

export interface PointerSample {
  x: number;
  y: number;
  timeMs: number;
}

export interface GestureOptions {
  /** Min distance (px) for a movement to count as a swipe. */
  swipeThreshold: number;
  /** Max distance (px) a tap may drift. */
  tapMaxDistance: number;
  /** Max duration (ms) for a tap. */
  tapMaxDuration: number;
}

export const DEFAULT_GESTURE_OPTIONS: GestureOptions = {
  swipeThreshold: 24,
  tapMaxDistance: 14,
  tapMaxDuration: 280,
};

/** Classify a pointer down→up into a single logical gesture (or null if it was
 *  an ambiguous drag that's neither a clean tap nor swipe). Pure + testable. */
export function classifyPointerGesture(
  start: PointerSample,
  end: PointerSample,
  options: GestureOptions = DEFAULT_GESTURE_OPTIONS,
): InputEvent | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const duration = end.timeMs - start.timeMs;

  if (distance <= options.tapMaxDistance && duration <= options.tapMaxDuration) {
    return { kind: 'tap', x: end.x, y: end.y };
  }

  if (distance >= options.swipeThreshold) {
    return { kind: 'swipe', direction: dominantDirection(dx, dy) };
  }

  return null;
}

export function dominantDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}
