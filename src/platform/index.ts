import type { Platform } from './types';
import { markRoot } from '../appearance';
import { createWebPlatform } from './web';
import { createTelegramPlatform, looksLikeTelegram } from './telegram';
import { createNativePlatform, looksLikeNative } from './native';

export type { Platform, HapticKind } from './types';

/** when the last vibration was asked for, and when the current tap began (see tapFeedback) */
let lastHaptic = 0, tapStart = 0;
const counted = (p: Platform): Platform => {
  const haptic = p.haptic.bind(p);
  p.haptic = (kind) => { lastHaptic = performance.now(); haptic(kind); };
  return p;
};

function detect(): Platform {
  if (looksLikeNative()) return counted(createNativePlatform());
  if (looksLikeTelegram()) return counted(createTelegramPlatform());
  return counted(createWebPlatform());
}

export let platform: Platform = detect();

/**
 * Every tap on something pressable answers with a light tap of the phone, unless its own handler already
 * vibrated (a success, a selection, a long press): the handler runs first, this listener after it.
 * Not in a plain browser, where vibration on every click would be odd.
 */
const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary, label, input[type="checkbox"], input[type="radio"], select';
function tapFeedback() {
  document.addEventListener('pointerdown', () => { tapStart = performance.now(); }, true);
  document.addEventListener('click', (e) => {
    if (platform.kind === 'web') return;
    const el = (e.target as Element | null)?.closest?.(PRESSABLE);
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
    if (lastHaptic >= tapStart - 5) return; // the handler has answered already
    platform.haptic('light');
  });
}

export async function initPlatform() {
  try {
    await platform.init();
  } catch (e) {
    console.warn('Платформа не инициализирована, работаем как веб-приложение', e);
    platform = counted(createWebPlatform());
    markRoot();
  }
  tapFeedback();
  document.documentElement.dataset.platform = platform.kind;
}

/**
 * The server takes Telegram's signature for 24 hours from the moment the app was opened (worker: verifyInitData).
 * Telegram on a computer keeps the app open for days, so after a day every request is refused — that is not a
 * network problem, and the person only needs to reopen the app.
 */
export function sessionExpired(): boolean {
  try {
    const d = Number(new URLSearchParams(platform.initData() ?? '').get('auth_date') ?? 0);
    return !!d && Date.now() / 1000 - d > 86_400 - 60;
  } catch { return false; }
}

/** what to say when a server request failed */
export function serverTrouble(): string {
  return sessionExpired() ? 'Telegram-сессия устарела: закройте Brewbook и откройте снова' : 'нет связи с сервером';
}
