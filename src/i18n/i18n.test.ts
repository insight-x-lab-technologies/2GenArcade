import { describe, expect, it } from 'vitest';
import { initI18n } from './index';

describe('i18n', () => {
  it('translates shell + cross-namespace keys', () => {
    const i18n = initI18n();
    void i18n.changeLanguage('pt-BR');
    expect(i18n.t('homeTitle')).toBe('Fliperama');
    expect(i18n.t('common:play')).toBe('Jogar');
    expect(i18n.t('catalog:gameTitles.block-drop')).toBe('Block Drop');
    expect(i18n.t('blockDrop:hudScore')).toBe('Pontos');
  });

  it('falls back and switches to en', () => {
    const i18n = initI18n();
    void i18n.changeLanguage('en');
    expect(i18n.t('homeTitle')).toBe('Arcade');
  });
});
