import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameMeta } from '@/types';
import { ArcadeButton, TrophyBadge } from '@/ui';
import { getCatalogGame } from '@/data/catalog';
import { getPackForGame } from '@/data/packs';
import { getAudioEngine } from '@/audio';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

interface GameDetailScreenProps {
  gameId: string;
}

export function GameDetailScreen({ gameId }: GameDetailScreenProps) {
  const { t } = useTranslation();
  const game = getCatalogGame(gameId);
  const back = useArcadeStore((s) => s.back);
  const navigate = useArcadeStore((s) => s.navigate);
  const unlocked = useArcadeStore((s) => s.isGameUnlocked(gameId));
  const best = useArcadeStore((s) => s.bestScore(gameId));
  const unlockedTrophies = useArcadeStore((s) => s.unlockedTrophies);
  const audioUnlocked = useArcadeStore((s) => s.audioUnlocked);

  const [meta, setMeta] = useState<GameMeta | null>(null);

  useEffect(() => {
    if (!game || game.status !== 'available' || !game.load) return;
    let active = true;
    void game.load().then((factory) => {
      if (!active) return;
      setMeta(factory.meta);
      if (audioUnlocked && factory.sounds?.menu) {
        getAudioEngine().playTrack(factory.sounds.menu, `menu:${gameId}`);
      }
    });
    return () => {
      active = false;
    };
  }, [game, gameId, audioUnlocked]);

  if (!game) {
    return (
      <ScreenShell title={t('common:back')} onBack={back}>
        <p className="font-mono text-sm text-muted">404</p>
      </ScreenShell>
    );
  }

  const pack = getPackForGame(gameId);
  const planned = game.status === 'planned';
  const unlockedIds = new Set(unlockedTrophies.filter((tr) => tr.gameId === gameId).map((tr) => tr.trophyId));

  return (
    <ScreenShell title={t(game.titleKey)} onBack={back}>
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div className="grid place-items-center rounded-arcade border border-white/10 bg-night-700/50 py-10 text-7xl shadow-glow-amber">
          <span aria-hidden>{game.thumbnail}</span>
        </div>

        <div className="flex items-center justify-between rounded-arcade border border-white/10 bg-night-700/40 px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted">
            {t('detailBest')}
          </span>
          <span className="font-display text-base text-neon-amber tabular-nums">
            {best > 0 ? best.toLocaleString() : t('detailNoScore')}
          </span>
        </div>

        {!planned && meta?.descriptionKey && (
          <p className="font-mono text-sm leading-relaxed text-ink/90">{t(meta.descriptionKey)}</p>
        )}

        {planned && (
          <p className="rounded-arcade border border-violet/30 bg-violet/10 px-4 py-3 text-center font-mono text-sm text-violet">
            {t('common:comingSoon')}
          </p>
        )}

        {!planned && !unlocked && (
          <div className="rounded-arcade border border-coral/40 bg-coral/10 px-4 py-3 text-center">
            <p className="font-mono text-sm text-coral">{t('detailLocked')}</p>
          </div>
        )}

        {/* Actions */}
        {!planned && unlocked && (
          <ArcadeButton block onClick={() => navigate({ name: 'play', gameId })}>
            ▶ {t('common:play')}
          </ArcadeButton>
        )}
        {!planned && !unlocked && (
          <ArcadeButton block accent="violet" onClick={() => navigate({ name: 'store' })}>
            {t('detailGoToStore')}
          </ArcadeButton>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ArcadeButton variant="outline" accent="violet" onClick={() => navigate({ name: 'leaderboard', gameId })}>
            {t('detailLeaderboard')}
          </ArcadeButton>
          <ArcadeButton
            variant="outline"
            accent="coral"
            onClick={() => navigate({ name: 'trophies', gameId })}
          >
            {t('detailTrophies')}
          </ArcadeButton>
        </div>

        {!planned && meta?.howToPlayKey && (
          <section>
            <h3 className="mb-2 font-display text-[10px] text-ink">{t('detailHowToPlay')}</h3>
            <p className="font-mono text-xs leading-relaxed text-muted">{t(meta.howToPlayKey)}</p>
          </section>
        )}

        {!planned && meta && meta.trophies.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-[10px] text-ink">{t('detailTrophies')}</h3>
            <div className="flex flex-col gap-2">
              {meta.trophies.map((tr) => (
                <TrophyBadge
                  key={tr.id}
                  icon={tr.icon}
                  name={t(tr.nameKey)}
                  description={t(tr.descriptionKey)}
                  unlocked={unlockedIds.has(tr.id)}
                  secret={tr.secret}
                  secretLabel={t('trophiesLockedSecret')}
                />
              ))}
            </div>
          </section>
        )}

        {pack && !pack.free && (
          <p className="text-center font-mono text-[10px] text-muted">{t(pack.nameKey)}</p>
        )}
      </div>
    </ScreenShell>
  );
}
