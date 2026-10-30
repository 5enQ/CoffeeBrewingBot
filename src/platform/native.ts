/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Native wrapper (Capacitor, Android/iOS).
 * Plugins come from window.Capacitor.Plugins, so the code compiles
 * even without Capacitor installed. Install them with:
 *   npm i @capacitor/core @capacitor/cli @capacitor/haptics @capacitor/preferences @capacitor/app @capacitor/dialog @capacitor/share
 * A plugin may be missing — then the web implementation is used.
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
    hasNativeBack: false, // iOS has no system "back", so the header arrow stays

    async init() {
      // Hardware "back" on Android: first our screen stack, then minimize the app
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

    cloud: null,

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

    async share(text, url) {
      const sh = plugin('Share'); // @capacitor/share
      if (!sh) return web.share(text, url);
      try { await sh.share({ text, url, dialogTitle: 'Поделиться рецептом' }); return 'shared'; } catch { return 'failed'; }
    },

    async keepAwake(on) {
      const k = plugin('KeepAwake'); // @capacitor-community/keep-awake
      if (!k) return web.keepAwake(on);
      if (on) await k.keepAwake(); else await k.allowSleep();
    },
  };
}
