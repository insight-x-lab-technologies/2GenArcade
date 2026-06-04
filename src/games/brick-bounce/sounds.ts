import type { ChiptuneStep, ChiptuneTrack, GameSoundKit, SfxDef } from '@/types';

// Brick Bounce's chiptune: a playful menu loop and a bouncy gameplay loop in
// G major — a bright major key deliberately set apart from the five minor-key
// games (Block Drop A minor, Snake Coil D minor, River Run E minor, Road Burner
// C minor, Star Defender B minor) to match the springy, arcade feel — plus
// percussive breakout SFX.

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
        velocity: i % 2 === 0 ? 0.52 : 0.34,
      });
    }
  });
  return steps;
};

const menu: ChiptuneTrack = {
  bpm: 104,
  loopLength: '4m',
  channels: [
    { wave: 'triangle', volumeDb: -9, steps: buildBass(['G2', 'E2', 'C2', 'D2']) },
    {
      wave: 'square',
      volumeDb: -17,
      steps: buildArp(
        [['G3', 'B3', 'D4'], ['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['D3', 'F#3', 'A3']],
        '8n',
      ),
    },
  ],
};

const gameplay: ChiptuneTrack = {
  bpm: 142,
  loopLength: '4m',
  channels: [
    { wave: 'sawtooth', volumeDb: -12, steps: buildBass(['G1', 'D2', 'E2', 'C2']) },
    {
      wave: 'square',
      volumeDb: -18,
      steps: buildArp(
        [['G3', 'D4', 'G4'], ['B3', 'D4', 'G4'], ['C4', 'E4', 'G4'], ['A3', 'D4', 'F#4']],
        '16n',
      ),
    },
    {
      wave: 'noise',
      volumeDb: -25,
      steps: Array.from({ length: 16 }, (_, i) => ({
        time: `${Math.floor(i / 4)}:${i % 4}:2`,
        note: 'G4',
        dur: '16n',
        velocity: 0.28,
      })),
    },
  ],
};

const sfx: Record<string, SfxDef> = {
  // Paddle bounce: a short, springy blip.
  paddle: { wave: 'square', volumeDb: -16, notes: [{ note: 'G4', dur: '32n' }] },
  // Wall ping: higher, drier.
  wall: { wave: 'triangle', volumeDb: -20, notes: [{ note: 'D5', dur: '32n' }] },
  // Brick chipped (survives the hit).
  brickHit: { wave: 'square', volumeDb: -18, notes: [{ note: 'B4', dur: '32n' }] },
  // Brick destroyed.
  brickBreak: {
    wave: 'square',
    volumeDb: -13,
    notes: [
      { note: 'G5', dur: '32n', time: 0 },
      { note: 'D5', dur: '16n', time: 0.04 },
    ],
  },
  powerup: {
    wave: 'triangle',
    volumeDb: -11,
    notes: [
      { note: 'G4', dur: '16n', time: 0 },
      { note: 'B4', dur: '16n', time: 0.06 },
      { note: 'D5', dur: '8n', time: 0.12 },
    ],
  },
  bolt: { wave: 'sawtooth', volumeDb: -20, notes: [{ note: 'A5', dur: '32n' }] },
  blaze: {
    wave: 'square',
    volumeDb: -9,
    notes: [
      { note: 'D5', dur: '16n', time: 0 },
      { note: 'G5', dur: '16n', time: 0.05 },
      { note: 'B5', dur: '16n', time: 0.1 },
      { note: 'D6', dur: '8n', time: 0.15 },
    ],
  },
  levelClear: {
    wave: 'triangle',
    volumeDb: -10,
    notes: [
      { note: 'G4', dur: '16n', time: 0 },
      { note: 'C5', dur: '16n', time: 0.1 },
      { note: 'E5', dur: '16n', time: 0.2 },
      { note: 'G5', dur: '4n', time: 0.3 },
    ],
  },
  life: {
    wave: 'sawtooth',
    volumeDb: -11,
    notes: [
      { note: 'D4', dur: '16n', time: 0 },
      { note: 'G3', dur: '8n', time: 0.08 },
    ],
  },
  gameover: {
    wave: 'sawtooth',
    volumeDb: -9,
    notes: [
      { note: 'G4', dur: '8n', time: 0 },
      { note: 'E4', dur: '8n', time: 0.16 },
      { note: 'C4', dur: '8n', time: 0.32 },
      { note: 'G3', dur: '4n', time: 0.48 },
    ],
  },
};

export const brickBounceSounds: GameSoundKit = { menu, gameplay, sfx };
