import { useTranslation } from 'react-i18next';
import { BrandIcon, type BrandName } from '@/ui';
import {
  SHARE_NETWORKS,
  SHARE_LABELS,
  buildShareTarget,
  playClick,
  type ShareNetwork,
} from '@/lib';
import {
  APP_URL,
  APP_VERSION,
  STUDIO_NAME,
  STUDIO_COPYRIGHT_YEAR,
  DONATE_BUYMEACOFFEE,
  DONATE_KOFI,
} from '../constants';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore } from '../store';

export function AboutScreen() {
  const { t } = useTranslation();
  const back = useArcadeStore((s) => s.back);
  const showToast = useArcadeStore((s) => s.showToast);

  const onShare = async (network: ShareNetwork) => {
    playClick();
    const message = t('shareMessage');
    const target = buildShareTarget(network, message, APP_URL);
    if (target.copyFirst) {
      try {
        await navigator.clipboard?.writeText(`${message} ${APP_URL}`);
      } catch {
        /* clipboard blocked — open the app anyway */
      }
      showToast({ key: 'aboutShareCopied', values: { network: SHARE_LABELS[network] } });
    }
    window.open(target.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <ScreenShell title={t('aboutTitle')} onBack={back}>
      <div className="mx-auto flex max-w-md flex-col gap-6">
        {/* Studio */}
        <section className="rounded-arcade border border-white/10 bg-night-700/40 p-5">
          <h2 className="text-center font-display text-sm text-amber-glow">{STUDIO_NAME}</h2>
          <p className="mt-3 whitespace-pre-line font-mono text-xs leading-relaxed text-muted">
            {t('aboutStudioDescription')}
          </p>
        </section>

        {/* Support */}
        <section>
          <h2 className="mb-2 font-display text-[10px] text-ink">{t('aboutSupport')}</h2>
          <div className="rounded-arcade border border-white/10 bg-night-700/40 p-4">
            <p className="mb-3 font-mono text-[11px] leading-relaxed text-muted">
              {t('aboutSupportHint')}
            </p>
            <div className="flex flex-col gap-2">
              <DonateLink
                href={DONATE_BUYMEACOFFEE}
                icon="buymeacoffee"
                label={t('aboutDonateCoffee')}
              />
              <DonateLink href={DONATE_KOFI} icon="kofi" label={t('aboutDonateKofi')} />
            </div>
          </div>
        </section>

        {/* Share */}
        <section>
          <h2 className="mb-2 font-display text-[10px] text-ink">{t('aboutShare')}</h2>
          <div className="rounded-arcade border border-white/10 bg-night-700/40 p-4">
            <p className="mb-3 font-mono text-[11px] leading-relaxed text-muted">
              {t('aboutShareHint')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SHARE_NETWORKS.map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => void onShare(network)}
                  aria-label={t('aboutShareVia', { network: SHARE_LABELS[network] })}
                  title={SHARE_LABELS[network]}
                  className="grid h-11 w-11 place-items-center rounded-arcade border border-white/10 text-muted transition-colors hover:border-violet/60 hover:text-violet active:translate-y-[1px]"
                >
                  <BrandIcon name={network} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Version + copyright */}
        <footer className="pt-1 text-center font-mono text-[10px] leading-relaxed text-muted/70">
          <p>{t('settingsVersion', { version: APP_VERSION })}</p>
          <p className="mt-1">
            {t('aboutCopyright', { year: STUDIO_COPYRIGHT_YEAR, studio: STUDIO_NAME })}
          </p>
        </footer>
      </div>
    </ScreenShell>
  );
}

function DonateLink({ href, icon, label }: { href: string; icon: BrandName; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => playClick()}
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-arcade border border-amber/60 bg-night-700/40 px-4 font-mono text-sm font-semibold text-amber-glow shadow-glow-amber transition-colors hover:border-amber active:translate-y-[1px]"
    >
      <BrandIcon name={icon} className="h-4 w-4" />
      {label}
    </a>
  );
}
