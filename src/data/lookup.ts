import { RATINGS_API } from '../config';
import { platform } from '../platform';
import { newDripItem, uid, type Bean } from './store';
import { SCALES } from './scales';

export interface LookupResult {
  code: string;
  kind: 'ean' | 'qr-data' | 'url' | 'text';
  existing?: Bean;
  patch: Partial<Bean>;
  source?: string;
  /** the roaster's site is not connected to the catalog yet (the owner was asked to approve it) */
  pending?: boolean;
}

/* ---------- Shared coffee catalog on the server ---------- */

/** What the catalog stores: the lot description without personal data (roast date, stock, notes stay with you) */
const COFFEE_TEXT = ['name', 'roaster', 'country', 'region', 'farm', 'producer', 'variety', 'process', 'altitude', 'roastLevel', 'packNotes'] as const;

export type Coffee = Partial<Pick<Bean, typeof COFFEE_TEXT[number] | 'kind' | 'dripCount' | 'assorted' | 'isBlend' | 'scales'>> & {
  parts?: Partial<NonNullable<Bean['parts']>[number]>[];
  drips?: Partial<NonNullable<Bean['drips']>[number]>[];
  /** also sold as drip boxes of these sizes */
  dripOptions?: number[];
};

/** on sale · out of stock · in the roaster's archive · removed from the site */
export type LotState = 'active' | 'out' | 'archived' | 'gone';

interface Remote { source: 'catalog' | 'page' | 'none'; id?: string; coffee?: Coffee; confirms?: number; state?: LotState; link?: string; pending?: boolean }

async function remoteLookup(q: { url?: string; code?: string }): Promise<Remote | null> {
  if (!RATINGS_API) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    const r = await fetch(`${RATINGS_API}/lookup?${qs}`, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Catalog lot → pack fields. drip — the user is adding a drip box: a lot sold in both forms gives its smallest box size. */
export function coffeeToPatch(c: Coffee, id?: string, drip = false): Partial<Bean> {
  const out: Partial<Bean> = {};
  for (const k of COFFEE_TEXT) if (c[k]) out[k] = c[k];
  if (c.kind === 'drip') out.kind = 'drip';
  if (c.dripCount) out.dripCount = c.dripCount;
  else if (drip && c.dripOptions?.length) out.dripCount = Math.min(...c.dripOptions);
  // the site gives no count — assume a single drip
  else if (c.kind === 'drip' && !c.assorted) out.dripCount = 1;
  if (c.assorted) out.assorted = true;
  if (c.isBlend && c.parts?.length) {
    out.isBlend = true;
    out.parts = c.parts.map((p) => ({ share: '', country: '', region: '', farm: '', variety: '', process: '', ...p, id: uid() }));
  }
  if (c.drips?.length) out.drips = c.drips.map((d) => ({ ...newDripItem(), ...d, count: d.count || 1 }));
  if (c.scales && Object.keys(c.scales).length) out.scales = { ...c.scales };
  if (id) out.catalogId = id;
  return out;
}

/** Pack → catalog description */
export function beanToCoffee(b: Bean): Coffee {
  const c: Coffee = {};
  for (const k of COFFEE_TEXT) { const v = (b[k] ?? '').trim(); if (v) c[k] = v; }
  if (b.kind === 'drip') {
    c.kind = 'drip';
    if (b.assorted) c.assorted = true; else if (b.dripCount) c.dripCount = b.dripCount;
    if (b.assorted && b.drips?.length) c.drips = b.drips.map(({ id: _i, ...d }) => { void _i; return d; });
  }
  if (b.isBlend && b.parts?.length) { c.isBlend = true; c.parts = b.parts.map(({ id: _i, ...p }) => { void _i; return p; }); }
  if (b.scales && Object.keys(b.scales).length) c.scales = b.scales;
  return c;
}

/** Catalog keys of a pack: QR link and barcode */
export function catalogKeys(b: Pick<Bean, 'link' | 'barcode'>) {
  const url = [b.link, b.barcode].find((x) => /^https?:\/\//i.test(x ?? ''));
  const code = /^\d{8,14}$/.test(b.barcode ?? '') ? b.barcode : undefined;
  return { url, code };
}

/** A pack was saved — fill in or confirm the lot in the shared catalog. Returns the lot id. */
export async function contributeCoffee(b: Bean): Promise<string | null> {
  const initData = platform.initData();
  const { url, code } = catalogKeys(b);
  const coffee = beanToCoffee(b);
  if (!RATINGS_API || !initData || (!url && !code) || Object.keys(coffee).length < 2) return null;
  try {
    const r = await fetch(`${RATINGS_API}/catalog`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, url, code, coffee }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.id === 'string' ? j.id : null;
  } catch { return null; }
}

/** Labels of filled fields — for the "Filled in: …" message */
const FIELD_LABELS: Partial<Record<keyof Bean, string>> = {
  name: 'название', roaster: 'обжарщик', country: 'страна', region: 'регион', farm: 'ферма', producer: 'производитель',
  variety: 'сорт', process: 'обработка', altitude: 'высота', roastLevel: 'обжарка', packNotes: 'дескрипторы',
  parts: 'состав бленда', drips: 'дрипы в коробке', scales: 'профиль от обжарщика',
};
export function filledLabels(before: Bean, after: Bean) {
  const out: string[] = [];
  for (const [k, label] of Object.entries(FIELD_LABELS)) {
    const a = (before as unknown as Record<string, unknown>)[k], b = (after as unknown as Record<string, unknown>)[k];
    if (!a && b) out.push(label!);
  }
  if (before.kind !== 'drip' && after.kind === 'drip') out.unshift(after.dripCount ? `дрип-пакеты, ${after.dripCount} шт` : 'дрип-пакеты');
  void SCALES;
  return out;
}

/** Field synonyms for QR codes with text or JSON on the pack */
const KEYS: Record<string, keyof Bean> = {
  name: 'name', lot: 'name', 'название': 'name', 'лот': 'name', coffee: 'name',
  roaster: 'roaster', 'обжарщик': 'roaster', brand: 'roaster',
  country: 'country', origin: 'country', 'страна': 'country',
  region: 'region', 'регион': 'region',
  farm: 'farm', station: 'farm', 'ферма': 'farm', 'станция': 'farm',
  producer: 'producer', 'производитель': 'producer',
  variety: 'variety', varietal: 'variety', 'сорт': 'variety', 'разновидность': 'variety',
  process: 'process', processing: 'process', 'обработка': 'process',
  altitude: 'altitude', elevation: 'altitude', 'высота': 'altitude',
  harvest: 'harvest', 'урожай': 'harvest',
  roastdate: 'roastDate', roast_date: 'roastDate', roasted: 'roastDate', 'дата обжарки': 'roastDate', 'обжарка': 'roastDate',
  roastlevel: 'roastLevel', roast: 'roastLevel', 'степень обжарки': 'roastLevel',
  notes: 'packNotes', 'дескрипторы': 'packNotes', 'вкус': 'packNotes', 'профиль': 'packNotes',
  weight: 'weight', 'вес': 'weight',
};

function normDate(v: string) {
  const m = v.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v;
}

function mapFields(entries: [string, unknown][]): Partial<Bean> {
  const out: Partial<Bean> = {};
  for (const [k, v] of entries) {
    const key = KEYS[k.trim().toLowerCase()];
    if (!key || v === null || v === undefined || v === '') continue;
    const s = Array.isArray(v) ? v.join(', ') : String(v).trim();
    (out as Record<string, string>)[key] = key === 'roastDate' ? normDate(s) : s;
  }
  return out;
}

function parseQrText(text: string): Partial<Bean> {
  const t = text.trim();
  if (t.startsWith('{')) {
    try { return mapFields(Object.entries(JSON.parse(t))); } catch { /* not JSON */ }
  }
  const lines = t.split(/\r?\n|;/).map((l) => l.split(/:\s*/)).filter((p) => p.length >= 2);
  return mapFields(lines.map(([k, ...rest]) => [k, rest.join(':')]));
}

async function openFoodFacts(code: string): Promise<Partial<Bean> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,origins,quantity`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const p = j?.product;
    if (!p || j.status === 0) return null;
    const out: Partial<Bean> = {};
    if (p.product_name) out.name = p.product_name;
    if (p.brands) out.roaster = String(p.brands).split(',')[0].trim();
    if (p.origins) out.country = p.origins;
    const w = String(p.quantity ?? '').match(/(\d+)\s*g/i);
    if (w) out.weight = w[1];
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function lookupCode(raw: string, beans: Bean[], drip = false): Promise<LookupResult> {
  const code = raw.trim();
  const existing = beans.find((b) => b.barcode && b.barcode === code);

  if (/^\d{8,14}$/.test(code)) {
    if (existing) return { code, kind: 'ean', existing, patch: {} };
    const remote = await remoteLookup({ code });
    if (remote?.coffee && remote.source !== 'none') {
      return { code, kind: 'ean', patch: { barcode: code, ...coffeeToPatch(remote.coffee, remote.id, drip) }, source: sourceText(remote) };
    }
    const off = await openFoodFacts(code);
    return { code, kind: 'ean', patch: { barcode: code, ...(off ?? {}) }, source: off ? 'Open Food Facts' : undefined };
  }
  if (/^https?:\/\//i.test(code)) {
    if (existing) return { code, kind: 'url', existing, patch: {} };
    const remote = await remoteLookup({ url: code });
    const patch: Partial<Bean> = { barcode: code.slice(0, 300), link: code };
    if (remote?.coffee && remote.source !== 'none') return { code, kind: 'url', patch: { ...patch, ...coffeeToPatch(remote.coffee, remote.id, drip) }, source: sourceText(remote) };
    return { code, kind: 'url', patch, pending: remote?.pending };
  }
  const parsed = parseQrText(code);
  if (Object.keys(parsed).length) return { code, kind: 'qr-data', existing, patch: { barcode: code.slice(0, 64), ...parsed }, source: 'QR-код на пачке' };
  return { code, kind: 'text', existing, patch: { barcode: code } };
}

/* ---------- Browsing the catalog by roaster ---------- */

export interface Roaster { host: string; roaster: string; lots: number; drips: number; onSale: number }
export interface Lot { id: string; coffee: Coffee; state: LotState; url?: string }

async function getJson<T>(path: string): Promise<T | null> {
  if (!RATINGS_API) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${RATINGS_API}${path}`, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export const fetchRoasters = async () => (await getJson<{ roasters: Roaster[] }>('/roasters'))?.roasters ?? null;
export const fetchLots = async (host: string, kind: 'beans' | 'drip') =>
  (await getJson<{ lots: Lot[] }>(`/catalog/list?${new URLSearchParams({ host, kind })}`))?.lots ?? null;

export const STATE_LABEL: Record<LotState, string> = { active: '', out: 'нет в наличии', archived: 'архив', gone: 'снят с продажи' };

/* ---------- Owner tools: roaster sites ---------- */

export interface SiteInfo {
  host: string; roaster: string; status: 'approved' | 'pending' | 'rejected'; added: number; requests: number; sample: string | null;
  crawled: number | null; crawling: boolean; pages: Record<string, number>; lots: Record<string, number>;
}

/** Owner-only: list or change roaster sites. null — not the owner or no connection. */
export async function adminSites(action: 'list' | 'approve' | 'reject' | 'recrawl' = 'list', host?: string, roaster?: string): Promise<SiteInfo[] | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  try {
    const r = await fetch(`${RATINGS_API}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, action, host, roaster }) });
    if (!r.ok) return null;
    return (await r.json()).sites ?? null;
  } catch { return null; }
}

function sourceText(r: Remote) {
  if (r.source === 'catalog') return r.confirms && r.confirms > 1 ? `общий каталог · подтвердили ${r.confirms}` : 'общий каталог';
  return 'страница обжарщика';
}

/** Merge data without overwriting what the user already entered */
export function mergeEmpty(b: Bean, patch: Partial<Bean>): Bean {
  const next = { ...b } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v && !next[k]) next[k] = v;
  }
  return next as unknown as Bean;
}
