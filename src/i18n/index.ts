/**
 * Localization groundwork.
 *
 * - `ru.ts` is the source of truth for keys; `en`, `ja`, `zh` may be partial.
 * - Lookup order: current locale → English → Russian → the key itself.
 * - Only locales listed in ENABLED_LOCALES can be selected. Until a translation covers
 *   the whole interface, it stays disabled so users never see a half-translated app.
 *
 * Adding a string: add the key to `ru.ts`, use `t('key')` in the code, then add translations.
 */
import { en } from './en';
import { ja } from './ja';
import { ru, type MessageKey, type Messages, type PluralMessage } from './ru';
import { zh } from './zh';

export type Locale = 'ru' | 'en' | 'ja' | 'zh';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文' },
];

/** Locales users can switch to. Add one here once its translation is complete. */
export const ENABLED_LOCALES: Locale[] = ['ru'];

const DICTS: Record<Locale, Messages> = { ru, en, ja, zh };
const FALLBACK: Record<Locale, Locale[]> = { ru: ['ru'], en: ['en', 'ru'], ja: ['ja', 'en', 'ru'], zh: ['zh', 'en', 'ru'] };

let current: Locale = 'ru';

/** Pick a supported locale from Telegram's language_code and browser languages */
export function detectLocale(preferred: (string | undefined | null)[]): Locale {
  for (const raw of preferred) {
    const code = (raw ?? '').toLowerCase().split(/[-_]/)[0] as Locale;
    if (ENABLED_LOCALES.includes(code)) return code;
  }
  return 'ru';
}

export function setLocale(locale: Locale) {
  current = ENABLED_LOCALES.includes(locale) ? locale : 'ru';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export const getLocale = () => current;

function lookup(key: MessageKey): string | PluralMessage | undefined {
  for (const l of FALLBACK[current]) {
    const v = DICTS[l][key];
    if (v !== undefined) return v;
  }
  return undefined;
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** Translate a key; `{name}` placeholders are filled from vars */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const v = lookup(key);
  if (v === undefined) return key;
  return fill(typeof v === 'string' ? v : v.other ?? Object.values(v)[0] ?? key, vars);
}

/** Translate a plural message for the number n (`{n}` is filled in) */
export function tn(key: MessageKey, n: number, vars?: Record<string, string | number>): string {
  const v = lookup(key);
  if (v === undefined) return key;
  if (typeof v === 'string') return fill(v, { n, ...vars });
  const cat = new Intl.PluralRules(current).select(n);
  return fill(v[cat] ?? v.other ?? Object.values(v)[0] ?? key, { n, ...vars });
}

/** True when a key exists in the dictionaries (used for optional keys like custom method names) */
export const hasKey = (key: string): key is MessageKey => key in ru;
