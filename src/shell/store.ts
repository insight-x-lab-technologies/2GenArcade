import { create } from 'zustand';
import type { GameMeta, TrophyDef, TrophyState } from '@/types';
import { getAudioEngine } from '@/audio';
import {
  getEntitlementsProvider,
  getLeaderboardService,
  getLocalStore,
  getTrophyService,
  isSupabaseConfigured,
} from '@/lib';
import { FREE_PACK_IDS, getPackForGame } from '@/data/packs';
import { setAppLanguage, type AppLanguage } from '@/i18n';

export type RouteName =
  | 'splash'
  | 'home'
  | 'detail'
  | 'play'
  | 'gameover'
  | 'store'
  | 'settings'
  | 'trophies'
  | 'leaderboard';

export interface Route {
  name: RouteName;
  gameId?: string;
}

export type SubmitState = 'idle' | 'submitting' | 'submitted' | 'queued' | 'rejected';

export interface Toast {
  key: string;
  values?: Record<string, string | number>;
}

export interface RunResult {
  gameId: string;
  score: number;
  stats: Record<string, number>;
  bestScore: number;
  isNewRecord: boolean;
  submit: SubmitState;
  rank: number | null;
  newTrophies: TrophyDef[];
}

/** On-screen control style for the 4-direction games (chosen in Settings).
 *  'dpad' = the classic button cross; 'zones' = an analog quadrant pad;
 *  'swipe' = a floating joystick on the play surface. */
export type ControlStyle = 'dpad' | 'zones' | 'swipe';

interface Settings {
  musicVolume: number;
  sfxVolume: number;
  crtEnabled: boolean;
  language: AppLanguage;
  controlStyle: ControlStyle;
}

const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  crtEnabled: true,
  language: 'pt-BR',
  controlStyle: 'dpad',
};

const SETTINGS_KEY = 'settings';
const NICKNAME_KEY = 'nickname';
const BEST_KEY = 'bestScores';

interface ArcadeState {
  ready: boolean;
  online: boolean;
  audioUnlocked: boolean;
  reducedMotion: boolean;
  backendConfigured: boolean;

  history: Route[];
  settings: Settings;
  nickname: string;
  entitledPacks: string[];
  bestScores: Record<string, number>;
  unlockedTrophies: TrophyState[];
  lastRun: RunResult | null;
  toast: Toast | null;

  init(): Promise<void>;
  navigate(route: Route): void;
  back(): void;
  unlockAudio(): Promise<void>;

  setMusicVolume(v: number): void;
  setSfxVolume(v: number): void;
  toggleCrt(): void;
  setLanguage(lang: AppLanguage): void;
  setControlStyle(style: ControlStyle): void;
  setNickname(name: string): void;

  isGameUnlocked(gameId: string): boolean;
  bestScore(gameId: string): number;
  purchasePack(packId: string): Promise<boolean>;

  handleGameOver(meta: GameMeta, score: number, stats: Record<string, number>): Promise<void>;
  syncNow(): Promise<void>;
  refreshTrophies(): Promise<void>;
  showToast(toast: Toast): void;
  dismissToast(): void;
}

const currentRoute = (history: Route[]): Route => history[history.length - 1] ?? { name: 'splash' };

export const useArcadeStore = create<ArcadeState>((set, get) => ({
  ready: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  audioUnlocked: false,
  reducedMotion:
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  backendConfigured: isSupabaseConfigured,

  history: [{ name: 'splash' }],
  settings: DEFAULT_SETTINGS,
  nickname: '',
  entitledPacks: [...FREE_PACK_IDS],
  bestScores: {},
  unlockedTrophies: [],
  lastRun: null,
  toast: null,

  async init() {
    const store = getLocalStore();
    const [savedSettings, savedNickname, savedBest, entitlements, trophies] = await Promise.all([
      store.kvGet<Settings>(SETTINGS_KEY),
      store.kvGet<string>(NICKNAME_KEY),
      store.kvGet<Record<string, number>>(BEST_KEY),
      store.listEntitlements(),
      getTrophyService().getUnlocked(),
    ]);

    const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    const engine = getAudioEngine();
    engine.setMusicVolume(settings.musicVolume);
    engine.setSfxVolume(settings.sfxVolume);
    setAppLanguage(settings.language);

    set({
      ready: true,
      settings,
      nickname: savedNickname ?? '',
      bestScores: savedBest ?? {},
      entitledPacks: [...new Set([...FREE_PACK_IDS, ...entitlements.map((e) => e.packId)])],
      unlockedTrophies: trophies,
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        set({ online: true });
        void get().syncNow();
      });
      window.addEventListener('offline', () => set({ online: false }));
    }
  },

  navigate(route) {
    set((s) => ({ history: [...s.history, route] }));
  },

  back() {
    set((s) => (s.history.length > 1 ? { history: s.history.slice(0, -1) } : s));
  },

  async unlockAudio() {
    if (get().audioUnlocked) return;
    await getAudioEngine().unlock();
    set({ audioUnlocked: true });
  },

  setMusicVolume(v) {
    getAudioEngine().setMusicVolume(v);
    const settings = { ...get().settings, musicVolume: v };
    set({ settings });
    void getLocalStore().kvSet(SETTINGS_KEY, settings);
  },

  setSfxVolume(v) {
    getAudioEngine().setSfxVolume(v);
    const settings = { ...get().settings, sfxVolume: v };
    set({ settings });
    void getLocalStore().kvSet(SETTINGS_KEY, settings);
  },

  toggleCrt() {
    const settings = { ...get().settings, crtEnabled: !get().settings.crtEnabled };
    set({ settings });
    void getLocalStore().kvSet(SETTINGS_KEY, settings);
  },

  setLanguage(lang) {
    setAppLanguage(lang);
    const settings = { ...get().settings, language: lang };
    set({ settings });
    void getLocalStore().kvSet(SETTINGS_KEY, settings);
  },

  setControlStyle(style) {
    const settings = { ...get().settings, controlStyle: style };
    set({ settings });
    void getLocalStore().kvSet(SETTINGS_KEY, settings);
  },

  setNickname(name) {
    const nickname = name.slice(0, 12);
    set({ nickname });
    void getLocalStore().kvSet(NICKNAME_KEY, nickname);
  },

  isGameUnlocked(gameId) {
    const pack = getPackForGame(gameId);
    if (!pack) return true;
    return get().entitledPacks.includes(pack.id);
  },

  bestScore(gameId) {
    return get().bestScores[gameId] ?? 0;
  },

  async purchasePack(packId) {
    const provider = getEntitlementsProvider({ freePackIds: FREE_PACK_IDS });
    const result = await provider.purchase(packId);
    if (result.ok) {
      set((s) => ({ entitledPacks: [...new Set([...s.entitledPacks, packId])] }));
    }
    return result.ok;
  },

  async handleGameOver(meta, score, stats) {
    const prevBest = get().bestScore(meta.id);
    const isNewRecord = score > prevBest;
    const bestScore = Math.max(prevBest, score);

    if (isNewRecord) {
      const bestScores = { ...get().bestScores, [meta.id]: bestScore };
      set({ bestScores });
      void getLocalStore().kvSet(BEST_KEY, bestScores);
    }

    // Evaluate trophies against the final run, then resolve to defs for display.
    const unlocked = await getTrophyService().evaluate(meta.id, meta.trophies, {
      score,
      bestScore: prevBest,
      stats,
    });
    const unlockedIds = new Set(unlocked.map((t) => t.trophyId));
    const newTrophies = meta.trophies.filter((d) => unlockedIds.has(d.id));
    if (newTrophies.length > 0) await get().refreshTrophies();

    // Submit the score (queues offline). Requires a nickname.
    let submit: SubmitState = 'idle';
    let rank: number | null = null;
    const nickname = get().nickname.trim();
    if (nickname) {
      set({
        lastRun: {
          gameId: meta.id,
          score,
          stats,
          bestScore,
          isNewRecord,
          submit: 'submitting',
          rank: null,
          newTrophies,
        },
      });
      const leaderboard = getLeaderboardService();
      const res = await leaderboard.submitScore({
        gameId: meta.id,
        nickname,
        score,
        scoreType: meta.scoreType,
      });
      submit = !res.accepted ? 'rejected' : res.synced ? 'submitted' : 'queued';
      if (res.synced) {
        const view = await leaderboard.getLeaderboard(meta.id, { playerBest: bestScore });
        rank = view.playerRank;
      }
    }

    set({
      lastRun: { gameId: meta.id, score, stats, bestScore, isNewRecord, submit, rank, newTrophies },
    });
  },

  async syncNow() {
    const synced = await getLeaderboardService().syncPending();
    if (synced > 0) get().showToast({ key: 'syncedToast', values: { count: synced } });
  },

  async refreshTrophies() {
    const trophies = await getTrophyService().getUnlocked();
    set({ unlockedTrophies: trophies });
  },

  showToast(toast) {
    set({ toast });
  },

  dismissToast() {
    set({ toast: null });
  },
}));

export const selectCurrentRoute = (s: ArcadeState): Route => currentRoute(s.history);
