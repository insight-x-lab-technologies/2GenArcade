import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// Star Defender's chiptune: a watchful menu loop and a tense, marching gameplay
// loop in B minor (distinct from Block Drop's A minor, Snake Coil's D minor,
// River Run's E minor and Road Burner's C minor), plus fixed-shooter SFX.

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
  bpm: 98,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['B1', 'G2', 'A2', 'F#2']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp([['B3', 'D4', 'F#4'], ['G3', 'B3', 'D4'], ['A3', 'C#4', 'E4'], ['F#3', 'A3', 'C#4']], '8n'),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 150,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['B1', 'B1', 'G1', 'A1']) },
    {
      wave: 'square',
      volumeDb: -18,
      steps: buildArp(
        [['B3', 'F#4', 'B4'], ['D4', 'A4', 'D5'], ['G3', 'D4', 'G4'], ['A3', 'E4', 'A4']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -24,
      steps: Array.from({ length: 16 }, (_, i) => ({
        time: `${Math.floor(i / 4)}:${i % 4}:2`,
        note: 'B4',
        dur: '16n',
        velocity: 0.3,
      })),
    },
  ],
};

const sfx: Record<string, SfxDef> = {
  shoot: { wave: 'square', volumeDb: -24, notes: [{ note: 'B5', dur: '32n' }] },
  explosion: {
    wave: 'noise',
    volumeDb: -12,
    notes: [
      { note: 'B3', dur: '16n', time: 0 },
      { note: 'F#3', dur: '16n', time: 0.04 },
      { note: 'B2', dur: '8n', time: 0.09 },
    ],
  },
  hit: {
    wave: 'sawtooth',
    volumeDb: -10,
    notes: [
      { note: 'B3', dur: '16n', time: 0 },
      { note: 'F#2', dur: '8n', time: 0.06 },
    ],
  },
  nova: {
    wave: 'square',
    volumeDb: -9,
    notes: [
      { note: 'B4', dur: '16n', time: 0 },
      { note: 'D5', dur: '16n', time: 0.05 },
      { note: 'F#5', dur: '16n', time: 0.1 },
      { note: 'B5', dur: '8n', time: 0.15 },
    ],
  },
  wave: {
    wave: 'triangle',
    volumeDb: -11,
    notes: [
      { note: 'F#4', dur: '16n', time: 0 },
      { note: 'A4', dur: '16n', time: 0.08 },
      { note: 'B4', dur: '8n', time: 0.16 },
    ],
  },
  powerup: {
    wave: 'square',
    volumeDb: -13,
    notes: [
      { note: 'B4', dur: '16n', time: 0 },
      { note: 'F#5', dur: '16n', time: 0.05 },
      { note: 'B5', dur: '8n', time: 0.1 },
    ],
  },
  life: {
    wave: 'triangle',
    volumeDb: -11,
    notes: [
      { note: 'D5', dur: '16n', time: 0 },
      { note: 'F#5', dur: '16n', time: 0.06 },
      { note: 'A5', dur: '16n', time: 0.12 },
      { note: 'D6', dur: '8n', time: 0.18 },
    ],
  },
  bossHit: { wave: 'square', volumeDb: -26, notes: [{ note: 'E3', dur: '32n' }] },
  bossBoom: {
    wave: 'noise',
    volumeDb: -6,
    notes: [
      { note: 'B2', dur: '16n', time: 0 },
      { note: 'F#2', dur: '8n', time: 0.07 },
      { note: 'B1', dur: '4n', time: 0.16 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -9,
    notes: [
      { note: 'B4', dur: '8n', time: 0 },
      { note: 'G3', dur: '8n', time: 0.16 },
      { note: 'F#3', dur: '8n', time: 0.32 },
      { note: 'B2', dur: '4n', time: 0.48 },
    ],
  },
};

export const starDefenderSounds: GameSoundKit = { menu, gameplay, sfx };
