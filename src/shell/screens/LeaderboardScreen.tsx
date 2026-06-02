import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeaderboardView } from '@/types';
import { cn } from '@/ui';
import { getLeaderboardService } from '@/lib';
import { getCatalogGame } from '@/data/catalog';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

interface LeaderboardScreenProps {
  gameId: string;
}

export function LeaderboardScreen({ gameId }: LeaderboardScreenProps) {
  const { t } = useTranslation();
  const back = useArcadeStore((s) => s.back);
  const best = useArcadeStore((s) => s.bestScore(gameId));
  const nickname = useArcadeStore((s) => s.nickname.trim());
  const online = useArcadeStore((s) => s.online);
  const [view, setView] = useState<LeaderboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const game = getCatalogGame(gameId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getLeaderboardService()
      .getLeaderboard(gameId, { playerBest: best > 0 ? best : null, limit: 25 })
      .then((v) => {
        if (active) {
          setView(v);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [gameId, best, online]);

  return (
    <ScreenShell title={game ? t(game.titleKey) : t('leaderboardTitle')} onBack={back}>
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <h2 className="text-center font-display text-[11px] text-neon-amber">
          {t('leaderboardTitle')}
        </h2>

        {view?.fromCache && (
          <p className="rounded-arcade border border-violet/30 bg-violet/10 px-3 py-2 text-center font-mono text-[10px] text-violet">
            {t('leaderboardCached')}
          </p>
        )}

        {loading && <p className="text-center font-mono text-sm text-muted">{t('common:loading')}</p>}

        {!loading && view && view.top.length === 0 && (
          <p className="text-center font-mono text-sm text-muted">{t('leaderboardEmpty')}</p>
        )}

        {!loading && view && view.top.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {view.top.map((entry, index) => {
              const isYou = nickname.length > 0 && entry.nickname === nickname;
              return (
                <li
                  key={entry.id || `${entry.nickname}-${index}`}
                  className={cn(
                    'flex items-center gap-3 rounded-arcade border px-3 py-2 font-mono text-sm',
                    index === 0
                      ? 'border-amber/50 bg-amber/10'
                      : isYou
                        ? 'border-violet/50 bg-violet/10'
                        : 'border-white/10 bg-night-700/40',
                  )}
                >
                  <span className="w-7 text-center font-display text-[10px] text-muted">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-ink">
                    {entry.nickname}
                    {isYou && <span className="ml-2 text-[10px] text-violet">({t('leaderboardYou')})</span>}
                  </span>
                  <span className="tabular-nums text-amber-glow">{entry.score.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
        )}

        {view?.playerRank && (
          <p className="mt-2 text-center font-mono text-xs text-muted">
            {t('leaderboardYourRank', { rank: view.playerRank })}
          </p>
        )}
      </div>
    </ScreenShell>
  );
}
