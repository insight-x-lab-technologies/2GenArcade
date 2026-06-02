import { useTranslation } from 'react-i18next';
import type { Pack } from '@/types';
import { ArcadeButton, cn } from '@/ui';
import { PACKS } from '@/data/packs';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

export function StoreScreen() {
  const { t, i18n } = useTranslation();
  const back = useArcadeStore((s) => s.back);
  const entitledPacks = useArcadeStore((s) => s.entitledPacks);
  const purchasePack = useArcadeStore((s) => s.purchasePack);
  const showToast = useArcadeStore((s) => s.showToast);

  const formatPrice = (pack: Pack) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: pack.currency }).format(
      pack.priceCents / 100,
    );

  const onBuy = async (packId: string) => {
    const ok = await purchasePack(packId);
    if (ok) showToast({ key: 'storePurchased' });
  };

  return (
    <ScreenShell title={t('storeTitle')} onBack={back}>
      <p className="mb-4 font-mono text-xs text-muted">{t('storeSubtitle')}</p>
      <p className="mb-5 rounded-arcade border border-violet/30 bg-violet/10 px-3 py-2 font-mono text-[10px] text-violet">
        {t('storeMockNote')}
      </p>

      <div className="flex flex-col gap-4">
        {PACKS.map((pack) => {
          const owned = entitledPacks.includes(pack.id);
          const accentBorder =
            pack.accent === 'violet'
              ? 'border-violet/40 shadow-glow-violet'
              : pack.accent === 'coral'
                ? 'border-coral/40 shadow-glow-coral'
                : 'border-amber/40 shadow-glow-amber';
          return (
            <div
              key={pack.id}
              className={cn('rounded-arcade border bg-night-700/50 p-4', accentBorder)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[11px] text-ink">{t(pack.nameKey)}</h2>
                  <p className="mt-1 font-mono text-xs text-muted">{t(pack.descriptionKey)}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                    {t('storeGamesCount', { count: pack.gameIds.length })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {pack.free ? (
                    <span className="font-mono text-xs text-amber-glow">{t('storeFree')}</span>
                  ) : (
                    <span className="font-display text-sm text-neon-amber">{formatPrice(pack)}</span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                {pack.free || owned ? (
                  <span className="inline-flex items-center gap-1 rounded-arcade bg-night-900/60 px-3 py-2 font-mono text-xs text-emerald-300">
                    ✓ {pack.free ? t('storeFree') : t('storeOwned')}
                  </span>
                ) : (
                  <ArcadeButton accent={pack.accent} onClick={() => void onBuy(pack.id)}>
                    {t('storeBuy')}
                  </ArcadeButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenShell>
  );
}
