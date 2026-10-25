import type { Platform, HapticKind, ShareResult } from './types';
import { dialog } from '../ui/dialog';

const memory = new Map<string, string>();

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { memory.set(key, value); }
}

let wakeLock: { release(): Promise<void> } | null = null;

export async function requestWakeLock(on: boolean) {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (on && nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* не критично */ }
}

const vibrateMap: Record<HapticKind, number | number[]> = {
  light: 8, medium: 14, heavy: 22, select: 5,
  success: [10, 40, 10], warning: [20, 40, 20], error: [30, 50, 30],
};

export async function webShare(text: string, url: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try { await nav.share({ text, url }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'failed'; }
  }
  try { await navigator.clipboard.writeText(`${text}\n\n${url}`); return 'copied'; } catch { return 'failed'; }
}

export function createWebPlatform(): Platform {
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  return {
    kind: 'web',
    hasNativeBack: false,
    async init() {},
    user: () => null,
    colorScheme: () => (mq?.matches ? 'dark' : 'light'),
    onThemeChange(cb) {
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    haptic(kind) {
      try { navigator.vibrate?.(vibrateMap[kind]); } catch { /* нет вибро */ }
    },
    storage: {
      async get(key) { return lsGet(key); },
      async set(key, value) { lsSet(key, value); },
    },
    setBackHandler() { /* в вебе кнопка «назад» рисуется в шапке */ },
    confirm: (m) => dialog.confirm(m),
    alert: (m) => dialog.alert(m),
    keepAwake: requestWakeLock,
    setClosingConfirmation(on) {
      window.onbeforeunload = on ? (e) => { e.preventDefault(); return ''; } : null;
    },
    openLink(url) { window.open(url, '_blank', 'noopener'); },
    initData: () => null,
    startParam() {
      const m = location.hash.match(/[#&]r=([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    },
    share: webShare,
  };
}
