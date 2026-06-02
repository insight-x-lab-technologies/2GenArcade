// Declarative chiptune format. Games describe music/SFX as DATA (no Tone.js
// import), and the audio engine interprets it. This keeps games decoupled from
// the audio backend — they only ever touch `AudioBus` from the GameContext.

export type ChiptuneWave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

/** A single step in a channel. `note` is scientific pitch (e.g. 'C4') or a
 *  chord (array). `time` and `dur` use Tone.js notation (e.g. '0:0', '8n'). */
export interface ChiptuneStep {
  time: string;
  note: string | string[];
  dur: string;
  /** 0..1 velocity. Defaults to 1. */
  velocity?: number;
}

export interface ChiptuneChannel {
  wave: ChiptuneWave;
  /** Channel gain in dB (negative attenuates). Defaults to -8. */
  volumeDb?: number;
  steps: ChiptuneStep[];
}

export interface ChiptuneTrack {
  bpm: number;
  /** Loop length in Tone.js bars:beats notation, e.g. '4m'. */
  loopLength: string;
  channels: ChiptuneChannel[];
}

/** A short, one-shot sound effect. */
export interface SfxDef {
  wave: ChiptuneWave;
  volumeDb?: number;
  notes: Array<{ note: string; dur: string; time?: number }>;
}

export interface GameSoundKit {
  menu?: ChiptuneTrack;
  gameplay?: ChiptuneTrack;
  sfx?: Record<string, SfxDef>;
}

export type MusicTrackName = 'menu' | 'gameplay';

/** Game-facing audio surface exposed through GameContext. */
export interface AudioBus {
  playMusic(track: MusicTrackName): void;
  stopMusic(): void;
  playSfx(id: string): void;
}
