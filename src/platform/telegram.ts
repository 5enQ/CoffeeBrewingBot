/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Platform } from './types';
import { createWebPlatform, requestWakeLock } from './web';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

/** Признаки запуска внутри Telegram: параметры tgWebApp* в URL или прокси клиента */
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

/** Переносим цвета темы Telegram в CSS-переменные приложения */
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
  } catch { /* старые клиенты */ }
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
      if (can('7.7')) app.disableVerticalSwipes(); // свайп вниз не закрывает приложение во время скролла
      applyTheme();
      app.onEvent('themeChanged', applyTheme);
      app.BackButton.onClick(onBack);
    },

    user() {
      const u = tg().initDataUnsafe?.user;
      return u ? { id: String(u.id), name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username } : null;
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
      // DeviceStorage (Bot API 9.0) — локальное хранилище клиента Telegram, до 5 МБ.
      // Для старых клиентов — localStorage вебвью.
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

    startParam() {
      return tg().initDataUnsafe?.start_param || web.startParam();
    },

    async share(text, url) {
      // Окно выбора чата Telegram: друг получит текст рецепта и ссылку на него
      // Telegram ставит ссылку первой строкой; перевод строки в начале текста даёт пустую строку после неё
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
