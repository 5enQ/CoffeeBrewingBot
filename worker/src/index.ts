/**
 * Brewbook — recipe ratings server.
 *
 * POST /rate   { initData, rid, author, stars }  — rate a recipe (Telegram only, 1 rating per person)
 * GET  /stats?author=<telegram id>                — the author's rating count, average, per recipe
 * POST /recipes { initData, code }               — save a recipe for a short link (Telegram only)
 * GET  /recipes/<id>                             — get a recipe by short link
 * POST /share { initData, title, body, url }     — prepare a formatted message for WebApp.shareMessage
 * GET  /version                                 — server version (X.Y.Z) and when it was deployed
 * GET  /lookup?url=…&code=…                       — coffee by QR or barcode: from the shared catalog or the roaster page
 * POST /catalog { initData, url, code, coffee }  — a user saved a pack: fill in or confirm the catalog lot
 *
 * The user is authenticated by the initData signature (HMAC with the bot token),
 * so a rating "on someone else's behalf" cannot be forged, and a repeated rating replaces the previous one.
 */
import { DurableObject } from 'cloudflare:workers';
import { Accounts } from './accounts';
import { CoffeeCatalog, cleanCoffee, keysFor, type Found, type SiteStatus } from './catalog';
import { fetchPage } from './fetch';
import { PARSER_VERSION, parsePage } from './parse';

export { Accounts, CoffeeCatalog };

export interface Env {
  AUTHORS: DurableObjectNamespace<AuthorRatings>;
  RECIPES: DurableObjectNamespace<RecipeStore>;
  CATALOG: DurableObjectNamespace<CoffeeCatalog>;
  ACCOUNTS: DurableObjectNamespace<Accounts>;
  BOT_TOKEN: string;
  ALLOWED_ORIGIN: string;
  /** server version "X.Y.Z" and build time — set on deploy (GitHub Actions) */
  VERSION?: string;
  BUILT_AT?: string;
  /** Telegram ids of the bot owner(s), comma-separated: they approve roaster sites */
  OWNER_IDS?: string;
  /** local tests only: route crawler requests through a fixture server */
  CRAWL_PROXY?: string;
  CRAWL_STEP_MS?: string;
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Verify initData per the Telegram docs; returns the user or null */
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

/** Recipes for short links: a Telegram link holds only 512 chars */
export class RecipeStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, author TEXT NOT NULL, ts INTEGER NOT NULL)`);
  }

  put(code: string, author: string) {
    // Same recipe from the same author — same link
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
  /** Cron heartbeat: keeps the background crawler of the catalog running */
  async scheduled(_c: ScheduledController, env: Env) {
    await env.CATALOG.get(env.CATALOG.idFromName('all')).kick();
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      // not in the catalog — open the roaster page, but only on approved sites
      const gate = await catalog.siteGate(pageUrl);
      if (gate === 'new') ctx.waitUntil(notifyOwners(env, pageUrl));
      if (gate !== 'approved') return json(found ? publicFound(found) : { source: 'none', pending: gate === 'new' || gate === 'pending' }, 200, h);
      const page = await fetchPage(pageUrl);
      if (!page) return json({ source: 'none' }, 200, h);
      keys = [...new Set([...keys, ...keysFor(page.url, null)])];
      const { inStock: _s, unsupported: _u, ...parsed } = parsePage(page.html, page.url);
      void _s; void _u;
      const coffee = cleanCoffee(parsed);
      if (found) {
        // lot parsed by an old parser version and not confirmed by anyone — refresh it
        const fresh = await catalog.refreshPage(found.id, coffee, PARSER_VERSION);
        return json({ ...publicFound(fresh ?? found), source: 'page' }, 200, h);
      }
      const again = page.url !== pageUrl ? await catalog.find(keys) : null;
      if (again) return json(publicFound(again), 200, h);
      const useful = ['country', 'region', 'variety', 'process', 'altitude', 'packNotes', 'farm'].filter((k) => (coffee as Record<string, unknown>)[k]).length;
      if (useful < 2) return json({ source: 'none', coffee }, 200, h);
      const saved = await catalog.savePage(keys, coffee, PARSER_VERSION, page.url);
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

    // ---- accounts: verified brew counts, achievements, profile cards ----
    const accounts = () => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all'));
    if (req.method === 'POST' && (url.pathname === '/me' || url.pathname === '/brews' || url.pathname === '/cards')) {
      let body: { initData?: string; brews?: unknown; removed?: unknown; card?: unknown };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      if (url.pathname === '/me') return json(await accounts().me('tg', user.id), 200, h);
      if (url.pathname === '/brews') {
        const list = Array.isArray(body.brews) ? body.brews.slice(0, 500) : [];
        const brews = list.map((b: Record<string, unknown>) => ({ id: String(b?.id ?? '').slice(0, 40), m: String(b?.m ?? '').slice(0, 40), w: Number(b?.w) || 0, t: Number(b?.t) || 0 }))
          .filter((b) => /^[A-Za-z0-9_-]{1,40}$/.test(b.id) && /^[a-z0-9_-]{1,40}$/i.test(b.m) && Number.isFinite(b.t));
        const removed = (Array.isArray(body.removed) ? body.removed.slice(0, 500) : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x));
        return json(await accounts().addBrews('tg', user.id, brews, removed), 200, h);
      }
      const data = JSON.stringify(body.card ?? null);
      if (!body.card || typeof body.card !== 'object' || data.length > 6000) return json({ error: 'bad card' }, 400, h);
      return json({ id: await accounts().putCard('tg', user.id, data) }, 200, h);
    }

    const card = url.pathname.match(/^\/cards\/([A-Za-z0-9]{6,16})$/);
    if (req.method === 'GET' && card) {
      const data = await accounts().getCard(card[1]);
      return data ? json({ card: data }, 200, { ...h, 'Cache-Control': 'max-age=60' }) : json({ error: 'not found' }, 404, h);
    }

    if (req.method === 'POST' && url.pathname === '/admin') {
      let body: { initData?: string; action?: string; host?: string; roaster?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      if (!owners(env).includes(user.id)) return json({ error: 'forbidden' }, 403, h);
      const catalog = env.CATALOG.get(env.CATALOG.idFromName('all'));
      const host = body.host ?? '';
      const set: Record<string, SiteStatus> = { approve: 'approved', reject: 'rejected' };
      if (body.action && set[body.action]) {
        if (!(await catalog.setSite(host, set[body.action], body.roaster))) return json({ error: 'bad host' }, 400, h);
      } else if (body.action === 'recrawl') await catalog.recrawl(host);
      else if (body.action !== 'list') return json({ error: 'bad action' }, 400, h);
      return json({ sites: await catalog.sites() }, 200, h);
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

/** savePreparedInlineMessage: link, empty line, bold title, recipe and an "Открыть рецепт" button */
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

const publicFound = (f: Found) => ({ source: 'catalog', id: f.id, coffee: f.coffee, confirms: f.confirms, state: f.state, link: f.url });

const owners = (env: Env) => (env.OWNER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Tell the owner that a scan hit a site that is not connected yet */
async function notifyOwners(env: Env, url: string) {
  const host = new URL(url).hostname;
  const text = `Новый сайт обжарщика: ${host}\n${url}\n\nОдобрить или отклонить: Профиль → Сайты обжарщиков.`;
  await Promise.all(owners(env).map((id) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(id), text, link_preview_options: { is_disabled: true } }),
  }).catch(() => null)));
}
