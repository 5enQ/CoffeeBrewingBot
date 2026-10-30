/**
 * Compact cloud format (Telegram CloudStorage: up to 1024 keys of 4096 chars).
 *
 * How we save space:
 *  1. Empty and default values are not stored — they are filled back in on read.
 *  2. Brew gear is stored as an id only; deleted items live in the metadata "archive".
 *  3. Each bucket is deflated and base64url-encoded.
 *  4. Dictionary descriptors as indices, five-cup marks as bitmasks, dates in seconds.
 *  5. Sample records, the ratings cache and per-device settings are not uploaded.
 *  6. Brews are bucketed by month: one changed brew uploads only its month.
 */
import { hash } from './codec';
import { FLAVOR_WHEEL, emptyCupping, type Cupping } from './cupping';
import { emptyAffective, emptyDescriptive, type CvaSession } from './cva';
import type { GearRef } from './gear';
import { EMPTY, type Bean, type Brew, type DB } from './store';

export const FORMAT = 1;

/* ---------- descriptor dictionary ---------- */
// IMPORTANT: only append. The index is the position; reordering breaks reading old records.
const DICT: string[] = FLAVOR_WHEEL.flatMap((g) => g.items);
const DICT_INDEX = new Map(DICT.map((d, i) => [d, i]));
const packDesc = (list: string[]) => list.map((d) => DICT_INDEX.get(d) ?? d);
const unpackDesc = (list: (string | number)[] | undefined) => (list ?? []).map((d) => (typeof d === 'number' ? DICT[d] ?? '' : d)).filter(Boolean);

/* ---------- bitmasks ---------- */
const bits = (a: boolean[]) => a.reduce((m, v, i) => (v ? m | (1 << i) : m), 0);
const unbits = (m: number | undefined, n: number) => Array.from({ length: n }, (_, i) => !!((m ?? 0) & (1 << i)));

/* ---------- 1. no empty values ---------- */
const KEEP_AS_IS = new Set(['author', 'plan', 'parts', 'drips']);
/** Removes null, undefined, '', [] and {} (recursively). Keeps zero and false — they mean something. */
export function strip<T>(v: T): T {
  if (Array.isArray(v)) return v.map(strip) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const y = KEEP_AS_IS.has(k) ? x : strip(x);
      if (y === null || y === undefined || y === '') continue;
      if (Array.isArray(y) && y.length === 0) continue;
      if (typeof y === 'object' && !Array.isArray(y) && Object.keys(y as object).length === 0) continue;
      out[k] = y;
    }
    return out as T;
  }
  return v;
}

const sec = (ms: number | undefined) => (ms ? Math.round(ms / 1000) : undefined);
const ms = (s: number | undefined) => (s ? s * 1000 : 0);
const DEFAULT_TASTE = { acidity: 3, sweetness: 3, bitterness: 2, body: 3 };
const sameTaste = (t: Brew['taste']) => Object.entries(DEFAULT_TASTE).every(([k, v]) => t?.[k as keyof typeof t] === v);

type Packed = Record<string, unknown>;

/* ---------- brew ---------- */

function packCva(s: CvaSession): Packed {
  return {
    ...s,
    samples: s.samples.map((x) => ({
      ...x,
      affective: x.affective && { ...x.affective, nonUniform: bits(x.affective.nonUniform), defective: bits(x.affective.defective) },
    })),
  };
}

function unpackCva(p: Packed): CvaSession {
  const s = p as unknown as CvaSession & { samples: Packed[] };
  const cups = s.cups;
  return {
    mode: s.mode, cupVolume: s.cupVolume, cups, purpose: s.purpose ?? '',
    samples: (s.samples ?? []).map((raw) => {
      const x = raw as unknown as Packed & { affective?: Packed; descriptive?: Packed; extrinsic?: Packed };
      const a = x.affective as (Packed & { nonUniform?: number; defective?: number }) | undefined;
      return {
        id: x.id as string, code: (x.code as string) ?? '', beanId: (x.beanId as string) ?? null,
        affective: a ? { ...emptyAffective(cups), ...a, nonUniform: unbits(a.nonUniform, cups), defective: unbits(a.defective, cups) } as never : undefined,
        descriptive: x.descriptive ? { ...emptyDescriptive(), ...x.descriptive } as never : undefined,
        extrinsic: x.extrinsic ? { checked: [], notes: {}, ...x.extrinsic } as never : undefined,
      };
    }),
  };
}

function packCupping(c: Cupping): Packed {
  return { ...c, descriptors: packDesc(c.descriptors ?? []), cups: Object.fromEntries(Object.entries(c.cups).map(([k, v]) => [k, bits(v)])) };
}
function unpackCupping(p: Packed): Cupping {
  const base = emptyCupping();
  const cups = (p.cups ?? {}) as Record<string, number>;
  return {
    ...base, ...(p as object),
    descriptors: unpackDesc(p.descriptors as (string | number)[]),
    cups: Object.fromEntries(Object.keys(base.cups).map((k) => [k, unbits(cups[k], 5)])) as Cupping['cups'],
  } as Cupping;
}

/* ---------- brew gear ---------- */
// A brew keeps a snapshot of the gear at the time of recording. If the snapshot matches the item in the list, only its id is written.
// If the item was renamed or deleted since, a version key "id~hash" is written and the snapshot goes to the metadata archive.
const snap = (g: GearRef): GearRef => ({ id: g.id, cat: g.cat, name: g.name, ...(g.details ? { details: g.details } : {}) });
const sameGear = (a: GearRef, b: GearRef) => a.cat === b.cat && a.name === b.name && (a.details ?? '') === (b.details ?? '');
let current = new Map<string, GearRef>();
let archiveOut = new Map<string, GearRef>();
function gearKey(g: GearRef) {
  const cur = current.get(g.id);
  if (cur && sameGear(cur, g)) return g.id;
  const key = `${g.id}~${hash(`${g.cat}|${g.name}|${g.details ?? ''}`)}`;
  archiveOut.set(key, snap(g));
  return key;
}

export function packBrew(b: Brew, u: number | undefined): Packed {
  const { date, sample: _s, gear, cupping, cva, descriptors, taste, rating, ...rest } = b;
  void _s;
  return strip({
    ...rest,
    t: sec(date),
    u: sec(u),
    rating: rating || undefined,
    taste: sameTaste(taste) ? undefined : taste,
    descriptors: packDesc(descriptors ?? []),
    gear: gear?.map((g) => gearKey(g)),
    cupping: cupping ? packCupping(cupping) : undefined,
    cva: cva ? packCva(cva) : undefined,
  });
}

export function unpackBrew(p: Packed, gearById: Map<string, GearRef>): { brew: Brew; u: number; missing: boolean } {
  const { t, u, gear, cupping, cva, descriptors, taste, rating, ...rest } = p as Packed & {
    t?: number; u?: number; gear?: string[]; cupping?: Packed; cva?: Packed; descriptors?: (string | number)[]; taste?: Brew['taste']; rating?: number;
  };
  const brew = {
    beanId: null, grind: '', notes: '', time: 0, temp: 0, dose: 0, water: 0,
    ...rest,
    date: ms(t),
    rating: rating ?? 0,
    taste: taste ?? { ...DEFAULT_TASTE },
    descriptors: unpackDesc(descriptors),
    cupping: cupping ? unpackCupping(cupping) : null,
    cva: cva ? unpackCva(cva) : undefined,
    gear: gear ? gear.map((key) => gearById.get(key)).filter((g): g is GearRef => !!g) : undefined,
  } as Brew;
  const missing = !!gear && gear.some((key) => !gearById.has(key));
  if (!brew.cva) delete brew.cva;
  if (!brew.gear) delete brew.gear;
  return { brew, u: ms(u), missing };
}

/* ---------- pack ---------- */

const BEAN_TEXT = ['name', 'roaster', 'country', 'region', 'farm', 'producer', 'variety', 'process', 'altitude', 'harvest',
  'roastLevel', 'roastDate', 'weight', 'barcode', 'link', 'packNotes', 'comment'] as const;

export function packBean(b: Bean, u: number | undefined): Packed {
  const { createdAt, sample: _s, ...rest } = b;
  void _s;
  return strip({ ...rest, t: sec(createdAt), u: sec(u) });
}
export function unpackBean(p: Packed): { bean: Bean; u: number } {
  const { t, u, ...rest } = p as Packed & { t?: number; u?: number };
  const bean = { ...Object.fromEntries(BEAN_TEXT.map((k) => [k, ''])), ...rest, createdAt: ms(t) } as Bean;
  return { bean, u: ms(u) };
}

/* ---------- buckets ---------- */

/** JSON with sorted keys: the same data gives the same string and hash on any device */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x));
}

export const monthOf = (date: number) => {
  const d = new Date(date);
  return `b${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Metadata: everything except packs and brews */
export interface Meta {
  f: number;
  profile: Partial<DB['profile']>;
  recipes: DB['recipes'];
  gear: DB['gear'];
  /** gear snapshots from brews that differ from the current list (renamed or deleted): version key → snapshot */
  archive: Record<string, GearRef>;
  custom: NonNullable<DB['custom']>;
  methods: NonNullable<DB['customMethods']>;
  pinned: string[];
  tiles?: DB['tiles'];
  rated: Record<string, number>;
  seen: string[];
  /** timestamps of metadata records, s */
  s: Record<string, number>;
  /** deleted records, s */
  d: Record<string, number>;
}

const TOMBSTONE_TTL = 180 * 86_400_000;

/** DB → buckets as JSON strings (before compression). Sample records and caches are left out. */
export function toBuckets(db: DB): Record<string, string> {
  const mod = db.mod ?? {};
  const realBrews = db.brews.filter((b) => !b.sample);
  // a sample pack is still saved if a real brew used it
  const usedBeans = new Set(realBrews.map((b) => b.beanId).concat(realBrews.flatMap((b) => b.cva?.samples.map((s) => s.beanId) ?? [])));
  const beans = db.beans.filter((b) => !b.sample || usedBeans.has(b.id));
  const gear = db.gear.filter((g) => !g.sample);
  current = new Map(gear.map((g) => [g.id, snap(g)]));
  archiveOut = new Map();
  // brews are packed first — the snapshot archive is collected along the way
  const months = new Map<string, Packed[]>();
  for (const b of realBrews) {
    const key = monthOf(b.date);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(packBrew(b, mod['b:' + b.id]));
  }

  const metaKeys = Object.keys(mod).filter((k) => !k.startsWith('b:') && !k.startsWith('k:'));
  const now = Date.now();
  const { ratingStats: _r, layout: _l, ...profile } = db.profile;
  void _r; void _l;
  const meta: Meta = {
    f: FORMAT,
    profile,
    recipes: db.recipes,
    gear: gear.map(({ sample: _s, ...g }) => { void _s; return g; }),
    archive: Object.fromEntries([...archiveOut.entries()].sort(([a], [z]) => (a < z ? -1 : 1))),
    custom: db.custom ?? [],
    methods: db.customMethods ?? [],
    pinned: db.pinned ?? [],
    tiles: db.tiles,
    rated: db.rated ?? {},
    seen: db.seenAch ?? [],
    s: Object.fromEntries(metaKeys.map((k) => [k, sec(mod[k])!])),
    d: Object.fromEntries(Object.entries(db.del ?? {}).filter(([, t]) => now - t < TOMBSTONE_TTL).map(([k, t]) => [k, sec(t)!])),
  };

  const out: Record<string, string> = { m: canonical(meta) };
  beans.sort((a, z) => z.createdAt - a.createdAt || (a.id < z.id ? -1 : 1));
  if (beans.length) out.k = canonical(beans.map((b) => packBean(b, mod['k:' + b.id])));
  for (const [k, list] of months) out[k] = canonical(list.sort((a, z) => (z.t as number) - (a.t as number) || ((a.id as string) < (z.id as string) ? -1 : 1)));
  return out;
}

/** Part of the database read from the cloud: only the changed buckets */
export interface Remote {
  meta?: Meta;
  beans?: { bean: Bean; u: number }[];
  brews?: { brew: Brew; u: number }[];
  /** brew buckets that cannot be applied yet: the gear snapshot archive is not complete */
  skipped?: string[];
}

export function fromBuckets(buckets: Record<string, string>, localGear: DB['gear']): Remote {
  const out: Remote = {};
  if (buckets.m) out.meta = JSON.parse(buckets.m) as Meta;
  const gearById = new Map<string, GearRef>();
  for (const g of localGear) gearById.set(g.id, snap(g));
  for (const g of out.meta?.gear ?? []) gearById.set(g.id, snap(g));
  const arch = out.meta?.archive ?? {};
  if (Array.isArray(arch)) for (const g of arch as GearRef[]) gearById.set(g.id, snap(g)); // format of the first hours: archive as a list
  else for (const [key, g] of Object.entries(arch)) gearById.set(key, snap(g));
  if (buckets.k) out.beans = (JSON.parse(buckets.k) as Packed[]).map(unpackBean);
  const brewKeys = Object.keys(buckets).filter((k) => /^b\d{6}$/.test(k));
  out.skipped = [];
  const brews: { brew: Brew; u: number }[] = [];
  for (const k of brewKeys) {
    const list = (JSON.parse(buckets[k]) as Packed[]).map((p) => unpackBrew(p, gearById));
    if (list.some((x) => x.missing)) { out.skipped.push(k); continue; }
    brews.push(...list.map(({ brew, u }) => ({ brew, u })));
  }
  if (brews.length) out.brews = brews;
  return out;
}

/* ---------- merge ---------- */

type WithId = { id: string };

/**
 * Per-record merge: the later edit wins; a deletion wins if it is later than the edit.
 * A record missing in the cloud means nothing — deletions arrive only as stamps.
 */
export function merge(local: DB, remote: Remote): DB {
  const mod = { ...(local.mod ?? {}) };
  const del = { ...(local.del ?? {}) };
  const m = remote.meta;
  if (m) {
    for (const [k, t] of Object.entries(m.d)) del[k] = Math.max(del[k] ?? 0, ms(t));
  }
  const rmod: Record<string, number> = {};
  if (m) for (const [k, t] of Object.entries(m.s)) rmod[k] = ms(t);
  remote.beans?.forEach(({ bean, u }) => { rmod['k:' + bean.id] = u; });
  remote.brews?.forEach(({ brew, u }) => { rmod['b:' + brew.id] = u; });

  const coll = <T extends WithId>(list: T[], incoming: T[] | undefined, prefix: string, append: 'end' | 'start' = 'end'): T[] => {
    let res = [...list];
    const index = new Map(res.map((x, i) => [x.id, i]));
    const fresh: T[] = [];
    for (const x of incoming ?? []) {
      const key = prefix + x.id;
      const ru = rmod[key] ?? 0;
      if ((del[key] ?? 0) > 0 && (del[key] ?? 0) >= ru) continue;
      const i = index.get(x.id);
      if (i === undefined) {
        fresh.push(x);
        mod[key] = Math.max(mod[key] ?? 0, ru);
      } else if (ru > (mod[key] ?? 0)) {
        res[i] = x;
        mod[key] = ru;
      }
    }
    res = append === 'end' ? [...res, ...fresh] : [...fresh, ...res];
    // deletions from other devices
    return res.filter((x) => {
      const key = prefix + x.id;
      const gone = (del[key] ?? 0) > 0 && (del[key] ?? 0) >= (mod[key] ?? 0);
      if (gone) delete mod[key];
      return !gone;
    });
  };

  const newer = (key: string) => (rmod[key] ?? 0) > (mod[key] ?? 0);
  let next: DB = { ...local };
  next.beans = coll(local.beans, remote.beans?.map((x) => x.bean), 'k:', 'start');
  next.brews = coll(local.brews, remote.brews?.map((x) => x.brew), 'b:').sort((a, z) => z.date - a.date);
  // if a pack was deleted on another device, its brews stay without beans
  const beanIds = new Set(next.beans.map((b) => b.id));
  next.brews = next.brews.map((b) => (b.beanId && !beanIds.has(b.beanId) && (del['k:' + b.beanId] ?? 0) > 0 ? { ...b, beanId: null } : b));

  if (m) {
    next.gear = coll(local.gear, m.gear, 'g:');
    next.custom = coll(local.custom ?? [], m.custom, 'c:');
    next.customMethods = coll(local.customMethods ?? [], m.methods, 'x:');
    const recipes = { ...local.recipes };
    for (const [id, r] of Object.entries(m.recipes)) {
      const key = 'r:' + id;
      if (!recipes[id] || newer(key)) { recipes[id] = r; mod[key] = Math.max(mod[key] ?? 0, rmod[key] ?? 0); }
    }
    next.recipes = recipes;
    // a profile never saved with a timestamp on any device — take the more filled one
    const filled = (p: Partial<DB['profile']>) => (p.name ? 1 : 0) + (p.about ? 1 : 0) + (p.telegram ? 1 : 0) + (p.badges?.length ?? 0) + (p.featured ? 1 : 0);
    const unstamped = !mod.p && !rmod.p;
    if (newer('p') || (unstamped && filled(m.profile) > filled(local.profile))) {
      next.profile = { ...EMPTY.profile, ...m.profile, layout: local.profile.layout, ratingStats: local.profile.ratingStats };
      if (rmod.p) mod.p = rmod.p;
    }
    if (m.tiles && (newer('h') || (!local.tiles && !mod.h))) { next.tiles = m.tiles; mod.h = Math.max(mod.h ?? 0, rmod.h ?? 0); }
    if (newer('n') || (!local.pinned?.length && m.pinned.length && !mod.n)) { next.pinned = m.pinned; mod.n = Math.max(mod.n ?? 0, rmod.n ?? 0); }
    next.rated = { ...m.rated, ...(local.rated ?? {}) };
    next.seenAch = [...new Set([...(local.seenAch ?? []), ...m.seen])];
  }

  // fresh device: samples are not needed if real records came from the cloud
  const remoteReal = (remote.beans?.length ?? 0) + (remote.brews?.length ?? 0) > 0;
  const localReal = local.beans.some((b) => !b.sample) || local.brews.some((b) => !b.sample);
  if (remoteReal && !localReal) {
    next = {
      ...next,
      beans: next.beans.filter((b) => !b.sample || next.brews.some((r) => !r.sample && r.beanId === b.id)),
      brews: next.brews.filter((b) => !b.sample),
      gear: next.gear.filter((g) => !g.sample),
    };
  }

  for (const k of Object.keys(del)) if ((mod[k] ?? 0) > del[k]) delete del[k];
  return { ...next, mod, del };
}
