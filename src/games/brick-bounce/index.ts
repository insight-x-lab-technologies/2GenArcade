import type { GameModuleFactory } from '@/types';
import { brickBounceMeta } from './meta';
import { brickBounceSounds } from './sounds';
import { BrickBounceGame } from './BrickBounceGame';

export const brickBounceFactory: GameModuleFactory = {
  meta: brickBounceMeta,
  sounds: brickBounceSounds,
  create: () => new BrickBounceGame(),
};

export default brickBounceFactory;
