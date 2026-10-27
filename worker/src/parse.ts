/**
 * Разбор страницы кофе на сайте обжарщика → поля пачки.
 * Без DOM: только регулярные выражения по исходному HTML (Cloudflare Workers).
 *
 * Источники по убыванию надёжности:
 *  1. Характеристики магазинных движков: Tilda (js-store-prod-charcs / json_chars),
 *     1С-Битрикс с шаблоном Aspro (properties__title / properties__value),
 *     WooCommerce-темы с парами label / value.
 *  2. Строки «Подпись: значение» в описании.
 *  3. Название (h1) — страна и признаки дрипа.
 * Чего нет на странице — не заполняется.
 */
import { scaleKeyOf, scaleValueOf, type Scales } from '../../src/data/scales.ts';

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
  packNotes?: string;
  kind?: 'drip';
  dripCount?: number;
  scales?: Scales;
  image?: string;
}

type Field = Exclude<keyof Parsed, 'kind' | 'dripCount' | 'scales' | 'image' | 'name'>;

/** Подписи на сайтах → поле пачки (в нижнем регистре, без двоеточия) */
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
add('packNotes', 'дескрипторы', 'вкус', 'ноты', 'вкусовые ноты', 'вкусовой профиль', 'во вкусе', 'вкусовые дескрипторы', 'дескрипторы вкуса');
add('roaster', 'бренд', 'обжарщик', 'производитель кофе', 'торговая марка');

const COUNTRIES = ['Эфиопия', 'Кения', 'Руанда', 'Бурунди', 'Танзания', 'Уганда', 'Конго', 'Малави', 'Замбия', 'Камерун', 'Колумбия',
  'Бразилия', 'Перу', 'Эквадор', 'Боливия', 'Коста-Рика', 'Панама', 'Гватемала', 'Гондурас', 'Сальвадор', 'Никарагуа', 'Мексика',
  'Доминикана', 'Ямайка', 'Куба', 'Гаити', 'Йемен', 'Индонезия', 'Индия', 'Вьетнам', 'Китай', 'Таиланд', 'Лаос', 'Мьянма', 'Филиппины',
  'Папуа — Новая Гвинея', 'Папуа-Новая Гвинея', 'Тимор'];

/** Известные сайты → обжарщик (если на странице нет поля «Бренд») */
const ROASTERS: Record<string, string> = {
  'kojocoffee.ru': 'Kojo',
  'sbmrne.ru': 'Submarine',
  'hq-coffee.com': 'HQ! coffee',
  'theweldercatherine.ru': 'Сварщица Екатерина',
};

/* ---------- текст ---------- */

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

/* ---------- источники пар «подпись — значение» ---------- */

function tildaPairs(html: string, url: string): [string, string][] {
  const out: [string, string][] = [];
  // карточка товара: <p class="js-store-prod-charcs">Подпись: значение</p>
  for (const m of html.matchAll(/class="js-store-prod-charcs"[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = text(m[1]);
    const i = t.indexOf(':');
    if (i > 0) out.push([t.slice(0, i), t.slice(i + 1)]);
  }
  if (out.length) return out;
  // данные товара, встроенные в страницу: json_chars рядом с uid из адреса
  const uid = url.match(/\/tproduct\/\d+-(\d+)/)?.[1];
  const at = uid ? html.indexOf(`"uid":${uid}`) : -1;
  const m = html.slice(Math.max(0, at)).match(/"json_chars":"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      const list = JSON.parse(JSON.parse(`"${m[1]}"`)) as { title: string; value: string }[];
      for (const c of list) out.push([c.title, c.value]);
    } catch { /* не разобрали — значит, нет */ }
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
  // стандартная таблица атрибутов WooCommerce
  for (const m of html.matchAll(/woocommerce-product-attributes-item__label"[^>]*>([\s\S]*?)<\/th>[\s\S]{0,200}?woocommerce-product-attributes-item__value"[^>]*>([\s\S]*?)<\/td>/g)) {
    out.push([text(m[1]), text(m[2])]);
  }
  return out;
}

/** Строки «Подпись: значение» в описании (только известные подписи) */
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

/** Шкалы точками (Битрикс, Submarine): класс one…five = сколько точек закрашено */
function dotScales(html: string): Scales {
  const out: Scales = {};
  for (const m of html.matchAll(/card-custom-info__item-name"[^>]*>([^<]+)<\/span>\s*<div class="card-custom-info__params-value\s*([a-z]*)/g)) {
    const key = scaleKeyOf(m[1]);
    const v = scaleValueOf(m[2] || '0');
    if (key && v) out[key] = v;
  }
  return out;
}

/* ---------- сборка ---------- */

function cleanValue(field: Field, v: string) {
  let s = v.replace(/\s+/g, ' ').trim().replace(/[.;,]$/, '');
  if (!s || s === '-' || s === '—' || /^не указан/i.test(s)) return '';
  if (field === 'altitude') {
    s = s.replace(/\s*[—–-]+\s*/g, '–').replace(/\s*(м|m|метр\w*)\.?$/i, '').trim();
    if (/^\d/.test(s)) s += ' м';
  }
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
    .trim();
}

const meta = (html: string, prop: string) =>
  decode(html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'))?.[1] ?? '');

export function parsePage(html: string, pageUrl: string): Parsed {
  const url = new URL(pageUrl);
  const host = url.hostname.replace(/^www\./, '');
  const out: Parsed = {};
  const scales: Scales = { ...dotScales(html) };

  const pairs = [...tildaPairs(html, pageUrl), ...bitrixPairs(html), ...wooPairs(html), ...linePairs(html)];
  for (const [label, value] of pairs) {
    const l = norm(label);
    const field = LABELS[l];
    if (field) {
      if (out[field]) continue; // первым идёт самый надёжный источник
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

  // название
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') || meta(html, 'og:title').split(/\s[—|-]\s/)[0];
  const name = cleanName(h1);
  if (name) out.name = name;

  // страна из названия, если отдельного поля нет
  if (!out.country) {
    const hay = `${h1} ${meta(html, 'og:title')}`;
    const c = COUNTRIES.find((x) => new RegExp(`(^|[^А-Яа-яЁё])${x}([^А-Яа-яЁё]|$)`).test(hay));
    if (c) out.country = c.replace('Папуа-Новая Гвинея', 'Папуа — Новая Гвинея');
  }

  // дескрипторы в кратком описании: «…во вкусе абрикос, ежевика, сладкие специи»
  if (!out.packNotes) {
    const d = html.match(/data-description="([^"]*)"/)?.[1] ?? meta(html, 'og:description');
    const m = decode(d).match(/во вкусе\s*[—:-]?\s*([^.!?]+)/i);
    if (m) out.packNotes = m[1].trim();
  }

  // обжарщик
  if (!out.roaster) out.roaster = ROASTERS[host] || meta(html, 'og:site_name') || undefined;
  if (!out.roaster) delete out.roaster;

  // дрип-пакеты и сколько их в коробке
  const titles = [h1, meta(html, 'og:title'), decode(html.match(/"json_options":"((?:[^"\\]|\\.)*)"/)?.[1] ?? '')].join(' ');
  if (/дрип|drip|фильтр[- ]?пакет/i.test(`${url.pathname} ${titles}`)) {
    out.kind = 'drip';
    const n = titles.match(/(\d{1,3})\s*(?:шт|штук|пакет|дрип)/i);
    if (n) out.dripCount = Number(n[1]);
  }

  const img = meta(html, 'og:image');
  if (img) out.image = img;
  return out;
}
