// Shared logic for the analog control styles (zone pad + floating swipe stick).
// Both translate a stick/drag *offset* into the held directions a game polls.
// Kept pure so the mapping is unit-tested and the UI components stay thin.

import type { Direction } from '@/types';

/**
 * Map a stick/drag offset to the directions that should be held. Returns 0, 1
 * or 2 directions — diagonals press a vertical *and* a horizontal at once,
 * simulating an analog joystick. Screen coordinates: +x right, +y down. Offsets
 * inside the deadzone produce no direction.
 */
export const vectorToDirections = (dx: number, dy: number, deadzone = 12): Direction[] => {
  if (Math.hypot(dx, dy) < deadzone) return [];
  // Angle in degrees with screen-up as +90 (atan2 of -dy because y grows down).
  let a = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (a < 0) a += 360; // 0..360
  // Eight 45° sectors centred on E(0) NE(45) N(90) NW(135) W(180) SW(225) S(270) SE(315).
  switch (Math.round(a / 45) % 8) {
    case 0:
      return ['right'];
    case 1:
      return ['up', 'right'];
    case 2:
      return ['up'];
    case 3:
      return ['up', 'left'];
    case 4:
      return ['left'];
    case 5:
      return ['down', 'left'];
    case 6:
      return ['down'];
    case 7:
      return ['down', 'right'];
    default:
      return [];
  }
};

/**
 * Emit the press/release events needed to move from one held-set to another.
 * `apply` is the sink (the input adapter's dpad dispatch). Pure aside from the
 * callback, so the diff is testable.
 */
export const diffHeld = (
  prev: ReadonlySet<Direction>,
  next: ReadonlySet<Direction>,
  apply: (dir: Direction, phase: 'press' | 'release') => void,
): void => {
  for (const d of next) if (!prev.has(d)) apply(d, 'press');
  for (const d of prev) if (!next.has(d)) apply(d, 'release');
};
