// Trophies are defined declaratively per game. The `condition` is a typed
// predicate (not a fragile string DSL) evaluated by the shell at gameover and
// on in-game events. Games may also force-award via emit('trophy', ...).

export interface TrophyEvalContext {
  /** Final or current score. */
  score: number;
  /** Best score recorded for this game so far (before this run). */
  bestScore: number;
  /** Arbitrary numeric stats reported by the game (lines, combos, level...). */
  stats: Readonly<Record<string, number>>;
  /** Present when evaluation is triggered by an in-game event. */
  event?: { type: string; data?: Readonly<Record<string, number>> };
}

export type TrophyCondition = (ctx: TrophyEvalContext) => boolean;

export interface TrophyDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Emoji or design-system glyph used by the TrophyBadge component. */
  icon: string;
  condition: TrophyCondition;
  /** Hidden in the trophy list until unlocked. */
  secret?: boolean;
}

export interface TrophyState {
  trophyId: string;
  gameId: string;
  unlockedAt: number;
}
