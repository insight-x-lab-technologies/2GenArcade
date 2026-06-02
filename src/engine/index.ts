export { FixedTimestepLoop } from './GameLoop';
export type { LoopCallbacks, LoopOptions } from './GameLoop';
export { CanvasManager } from './CanvasManager';
export { PointerInputAdapter } from './InputAdapter';
export type { PointerInputOptions } from './InputAdapter';
export {
  classifyPointerGesture,
  dominantDirection,
  DEFAULT_GESTURE_OPTIONS,
} from './gesture';
export type { PointerSample, GestureOptions } from './gesture';
export { clamp, lerp, easeOutCubic, randInt } from './math';
