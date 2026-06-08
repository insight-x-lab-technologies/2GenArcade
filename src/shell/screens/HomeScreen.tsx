import { useTranslation } from 'react-i18next';
import { GameCard, StatusHeader } from '@/ui';
import { CATALOG } from '@/data/catalog';
import { PACKS } from '@/data/packs';
import { APP_VERSION, STUDIO_NAME, STUDIO_COPYRIGHT_YEAR } from '../constants';
import { useArcadeStore } from '../store';

export function HomeScreen() {
  const { t } = useTranslation();
  const online = useArcadeStore((s) => s.online);
  const navigate = useArcadeStore((s) => s.navigate);
  const isGameUnlocked = useArcadeStore((s) => s.isGameUnlocked);

  return (
    <div className="flex h-full flex-col">
      <StatusHeader
        title={t('homeTitle')}
        online={online}
        onlineLabel={t('common:online')}
        offlineLabel={t('common:offline')}
        right={
          <div className="flex items-center gap-1">
            <NavIcon glyph="🏆" label={t('navTrophies')} onClick={() => navigate({ name: 'trophies' })} />
            <NavIcon glyph="🛒" label={t('navStore')} onClick={() => navigate({ name: 'store' })} />
            <NavIcon glyph="ℹ️" label={t('navAbout')} onClick={() => navigate({ name: 'about' })} />
            <NavIcon glyph="⚙️" label={t('navSettings')} onClick={() => navigate({ name: 'settings' })} />
          </div>
        }
      />

      <main className="scroll-night min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 animate-fade-in">
        <p className="mb-4 font-mono text-xs text-muted">{t('homeSubtitle')}</p>

        {PACKS.map((pack) => {
          const games = CATALOG.filter((g) => g.packId === pack.id);
          return (
            <section key={pack.id} className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[11px] text-ink">{t(pack.nameKey)}</h2>
                {!pack.free && (
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted">
                    {t('homeLockedHint')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {games.map((game) => {
                  const unlocked = isGameUnlocked(game.id);
                  const planned = game.status === 'planned';
                  return (
                    <GameCard
                      key={game.id}
                      title={t(game.titleKey)}
                      thumbnail={game.thumbnail}
                      accent={game.accent}
                      locked={!unlocked}
                      comingSoon={planned && unlocked}
                      comingSoonLabel={t('common:comingSoon')}
                      lockedLabel={t('common:locked')}
                      onClick={() => navigate({ name: 'detail', gameId: game.id })}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        <button
          type="button"
          onClick={() => navigate({ name: 'about' })}
          className="mt-2 w-full text-center font-mono text-[10px] leading-relaxed text-muted/60 transition-colors hover:text-muted"
        >
          <span className="block">{t('settingsVersion', { version: APP_VERSION })}</span>
          <span className="block">
            {t('aboutCopyright', { year: STUDIO_COPYRIGHT_YEAR, studio: STUDIO_NAME })}
          </span>
        </button>
      </main>
    </div>
  );
}

function NavIcon({ glyph, label, onClick }: { glyph: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-arcade text-lg hover:bg-white/5 active:translate-y-[1px]"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
