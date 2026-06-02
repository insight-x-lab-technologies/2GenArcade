export type ScoreType = 'points' | 'distance' | 'time';

/** A score as stored remotely (Supabase `scores` table). */
export interface ScoreEntry {
  id: string;
  gameId: string;
  nickname: string;
  score: number;
  scoreType: ScoreType;
  createdAt: string;
  userId: string;
}

/** A score awaiting upload (offline queue). `clientId` dedupes on retry. */
export interface PendingScore {
  clientId: string;
  gameId: string;
  nickname: string;
  score: number;
  scoreType: ScoreType;
  createdAt: string;
}

export interface LeaderboardView {
  gameId: string;
  top: ScoreEntry[];
  /** 1-based rank of the player's best, if known. */
  playerRank: number | null;
  playerBest: number | null;
  /** True when served from local cache because the network was unavailable. */
  fromCache: boolean;
}
