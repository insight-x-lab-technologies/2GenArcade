import type { Entitlement } from '@/types';
import { getLocalStore, type LocalStore } from './storage';

// Payment abstraction. Today only the mock provider is wired (local unlock for
// testing). Stripe (web) and store-IAP impls share this interface so the shell
// never changes when a real gateway is plugged in.
//
// NOTE: Native app-store IAP is NOT available to a web PWA. Real web
// monetization would use Stripe Checkout; store IAP only applies if the app is
// later wrapped (Capacitor/TWA). See README "Entitlements".

export interface PurchaseResult {
  ok: boolean;
  entitlement?: Entitlement;
  reason?: string;
}

export interface EntitlementsProvider {
  readonly kind: 'mock' | 'stripe' | 'store';
  /** All currently-granted entitlements (excludes always-free packs). */
  list(): Promise<Entitlement[]>;
  isEntitled(packId: string): Promise<boolean>;
  purchase(packId: string): Promise<PurchaseResult>;
  /** Re-read grants from the source of truth. */
  restore(): Promise<Entitlement[]>;
}

export interface ProviderConfig {
  /** Packs that are always entitled (the free/base pack). */
  freePackIds: string[];
}

/** Local mock: "buying" grants instantly and persists to IndexedDB. */
export class MockEntitlementsProvider implements EntitlementsProvider {
  readonly kind = 'mock' as const;

  constructor(
    private readonly store: LocalStore,
    private readonly config: ProviderConfig,
  ) {}

  async list(): Promise<Entitlement[]> {
    return this.store.listEntitlements();
  }

  async isEntitled(packId: string): Promise<boolean> {
    if (this.config.freePackIds.includes(packId)) return true;
    const granted = await this.store.listEntitlements();
    return granted.some((e) => e.packId === packId);
  }

  async purchase(packId: string): Promise<PurchaseResult> {
    if (await this.isEntitled(packId)) {
      return { ok: true, reason: 'already-owned' };
    }
    const entitlement: Entitlement = { packId, grantedAt: Date.now(), source: 'mock' };
    await this.store.saveEntitlement(entitlement);
    return { ok: true, entitlement };
  }

  async restore(): Promise<Entitlement[]> {
    return this.store.listEntitlements();
  }
}

/** Stripe Checkout (web). Stub — wire up when a backend session endpoint exists. */
export class StripeEntitlementsProvider implements EntitlementsProvider {
  readonly kind = 'stripe' as const;
  async list(): Promise<Entitlement[]> {
    return [];
  }
  async isEntitled(): Promise<boolean> {
    return false;
  }
  async purchase(): Promise<PurchaseResult> {
    // TODO: create a Checkout Session server-side, redirect, verify via webhook.
    return { ok: false, reason: 'stripe-not-implemented' };
  }
  async restore(): Promise<Entitlement[]> {
    return [];
  }
}

/** Native store IAP (Capacitor/TWA wrapper). Stub — not available to web PWA. */
export class StoreIapEntitlementsProvider implements EntitlementsProvider {
  readonly kind = 'store' as const;
  async list(): Promise<Entitlement[]> {
    return [];
  }
  async isEntitled(): Promise<boolean> {
    return false;
  }
  async purchase(): Promise<PurchaseResult> {
    return { ok: false, reason: 'store-iap-not-implemented' };
  }
  async restore(): Promise<Entitlement[]> {
    return [];
  }
}

let provider: EntitlementsProvider | null = null;

export function getEntitlementsProvider(config: ProviderConfig): EntitlementsProvider {
  if (!provider) {
    provider = new MockEntitlementsProvider(getLocalStore(), config);
  }
  return provider;
}

export function setEntitlementsProvider(custom: EntitlementsProvider): void {
  provider = custom;
}
