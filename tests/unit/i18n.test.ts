import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { ENABLED_LOCALES, detectLocale, getLocale, setLocale, t, tn } from '../../src/i18n';
import { ja } from '../../src/i18n/ja';
import { ru } from '../../src/i18n/ru';
import { zh } from '../../src/i18n/zh';

describe('i18n', () => {
  afterEach(() => setLocale('ru'));

  it('translations only use keys that exist in ru', () => {
    for (const [name, dict] of Object.entries({ en, ja, zh })) {
      const extra = Object.keys(dict).filter((k) => !(k in ru));
      expect(extra, name).toEqual([]);
    }
  });

  it('English covers every key (it is the fallback for ja and zh)', () => {
    expect(Object.keys(ru).filter((k) => !(k in en))).toEqual([]);
  });

  it('plural messages keep {n} and an "other" form', () => {
    for (const dict of [ru, en, ja, zh] as Record<string, unknown>[]) {
      for (const v of Object.values(dict)) {
        if (typeof v === 'object' && v) {
          expect(Object.keys(v)).toContain('other');
          Object.values(v).forEach((s) => expect(s).toContain('{n}'));
        }
      }
    }
  });

  it('Russian is the only enabled locale for now', () => {
    expect(ENABLED_LOCALES).toEqual(['ru']);
    expect(detectLocale(['en-US', 'ja'])).toBe('ru');
    setLocale('en');
    expect(getLocale()).toBe('ru');
  });

  it('translates and pluralizes in Russian', () => {
    expect(t('tab.shelf')).toBe('Полка');
    expect(t('method.chemex')).toBe('Кемекс');
    expect(tn('unit.drips', 1)).toBe('1 дрип');
    expect(tn('unit.drips', 3)).toBe('3 дрипа');
    expect(tn('unit.drips', 11)).toBe('11 дрипов');
    expect(tn('unit.brews', 21)).toBe('21 заварка');
  });
});
