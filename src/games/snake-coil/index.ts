import type { GameModuleFactory } from '@/types';
import { snakeCoilMeta } from './meta';
import { snakeCoilSounds } from './sounds';
import { SnakeCoilGame } from './SnakeCoilGame';

export const snakeCoilFactory: GameModuleFactory = {
  meta: snakeCoilMeta,
  sounds: snakeCoilSounds,
  create: () => new SnakeCoilGame(),
};

export default snakeCoilFactory;
