import type { GameMeta } from '@/types';

export const roadBurnerMeta: GameMeta = {
  id: 'road-burner',
  titleKey: 'catalog:gameTitles.road-burner',
  descriptionKey: 'catalog:gameDescriptions.road-burner',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'distance',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  howToPlayKey: 'roadBurner:howToPlay',
  thumbnail: '🏎️',
  trophies: [
    {
      id: 'firstPass',
      nameKey: 'roadBurner:trophies.firstPass.name',
      descriptionKey: 'roadBurner:trophies.firstPass.description',
      icon: '✨',
      condition: (c) => (c.stats.passes ?? 0) >= 1,
    },
    {
      id: 'overtaker',
      nameKey: 'roadBurner:trophies.overtaker.name',
      descriptionKey: 'roadBurner:trophies.overtaker.description',
      icon: '🔥',
      condition: (c) => (c.stats.passes ?? 0) >= 50,
    },
    {
      id: 'burnout',
      nameKey: 'roadBurner:trophies.burnout.name',
      descriptionKey: 'roadBurner:trophies.burnout.description',
      icon: '⚡',
      condition: (c) => (c.stats.nitros ?? 0) >= 1,
    },
    {
      id: 'roadster',
      nameKey: 'roadBurner:trophies.roadster.name',
      descriptionKey: 'roadBurner:trophies.roadster.description',
      icon: '🏁',
      condition: (c) => (c.stats.distance ?? 0) >= 2000,
    },
    {
      id: 'highScore',
      nameKey: 'roadBurner:trophies.highScore.name',
      descriptionKey: 'roadBurner:trophies.highScore.description',
      icon: '👑',
      condition: (c) => c.score >= 8000,
    },
  ],
};
