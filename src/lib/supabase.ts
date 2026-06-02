import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ScoreEntry, ScoreType } from '@/types';

// Supabase wiring with graceful degradation: when VITE_SUPABASE_* are absent
// the app runs fully offline (local-only leaderboard). No keys are committed.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  client = createClient(url as string, anonKey as string, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

interface ScoreRow {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  score_type: string;
  created_at: string;
  user_id: string;
}

const rowToEntry = (row: ScoreRow): ScoreEntry => ({
  id: row.id,
  gameId: row.game_id,
  nickname: row.nickname,
  score: row.score,
  scoreType: row.score_type as ScoreType,
  createdAt: row.created_at,
  userId: row.user_id,
});

export interface InsertScoreInput {
  gameId: string;
  nickname: string;
  score: number;
  scoreType: ScoreType;
  createdAt: string;
}

/** Thin backend wrapper. Every method returns null/empty (never throws to
 *  callers) when Supabase is unconfigured, so the caller can fall back. */
export const supabaseBackend = {
  get isConfigured(): boolean {
    return isSupabaseConfigured && client !== null;
  },

  /** Ensure an anonymous session exists; returns the user id or null. */
  async ensureSession(): Promise<string | null> {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    if (data.session?.user) return data.session.user.id;
    const { data: signIn, error } = await client.auth.signInAnonymously();
    if (error) {
      console.error('[supabase] anonymous sign-in failed', error.message);
      return null;
    }
    return signIn.user?.id ?? null;
  },

  async insertScore(input: InsertScoreInput): Promise<boolean> {
    if (!client) return false;
    const userId = await this.ensureSession();
    if (!userId) return false;
    const { error } = await client.from('scores').insert({
      game_id: input.gameId,
      nickname: input.nickname,
      score: input.score,
      score_type: input.scoreType,
      created_at: input.createdAt,
      user_id: userId,
    });
    if (error) {
      console.error('[supabase] insert score failed', error.message);
      return false;
    }
    return true;
  },

  async fetchTop(gameId: string, limit: number): Promise<ScoreEntry[] | null> {
    if (!client) return null;
    const { data, error } = await client
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[supabase] fetch top failed', error.message);
      return null;
    }
    return (data as ScoreRow[]).map(rowToEntry);
  },

  /** Count how many distinct higher scores exist => player's global rank. */
  async fetchRank(gameId: string, score: number): Promise<number | null> {
    if (!client) return null;
    const { count, error } = await client
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .gt('score', score);
    if (error) {
      console.error('[supabase] fetch rank failed', error.message);
      return null;
    }
    return (count ?? 0) + 1;
  },
};
