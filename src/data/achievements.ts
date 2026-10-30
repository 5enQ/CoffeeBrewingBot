import type { BadgeLite } from './badges';
import { countStats, earnedLevels, TIER_LABEL, type Stats, type Tier } from './levels';
import { methodById } from './methods';
import type { Brew } from './store';

export { TIER_LABEL, TIER_ORDER, type Stats, type Tier } from './levels';

const fmt = (n: number) => n.toLocaleString('ru-RU');

/**
 * An earned achievement.
 * id — permanent (for the profile showcase), unlock — changes with the level (for the "new badge" notification).
 */
export interface Achievement { id: string; unlock: string; tier: Tier; badge: BadgeLite }

/** Own brews: without samples and without recipes saved from friends */
export const ownBrews = (brews: Brew[]) => brews.filter((b) => !b.sample && !b.author);

/** The app's own estimate, with the same limits the server applies (used offline and outside Telegram) */
export function localStats(brews: Brew[], ratings: number): Stats {
  const now = Date.now();
  // everything on this device counts as imported history
  return countStats(ownBrews(brews).map((b) => ({ m: b.methodId, w: b.water || 0, t: b.date, r: now })), now, ratings);
}

/** Achievement key → badge. Titles are built here, so the server only has to know the numbers. */
export function achievementBadge(key: string, tier: Tier, at: number): BadgeLite {
  const title = key === 'liters' ? `${fmt(at)} литров кофе`
    : key === 'ratings' ? `${fmt(at)} оценок рецептов`
    : `${methodById(key.slice(7)).name} · ${fmt(at)} заварок`;
  return { kind: 'achieve', title, detail: TIER_LABEL[tier], year: '' };
}

/** All earned achievements. Unearned ones are never shown — it's a surprise. */
export function earnedAchievements(stats: Stats): Achievement[] {
  return Object.entries(earnedLevels(stats)).map(([key, l]) => ({
    id: key, unlock: `${key}:${l.tier}`, tier: l.tier, badge: achievementBadge(key, l.tier, l.at),
  }));
}
