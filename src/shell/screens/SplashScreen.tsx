import { useTranslation } from 'react-i18next';
import { getAudioEngine, SHELL_MENU_THEME } from '@/audio';
import { useArcadeStore } from '../store';

export function SplashScreen() {
  const { t } = useTranslation();
  const unlockAudio = useArcadeStore((s) => s.unlockAudio);
  const navigate = useArcadeStore((s) => s.navigate);

  const enter = async () => {
    // First user gesture: unlock audio, then start the menu theme.
    await unlockAudio();
    getAudioEngine().playTrack(SHELL_MENU_THEME, 'shell-menu');
    navigate({ name: 'home' });
  };

  return (
    <button
      type="button"
      onClick={() => void enter()}
      className="relative flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center"
    >
      <div className="animate-slide-up">
        <h1 className="font-display text-4xl leading-tight text-neon-amber animate-flicker">
          2Gen
        </h1>
        <h1 className="font-display text-4xl leading-tight text-neon-violet">Arcade</h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-muted">
          {t('homeTitle')}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="inline-block rounded-arcade border border-amber/50 px-5 py-3 font-mono text-sm uppercase tracking-widest text-amber-glow shadow-glow-amber animate-pulse-glow">
          {t('splashTap')}
        </span>
        <span className="font-mono text-[10px] text-muted">{t('splashHint')}</span>
      </div>
    </button>
  );
}
