import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { execSync } from 'node:child_process';
import { ENABLED_LOCALES, decSep, detectLocale, getLocale, intlLocale, setLocale, t, tn, tr, trValue } from '../../src/i18n';
import { EN } from '../../src/i18n/en-strings';
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

  it('Russian and English are enabled; Telegram\'s language picks one', () => {
    expect(ENABLED_LOCALES).toEqual(['ru', 'en']);
    expect(detectLocale(['ru'])).toBe('ru');
    expect(detectLocale(['kk'])).toBe('ru');
    expect(detectLocale(['ja', 'ru'])).toBe('en'); // the first language decides: a Japanese phone gets English
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale([undefined, ''])).toBe('ru');
    setLocale('ja');
    expect(getLocale()).toBe('ru');
  });

  it('tr() returns the Russian as is, or the English with its placeholders filled', () => {
    expect(tr('Осталось в пачке')).toBe('Осталось в пачке');
    expect(tr('Шаг {0}: граммы', 2)).toBe('Шаг 2: граммы');
    setLocale('en');
    expect(tr('Осталось в пачке')).toBe('Left in the pack');
    expect(tr('Шаг {0}: граммы', 2)).toBe('Step 2: grams');
    expect(tr('Строка, которой нет в словаре')).toBe('Строка, которой нет в словаре');
    expect(trValue('Эфиопия')).toBe('Ethiopia');
    expect(trValue('Моя страна')).toBe('Моя страна');
    expect(decSep()).toBe('.');
    expect(intlLocale()).toBe('en-GB');
  });

  it('every interface string in src/ has an English translation', () => {
    const keys: string[] = JSON.parse(execSync('node scripts/i18n-keys.mjs', { encoding: 'utf8' }));
    expect(keys.length).toBeGreaterThan(1000);
    expect(keys.filter((k) => !(k in EN))).toEqual([]);
  });

  it('English keeps the placeholders of the Russian', () => {
    const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();
    expect(Object.entries(EN).filter(([ru, en]) => ph(ru) !== ph(en)).map(([ru]) => ru)).toEqual([]);
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

describe('server words shown in English', () => {
  it('every kind of non-coffee code has an English name', async () => {
    const src = (await import('node:fs')).readFileSync('worker/src/notpack.ts', 'utf8');
    const labels = [...src.matchAll(/'([^']*[А-Яа-яЁё][^']*)'/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(10);
    expect(labels.filter((l) => !(l in EN))).toEqual([]);
  });
});
