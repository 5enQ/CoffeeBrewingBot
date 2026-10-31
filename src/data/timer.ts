import { useEffect, useState } from 'react';
import { platform } from '../platform';
import { CLOUD_LIMITS } from '../platform/types';
import type { Brew } from './store';

/**
 * The running brew timer, kept on the device so closing the app does not reset it,
 * and in the account cloud (Telegram CloudStorage, key "timer"), so a cold brew started on the phone
 * shows up on the computer too. Wall-clock based: elapsed = base + (now − startedAt) while running.
 * Every change carries its time; the newest one wins, a cleared timer is kept as a dated "none".
 */
export interface ActiveTimer {
  draft: Brew;
  /** seconds accumulated before the last start */
  base: number;
  /** epoch ms of the last start; null — paused */
  startedAt: number | null;
  /** plan length, seconds (for the banner and the reminder) */
  total: number;
  /** a bot reminder is scheduled for this timer */
  remind?: boolean;
  /** when this state was set (ms) — the newest one wins across devices */
  at?: number;
}

interface Stamp { at: number; none?: true }

const KEY = 'brewbook.timer';
/** timers this long keep running when you leave the screen (cold brew, long infusions) */
export const LONG_TIMER = 3600;

const CLOUD_KEY = 'timer';
const STAMP_KEY = 'brewbook.timer.at';

/** remote — the change came from another device */
const subs = new Set<(remote: boolean) => void>();
const emit = (remote = false) => subs.forEach((f) => f(remote));
export function onTimerChange(f: (remote: boolean) => void) { subs.add(f); return () => { subs.delete(f); }; }

const localAt = () => { try { return Number(localStorage.getItem(STAMP_KEY)) || 0; } catch { return 0; } };
function writeLocal(t: ActiveTimer | null, at: number) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY);
    localStorage.setItem(STAMP_KEY, String(at));
  } catch { /* no storage */ }
}

export function loadTimer(): ActiveTimer | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null') as ActiveTimer | null;
    if (!t || typeof t.base !== 'number' || !t.draft?.methodId) return null;
    return t;
  } catch { return null; }
}

export function saveTimer(t: ActiveTimer | null) {
  const at = Math.max(Date.now(), localAt() + 1);
  const next = t ? { ...t, at } : null;
  writeLocal(next, at);
  emit();
  const cloud = platform.cloud;
  if (!cloud) return;
  const value = JSON.stringify(next ?? ({ at, none: true } satisfies Stamp));
  // a recipe with a very long plan may not fit one key: then the timer stays on this device only
  if (value.length <= CLOUD_LIMITS.value) cloud.setItem(CLOUD_KEY, value).catch(() => { /* offline: the next change will carry it */ });
}

/** Take the timer from the cloud if another device changed it later than this one. true — something changed here. */
export async function pullTimer(): Promise<boolean> {
  const cloud = platform.cloud;
  if (!cloud) return false;
  let raw: string | undefined;
  try { raw = (await cloud.getItems([CLOUD_KEY]))[CLOUD_KEY]; } catch { return false; }
  if (!raw) return false;
  let remote: (ActiveTimer & Partial<Stamp>) | Stamp;
  try { remote = JSON.parse(raw); } catch { return false; }
  if (!remote || typeof remote.at !== 'number' || remote.at <= localAt()) return false;
  const t = 'none' in remote && remote.none ? null : remote as ActiveTimer;
  if (t && (typeof t.base !== 'number' || !t.draft?.methodId)) return false;
  writeLocal(t, remote.at);
  emit(true);
  return true;
}

/** keep the timer in step with other devices: on start, when the app comes back, and every 30 s while open */
export function useTimerSync() {
  useEffect(() => {
    if (!platform.cloud) return;
    const pull = () => { if (document.visibilityState === 'visible') void pullTimer(); };
    pull();
    document.addEventListener('visibilitychange', pull);
    const i = setInterval(pull, 30_000);
    return () => { document.removeEventListener('visibilitychange', pull); clearInterval(i); };
  }, []);
}

/** forget the stored timer if it is this brew's */
export function clearTimer(id: string) {
  if (loadTimer()?.draft.id === id) saveTimer(null);
}

export const elapsedOf = (t: Pick<ActiveTimer, 'base' | 'startedAt'>, now = Date.now()) =>
  Math.max(0, t.base + (t.startedAt === null ? 0 : (now - t.startedAt) / 1000));

/** the stored timer, refreshed every second while it runs */
export function useActiveTimer() {
  const [t, setT] = useState(loadTimer);
  const [, tick] = useState(0);
  useEffect(() => {
    const on = () => setT(loadTimer());
    const off = onTimerChange(on);
    window.addEventListener('storage', on);
    return () => { off(); window.removeEventListener('storage', on); };
  }, []);
  useEffect(() => {
    if (!t || t.startedAt === null) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [t]);
  return t;
}
