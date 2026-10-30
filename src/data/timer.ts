import { useEffect, useState } from 'react';
import type { Brew } from './store';

/**
 * The running brew timer, kept on the device so closing the app does not reset it.
 * Wall-clock based: elapsed = base + (now − startedAt) while running.
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
}

const KEY = 'brewbook.timer';
/** timers this long keep running when you leave the screen (cold brew, long infusions) */
export const LONG_TIMER = 3600;

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function loadTimer(): ActiveTimer | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null') as ActiveTimer | null;
    if (!t || typeof t.base !== 'number' || !t.draft?.methodId) return null;
    return t;
  } catch { return null; }
}

export function saveTimer(t: ActiveTimer | null) {
  try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch { /* no storage */ }
  emit();
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
    subs.add(on);
    window.addEventListener('storage', on);
    return () => { subs.delete(on); window.removeEventListener('storage', on); };
  }, []);
  useEffect(() => {
    if (!t || t.startedAt === null) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [t]);
  return t;
}
