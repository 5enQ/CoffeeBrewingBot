/**
 * Verified numbers. The server keeps a short log of the user's brews (method, water, date — no notes, beans or recipes),
 * counts them with the limits from levels.ts and decides achievements, card backgrounds and the diamond number.
 * The app shows the server's numbers when it has them, otherwise its own estimate with the same limits.
 */
import { useEffect, useMemo, useRef } from 'react';
import { RATINGS_API } from '../config';
import { flush } from './track';
import { platform } from '../platform';
import { localStats, ownBrews } from './achievements';
import { rareOfBean } from './rare';
import type { Stats } from './levels';
import { useStore, type DB } from './store';

/** invites — roles the owner offered that wait for this person's answer */
export interface ServerStats extends Stats { at: number; account: string; diamondNo?: number; grants?: string[]; invites?: string[] }

// v2: brews carry rare-lot tags, so every brew is sent once more
const SENT_KEY = 'brewbook.statsSent2';
const CHUNK = 400;

const readSent = () => { try { return Number(localStorage.getItem(SENT_KEY)) || 0; } catch { return 0; } };
const writeSent = (v: number) => { try { localStorage.setItem(SENT_KEY, String(v)); } catch { /* private mode: resend next time, it is idempotent */ } };

/** Brews changed since the last send (all of them on the first run — the history import) and deletions */
export function pendingStats(db: Pick<DB, 'brews' | 'mod' | 'del'> & { beans?: DB['beans'] }, since: number) {
  const beans = new Map((db.beans ?? []).map((x) => [x.id, x]));
  // a brew counts as changed when it or its pack changed (a pack's country or variety decides the rare-lot tag)
  const stamp = (id: string, date: number, bean?: string | null) => Math.max(db.mod?.[`b:${id}`] ?? date, bean ? db.mod?.[`k:${bean}`] ?? 0 : 0);
  const brews = ownBrews(db.brews).filter((b) => since === 0 || stamp(b.id, b.date, b.beanId) > since)
    .map((b) => {
      const x = rareOfBean(b.beanId ? beans.get(b.beanId) : null).join(',');
      return { id: b.id, m: b.methodId, w: Math.round(b.water || 0), t: b.date, ...(x ? { x } : {}) };
    });
  const removed = Object.entries(db.del ?? {}).filter(([k, t]) => k.startsWith('b:') && t > since).map(([k]) => k.slice(2));
  const top = Math.max(since, ...db.brews.map((b) => stamp(b.id, b.date, b.beanId)), ...Object.values(db.del ?? {}));
  return { brews, removed, top };
}

async function post(path: string, body: unknown): Promise<ServerStats | null> {
  try {
    const r = await fetch(`${RATINGS_API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j.account === 'string' ? j as ServerStats : null;
  } catch { return null; }
}

/** Send what changed and get the counted numbers back. null — no Telegram, no server or no connection. */
/** the person answers a role offered to them; the server's numbers come back (with the role, when agreed) */
export async function answerInvite(what: string, accept: boolean): Promise<ServerStats | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  return post('/invite', { initData, what, answer: accept ? 'accept' : 'decline' });
}

export async function syncStats(db: Pick<DB, 'brews' | 'mod' | 'del'> & { beans?: DB['beans'] }): Promise<ServerStats | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  const since = readSent();
  const { brews, removed, top } = pendingStats(db, since);
  let res: ServerStats | null = null;
  if (!brews.length && !removed.length) res = await post('/me', { initData });
  for (let i = 0; i < brews.length || (i === 0 && removed.length); i += CHUNK) {
    res = await post('/brews', { initData, brews: brews.slice(i, i + CHUNK), removed: i === 0 ? removed : [] });
    if (!res) return null;
  }
  if (res) writeSent(top);
  return res;
}

/** Keeps the server log up to date: at start and a few seconds after brews change */
export function useStatsSync() {
  const { ready, brews, beans, stamps, setServerStats } = useStore();
  const latest = useRef(stamps);
  latest.current = stamps;
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      const s = await syncStats({ brews, beans, mod: latest.current.mod, del: latest.current.del });
      if (s) setServerStats(s);
      void flush();
    }, 2500);
    return () => clearTimeout(t);
  }, [ready, brews, beans, setServerStats]);
}

/** The numbers to show: the server's when known, otherwise the local estimate */
export function useStats(): { stats: Stats; verified: boolean; diamondNo?: number; grants: string[] } {
  const { brews, beans, profile } = useStore();
  return useMemo(() => {
    const s = profile.serverStats;
    if (s) return { stats: { methods: s.methods, liters: s.liters, ratings: s.ratings, rare: s.rare ?? [] }, verified: true, diamondNo: s.diamondNo, grants: s.grants ?? [] };
    return { stats: localStats(brews, profile.ratingStats?.count ?? 0, beans), verified: false, grants: [] };
  }, [brews, beans, profile.serverStats, profile.ratingStats]);
}
