import type { TrophyDef, TrophyEvalContext, TrophyState } from '@/types';
import { getLocalStore, type LocalStore } from './storage';

/** Evaluates declarative trophy conditions and persists unlocks (dedup'd). */
export class TrophyService {
  constructor(
    private readonly store: LocalStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getUnlocked(gameId?: string): Promise<TrophyState[]> {
    const all = await this.store.listTrophies();
    return gameId ? all.filter((t) => t.gameId === gameId) : all;
  }

  async isUnlocked(gameId: string, trophyId: string): Promise<boolean> {
    const all = await this.store.listTrophies();
    return all.some((t) => t.gameId === gameId && t.trophyId === trophyId);
  }

  /** Evaluate all defs against `ctx`; persist & return only newly unlocked. */
  async evaluate(
    gameId: string,
    defs: readonly TrophyDef[],
    ctx: TrophyEvalContext,
  ): Promise<TrophyState[]> {
    const unlockedIds = new Set((await this.getUnlocked(gameId)).map((t) => t.trophyId));
    const newly: TrophyState[] = [];
    for (const def of defs) {
      if (unlockedIds.has(def.id)) continue;
      if (def.condition(ctx)) {
        const state: TrophyState = { trophyId: def.id, gameId, unlockedAt: this.now() };
        await this.store.saveTrophy(state);
        newly.push(state);
      }
    }
    return newly;
  }

  /** Directly award a trophy (for event-driven unlocks). No-op if already held. */
  async award(gameId: string, trophyId: string): Promise<TrophyState | null> {
    if (await this.isUnlocked(gameId, trophyId)) return null;
    const state: TrophyState = { trophyId, gameId, unlockedAt: this.now() };
    await this.store.saveTrophy(state);
    return state;
  }
}

let instance: TrophyService | null = null;

export function getTrophyService(): TrophyService {
  if (!instance) instance = new TrophyService(getLocalStore());
  return instance;
}
