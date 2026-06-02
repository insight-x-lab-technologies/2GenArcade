import type { GameModuleFactory } from '@/types';
import { riverRunMeta } from './meta';
import { riverRunSounds } from './sounds';
import { RiverRunGame } from './RiverRunGame';

export const riverRunFactory: GameModuleFactory = {
  meta: riverRunMeta,
  sounds: riverRunSounds,
  create: () => new RiverRunGame(),
};

export default riverRunFactory;
