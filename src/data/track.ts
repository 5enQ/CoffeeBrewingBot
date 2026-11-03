import { RATINGS_API } from '../config';
import { platform } from '../platform';
import { EVENT_CAP, type MetricEvent, type Metrics } from './metrics';

/**
 * Anonymous usage counters (see metrics.ts). Counts wait on the device and go to the server now and then,
 * as one «this happened N times» list; nothing about the brew, the coffee or the person goes with them.
 * Outside Telegram (no signed user) nothing is sent.
 */
const KEY = 'brewbook.track';
const read = (): Partial<Record<MetricEvent, number>> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v: Partial<Record<MetricEvent, number>>) => { try { if (Object.keys(v).length) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* no storage */ } };

let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;

export function track(ev: MetricEvent) {
  const q = read();
  q[ev] = Math.min(EVENT_CAP, (q[ev] ?? 0) + 1);
  write(q);
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 20_000);
}

export async function flush() {
  const initData = platform.initData();
  const q = read();
  if (sending || !RATINGS_API || !initData || !Object.keys(q).length) return;
  sending = true;
  try {
    const r = await fetch(`${RATINGS_API}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, events: q }), keepalive: true, signal: AbortSignal.timeout?.(15_000) });
    if (r.ok) {
      // counts made while sending stay for the next time
      const now = read();
      for (const k of Object.keys(q) as MetricEvent[]) { const left = (now[k] ?? 0) - (q[k] ?? 0); if (left > 0) now[k] = left; else delete now[k]; }
      write(now);
    }
  } catch { /* offline: try later */ }
  sending = false;
}

/** the app goes to the background: send what is waiting */
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });

/** owner: the numbers about the app */
export async function loadMetrics(): Promise<Metrics | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  try {
    const r = await fetch(`${RATINGS_API}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, action: 'metrics' }), signal: AbortSignal.timeout?.(15_000) });
    if (!r.ok) return null;
    const j = await r.json();
    // an older server answers with its usual list: no metrics there
    return j && j.users && j.brews && Array.isArray(j.days) ? j as Metrics : null;
  } catch { return null; }
}
