/**
 * Brewbook — сервер оценок рецептов.
 *
 * POST /rate   { initData, rid, author, stars }  — оценить рецепт (только из Telegram, 1 оценка на человека)
 * GET  /stats?author=<telegram id>                — сколько оценок у автора, средняя, по рецептам
 *
 * Подлинность пользователя проверяется подписью initData (HMAC с токеном бота),
 * поэтому подделать оценку «от чужого имени» нельзя, а повторная оценка заменяет прежнюю.
 */
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  AUTHORS: DurableObjectNamespace<AuthorRatings>;
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

    return json({ error: 'not found' }, 404, h);
  },
};
