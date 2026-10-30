/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Platform } from './types';
import { createWebPlatform, requestWakeLock } from './web';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

/** Signs of running inside Telegram: tgWebApp* parameters in the URL or the client proxy */
export function looksLikeTelegram(): boolean {
  const w = window as any;
  return /tgWebApp/.test(location.hash + location.search) || !!w.TelegramWebviewProxy || !!w.Telegram?.WebApp?.initData;
}

function loadSdk(): Promise<void> {
  if ((window as any).Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Telegram SDK не загрузился'));
    document.head.appendChild(s);
  });
}

const tg = () => (window as any).Telegram.WebApp;

/** Map Telegram theme colors to the app's CSS variables */
function applyTheme() {
  const p = tg().themeParams || {};
  const root = document.documentElement.style;
  const set = (name: string, value?: string) => value ? root.setProperty(name, value) : root.removeProperty(name);
  set('--bg', p.secondary_bg_color || p.bg_color);
  set('--card', p.section_bg_color || p.bg_color);
  set('--fg', p.text_color);
  set('--hint', p.hint_color || p.subtitle_text_color);
  set('--accent', p.button_color);
  set('--accent-fg', p.button_text_color);
  set('--link', p.link_color);
  set('--danger', p.destructive_text_color);
  set('--sep', p.section_separator_color);
  document.documentElement.dataset.theme = tg().colorScheme;
  try {
    tg().setHeaderColor?.('secondary_bg_color');
    tg().setBackgroundColor?.('secondary_bg_color');
    tg().setBottomBarColor?.('secondary_bg_color');
  } catch { /* old clients */ }
}

export function createTelegramPlatform(): Platform {
  const web = createWebPlatform();
  let backHandler: (() => void) | null = null;
  const onBack = () => backHandler?.();

  const can = (v: string) => { try { return tg().isVersionAtLeast(v); } catch { return false; } };

  return {
    ...web,
    kind: 'telegram',
    hasNativeBack: true,

    async init() {
      await loadSdk();
      const app = tg();
      app.ready();
      app.expand();
      if (can('7.7')) app.disableVerticalSwipes(); // swiping down does not close the app while scrolling
      applyTheme();
      app.onEvent('themeChanged', applyTheme);
      app.BackButton.onClick(onBack);
    },

    user() {
      const u = tg().initDataUnsafe?.user;
      return u ? { id: String(u.id), name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username, languageCode: u.language_code } : null;
    },
    colorScheme: () => tg().colorScheme,
    onThemeChange(cb) {
      tg().onEvent('themeChanged', cb);
      return () => tg().offEvent('themeChanged', cb);
    },

    haptic(kind) {
      if (!can('6.1')) return;
      const h = tg().HapticFeedback;
      if (kind === 'select') h.selectionChanged();
      else if (kind === 'success' || kind === 'warning' || kind === 'error') h.notificationOccurred(kind);
      else h.impactOccurred(kind);
    },

    storage: {
      // DeviceStorage (Bot API 9.0) — the Telegram client's local storage, up to 5 MB.
      // Older clients use the webview's localStorage.
      get(key) {
        const ds = tg().DeviceStorage;
        if (!ds || !can('9.0')) return web.storage.get(key);
        return new Promise((res) => ds.getItem(key, (err: unknown, v: string | null) => res(err ? null : v ?? null)));
      },
      set(key, value) {
        const ds = tg().DeviceStorage;
        if (!ds || !can('9.0')) return web.storage.set(key, value);
        return new Promise((res) => ds.setItem(key, value, () => res()));
      },
    },

    // CloudStorage (Bot API 6.9) — account storage on Telegram servers, visible from all devices
    get cloud() {
      const cs = tg().CloudStorage;
      if (!cs || !can('6.9')) return null;
      const call = <T,>(fn: (cb: (err: unknown, v: T) => void) => void) => new Promise<T>((res, rej) => {
        try { fn((err, v) => (err ? rej(new Error(String(err))) : res(v))); } catch (e) { rej(e); }
      });
      return {
        getItems: (keys: string[]) => (keys.length ? call<Record<string, string>>((cb) => cs.getItems(keys, cb)) : Promise.resolve({})),
        setItem: (key: string, value: string) => call<boolean>((cb) => cs.setItem(key, value, cb)).then(() => undefined),
        removeItems: (keys: string[]) => (keys.length ? call<boolean>((cb) => cs.removeItems(keys, cb)).then(() => undefined) : Promise.resolve()),
        getKeys: () => call<string[]>((cb) => cs.getKeys(cb)),
      };
    },

    setBackHandler(fn) {
      backHandler = fn;
      if (fn) tg().BackButton.show(); else tg().BackButton.hide();
    },

    confirm(message) {
      if (!can('6.2')) return web.confirm(message);
      return new Promise((res) => tg().showConfirm(message, (ok: boolean) => res(ok)));
    },
    alert(message) {
      if (!can('6.2')) return web.alert(message);
      return new Promise((res) => tg().showAlert(message, () => res()));
    },

    keepAwake: requestWakeLock,
    setClosingConfirmation(on) {
      if (!can('6.2')) return;
      if (on) tg().enableClosingConfirmation(); else tg().disableClosingConfirmation();
    },

    scanQr(hint) {
      if (!can('6.4')) return Promise.resolve(null);
      return new Promise((res) => {
        let done = false;
        const closed = () => { tg().offEvent('scanQrPopupClosed', closed); if (!done) res(null); };
        tg().onEvent('scanQrPopupClosed', closed);
        tg().showScanQrPopup({ text: hint }, (data: string) => { done = true; res(data); return true; });
      });
    },

    openLink(url) {
      if (/^https:\/\/t\.me\//.test(url)) tg().openTelegramLink(url); else tg().openLink(url);
    },

    initData: () => tg().initData || null,

    isDesktopClient: () => ['tdesktop', 'macos', 'weba', 'webk', 'web', 'unigram'].includes(tg().platform),
    requestFullscreen() {
      if (can('8.0') && tg().requestFullscreen) tg().requestFullscreen();
    },

    startParam() {
      return tg().initDataUnsafe?.start_param || web.startParam();
    },

    async share(text, url) {
      // Telegram chat picker: the friend gets the recipe text and a link to it
      // Telegram puts the link on the first line; a leading newline gives an empty line after it
      tg().openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('\n' + text)}`);
      return 'shared';
    },

    shareMessage(id) {
      if (!can('8.0') || !tg().shareMessage) return Promise.resolve(null);
      return new Promise((res) => {
        let done = false;
        const finish = (v: boolean | null) => { if (done) return; done = true; tg().offEvent('shareMessageFailed', failed); res(v); };
        const failed = () => finish(null);
        tg().onEvent('shareMessageFailed', failed);
        try { tg().shareMessage(id, (sent: boolean) => finish(!!sent)); } catch { finish(null); }
      });
    },
  };
}
