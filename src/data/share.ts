import { TELEGRAM_APP, TELEGRAM_BOT, WEB_URL } from '../config';
import { loadRecipeCode, storeRecipe } from './ratings';
import { brewSca } from './cva';
import { b64url, fromB64url, pipe } from './codec';
import { badgeText, sortBadges, type BadgeKind } from './badges';
import { catById, type GearCat, type GearRef } from './gear';
import { methodById, fmtNum, fmtRatio, fmtTime, type BrewStep } from './methods';
import { effectivePlan, type BrewPlan } from './recipes';
import { beanTitle, blendLines } from '../screens/beanUtils';
import type { Author, Bean, Brew } from './store';

/** Recipe sent to a friend. Only what is needed to repeat the brew. */
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
  /** the author's own pour schedule (if not the standard one) */
  plan?: Omit<BrewPlan, 'recipeId'>;
  /** for ratings: recipe id and the author's telegram id */
  ref?: { rid: string; author: string };
}

const BEAN_KEYS = ['name', 'roaster', 'country', 'region', 'farm', 'variety', 'process', 'altitude', 'roastLevel', 'packNotes', 'isBlend', 'parts'] as const;
type BeanKey = typeof BEAN_KEYS[number];

export function toShared(b: Brew, bean: Bean | undefined, author: Author, myId?: string | null): SharedRecipe {
  return {
    author: b.author ?? author,
    date: b.date,
    methodId: b.methodId, dose: b.dose, water: b.water, temp: b.temp, grind: b.grind, time: b.time,
    rating: b.rating, descriptors: b.descriptors, notes: b.notes,
    score: b.cva || (b.cupping && (b.methodId === 'cupping' || !b.rating)) ? brewSca(b) ?? undefined : undefined,
    bean: bean ? Object.fromEntries(BEAN_KEYS.filter((k) => bean[k]).map((k) => [k, bean[k]])) : null,
    gear: (b.gear ?? []).map(({ cat, name, details }) => (details ? { cat, name, details } : { cat, name })),
    plan: b.plan ? { name: b.plan.name, total: b.plan.total, steps: b.plan.steps } : undefined,
    ref: b.shareId && (b.author ? b.authorId : myId) ? { rid: b.shareId, author: (b.author ? b.authorId : myId)! } : undefined,
  };
}

/* ---------- Compact packing: short keys → deflate → base64url ---------- */

const KINDS: BadgeKind[] = ['sca', 'q', 'champ', 'custom', 'achieve'];
const CATS: GearCat[] = ['grinder', 'machine', 'dripper', 'press', 'stovetop', 'kettle', 'scale', 'filter', 'other'];

function pack(r: SharedRecipe) {
  return {
    a: [r.author.name, r.author.username ?? ''],
    h: r.author.badges?.length ? r.author.badges.map((b) => [KINDS.indexOf(b.kind), b.title, b.detail, b.year]) : undefined,
    t: Math.round(r.date / 60000),
    m: r.methodId, d: r.dose, w: r.water, c: r.temp, g: r.grind, s: r.time, r: r.rating,
    k: r.descriptors.length ? r.descriptors : undefined,
    n: r.notes || undefined,
    x: r.score,
    b: r.bean ?? undefined,
    i: r.ref ? [r.ref.rid, r.ref.author] : undefined,
    p: r.plan ? [r.plan.name, r.plan.total, r.plan.steps.map((st) => [st.at, st.title, st.to === undefined ? -1 : Math.round(st.to * 1000), st.hint ?? ''])] : undefined,
    e: r.gear.length ? r.gear.map((g) => [CATS.indexOf(g.cat), g.name, g.details ?? '']) : undefined,
  };
}

function unpack(o: ReturnType<typeof pack>): SharedRecipe {
  return {
    author: {
      name: String(o.a?.[0] ?? ''), username: o.a?.[1] || undefined,
      badges: Array.isArray(o.h) ? o.h.map((b) => ({ kind: KINDS[Number(b[0])] ?? 'custom', title: String(b[1] ?? ''), detail: String(b[2] ?? ''), year: String(b[3] ?? '') })) : undefined,
    },
    date: (o.t ?? 0) * 60000,
    methodId: String(o.m), dose: Number(o.d), water: Number(o.w), temp: Number(o.c), grind: String(o.g ?? ''),
    time: Number(o.s ?? 0), rating: Number(o.r ?? 0),
    descriptors: Array.isArray(o.k) ? o.k.map(String) : [],
    notes: String(o.n ?? ''),
    score: typeof o.x === 'number' ? o.x : undefined,
    bean: o.b ?? null,
    plan: Array.isArray(o.p) && Array.isArray(o.p[2]) ? {
      name: String(o.p[0] ?? 'Рецепт'), total: Number(o.p[1]) || 0,
      steps: (o.p[2] as unknown[][]).map((st): BrewStep => ({
        at: Number(st[0]) || 0, title: String(st[1] ?? ''),
        to: Number(st[2]) >= 0 ? Number(st[2]) / 1000 : undefined, hint: st[3] ? String(st[3]) : undefined,
      })),
    } : undefined,
    ref: Array.isArray(o.i) && o.i[0] && o.i[1] ? { rid: String(o.i[0]), author: String(o.i[1]) } : undefined,
    gear: Array.isArray(o.e) ? o.e.map((g) => ({ cat: CATS[Number(g[0])] ?? 'other', name: String(g[1]), details: g[2] ? String(g[2]) : undefined })) : [],
  };
}

/** "r" + "z" (compressed) or "j" (uncompressed) + base64url */
export async function encodeRecipe(r: SharedRecipe): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(pack(r)));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'rz' + b64url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* fall back below */ }
  }
  return 'rj' + b64url(bytes);
}

/** Profile card link: the card lives on the server, the link carries its id ("p…" launch parameter) */
export function cardLinkFor(id: string) {
  if (TELEGRAM_BOT) return `${TELEGRAM_APP ? `https://t.me/${TELEGRAM_BOT}/${TELEGRAM_APP}` : `https://t.me/${TELEGRAM_BOT}`}?startapp=p${id}`;
  return `${WEB_URL}#r=p${id}`;
}

/** Launch parameter → recipe: "s…" — short link (recipe on the server), "r…" — recipe inside the link */
export async function resolveStartParam(param: string): Promise<SharedRecipe | null> {
  if (param.startsWith('s')) {
    const code = await loadRecipeCode(param.slice(1));
    return code ? decodeRecipe(code) : null;
  }
  return decodeRecipe(param);
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

/** Recipe link: straight into the Telegram Mini App (if it fits the 512-char startapp), otherwise to the web version */
export async function recipeLink(r: SharedRecipe): Promise<string> {
  if (TELEGRAM_BOT) {
    const base = TELEGRAM_APP ? `https://t.me/${TELEGRAM_BOT}/${TELEGRAM_APP}` : `https://t.me/${TELEGRAM_BOT}`;
    // Best option: the whole recipe on the server, a short code in the link. Fits a recipe of any size.
    const short = await storeRecipe(await encodeRecipe(r));
    if (short) return `${base}?startapp=s${short}`;
    // Drop optional parts until it fits: the text arrives in the message anyway
    const noHints = r.plan ? { ...r.plan, steps: r.plan.steps.map(({ hint: _h, ...st }) => st) } : undefined;
    const variants: SharedRecipe[] = [
      r,
      { ...r, notes: '' },
      { ...r, notes: '', plan: noHints },
      { ...r, notes: '', bean: r.bean ? { name: r.bean.name, country: r.bean.country, process: r.bean.process, isBlend: r.bean.isBlend, parts: r.bean.parts } : null },
      { ...r, notes: '', plan: noHints, author: { ...r.author, badges: r.author.badges?.slice(0, 2) }, bean: r.bean ? { name: r.bean.name, country: r.bean.country, process: r.bean.process, isBlend: r.bean.isBlend, parts: r.bean.parts } : null },
      { ...r, notes: '', plan: noHints, descriptors: [], author: { ...r.author, badges: undefined }, bean: r.bean ? { name: r.bean.name } : null, gear: r.gear.map(({ cat, name }) => ({ cat, name })) },
    ];
    for (const v of variants) {
      const code = await encodeRecipe(v);
      if (code.length <= 512) return `${base}?startapp=${code}`;
    }
  }
  return `${WEB_URL}#r=${await encodeRecipe(r)}`;
}

/** Human-readable text — visible in the chat even if the link is not opened */
export function recipeText(r: SharedRecipe): string {
  const m = methodById(r.methodId);
  const lines: string[] = [];
  const beanName = r.bean ? (r.bean.name || beanTitle(r.bean)) : '';
  const plan = effectivePlan(r.methodId, r.plan as BrewPlan | undefined);
  lines.push(`${m.name}${r.plan ? ` · ${r.plan.name}` : ''}${beanName ? ` — ${beanName}` : ''}`);
  if (r.author.name || r.author.username) lines.push(`Рецепт от ${[r.author.name, r.author.username && '@' + r.author.username].filter(Boolean).join(' ')}`);
  if (r.author.badges?.length) lines.push(sortBadges(r.author.badges).map(badgeText).join('; '));
  lines.push('');
  if (r.bean) {
    if (r.bean.isBlend) {
      lines.push(`Зерно: бленд${r.bean.roaster ? ` · обжарщик ${r.bean.roaster}` : ''}`);
      blendLines(r.bean).forEach((l) => lines.push(`• ${[l.share, l.text].filter(Boolean).join(' ')}`));
    } else {
      const origin = [r.bean.country, r.bean.region, r.bean.farm].filter(Boolean).join(', ');
      const meta = [origin, r.bean.process, r.bean.variety, r.bean.roaster && `обжарщик ${r.bean.roaster}`].filter(Boolean).join(' · ');
      if (meta) lines.push(`Зерно: ${meta}`);
    }
  }
  lines.push(`${fmtNum(r.dose, 2)} г → ${fmtNum(r.water)} г ${m.yieldLabel ? 'на выходе ' : 'воды '}(${fmtRatio(r.water / r.dose)}), ${r.temp ? fmtNum(r.temp) + '°C' : 'холодная вода'}, ${fmtTime(r.time)}`);
  if (r.grind) lines.push(`Помол: ${r.grind}`);
  if (r.gear.length) {
    lines.push('', 'Оборудование:');
    r.gear.forEach((g) => lines.push(`• ${catById(g.cat).one}: ${g.name}${g.details ? ` (${g.details})` : ''}`));
  }
  const steps = plan.steps.map((s) => `${fmtTime(s.at)} ${s.title}${s.to !== undefined ? ` — до ${fmtNum(r.water * s.to, 0)} г` : ''}${s.hint ? ` (${s.hint})` : ''}`);
  steps.push(`${fmtTime(plan.total)} Готово`);
  lines.push('', 'Шаги:', ...steps);
  const taste = [r.descriptors.join(', '), r.score !== undefined ? `оценка SCA ${fmtNum(r.score, 2)}` : r.rating ? `${'★'.repeat(Math.floor(r.rating))}${r.rating % 1 ? '½' : ''} ${fmtNum(r.rating)} из 5` : ''].filter(Boolean);
  if (taste.length) lines.push('', `Вкус: ${taste.join(' · ')}`);
  if (r.notes) lines.push(`Заметки: ${r.notes}`);
  return lines.join('\n');
}
