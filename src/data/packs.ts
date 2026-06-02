import type { Pack } from '@/types';

// Pack catalog. The base pack is free; the rest are paid (mock entitlements).
export const PACKS: Pack[] = [
  {
    id: 'pack-base',
    nameKey: 'catalog:packs.pack-base.name',
    descriptionKey: 'catalog:packs.pack-base.description',
    gameIds: ['block-drop', 'star-defender', 'road-burner', 'river-run', 'snake-coil', 'brick-bounce'],
    free: true,
    priceCents: 0,
    currency: 'BRL',
    accent: 'amber',
  },
  {
    id: 'pack-classics',
    nameKey: 'catalog:packs.pack-classics.name',
    descriptionKey: 'catalog:packs.pack-classics.description',
    gameIds: ['maze-muncher', 'frog-crossing', 'cannon-duel', 'bug-blaster', 'asteroid-drift', 'paddle-clash'],
    free: false,
    priceCents: 1490,
    currency: 'BRL',
    accent: 'violet',
  },
  {
    id: 'pack-puzzle',
    nameKey: 'catalog:packs.pack-puzzle.name',
    descriptionKey: 'catalog:packs.pack-puzzle.description',
    gameIds: ['match-cascade', 'pipe-flow', 'light-flip', 'sliding-tiles'],
    free: false,
    priceCents: 1290,
    currency: 'BRL',
    accent: 'coral',
  },
  {
    id: 'pack-action',
    nameKey: 'catalog:packs.pack-action.name',
    descriptionKey: 'catalog:packs.pack-action.description',
    gameIds: ['sky-hopper', 'cave-flyer', 'tower-stack', 'dodge-storm'],
    free: false,
    priceCents: 1490,
    currency: 'BRL',
    accent: 'amber',
  },
];

export const FREE_PACK_IDS: string[] = PACKS.filter((p) => p.free).map((p) => p.id);

export const getPack = (id: string): Pack | undefined => PACKS.find((p) => p.id === id);

export const getPackForGame = (gameId: string): Pack | undefined =>
  PACKS.find((p) => p.gameIds.includes(gameId));
