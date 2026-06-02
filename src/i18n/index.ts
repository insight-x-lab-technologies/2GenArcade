import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { ptBR } from './locales/ptBR';
import { en } from './locales/en';

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const NAMESPACES = ['common', 'shell', 'catalog', 'blockDrop'] as const;

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
      fallbackLng: 'pt-BR',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      nonExplicitSupportedLngs: true,
      ns: NAMESPACES as unknown as string[],
      defaultNS: 'shell',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: '2genarcade.lang',
        caches: ['localStorage'],
      },
      returnNull: false,
    });
  return i18n;
}

export function setAppLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
}

export default i18n;
