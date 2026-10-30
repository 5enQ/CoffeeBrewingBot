import type { BadgeLite } from './badges';
import { methodById } from './methods';
import type { Brew } from './store';

/** volume — the top method tier: a 3D icon of the method; diamond — for liters */
export type Tier = 'bronze' | 'silver' | 'gold' | 'volume' | 'diamond';
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', volume: 'Объёмный', diamond: 'Бриллиант' };
export const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'volume', 'diamond'];

interface Level { tier: Tier; at: number }

/** brewed volume; the diamond card is given for 1000 liters */
const LITERS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 500 }, { tier: 'diamond', at: 1000 }];
const RATINGS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 1000 }, { tier: 'diamond', at: 10000 }];
/** brews with one method: each tier gives a badge and a card background with the method icon */
const METHOD_COUNT: Level[] = [{ tier: 'bronze', at: 50 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 500 }, { tier: 'volume', at: 1000 }];

const fmt = (n: number) => n.toLocaleString('ru-RU');

/**
 * An earned achievement.
 * id — permanent (for the profile showcase), unlock — changes with the level (for the "new badge" notification).
 */
export interface Achievement { id: string; unlock: string; badge: BadgeLite }

function reached(levels: Level[], value: number) {
  return levels.filter((l) => value >= l.at).pop() ?? null;
}

/** Own brews: without samples and without recipes saved from friends */
const ownBrews = (brews: Brew[]) => brews.filter((b) => !b.sample && !b.author);

export function litersBrewed(brews: Brew[]) {
  return ownBrews(brews).reduce((s, b) => s + (b.water || 0), 0) / 1000;
}

/** All earned achievements. Unearned ones are never shown — it's a surprise. */
export function earnedAchievements(brews: Brew[], ratingsCount: number): Achievement[] {
  const out: Achievement[] = [];
  const own = ownBrews(brews);

  const lit = reached(LITERS, litersBrewed(brews));
  if (lit) out.push({ id: 'liters', unlock: `liters:${lit.tier}`, badge: { kind: 'achieve', title: `${fmt(lit.at)} литров кофе`, detail: TIER_LABEL[lit.tier], year: '' } });

  const rat = reached(RATINGS, ratingsCount);
  if (rat) out.push({ id: 'ratings', unlock: `ratings:${rat.tier}`, badge: { kind: 'achieve', title: `${fmt(rat.at)} оценок рецептов`, detail: TIER_LABEL[rat.tier], year: '' } });

  // every method that was brewed, including retired ones (Kalita Wave) and deleted custom methods: earned badges stay
  for (const id of [...new Set(own.map((b) => b.methodId))]) {
    const m = methodById(id);
    const n = own.filter((b) => b.methodId === id).length;
    const lv = reached(METHOD_COUNT, n);
    if (lv) out.push({ id: `method:${m.id}`, unlock: `method:${m.id}:${lv.tier}`, badge: { kind: 'achieve', title: `${m.name} · ${fmt(lv.at)} заварок`, detail: TIER_LABEL[lv.tier], year: '' } });
  }
  return out;
}
