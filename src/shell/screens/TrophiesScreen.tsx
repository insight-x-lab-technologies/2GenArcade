import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrophyDef } from '@/types';
import { TrophyBadge } from '@/ui';
import { CATALOG, getCatalogGame } from '@/data/catalog';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

interface TrophiesScreenProps {
  gameId?: string;
}

interface GameTrophies {
  gameId: string;
  titleKey: string;
  defs: TrophyDef[];
}

export function TrophiesScreen({ gameId }: TrophiesScreenProps) {
  const { t } = useTranslation();
  const back = useArcadeStore((s) => s.back);
  const unlockedTrophies = useArcadeStore((s) => s.unlockedTrophies);
  const [groups, setGroups] = useState<GameTrophies[]>([]);

  useEffect(() => {
    let active = true;
    const targets = gameId
      ? CATALOG.filter((g) => g.id === gameId && g.status === 'available')
      : CATALOG.filter((g) => g.status === 'available');
    void Promise.all(
      targets.map(async (g) => {
        const factory = await g.load!();
        return { gameId: g.id, titleKey: g.titleKey, defs: factory.meta.trophies };
      }),
    ).then((result) => {
      if (active) setGroups(result);
    });
    return () => {
      active = false;
    };
  }, [gameId]);

  const unlockedSet = new Set(unlockedTrophies.map((tr) => `${tr.gameId}:${tr.trophyId}`));
  const title = gameId ? t(getCatalogGame(gameId)?.titleKey ?? 'trophiesTitle') : t('trophiesGlobal');

  const totalDefs = groups.reduce((sum, g) => sum + g.defs.length, 0);
  const totalUnlocked = groups.reduce(
    (sum, g) => sum + g.defs.filter((d) => unlockedSet.has(`${g.gameId}:${d.id}`)).length,
    0,
  );

  return (
    <ScreenShell title={t('trophiesTitle')} onBack={back}>
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div className="rounded-arcade border border-amber/30 bg-night-700/40 px-4 py-3 text-center">
          <p className="font-display text-[11px] text-ink">{title}</p>
          {totalDefs > 0 && (
            <p className="mt-1 font-mono text-xs text-amber-glow">
              {t('trophiesProgress', { unlocked: totalUnlocked, total: totalDefs })}
            </p>
          )}
        </div>

        {totalDefs === 0 && (
          <p className="text-center font-mono text-sm text-muted">{t('trophiesEmpty')}</p>
        )}

        {groups.map((group) => (
          <section key={group.gameId}>
            {!gameId && (
              <h3 className="mb-2 font-display text-[10px] text-ink">{t(group.titleKey)}</h3>
            )}
            <div className="flex flex-col gap-2">
              {group.defs.map((tr) => (
                <TrophyBadge
                  key={tr.id}
                  icon={tr.icon}
                  name={t(tr.nameKey)}
                  description={t(tr.descriptionKey)}
                  unlocked={unlockedSet.has(`${group.gameId}:${tr.id}`)}
                  secret={tr.secret}
                  secretLabel={t('trophiesLockedSecret')}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ScreenShell>
  );
}
