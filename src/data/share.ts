import { TELEGRAM_APP, TELEGRAM_BOT, WEB_URL } from '../config';
import { cupScore } from './cupping';
import { catById, type GearCat, type GearRef } from './gear';
import { methodById, fmtNum, fmtRatio, fmtTime } from './methods';
import type { Author, Bean, Brew } from './store';

/** Рецепт, который уходит другу. Только то, что нужно, чтобы повторить заварку. */
export interface SharedRecipe {
  author: Author;
  date: number;
  methodId: string;
  dose: number;
  water: number;
  temp: number;
  grind: string;
  time: number;
  rating: number;
  descriptors: string[];
  notes: string;
  score?: number;
  bean: Partial<Pick<Bean, BeanKey>> | null;
  gear: Omit<GearRef, 'id'>[];
}

const BEAN_KEYS = ['name', 'roaster', 'country', 'region', 'farm', 'variety', 'process', 'altitude', 'roastLevel', 'packNotes'] as const;
type BeanKey = typeof BEAN_KEYS[number];

export function toShared(b: Brew, bean: Bean | undefined, author: Author): SharedRecipe {
  return {
    author: b.author ?? author,
    date: b.date,
    methodId: b.methodId, dose: b.dose, water: b.water, temp: b.temp, grind: b.grind, time: b.time,
    rating: b.rating, descriptors: b.descriptors, notes: b.notes,
    score: b.cupping ? cupScore(b.cupping).total : undefined,
    bean: bean ? Object.fromEntries(BEAN_KEYS.filter((k) => bean[k]).map((k) => [k, bean[k]])) : null,
    gear: (b.gear ?? []).map(({ cat, name, details }) => (details ? { cat, name, details } : { cat, name })),
  };
}

/* ---------- Компактная упаковка: короткие ключи → deflate → base64url ---------- */

const CATS: GearCat[] = ['grinder', 'machine', 'dripper', 'press', 'stovetop', 'kettle', 'scale', 'filter', 'other'];

function pack(r: SharedRecipe) {
  return {
    a: [r.author.name, r.author.username ?? ''],
    t: Math.round(r.date / 60000),
    m: r.methodId, d: r.dose, w: r.water, c: r.temp, g: r.grind, s: r.time, r: r.rating,
    k: r.descriptors.length ? r.descriptors : undefined,
    n: r.notes || undefined,
    x: r.score,
    b: r.bean ?? undefined,
    e: r.gear.length ? r.gear.map((g) => [CATS.indexOf(g.cat), g.name, g.details ?? '']) : undefined,
  };
}

function unpack(o: ReturnType<typeof pack>): SharedRecipe {
  return {
    author: { name: String(o.a?.[0] ?? ''), username: o.a?.[1] || undefined },
    date: (o.t ?? 0) * 60000,
    methodId: String(o.m), dose: Number(o.d), water: Number(o.w), temp: Number(o.c), grind: String(o.g ?? ''),
    time: Number(o.s ?? 0), rating: Number(o.r ?? 0),
    descriptors: Array.isArray(o.k) ? o.k.map(String) : [],
    notes: String(o.n ?? ''),
    score: typeof o.x === 'number' ? o.x : undefined,
    bean: o.b ?? null,
    gear: Array.isArray(o.e) ? o.e.map((g) => ({ cat: CATS[Number(g[0])] ?? 'other', name: String(g[1]), details: g[2] ? String(g[2]) : undefined })) : [],
  };
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** «r» + «z» (сжато) или «j» (без сжатия) + base64url */
export async function encodeRecipe(r: SharedRecipe): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(pack(r)));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'rz' + b64url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* ниже */ }
  }
  return 'rj' + b64url(bytes);
}

export async function decodeRecipe(param: string): Promise<SharedRecipe | null> {
  try {
    if (!param.startsWith('r')) return null;
    let bytes = fromB64url(param.slice(2));
    if (param[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const r = unpack(JSON.parse(new TextDecoder().decode(bytes)));
    return r.methodId && r.dose && r.water ? r : null;
  } catch {
    return null;
  }
}

/** Ссылка на рецепт: прямо в мини-приложение Telegram (если влезает в 512 символов startapp), иначе — на веб-версию */
export async function recipeLink(r: SharedRecipe): Promise<string> {
  if (TELEGRAM_BOT) {
    const base = TELEGRAM_APP ? `https://t.me/${TELEGRAM_BOT}/${TELEGRAM_APP}` : `https://t.me/${TELEGRAM_BOT}`;
    // Отбрасываем необязательное, пока не влезет: текст и так придёт в сообщении
    const variants: SharedRecipe[] = [
      r,
      { ...r, notes: '' },
      { ...r, notes: '', bean: r.bean ? { name: r.bean.name, country: r.bean.country, process: r.bean.process } : null },
      { ...r, notes: '', descriptors: [], bean: r.bean ? { name: r.bean.name } : null, gear: r.gear.map(({ cat, name }) => ({ cat, name })) },
    ];
    for (const v of variants) {
      const code = await encodeRecipe(v);
      if (code.length <= 512) return `${base}?startapp=${code}`;
    }
  }
  return `${WEB_URL}#r=${await encodeRecipe(r)}`;
}

/** Человекочитаемый текст — его видно в чате, даже если ссылку не открывать */
export function recipeText(r: SharedRecipe): string {
  const m = methodById(r.methodId);
  const lines: string[] = [];
  const beanName = r.bean?.name || [r.bean?.country, r.bean?.region].filter(Boolean).join(', ');
  lines.push(`${m.name}${beanName ? ` — ${beanName}` : ''}`);
  if (r.author.name || r.author.username) lines.push(`Рецепт от ${[r.author.name, r.author.username && '@' + r.author.username].filter(Boolean).join(' ')}`);
  lines.push('');
  if (r.bean) {
    const origin = [r.bean.country, r.bean.region, r.bean.farm].filter(Boolean).join(', ');
    const meta = [origin, r.bean.process, r.bean.variety, r.bean.roaster && `обжарщик ${r.bean.roaster}`].filter(Boolean).join(' · ');
    if (meta) lines.push(`Зерно: ${meta}`);
  }
  lines.push(`${fmtNum(r.dose, 2)} г → ${fmtNum(r.water)} г ${m.yieldLabel ? 'на выходе ' : 'воды '}(${fmtRatio(r.water / r.dose)}), ${r.temp ? fmtNum(r.temp) + '°C' : 'холодная вода'}, ${fmtTime(r.time)}`);
  if (r.grind) lines.push(`Помол: ${r.grind}`);
  if (r.gear.length) {
    lines.push('', 'Оборудование:');
    r.gear.forEach((g) => lines.push(`• ${catById(g.cat).one}: ${g.name}${g.details ? ` (${g.details})` : ''}`));
  }
  const steps = m.steps.map((s) => `${fmtTime(s.at)} ${s.title}${s.to !== undefined ? ` — до ${fmtNum(r.water * s.to, 0)} г` : ''}`);
  lines.push('', 'Шаги:', ...steps);
  const taste = [r.descriptors.join(', '), r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : '', r.score ? `каппинг ${fmtNum(r.score, 2)}` : ''].filter(Boolean);
  if (taste.length) lines.push('', `Вкус: ${taste.join(' · ')}`);
  if (r.notes) lines.push(`Заметки: ${r.notes}`);
  return lines.join('\n');
}
