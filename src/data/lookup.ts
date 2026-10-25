import type { Bean } from './store';

export interface LookupResult {
  code: string;
  kind: 'ean' | 'qr-data' | 'url' | 'text';
  existing?: Bean;
  patch: Partial<Bean>;
  source?: string;
}

/** Синонимы полей для QR с текстом или JSON на пачке */
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
    try { return mapFields(Object.entries(JSON.parse(t))); } catch { /* не JSON */ }
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

export async function lookupCode(raw: string, beans: Bean[]): Promise<LookupResult> {
  const code = raw.trim();
  const existing = beans.find((b) => b.barcode && b.barcode === code);

  if (/^\d{8,14}$/.test(code)) {
    if (existing) return { code, kind: 'ean', existing, patch: {} };
    const off = await openFoodFacts(code);
    return { code, kind: 'ean', patch: { barcode: code, ...(off ?? {}) }, source: off ? 'Open Food Facts' : undefined };
  }
  if (/^https?:\/\//i.test(code)) {
    return { code, kind: 'url', existing, patch: { barcode: code, link: code } };
  }
  const parsed = parseQrText(code);
  if (Object.keys(parsed).length) return { code, kind: 'qr-data', existing, patch: { barcode: code.slice(0, 64), ...parsed }, source: 'QR-код на пачке' };
  return { code, kind: 'text', existing, patch: { barcode: code } };
}

/** Перенести данные, не затирая то, что пользователь уже ввёл */
export function mergeEmpty(b: Bean, patch: Partial<Bean>): Bean {
  const next = { ...b } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v && !next[k]) next[k] = v;
  }
  return next as unknown as Bean;
}
