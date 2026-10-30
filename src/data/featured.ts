import { useMemo } from 'react';
import { earnedAchievements } from './achievements';
import { sortBadges, type Badge, type BadgeLite } from './badges';
import { useStore } from './store';

export const MAX_FEATURED = 3;

export interface BadgeItem {
  /** showcase key: own badge id or 'ach:<id>' */
  key: string;
  badge: BadgeLite;
  /** own badge (editable) */
  own?: Badge;
}

/** All user badges: own + earned achievements, and the showcase (up to 3) */
export function useBadges() {
  const { profile, brews } = useStore();
  return useMemo(() => {
    const ach = earnedAchievements(brews, profile.ratingStats?.count ?? 0);
    const all: BadgeItem[] = [
      ...ach.map((a) => ({ key: `ach:${a.id}`, badge: a.badge })),
      ...profile.badges.map((b) => ({ key: b.id, badge: b, own: b })),
    ];
    const sorted = sortBadgeItems(all);
    const featured = profile.featured
      ? profile.featured.map((k) => all.find((x) => x.key === k)).filter(Boolean).slice(0, MAX_FEATURED) as BadgeItem[]
      : sorted.slice(0, MAX_FEATURED);
    return { all: sorted, featured, featuredKeys: featured.map((f) => f.key) };
  }, [profile.badges, profile.featured, profile.ratingStats, brews]);
}

function sortBadgeItems(items: BadgeItem[]) {
  const order = sortBadges(items.map((i) => i.badge));
  return order.map((b) => items.find((i) => i.badge === b)!);
}
