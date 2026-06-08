export {
  getLocalStore,
  setLocalStore,
  IdbStore,
  MemoryStore,
  type LocalStore,
} from './storage';
export { checkScorePlausibility, type PlausibilityResult } from './anticheat';
export { supabaseBackend, isSupabaseConfigured } from './supabase';
export {
  LeaderboardService,
  getLeaderboardService,
  rankInList,
  type LeaderboardBackend,
  type SubmitInput,
  type SubmitResult,
} from './leaderboard';
export {
  MockEntitlementsProvider,
  StripeEntitlementsProvider,
  StoreIapEntitlementsProvider,
  getEntitlementsProvider,
  setEntitlementsProvider,
  type EntitlementsProvider,
  type ProviderConfig,
  type PurchaseResult,
} from './entitlements';
export { TrophyService, getTrophyService } from './trophies';
export {
  setHapticsEnabled,
  hapticsSupported,
  vibrate,
  type HapticPattern,
} from './haptics';
export { setUiSoundEnabled, playClick } from './uiSound';
export {
  buildShareTarget,
  SHARE_NETWORKS,
  SHARE_LABELS,
  type ShareNetwork,
  type ShareTarget,
} from './share';
