import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entitlement, PendingScore, ScoreEntry, TrophyState } from '@/types';

// Single offline source of truth: settings, nickname, per-game storage,
// pending score queue, trophies, entitlements, and a leaderboard cache.

export interface LocalStore {
  kvGet<T>(key: string): Promise<T | undefined>;
  kvSet<T>(key: string, value: T): Promise<void>;
  kvRemove(key: string): Promise<void>;

  enqueueScore(score: PendingScore): Promise<void>;
  listPendingScores(): Promise<PendingScore[]>;
  removePendingScore(clientId: string): Promise<void>;

  saveTrophy(trophy: TrophyState): Promise<void>;
  listTrophies(): Promise<TrophyState[]>;

  saveEntitlement(entitlement: Entitlement): Promise<void>;
  listEntitlements(): Promise<Entitlement[]>;

  cacheLeaderboard(gameId: string, top: ScoreEntry[]): Promise<void>;
  getCachedLeaderboard(gameId: string): Promise<ScoreEntry[] | undefined>;
}

const trophyKey = (t: { gameId: string; trophyId: string }): string =>
  `${t.gameId}:${t.trophyId}`;

interface ArcadeDB extends DBSchema {
  kv: { key: string; value: unknown };
  pendingScores: { key: string; value: PendingScore };
  trophies: { key: string; value: TrophyState };
  entitlements: { key: string; value: Entitlement };
  leaderboardCache: { key: string; value: { gameId: string; top: ScoreEntry[]; cachedAt: number } };
}

const DB_NAME = '2genarcade';
const DB_VERSION = 1;

export class IdbStore implements LocalStore {
  private dbPromise: Promise<IDBPDatabase<ArcadeDB>>;

  constructor() {
    this.dbPromise = openDB<ArcadeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('pendingScores', { keyPath: 'clientId' });
        db.createObjectStore('trophies');
        db.createObjectStore('entitlements', { keyPath: 'packId' });
        db.createObjectStore('leaderboardCache', { keyPath: 'gameId' });
      },
    });
  }

  async kvGet<T>(key: string): Promise<T | undefined> {
    const db = await this.dbPromise;
    return (await db.get('kv', key)) as T | undefined;
  }

  async kvSet<T>(key: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    await db.put('kv', value, key);
  }

  async kvRemove(key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('kv', key);
  }

  async enqueueScore(score: PendingScore): Promise<void> {
    const db = await this.dbPromise;
    await db.put('pendingScores', score);
  }

  async listPendingScores(): Promise<PendingScore[]> {
    const db = await this.dbPromise;
    return db.getAll('pendingScores');
  }

  async removePendingScore(clientId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('pendingScores', clientId);
  }

  async saveTrophy(trophy: TrophyState): Promise<void> {
    const db = await this.dbPromise;
    await db.put('trophies', trophy, trophyKey(trophy));
  }

  async listTrophies(): Promise<TrophyState[]> {
    const db = await this.dbPromise;
    return db.getAll('trophies');
  }

  async saveEntitlement(entitlement: Entitlement): Promise<void> {
    const db = await this.dbPromise;
    await db.put('entitlements', entitlement);
  }

  async listEntitlements(): Promise<Entitlement[]> {
    const db = await this.dbPromise;
    return db.getAll('entitlements');
  }

  async cacheLeaderboard(gameId: string, top: ScoreEntry[]): Promise<void> {
    const db = await this.dbPromise;
    await db.put('leaderboardCache', { gameId, top, cachedAt: Date.now() });
  }

  async getCachedLeaderboard(gameId: string): Promise<ScoreEntry[] | undefined> {
    const db = await this.dbPromise;
    const row = await db.get('leaderboardCache', gameId);
    return row?.top;
  }
}

/** In-memory fallback (no IndexedDB / SSR / tests). Not persisted. */
export class MemoryStore implements LocalStore {
  private kv = new Map<string, unknown>();
  private pending = new Map<string, PendingScore>();
  private trophies = new Map<string, TrophyState>();
  private entitlements = new Map<string, Entitlement>();
  private leaderboard = new Map<string, ScoreEntry[]>();

  async kvGet<T>(key: string): Promise<T | undefined> {
    return this.kv.get(key) as T | undefined;
  }
  async kvSet<T>(key: string, value: T): Promise<void> {
    this.kv.set(key, value);
  }
  async kvRemove(key: string): Promise<void> {
    this.kv.delete(key);
  }
  async enqueueScore(score: PendingScore): Promise<void> {
    this.pending.set(score.clientId, score);
  }
  async listPendingScores(): Promise<PendingScore[]> {
    return [...this.pending.values()];
  }
  async removePendingScore(clientId: string): Promise<void> {
    this.pending.delete(clientId);
  }
  async saveTrophy(trophy: TrophyState): Promise<void> {
    this.trophies.set(trophyKey(trophy), trophy);
  }
  async listTrophies(): Promise<TrophyState[]> {
    return [...this.trophies.values()];
  }
  async saveEntitlement(entitlement: Entitlement): Promise<void> {
    this.entitlements.set(entitlement.packId, entitlement);
  }
  async listEntitlements(): Promise<Entitlement[]> {
    return [...this.entitlements.values()];
  }
  async cacheLeaderboard(gameId: string, top: ScoreEntry[]): Promise<void> {
    this.leaderboard.set(gameId, top);
  }
  async getCachedLeaderboard(gameId: string): Promise<ScoreEntry[] | undefined> {
    return this.leaderboard.get(gameId);
  }
}

let store: LocalStore | null = null;

export function getLocalStore(): LocalStore {
  if (store) return store;
  const hasIdb = typeof globalThis.indexedDB !== 'undefined';
  store = hasIdb ? new IdbStore() : new MemoryStore();
  return store;
}

/** Test seam: override the store singleton. */
export function setLocalStore(custom: LocalStore): void {
  store = custom;
}
