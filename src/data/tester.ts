/**
 * Testers (the «Тестировщик» grant): the owner's checklist for the version under test, answers on it,
 * bug reports with a screenshot and a diagnostics line — all go to the owner as bot messages.
 */
import { RATINGS_API } from '../config';
import { platform } from '../platform';

export interface CheckItem {
  id: string; text: string; ok: number; bug: number;
  /** this tester's answer */
  mine?: 'ok' | 'bug';
  /** owner only: who answered what */
  answers?: { who: string; state: 'ok' | 'bug'; note?: string; ts: number }[];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return { ok: false, error: 'Работает только в Telegram' };
  try {
    const r = await fetch(`${RATINGS_API}/tester`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, ...body }) });
    if (r.status === 429) return { ok: false, error: 'Слишком много сообщений за сегодня — продолжим завтра' };
    if (!r.ok) return { ok: false, error: r.status === 403 ? 'Нужна роль тестировщика' : 'Не получилось отправить — попробуйте ещё раз' };
    return { ok: true, data: await r.json() as T };
  } catch { return { ok: false, error: 'Нет связи с сервером' }; }
}

export const loadChecks = () => call<{ checks: CheckItem[] }>({ action: 'checks' });
export const answerCheck = (item: string, state: 'ok' | 'bug', text?: string, image?: string) =>
  call<{ checks: CheckItem[] }>({ action: 'answer', item, state, text, image, context: diagLine() });
export const sendReport = (text: string, image?: string) => call<{ ok: true }>({ action: 'report', text, image, context: diagLine() });

/* ---------- diagnostics ---------- */

const appVersion = () => import.meta.env.VITE_APP_VERSION || 'разработка';

export interface Diag { label: string; value: string }

/** what a tester's report carries, and what the diagnostics block shows */
export function diagnostics(extra: { server?: string; sync?: string } = {}): Diag[] {
  return [
    { label: 'Приложение', value: appVersion() },
    { label: 'Сервер', value: extra.server ?? '…' },
    { label: 'Платформа', value: platform.clientInfo?.() ?? platform.kind },
    { label: 'Экран', value: `${window.innerWidth}×${window.innerHeight} · ${Math.round(devicePixelRatio * 10) / 10}x · ${matchMedia('(prefers-color-scheme: dark)').matches ? 'тёмная тема' : 'светлая тема'}` },
    { label: 'Система', value: systemOf(navigator.userAgent) },
    { label: 'Синхронизация', value: extra.sync ?? '—' },
  ];
}

/**
 * The system and the built-in browser the app runs in, short: «Android 14 · WebView 130», «iOS 17.5», «Windows · Chrome 130».
 * Useful when something looks wrong only on some phones; nothing personal is in it.
 */
export function systemOf(ua: string): string {
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const ios = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/) ?? (/Macintosh/.test(ua) && /Mobile\//.test(ua) ? ua.match(/Version\/(\d+)\.(\d+)/) : null);
  const chrome = ua.match(/Chrome\/(\d+)/);
  if (android) return `Android ${android[1]}${chrome ? ` · ${/; wv\)|Version\/\d/.test(ua) ? 'WebView' : 'Chrome'} ${chrome[1]}` : ''}`;
  if (ios) return `iOS ${ios[1]}.${ios[2]}`;
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'другая система';
  const browser = ua.match(/(Edg|Firefox|Chrome|Version)\/(\d+)/);
  const name = browser ? ({ Edg: 'Edge', Firefox: 'Firefox', Chrome: 'Chrome', Version: 'Safari' } as Record<string, string>)[browser[1]] : '';
  return browser ? `${os} · ${name} ${browser[2]}` : os;
}

let server = '';
let sync = '';
/** the diagnostics screen fills in what it fetched, so reports carry it too */
export function setDiagExtra(v: { server?: string; sync?: string }) { if (v.server) server = v.server; if (v.sync) sync = v.sync; }

/** one line for the owner's message */
export function diagLine() {
  return diagnostics({ server, sync }).map((d) => `${d.label}: ${d.value}`).join(' · ');
}

export const diagText = () => diagnostics({ server, sync }).map((d) => `${d.label}: ${d.value}`).join('\n');

/* ---------- screenshot ---------- */

/** a picked image → JPEG data URL, at most 1600 px on the long side (about 200–400 KB) */
export async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}
