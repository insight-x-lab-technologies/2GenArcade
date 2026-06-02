import { useTranslation } from 'react-i18next';
import { ArcadeButton, TrophyBadge } from '@/ui';
import { getCatalogGame } from '@/data/catalog';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

interface GameOverScreenProps {
  gameId: string;
}

export function GameOverScreen({ gameId }: GameOverScreenProps) {
  const { t } = useTranslation();
  const run = useArcadeStore((s) => s.lastRun);
  const navigate = useArcadeStore((s) => s.navigate);
  const showToast = useArcadeStore((s) => s.showToast);
  const game = getCatalogGame(gameId);
  const title = game ? t(game.titleKey) : '';

  const submitLabel: Record<string, string> = {
    submitting: t('gameoverSubmitting'),
    submitted: t('gameoverSubmitted'),
    queued: t('gameoverQueued'),
    rejected: t('gameoverRejected'),
    idle: '',
  };

  const onShare = async () => {
    const text = `${title} — ${run?.score ?? 0} — 2GenArcade`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard?.writeText(text);
      showToast({ key: 'gameoverShare' });
    }
  };

  return (
    <ScreenShell title={t('gameoverTitle')} onBack={() => navigate({ name: 'home' })}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5 pt-4 text-center">
        {run?.isNewRecord && (
          <p className="font-display text-sm text-neon-amber animate-pulse-glow">
            ✦ {t('gameoverNewRecord')} ✦
          </p>
        )}

        <div className="w-full rounded-arcade border border-amber/30 bg-night-700/50 py-6 shadow-glow-amber">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {t('gameoverScore')}
          </p>
          <p className="mt-1 font-display text-4xl text-neon-amber tabular-nums">
            {(run?.score ?? 0).toLocaleString()}
          </p>
          <p className="mt-2 font-mono text-xs text-muted">
            {t('gameoverBest')}: {(run?.bestScore ?? 0).toLocaleString()}
          </p>
        </div>

        {run && run.submit !== 'idle' && (
          <p
            className={
              run.submit === 'rejected'
                ? 'font-mono text-xs text-coral'
                : 'font-mono text-xs text-muted'
            }
          >
            {submitLabel[run.submit]}
            {run.rank ? ` · ${t('gameoverRank', { rank: run.rank })}` : ''}
          </p>
        )}

        {run && run.newTrophies.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            {run.newTrophies.map((tr) => (
              <TrophyBadge
                key={tr.id}
                icon={tr.icon}
                name={t(tr.nameKey)}
                description={t(tr.descriptionKey)}
                unlocked
              />
            ))}
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          <ArcadeButton block onClick={() => navigate({ name: 'play', gameId })}>
            ↻ {t('gameoverPlayAgain')}
          </ArcadeButton>
          <div className="grid grid-cols-2 gap-3">
            <ArcadeButton variant="outline" accent="violet" onClick={() => void onShare()}>
              {t('gameoverShare')}
            </ArcadeButton>
            <ArcadeButton variant="outline" onClick={() => navigate({ name: 'leaderboard', gameId })}>
              {t('detailLeaderboard')}
            </ArcadeButton>
          </div>
          <ArcadeButton variant="ghost" onClick={() => navigate({ name: 'home' })}>
            {t('gameoverHome')}
          </ArcadeButton>
        </div>
      </div>
    </ScreenShell>
  );
}
