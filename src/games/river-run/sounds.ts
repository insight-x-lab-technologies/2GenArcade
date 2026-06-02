import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// River Run's chiptune: an airy menu loop and a driving gameplay loop in E
// minor (distinct from Block Drop's A minor and Snake Coil's D minor), plus
// shooter SFX (laser, explosion, fuel, boost).

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
  bpm: 100,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['E2', 'C2', 'G2', 'D2']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp([['E4', 'G4', 'B4'], ['C4', 'E4', 'G4'], ['G4', 'B4', 'D5'], ['D4', 'F#4', 'A4']], '8n'),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 148,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['E2', 'E2', 'C2', 'D2']) },
    {
      wave: 'square',
      volumeDb: -18,
      steps: buildArp(
        [['E4', 'B4', 'E5'], ['G4', 'D5', 'G5'], ['C4', 'G4', 'C5'], ['D4', 'A4', 'D5']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -24,
      steps: Array.from({ length: 16 }, (_, i) => ({
        time: `${Math.floor(i / 4)}:${i % 4}:2`,
        note: 'E5',
        dur: '16n',
        velocity: 0.3,
      })),
    },
  ],
};

const sfx: Record<string, SfxDef> = {
  shoot: { wave: 'square', volumeDb: -22, notes: [{ note: 'E6', dur: '32n' }] },
  explosion: {
    wave: 'noise',
    volumeDb: -10,
    notes: [
      { note: 'E3', dur: '16n', time: 0 },
      { note: 'C3', dur: '16n', time: 0.05 },
      { note: 'E2', dur: '8n', time: 0.1 },
    ],
  },
  fuel: {
    wave: 'triangle',
    volumeDb: -12,
    notes: [
      { note: 'B4', dur: '16n', time: 0 },
      { note: 'E5', dur: '16n', time: 0.06 },
      { note: 'B5', dur: '8n', time: 0.12 },
    ],
  },
  boost: {
    wave: 'sawtooth',
    volumeDb: -10,
    notes: [
      { note: 'E3', dur: '16n', time: 0 },
      { note: 'B3', dur: '16n', time: 0.06 },
      { note: 'E4', dur: '8n', time: 0.12 },
    ],
  },
  powerup: {
    wave: 'square',
    volumeDb: -13,
    notes: [
      { note: 'E5', dur: '16n', time: 0 },
      { note: 'B5', dur: '16n', time: 0.05 },
      { note: 'E6', dur: '8n', time: 0.1 },
    ],
  },
  enemyShoot: {
    wave: 'square',
    volumeDb: -24,
    notes: [{ note: 'A3', dur: '32n' }],
  },
  bigHit: {
    wave: 'square',
    volumeDb: -20,
    notes: [{ note: 'C4', dur: '32n' }],
  },
  bigBoom: {
    wave: 'noise',
    volumeDb: -7,
    notes: [
      { note: 'E2', dur: '16n', time: 0 },
      { note: 'C2', dur: '8n', time: 0.06 },
      { note: 'E1', dur: '4n', time: 0.14 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -9,
    notes: [
      { note: 'E4', dur: '8n', time: 0 },
      { note: 'C4', dur: '8n', time: 0.16 },
      { note: 'A3', dur: '8n', time: 0.32 },
      { note: 'E3', dur: '4n', time: 0.48 },
    ],
  },
};

export const riverRunSounds: GameSoundKit = { menu, gameplay, sfx };
