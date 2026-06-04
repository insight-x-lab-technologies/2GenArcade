// Tactile feedback (vibration) for on-screen controls and UI buttons.
//
// Progressive enhancement: the Vibration API is unsupported on iOS Safari and
// most desktops, where every call is a silent no-op. Never gate gameplay on it.
// A single global enabled flag mirrors the user's Settings toggle so we don't
// thread the store through every button.

export type HapticPattern = 'tap' | 'press' | 'soft' | 'hit' | 'heavy' | 'success';

/** Vibration durations (ms). Arrays alternate vibrate/pause per the Web API. */
const PATTERNS: Record<HapticPattern, number | number[]> = {
  soft: 5, // analog stick engage / subtle
  tap: 8, // d-pad / movement key
  press: 12, // primary action button
  hit: 18, // an impactful game event
  heavy: [0, 22, 18, 22], // big event (explosion, game over)
  success: [0, 10, 18, 20], // reward (trophy, level clear)
};

const canVibrate =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = true;

/** Mirror the user's Settings preference. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
  // Cancel any in-flight pattern when turning off.
  if (!value && canVibrate) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}

/** Whether the device exposes the Vibration API at all (for the Settings hint). */
export function hapticsSupported(): boolean {
  return canVibrate;
}

/** Fire a named haptic pattern. No-op when disabled or unsupported. */
export function vibrate(pattern: HapticPattern): void {
  if (!enabled || !canVibrate) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* some browsers throw if called without a user gesture — ignore */
  }
}
