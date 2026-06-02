import type { GameMeta } from '@/types';

export const blockDropMeta: GameMeta = {
  id: 'block-drop',
  titleKey: 'catalog:gameTitles.block-drop',
  descriptionKey: 'catalog:gameDescriptions.block-drop',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'points',
  scoreIsEndless: true,
  controlScheme: 'swipe',
  howToPlayKey: 'blockDrop:howToPlay',
  thumbnail: '🟧',
  trophies: [
    {
      id: 'firstLines',
      nameKey: 'blockDrop:trophies.firstLines.name',
      descriptionKey: 'blockDrop:trophies.firstLines.description',
      icon: '✨',
      condition: (c) => (c.stats.lines ?? 0) >= 1,
    },
    {
      id: 'comboMaster',
      nameKey: 'blockDrop:trophies.comboMaster.name',
      descriptionKey: 'blockDrop:trophies.comboMaster.description',
      icon: '🔥',
      condition: (c) => (c.stats.maxClear ?? 0) >= 4,
    },
    {
      id: 'overdrive',
      nameKey: 'blockDrop:trophies.overdrive.name',
      descriptionKey: 'blockDrop:trophies.overdrive.description',
      icon: '⚡',
      condition: (c) => (c.stats.overdrives ?? 0) >= 1,
    },
    {
      id: 'survivor',
      nameKey: 'blockDrop:trophies.survivor.name',
      descriptionKey: 'blockDrop:trophies.survivor.description',
      icon: '🛡️',
      condition: (c) => (c.stats.level ?? 0) >= 8,
    },
    {
      id: 'highScore',
      nameKey: 'blockDrop:trophies.highScore.name',
      descriptionKey: 'blockDrop:trophies.highScore.description',
      icon: '👑',
      condition: (c) => c.score >= 20000,
    },
  ],
};
