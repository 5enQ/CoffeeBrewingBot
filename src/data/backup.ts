/**
 * Markdown backup: readable and editable in any text editor, and can be loaded back.
 *
 * File layout:
 *   ## Section           — Полка, Дневник, Оборудование, …
 *   ### Record title     — for readability only, ignored on load
 *   - Field: value       — record fields; nested fields indented by two spaces
 *   1. value             — list items
 *   - Заметки: |         — multi-line text, the indented lines below start with "> "
 *
 * Values: numbers as is (decimal comma), да/нет, "—" — empty,
 * text that could be mistaken for a number or a word is quoted.
 */
import { METHODS, fmtTime, methodById, parseTime } from './methods';
import { catById } from './gear';
import { beanTitle } from '../screens/beanUtils';
import type { DB } from './store';

export const BACKUP_FORMAT = 'brewbook-md 1';

/* ---------- field labels ---------- */

const LABELS: Record<string, string> = {
  name: 'Название', roaster: 'Обжарщик', country: 'Страна', region: 'Регион', farm: 'Ферма', producer: 'Производитель',
  variety: 'Сорт', process: 'Обработка', altitude: 'Высота', harvest: 'Урожай', roastLevel: 'Степень обжарки',
  roastDate: 'Дата обжарки', weight: 'Вес пачки, г', barcode: 'Штрихкод', link: 'Ссылка', packNotes: 'Дескрипторы обжарщика',
  comment: 'Комментарий', createdAt: 'Добавлено', isBlend: 'Бленд', parts: 'Состав', share: 'Доля', adjust: 'Поправка остатка, г',
  finished: 'Допито', sample: 'Пример',
  date: 'Дата', methodId: 'Метод', beanId: 'Зерно', dose: 'Кофе, г', water: 'Вода, г', temp: 'Температура, °C', grind: 'Помол',
  time: 'Время', rating: 'Оценка', taste: 'Быстрая оценка вкуса', acidity: 'Кислотность', sweetness: 'Сладость', bitterness: 'Горечь',
  body: 'Тело', descriptors: 'Дескрипторы', notes: 'Заметки', cupping: 'Каппинг 2004', cva: 'Каппинг CVA', plan: 'Схема',
  gear: 'Оборудование', author: 'Автор', cat: 'Категория', details: 'Детали', steps: 'Шаги', at: 'Начало', title: 'Заголовок',
  to: 'Долить до (доля воды)', hint: 'Подсказка', total: 'Время до готовности', ratio: 'Пропорция, г воды на 1 г', about: 'Описание',
  icon: 'Значок', tips: 'Советы', archived: 'В архиве', username: 'Ник в Telegram', telegram: 'Telegram', badges: 'Значки',
  kind: 'Тип', detail: 'Уровень', year: 'Год', shareTelegram: 'Делиться ссылкой на Telegram', shareBadges: 'Делиться значками',
  shareNotes: 'Делиться заметками', featured: 'Витрина значков', layout: 'Вид интерфейса',
  mode: 'Вид оценки', cupVolume: 'Объём чашки, мл', cups: 'Чашки', purpose: 'Цель', samples: 'Образцы', code: 'Код',
  affective: 'Аффективная оценка', descriptive: 'Дескриптивная оценка', extrinsic: 'Внешняя информация', scores: 'Баллы',
  nonUniform: 'Неоднородные чашки', defective: 'Дефектные чашки', defectType: 'Тип дефекта', roast: 'Обжарка на глаз',
  intensity: 'Интенсивность', olfactory: 'Запах', retronasal: 'Вкус ретроназально', mainTastes: 'Основные вкусы',
  mouthfeel: 'Тактильность', checked: 'Отмечено', fragrance: 'Сухой аромат', aroma: 'Аромат', flavor: 'Вкус',
  aftertaste: 'Послевкусие', overall: 'Общее', balance: 'Баланс', defects: 'Дефекты', uniformity: 'Однородность',
  cleanCup: 'Чистота чашки', recipeId: 'Свой рецепт', pinned: 'Закреплённые методы', tiles: 'Плитки методов', order: 'Порядок', size: 'Размер плиток', rated: 'Мои оценки рецептов друзей',
  seenAch: 'Показанные достижения', seeded: 'Примеры добавлены', gearSeeded: 'Примеры оборудования добавлены',
  scales: 'Профиль от обжарщика', grindType: 'Тип кофемолки', grindValue: 'Помол, число', grindUnit: 'Единицы помола', grindBy: 'Помол по кофемолкам', catalogId: 'Лот в каталоге', ferment: 'Ферментация', dripCount: 'Дрипов в коробке', dripWeight: 'Кофе в дрипе, г', assorted: 'Разные дрипы', drips: 'Дрипы', count: 'Штук', dripId: 'Дрип',
  fromPack: 'Из пачки, г', ppm: 'Минерализация воды, ppm', tds: 'TDS чашки, %', beverage: 'Вес напитка, г', waterPpm: 'Минерализация воды по умолчанию, ppm', loss: 'Потери при помоле, г', cardTheme: 'Фон карточки', cardGear: 'Сетап на карточке',
};
const KEY_OF = Object.fromEntries(Object.entries(LABELS).map(([k, l]) => [l.toLowerCase(), k]));

const DATE_KEYS = new Set(['date', 'createdAt']);
const TIME_KEYS = new Set(['time', 'total', 'at']);
/** always text, even if it looks like a number */
const STRING_KEYS = new Set(['weight', 'barcode', 'code', 'share', 'year', 'harvest', 'altitude', 'roastDate', 'name', 'title', 'detail', 'details', 'grind', 'comment', 'notes', 'hint', 'about', 'purpose', 'roast', 'id']);
/** word lists — one line, comma-separated */
const INLINE_LISTS = new Set(['descriptors', 'olfactory', 'retronasal', 'mainTastes', 'checked', 'pinned', 'seenAch', 'featured', 'order']);

/* ---------- writing ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const NUM = /^-?\d+(?:[.,]\d+)?$/;
const RESERVED = new Set(['да', 'нет', '—', '[]', '{}', '|']);

function scalar(key: string, v: unknown, beanNames: Map<string, string>): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  if (typeof v === 'number') {
    if (DATE_KEYS.has(key) && v > 1e11) return fmtDate(v);
    if (TIME_KEYS.has(key)) return fmtTime(v);
    return String(Math.round(v * 10000) / 10000).replace('.', ',');
  }
  const s = String(v);
  if (key === 'beanId') return `${beanNames.get(s) ?? 'зерно'} [${s}]`;
  if (STRING_KEYS.has(key) && s && !/^\s|\s$|^"/.test(s) && !RESERVED.has(s)) return s;
  if (!s || NUM.test(s) || RESERVED.has(s) || /^\s|\s$|^"/.test(s) || (TIME_KEYS.has(key) && parseTime(s) !== null)) return JSON.stringify(s);
  return s;
}

function writeValue(out: string[], indent: string, head: string, key: string, v: unknown, names: Map<string, string>) {
  if (typeof v === 'string' && v.includes('\n')) {
    out.push(`${indent}${head} |`);
    for (const line of v.split('\n')) out.push(`${indent}  > ${line}`);
    return;
  }
  if (Array.isArray(v)) {
    if (!v.length) { out.push(`${indent}${head} []`); return; }
    if (INLINE_LISTS.has(key) && v.every((x) => typeof x === 'string' && x && !x.includes(',') && !x.includes('\n'))) {
      out.push(`${indent}${head} ${v.join(', ')}`);
      return;
    }
    out.push(`${indent}${head}`.trimEnd());
    v.forEach((x, i) => writeValue(out, indent + '  ', `${i + 1}.`, key, x, names));
    return;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) { out.push(`${indent}${head} {}`); return; }
    out.push(`${indent}${head}`.trimEnd());
    writeObject(out, indent + '  ', v as Record<string, unknown>, names);
    return;
  }
  out.push(`${indent}${head} ${scalar(key, v, names)}`);
}

function writeObject(out: string[], indent: string, obj: Record<string, unknown>, names: Map<string, string>) {
  for (const [k, v] of Object.entries(obj)) {
    // empty values are not written — defaults are filled in on load
    if (v === undefined || v === '' || (v === null && k !== 'beanId') || (k === 'sample' && !v)) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
    if (k === 'taste' && JSON.stringify(v) === '{"acidity":3,"sweetness":3,"bitterness":2,"body":3}') continue;
    writeValue(out, indent, `- ${LABELS[k] ?? k}:`, k, v, names);
  }
}

export function toMarkdown(db: DB): string {
  const names = new Map(db.beans.map((b) => [b.id, beanTitle(b)]));
  const out: string[] = [
    '# Brewbook — резервная копия',
    '',
    `Формат: ${BACKUP_FORMAT} · выгружено ${fmtDate(Date.now())}`,
    '',
    'Файл можно править в любом текстовом редакторе и загрузить обратно: Профиль → Резервная копия → Восстановить.',
    'Заголовки «###» только для удобства — менять можно поля под ними. Поле «id» лучше не трогать: по нему заварки находят свою пачку.',
    'Чтобы добавить запись, скопируйте похожую целиком вместе с заголовком и поменяйте id на любой новый.',
    '',
  ];
  const section = (title: string) => out.push(`## ${title}`, '');
  const record = (title: string, obj: Record<string, unknown>) => { out.push(`### ${title}`); writeObject(out, '', obj, names); out.push(''); };

  section('Профиль');
  const { ratingStats: _r, serverStats: _s, ...profile } = db.profile;
  void _s;
  void _r;
  writeObject(out, '', profile as Record<string, unknown>, names);
  out.push('');

  section('Полка');
  db.beans.forEach((b) => record(beanTitle(b), b as unknown as Record<string, unknown>));

  section('Дневник');
  db.brews.forEach((b) => record(`${fmtDate(b.date)} · ${methodById(b.methodId).name} · ${names.get(b.beanId ?? '') ?? 'без зерна'}`, b as unknown as Record<string, unknown>));

  section('Оборудование');
  db.gear.forEach((g) => record(`${catById(g.cat).one} · ${g.name}`, g as unknown as Record<string, unknown>));

  section('Мои рецепты');
  (db.custom ?? []).forEach((r) => record(r.name, r as unknown as Record<string, unknown>));

  section('Мои методы');
  (db.customMethods ?? []).forEach((m) => record(m.name, m as unknown as Record<string, unknown>));

  section('Последние параметры');
  Object.entries(db.recipes).forEach(([id, r]) => record(methodById(id).name, { methodId: id, ...r }));

  section('Служебное');
  writeObject(out, '', { pinned: db.pinned ?? [], tiles: db.tiles, rated: db.rated ?? {}, seenAch: db.seenAch ?? [], seeded: !!db.seeded, gearSeeded: !!db.gearSeeded }, names);
  out.push('');
  return out.join('\n');
}

/* ---------- reading ---------- */

interface Line { indent: number; dash: boolean; label?: string; value?: string; n: number }

const LINE = /^(\s*)(?:[-*] (.*)|(\d+)\.(?:\s+(.*))?)$/;

function parseDate(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
}

function parseScalar(key: string, raw: string): unknown {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
  if (s === '—' || s === '-' || s === '') return key === 'beanId' ? null : STRING_KEYS.has(key) ? '' : null;
  if (s === '[]') return [];
  if (s === '{}') return {};
  if (key === 'beanId') return s; // resolved after all packs are read
  if (INLINE_LISTS.has(key)) return s.split(',').map((x) => x.trim()).filter(Boolean);
  if (STRING_KEYS.has(key)) return s;
  if (s === 'да') return true;
  if (s === 'нет') return false;
  if (DATE_KEYS.has(key)) { const d = parseDate(s); if (d !== null) return d; }
  if (TIME_KEYS.has(key)) { const t = parseTime(s); if (t !== null) return t; }
  if (NUM.test(s)) return Number(s.replace(',', '.'));
  return s;
}

const keyOf = (label: string) => KEY_OF[label.trim().toLowerCase()] ?? label.trim();

/** Parse nested lists starting at line i with indent greater than parentIndent */
function parseBlock(lines: Line[], i: number, parentIndent: number, key: string): [unknown, number] {
  const first = lines[i];
  if (!first || first.indent <= parentIndent) return [{}, i];
  const indent = first.indent;
  const isArray = !first.dash || first.label === undefined;
  const arr: unknown[] = [];
  const obj: Record<string, unknown> = {};
  while (i < lines.length && lines[i].indent >= indent) {
    const ln = lines[i];
    if (ln.indent > indent || ln.label === '\u0000quote') { i++; continue; } // extra indent — skip
    const k = ln.label !== undefined ? keyOf(ln.label) : key;
    let value: unknown;
    if (ln.value === '|') {
      const text: string[] = [];
      i++;
      while (i < lines.length && lines[i].indent > indent && lines[i].label === '\u0000quote') { text.push(lines[i].value ?? ''); i++; }
      value = text.join('\n');
    } else if (ln.value === undefined || ln.value === '') {
      i++;
      if (i < lines.length && lines[i].indent > indent) [value, i] = parseBlock(lines, i, indent, k);
      else value = STRING_KEYS.has(k) ? '' : null;
    } else {
      value = parseScalar(k, ln.value);
      i++;
    }
    if (isArray) arr.push(value);
    else obj[k] = value;
  }
  return [isArray ? arr : obj, i];
}

function toLines(chunk: string[]): Line[] {
  const res: Line[] = [];
  chunk.forEach((raw, n) => {
    const q = raw.match(/^(\s*)>\s?(.*)$/);
    if (q && res.length) { res.push({ indent: q[1].length, dash: false, label: '\u0000quote', value: q[2], n }); return; }
    const m = raw.match(LINE);
    if (!m) return;
    const indent = m[1].replace(/\t/g, '  ').length;
    if (m[2] !== undefined) {
      const body = m[2];
      const c = body.match(/^([^:]+?):(?:\s+(.*)|\s*)$/);
      if (c) res.push({ indent, dash: true, label: c[1], value: c[2]?.trim(), n });
      else res.push({ indent, dash: true, value: body.trim(), n });
    } else {
      res.push({ indent, dash: false, value: m[4]?.trim(), n });
    }
  });
  return res;
}

const SECTIONS: Record<string, string> = {
  'профиль': 'profile', 'полка': 'beans', 'дневник': 'brews', 'оборудование': 'gear', 'мои рецепты': 'custom',
  'мои методы': 'customMethods', 'последние параметры': 'recipes', 'служебное': 'meta',
};

/** Markdown → data in the same shape as the JSON export */
export function fromMarkdown(text: string): Record<string, unknown> {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  const data: Record<string, unknown[] | Record<string, unknown>> = {};
  let section: string | null = null;
  let chunk: string[] = [];
  let inRecord = false;

  const flush = () => {
    if (!section || !chunk.length) { chunk = []; return; }
    const lines = toLines(chunk);
    chunk = [];
    if (!lines.length) return;
    const [v] = parseBlock(lines, 0, -1, '');
    const obj = (Array.isArray(v) ? {} : v) as Record<string, unknown>;
    if (section === 'profile' || section === 'meta') data[section] = { ...(data[section] as object), ...obj };
    else if (inRecord) ((data[section] ??= []) as unknown[]).push(obj);
  };

  for (const row of rows) {
    const h2 = row.match(/^##\s+(.+?)\s*$/);
    const h3 = row.match(/^###\s+/);
    if (h2 && !h3) {
      flush();
      section = SECTIONS[h2[1].toLowerCase()] ?? null;
      inRecord = false;
      continue;
    }
    if (h3) { flush(); inRecord = true; continue; }
    if (/^#\s/.test(row)) continue;
    chunk.push(row);
  }
  flush();

  if (!data.beans && !data.brews && !data.profile) throw new Error('Не похоже на резервную копию Brewbook');

  const beans = (data.beans ?? []) as Record<string, unknown>[];
  const byName = new Map(beans.map((b) => [String(b.name ?? '').toLowerCase(), b.id]));
  const resolveBean = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v);
    const m = s.match(/\[([^\]]+)\]\s*$/);
    if (m) return m[1];
    return (byName.get(s.toLowerCase()) as string | undefined) ?? (beans.some((b) => b.id === s) ? s : null);
  };
  const brews = ((data.brews ?? []) as Record<string, unknown>[]).map((b) => {
    const cva = b.cva as { samples?: Record<string, unknown>[] } | undefined;
    return {
      ...b,
      beanId: resolveBean(b.beanId),
      cva: cva ? { ...cva, samples: (cva.samples ?? []).map((s) => ({ ...s, beanId: resolveBean(s.beanId) })) } : undefined,
    };
  }).map((b) => { if (!b.cva) delete b.cva; return b; });

  const known = new Set(METHODS.map((m) => m.id)); // archived methods included: old data stays valid
  const recipes = Object.fromEntries(((data.recipes ?? []) as Record<string, unknown>[])
    .filter((r) => typeof r.methodId === 'string' && (known.has(r.methodId as string) || String(r.methodId).startsWith('cm')))
    .map(({ methodId, ...r }) => [methodId as string, r]));
  const meta = (data.meta ?? {}) as Record<string, unknown>;

  return {
    beans, brews, recipes,
    gear: data.gear ?? [], custom: data.custom ?? [], customMethods: data.customMethods ?? [],
    profile: data.profile ?? {}, pinned: meta.pinned ?? [], tiles: meta.tiles, rated: meta.rated ?? {}, seenAch: meta.seenAch ?? [],
  };
}
