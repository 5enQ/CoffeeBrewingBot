import type { BadgeLite } from './badges';
import { countStats, earnedLevels, TIER_LABEL, type Stats, type Tier } from './levels';
import { methodById } from './methods';
import { rareOfBean } from './rare';
import type { Bean, Brew } from './store';
import { intlLocale, tr } from '../i18n';

export { TIER_LABEL, TIER_ORDER, type Stats, type Tier } from './levels';

const fmt = (n: number) => n.toLocaleString(intlLocale());

/**
 * An earned achievement.
 * id — permanent (for the profile showcase), unlock — changes with the level (for the "new badge" notification).
 */
export interface Achievement { id: string; unlock: string; tier: Tier; badge: BadgeLite }

/** Own brews: without samples and without recipes saved from friends */
export const ownBrews = (brews: Brew[]) => brews.filter((b) => !b.sample && !b.author);

/** The app's own estimate, with the same limits the server applies (used offline and outside Telegram) */
export function localStats(brews: Brew[], ratings: number, beans: Bean[] = []): Stats {
  const now = Date.now();
  const byId = new Map(beans.map((x) => [x.id, x]));
  // everything on this device counts as imported history
  return countStats(ownBrews(brews).map((b) => ({ m: b.methodId, w: b.water || 0, t: b.date, r: now, x: rareOfBean(b.beanId ? byId.get(b.beanId) : null).join(',') })), now, ratings);
}

/** Achievement key → badge. Titles are built here, so the server only has to know the numbers. */
export function achievementBadge(key: string, tier: Tier, at: number): BadgeLite {
  const title = key === 'liters' ? tr('{0} литров кофе', fmt(at))
    : key === 'ratings' ? tr('{0} оценок рецептов', fmt(at))
    : tr('{0} · {1} заварок', methodById(key.slice(7)).name, fmt(at));
  return { kind: 'achieve', title, detail: TIER_LABEL[tier], year: '' };
}

/** All earned achievements. Unearned ones are never shown — it's a surprise. */
export function earnedAchievements(stats: Stats): Achievement[] {
  return Object.entries(earnedLevels(stats)).map(([key, l]) => ({
    id: key, unlock: `${key}:${l.tier}`, tier: l.tier, badge: achievementBadge(key, l.tier, l.at),
  }));
}
