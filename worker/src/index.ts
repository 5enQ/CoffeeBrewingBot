/**
 * Brewbook — сервер оценок рецептов.
 *
 * POST /rate   { initData, rid, author, stars }  — оценить рецепт (только из Telegram, 1 оценка на человека)
 * GET  /stats?author=<telegram id>                — сколько оценок у автора, средняя, по рецептам
 * POST /recipes { initData, code }               — сохранить рецепт для короткой ссылки (только из Telegram)
 * GET  /recipes/<id>                             — получить рецепт по короткой ссылке
 * POST /share { initData, title, body, url }     — подготовить красивое сообщение для WebApp.shareMessage
 * GET  /version                                 — версия сервера (1.N) и когда он выложен
 * GET  /lookup?url=…&code=…                       — кофе по QR или штрихкоду: из общего каталога или со страницы обжарщика
 * POST /catalog { initData, url, code, coffee }  — пользователь сохранил пачку: дополнить или подтвердить лот в каталоге
 *
 * Подлинность пользователя проверяется подписью initData (HMAC с токеном бота),
 * поэтому подделать оценку «от чужого имени» нельзя, а повторная оценка заменяет прежнюю.
 */
import { DurableObject } from 'cloudflare:workers';
import { CoffeeCatalog, cleanCoffee, keysFor } from './catalog';
import { parsePage } from './parse';

export { CoffeeCatalog };

export interface Env {
  AUTHORS: DurableObjectNamespace<AuthorRatings>;
  RECIPES: DurableObjectNamespace<RecipeStore>;
  CATALOG: DurableObjectNamespace<CoffeeCatalog>;
  BOT_TOKEN: string;
  ALLOWED_ORIGIN: string;
  /** версия сервера «1.N» и время сборки — подставляются при выкладке (GitHub Actions) */
  VERSION?: string;
  BUILT_AT?: string;
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Проверка initData по документации Telegram; возвращает пользователя или null */
export async function verifyInitData(initData: string, botToken: string, maxAgeSec = 86_400) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const sign = hex(await hmac(secret, check));
  if (sign !== hash) return null;
  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null');
    return user && user.id ? { id: String(user.id) } : null;
  } catch { return null; }
}

export class AuthorRatings extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS ratings (
      rid TEXT NOT NULL, rater TEXT NOT NULL, stars INTEGER NOT NULL, ts INTEGER NOT NULL,
      PRIMARY KEY (rid, rater))`);
  }

  rate(rid: string, rater: string, stars: number) {
    this.ctx.storage.sql.exec(
      `INSERT INTO ratings (rid, rater, stars, ts) VALUES (?, ?, ?, ?)
       ON CONFLICT(rid, rater) DO UPDATE SET stars = excluded.stars, ts = excluded.ts`,
      rid, rater, stars, Date.now(),
    );
    return this.stats();
  }

  stats() {
    const rows = this.ctx.storage.sql.exec<{ rid: string; n: number; s: number }>(
      'SELECT rid, COUNT(*) AS n, SUM(stars) AS s FROM ratings GROUP BY rid',
    ).toArray();
    const recipes: Record<string, { count: number; avg: number }> = {};
    let count = 0, sum = 0;
    for (const r of rows) {
      recipes[r.rid] = { count: r.n, avg: Math.round((r.s / r.n) * 100) / 100 };
      count += r.n; sum += r.s;
    }
    return { count, avg: count ? Math.round((sum / count) * 100) / 100 : 0, recipes };
  }
}

/** Рецепты для коротких ссылок: в ссылку Telegram помещается только 512 символов */
export class RecipeStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, author TEXT NOT NULL, ts INTEGER NOT NULL)`);
  }

  put(code: string, author: string) {
    // Тот же рецепт от того же автора — та же ссылка
    const same = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM recipes WHERE code = ? AND author = ? LIMIT 1', code, author).toArray()[0];
    if (same) return same.id;
    const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => abc[b % abc.length]).join('');
      const exists = this.ctx.storage.sql.exec('SELECT 1 FROM recipes WHERE id = ?', id).toArray().length;
      if (!exists) {
        this.ctx.storage.sql.exec('INSERT INTO recipes (id, code, author, ts) VALUES (?, ?, ?, ?)', id, code, author, Date.now());
        return id;
      }
    }
    throw new Error('id collision');
  }

  get(id: string) {
    return this.ctx.storage.sql.exec<{ code: string }>('SELECT code FROM recipes WHERE id = ?', id).toArray()[0]?.code ?? null;
  }
}

function cors(env: Env, req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGIN.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const json = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/version') {
      return json({ version: env.VERSION ?? 'dev', builtAt: env.BUILT_AT ?? null }, 200, { ...h, 'Cache-Control': 'max-age=60' });
    }

    if (req.method === 'GET' && url.pathname === '/stats') {
      const author = url.searchParams.get('author') ?? '';
      if (!/^\d{1,20}$/.test(author)) return json({ error: 'bad author' }, 400, h);
      const stub = env.AUTHORS.get(env.AUTHORS.idFromName(author));
      return json(await stub.stats(), 200, { ...h, 'Cache-Control': 'max-age=30' });
    }

    if (req.method === 'POST' && url.pathname === '/rate') {
      let body: { initData?: string; rid?: string; author?: string; stars?: number };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const { initData = '', rid = '', author = '', stars = 0 } = body;
      if (!/^[a-z0-9]{6,16}$/.test(rid) || !/^\d{1,20}$/.test(author) || !Number.isInteger(stars) || stars < 1 || stars > 5) {
        return json({ error: 'bad request' }, 400, h);
      }
      const user = await verifyInitData(initData, env.BOT_TOKEN);
      if (!user) return json({ error: 'Откройте рецепт в Telegram, чтобы оценить' }, 401, h);
      if (user.id === author) return json({ error: 'Свой рецепт оценить нельзя' }, 403, h);
      const stub = env.AUTHORS.get(env.AUTHORS.idFromName(author));
      const stats = await stub.rate(rid, user.id, stars);
      return json({ ok: true, recipe: stats.recipes[rid] }, 200, h);
    }

    if (req.method === 'POST' && url.pathname === '/recipes') {
      let body: { initData?: string; code?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const { initData = '', code = '' } = body;
      if (!/^r[zj][A-Za-z0-9_-]{8,16000}$/.test(code)) return json({ error: 'bad recipe' }, 400, h);
      const user = await verifyInitData(initData, env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'Поделиться короткой ссылкой можно из Telegram' }, 401, h);
      const store = env.RECIPES.get(env.RECIPES.idFromName('all'));
      return json({ id: await store.put(code, user.id) }, 200, h);
    }

    const m = url.pathname.match(/^\/recipes\/([A-Za-z0-9]{6,16})$/);
    if (req.method === 'GET' && m) {
      const store = env.RECIPES.get(env.RECIPES.idFromName('all'));
      const code = await store.get(m[1]);
      return code ? json({ code }, 200, { ...h, 'Cache-Control': 'public, max-age=86400' }) : json({ error: 'not found' }, 404, h);
    }

    if (req.method === 'GET' && url.pathname === '/lookup') {
      const pageUrl = url.searchParams.get('url');
      const code = url.searchParams.get('code');
      let keys = keysFor(pageUrl, code);
      if (!keys.length) return json({ error: 'bad request' }, 400, h);
      const catalog = env.CATALOG.get(env.CATALOG.idFromName('all'));
      const found = await catalog.find(keys);
      const stale = found && found.source === 'page' && found.confirms === 0 && (found.pv ?? 0) < PARSER_VERSION && pageUrl;
      if (found && !stale) return json(publicFound(found), 200, h);
      if (!pageUrl) return json({ source: 'none' }, 200, h);
      // в каталоге нет — открываем страницу обжарщика
      const page = await fetchPage(pageUrl);
      if (!page) return json({ source: 'none' }, 200, h);
      keys = [...new Set([...keys, ...keysFor(page.url, null)])];
      const coffee = cleanCoffee(parsePage(page.html, page.url));
      if (found) {
        // лот разобран старой версией и никем не подтверждён — обновляем
        const fresh = await catalog.refreshPage(found.id, coffee, PARSER_VERSION);
        return json({ ...publicFound(fresh ?? found), source: 'page' }, 200, h);
      }
      const again = page.url !== pageUrl ? await catalog.find(keys) : null;
      if (again) return json(publicFound(again), 200, h);
      const useful = ['country', 'region', 'variety', 'process', 'altitude', 'packNotes', 'farm'].filter((k) => (coffee as Record<string, unknown>)[k]).length;
      if (useful < 2) return json({ source: 'none', coffee }, 200, h);
      const saved = await catalog.savePage(keys, coffee, PARSER_VERSION);
      return json({ ...publicFound(saved), source: 'page' }, 200, h);
    }

    if (req.method === 'POST' && url.pathname === '/catalog') {
      let body: { initData?: string; url?: string; code?: string; coffee?: unknown };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const keys = keysFor(body.url, body.code);
      if (!keys.length) return json({ error: 'bad request' }, 400, h);
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      const coffee = cleanCoffee(body.coffee);
      if (!Object.keys(coffee).length) return json({ error: 'empty' }, 400, h);
      const catalog = env.CATALOG.get(env.CATALOG.idFromName('all'));
      return json(publicFound(await catalog.contribute(keys, coffee, user.id)), 200, h);
    }

    if (req.method === 'POST' && url.pathname === '/share') {
      let body: { initData?: string; title?: string; body?: string; url?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const { initData = '', title = '', body: text = '', url: link = '' } = body;
      if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)?\?startapp=[A-Za-z0-9_-]{1,512}$/.test(link)) return json({ error: 'bad link' }, 400, h);
      const user = await verifyInitData(initData, env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      const id = await prepareMessage(env.BOT_TOKEN, user.id, title.slice(0, 200), text.slice(0, 3200), link).catch((e) => { console.log('prepare error', e); return null; });
      return id ? json({ id }, 200, h) : json({ error: 'telegram refused' }, 502, h);
    }

    return json({ error: 'not found' }, 404, h);
  },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** savePreparedInlineMessage: ссылка, пустая строка, жирное название, рецепт и кнопка «Открыть рецепт» */
async function prepareMessage(token: string, userId: string, title: string, text: string, link: string) {
  const html = `${esc(link)}\n\n<b>${esc(title)}</b>\n${esc(text)}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/savePreparedInlineMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: Number(userId),
      result: {
        type: 'article',
        id: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        title,
        description: text.split('\n').find((l) => l.trim()) ?? '',
        input_message_content: { message_text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        reply_markup: { inline_keyboard: [[{ text: '☕ Открыть рецепт', url: link }]] },
      },
      allow_user_chats: true, allow_bot_chats: true, allow_group_chats: true, allow_channel_chats: true,
    }),
  });
  const j = await res.json<{ ok: boolean; result?: { id: string }; description?: string }>();
  if (!j.ok) console.log('savePreparedInlineMessage failed:', j.description);
  return j.ok ? j.result!.id : null;
}

/** Версия разбора страниц: увеличить, когда разбор научился новому, — неподтверждённые лоты обновятся при следующем скане */
const PARSER_VERSION = 2;

const publicFound = (f: { id: string; coffee: unknown; confirms: number }) => ({ source: 'catalog', id: f.id, coffee: f.coffee, confirms: f.confirms });

/** Открыть страницу обжарщика: только https/http, не больше 3 МБ и 8 секунд */
async function fetchPage(raw: string): Promise<{ html: string; url: string } | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u.toString(), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 BrewbookBot', 'Accept-Language': 'ru,en;q=0.8', Accept: 'text/html' },
    });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('html')) return null;
    const reader = r.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_000_000) { reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(size > 3_000_000 ? 3_000_000 : size);
    let off = 0;
    for (const c of chunks) { if (off + c.length > buf.length) break; buf.set(c, off); off += c.length; }
    const charset = (r.headers.get('content-type') ?? '').match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
    let html: string;
    try { html = new TextDecoder(charset).decode(buf.subarray(0, off)); } catch { html = new TextDecoder().decode(buf.subarray(0, off)); }
    return { html, url: r.url || u.toString() };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
