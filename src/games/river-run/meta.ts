import type { GameMeta } from '@/types';

export const riverRunMeta: GameMeta = {
  id: 'river-run',
  titleKey: 'catalog:gameTitles.river-run',
  descriptionKey: 'catalog:gameDescriptions.river-run',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'distance',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  howToPlayKey: 'riverRun:howToPlay',
  thumbnail: '🛩️',
  trophies: [
    {
      id: 'firstKill',
      nameKey: 'riverRun:trophies.firstKill.name',
      descriptionKey: 'riverRun:trophies.firstKill.description',
      icon: '✨',
      condition: (c) => (c.stats.kills ?? 0) >= 1,
    },
    {
      id: 'ace',
      nameKey: 'riverRun:trophies.ace.name',
      descriptionKey: 'riverRun:trophies.ace.description',
      icon: '🔥',
      condition: (c) => (c.stats.kills ?? 0) >= 25,
    },
    {
      id: 'afterburner',
      nameKey: 'riverRun:trophies.afterburner.name',
      descriptionKey: 'riverRun:trophies.afterburner.description',
      icon: '⚡',
      condition: (c) => (c.stats.boosts ?? 0) >= 1,
    },
    {
      id: 'voyager',
      nameKey: 'riverRun:trophies.voyager.name',
      descriptionKey: 'riverRun:trophies.voyager.description',
      icon: '🏁',
      condition: (c) => (c.stats.distance ?? 0) >= 2000,
    },
    {
      id: 'highScore',
      nameKey: 'riverRun:trophies.highScore.name',
      descriptionKey: 'riverRun:trophies.highScore.description',
      icon: '👑',
      condition: (c) => c.score >= 8000,
    },
  ],
};
