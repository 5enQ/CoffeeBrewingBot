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
import { N_, tr, UserError } from '../i18n';

export const BACKUP_FORMAT = 'brewbook-md 1';

/* ---------- field labels ---------- */

const RU_LABELS: Record<string, string> = {
  name: N_('Название'), roaster: N_('Обжарщик'), country: N_('Страна'), region: N_('Регион'), farm: N_('Ферма'), producer: N_('Производитель'),
  variety: N_('Сорт'), process: N_('Обработка'), altitude: N_('Высота'), harvest: N_('Урожай'), roastLevel: N_('Степень обжарки'),
  roastDate: N_('Дата обжарки'), weight: N_('Вес пачки, г'), barcode: N_('Штрихкод'), link: N_('Ссылка'), packNotes: N_('Дескрипторы обжарщика'),
  comment: N_('Комментарий'), createdAt: N_('Добавлено'), isBlend: N_('Бленд'), parts: N_('Состав'), share: N_('Доля'), adjust: N_('Поправка остатка, г'),
  finished: N_('Допито'), finishedAt: N_('Когда допито'), sample: N_('Пример'),
  date: N_('Дата'), methodId: N_('Метод'), beanId: N_('Зерно'), dose: N_('Кофе, г'), water: N_('Вода, г'), temp: N_('Температура, °C'), grind: N_('Помол'),
  time: N_('Время'), rating: N_('Оценка'), taste: N_('Быстрая оценка вкуса'), acidity: N_('Кислотность'), sweetness: N_('Сладость'), bitterness: N_('Горечь'),
  body: N_('Тело'), descriptors: N_('Дескрипторы'), notes: N_('Заметки'), cupping: N_('Каппинг 2004'), cva: N_('Каппинг CVA'), plan: N_('Схема'),
  gear: N_('Оборудование'), author: N_('Автор'), cat: N_('Категория'), details: N_('Детали'), steps: N_('Шаги'), at: N_('Начало'), title: N_('Заголовок'),
  to: N_('Долить до (доля воды)'), hint: N_('Подсказка'), total: N_('Время до готовности'), ratio: N_('Пропорция, г воды на 1 г'), about: N_('Описание'),
  icon: N_('Значок'), tips: N_('Советы'), archived: N_('В архиве'), username: N_('Ник в Telegram'), telegram: 'Telegram', badges: N_('Значки'),
  kind: N_('Тип'), detail: N_('Уровень'), year: N_('Год'), shareTelegram: N_('Делиться ссылкой на Telegram'), shareBadges: N_('Делиться значками'),
  shareNotes: N_('Делиться заметками'), featured: N_('Витрина значков'), layout: N_('Вид интерфейса'),
  mode: N_('Вид оценки'), cupVolume: N_('Объём чашки, мл'), cups: N_('Чашки'), purpose: N_('Цель'), samples: N_('Образцы'), code: N_('Код'),
  affective: N_('Аффективная оценка'), descriptive: N_('Дескриптивная оценка'), extrinsic: N_('Внешняя информация'), scores: N_('Баллы'),
  nonUniform: N_('Неоднородные чашки'), defective: N_('Дефектные чашки'), defectType: N_('Тип дефекта'), roast: N_('Обжарка на глаз'),
  intensity: N_('Интенсивность'), olfactory: N_('Запах'), retronasal: N_('Вкус ретроназально'), mainTastes: N_('Основные вкусы'),
  mouthfeel: N_('Тактильность'), checked: N_('Отмечено'), fragrance: N_('Сухой аромат'), aroma: N_('Аромат'), flavor: N_('Вкус'),
  aftertaste: N_('Послевкусие'), overall: N_('Общее'), balance: N_('Баланс'), defects: N_('Дефекты'), uniformity: N_('Однородность'),
  cleanCup: N_('Чистота чашки'), recipeId: N_('Свой рецепт'), pinned: N_('Закреплённые методы'), tiles: N_('Плитки методов'), order: N_('Порядок'), size: N_('Размер плиток'), rated: N_('Мои оценки рецептов друзей'),
  seenAch: N_('Показанные достижения'), seeded: N_('Примеры добавлены'), gearSeeded: N_('Примеры оборудования добавлены'),
  scales: N_('Профиль от обжарщика'), grindType: N_('Тип кофемолки'), grindValue: N_('Помол, число'), grindUnit: N_('Единицы помола'), grindBy: N_('Помол по кофемолкам'), catalogId: N_('Лот в каталоге'), ferment: N_('Ферментация'), dripCount: N_('Дрипов в коробке'), dripWeight: N_('Кофе в дрипе, г'), assorted: N_('Разные дрипы'), drips: N_('Дрипы'), count: N_('Штук'), dripId: N_('Дрип'),
  fromPack: N_('Из пачки, г'), ppm: N_('Минерализация воды, ppm'), tds: N_('TDS чашки, %'), beverage: N_('Вес напитка, г'), waterPpm: N_('Минерализация воды по умолчанию, ppm'), loss: N_('Потери при помоле, г'), cardTheme: N_('Фон карточки'), cardGear: N_('Сетап на карточке'),
};
/** Field names in the file: in the app's language; a file in either language reads back */
const LABELS: Record<string, string> = Object.fromEntries(Object.entries(RU_LABELS).map(([k, l]) => [k, tr(l)]));
const KEY_OF = Object.fromEntries([...Object.entries(RU_LABELS), ...Object.entries(LABELS)].map(([k, l]) => [l.toLowerCase(), k]));

const DATE_KEYS = new Set(['date', 'createdAt', 'finishedAt']);
const TIME_KEYS = new Set(['time', 'total', 'at']);
/** always text, even if it looks like a number */
const STRING_KEYS = new Set(['weight', 'barcode', 'code', 'share', 'year', 'harvest', 'altitude', 'roastDate', 'name', 'title', 'detail', 'details', 'grind', 'comment', 'notes', 'hint', 'about', 'purpose', 'roast', 'id']);
/** word lists — one line, comma-separated */
const INLINE_LISTS = new Set(['descriptors', 'olfactory', 'retronasal', 'mainTastes', 'checked', 'pinned', 'seenAch', 'featured', 'order']);

/* ---------- writing ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const NUM = /^-?\d+(?:[.,]\d+)?$/;
const RESERVED = new Set(['да', 'нет', 'yes', 'no', '—', '[]', '{}', '|']); // i18n-skip: words the file may hold in either language

function scalar(key: string, v: unknown, beanNames: Map<string, string>): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? tr('да') : tr('нет');
  if (typeof v === 'number') {
    if (DATE_KEYS.has(key) && v > 1e11) return fmtDate(v);
    if (TIME_KEYS.has(key)) return fmtTime(v);
    return String(Math.round(v * 10000) / 10000).replace('.', ',');
  }
  const s = String(v);
  if (key === 'beanId') return `${beanNames.get(s) ?? tr('зерно')} [${s}]`;
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
    tr('# Brewbook — резервная копия'),
    '',
    tr('Формат: {0} · выгружено {1}', BACKUP_FORMAT, fmtDate(Date.now())),
    '',
    tr('Файл можно править в любом текстовом редакторе и загрузить обратно: Профиль → Резервная копия → Восстановить.'),
    tr('Заголовки «###» только для удобства — менять можно поля под ними. Поле «id» лучше не трогать: по нему заварки находят свою пачку.'),
    tr('Чтобы добавить запись, скопируйте похожую целиком вместе с заголовком и поменяйте id на любой новый.'),
    '',
  ];
  const section = (title: string) => out.push(`## ${title}`, '');
  const record = (title: string, obj: Record<string, unknown>) => { out.push(`### ${title}`); writeObject(out, '', obj, names); out.push(''); };

  section(tr('Профиль'));
  const { ratingStats: _r, serverStats: _s, ...profile } = db.profile;
  void _s;
  void _r;
  writeObject(out, '', profile as Record<string, unknown>, names);
  out.push('');

  section(tr('Полка'));
  db.beans.forEach((b) => record(beanTitle(b), b as unknown as Record<string, unknown>));

  section(tr('Дневник'));
  db.brews.forEach((b) => record(`${fmtDate(b.date)} · ${methodById(b.methodId).name} · ${names.get(b.beanId ?? '') ?? tr('без зерна')}`, b as unknown as Record<string, unknown>));

  section(tr('Оборудование'));
  db.gear.forEach((g) => record(`${catById(g.cat).one} · ${g.name}`, g as unknown as Record<string, unknown>));

  section(tr('Мои рецепты'));
  (db.custom ?? []).forEach((r) => record(r.name, r as unknown as Record<string, unknown>));

  section(tr('Мои методы'));
  (db.customMethods ?? []).forEach((m) => record(m.name, m as unknown as Record<string, unknown>));

  section(tr('Последние параметры'));
  Object.entries(db.recipes).forEach(([id, r]) => record(methodById(id).name, { methodId: id, ...r }));

  section(tr('Служебное'));
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
  if (s === 'да' || s === 'yes') return true;
  if (s === 'нет' || s === 'no') return false;
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
  // an English copy reads back too
  'profile': 'profile', 'shelf': 'beans', 'journal': 'brews', 'gear': 'gear', 'my recipes': 'custom',
  'my methods': 'customMethods', 'last settings': 'recipes', 'service': 'meta',
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

  if (!data.beans && !data.brews && !data.profile) throw new UserError(tr('Не похоже на резервную копию Brewbook'));

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
