import type { ChiptuneStep, ChiptuneTrack } from '@/types';

// The arcade's own menu theme — a warm Am–F–C–G loop (sunset mood). Built from
// data so it stays consistent with the game-provided track format.

const CHORDS: string[][] = [
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['C4', 'E4', 'G4'],
  ['G3', 'B3', 'D4'],
];
const ROOTS = ['A2', 'F2', 'C2', 'G2'];

const lead: ChiptuneStep[] = [];
const bass: ChiptuneStep[] = [];
const hat: ChiptuneStep[] = [];

for (let bar = 0; bar < 4; bar += 1) {
  const chord = CHORDS[bar] as string[];
  const root = ROOTS[bar] as string;
  for (let eighth = 0; eighth < 8; eighth += 1) {
    const beat = Math.floor(eighth / 2);
    const sixteenth = (eighth % 2) * 2;
    lead.push({
      time: `${bar}:${beat}:${sixteenth}`,
      note: chord[eighth % chord.length] as string,
      dur: '8n',
      velocity: eighth % 2 === 0 ? 0.7 : 0.5,
    });
    if (eighth % 2 === 1) {
      hat.push({ time: `${bar}:${beat}:${sixteenth}`, note: 'C5', dur: '16n', velocity: 0.4 });
    }
  }
  for (let beat = 0; beat < 4; beat += 1) {
    bass.push({ time: `${bar}:${beat}:0`, note: root, dur: '4n', velocity: 0.85 });
  }
}

export const SHELL_MENU_THEME: ChiptuneTrack = {
  bpm: 104,
  loopLength: '4m',
  channels: [
    { wave: 'square', volumeDb: -14, steps: lead },
    { wave: 'triangle', volumeDb: -8, steps: bass },
    { wave: 'noise', volumeDb: -26, steps: hat },
  ],
};
