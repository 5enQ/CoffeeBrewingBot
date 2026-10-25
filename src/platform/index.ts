import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createTelegramPlatform, looksLikeTelegram } from './telegram';
import { createNativePlatform, looksLikeNative } from './native';

export type { Platform, HapticKind } from './types';

function detect(): Platform {
  if (looksLikeNative()) return createNativePlatform();
  if (looksLikeTelegram()) return createTelegramPlatform();
  return createWebPlatform();
}

export let platform: Platform = detect();

export async function initPlatform() {
  try {
    await platform.init();
  } catch (e) {
    console.warn('Платформа не инициализирована, работаем как веб-приложение', e);
    platform = createWebPlatform();
  }
  document.documentElement.dataset.platform = platform.kind;
}
