/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Нативная обёртка (Capacitor, Android/iOS).
 * Плагины берутся из window.Capacitor.Plugins, поэтому код компилируется
 * и без установленного Capacitor. Ставятся так:
 *   npm i @capacitor/core @capacitor/cli @capacitor/haptics @capacitor/preferences @capacitor/app @capacitor/dialog
 * Плагин может отсутствовать — тогда используется веб-реализация.
 */
import type { Platform } from './types';
import { createWebPlatform } from './web';

const cap = () => (window as any).Capacitor;
const plugin = (name: string) => cap()?.Plugins?.[name];

export function looksLikeNative(): boolean {
  return !!cap()?.isNativePlatform?.();
}

export function createNativePlatform(): Platform {
  const web = createWebPlatform();
  let backHandler: (() => void) | null = null;

  return {
    ...web,
    kind: 'native',
    hasNativeBack: false, // на iOS нет системной «назад», поэтому стрелка в шапке остаётся

    async init() {
      // Аппаратная «назад» на Android: сначала наш стек экранов, потом — свернуть приложение
      plugin('App')?.addListener('backButton', () => {
        if (backHandler) backHandler(); else plugin('App')?.minimizeApp?.();
      });
    },

    haptic(kind) {
      const h = plugin('Haptics');
      if (!h) return web.haptic(kind);
      if (kind === 'select') h.selectionChanged();
      else if (kind === 'success' || kind === 'warning' || kind === 'error')
        h.notification({ type: kind.toUpperCase() });
      else h.impact({ style: kind.toUpperCase() });
    },

    storage: {
      async get(key) {
        const p = plugin('Preferences');
        if (!p) return web.storage.get(key);
        return (await p.get({ key })).value ?? null;
      },
      async set(key, value) {
        const p = plugin('Preferences');
        if (!p) return web.storage.set(key, value);
        await p.set({ key, value });
      },
    },

    setBackHandler(fn) { backHandler = fn; },

    async confirm(message) {
      const d = plugin('Dialog');
      if (!d) return web.confirm(message);
      return (await d.confirm({ message, okButtonTitle: 'Да', cancelButtonTitle: 'Отмена' })).value;
    },
    async alert(message) {
      const d = plugin('Dialog');
      if (!d) return web.alert(message);
      await d.alert({ message });
    },

    async keepAwake(on) {
      const k = plugin('KeepAwake'); // @capacitor-community/keep-awake
      if (!k) return web.keepAwake(on);
      if (on) await k.keepAwake(); else await k.allowSleep();
    },
  };
}
