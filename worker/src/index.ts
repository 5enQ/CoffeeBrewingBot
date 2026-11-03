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
import { RARE_IDS } from '../../src/data/rare.ts';
import { DurableObject } from 'cloudflare:workers';
import { Accounts, sendReminder } from './accounts';
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
  /** local tests only: crawler daily budget "reads,writes" instead of 70% of the free tier */
  CRAWL_BUDGET?: string;
  /** optional: a GitHub token with Issues read/write on the repository — enables «Передать на исправление» */
  GH_ISSUES_TOKEN?: string;
  /** owner/repo for those issues */
  GH_REPO?: string;
  /** this worker's own origin, taken from the request (the webhook points here) */
  WORKER_ORIGIN?: string;
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
    if (!user || !user.id) return null;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').slice(0, 64);
    return { id: String(user.id), username: typeof user.username === 'string' ? user.username : undefined, name: name || undefined };
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
    env.WORKER_ORIGIN ??= new URL(req.url).origin;
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
      const { inStock: _s, unsupported, ...parsed } = parsePage(page.html, page.url);
      void _s;
      // tea, capsules: not for the brewing diary, and not saved to the catalog
      if (unsupported) {
        if (found) await catalog.dropPage(found.id);
        return json({ source: 'none' }, 200, h);
      }
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
      if (url.pathname === '/me') return json(await accounts().me('tg', user.id, { username: user.username, name: user.name }), 200, h);
      if (url.pathname === '/brews') {
        const list = Array.isArray(body.brews) ? body.brews.slice(0, 500) : [];
        // x — rare-lot tags (known ones only)
        const tags = (v: unknown) => String(v ?? '').split(',').filter((x) => RARE_IDS.includes(x)).join(',');
        const brews = list.map((b: Record<string, unknown>) => ({ id: String(b?.id ?? '').slice(0, 40), m: String(b?.m ?? '').slice(0, 40), w: Number(b?.w) || 0, t: Number(b?.t) || 0, x: tags(b?.x) }))
          .filter((b) => /^[A-Za-z0-9_-]{1,40}$/.test(b.id) && /^[a-z0-9_-]{1,40}$/i.test(b.m) && Number.isFinite(b.t));
        const removed = (Array.isArray(body.removed) ? body.removed.slice(0, 500) : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x));
        return json(await accounts().addBrews('tg', user.id, brews, removed), 200, h);
      }
      const data = JSON.stringify(body.card ?? null);
      if (!body.card || typeof body.card !== 'object' || data.length > 6000) return json({ error: 'bad card' }, 400, h);
      return json({ id: await accounts().putCard('tg', user.id, data) }, 200, h);
    }

    // ---- testers: the checklist, answers on it, bug reports to the owner ----
    if (req.method === 'POST' && url.pathname === '/tester') {
      let body: { initData?: string; action?: string; item?: string; state?: string; text?: string; image?: string; context?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      const acc = accounts();
      const me = await acc.tester('tg', user.id);
      if (!me) return json({ error: 'forbidden' }, 403, h);
      const context = String(body.context ?? '').slice(0, 800);
      const text = String(body.text ?? '').trim().slice(0, 3000);
      if (body.action === 'answer') {
        const state = body.state === 'ok' ? 'ok' : body.state === 'bug' ? 'bug' : null;
        if (!state) return json({ error: 'bad state' }, 400, h);
        if (!(await acc.spendReport(me.account))) return json({ error: 'too many' }, 429, h);
        const item = await acc.checkAnswer(me.account, String(body.item ?? ''), state, text || undefined);
        if (!item) return json({ error: 'no such item' }, 404, h);
        const image = decodeImage(body.image);
        // a problem can be handed over for fixing, like a bug report
        const rid = state === 'bug' ? await acc.saveReport(me.account, 'check', text || '(без описания)', context, !!image, item) : null;
        await toOwners(env, `${state === 'ok' ? '✅' : '⚠️'} ${me.label}\n«${item}» — ${state === 'ok' ? 'работает' : 'есть проблема'}${text ? `\n\n${text}` : ''}${context ? `\n\n— ${context}` : ''}`, image, rid);
        return json({ checks: await acc.checks(me.account) }, 200, h);
      }
      if (body.action === 'report') {
        if (!text) return json({ error: 'empty' }, 400, h);
        if (!(await acc.spendReport(me.account))) return json({ error: 'too many' }, 429, h);
        const image = decodeImage(body.image);
        const rid = await acc.saveReport(me.account, 'bug', text, context, !!image);
        const sent = await toOwners(env, `🐞 Ошибка · ${me.label}\n\n${text}${context ? `\n\n— ${context}` : ''}`, image, rid);
        return sent ? json({ ok: true }, 200, h) : json({ error: 'telegram refused' }, 502, h);
      }
      return json({ checks: await acc.checks(me.account) }, 200, h);
    }

    // ---- bot reminder when a long timer ends ----
    if (req.method === 'POST' && url.pathname === '/reminders') {
      let body: { initData?: string; at?: unknown; title?: unknown; link?: unknown; cancel?: unknown; status?: unknown; test?: unknown };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      if (body.cancel) return json({ ok: await accounts().cancelReminder('tg', user.id) }, 200, h);
      if (body.status) return json({ ok: true, ...(await accounts().reminderStatus('tg', user.id)) }, 200, h);
      // "can the bot write to me?": a message right away, Telegram's answer comes back as is
      if (body.test) {
        const link = String(body.link ?? '');
        if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)?\?startapp=timer$/.test(link)) return json({ error: 'bad link' }, 400, h);
        const res = await sendReminder(env.BOT_TOKEN, user.id, '', link, '☕ Проверка: так бот напишет, когда долгий таймер (колд брю) закончится.');
        return json(res, 200, h);
      }
      const at = Number(body.at), now = Date.now();
      const title = String(body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Заварка';
      const link = String(body.link ?? '');
      if (!Number.isFinite(at) || at < now + 30_000 || at > now + 72 * 3_600_000) return json({ error: 'bad time' }, 400, h);
      if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)?\?startapp=timer$/.test(link)) return json({ error: 'bad link' }, 400, h);
      return json({ ok: await accounts().setReminder('tg', user.id, Math.round(at), title, link) }, 200, h);
    }

    const card = url.pathname.match(/^\/cards\/([A-Za-z0-9]{6,16})$/);
    if (req.method === 'GET' && card) {
      const data = await accounts().getCard(card[1]);
      return data ? json({ card: data }, 200, { ...h, 'Cache-Control': 'max-age=60' }) : json({ error: 'not found' }, 404, h);
    }

    if (req.method === 'POST' && url.pathname === '/tg') return telegramUpdate(req, env);

    // anonymous usage counters: a signed Telegram user may send them (no scripts from outside), but who sent them is not kept
    if (req.method === 'POST' && url.pathname === '/track') {
      let body: { initData?: string; events?: Record<string, unknown> };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      if (owners(env).includes(user.id)) return json({ counted: 0 }, 200, h);
      const counted = await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).track(body.events && typeof body.events === 'object' ? body.events : {});
      return json({ counted }, 200, h);
    }

    if (req.method === 'POST' && url.pathname === '/admin') {
      let body: { initData?: string; action?: string; host?: string; roaster?: string; tg?: string; what?: string; note?: string; username?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const user = await verifyInitData(body.initData ?? '', env.BOT_TOKEN, 7 * 86_400);
      if (!user) return json({ error: 'unauthorized' }, 401, h);
      if (!owners(env).includes(user.id)) return json({ error: 'forbidden' }, 403, h);
      // numbers about the app: counts only, no people in them
      if (body.action === 'metrics') return json(await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).metrics(), 200, h);
      const catalog = env.CATALOG.get(env.CATALOG.idFromName('all'));
      const host = body.host ?? '';
      const set: Record<string, SiteStatus> = { approve: 'approved', reject: 'rejected' };
      if (body.action && set[body.action]) {
        if (!(await catalog.setSite(host, set[body.action], body.roaster))) return json({ error: 'bad host' }, 400, h);
      } else if (body.action === 'recrawl') await catalog.recrawl(host);
      else if (body.action === 'grant' || body.action === 'revoke') {
        if (!(await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).grant(String(body.tg ?? ''), String(body.what ?? ''), body.action === 'grant'))) return json({ error: 'bad grant' }, 400, h);
      } else if (body.action === 'check_add' || body.action === 'check_remove' || body.action === 'check_clear') {
        await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).editChecks(body.action.slice(6) as 'add' | 'remove' | 'clear', body.note, body.what);
      } else if (body.action === 'forget') {
        if (!(await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).forget(String(body.tg ?? '')))) return json({ error: 'bad id' }, 400, h);
      } else if (body.action === 'note') {
        if (!(await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).setNote(String(body.tg ?? ''), String(body.note ?? ''), body.username ? String(body.username) : undefined))) return json({ error: 'bad note' }, 400, h);
      } else if (body.action !== 'list') return json({ error: 'bad action' }, 400, h);
      ctx.waitUntil(ensureWebhook(env, url.origin));
      const accs = env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all'));
      return json({ sites: await catalog.sites(), crawl: await catalog.usage(), grants: await accs.grantList(), checks: await accs.checks() }, 200, h);
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

/** a screenshot sent as a data URL (jpeg/png, at most ~3 MB) */
function decodeImage(data?: string): { bytes: Uint8Array; type: string } | null {
  const m = (data ?? '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > 4_200_000) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] };
}

/** A message (and a screenshot) from the bot to the owner(s). true — Telegram took it for at least one owner */
async function toOwners(env: Env, text: string, image: { bytes: Uint8Array; type: string } | null, reportId?: string | null): Promise<boolean> {
  const api = `https://api.telegram.org/bot${env.BOT_TOKEN}`;
  // «hand over for fixing»: the owner's button turns the report into a GitHub issue (only when the token is set)
  if (reportId && env.GH_ISSUES_TOKEN && env.WORKER_ORIGIN) await ensureWebhook(env, env.WORKER_ORIGIN);
  const markup = reportId && env.GH_ISSUES_TOKEN ? { reply_markup: { inline_keyboard: [[{ text: '🛠 Передать на исправление', callback_data: `fix:${reportId}` }]] } } : {};
  const res = await Promise.all(owners(env).map(async (id) => {
    try {
      if (image) {
        // one message: the screenshot with the report as its caption and the button under it
        // (a caption holds 1024 characters; a longer report goes as text first, then the photo with the button)
        const fits = text.length <= 1000;
        if (!fits) await fetch(`${api}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: Number(id), text: text.slice(0, 4000), link_preview_options: { is_disabled: true } }) });
        const form = new FormData();
        form.set('chat_id', id);
        form.set('photo', new Blob([image.bytes], { type: image.type }), 'screenshot.' + image.type.split('/')[1]);
        form.set('caption', fits ? text : `${text.slice(0, 120)}… (полный текст выше)`);
        if ('reply_markup' in markup) form.set('reply_markup', JSON.stringify(markup.reply_markup));
        const sent = await fetch(`${api}/sendPhoto`, { method: 'POST', body: form }).then((x) => x.json() as Promise<{ ok: boolean; result?: { photo?: { file_id: string }[] } }>).catch(() => null);
        const fileId = sent?.result?.photo?.at(-1)?.file_id;
        if (fileId && reportId) await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).setReportPhoto(reportId, fileId);
        return !!sent?.ok;
      }
      const r = await fetch(`${api}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: Number(id), text: text.slice(0, 4000), link_preview_options: { is_disabled: true }, ...markup }) });
      return ((await r.json()) as { ok: boolean }).ok;
    } catch { return false; }
  }));
  return res.some(Boolean);
}

/* ---------- bug reports → GitHub issues ---------- */

/** the secret Telegram sends with every webhook call: derived from the bot token, so nothing extra to configure */
async function webhookSecret(env: Env) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('brewbook-webhook:' + env.BOT_TOKEN)));
  return hex(d).slice(0, 48);
}

/** point the bot's webhook at this worker (button presses come here); called when the owner opens their panel */
async function ensureWebhook(env: Env, origin: string) {
  if (!env.GH_ISSUES_TOKEN) return;
  const api = `https://api.telegram.org/bot${env.BOT_TOKEN}`;
  try {
    const info = await (await fetch(`${api}/getWebhookInfo`)).json() as { result?: { url?: string } };
    const url = `${origin}/tg`;
    if (info.result?.url === url) return;
    const res = await (await fetch(`${api}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: await webhookSecret(env), allowed_updates: ['callback_query'] }) })).json() as { ok: boolean; description?: string };
    console.log('webhook', res.ok ? 'set' : `not set: ${res.description}`, url);
  } catch (e) { console.log('webhook setup failed', e); }
}

/** the screenshot from Telegram, saved as a file in the private bug repository; returns its link for the issue */
async function saveScreenshot(env: Env, rid: string, fileId: string): Promise<string | null> {
  try {
    const f = await (await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`)).json() as { result?: { file_path?: string } };
    if (!f.result?.file_path) return null;
    const bytes = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`)).arrayBuffer());
    let bin = '';
    for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
    const path = `screenshots/${new Date().toISOString().slice(0, 10)}-${rid}.jpg`;
    const res = await fetch(`https://api.github.com/repos/${env.GH_REPO}/contents/${path}`, {
      method: 'PUT', headers: gh(env),
      body: JSON.stringify({ message: `Screenshot for report ${rid}`, content: btoa(bin) }),
    });
    if (!res.ok) { console.log('screenshot not saved', res.status, await res.text()); return null; }
    return `https://github.com/${env.GH_REPO}/blob/HEAD/${path}?raw=true`;
  } catch (e) { console.log('screenshot error', e); return null; }
}

const gh = (env: Env) => ({ Authorization: `Bearer ${env.GH_ISSUES_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'brewbook-worker', 'Content-Type': 'application/json' });

/** the owner pressed «Передать на исправление»: open an issue in the private bug repository */
async function handOver(env: Env, rid: string): Promise<{ url?: string; error?: string }> {
  if (!env.GH_ISSUES_TOKEN || !env.GH_REPO) return { error: 'не настроен GitHub-токен' };
  const acc = env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all'));
  const r = await acc.report(rid);
  if (!r) return { error: 'отчёт не найден' };
  if (r.issue) return { url: r.issue };
  const shot = r.photo_id ? await saveScreenshot(env, rid, r.photo_id) : null;
  const first = r.text.split('\n')[0].slice(0, 70);
  const title = r.kind === 'check' ? `Проверка «${(r.item ?? '').slice(0, 50)}»: ${first}` : `Ошибка: ${first}`;
  const body = [
    r.kind === 'check' ? `**Пункт проверки:** ${r.item}\n\n**Что не так:**` : '**Что случилось:**',
    r.text,
    '',
    `**Диагностика:** ${r.context || '—'}`,
    `**Тестировщик:** ${r.tester} · ${new Date(r.ts).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    shot ? `\n**Скриншот:**\n\n![скриншот](${shot})` : r.photo ? '**Скриншот:** был приложен, но не сохранился — он есть у владельца в Telegram.' : '',
    '',
    '_Передано владельцем из Telegram. Исправление собирается в ветке `dev` репозитория CoffeeBrewingBot._',
  ].filter((x) => x !== '').join('\n');
  const res = await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, { method: 'POST', headers: gh(env), body: JSON.stringify({ title, body, labels: ['tester-bug'] }) });
  const j = await res.json() as { html_url?: string; message?: string };
  if (!res.ok || !j.html_url) { console.log('issue failed', res.status, j.message); return { error: j.message ?? `GitHub ${res.status}` }; }
  await acc.setReportIssue(rid, j.html_url);
  return { url: j.html_url };
}

/** Telegram webhook: only button presses of the owner are handled */
async function telegramUpdate(req: Request, env: Env): Promise<Response> {
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await webhookSecret(env)) return new Response('forbidden', { status: 403 });
  const u = await req.json().catch(() => null) as { callback_query?: { id: string; data?: string; from: { id: number }; message?: { chat: { id: number }; message_id: number } } } | null;
  const q = u?.callback_query;
  if (!q) return new Response('ok');
  const api = `https://api.telegram.org/bot${env.BOT_TOKEN}`;
  const answer = (text: string) => fetch(`${api}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: q.id, text, show_alert: false }) }).catch(() => null);
  if (!owners(env).includes(String(q.from.id)) || !q.data?.startsWith('fix:')) { await answer('Недоступно'); return new Response('ok'); }
  const r = await handOver(env, q.data.slice(4));
  if (r.url && q.message) {
    const n = r.url.split('/').pop();
    await fetch(`${api}/editMessageReplyMarkup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: `✅ Передано · задача #${n}`, url: r.url }]] } }) }).catch(() => null);
  }
  await answer(r.url ? 'Передано: задача создана' : `Не получилось: ${r.error}`);
  return new Response('ok');
}

/** Tell the owner that a scan hit a site that is not connected yet */
async function notifyOwners(env: Env, url: string) {
  const host = new URL(url).hostname;
  const text = `Новый сайт обжарщика: ${host}\n${url}\n\nОдобрить или отклонить: Профиль → Сайты обжарщиков.`;
  await Promise.all(owners(env).map((id) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(id), text, link_preview_options: { is_disabled: true } }),
  }).catch(() => null)));
}
