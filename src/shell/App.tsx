import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAudioEngine, SHELL_MENU_THEME } from '@/audio';
import { ArcadeButton, Modal, Toast, cn } from '@/ui';
import { getCatalogGame } from '@/data/catalog';
import { useArcadeStore, selectCurrentRoute } from './store';
import { GameHost } from './GameHost';
import { SplashScreen } from './screens/SplashScreen';
import { HomeScreen } from './screens/HomeScreen';
import { GameDetailScreen } from './screens/GameDetailScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { StoreScreen } from './screens/StoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TrophiesScreen } from './screens/TrophiesScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { AboutScreen } from './screens/AboutScreen';

const SHELL_MUSIC_ROUTES = new Set(['home', 'store', 'settings', 'trophies', 'leaderboard', 'gameover', 'about']);

export function App() {
  const { t } = useTranslation();
  const ready = useArcadeStore((s) => s.ready);
  const init = useArcadeStore((s) => s.init);
  const route = useArcadeStore(selectCurrentRoute);
  const history = useArcadeStore((s) => s.history);
  const playNonce = useArcadeStore((s) => s.playNonce);
  const back = useArcadeStore((s) => s.back);
  const crtEnabled = useArcadeStore((s) => s.settings.crtEnabled);
  const audioUnlocked = useArcadeStore((s) => s.audioUnlocked);
  const toast = useArcadeStore((s) => s.toast);
  const dismissToast = useArcadeStore((s) => s.dismissToast);
  const syncNow = useArcadeStore((s) => s.syncNow);

  const nickname = useArcadeStore((s) => s.nickname);
  const setNickname = useArcadeStore((s) => s.setNickname);
  const [nickAsked, setNickAsked] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  useEffect(() => {
    void init();
  }, [init]);

  // Flush any queued scores once the app is up (and we're online).
  useEffect(() => {
    if (ready) void syncNow();
  }, [ready, syncNow]);

  // Keep the menu theme playing on non-gameplay screens.
  useEffect(() => {
    if (!audioUnlocked) return;
    if (SHELL_MUSIC_ROUTES.has(route.name)) {
      getAudioEngine().playTrack(SHELL_MENU_THEME, 'shell-menu');
    }
  }, [route.name, audioUnlocked]);

  // Ask for a nickname once, after first reaching Home.
  useEffect(() => {
    if (ready && route.name === 'home' && nickname === '' && !nickAsked) {
      setNickAsked(true);
    }
  }, [ready, route.name, nickname, nickAsked]);

  const showNickPrompt = ready && route.name === 'home' && nickname === '' && nickAsked;

  const screen = (() => {
    switch (route.name) {
      case 'splash':
        return <SplashScreen />;
      case 'home':
        return <HomeScreen />;
      case 'detail':
        return route.gameId ? <GameDetailScreen gameId={route.gameId} /> : <HomeScreen />;
      case 'play':
        return route.gameId ? (
          <PlayRoute gameId={route.gameId} sessionKey={`${history.length}-${playNonce}`} onExit={back} />
        ) : (
          <HomeScreen />
        );
      case 'gameover':
        return route.gameId ? <GameOverScreen gameId={route.gameId} /> : <HomeScreen />;
      case 'store':
        return <StoreScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'trophies':
        return <TrophiesScreen {...(route.gameId ? { gameId: route.gameId } : {})} />;
      case 'leaderboard':
        return route.gameId ? <LeaderboardScreen gameId={route.gameId} /> : <HomeScreen />;
      case 'about':
        return <AboutScreen />;
      default:
        return <HomeScreen />;
    }
  })();

  const toastMessage = toast ? String(t(toast.key, toast.values ?? {})) : null;

  return (
    <div className={cn('relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-night-900', crtEnabled && 'crt-on')}>
      {!ready ? (
        <div className="grid h-full place-items-center font-mono text-sm text-muted">
          {t('common:loading')}
        </div>
      ) : (
        screen
      )}

      <div className="crt-overlay" aria-hidden />
      <Toast message={toastMessage} onDismiss={dismissToast} />

      <Modal
        open={showNickPrompt}
        title={t('nicknamePromptTitle')}
        onClose={() => setNickAsked(false)}
        closeOnBackdrop={false}
      >
        <p className="mb-3 font-mono text-xs text-muted">{t('nicknamePromptHint')}</p>
        <input
          autoFocus
          value={nickDraft}
          onChange={(e) => setNickDraft(e.target.value)}
          maxLength={12}
          placeholder={t('settingsNicknamePlaceholder')}
          className="mb-4 min-h-[48px] w-full rounded-arcade border border-white/10 bg-night-900 px-4 font-mono text-sm text-ink placeholder:text-muted/60 focus:border-amber focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <ArcadeButton variant="ghost" onClick={() => setNickAsked(false)}>
            {t('common:cancel')}
          </ArcadeButton>
          <ArcadeButton
            onClick={() => {
              if (nickDraft.trim()) setNickname(nickDraft.trim());
              setNickAsked(false);
            }}
          >
            {t('common:save')}
          </ArcadeButton>
        </div>
      </Modal>
    </div>
  );
}

function PlayRoute({
  gameId,
  sessionKey,
  onExit,
}: {
  gameId: string;
  sessionKey: string;
  onExit: () => void;
}) {
  const game = getCatalogGame(gameId);
  if (!game || game.status !== 'available') return <HomeScreen />;
  return <GameHost key={`play-${gameId}-${sessionKey}`} game={game} onExit={onExit} />;
}
