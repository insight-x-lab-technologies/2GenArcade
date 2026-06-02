import type { GameModuleFactory } from '@/types';
import { starDefenderMeta } from './meta';
import { starDefenderSounds } from './sounds';
import { StarDefenderGame } from './StarDefenderGame';

export const starDefenderFactory: GameModuleFactory = {
  meta: starDefenderMeta,
  sounds: starDefenderSounds,
  create: () => new StarDefenderGame(),
};

export default starDefenderFactory;
