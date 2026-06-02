import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreEntry } from '@/types';
import { LeaderboardService, rankInList, type LeaderboardBackend } from './leaderboard';
import { MemoryStore } from './storage';

const makeBackend = (configured: boolean): LeaderboardBackend & {
  inserted: number;
} => ({
  isConfigured: configured,
  inserted: 0,
  async insertScore() {
    this.inserted += 1;
    return true;
  },
  async fetchTop() {
    return null;
  },
  async fetchRank() {
    return null;
  },
});

const deps = (online: boolean) => ({
  isOnline: () => online,
  uuid: (() => {
    let n = 0;
    return () => `id-${n++}`;
  })(),
  now: () => new Date('2026-06-01T00:00:00.000Z'),
});

describe('rankInList', () => {
  it('computes 1-based rank within a desc-sorted list', () => {
    const top = [{ score: 100 }, { score: 80 }, { score: 50 }];
    expect(rankInList(top, 120)).toBe(1);
    expect(rankInList(top, 90)).toBe(2);
    expect(rankInList(top, 10)).toBe(4);
  });
});

describe('LeaderboardService.submitScore', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('rejects an implausible score without queuing it', async () => {
    const backend = makeBackend(true);
    const svc = new LeaderboardService(backend, store, deps(true));
    const result = await svc.submitScore({
      gameId: 'block-drop',
      nickname: 'AAA',
      score: -5,
      scoreType: 'points',
    });
    expect(result.accepted).toBe(false);
    expect(await store.listPendingScores()).toHaveLength(0);
  });

  it('uploads immediately when online and configured', async () => {
    const backend = makeBackend(true);
    const svc = new LeaderboardService(backend, store, deps(true));
    const result = await svc.submitScore({
      gameId: 'block-drop',
      nickname: 'AAA',
      score: 1234,
      scoreType: 'points',
    });
    expect(result).toMatchObject({ accepted: true, synced: true });
    expect(backend.inserted).toBe(1);
    expect(await store.listPendingScores()).toHaveLength(0);
  });

  it('queues offline and syncs later', async () => {
    const backend = makeBackend(true);
    const offline = new LeaderboardService(backend, store, deps(false));
    const result = await offline.submitScore({
      gameId: 'block-drop',
      nickname: 'AAA',
      score: 999,
      scoreType: 'points',
    });
    expect(result).toMatchObject({ accepted: true, synced: false });
    expect(await store.listPendingScores()).toHaveLength(1);

    const online = new LeaderboardService(backend, store, deps(true));
    const synced = await online.syncPending();
    expect(synced).toBe(1);
    expect(await store.listPendingScores()).toHaveLength(0);
  });

  it('queues (does not lose) the score when backend is unconfigured', async () => {
    const backend = makeBackend(false);
    const svc = new LeaderboardService(backend, store, deps(true));
    const result = await svc.submitScore({
      gameId: 'block-drop',
      nickname: 'AAA',
      score: 10,
      scoreType: 'points',
    });
    expect(result.synced).toBe(false);
    expect(await store.listPendingScores()).toHaveLength(1);
  });
});

describe('LeaderboardService.getLeaderboard', () => {
  it('falls back to the local cache when offline', async () => {
    const store = new MemoryStore();
    const cached: ScoreEntry[] = [
      { id: '1', gameId: 'block-drop', nickname: 'ZZZ', score: 500, scoreType: 'points', createdAt: '', userId: 'u' },
    ];
    await store.cacheLeaderboard('block-drop', cached);
    const backend = makeBackend(true);
    const svc = new LeaderboardService(backend, store, deps(false));
    const view = await svc.getLeaderboard('block-drop', { playerBest: 600 });
    expect(view.fromCache).toBe(true);
    expect(view.top).toHaveLength(1);
    expect(view.playerRank).toBe(1);
  });

  it('caches the online result and reports live ranks', async () => {
    const store = new MemoryStore();
    const top: ScoreEntry[] = [
      { id: '1', gameId: 'block-drop', nickname: 'A', score: 900, scoreType: 'points', createdAt: '', userId: 'u' },
    ];
    const backend: LeaderboardBackend = {
      isConfigured: true,
      insertScore: vi.fn(async () => true),
      fetchTop: vi.fn(async () => top),
      fetchRank: vi.fn(async () => 7),
    };
    const svc = new LeaderboardService(backend, store, deps(true));
    const view = await svc.getLeaderboard('block-drop', { playerBest: 100 });
    expect(view.fromCache).toBe(false);
    expect(view.playerRank).toBe(7);
    expect(await store.getCachedLeaderboard('block-drop')).toEqual(top);
  });
});
