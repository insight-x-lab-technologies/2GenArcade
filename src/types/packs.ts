export interface Pack {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Game ids included in this pack. */
  gameIds: string[];
  /** Free packs are always entitled. */
  free: boolean;
  /** Placeholder price in cents (display only; no real gateway yet). */
  priceCents: number;
  currency: string;
  /** Accent used by the store card. */
  accent: 'amber' | 'violet' | 'coral';
}

/** A granted entitlement (a purchased/unlocked pack). */
export interface Entitlement {
  packId: string;
  grantedAt: number;
  /** Where the grant came from. */
  source: 'free' | 'mock' | 'stripe' | 'store';
}
