import { RATINGS_API } from '../config';
import { platform } from '../platform';

export interface RatingStats {
  count: number;
  avg: number;
  recipes: Record<string, { count: number; avg: number }>;
  fetchedAt?: number;
}

export const ratingsEnabled = () => !!RATINGS_API;

/** Telegram id of the current user — recipes are signed with it for ratings */
export const myTelegramId = () => (platform.kind === 'telegram' ? platform.user()?.id ?? null : null);

export async function fetchStats(author: string): Promise<RatingStats | null> {
  if (!RATINGS_API) return null;
  try {
    const r = await fetch(`${RATINGS_API}/stats?author=${encodeURIComponent(author)}`);
    if (!r.ok) return null;
    return { ...(await r.json()), fetchedAt: Date.now() };
  } catch { return null; }
}

export async function sendRating(rid: string, author: string, stars: number): Promise<{ ok: true; count: number; avg: number } | { ok: false; error: string }> {
  const initData = platform.initData();
  if (!RATINGS_API) return { ok: false, error: 'Оценки не подключены' };
  if (!initData) return { ok: false, error: 'Оценить можно, открыв рецепт в Telegram' };
  try {
    const r = await fetch(`${RATINGS_API}/rate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, rid, author, stars }),
    });
    const j = await r.json();
    if (!r.ok) return { ok: false, error: j.error ?? 'Не получилось отправить оценку' };
    return { ok: true, count: j.recipe?.count ?? 1, avg: j.recipe?.avg ?? stars };
  } catch {
    return { ok: false, error: 'Нет связи с сервером оценок' };
  }
}

export const newRid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);

/* ---------- Short recipe links ---------- */

const shortCache = new Map<string, string>();

/** Save a recipe on the server and get a short id (Telegram only). null — failed. */
export async function storeRecipe(code: string): Promise<string | null> {
  if (shortCache.has(code)) return shortCache.get(code)!;
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  try {
    const r = await fetch(`${RATINGS_API}/recipes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, code }),
    });
    if (!r.ok) return null;
    const { id } = await r.json();
    if (typeof id !== 'string') return null;
    shortCache.set(code, id);
    return id;
  } catch { return null; }
}

export async function loadRecipeCode(id: string): Promise<string | null> {
  if (!RATINGS_API) return null;
  try {
    const r = await fetch(`${RATINGS_API}/recipes/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const { code } = await r.json();
    return typeof code === 'string' ? code : null;
  } catch { return null; }
}

/** Prepare a formatted message (bold title + button) for WebApp.shareMessage. null — failed. */
export async function prepareShare(title: string, body: string, url: string): Promise<string | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData || !url.startsWith('https://t.me/')) return null;
  try {
    const r = await fetch(`${RATINGS_API}/share`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, title, body, url }),
    });
    if (!r.ok) return null;
    const { id } = await r.json();
    return typeof id === 'string' ? id : null;
  } catch { return null; }
}
