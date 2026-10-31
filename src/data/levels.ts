/**
 * Achievement levels — shared by the app and the server (worker imports this file), so both count the same way.
 * No imports: the worker bundles it as is.
 */

/** volume — the top method tier: a 3D icon of the method; diamond — for liters */
export type Tier = 'bronze' | 'silver' | 'gold' | 'volume' | 'diamond';
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', volume: 'Объёмный', diamond: 'Бриллиант' };
export const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'volume', 'diamond'];

export interface Level { tier: Tier; at: number }

/** brews with one method: each tier gives a badge and a card background with the method icon */
export const METHOD_LEVELS: Level[] = [{ tier: 'bronze', at: 50 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 500 }, { tier: 'volume', at: 1000 }];
/** brewed liters; the diamond card is given for 1000 liters */
export const LITER_LEVELS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 500 }, { tier: 'diamond', at: 1000 }];
/** ratings of the user's recipes by friends (badges only) */
export const RATING_LEVELS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 1000 }, { tier: 'diamond', at: 10000 }];

export const reached = (levels: Level[], value: number) => levels.filter((l) => value >= l.at).pop() ?? null;

/** Counted numbers of one user: brews per method id, liters, ratings */
export interface Stats { methods: Record<string, number>; liters: number; ratings: number }

/** Achievement key ('method:v60', 'liters', 'ratings') → reached level */
export function earnedLevels(s: Stats): Record<string, Level> {
  const out: Record<string, Level> = {};
  for (const [id, n] of Object.entries(s.methods)) { const l = reached(METHOD_LEVELS, n); if (l) out[`method:${id}`] = l; }
  const lit = reached(LITER_LEVELS, s.liters); if (lit) out.liters = lit;
  const rat = reached(RATING_LEVELS, s.ratings); if (rat) out.ratings = rat;
  return out;
}

/** Card backgrounds: every method tier, and diamond for liters. Other achievements are badges only. */
export const givesBackground = (key: string, tier: Tier) => key.startsWith('method:') || (key === 'liters' && tier === 'diamond');

/* ---------- counting rules (the server applies them; the app uses them for its offline estimate) ---------- */

export interface BrewStat { m: string; w: number; t: number; r: number }

export const COUNT_RULES = {
  /** technical ceiling against scripted brews, far above what a person drinks (the app warns past HEALTH_CUPS) */
  perDay: 100,
  /** water counted per brew, ml (batch brew included) */
  maxWater: 3000,
  /** water counted per day, ml */
  perDayWater: 6000,
  /** history imported in the first day of an account counts as is (within the limits above) */
  importWindow: 86_400_000,
  /** after that a brew must arrive within 14 days of its date (offline devices sync late) */
  maxLate: 14 * 86_400_000,
  /** dates before this are not real */
  earliest: Date.UTC(2015, 0, 1),
};

/** past this many own brews a day the app shows a health warning (nothing is capped) */
export const HEALTH_CUPS = 10;

/**
 * Count brews with the limits: technical per-day ceiling, water caps, no backdating after the import window.
 * t — brew date, r — when the server first saw it, created — account creation.
 */
export function countStats(rows: BrewStat[], created: number, ratings = 0): Stats {
  const R = COUNT_RULES;
  const perDay = new Map<number, number>();
  const waterDay = new Map<number, number>();
  const methods: Record<string, number> = {};
  let ml = 0;
  for (const b of [...rows].sort((a, z) => a.t - z.t)) {
    if (!b.m || !(b.t >= R.earliest) || b.t > b.r + 86_400_000) continue;
    if (b.r > created + R.importWindow && b.t < b.r - R.maxLate) continue;
    const day = Math.floor(b.t / 86_400_000);
    const n = perDay.get(day) ?? 0;
    if (n >= R.perDay) continue;
    perDay.set(day, n + 1);
    methods[b.m] = (methods[b.m] ?? 0) + 1;
    const used = waterDay.get(day) ?? 0;
    const w = Math.max(0, Math.min(R.maxWater, Math.round(b.w) || 0, R.perDayWater - used));
    waterDay.set(day, used + w);
    ml += w;
  }
  return { methods, liters: Math.round(ml / 100) / 10, ratings };
}
