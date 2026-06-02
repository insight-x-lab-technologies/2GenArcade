import * as Tone from 'tone';
import type { ChiptuneChannel, ChiptuneTrack, SfxDef } from '@/types';

// Master audio: synthesizes chiptune tracks + SFX from declarative data.
// Two independent channels (music / SFX) with persisted volumes and a global
// mute. The AudioContext starts suspended and is unlocked on first user gesture
// (browser autoplay policy) via `unlock()`.

interface ChannelVoice {
  trigger(note: string | string[], dur: string, time: number, velocity: number): void;
  dispose(): void;
}

function createVoice(channel: ChiptuneChannel, destination: Tone.ToneAudioNode): ChannelVoice {
  const channelVolume = new Tone.Volume(channel.volumeDb ?? -8).connect(destination);

  if (channel.wave === 'noise') {
    const synth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    }).connect(channelVolume);
    return {
      trigger: (_note, dur, time, velocity) => synth.triggerAttackRelease(dur, time, velocity),
      dispose: () => {
        synth.dispose();
        channelVolume.dispose();
      },
    };
  }

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: channel.wave },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.25, release: 0.12 },
  }).connect(channelVolume);
  return {
    trigger: (note, dur, time, velocity) => synth.triggerAttackRelease(note, dur, time, velocity),
    dispose: () => {
      synth.dispose();
      channelVolume.dispose();
    },
  };
}

export class AudioEngine {
  private readonly musicBus: Tone.Volume;
  private readonly sfxBus: Tone.Volume;

  private musicVolume = 0.7;
  private sfxVolume = 0.8;
  private muted = false;
  private started = false;

  private parts: Tone.Part[] = [];
  private voices: ChannelVoice[] = [];
  private currentId: string | null = null;

  constructor() {
    this.musicBus = new Tone.Volume(Tone.gainToDb(this.musicVolume)).toDestination();
    this.sfxBus = new Tone.Volume(Tone.gainToDb(this.sfxVolume)).toDestination();
  }

  get isUnlocked(): boolean {
    return this.started;
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  setMusicVolume(value01: number): void {
    this.musicVolume = clamp01(value01);
    this.applyVolumes();
  }

  setSfxVolume(value01: number): void {
    this.sfxVolume = clamp01(value01);
    this.applyVolumes();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    this.musicBus.volume.rampTo(this.muted ? -Infinity : Tone.gainToDb(this.musicVolume), 0.06);
    this.sfxBus.volume.rampTo(this.muted ? -Infinity : Tone.gainToDb(this.sfxVolume), 0.06);
  }

  /** Play a looping track. Pass a stable `id` to avoid restarting the same
   *  track when called again (e.g. on re-navigation). */
  playTrack(track: ChiptuneTrack, id?: string): void {
    if (!this.started) return;
    if (id && id === this.currentId && this.parts.length > 0) return;
    this.stopMusic();
    this.currentId = id ?? null;

    Tone.getTransport().bpm.value = track.bpm;
    for (const channel of track.channels) {
      const voice = createVoice(channel, this.musicBus);
      const events = channel.steps.map((step) => ({
        time: step.time,
        note: step.note,
        dur: step.dur,
        velocity: step.velocity ?? 1,
      }));
      const part = new Tone.Part((time, value) => {
        const ev = value as (typeof events)[number];
        voice.trigger(ev.note, ev.dur, time, ev.velocity);
      }, events);
      part.loop = true;
      part.loopEnd = track.loopLength;
      part.start(0);
      this.parts.push(part);
      this.voices.push(voice);
    }
    Tone.getTransport().start();
  }

  stopMusic(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    for (const part of this.parts) part.dispose();
    for (const voice of this.voices) voice.dispose();
    this.parts = [];
    this.voices = [];
    this.currentId = null;
  }

  playSfx(def: SfxDef): void {
    if (!this.started) return;
    const voice = createVoice({ wave: def.wave, volumeDb: def.volumeDb ?? -6, steps: [] }, this.sfxBus);
    const base = Tone.now();
    let maxEnd = 0;
    def.notes.forEach((n, i) => {
      const offset = n.time ?? i * 0.06;
      voice.trigger(n.note, n.dur, base + offset, 1);
      maxEnd = Math.max(maxEnd, offset + 0.6);
    });
    // Dispose the transient voice once the sound has finished.
    setTimeout(() => voice.dispose(), Math.ceil(maxEnd * 1000) + 200);
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
