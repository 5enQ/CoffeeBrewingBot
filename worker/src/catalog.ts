/**
 * Shared coffee catalog: one lot — one record, reached by keys (QR link, barcode).
 * The global coffee rating will live here later: every lot has a permanent id.
 *
 * Nothing personal here: roast date, stock, notes and brews stay on the user's device.
 * About users only the Telegram id of whoever confirmed or edited a lot is stored (protection against abuse).
 */
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';

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
  image?: string;
};

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

export interface Found { id: string; coffee: Coffee; source: 'page' | 'user'; confirms: number; pv?: number }

export class CoffeeCatalog extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS coffee (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, source TEXT NOT NULL, confirms INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS coffee_key (key TEXT PRIMARY KEY, coffee TEXT NOT NULL)`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS contrib (
      coffee TEXT NOT NULL, user TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (coffee, user))`);
  }

  private byKeys(keys: string[]): string | null {
    for (const k of keys) {
      const row = this.ctx.storage.sql.exec<{ coffee: string }>('SELECT coffee FROM coffee_key WHERE key = ?', k).toArray()[0];
      if (row) return row.coffee;
    }
    return null;
  }

  private get(id: string): Found | null {
    const row = this.ctx.storage.sql.exec<{ data: string; source: string; confirms: number }>('SELECT data, source, confirms FROM coffee WHERE id = ?', id).toArray()[0];
    if (!row) return null;
    // pv — parser version the lot was taken from the page with (internal, not returned)
    const { pv, ...coffee } = JSON.parse(row.data) as Coffee & { pv?: number };
    return { id, coffee, source: row.source as Found['source'], confirms: row.confirms, pv };
  }

  /** The parser improved — update a lot nobody has confirmed yet */
  refreshPage(id: string, coffee: Coffee, pv: number): Found | null {
    const cur = this.get(id);
    if (!cur || cur.source !== 'page' || cur.confirms > 0) return cur;
    this.ctx.storage.sql.exec('UPDATE coffee SET data = ?, updated = ? WHERE id = ?', JSON.stringify({ ...coffee, pv }), Date.now(), id);
    return this.get(id);
  }

  private link(id: string, keys: string[]) {
    for (const k of keys) this.ctx.storage.sql.exec('INSERT OR IGNORE INTO coffee_key (key, coffee) VALUES (?, ?)', k, id);
  }

  private create(coffee: Coffee, source: 'page' | 'user', keys: string[]) {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Date.now();
    this.ctx.storage.sql.exec('INSERT INTO coffee (id, data, source, confirms, created, updated) VALUES (?, ?, ?, 0, ?, ?)', id, JSON.stringify(coffee), source, now, now);
    this.link(id, keys);
    return id;
  }

  find(keys: string[]): Found | null {
    const id = this.byKeys(keys);
    return id ? this.get(id) : null;
  }

  /** Parsed page: save it if there is no such lot yet */
  savePage(keys: string[], coffee: Coffee, pv: number): Found {
    const found = this.find(keys);
    if (found) { this.link(found.id, keys); return found; }
    const id = this.create({ ...coffee, pv } as Coffee, 'page', keys);
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
      const id = this.create(coffee, 'user', keys);
      this.ctx.storage.sql.exec('INSERT OR IGNORE INTO contrib (coffee, user, ts) VALUES (?, ?, ?)', id, user, now);
      this.ctx.storage.sql.exec('UPDATE coffee SET confirms = 1 WHERE id = ?', id);
      return this.get(id)!;
    }
    const trusted = found.confirms >= 2;
    const merged: Record<string, unknown> = { ...found.coffee, pv: found.pv };
    for (const [k, v] of Object.entries(coffee)) {
      if (merged[k] === undefined || !trusted) merged[k] = v;
    }
    const isNew = !this.ctx.storage.sql.exec('SELECT 1 FROM contrib WHERE coffee = ? AND user = ?', found.id, user).toArray().length;
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO contrib (coffee, user, ts) VALUES (?, ?, ?)', found.id, user, now);
    this.ctx.storage.sql.exec('UPDATE coffee SET data = ?, updated = ?, confirms = confirms + ? WHERE id = ?', JSON.stringify(merged), now, isNew ? 1 : 0, found.id);
    this.link(found.id, keys);
    return this.get(found.id)!;
  }
}
