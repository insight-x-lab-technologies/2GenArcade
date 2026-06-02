import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// Road Burner's chiptune: a moody menu loop and a fast, driving gameplay loop in
// C minor (distinct from Block Drop's A minor, Snake Coil's D minor and River
// Run's E minor), plus racing SFX (pass whoosh, nitro ignite, crash).

const buildBass = (roots: string[]): ChiptuneStep[] => {
  const steps: ChiptuneStep[] = [];
  roots.forEach((root, bar) => {
    for (let beat = 0; beat < 4; beat += 1) {
      steps.push({ time: `${bar}:${beat}:0`, note: root, dur: '8n', velocity: 0.82 });
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
        velocity: i % 2 === 0 ? 0.55 : 0.36,
      });
    }
  });
  return steps;
};

const menu: ChiptuneTrack = {
  bpm: 104,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['C2', 'G2', 'A2', 'F2']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp([['C4', 'Eb4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4']], '8n'),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 156,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['C2', 'C2', 'Ab1', 'Bb1']) },
    {
      wave: 'square',
      volumeDb: -18,
      steps: buildArp(
        [['C4', 'G4', 'C5'], ['Eb4', 'Bb4', 'Eb5'], ['Ab3', 'Eb4', 'Ab4'], ['Bb3', 'F4', 'Bb4']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -23,
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
  pass: {
    wave: 'triangle',
    volumeDb: -16,
    notes: [
      { note: 'G5', dur: '32n', time: 0 },
      { note: 'C6', dur: '32n', time: 0.04 },
    ],
  },
  nitro: {
    wave: 'sawtooth',
    volumeDb: -9,
    notes: [
      { note: 'C3', dur: '16n', time: 0 },
      { note: 'G3', dur: '16n', time: 0.06 },
      { note: 'C4', dur: '16n', time: 0.12 },
      { note: 'G4', dur: '8n', time: 0.18 },
    ],
  },
  crash: {
    wave: 'noise',
    volumeDb: -8,
    notes: [
      { note: 'C3', dur: '16n', time: 0 },
      { note: 'Ab2', dur: '16n', time: 0.05 },
      { note: 'C2', dur: '8n', time: 0.1 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -9,
    notes: [
      { note: 'C4', dur: '8n', time: 0 },
      { note: 'Ab3', dur: '8n', time: 0.16 },
      { note: 'F3', dur: '8n', time: 0.32 },
      { note: 'C3', dur: '4n', time: 0.48 },
    ],
  },
};

export const roadBurnerSounds: GameSoundKit = { menu, gameplay, sfx };
