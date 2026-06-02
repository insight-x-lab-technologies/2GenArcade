import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// Snake Coil's chiptune: a slinky menu loop and a propulsive gameplay loop in
// D minor (a different key/feel from Block Drop's A minor), plus event SFX.

const buildBass = (roots: string[]): ChiptuneStep[] => {
  const steps: ChiptuneStep[] = [];
  roots.forEach((root, bar) => {
    for (let beat = 0; beat < 4; beat += 1) {
      steps.push({ time: `${bar}:${beat}:0`, note: root, dur: '8n', velocity: 0.8 });
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
        velocity: i % 2 === 0 ? 0.55 : 0.38,
      });
    }
  });
  return steps;
};

const menu: ChiptuneTrack = {
  bpm: 104,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['D2', 'Bb1', 'F2', 'A1']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp([['D4', 'F4', 'A4'], ['Bb3', 'D4', 'F4'], ['F4', 'A4', 'C5'], ['A3', 'C4', 'E4']], '8n'),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 132,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['D2', 'D2', 'Bb1', 'C2']) },
    {
      wave: 'square',
      volumeDb: -18,
      steps: buildArp(
        [['D4', 'A4', 'D5'], ['F4', 'C5', 'F5'], ['Bb3', 'F4', 'Bb4'], ['C4', 'G4', 'C5']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -25,
      steps: Array.from({ length: 16 }, (_, i) => ({
        time: `${Math.floor(i / 4)}:${i % 4}:2`,
        note: 'D5',
        dur: '16n',
        velocity: 0.28,
      })),
    },
  ],
};

const sfx: Record<string, SfxDef> = {
  turn: { wave: 'square', volumeDb: -22, notes: [{ note: 'D5', dur: '32n' }] },
  eat: {
    wave: 'square',
    volumeDb: -12,
    notes: [
      { note: 'D5', dur: '32n', time: 0 },
      { note: 'A5', dur: '16n', time: 0.05 },
    ],
  },
  prism: {
    wave: 'triangle',
    volumeDb: -10,
    notes: [
      { note: 'D5', dur: '16n', time: 0 },
      { note: 'F5', dur: '16n', time: 0.06 },
      { note: 'A5', dur: '16n', time: 0.12 },
      { note: 'D6', dur: '8n', time: 0.18 },
    ],
  },
  surge: {
    wave: 'sawtooth',
    volumeDb: -8,
    notes: [
      { note: 'D4', dur: '16n', time: 0 },
      { note: 'A4', dur: '16n', time: 0.06 },
      { note: 'D5', dur: '16n', time: 0.12 },
      { note: 'A5', dur: '4n', time: 0.18 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -10,
    notes: [
      { note: 'D4', dur: '8n', time: 0 },
      { note: 'A3', dur: '8n', time: 0.16 },
      { note: 'F3', dur: '8n', time: 0.32 },
      { note: 'D3', dur: '4n', time: 0.48 },
    ],
  },
};

export const snakeCoilSounds: GameSoundKit = { menu, gameplay, sfx };
