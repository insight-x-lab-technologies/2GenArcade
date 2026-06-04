// Optional UI click sound for on-screen controls and menu buttons.
//
// Mirrors the haptics module: a single global flag tracks the user's Settings
// toggle so we don't thread the store through every button. The click is a
// short, quiet blip routed through the shared SFX bus, so it automatically
// respects the SFX volume and the global mute, and is a silent no-op until the
// AudioContext has been unlocked by a user gesture.

import type { SfxDef } from '@/types';
import { getAudioEngine } from '@/audio';

const CLICK: SfxDef = {
  wave: 'square',
  volumeDb: -20,
  notes: [{ note: 'C6', dur: '64n', time: 0 }],
};

let enabled = true;

/** Mirror the user's Settings preference. */
export function setUiSoundEnabled(value: boolean): void {
  enabled = value;
}

/** Play the UI click. No-op when disabled or the audio engine is still locked. */
export function playClick(): void {
  if (!enabled) return;
  try {
    getAudioEngine().playSfx(CLICK);
  } catch {
    /* audio not ready / no gesture yet — ignore */
  }
}
