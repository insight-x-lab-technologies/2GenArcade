import 'i18next';
import type { AppResources } from './locales/ptBR';

// Type-safe translation keys: t('navHome') resolves against the default 'shell'
// namespace, t('common:play') against others.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'shell';
    resources: AppResources;
  }
}
