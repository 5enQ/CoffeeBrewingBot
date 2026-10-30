/**
 * Roaster coffee page → pack fields.
 * No DOM: only regular expressions over the raw HTML (Cloudflare Workers).
 *
 * Sources, most reliable first:
 *  1. Store engine attributes: Tilda (js-store-prod-charcs / json_chars),
 *     1C-Bitrix with the Aspro template (properties__title / properties__value),
 *     WooCommerce themes with label / value pairs.
 *  2. "Label: value" lines in the description.
 *  3. Title (h1) — country and drip markers.
 * Whatever is not on the page is not filled in.
 */
import { scaleKeyOf, scaleValueOf, type Scales } from '../../src/data/scales.ts';

/** Page parser version: bump when the parser learns something new — unconfirmed lots refresh on the next scan or crawl */
export const PARSER_VERSION = 3;

export interface Parsed {
  name?: string;
  roaster?: string;
  country?: string;
  region?: string;
  farm?: string;
  producer?: string;
  variety?: string;
  process?: string;
  altitude?: string;
  roastLevel?: string;
  /** also sold as drip bags in these box sizes (a page with a "pack / drips" switch) */
  dripOptions?: number[];
  /** false — out of stock (schema.org availability); undefined — unknown */
  inStock?: boolean;
  /** capsules and other forms the app cannot brew — the crawler skips them */
  unsupported?: boolean;
  packNotes?: string;
  kind?: 'drip';
  dripCount?: number;
  scales?: Scales;
  image?: string;
}

type Field = Exclude<keyof Parsed, 'kind' | 'dripCount' | 'scales' | 'image' | 'name' | 'dripOptions' | 'inStock' | 'unsupported'>;

/** Site labels → pack field (lowercase, no colon) */
const LABELS: Record<string, Field> = {};
const add = (f: Field, ...labels: string[]) => labels.forEach((l) => { LABELS[l] = f; });
add('country', 'страна', 'страна произрастания', 'страна происхождения', 'страна производства');
add('region', 'регион', 'регион произрастания', 'область', 'провинция', 'район');
add('farm', 'ферма', 'станция', 'станция обработки', 'мытьевая станция', 'хозяйство', 'плантация', 'ферма / станция', 'ферма/станция');
add('producer', 'производитель', 'фермер', 'владелец');
add('variety', 'сорт', 'сорта', 'разновидность', 'разновидности', 'ботанический сорт', 'ботаническая разновидность', 'варьетал');
add('process', 'обработка', 'способ обработки', 'метод обработки', 'тип обработки');
add('altitude', 'высота', 'высота произрастания', 'высота над уровнем моря');
add('roastLevel', 'обжарка', 'степень обжарки', 'профиль обжарки', 'уровень обжарки');
add('packNotes', 'дескрипторы', 'вкус', 'букет', 'ноты', 'вкусовые ноты', 'вкусовой профиль', 'во вкусе', 'вкусовые дескрипторы', 'дескрипторы вкуса');
add('roaster', 'бренд', 'обжарщик', 'производитель кофе', 'торговая марка');

const COUNTRIES = ['Эфиопия', 'Кения', 'Руанда', 'Бурунди', 'Танзания', 'Уганда', 'Конго', 'Малави', 'Замбия', 'Камерун', 'Колумбия',
  'Бразилия', 'Перу', 'Эквадор', 'Боливия', 'Коста-Рика', 'Панама', 'Гватемала', 'Гондурас', 'Сальвадор', 'Никарагуа', 'Мексика',
  'Доминикана', 'Ямайка', 'Куба', 'Гаити', 'Йемен', 'Индонезия', 'Индия', 'Вьетнам', 'Китай', 'Таиланд', 'Лаос', 'Мьянма', 'Филиппины',
  'Папуа — Новая Гвинея', 'Папуа-Новая Гвинея', 'Тимор'];

/** Known sites → roaster (if the page has no "Бренд" field) */
const ROASTERS: Record<string, string> = {
  'kojocoffee.ru': 'Kojo',
  'sbmrne.ru': 'Submarine',
  'hq-coffee.com': 'HQ! coffee',
  'theweldercatherine.ru': 'Сварщица Екатерина',
  'shop.tastycoffee.ru': 'Tasty Coffee',
};

/** English country names in titles (HQ! coffee and others) → Russian */
const COUNTRIES_EN: Record<string, string> = {
  ethiopia: 'Эфиопия', kenya: 'Кения', rwanda: 'Руанда', burundi: 'Бурунди', tanzania: 'Танзания', uganda: 'Уганда', congo: 'Конго',
  malawi: 'Малави', zambia: 'Замбия', cameroon: 'Камерун', colombia: 'Колумбия', brazil: 'Бразилия', peru: 'Перу', ecuador: 'Эквадор',
  bolivia: 'Боливия', 'costa rica': 'Коста-Рика', panama: 'Панама', guatemala: 'Гватемала', honduras: 'Гондурас', 'el salvador': 'Сальвадор',
  salvador: 'Сальвадор', nicaragua: 'Никарагуа', mexico: 'Мексика', yemen: 'Йемен', indonesia: 'Индонезия', india: 'Индия',
  vietnam: 'Вьетнам', china: 'Китай', thailand: 'Таиланд', laos: 'Лаос', myanmar: 'Мьянма', 'papua new guinea': 'Папуа — Новая Гвинея',
  jamaica: 'Ямайка', haiti: 'Гаити', 'dominican republic': 'Доминикана', cuba: 'Куба', timor: 'Тимор', philippines: 'Филиппины',
};

/** Process wording on sites → the app's names (Мытая, Натуральная, Хани, Анаэробная, …), each comma part separately */
const PROCESS_WORDS: [RegExp, string][] = [
  [/^(мыт\S*|washed|fully washed)$/i, 'мытая'], [/^(натурал\S*|natural|сухая)$/i, 'натуральная'], [/^(хани|honey)$/i, 'хани'],
  [/^(анаэроб\S*|anaerobic)$/i, 'анаэробная'], [/^(вет-?халл|wet[- ]?hulled)$/i, 'Wet-hulled'],
];
export function normalizeProcess(v: string) {
  const parts = v.split(/\s*,\s*/).map((p) => {
    const hit = PROCESS_WORDS.find(([re]) => re.test(p.trim()));
    return hit ? hit[1] : p;
  });
  return cap(parts.join(', '));
}

/** Roast level wording on sites → the app's levels (Светлая / Омни / Средняя / Тёмная); unknown wording is kept */
export function normalizeRoast(v: string) {
  const s = v.toLowerCase();
  if (/омни|omni/.test(s) || (/фильтр|filter|светл/.test(s) && /эспрессо|espresso|средн/.test(s))) return 'Омни';
  if (/т[её]мн|dark/.test(s)) return 'Тёмная';
  if (/средн|эспрессо|espresso|medium/.test(s)) return 'Средняя';
  if (/светл|фильтр|filter|light/.test(s)) return 'Светлая';
  return cap(v);
}

/* ---------- text ---------- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…', deg: '°' };
export function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const norm = (label: string) => label.toLowerCase().replace(/\s+/g, ' ').replace(/[:：\s]+$/, '').trim();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------- sources of "label — value" pairs ---------- */

function tildaPairs(html: string, url: string): [string, string][] {
  const out: [string, string][] = [];
  // product card: <p class="js-store-prod-charcs">Label: value</p>
  for (const m of html.matchAll(/class="js-store-prod-charcs"[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = text(m[1]);
    const i = t.indexOf(':');
    if (i > 0) out.push([t.slice(0, i), t.slice(i + 1)]);
  }
  if (out.length) return out;
  // product data embedded in the page: json_chars next to the uid from the URL
  const uid = url.match(/\/tproduct\/\d+-(\d+)/)?.[1];
  const at = uid ? html.indexOf(`"uid":${uid}`) : -1;
  const m = html.slice(Math.max(0, at)).match(/"json_chars":"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      const list = JSON.parse(JSON.parse(`"${m[1]}"`)) as { title: string; value: string }[];
      for (const c of list) out.push([c.title, c.value]);
    } catch { /* not parsed — so there is none */ }
  }
  return out;
}

function bitrixPairs(html: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of html.matchAll(/js-prop-title"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,400}?js-prop-value"[^>]*>([\s\S]*?)<\/div>/g)) {
    out.push([text(m[1]), text(m[2])]);
  }
  return out;
}

function wooPairs(html: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of html.matchAll(/class="product-detail"[\s\S]{0,200}?class="label"[^>]*>([\s\S]*?)<\/span>[\s\S]{0,300}?class="value[^"]*"[^>]*>([\s\S]*?)<\/span>/g)) {
    out.push([text(m[1]), text(m[2])]);
  }
  // "name / value" list (Bitrix with a custom template, e.g. The Welder Catherine)
  for (const m of html.matchAll(/<div class="name">([\s\S]{1,80}?)<\/div>\s*<div class="value">([\s\S]{0,300}?)<\/div>/g)) {
    out.push([text(m[1]), text(m[2])]);
  }
  // standard WooCommerce attribute table
  for (const m of html.matchAll(/woocommerce-product-attributes-item__label"[^>]*>([\s\S]*?)<\/th>[\s\S]{0,200}?woocommerce-product-attributes-item__value"[^>]*>([\s\S]*?)<\/td>/g)) {
    out.push([text(m[1]), text(m[2])]);
  }
  return out;
}

/** Label / value blocks of Vue-built stores (Tasty Coffee): <p class="… offset-text">Label</p> … <p class="… font-din-medium …">Value</p> */
function offsetTextPairs(html: string): [string, string][] {
  const out: [string, string][] = [];
  const starts = [...html.matchAll(/offset-text">([^<]{1,60})<\/p>/g)];
  starts.forEach((m, i) => {
    const end = starts[i + 1]?.index ?? Math.min(html.length, m.index! + 8000);
    const v = html.slice(m.index!, end).match(/font-din-medium[^"]*"[^>]*>([^<]{1,200})<\/p>/);
    if (v) out.push([decode(m[1]), decode(v[1])]);
  });
  return out;
}

/** Progress-bar scales: a label followed by <object class="tc-progress__object" width="60%"> → 1–5 */
function barScales(html: string): Scales {
  const out: Scales = {};
  for (const m of html.matchAll(/>([А-Яа-яЁё]{4,20})<\/div>[\s\S]{0,600}?tc-progress__object" width="(\d{1,3})%/g)) {
    const key = scaleKeyOf(m[1]);
    const v = Math.max(1, Math.min(5, Math.round(Number(m[2]) / 20)));
    if (key && !out[key]) out[key] = v;
  }
  return out;
}

/** "Label: value" lines in the description (known labels only) */
function linePairs(html: string): [string, string][] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr|\/dt|\/dd)[^>]*>/gi, '\n');
  const out: [string, string][] = [];
  for (const raw of decode(body.replace(/<[^>]+>/g, ' ')).split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = line.match(/^([А-Яа-яЁё][А-Яа-яЁё /]{1,40}?)\s*[:—–]\s*(.{1,200})$/);
    if (m && (LABELS[norm(m[1])] || scaleKeyOf(m[1]))) out.push([m[1], m[2]]);
  }
  return out;
}

/** Dot scales (Bitrix, Submarine): class one…five = how many dots are filled */
function dotScales(html: string): Scales {
  const out: Scales = {};
  for (const m of html.matchAll(/card-custom-info__item-name"[^>]*>([^<]+)<\/span>\s*<div class="card-custom-info__params-value\s*([a-z]*)/g)) {
    const key = scaleKeyOf(m[1]);
    const v = scaleValueOf(m[2] || '0');
    if (key && v) out[key] = v;
  }
  return out;
}

/* ---------- assembly ---------- */

function cleanValue(field: Field, v: string) {
  let s = v.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().replace(/[.;,]$/, '');
  if (!s || s === '-' || s === '—' || /^не указан/i.test(s)) return '';
  if (field === 'altitude') {
    s = s.replace(/\s*[—–-]+\s*/g, '–').replace(/\s*(м|m|метр\w*)\.?$/i, '').trim();
    if (/^\d/.test(s)) s += ' м';
  }
  if (field === 'process') s = s.replace(/(carbonic\s+maceration|карбонич\S*\s+мацерац\S*)/gi, 'углекислая мацерация');
  if (field === 'process' || field === 'roastLevel') s = cap(s);
  return s;
}

function cleanName(h1: string) {
  return h1
    .replace(/^(кофе|дрип-?пакеты?|дрипы|фильтр-?пакеты?)\s+/i, '')
    .replace(/,?\s*(дрип|drip)\s*$/i, '')
    .replace(/\s*\(?\d+\s*(шт|штук|пакет\w*)\.?\)?\s*$/i, '')
    .replace(/\s+в\s+дрип-пакетах.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:–—-]+$/, '')
    .trim();
}

/** schema.org Product markup (JSON-LD), if present */
function ldProduct(html: string): { name: string; description: string; brand: string } {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const list = (Array.isArray(data) ? data : data['@graph'] ?? [data]) as Record<string, unknown>[];
      const p = list.find((x) => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && (x['@type'] as string[]).includes('Product'))));
      if (p) {
        const brand = p.brand as { name?: string } | string | undefined;
        return { name: String(p.name ?? ''), description: String(p.description ?? ''), brand: typeof brand === 'string' ? brand : brand?.name ?? '' };
      }
    } catch { /* broken JSON-LD — skip */ }
  }
  return { name: '', description: '', brand: '' };
}

const meta = (html: string, prop: string) =>
  decode(html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'))?.[1] ?? '');

export function parsePage(html: string, pageUrl: string): Parsed {
  const url = new URL(pageUrl);
  const host = url.hostname.replace(/^www\./, '');
  const out: Parsed = {};
  const scales: Scales = { ...barScales(html), ...dotScales(html) };

  const pairs = [...tildaPairs(html, pageUrl), ...bitrixPairs(html), ...wooPairs(html), ...offsetTextPairs(html), ...linePairs(html)];
  for (const [label, value] of pairs) {
    const l = norm(label);
    const field = LABELS[l];
    if (field) {
      if (out[field]) continue; // the most reliable source goes first
      const v = cleanValue(field, value);
      if (v) out[field] = v;
      continue;
    }
    const sk = scaleKeyOf(l);
    if (sk && !scales[sk]) {
      const v = scaleValueOf(value);
      if (v) scales[sk] = v;
    }
  }
  if (Object.keys(scales).length) out.scales = scales;

  // name
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') || meta(html, 'og:title').split(/\s[—|-]\s/)[0];
  const name = cleanName(h1);
  if (name) out.name = name;

  // country from the title if there is no separate field
  if (!out.country) {
    const hay = `${h1} ${meta(html, 'og:title')}`;
    const c = COUNTRIES.find((x) => new RegExp(`(^|[^А-Яа-яЁё])${x}([^А-Яа-яЁё]|$)`).test(hay));
    if (c) out.country = c.replace('Папуа-Новая Гвинея', 'Папуа — Новая Гвинея');
    else {
      const low = hay.toLowerCase();
      const en = Object.keys(COUNTRIES_EN).sort((a, b) => b.length - a.length).find((x) => new RegExp(`(^|[^a-z])${x}([^a-z]|$)`).test(low));
      if (en) out.country = COUNTRIES_EN[en];
    }
  }

  // descriptors in the short description: "…во вкусе абрикос, ежевика, сладкие специи"
  if (!out.packNotes) {
    const d = html.match(/data-description="([^"]*)"/)?.[1] ?? meta(html, 'og:description');
    const m = decode(d).match(/во вкусе\s*[—:-]?\s*([^.!?]+)/i);
    if (m) out.packNotes = m[1].trim();
  }
  // descriptor badges (Tasty Coffee): «Сладкий кофе с нотами <span class='descriptor-badge'>арахиса</span>, …»
  if (!out.packNotes) {
    const badges = [...html.matchAll(/class='descriptor-badge'[^>]*>([^<]{1,60})</g)].map((m) => decode(m[1]).replace(/\s+/g, ' ').trim());
    if (badges.length) out.packNotes = [...new Set(badges)].slice(0, 8).join(', ');
  }
  if (out.roastLevel) out.roastLevel = normalizeRoast(out.roastLevel);
  if (out.process) out.process = normalizeProcess(out.process);

  // roaster
  if (!out.roaster) out.roaster = ROASTERS[host] || meta(html, 'og:site_name') || undefined;
  if (!out.roaster) delete out.roaster;

  // drip bags and how many are in the box (including from the product markup for search engines)
  const ld = ldProduct(html);
  if (!out.roaster && ld.brand) out.roaster = ld.brand;
  const titles = [h1, meta(html, 'og:title'), ld.name, ld.description, decode(html.match(/"json_options":"((?:[^"\\]|\\.)*)"/)?.[1] ?? '')].join(' ');
  if (/дрип|drip|фильтр[- ]?пакет/i.test(`${url.pathname} ${titles}`)) {
    out.kind = 'drip';
    const n = titles.match(/(\d{1,3})\s*(?:шт|штук|пакет|дрип)/i);
    if (n) out.dripCount = Number(n[1]);
  }

  // a "pack / drips" switch: the lot is sold both as beans and as drip boxes
  const options = [...html.matchAll(/<span class="text-primary[^"]*">([^<]{1,30})<\/span>/g)].map((m) => decode(m[1]).trim());
  if (out.kind !== 'drip' && options.includes('Пачка')) {
    const counts = options.map((o) => o.match(/^Дрипы\s+(\d{1,3})\s*шт/i)?.[1]).filter(Boolean).map(Number);
    if (counts.length) out.dripOptions = counts;
  }
  if (/капсул/i.test(`${h1} ${ld.description} ${url.pathname.includes('capsules') ? 'капсулы' : ''}`)) out.unsupported = true;
  const avail = html.match(/"availability"\s*:\s*"(?:https?:\/\/schema\.org\/)?(\w+)"/i)?.[1];
  if (avail) out.inStock = /^(InStock|PreOrder|LimitedAvailability|OnlineOnly)$/i.test(avail);

  const img = meta(html, 'og:image');
  if (img) out.image = img;
  return out;
}
