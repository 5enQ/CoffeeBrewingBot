import type { Platform } from './types';
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
  }
  tapFeedback();
  document.documentElement.dataset.platform = platform.kind;
}
