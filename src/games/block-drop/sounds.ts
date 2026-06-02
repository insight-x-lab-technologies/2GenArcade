import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// Block Drop's own chiptune: a calm menu loop and a driving gameplay loop, both
// in A minor to match the sunset palette, plus event SFX.

const buildBass = (roots: string[]): ChiptuneStep[] => {
  const steps: ChiptuneStep[] = [];
  roots.forEach((root, bar) => {
    for (let beat = 0; beat < 4; beat += 1) {
      steps.push({ time: `${bar}:${beat}:0`, note: root, dur: '8n', velocity: 0.85 });
    }
  });
  return steps;
};

const buildArp = (chords: string[][], stepDur: '8n' | '16n'): ChiptuneStep[] => {
  const steps: ChiptuneStep[] = [];
  const per = stepDur === '16n' ? 16 : 8;
  chords.forEach((chord, bar) => {
    for (let i = 0; i < per; i += 1) {
      const beat = Math.floor((i / per) * 4);
      const sixteenth = Math.round(((i / per) * 4 - beat) * 4);
      steps.push({
        time: `${bar}:${beat}:${sixteenth}`,
        note: chord[i % chord.length] as string,
        dur: stepDur,
        velocity: i % 2 === 0 ? 0.6 : 0.4,
      });
    }
  });
  return steps;
};

const menu: ChiptuneTrack = {
  bpm: 96,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['A2', 'F2', 'C3', 'E2']) },
    {
      wave: 'square',
      volumeDb: -16,
      steps: buildArp([['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['C5', 'E5', 'G5'], ['E4', 'G4', 'B4']], '8n'),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 140,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['A2', 'A2', 'F2', 'G2']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp(
        [['A4', 'E5', 'A5'], ['C5', 'G5', 'C6'], ['F4', 'C5', 'F5'], ['G4', 'D5', 'G5']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -24,
      steps: Array.from({ length: 16 }, (_, i) => ({
        time: `${Math.floor(i / 4)}:${i % 4}:2`,
        note: 'C5',
        dur: '16n',
        velocity: 0.3,
      })),
    },
  ],
};

const sfx: Record<string, SfxDef> = {
  move: { wave: 'square', volumeDb: -18, notes: [{ note: 'C5', dur: '32n' }] },
  rotate: { wave: 'triangle', volumeDb: -14, notes: [{ note: 'E5', dur: '32n' }] },
  lock: { wave: 'square', volumeDb: -14, notes: [{ note: 'C3', dur: '16n' }] },
  drop: { wave: 'sawtooth', volumeDb: -14, notes: [{ note: 'A2', dur: '16n' }] },
  clear: {
    wave: 'square',
    volumeDb: -10,
    notes: [
      { note: 'C5', dur: '16n', time: 0 },
      { note: 'E5', dur: '16n', time: 0.07 },
      { note: 'G5', dur: '16n', time: 0.14 },
      { note: 'C6', dur: '8n', time: 0.21 },
    ],
  },
  overdrive: {
    wave: 'sawtooth',
    volumeDb: -8,
    notes: [
      { note: 'A4', dur: '16n', time: 0 },
      { note: 'C5', dur: '16n', time: 0.06 },
      { note: 'E5', dur: '16n', time: 0.12 },
      { note: 'A5', dur: '4n', time: 0.18 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -10,
    notes: [
      { note: 'A4', dur: '8n', time: 0 },
      { note: 'F4', dur: '8n', time: 0.16 },
      { note: 'D4', dur: '8n', time: 0.32 },
      { note: 'A3', dur: '4n', time: 0.48 },
    ],
  },
};

export const blockDropSounds: GameSoundKit = { menu, gameplay, sfx };
