import { useTranslation } from 'react-i18next';
import { Toggle, VolumeSlider, cn } from '@/ui';
import { hapticsSupported } from '@/lib';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import { APP_VERSION } from '../constants';
import { ScreenShell } from '../ScreenShell';
import { useArcadeStore, type ControlStyle } from '../store';

const LANG_LABEL: Record<AppLanguage, string> = {
  'pt-BR': 'Português',
  en: 'English',
};

const CONTROL_STYLES: Array<{ id: ControlStyle; glyph: string }> = [
  { id: 'dpad', glyph: '✚' },
  { id: 'zones', glyph: '◉' },
  { id: 'swipe', glyph: '✦' },
];

export function SettingsScreen() {
  const { t } = useTranslation();
  const back = useArcadeStore((s) => s.back);
  const settings = useArcadeStore((s) => s.settings);
  const nickname = useArcadeStore((s) => s.nickname);
  const reducedMotion = useArcadeStore((s) => s.reducedMotion);
  const setMusicVolume = useArcadeStore((s) => s.setMusicVolume);
  const setSfxVolume = useArcadeStore((s) => s.setSfxVolume);
  const toggleCrt = useArcadeStore((s) => s.toggleCrt);
  const toggleHaptics = useArcadeStore((s) => s.toggleHaptics);
  const toggleClickSound = useArcadeStore((s) => s.toggleClickSound);
  const setLanguage = useArcadeStore((s) => s.setLanguage);
  const setControlStyle = useArcadeStore((s) => s.setControlStyle);
  const setNickname = useArcadeStore((s) => s.setNickname);

  return (
    <ScreenShell title={t('settingsTitle')} onBack={back}>
      <div className="mx-auto flex max-w-md flex-col gap-6">
        {/* Language */}
        <Section title={t('settingsLanguage')}>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={cn(
                  'min-h-[48px] rounded-arcade border px-3 font-mono text-sm transition-colors',
                  settings.language === lang
                    ? 'border-amber bg-amber/15 text-amber-glow shadow-glow-amber'
                    : 'border-white/10 text-muted hover:bg-white/5',
                )}
              >
                {LANG_LABEL[lang]}
              </button>
            ))}
          </div>
        </Section>

        {/* Nickname */}
        <Section title={t('settingsNickname')}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            placeholder={t('settingsNicknamePlaceholder')}
            className="min-h-[48px] w-full rounded-arcade border border-white/10 bg-night-900 px-4 font-mono text-sm text-ink placeholder:text-muted/60 focus:border-amber focus:outline-none"
          />
        </Section>

        {/* Control style */}
        <Section title={t('settingsControl')}>
          <div className="flex flex-col gap-2">
            {CONTROL_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setControlStyle(style.id)}
                aria-pressed={settings.controlStyle === style.id}
                className={cn(
                  'flex min-h-[48px] items-center gap-3 rounded-arcade border px-3 text-left transition-colors',
                  settings.controlStyle === style.id
                    ? 'border-amber bg-amber/15 shadow-glow-amber'
                    : 'border-white/10 hover:bg-white/5',
                )}
              >
                <span aria-hidden className="text-xl text-violet">
                  {style.glyph}
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      'font-mono text-sm',
                      settings.controlStyle === style.id ? 'text-amber-glow' : 'text-ink',
                    )}
                  >
                    {t(`settingsControl_${style.id}`)}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {t(`settingsControl_${style.id}_hint`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted/70">{t('settingsControlNote')}</p>
        </Section>

        {/* Audio */}
        <Section title={t('settingsMusic')}>
          <VolumeSlider
            value={settings.musicVolume}
            onChange={setMusicVolume}
            label={t('settingsMusic')}
            icon="🎵"
          />
          <div className="mt-3">
            <VolumeSlider
              value={settings.sfxVolume}
              onChange={setSfxVolume}
              label={t('settingsSfx')}
              icon="🔊"
            />
          </div>
        </Section>

        {/* Haptics */}
        <Section title={t('settingsHaptics')}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">{t('settingsHaptics')}</span>
            <Toggle
              checked={settings.haptics}
              onChange={toggleHaptics}
              label={t('settingsHaptics')}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted/70">
            {hapticsSupported() ? t('settingsHapticsHint') : t('settingsHapticsUnsupported')}
          </p>
        </Section>

        {/* Click sound */}
        <Section title={t('settingsClickSound')}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">{t('settingsClickSound')}</span>
            <Toggle
              checked={settings.clickSound}
              onChange={toggleClickSound}
              label={t('settingsClickSound')}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted/70">{t('settingsClickSoundHint')}</p>
        </Section>

        {/* CRT */}
        <Section title={t('settingsCrt')}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">{t('settingsCrt')}</span>
            <Toggle checked={settings.crtEnabled} onChange={toggleCrt} label={t('settingsCrt')} />
          </div>
          {reducedMotion && (
            <p className="mt-2 font-mono text-[10px] text-violet">{t('settingsReducedMotion')}</p>
          )}
        </Section>

        {/* About */}
        <Section title={t('settingsAbout')}>
          <p className="font-mono text-xs leading-relaxed text-muted">{t('settingsAboutText')}</p>
          <p className="mt-2 font-mono text-[10px] text-muted/70">
            {t('settingsVersion', { version: APP_VERSION })}
          </p>
        </Section>
      </div>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-[10px] text-ink">{title}</h2>
      <div className="rounded-arcade border border-white/10 bg-night-700/40 p-4">{children}</div>
    </section>
  );
}
