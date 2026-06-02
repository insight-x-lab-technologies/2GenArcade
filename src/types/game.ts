import type { TFunction } from 'i18next';
import type { AudioBus, GameSoundKit } from './audio';
import type { InputAdapter } from './input';
import type { ScoreType } from './leaderboard';
import type { TrophyDef } from './trophy';

export type ControlScheme = 'swipe' | 'dpad' | 'tilt' | 'tap';
export type Orientation = 'portrait';

export interface GameMeta {
  /** Stable slug, e.g. 'block-drop'. */
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** Which pack this game belongs to (free/base or paid). */
  packId: string;
  orientation: Orientation;
  scoreType: ScoreType;
  /** Endless ("sem fim") games. */
  scoreIsEndless: boolean;
  controlScheme: ControlScheme;
  trophies: TrophyDef[];
  /** Preview art. May be an emoji/glyph for procedurally-drawn thumbnails. */
  thumbnail: string;
}

/** Namespaced key/value storage. Hydrated by the shell before `init`, written
 *  through synchronously to an in-memory cache and persisted async. Data never
 *  leaks between games (the namespace is the game id). */
export interface GameStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

/** Events a game emits to the shell. The shell owns the side effects
 *  (persist/sync score, evaluate trophies, transition screens). */
export interface GameEventMap {
  /** Run finished. `stats` feeds trophy conditions and the game-over screen. */
  gameover: { score: number; stats?: Record<string, number> };
  /** Live score change (updates the HUD; not persisted). */
  score: { score: number };
  /** Force-award or re-evaluate a trophy. With `trophyId`, awards directly;
   *  otherwise triggers condition evaluation against the provided event. */
  trophy: { trophyId?: string; event?: { type: string; data?: Record<string, number> } };
}

export interface GameEventEmitter {
  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void;
}

export interface GameContext {
  canvas: HTMLCanvasElement;
  input: InputAdapter;
  audio: AudioBus;
  storage: GameStorage;
  emit: GameEventEmitter;
  i18n: TFunction;
  reducedMotion: boolean;
  /** Logical viewport in CSS pixels (canvas is sized to this, DPR handled by
   *  the engine). Games render against these dimensions. */
  viewport: { width: number; height: number };
}

export interface GameModule {
  meta: GameMeta;
  /** Optional declarative sound kit consumed by the AudioBus. */
  sounds?: GameSoundKit;
  init(ctx: GameContext): void;
  /** Fixed-timestep logic update. `dtFixed` is in seconds. */
  update(dtFixed: number): void;
  /** Render with interpolation factor `alpha` in [0, 1]. */
  render(alpha: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** A game packaged for lazy loading by the registry. */
export interface GameModuleFactory {
  meta: GameMeta;
  sounds?: GameSoundKit;
  create(): GameModule;
}
