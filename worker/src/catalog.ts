/**
 * Shared coffee catalog: one lot — one record, reached by keys (QR link, barcode).
 * The global coffee rating will live here later: every lot has a permanent id.
 *
 * Nothing personal here: roast date, stock, notes and brews stay on the user's device.
 * About users only the Telegram id of whoever confirmed or edited a lot is stored (protection against abuse).
 *
 * Roaster sites: only approved domains are fetched. Unknown domains from scans wait in a queue for the owner.
 * Approved sites are crawled in the background (a Durable Object alarm, one request per step):
 * robots.txt → sitemaps → product pages → lots. Lots that leave the sitemap are kept and marked "gone".
 */
import { DurableObject } from 'cloudflare:workers';
import { SEED_SITES, canonicalUrl, hostOf, isArchive, normHost, parseRobots, parseSitemap, robotsAllows, usefulCount, wanted, type Robots, type SiteRules } from './crawl';
import { fetchText, setCrawlProxy } from './fetch';
import type { Env } from './index';
import { PARSER_VERSION, parsePage } from './parse';

/** Lot fields that may be stored in the catalog */
const TEXT = ['name', 'roaster', 'country', 'region', 'farm', 'producer', 'variety', 'process', 'altitude', 'roastLevel', 'packNotes'] as const;
const SCALE_KEYS = ['acidity', 'sweetness', 'bitterness', 'body', 'ferment'] as const;

export type Coffee = Partial<Record<typeof TEXT[number], string>> & {
  kind?: 'drip';
  dripCount?: number;
  assorted?: boolean;
  isBlend?: boolean;
  parts?: { share?: string; country?: string; region?: string; farm?: string; variety?: string; process?: string }[];
  drips?: { name?: string; country?: string; region?: string; farm?: string; variety?: string; process?: string; roastLevel?: string; notes?: string; count?: number }[];
  scales?: Partial<Record<typeof SCALE_KEYS[number], number>>;
  /** also sold as drip boxes of these sizes */
  dripOptions?: number[];
  image?: string;
};

/** Lot availability: on sale, out of stock, in the roaster's archive, removed from the site */
export type LotState = 'active' | 'out' | 'archived' | 'gone';

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strip = (o: Record<string, unknown>) => {
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] === undefined || o[k] === null) delete o[k];
  return o;
};

/** Normalize submitted data: known fields only, sane length, no empty values */
export function cleanCoffee(raw: unknown): Coffee {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of TEXT) out[k] = str(r[k], k === 'packNotes' ? 400 : 200);
  if (r.kind === 'drip') out.kind = 'drip';
  const n = Number(r.dripCount);
  if (Number.isInteger(n) && n > 0 && n <= 500) out.dripCount = n;
  if (r.assorted === true) out.assorted = true;
  if (r.isBlend === true) out.isBlend = true;
  if (Array.isArray(r.parts)) {
    const parts = r.parts.slice(0, 10).map((p: Record<string, unknown>) => strip({ share: str(p?.share, 10), country: str(p?.country), region: str(p?.region), farm: str(p?.farm), variety: str(p?.variety), process: str(p?.process) }));
    if (parts.some((p) => Object.keys(p).length)) out.parts = parts;
  }
  if (Array.isArray(r.drips)) {
    const drips = r.drips.slice(0, 40).map((d: Record<string, unknown>) => {
      const c = Number(d?.count);
      return strip({ name: str(d?.name), country: str(d?.country), region: str(d?.region), farm: str(d?.farm), variety: str(d?.variety), process: str(d?.process), roastLevel: str(d?.roastLevel), notes: str(d?.notes, 300), count: Number.isInteger(c) && c > 0 && c <= 100 ? c : undefined });
    });
    if (drips.some((d) => Object.keys(d).length)) out.drips = drips;
  }
  if (r.scales && typeof r.scales === 'object') {
    const s: Record<string, number> = {};
    for (const k of SCALE_KEYS) {
      const v = Number((r.scales as Record<string, unknown>)[k]);
      if (Number.isInteger(v) && v >= 1 && v <= 5) s[k] = v;
    }
    if (Object.keys(s).length) out.scales = s;
  }
  if (Array.isArray(r.dripOptions)) {
    const opts = r.dripOptions.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 500).slice(0, 6);
    if (opts.length) out.dripOptions = opts;
  }
  const img = str(r.image, 500);
  if (/^https:\/\//.test(img)) out.image = img;
  return strip(out) as Coffee;
}

/** Lot keys: link without "tails" and the barcode */
export function keysFor(url?: string | null, code?: string | null): string[] {
  const keys: string[] = [];
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        const path = decodeURIComponent(u.pathname).replace(/\/+$/, '').toLowerCase() || '/';
        keys.push(`url:${u.hostname.replace(/^www\./, '').toLowerCase()}${path}`);
      }
    } catch { /* not a link */ }
  }
  const digits = (code ?? '').trim();
  if (/^\d{8,14}$/.test(digits)) keys.push(`ean:${digits}`);
  return keys;
}

export interface Found { id: string; coffee: Coffee; source: 'page' | 'user'; confirms: number; pv?: number; state: LotState; url?: string }

export type SiteStatus = 'approved' | 'pending' | 'rejected';
export interface SiteRow {
  host: string; roaster: string; status: SiteStatus; rules: SiteRules; robots: Robots | null;
  added: number; requests: number; sample: string | null; crawlStart: number | null; crawled: number | null; lastFetch: number;
}

/** How often a site's sitemaps are re-read, and how often a known page is re-fetched */
const RECRAWL = 3 * 86_400_000;
const REFRESH = 14 * 86_400_000;
/** Pause between crawler steps; each step makes at most one request to one site (CRAWL_STEP_MS shortens it in local tests) */
let STEP = 15_000;
/** Minimum pause between two requests to the same site */
let PER_SITE = 30_000;
/** Sitemap entries handled per step (the rest wait in the sitemap row) */
const CHUNK = 250;

const STATE_ORDER: Record<LotState, number> = { active: 0, out: 1, archived: 2, gone: 3 };

export class CoffeeCatalog extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    setCrawlProxy(env.CRAWL_PROXY);
    if (env.CRAWL_STEP_MS) { STEP = Number(env.CRAWL_STEP_MS); PER_SITE = STEP * 2; }
    const sql = (this.sql = ctx.storage.sql);
    sql.exec(`CREATE TABLE IF NOT EXISTS coffee (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, source TEXT NOT NULL, confirms INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS coffee_key (key TEXT PRIMARY KEY, coffee TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS contrib (
      coffee TEXT NOT NULL, user TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (coffee, user))`);
    // v1.2: lots know their site, page and availability
    for (const col of ['host TEXT', "state TEXT NOT NULL DEFAULT 'active'", 'url TEXT']) {
      try { sql.exec(`ALTER TABLE coffee ADD COLUMN ${col}`); } catch { /* already there */ }
    }
    sql.exec(`UPDATE coffee SET host = (
        SELECT substr(key, 5, instr(substr(key, 5) || '/', '/') - 1) FROM coffee_key WHERE coffee = coffee.id AND key LIKE 'url:%' LIMIT 1)
      WHERE host IS NULL`);
    sql.exec('CREATE INDEX IF NOT EXISTS coffee_host ON coffee (host)');
    sql.exec(`CREATE TABLE IF NOT EXISTS site (
      host TEXT PRIMARY KEY, roaster TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, rules TEXT NOT NULL DEFAULT '{}', robots TEXT,
      added INTEGER NOT NULL, requests INTEGER NOT NULL DEFAULT 0, sample TEXT, crawl_start INTEGER, crawled INTEGER, last_fetch INTEGER NOT NULL DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS sitemap (url TEXT PRIMARY KEY, host TEXT NOT NULL, rest TEXT, done INTEGER NOT NULL DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS page (
      url TEXT PRIMARY KEY, host TEXT NOT NULL, lastmod TEXT, seen INTEGER NOT NULL, fetched INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, coffee TEXT)`);
    sql.exec('CREATE INDEX IF NOT EXISTS page_queue ON page (status, host)');
    // seeded sites: rules always come from the code, the owner's decision is kept
    const now = Date.now();
    for (const { host, roaster, ...rules } of SEED_SITES) {
      sql.exec(`INSERT INTO site (host, roaster, status, rules, added) VALUES (?, ?, 'approved', ?, ?)
        ON CONFLICT(host) DO UPDATE SET rules = excluded.rules, roaster = CASE WHEN site.roaster = '' THEN excluded.roaster ELSE site.roaster END`,
      host, roaster, JSON.stringify(rules), now);
    }
    ctx.blockConcurrencyWhile(async () => { if (!(await ctx.storage.getAlarm())) await ctx.storage.setAlarm(Date.now() + 5000); });
  }

  /* ---------- lots ---------- */

  private byKeys(keys: string[]): string | null {
    for (const k of keys) {
      const row = this.sql.exec<{ coffee: string }>('SELECT coffee FROM coffee_key WHERE key = ?', k).toArray()[0];
      if (row) return row.coffee;
    }
    return null;
  }

  private get(id: string): Found | null {
    const row = this.sql.exec<{ data: string; source: string; confirms: number; state: string; url: string | null }>(
      'SELECT data, source, confirms, state, url FROM coffee WHERE id = ?', id).toArray()[0];
    if (!row) return null;
    // pv — parser version the lot was taken from the page with (internal, not returned)
    const { pv, ...coffee } = JSON.parse(row.data) as Coffee & { pv?: number };
    return { id, coffee, source: row.source as Found['source'], confirms: row.confirms, pv, state: (row.state as LotState) || 'active', url: row.url ?? undefined };
  }

  lot(id: string) { return this.get(id); }

  /** The parser improved — update a lot nobody has confirmed yet */
  refreshPage(id: string, coffee: Coffee, pv: number): Found | null {
    const cur = this.get(id);
    if (!cur || cur.source !== 'page' || cur.confirms > 0) return cur;
    this.sql.exec('UPDATE coffee SET data = ?, updated = ? WHERE id = ?', JSON.stringify({ ...coffee, pv }), Date.now(), id);
    return this.get(id);
  }

  private link(id: string, keys: string[]) {
    for (const k of keys) this.sql.exec('INSERT OR IGNORE INTO coffee_key (key, coffee) VALUES (?, ?)', k, id);
  }

  private create(coffee: Coffee, source: 'page' | 'user', keys: string[], host: string | null = null, url: string | null = null) {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Date.now();
    this.sql.exec('INSERT INTO coffee (id, data, source, confirms, created, updated, host, url) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
      id, JSON.stringify(coffee), source, now, now, host, url);
    this.link(id, keys);
    return id;
  }

  find(keys: string[]): Found | null {
    const id = this.byKeys(keys);
    return id ? this.get(id) : null;
  }

  /** Parsed page: save it if there is no such lot yet */
  savePage(keys: string[], coffee: Coffee, pv: number, url?: string): Found {
    const found = this.find(keys);
    if (found) { this.link(found.id, keys); return found; }
    const page = url ? canonicalUrl(url) : null;
    const id = this.create({ ...coffee, pv } as Coffee, 'page', keys, page ? hostOf(page) : null, page);
    return this.get(id)!;
  }

  /**
   * A user saved a pack. Empty lot fields are filled in.
   * While a lot has at most one confirmation, user edits replace values parsed from the page —
   * after that the lot counts as verified and only changes where it was empty.
   */
  contribute(keys: string[], coffee: Coffee, user: string): Found {
    const found = this.find(keys);
    const now = Date.now();
    if (!found) {
      const urlKey = keys.find((k) => k.startsWith('url:'));
      const id = this.create(coffee, 'user', keys, urlKey ? urlKey.slice(4).split('/')[0] : null);
      this.sql.exec('INSERT OR IGNORE INTO contrib (coffee, user, ts) VALUES (?, ?, ?)', id, user, now);
      this.sql.exec('UPDATE coffee SET confirms = 1 WHERE id = ?', id);
      return this.get(id)!;
    }
    const trusted = found.confirms >= 2;
    const merged: Record<string, unknown> = { ...found.coffee, pv: found.pv };
    for (const [k, v] of Object.entries(coffee)) {
      if (merged[k] === undefined || !trusted) merged[k] = v;
    }
    const isNew = !this.sql.exec('SELECT 1 FROM contrib WHERE coffee = ? AND user = ?', found.id, user).toArray().length;
    this.sql.exec('INSERT OR IGNORE INTO contrib (coffee, user, ts) VALUES (?, ?, ?)', found.id, user, now);
    this.sql.exec('UPDATE coffee SET data = ?, updated = ?, confirms = confirms + ? WHERE id = ?', JSON.stringify(merged), now, isNew ? 1 : 0, found.id);
    this.link(found.id, keys);
    return this.get(found.id)!;
  }

  /** A crawled page → lot. Unconfirmed page lots are replaced; lots users confirmed only get empty fields filled. */
  private upsertCrawled(url: string, coffee: Coffee, state: LotState, pv: number): string {
    const keys = [`url:${url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()}`];
    const host = hostOf(url);
    const found = this.find(keys);
    if (!found) {
      const id = this.create({ ...coffee, pv } as Coffee, 'page', keys, host, url);
      this.sql.exec('UPDATE coffee SET state = ? WHERE id = ?', state, id);
      return id;
    }
    let data: Record<string, unknown>;
    if (found.source === 'page' && found.confirms === 0) data = { ...coffee, pv };
    else {
      data = { ...found.coffee, pv: found.pv };
      for (const [k, v] of Object.entries(coffee)) if (data[k] === undefined) data[k] = v;
    }
    this.sql.exec('UPDATE coffee SET data = ?, updated = ?, state = ?, host = ?, url = ? WHERE id = ?', JSON.stringify(data), Date.now(), state, host, url, found.id);
    return found.id;
  }

  /* ---------- catalog browsing ---------- */

  /** Approved roasters with lot counts (only sites that have lots) */
  roasters() {
    const counts = this.sql.exec<{ host: string; n: number; drips: number; live: number }>(
      `SELECT host, COUNT(*) AS n,
         SUM(CASE WHEN data LIKE '%"kind":"drip"%' OR data LIKE '%"dripOptions"%' THEN 1 ELSE 0 END) AS drips,
         SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS live
       FROM coffee WHERE host IS NOT NULL GROUP BY host`).toArray();
    const by = new Map(counts.map((c) => [c.host, c]));
    return this.sql.exec<{ host: string; roaster: string }>("SELECT host, roaster FROM site WHERE status = 'approved' ORDER BY roaster").toArray()
      .map((s) => ({ host: s.host, roaster: s.roaster || s.host, lots: by.get(s.host)?.n ?? 0, drips: by.get(s.host)?.drips ?? 0, onSale: by.get(s.host)?.live ?? 0 }))
      .filter((s) => s.lots > 0);
  }

  /** Lots of one roaster: on sale first, then by name. kind: 'beans' | 'drip'; q — search in name, country, process, notes. */
  list(host: string, kind: string | null, q: string, limit = 300) {
    const rows = this.sql.exec<{ id: string; data: string; state: string; url: string | null }>(
      'SELECT id, data, state, url FROM coffee WHERE host = ?', normHost(host)).toArray();
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => { const { pv: _pv, ...coffee } = JSON.parse(r.data) as Coffee & { pv?: number }; void _pv; return { id: r.id, coffee, state: (r.state || 'active') as LotState, url: r.url ?? undefined }; })
      .filter((r) => !r.coffee.isBlend || r.coffee.name)
      .filter((r) => kind === 'drip' ? r.coffee.kind === 'drip' || !!r.coffee.dripOptions?.length : kind === 'beans' ? r.coffee.kind !== 'drip' : true)
      .filter((r) => !needle || [r.coffee.name, r.coffee.country, r.coffee.region, r.coffee.process, r.coffee.variety, r.coffee.packNotes].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.coffee.name ?? '').localeCompare(b.coffee.name ?? '', 'ru'))
      .slice(0, limit);
  }

  /* ---------- sites ---------- */

  private site(host: string): SiteRow | null {
    const r = this.sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM site WHERE host = ?', normHost(host)).toArray()[0];
    if (!r) return null;
    return {
      host: r.host as string, roaster: r.roaster as string, status: r.status as SiteStatus, rules: JSON.parse((r.rules as string) || '{}'),
      robots: r.robots ? JSON.parse(r.robots as string) : null, added: r.added as number, requests: r.requests as number,
      sample: (r.sample as string) ?? null, crawlStart: (r.crawl_start as number) ?? null, crawled: (r.crawled as number) ?? null, lastFetch: r.last_fetch as number,
    };
  }

  /** May the server fetch pages of this site? Unknown sites are queued for the owner (returns 'new' the first time). */
  siteGate(url: string): SiteStatus | 'new' | null {
    const host = hostOf(url);
    if (!host) return null;
    const s = this.site(host);
    if (s) {
      if (s.status === 'pending') this.sql.exec('UPDATE site SET requests = requests + 1 WHERE host = ?', host);
      if (s.status === 'approved' && s.robots && !robotsAllows(s.robots, new URL(url).pathname + new URL(url).search)) return 'rejected';
      return s.status;
    }
    this.sql.exec("INSERT INTO site (host, status, added, requests, sample) VALUES (?, 'pending', ?, 1, ?)", host, Date.now(), url.slice(0, 500));
    return 'new';
  }

  /** Owner view: every site with its numbers */
  sites() {
    const pages = this.sql.exec<{ host: string; status: string; n: number }>('SELECT host, status, COUNT(*) AS n FROM page GROUP BY host, status').toArray();
    const lots = this.sql.exec<{ host: string; state: string; n: number }>('SELECT host, state, COUNT(*) AS n FROM coffee WHERE host IS NOT NULL GROUP BY host, state').toArray();
    return this.sql.exec<{ host: string }>('SELECT host FROM site ORDER BY status, host').toArray().map(({ host }) => {
      const s = this.site(host as string)!;
      const p = Object.fromEntries(pages.filter((x) => x.host === s.host).map((x) => [x.status, x.n]));
      const l = Object.fromEntries(lots.filter((x) => x.host === s.host).map((x) => [x.state, x.n]));
      return { host: s.host, roaster: s.roaster, status: s.status, added: s.added, requests: s.requests, sample: s.sample, crawled: s.crawled, crawling: !!s.crawlStart, pages: p, lots: l };
    });
  }

  setSite(host: string, status: SiteStatus, roaster?: string) {
    const h = normHost(host);
    if (!/^[a-z0-9.-]{3,100}$/.test(h)) return false;
    this.sql.exec(`INSERT INTO site (host, roaster, status, added) VALUES (?, ?, ?, ?)
      ON CONFLICT(host) DO UPDATE SET status = excluded.status, roaster = CASE WHEN excluded.roaster <> '' THEN excluded.roaster ELSE site.roaster END`,
    h, (roaster ?? '').trim().slice(0, 60), status, Date.now());
    if (status === 'approved') this.recrawl(h);
    if (status === 'rejected') this.sql.exec("UPDATE page SET status = 'skip' WHERE host = ? AND status = 'queued'", h);
    return true;
  }

  /** Re-read the site's sitemaps on the next steps */
  recrawl(host: string) {
    this.sql.exec('UPDATE site SET crawled = NULL, crawl_start = NULL WHERE host = ?', normHost(host));
    this.sql.exec('DELETE FROM sitemap WHERE host = ?', normHost(host));
    return this.kick();
  }

  /** Make sure the crawler runs (cron calls this as a heartbeat) */
  async kick() {
    const at = await this.ctx.storage.getAlarm();
    if (!at || at > Date.now() + STEP) await this.ctx.storage.setAlarm(Date.now() + 1000);
    return true;
  }

  /* ---------- crawler ---------- */

  async alarm() {
    let busy = false;
    try { busy = await this.step(); } catch (e) { console.log('crawl step failed', e); busy = true; }
    const next = busy ? Date.now() + STEP : this.nextDue();
    await this.ctx.storage.setAlarm(next);
  }

  private nextDue() {
    const due = this.sql.exec<{ t: number | null }>("SELECT MIN(COALESCE(crawled, 0)) AS t FROM site WHERE status = 'approved'").one().t ?? Date.now();
    return Math.min(Math.max(due + RECRAWL, Date.now() + STEP), Date.now() + 6 * 3_600_000);
  }

  /** One unit of work. Returns false when there is nothing to do right now. */
  async step(): Promise<boolean> {
    const now = Date.now();
    // 1. continue a sitemap that has entries left
    const sm = this.sql.exec<{ url: string; host: string; rest: string | null }>('SELECT url, host, rest FROM sitemap WHERE done = 0 LIMIT 1').toArray()[0];
    if (sm) { await this.sitemapStep(sm); return true; }
    // 2. a site whose sitemap pass just ended: pages that left the sitemap are gone
    const ended = this.sql.exec<{ host: string; crawl_start: number }>("SELECT host, crawl_start FROM site WHERE status = 'approved' AND crawl_start IS NOT NULL LIMIT 1").toArray()[0];
    if (ended) { this.finishPass(ended.host, ended.crawl_start); return true; }
    // 3. start a sitemap pass for a site that is due
    const due = this.sql.exec<{ host: string }>("SELECT host FROM site WHERE status = 'approved' AND (crawled IS NULL OR crawled < ?) ORDER BY COALESCE(crawled, 0) LIMIT 1", now - RECRAWL).toArray()[0];
    if (due) { await this.startPass(due.host); return true; }
    // 4. fetch one queued page, from the site that waited longest
    const pick = this.sql.exec<{ url: string; host: string }>(
      `SELECT p.url, p.host FROM page p JOIN site s ON s.host = p.host
       WHERE p.status = 'queued' AND s.status = 'approved' AND s.last_fetch < ?
       ORDER BY s.last_fetch, p.fetched IS NOT NULL, p.url LIMIT 1`, now - PER_SITE).toArray()[0];
    if (pick) { await this.pageStep(pick.url, pick.host); return true; }
    return !!this.sql.exec("SELECT 1 FROM page WHERE status = 'queued' LIMIT 1").toArray().length;
  }

  private touch(host: string) { this.sql.exec('UPDATE site SET last_fetch = ? WHERE host = ?', Date.now(), host); }

  private async startPass(host: string) {
    const s = this.site(host)!;
    const now = Date.now();
    this.touch(host);
    const r = await fetchText(`https://${host}/robots.txt`, { accept: 'text/plain', maxBytes: 200_000 });
    const robots = r && r.status === 200 && !r.type.includes('html') ? parseRobots(r.text) : { disallow: [], allow: [], sitemaps: [] };
    const maps = (s.rules.sitemaps?.length ? s.rules.sitemaps : robots.sitemaps.filter((u) => hostOf(u) === host));
    const list = maps.length ? maps : [`https://${host}/sitemap.xml`];
    this.sql.exec('UPDATE site SET robots = ?, crawl_start = ? WHERE host = ?', JSON.stringify(robots), now, host);
    this.sql.exec('DELETE FROM sitemap WHERE host = ?', host);
    for (const u of list) this.sql.exec('INSERT OR IGNORE INTO sitemap (url, host) VALUES (?, ?)', u, host);
  }

  private async sitemapStep(sm: { url: string; host: string; rest: string | null }) {
    const s = this.site(sm.host);
    if (!s || s.status !== 'approved') { this.sql.exec('UPDATE sitemap SET done = 1 WHERE url = ?', sm.url); return; }
    let entries: { loc: string; lastmod?: string }[];
    if (sm.rest) entries = JSON.parse(sm.rest);
    else {
      this.touch(sm.host);
      const r = await fetchText(sm.url, { accept: 'application/xml,text/xml', maxBytes: 8_000_000, timeoutMs: 15_000 });
      if (!r || r.status !== 200) {
        console.log('sitemap failed', sm.url, r?.status);
        this.sql.exec("UPDATE sitemap SET done = 1, rest = 'failed' WHERE url = ?", sm.url);
        return;
      }
      const parsed = parseSitemap(r.text);
      if (parsed.index) {
        for (const e of parsed.entries.slice(0, 50)) if (hostOf(e.loc) === sm.host) this.sql.exec('INSERT OR IGNORE INTO sitemap (url, host) VALUES (?, ?)', e.loc, sm.host);
        this.sql.exec('UPDATE sitemap SET done = 1 WHERE url = ?', sm.url);
        return;
      }
      // keep only product pages of this site that robots.txt allows
      entries = parsed.entries.filter((e) => {
        if (hostOf(e.loc) !== sm.host) return false;
        const u = new URL(e.loc);
        return wanted(s.rules, u.pathname) && robotsAllows(s.robots, u.pathname + u.search);
      }).slice(0, 5000);
    }
    const now = Date.now();
    for (const e of entries.slice(0, CHUNK)) {
      const url = canonicalUrl(e.loc)!;
      const cur = this.sql.exec<{ lastmod: string | null; status: string; fetched: number | null }>('SELECT lastmod, status, fetched FROM page WHERE url = ?', url).toArray()[0];
      if (!cur) {
        this.sql.exec("INSERT INTO page (url, host, lastmod, seen, status) VALUES (?, ?, ?, ?, 'queued')", url, sm.host, e.lastmod ?? null, now);
        continue;
      }
      const changed = (e.lastmod && e.lastmod !== cur.lastmod) || !cur.fetched || cur.fetched < now - REFRESH || cur.status === 'gone';
      this.sql.exec(`UPDATE page SET seen = ?, lastmod = ?, attempts = CASE WHEN ? THEN 0 ELSE attempts END,
        status = CASE WHEN ? AND status <> 'queued' THEN 'queued' ELSE status END WHERE url = ?`,
      now, e.lastmod ?? cur.lastmod, changed ? 1 : 0, changed ? 1 : 0, url);
    }
    const rest = entries.slice(CHUNK);
    if (rest.length) this.sql.exec('UPDATE sitemap SET rest = ? WHERE url = ?', JSON.stringify(rest), sm.url);
    else this.sql.exec('UPDATE sitemap SET done = 1, rest = NULL WHERE url = ?', sm.url);
  }

  private finishPass(host: string, start: number) {
    const maps = this.sql.exec<{ ok: number; failed: number }>(
      "SELECT SUM(CASE WHEN rest IS NULL THEN 1 ELSE 0 END) AS ok, SUM(CASE WHEN rest = 'failed' THEN 1 ELSE 0 END) AS failed FROM sitemap WHERE host = ?", host).one();
    const seen = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM page WHERE host = ? AND seen >= ?', host, start).one().n;
    if (maps.failed && !maps.ok || !seen) {
      // the sitemap could not be read: try again in an hour, keep everything as is
      this.sql.exec('UPDATE site SET crawl_start = NULL, crawled = ? WHERE host = ?', Date.now() - RECRAWL + 3_600_000, host);
      return;
    }
    const left = this.sql.exec<{ coffee: string | null }>("SELECT coffee FROM page WHERE host = ? AND seen < ? AND status <> 'gone'", host, start).toArray();
    this.sql.exec("UPDATE page SET status = 'gone' WHERE host = ? AND seen < ?", host, start);
    for (const p of left) if (p.coffee) this.sql.exec("UPDATE coffee SET state = 'gone' WHERE id = ? AND state <> 'archived'", p.coffee);
    this.sql.exec('UPDATE site SET crawl_start = NULL, crawled = ? WHERE host = ?', Date.now(), host);
  }

  private async pageStep(url: string, host: string) {
    const s = this.site(host)!;
    // count the attempt first: a page that crashes the step is not retried forever
    this.sql.exec('UPDATE page SET attempts = attempts + 1 WHERE url = ?', url);
    const attempts = this.sql.exec<{ attempts: number }>('SELECT attempts FROM page WHERE url = ?', url).one().attempts;
    if (attempts > 3) { this.sql.exec("UPDATE page SET status = 'error' WHERE url = ?", url); return; }
    this.touch(host);
    const r = await fetchText(url);
    const now = Date.now();
    if (!r) return; // network error: stays queued, attempts counts it
    if (r.status === 404 || r.status === 410) {
      const p = this.sql.exec<{ coffee: string | null }>('SELECT coffee FROM page WHERE url = ?', url).one();
      this.sql.exec("UPDATE page SET status = 'gone', fetched = ? WHERE url = ?", now, url);
      if (p.coffee) this.sql.exec("UPDATE coffee SET state = 'gone' WHERE id = ? AND state <> 'archived'", p.coffee);
      return;
    }
    if (r.status !== 200 || !r.type.includes('html')) return;
    const parsed = parsePage(r.text, url);
    const { inStock, unsupported, ...rest } = parsed;
    const coffee = cleanCoffee(rest);
    // on an approved roaster site a name with a country is enough (HQ! coffee pages are sparse); merch has neither
    if (unsupported || (usefulCount(coffee as Record<string, unknown>) < 2 && !(coffee.country && coffee.name))) {
      this.sql.exec("UPDATE page SET status = 'skip', fetched = ?, attempts = 0 WHERE url = ?", now, url);
      return;
    }
    const state: LotState = isArchive(s.rules, new URL(url).pathname) ? 'archived' : inStock === false ? 'out' : 'active';
    // the owner named the roaster when approving the site: that name wins over whatever the page says
    if (s.roaster) coffee.roaster = s.roaster;
    const id = this.upsertCrawled(url, coffee, state, PARSER_VERSION);
    this.sql.exec("UPDATE page SET status = 'ok', fetched = ?, attempts = 0, coffee = ? WHERE url = ?", now, id, url);
  }
}
