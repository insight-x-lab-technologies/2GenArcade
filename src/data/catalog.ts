import type { GameModuleFactory } from '@/types';
import { getPackForGame } from './packs';

export type AccentColor = 'amber' | 'violet' | 'coral';

/** A game tile in the arcade. `available` games can be loaded and played;
 *  `planned` games are listed (the contract is ready) but not yet built. */
export interface CatalogGame {
  id: string;
  packId: string;
  titleKey: string;
  thumbnail: string;
  accent: AccentColor;
  status: 'available' | 'planned';
  /** Lazy loader for available games. */
  load?: () => Promise<GameModuleFactory>;
}

const titleKey = (id: string): string => `catalog:gameTitles.${id}`;

// Display metadata for every planned game (glyph + accent) so the Home grid
// looks complete. Only Block Drop ships a real module in this phase.
const PLANNED: Array<{ id: string; thumbnail: string; accent: AccentColor }> = [
  { id: 'maze-muncher', thumbnail: '😋', accent: 'amber' },
  { id: 'frog-crossing', thumbnail: '🐸', accent: 'violet' },
  { id: 'cannon-duel', thumbnail: '💥', accent: 'coral' },
  { id: 'bug-blaster', thumbnail: '🐛', accent: 'amber' },
  { id: 'asteroid-drift', thumbnail: '☄️', accent: 'violet' },
  { id: 'paddle-clash', thumbnail: '🏓', accent: 'coral' },
  { id: 'match-cascade', thumbnail: '💎', accent: 'amber' },
  { id: 'pipe-flow', thumbnail: '🔧', accent: 'violet' },
  { id: 'light-flip', thumbnail: '💡', accent: 'coral' },
  { id: 'sliding-tiles', thumbnail: '🔢', accent: 'amber' },
  { id: 'sky-hopper', thumbnail: '🦘', accent: 'violet' },
  { id: 'cave-flyer', thumbnail: '🦇', accent: 'coral' },
  { id: 'tower-stack', thumbnail: '🏗️', accent: 'amber' },
  { id: 'dodge-storm', thumbnail: '🌪️', accent: 'violet' },
];

export const CATALOG: CatalogGame[] = [
  {
    id: 'block-drop',
    packId: 'pack-base',
    titleKey: titleKey('block-drop'),
    thumbnail: '🟧',
    accent: 'amber',
    status: 'available',
    load: () => import('@/games/block-drop').then((m) => m.blockDropFactory),
  },
  {
    id: 'snake-coil',
    packId: 'pack-base',
    titleKey: titleKey('snake-coil'),
    thumbnail: '🐍',
    accent: 'violet',
    status: 'available',
    load: () => import('@/games/snake-coil').then((m) => m.snakeCoilFactory),
  },
  {
    id: 'river-run',
    packId: 'pack-base',
    titleKey: titleKey('river-run'),
    thumbnail: '🛩️',
    accent: 'amber',
    status: 'available',
    load: () => import('@/games/river-run').then((m) => m.riverRunFactory),
  },
  {
    id: 'road-burner',
    packId: 'pack-base',
    titleKey: titleKey('road-burner'),
    thumbnail: '🏎️',
    accent: 'coral',
    status: 'available',
    load: () => import('@/games/road-burner').then((m) => m.roadBurnerFactory),
  },
  {
    id: 'star-defender',
    packId: 'pack-base',
    titleKey: titleKey('star-defender'),
    thumbnail: '👾',
    accent: 'violet',
    status: 'available',
    load: () => import('@/games/star-defender').then((m) => m.starDefenderFactory),
  },
  {
    id: 'brick-bounce',
    packId: 'pack-base',
    titleKey: titleKey('brick-bounce'),
    thumbnail: '🧱',
    accent: 'coral',
    status: 'available',
    load: () => import('@/games/brick-bounce').then((m) => m.brickBounceFactory),
  },
  ...PLANNED.map<CatalogGame>((g) => ({
    id: g.id,
    packId: getPackForGame(g.id)?.id ?? 'pack-base',
    titleKey: titleKey(g.id),
    thumbnail: g.thumbnail,
    accent: g.accent,
    status: 'planned',
  })),
];

export const getCatalogGame = (id: string): CatalogGame | undefined =>
  CATALOG.find((g) => g.id === id);
