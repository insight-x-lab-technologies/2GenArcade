import type { GameMeta } from '@/types';

export const snakeCoilMeta: GameMeta = {
  id: 'snake-coil',
  titleKey: 'catalog:gameTitles.snake-coil',
  descriptionKey: 'catalog:gameDescriptions.snake-coil',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'points',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  actionButtons: [
    { id: 'surge', labelKey: 'snakeCoil:controls.surge', glyph: '⚡', accent: 'violet', mode: 'tap' },
  ],
  howToPlayKey: 'snakeCoil:howToPlay',
  thumbnail: '🐍',
  trophies: [
    {
      id: 'firstOrb',
      nameKey: 'snakeCoil:trophies.firstOrb.name',
      descriptionKey: 'snakeCoil:trophies.firstOrb.description',
      icon: '✨',
      condition: (c) => (c.stats.orbs ?? 0) >= 1,
    },
    {
      id: 'combo',
      nameKey: 'snakeCoil:trophies.combo.name',
      descriptionKey: 'snakeCoil:trophies.combo.description',
      icon: '🔥',
      condition: (c) => (c.stats.maxCombo ?? 0) >= 5,
    },
    {
      id: 'surge',
      nameKey: 'snakeCoil:trophies.surge.name',
      descriptionKey: 'snakeCoil:trophies.surge.description',
      icon: '⚡',
      condition: (c) => (c.stats.surges ?? 0) >= 1,
    },
    {
      id: 'longCoil',
      nameKey: 'snakeCoil:trophies.longCoil.name',
      descriptionKey: 'snakeCoil:trophies.longCoil.description',
      icon: '🐍',
      condition: (c) => (c.stats.length ?? 0) >= 25,
    },
    {
      id: 'highScore',
      nameKey: 'snakeCoil:trophies.highScore.name',
      descriptionKey: 'snakeCoil:trophies.highScore.description',
      icon: '👑',
      condition: (c) => c.score >= 5000,
    },
    {
      id: 'pathfinder',
      nameKey: 'snakeCoil:trophies.pathfinder.name',
      descriptionKey: 'snakeCoil:trophies.pathfinder.description',
      icon: '🧭',
      condition: (c) => (c.stats.hazardOrbs ?? 0) >= 12,
    },
  ],
};
