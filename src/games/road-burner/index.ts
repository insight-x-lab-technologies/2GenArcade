import type { GameModuleFactory } from '@/types';
import { roadBurnerMeta } from './meta';
import { roadBurnerSounds } from './sounds';
import { RoadBurnerGame } from './RoadBurnerGame';

export const roadBurnerFactory: GameModuleFactory = {
  meta: roadBurnerMeta,
  sounds: roadBurnerSounds,
  create: () => new RoadBurnerGame(),
};

export default roadBurnerFactory;
