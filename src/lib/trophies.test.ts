import { describe, expect, it } from 'vitest';
import type { TrophyDef } from '@/types';
import { MemoryStore } from './storage';
import { TrophyService } from './trophies';

const defs: TrophyDef[] = [
  {
    id: 'first-clear',
    nameKey: 'a',
    descriptionKey: 'b',
    icon: '⭐',
    condition: (ctx) => (ctx.stats.lines ?? 0) >= 1,
  },
  {
    id: 'high-scorer',
    nameKey: 'c',
    descriptionKey: 'd',
    icon: '🏆',
    condition: (ctx) => ctx.score >= 1000,
  },
];

describe('TrophyService', () => {
  it('unlocks trophies whose condition passes and persists them', async () => {
    const svc = new TrophyService(new MemoryStore(), () => 123);
    const newly = await svc.evaluate('block-drop', defs, {
      score: 1500,
      bestScore: 0,
      stats: { lines: 4 },
    });
    expect(newly.map((t) => t.trophyId).sort()).toEqual(['first-clear', 'high-scorer']);
    expect((await svc.getUnlocked('block-drop'))).toHaveLength(2);
  });

  it('does not re-award already-unlocked trophies', async () => {
    const store = new MemoryStore();
    const svc = new TrophyService(store, () => 1);
    await svc.evaluate('block-drop', defs, { score: 0, bestScore: 0, stats: { lines: 1 } });
    const second = await svc.evaluate('block-drop', defs, { score: 0, bestScore: 0, stats: { lines: 1 } });
    expect(second).toHaveLength(0);
    expect(await svc.getUnlocked('block-drop')).toHaveLength(1);
  });

  it('awards directly and is idempotent', async () => {
    const svc = new TrophyService(new MemoryStore());
    expect(await svc.award('block-drop', 'x')).not.toBeNull();
    expect(await svc.award('block-drop', 'x')).toBeNull();
  });
});
