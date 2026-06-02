import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  GameContext,
  GameEventEmitter,
  GameEventMap,
  GameModule,
  GameStorage,
  Direction,
  ControlScheme,
} from '@/types';
import { CanvasManager, diffHeld, FixedTimestepLoop, PointerInputAdapter } from '@/engine';
import { GameAudioBus, getAudioEngine } from '@/audio';
import { getLocalStore, getTrophyService } from '@/lib';
import i18nInstance from '@/i18n';
import { ArcadeButton, SwipeOverlay, VirtualDpad, ZonePad } from '@/ui';
import type { CatalogGame } from '@/data/catalog';
import { useArcadeStore } from './store';

interface GameHostProps {
  game: CatalogGame;
  onExit: () => void;
}

function createGameStorage(gameId: string, initial: Record<string, unknown>): GameStorage {
  const cache: Record<string, unknown> = { ...initial };
  const key = `gameStorage:${gameId}`;
  const persist = () => void getLocalStore().kvSet(key, cache);
  return {
    get<T>(k: string, fallback: T): T {
      return k in cache ? (cache[k] as T) : fallback;
    },
    set<T>(k: string, value: T): void {
      cache[k] = value;
      persist();
    },
    remove(k: string): void {
      delete cache[k];
      persist();
    },
  };
}

export function GameHost({ game, onExit }: GameHostProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<PointerInputAdapter | null>(null);
  const heldTouchRef = useRef<Set<Direction>>(new Set());

  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hudScore, setHudScore] = useState(0);
  const [controlScheme, setControlScheme] = useState<ControlScheme>('swipe');

  const controlStyle = useArcadeStore((s) => s.settings.controlStyle);
  const reducedMotion = useArcadeStore((s) => s.reducedMotion);
  const handleGameOver = useArcadeStore((s) => s.handleGameOver);
  const navigate = useArcadeStore((s) => s.navigate);
  const showToast = useArcadeStore((s) => s.showToast);
  const refreshTrophies = useArcadeStore((s) => s.refreshTrophies);

  // Stable refs for the loop/module so the effect runs once per game.
  const moduleRef = useRef<GameModule | null>(null);
  const loopRef = useRef<FixedTimestepLoop | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const canvasManager = new CanvasManager(canvas);
    const adapter = new PointerInputAdapter(canvas);
    adapterRef.current = adapter;
    const audioEngine = getAudioEngine();

    const viewport = { width: 0, height: 0 };
    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      viewport.width = Math.max(1, Math.floor(rect.width));
      viewport.height = Math.max(1, Math.floor(rect.height));
      canvasManager.resize(viewport.width, viewport.height);
    };
    applySize();

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(wrap);

    const setup = async () => {
      const factory = await game.load!();
      if (cancelled) return;
      setControlScheme(factory.meta.controlScheme);

      const initialStorage =
        (await getLocalStore().kvGet<Record<string, unknown>>(`gameStorage:${game.id}`)) ?? {};
      if (cancelled) return;

      const module = factory.create();
      moduleRef.current = module;

      const audio = new GameAudioBus(audioEngine, factory.sounds ?? {});

      const emit: GameEventEmitter = {
        emit: <K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) => {
          void handleGameEvent(type, payload);
        },
      };

      const ctx: GameContext = {
        canvas,
        input: adapter,
        audio,
        storage: createGameStorage(game.id, initialStorage),
        emit,
        i18n: i18nInstance.t,
        reducedMotion,
        viewport,
      };

      adapter.attach();
      module.init(ctx);

      const loop = new FixedTimestepLoop({
        update: (dt) => module.update(dt),
        render: (alpha) => module.render(alpha),
      });
      loopRef.current = loop;
      loop.start();
      setLoading(false);
    };

    const handleGameEvent = async <K extends keyof GameEventMap>(
      type: K,
      payload: GameEventMap[K],
    ): Promise<void> => {
      if (type === 'score') {
        setHudScore((payload as GameEventMap['score']).score);
        return;
      }
      if (type === 'trophy') {
        const p = payload as GameEventMap['trophy'];
        const module = moduleRef.current;
        if (p.trophyId) {
          const awarded = await getTrophyService().award(game.id, p.trophyId);
          if (awarded) {
            await refreshTrophies();
            const def = module?.meta.trophies.find((d) => d.id === p.trophyId);
            if (def) {
              showToast({ key: 'trophyUnlocked', values: { name: i18nInstance.t(def.nameKey) } });
            }
          }
        }
        return;
      }
      if (type === 'gameover') {
        const p = payload as GameEventMap['gameover'];
        loopRef.current?.stop();
        const module = moduleRef.current;
        if (module) {
          await handleGameOver(module.meta, p.score, p.stats ?? {});
          navigate({ name: 'gameover', gameId: game.id });
        }
      }
    };

    void setup();

    const onVisibility = () => {
      if (document.hidden) doPause();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver.disconnect();
      loopRef.current?.stop();
      moduleRef.current?.destroy();
      adapter.destroy();
      audioEngine.stopMusic();
      moduleRef.current = null;
      loopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const dispatchDir = (direction: Direction, phase: 'press' | 'release') =>
    adapterRef.current?.dispatch({ kind: 'dpad', direction, phase });
  const dispatchBtn = (id: string, phase: 'press' | 'release') =>
    adapterRef.current?.dispatch({ kind: 'button', id, phase });

  // Analog controls (zone pad / swipe stick) report the *whole* held-set; diff
  // it against the previous one into press/release events on the shared adapter.
  const setHeld = (dirs: Direction[]) => {
    const next = new Set(dirs);
    diffHeld(heldTouchRef.current, next, dispatchDir);
    heldTouchRef.current = next;
  };

  const doPause = () => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    setHeld([]); // release any analog-held directions so nothing sticks
    loopRef.current?.stop();
    moduleRef.current?.pause();
  };

  const doResume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    moduleRef.current?.resume();
    loopRef.current?.resetClock();
    loopRef.current?.start();
  };

  // The new analog styles only apply to the 4-direction games; Block Drop keeps
  // its dedicated rotate/drop pad.
  const directional = controlScheme === 'dpad';
  const useZones = directional && controlStyle === 'zones';
  const useSwipe = directional && controlStyle === 'swipe';

  return (
    <div className="relative flex h-full flex-col bg-night-900">
      {/* HUD */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
      >
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          {t('gameplayScore')}
        </span>
        <span className="font-display text-base text-neon-amber tabular-nums">
          {hudScore.toLocaleString()}
        </span>
        <ArcadeButton variant="ghost" accent="violet" className="min-h-[40px] px-3" onClick={doPause}>
          II
        </ArcadeButton>
      </div>

      {/* Canvas surface */}
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center font-mono text-sm text-muted">
            {t('common:loading')}
          </div>
        )}
        {/* Floating-joystick style draws directly on the play surface. */}
        {useSwipe && !paused && !loading && (
          <SwipeOverlay onChange={setHeld} label={t('controlSwipeArea')} />
        )}
      </div>

      {/* On-screen controls */}
      <div className="pb-[max(0.75rem,var(--safe-bottom))] pt-2">
        {useZones ? (
          <ZonePad onChange={setHeld} label={t('controlZonePad')} />
        ) : useSwipe ? (
          <p className="text-center font-mono text-xs text-muted">{t('controlSwipeHint')}</p>
        ) : (
          <VirtualDpad
            layout={controlScheme === 'dpad' ? 'cross' : 'tetris'}
            onDirection={dispatchDir}
            onButton={dispatchBtn}
            labels={{
              left: t('controlLeft'),
              right: t('controlRight'),
              up: t('controlUp'),
              down: t('controlDown'),
              rotate: t('controlRotate'),
              drop: t('controlDrop'),
            }}
          />
        )}
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-night-900/85 backdrop-blur-sm animate-fade-in">
          <div className="flex w-64 flex-col gap-3 text-center">
            <h2 className="font-display text-lg text-neon-amber">{t('gameplayPaused')}</h2>
            <ArcadeButton block onClick={doResume}>
              {t('gameplayResume')}
            </ArcadeButton>
            <ArcadeButton block variant="outline" accent="coral" onClick={onExit}>
              {t('gameplayQuit')}
            </ArcadeButton>
          </div>
        </div>
      )}
    </div>
  );
}
