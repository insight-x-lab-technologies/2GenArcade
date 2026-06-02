import type { GameMeta, TrophyCondition, TrophyDef } from '@/types';

// 30 trophies. Defined compactly as [id, icon, condition] and expanded to the
// declarative TrophyDef shape (the i18n keys follow the id by convention).
const stat = (k: string) => (c: Parameters<TrophyCondition>[0]) => c.stats[k] ?? 0;

const TROPHIES: Array<[string, string, TrophyCondition]> = [
  // Kills.
  ['firstKill', '✨', (c) => stat('kills')(c) >= 1],
  ['ace', '🔥', (c) => stat('kills')(c) >= 25],
  ['exterminator', '💀', (c) => stat('kills')(c) >= 100],
  // Big ships.
  ['giantSlayer', '🗡️', (c) => stat('bigKills')(c) >= 1],
  ['juggernaut', '🛸', (c) => stat('bigKills')(c) >= 8],
  // Distance.
  ['voyager', '🏁', (c) => stat('distance')(c) >= 2000],
  ['wayfarer', '🧭', (c) => stat('distance')(c) >= 6000],
  ['odyssey', '🪐', (c) => stat('distance')(c) >= 15000],
  // Score.
  ['highScore', '👑', (c) => c.score >= 8000],
  ['marksman', '⭐', (c) => c.score >= 20000],
  ['legend', '🏆', (c) => c.score >= 50000],
  // Throttle + fuel.
  ['afterburner', '⚡', (c) => stat('boosts')(c) >= 1],
  ['topUp', '⛽', (c) => stat('fuel')(c) >= 1],
  ['collector', '🎁', (c) => stat('powerups')(c) >= 1],
  // Power-up first uses (10).
  ['ironclad', '🛡️', (c) => stat('usedShield')(c) >= 1],
  ['lightspeed', '🚀', (c) => stat('usedSuperSpeed')(c) >= 1],
  ['twinGuns', '🔫', (c) => stat('usedDouble')(c) >= 1],
  ['trident', '🔱', (c) => stat('usedTriple')(c) >= 1],
  ['stormFire', '🌩️', (c) => stat('usedRapid')(c) >= 1],
  ['railgun', '🎯', (c) => stat('usedPierce')(c) >= 1],
  ['tractor', '🧲', (c) => stat('usedMagnet')(c) >= 1],
  ['bulletTime', '⏳', (c) => stat('usedSlow')(c) >= 1],
  ['jackpot', '✦', (c) => stat('usedScoreX2')(c) >= 1],
  ['recycler', '♻️', (c) => stat('usedRegen')(c) >= 1],
  // Biomes (5).
  ['cityRunner', '🏙️', (c) => stat('city')(c) >= 1],
  ['forestRunner', '🌲', (c) => stat('forest')(c) >= 1],
  ['mountaineer', '⛰️', (c) => stat('mountains')(c) >= 1],
  ['seafarer', '🌊', (c) => stat('ocean')(c) >= 1],
  ['astronaut', '🌌', (c) => stat('space')(c) >= 1],
  // Time of day.
  ['nightOwl', '🌙', (c) => stat('night')(c) >= 1],
];

const trophies: TrophyDef[] = TROPHIES.map(([id, icon, condition]) => ({
  id,
  nameKey: `riverRun:trophies.${id}.name`,
  descriptionKey: `riverRun:trophies.${id}.description`,
  icon,
  condition,
}));

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
  trophies,
};
