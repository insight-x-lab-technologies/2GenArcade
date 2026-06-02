import type { LeaderboardView, PendingScore, ScoreEntry, ScoreType } from '@/types';
import { checkScorePlausibility } from './anticheat';
import { getLocalStore, type LocalStore } from './storage';
import { supabaseBackend } from './supabase';

export interface LeaderboardBackend {
  readonly isConfigured: boolean;
  insertScore(input: {
    gameId: string;
    nickname: string;
    score: number;
    scoreType: ScoreType;
    createdAt: string;
  }): Promise<boolean>;
  fetchTop(gameId: string, limit: number): Promise<ScoreEntry[] | null>;
  fetchRank(gameId: string, score: number): Promise<number | null>;
}

export interface SubmitInput {
  gameId: string;
  nickname: string;
  score: number;
  scoreType: ScoreType;
}

export interface SubmitResult {
  /** False when the score failed client plausibility checks. */
  accepted: boolean;
  /** True when it was uploaded immediately; false means queued offline. */
  synced: boolean;
  reason?: string;
}

interface ServiceDeps {
  isOnline: () => boolean;
  uuid: () => string;
  now: () => Date;
}

/** Rank a score within a sorted-desc list (1-based). */
export function rankInList(top: ReadonlyArray<{ score: number }>, score: number): number {
  let rank = 1;
  for (const entry of top) {
    if (entry.score > score) rank += 1;
    else break;
  }
  return rank;
}

export class LeaderboardService {
  private readonly deps: ServiceDeps;

  constructor(
    private readonly backend: LeaderboardBackend,
    private readonly store: LocalStore,
    deps: Partial<ServiceDeps> = {},
  ) {
    this.deps = {
      isOnline: deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine)),
      uuid: deps.uuid ?? (() => crypto.randomUUID()),
      now: deps.now ?? (() => new Date()),
    };
  }

  async submitScore(input: SubmitInput): Promise<SubmitResult> {
    const check = checkScorePlausibility(input.gameId, input.score, input.scoreType);
    if (!check.ok) {
      return { accepted: false, synced: false, reason: check.reason };
    }

    const pending: PendingScore = {
      clientId: this.deps.uuid(),
      gameId: input.gameId,
      nickname: input.nickname,
      score: input.score,
      scoreType: input.scoreType,
      createdAt: this.deps.now().toISOString(),
    };

    // Always record locally first so a crash or network failure never loses it.
    await this.store.enqueueScore(pending);

    if (this.deps.isOnline() && this.backend.isConfigured) {
      const ok = await this.backend.insertScore(pending);
      if (ok) {
        await this.store.removePendingScore(pending.clientId);
        return { accepted: true, synced: true };
      }
    }
    return { accepted: true, synced: false };
  }

  /** Flush the offline queue. Returns the number of scores synced. */
  async syncPending(): Promise<number> {
    if (!this.deps.isOnline() || !this.backend.isConfigured) return 0;
    const pending = await this.store.listPendingScores();
    let synced = 0;
    for (const score of pending) {
      const ok = await this.backend.insertScore(score);
      if (ok) {
        await this.store.removePendingScore(score.clientId);
        synced += 1;
      }
    }
    return synced;
  }

  async getLeaderboard(
    gameId: string,
    options: { limit?: number; playerBest?: number | null } = {},
  ): Promise<LeaderboardView> {
    const limit = options.limit ?? 20;
    const playerBest = options.playerBest ?? null;

    if (this.deps.isOnline() && this.backend.isConfigured) {
      const top = await this.backend.fetchTop(gameId, limit);
      if (top) {
        await this.store.cacheLeaderboard(gameId, top);
        let playerRank: number | null = null;
        if (playerBest !== null) {
          playerRank = (await this.backend.fetchRank(gameId, playerBest)) ?? rankInList(top, playerBest);
        }
        return { gameId, top, playerRank, playerBest, fromCache: false };
      }
    }

    const cached = (await this.store.getCachedLeaderboard(gameId)) ?? [];
    const playerRank = playerBest !== null ? rankInList(cached, playerBest) : null;
    return { gameId, top: cached, playerRank, playerBest, fromCache: true };
  }
}

let instance: LeaderboardService | null = null;

export function getLeaderboardService(): LeaderboardService {
  if (!instance) {
    instance = new LeaderboardService(supabaseBackend, getLocalStore());
  }
  return instance;
}
