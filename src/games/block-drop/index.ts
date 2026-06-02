import type { GameModuleFactory } from '@/types';
import { blockDropMeta } from './meta';
import { blockDropSounds } from './sounds';
import { BlockDropGame } from './BlockDropGame';

export const blockDropFactory: GameModuleFactory = {
  meta: blockDropMeta,
  sounds: blockDropSounds,
  create: () => new BlockDropGame(),
};

export default blockDropFactory;
