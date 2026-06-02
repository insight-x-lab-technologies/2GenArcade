import type { ScoreType } from '@/types';

// ⚠️ CLIENT-SIDE PLAUSIBILITY ONLY — NOT A SECURITY BOUNDARY.
// A determined cheater can submit anything: the anon key is public and there is
// no server-side validation yet. This only filters obviously-broken values and
// honest bugs. Real protection requires server validation.
// TODO(server): validate scores in a Supabase Edge Function using signed,
// time-stamped run tokens (HMAC) issued at game start, plus rate limiting.

export interface PlausibilityRule {
  /** Hard ceiling for a single submission. */
  max: number;
  /** Scores must be whole numbers (points/distance) vs allowing decimals. */
  integer: boolean;
}

const DEFAULT_RULE: PlausibilityRule = { max: 100_000_000, integer: true };

/** Per-game overrides. Tune as games are added. */
const RULES: Record<string, PlausibilityRule> = {
  'block-drop': { max: 50_000_000, integer: true },
};

export interface PlausibilityResult {
  ok: boolean;
  reason?: 'negative' | 'non-finite' | 'not-integer' | 'too-large';
}

export function checkScorePlausibility(
  gameId: string,
  score: number,
  _scoreType: ScoreType,
): PlausibilityResult {
  const rule = RULES[gameId] ?? DEFAULT_RULE;
  if (!Number.isFinite(score)) return { ok: false, reason: 'non-finite' };
  if (score < 0) return { ok: false, reason: 'negative' };
  if (rule.integer && !Number.isInteger(score)) return { ok: false, reason: 'not-integer' };
  if (score > rule.max) return { ok: false, reason: 'too-large' };
  return { ok: true };
}
