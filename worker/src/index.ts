/**
 * Brewbook — сервер оценок рецептов.
 *
 * POST /rate   { initData, rid, author, stars }  — оценить рецепт (только из Telegram, 1 оценка на человека)
 * GET  /stats?author=<telegram id>                — сколько оценок у автора, средняя, по рецептам
 * POST /recipes { initData, code }               — сохранить рецепт для короткой ссылки (только из Telegram)
 * GET  /recipes/<id>                             — получить рецепт по короткой ссылке
 * POST /share { initData, title, body, url }     — подготовить красивое сообщение для WebApp.shareMessage
 *
 * Подлинность пользователя проверяется подписью initData (HMAC с токеном бота),
 * поэтому подделать оценку «от чужого имени» нельзя, а повторная оценка заменяет прежнюю.
 */
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  AUTHORS: DurableObjectNamespace<AuthorRatings>;
  RECIPES: DurableObjectNamespace<RecipeStore>;
  BOT_TOKEN: string;
  ALLOWED_ORIGIN: string;
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

const ROASTER_HOSTS = new Set(['kojocoffee.ru', 'hq-coffee.com', 'sbmrne.ru', 'theweldercatherine.ru']);

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

    // Временно: кусок исходного кода страницы обжарщика — чтобы настроить разбор характеристик.
    // Только для известных сайтов, только GET, только вырезка вокруг слова.
    if (req.method === 'GET' && url.pathname === '/page') {
      let target: URL;
      try { target = new URL(url.searchParams.get('url') ?? ''); } catch { return json({ error: 'bad url' }, 400, h); }
      if (target.protocol !== 'https:' || !ROASTER_HOSTS.has(target.hostname.replace(/^www\./, ''))) return json({ error: 'host not allowed' }, 403, h);
      const r = await fetch(target.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36', 'Accept-Language': 'ru' }, redirect: 'follow' });
      const html = await r.text();
      const around = url.searchParams.get('around') ?? '';
      const width = Math.min(6000, Number(url.searchParams.get('width') ?? 2500));
      let out = `status ${r.status}, final ${r.url}, length ${html.length}\n\n`;
      if (around) {
        let i = html.indexOf(around), n = 0;
        while (i >= 0 && n < 3) { out += `----- match ${n + 1} at ${i} -----\n` + html.slice(Math.max(0, i - 300), i + width) + '\n\n'; i = html.indexOf(around, i + width); n++; }
        if (n === 0) out += 'no match';
      } else out += html.slice(0, width);
      return new Response(out, { headers: { ...h, 'Content-Type': 'text/plain; charset=utf-8' } });
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
