import type { GameMeta } from '@/types';

export const starDefenderMeta: GameMeta = {
  id: 'star-defender',
  titleKey: 'catalog:gameTitles.star-defender',
  descriptionKey: 'catalog:gameDescriptions.star-defender',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'points',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  actionButtons: [
    { id: 'fire', labelKey: 'starDefender:controls.fire', glyph: '⦿', accent: 'amber', mode: 'hold' },
    { id: 'nova', labelKey: 'starDefender:controls.nova', glyph: '✸', accent: 'violet', mode: 'tap' },
  ],
  howToPlayKey: 'starDefender:howToPlay',
  thumbnail: '👾',
  trophies: [
    {
      id: 'firstBlood',
      nameKey: 'starDefender:trophies.firstBlood.name',
      descriptionKey: 'starDefender:trophies.firstBlood.description',
      icon: '✨',
      condition: (c) => (c.stats.kills ?? 0) >= 1,
    },
    {
      id: 'vanguard',
      nameKey: 'starDefender:trophies.vanguard.name',
      descriptionKey: 'starDefender:trophies.vanguard.description',
      icon: '🛡️',
      condition: (c) => (c.stats.wave ?? 0) >= 3,
    },
    {
      id: 'nova',
      nameKey: 'starDefender:trophies.nova.name',
      descriptionKey: 'starDefender:trophies.nova.description',
      icon: '⚡',
      condition: (c) => (c.stats.novas ?? 0) >= 1,
    },
    {
      id: 'sharpshooter',
      nameKey: 'starDefender:trophies.sharpshooter.name',
      descriptionKey: 'starDefender:trophies.sharpshooter.description',
      icon: '🎯',
      condition: (c) => (c.stats.kills ?? 0) >= 100,
    },
    {
      id: 'highScore',
      nameKey: 'starDefender:trophies.highScore.name',
      descriptionKey: 'starDefender:trophies.highScore.description',
      icon: '👑',
      condition: (c) => c.score >= 10000,
    },
  ],
};
