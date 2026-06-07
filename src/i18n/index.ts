import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { ptBR } from './locales/ptBR';
import { en } from './locales/en';

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const NAMESPACES = ['common', 'shell', 'catalog', 'blockDrop', 'snakeCoil', 'riverRun', 'roadBurner', 'starDefender', 'brickBounce'] as const;

const resources = {
  'pt-BR': ptBR,
  en,
};

export function initI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      // Region codes resolve via i18next's hierarchy (en-US -> en); 'dev' keeps
      // i18next's internal default language supported.
      // NOTE: do NOT enable nonExplicitSupportedLngs — combined with the
      // detector it produced an empty `languages` array and rendered raw keys.
      supportedLngs: ['pt-BR', 'en', 'dev'],
      ns: NAMESPACES as unknown as string[],
      defaultNS: 'shell',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: '2genarcade.lang',
        caches: ['localStorage'],
      },
      react: { useSuspense: false },
      returnNull: false,
    });
  return i18n;
}

export function setAppLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
}

export default i18n;
