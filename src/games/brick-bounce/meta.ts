import type { GameMeta, TrophyCondition } from '@/types';

const stat = (k: string) => (c: { stats: Readonly<Record<string, number>> }) => c.stats[k] ?? 0;

// [id, icon, condition] — kept compact; names/descriptions live in i18n under
// brickBounce:trophies.<id>.
const TROPHIES: Array<[string, string, TrophyCondition]> = [
  ['firstBrick', '✨', (c) => stat('bricks')(c) >= 1],
  ['demolisher', '🧱', (c) => stat('bricks')(c) >= 100],
  ['wrecker', '💥', (c) => stat('bricks')(c) >= 500],
  ['blazeRunner', '🔥', (c) => stat('blazes')(c) >= 1],
  ['clearOut', '🧹', (c) => stat('levelsCleared')(c) >= 1],
  ['veteran', '🛡️', (c) => stat('level')(c) >= 5],
  ['magpie', '🎁', (c) => stat('powerups')(c) >= 10],
  ['legend', '👑', (c) => c.score >= 10000],
];

export const brickBounceMeta: GameMeta = {
  id: 'brick-bounce',
  titleKey: 'catalog:gameTitles.brick-bounce',
  descriptionKey: 'catalog:gameDescriptions.brick-bounce',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'points',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  actionButtons: [
    { id: 'blaze', labelKey: 'brickBounce:controls.blaze', glyph: '🔥', accent: 'coral', mode: 'tap' },
  ],
  howToPlayKey: 'brickBounce:howToPlay',
  thumbnail: '🧱',
  trophies: TROPHIES.map(([id, icon, condition]) => ({
    id,
    nameKey: `brickBounce:trophies.${id}.name`,
    descriptionKey: `brickBounce:trophies.${id}.description`,
    icon,
    condition,
  })),
};
