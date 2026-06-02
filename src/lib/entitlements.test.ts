import { describe, expect, it } from 'vitest';
import { MockEntitlementsProvider } from './entitlements';
import { MemoryStore } from './storage';

const setup = () =>
  new MockEntitlementsProvider(new MemoryStore(), { freePackIds: ['pack-base'] });

describe('MockEntitlementsProvider', () => {
  it('treats free packs as always entitled', async () => {
    const p = setup();
    expect(await p.isEntitled('pack-base')).toBe(true);
  });

  it('locks paid packs until purchased', async () => {
    const p = setup();
    expect(await p.isEntitled('pack-classics')).toBe(false);
    const result = await p.purchase('pack-classics');
    expect(result.ok).toBe(true);
    expect(result.entitlement?.source).toBe('mock');
    expect(await p.isEntitled('pack-classics')).toBe(true);
  });

  it('is idempotent for an already-owned pack', async () => {
    const p = setup();
    await p.purchase('pack-classics');
    const again = await p.purchase('pack-classics');
    expect(again.ok).toBe(true);
    expect(again.reason).toBe('already-owned');
    expect(await p.list()).toHaveLength(1);
  });
});
