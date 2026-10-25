import type { BadgeLite } from './badges';
import { allMethods } from './methods';
import type { Brew } from './store';

export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', diamond: 'Бриллиант' };

interface Level { tier: Tier; at: number }

const LITERS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 1000 }, { tier: 'diamond', at: 10000 }];
const RATINGS: Level[] = [{ tier: 'bronze', at: 10 }, { tier: 'silver', at: 100 }, { tier: 'gold', at: 1000 }, { tier: 'diamond', at: 10000 }];
const METHOD_COUNT: Level[] = [{ tier: 'bronze', at: 100 }, { tier: 'silver', at: 1000 }, { tier: 'gold', at: 10000 }];

const fmt = (n: number) => n.toLocaleString('ru-RU');

/**
 * Полученное достижение.
 * id — постоянный (для выбора в витрину профиля), unlock — меняется с уровнем (для уведомления «новый значок»).
 */
export interface Achievement { id: string; unlock: string; badge: BadgeLite }

function reached(levels: Level[], value: number) {
  return levels.filter((l) => value >= l.at).pop() ?? null;
}

/** Свои заварки: без примеров и без рецептов, сохранённых от друзей */
const ownBrews = (brews: Brew[]) => brews.filter((b) => !b.sample && !b.author);

export function litersBrewed(brews: Brew[]) {
  return ownBrews(brews).reduce((s, b) => s + (b.water || 0), 0) / 1000;
}

/** Все полученные достижения. Неполученные не показываются нигде — это сюрприз. */
export function earnedAchievements(brews: Brew[], ratingsCount: number): Achievement[] {
  const out: Achievement[] = [];
  const own = ownBrews(brews);

  const lit = reached(LITERS, litersBrewed(brews));
  if (lit) out.push({ id: 'liters', unlock: `liters:${lit.tier}`, badge: { kind: 'achieve', title: `${fmt(lit.at)} литров кофе`, detail: TIER_LABEL[lit.tier], year: '' } });

  const rat = reached(RATINGS, ratingsCount);
  if (rat) out.push({ id: 'ratings', unlock: `ratings:${rat.tier}`, badge: { kind: 'achieve', title: `${fmt(rat.at)} оценок рецептов`, detail: TIER_LABEL[rat.tier], year: '' } });

  for (const m of allMethods()) {
    const n = own.filter((b) => b.methodId === m.id).length;
    const lv = reached(METHOD_COUNT, n);
    if (lv) out.push({ id: `method:${m.id}`, unlock: `method:${m.id}:${lv.tier}`, badge: { kind: 'achieve', title: `${m.name} · ${fmt(lv.at)} заварок`, detail: TIER_LABEL[lv.tier], year: '' } });
  }
  return out;
}
