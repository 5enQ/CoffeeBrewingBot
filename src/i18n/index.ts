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
import { EN } from './en-strings';

export type Locale = 'ru' | 'en' | 'ja' | 'zh';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文' },
];

/** Locales users can switch to. Add one here once its translation is complete. */
export const ENABLED_LOCALES: Locale[] = ['ru', 'en'];

/** Telegram languages whose users mostly read Russian; everyone else gets English (when it is enabled) */
const RUSSIAN_READERS = ['ru', 'be', 'kk', 'ky'];

const DICTS: Record<Locale, Messages> = { ru, en, ja, zh };
const FALLBACK: Record<Locale, Locale[]> = { ru: ['ru'], en: ['en', 'ru'], ja: ['ja', 'en', 'ru'], zh: ['zh', 'en', 'ru'] };

let current: Locale = 'ru';

/** Pick a supported locale from Telegram's language_code and browser languages */
export function detectLocale(preferred: (string | undefined | null)[]): Locale {
  for (const raw of preferred) {
    const code = (raw ?? '').toLowerCase().split(/[-_]/)[0];
    if (!code) continue;
    if (RUSSIAN_READERS.includes(code)) return 'ru';
    if (ENABLED_LOCALES.includes(code as Locale)) return code as Locale;
    // the first language the user has set decides: a Japanese phone gets English, not Russian
    return ENABLED_LOCALES.includes('en') ? 'en' : 'ru';
  }
  return 'ru';
}

const LANG_KEY = 'brewbook.lang';
// this module is also loaded by the server (worker/), which has no browser globals
type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
const browser = globalThis as { localStorage?: KV; document?: { documentElement: { lang: string } } };
/** The language picked by hand on this device ('auto' or none — follow Telegram) */
export function chosenLocale(): Locale | 'auto' {
  try { const v = browser.localStorage?.getItem(LANG_KEY) as Locale | null; return v && ENABLED_LOCALES.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}
export function chooseLocale(v: Locale | 'auto') {
  try { if (v === 'auto') browser.localStorage?.removeItem(LANG_KEY); else browser.localStorage?.setItem(LANG_KEY, v); } catch { /* private mode */ }
}

export function setLocale(locale: Locale) {
  current = ENABLED_LOCALES.includes(locale) ? locale : 'ru';
  if (browser.document) browser.document.documentElement.lang = current;
}

export const getLocale = () => current;

/** An error whose message is already written for the user (translated); other errors get a generic message */
export class UserError extends Error {}

/** Marks a Russian string for translation without translating it here: it is passed to tr() later */
export const N_ = (ru: string) => ru;

/** The decimal separator shown: 93,1 in Russian, 93.1 in English (typed input takes either) */
export const decSep = () => (current === 'ru' ? ',' : '.');

/** The locale for Intl dates and numbers: English with a 24-hour clock and day-month order */
export const intlLocale = () => (current === 'ru' ? 'ru-RU' : 'en-GB');

/**
 * Translate a Russian interface string (gettext style: the Russian text is the key).
 * `{0}`, `{1}`… are filled from args. In Russian the text is returned as it is;
 * otherwise from the English dictionary, falling back to the Russian when a string is missing.
 * Module-level strings are translated once, when the app's modules load: main.tsx sets the locale first.
 */
export function tr(ru: string, ...args: (string | number | null | undefined)[]): string {
  const s = current === 'ru' ? ru : EN[ru] ?? ru;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)] ?? '') : m)) : s;
}

/** A stored Russian value (a country, a process typed or scanned in Russian) shown in the current language */
export const trValue = (v: string) => (current === 'ru' || !v ? v : EN[v] ?? EN[v.toLowerCase()] ?? v);

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
