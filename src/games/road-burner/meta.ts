import type { GameMeta, TrophyCondition, TrophyDef } from '@/types';

// 30 trophies. Defined compactly as [id, icon, condition] and expanded to the
// declarative TrophyDef shape (the i18n keys follow the id by convention).
const stat = (k: string) => (c: Parameters<TrophyCondition>[0]) => c.stats[k] ?? 0;

const TROPHIES: Array<[string, string, TrophyCondition]> = [
  // Near-miss overtakes.
  ['firstPass', '✨', (c) => stat('passes')(c) >= 1],
  ['overtaker', '🔥', (c) => stat('passes')(c) >= 50],
  ['slipstream', '💨', (c) => stat('passes')(c) >= 150],
  ['untouchable', '🎯', (c) => stat('passes')(c) >= 300],
  // Distance.
  ['roadster', '🏁', (c) => stat('distance')(c) >= 2000],
  ['voyager', '🛣️', (c) => stat('distance')(c) >= 5000],
  ['marathoner', '🌌', (c) => stat('distance')(c) >= 10000],
  ['odyssey', '🪐', (c) => stat('distance')(c) >= 20000],
  // Nitro.
  ['burnout', '⚡', (c) => stat('nitros')(c) >= 1],
  ['pyromaniac', '🧨', (c) => stat('nitros')(c) >= 10],
  ['infernal', '😈', (c) => stat('nitros')(c) >= 25],
  // Score.
  ['highScore', '👑', (c) => c.score >= 8000],
  ['ace', '⭐', (c) => c.score >= 20000],
  ['legend', '🏆', (c) => c.score >= 50000],
  // Power-up collection.
  ['collector', '🎁', (c) => stat('powerups')(c) >= 1],
  ['magpie', '🧺', (c) => stat('powerups')(c) >= 15],
  ['hoarder', '💎', (c) => stat('powerups')(c) >= 40],
  // Power-up first uses.
  ['shielded', '🛡️', (c) => stat('usedShield')(c) >= 1],
  ['supersonic', '🚀', (c) => stat('usedTurbo')(c) >= 1],
  ['timebender', '⏳', (c) => stat('usedSlow')(c) >= 1],
  ['doubler', '✦', (c) => stat('usedDouble')(c) >= 1],
  ['overcharged', '🔋', (c) => stat('usedSurge')(c) >= 1],
  ['compact', '🔻', (c) => stat('usedMini')(c) >= 1],
  ['gripmaster', '🛞', (c) => stat('usedGrip')(c) >= 1],
  ['sweeper', '🧹', (c) => stat('usedSweep')(c) >= 1],
  // Terrains.
  ['mudder', '🟫', (c) => stat('mud')(c) >= 1],
  ['snowdrifter', '❄️', (c) => stat('snow')(c) >= 1],
  ['rainman', '🌧️', (c) => stat('rain')(c) >= 1],
  // Time of day.
  ['nightrider', '🌙', (c) => stat('night')(c) >= 1],
  // Big vehicles.
  ['trucker', '🚚', (c) => stat('bigPasses')(c) >= 20],
];

const trophies: TrophyDef[] = TROPHIES.map(([id, icon, condition]) => ({
  id,
  nameKey: `roadBurner:trophies.${id}.name`,
  descriptionKey: `roadBurner:trophies.${id}.description`,
  icon,
  condition,
}));

export const roadBurnerMeta: GameMeta = {
  id: 'road-burner',
  titleKey: 'catalog:gameTitles.road-burner',
  descriptionKey: 'catalog:gameDescriptions.road-burner',
  packId: 'pack-base',
  orientation: 'portrait',
  scoreType: 'distance',
  scoreIsEndless: true,
  controlScheme: 'dpad',
  actionButtons: [
    { id: 'nitro', labelKey: 'roadBurner:controls.nitro', glyph: '⚡', accent: 'amber', mode: 'tap' },
    { id: 'dash', labelKey: 'roadBurner:controls.dash', glyph: '⇄', accent: 'violet', mode: 'tap' },
  ],
  howToPlayKey: 'roadBurner:howToPlay',
  thumbnail: '🏎️',
  trophies,
};
