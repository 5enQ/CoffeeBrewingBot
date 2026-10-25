import type { BadgeLite } from './badges';
import type { Brew } from './store';

export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', diamond: 'Бриллиант' };

export interface Track {
  id: 'liters' | 'ratings';
  title: string;
  unit: string;
  levels: { tier: Tier; at: number; name: string }[];
}

export const TRACKS: Record<Track['id'], Track> = {
  liters: {
    id: 'liters', title: 'Выпито кофе', unit: 'л',
    levels: [
      { tier: 'bronze', at: 10, name: '10 литров кофе' },
      { tier: 'silver', at: 100, name: '100 литров кофе' },
      { tier: 'gold', at: 1000, name: '1000 литров кофе' },
      { tier: 'diamond', at: 10000, name: '10 000 литров кофе' },
    ],
  },
  ratings: {
    id: 'ratings', title: 'Оценки ваших рецептов', unit: 'оценок',
    levels: [
      { tier: 'bronze', at: 10, name: '10 оценок рецептов' },
      { tier: 'silver', at: 100, name: '100 оценок рецептов' },
      { tier: 'gold', at: 1000, name: '1000 оценок рецептов' },
      { tier: 'diamond', at: 10000, name: '10 000 оценок рецептов' },
    ],
  },
};

/** Объём своих заварок в литрах (без примеров и без рецептов, сохранённых от друзей) */
export function litersBrewed(brews: Brew[]) {
  return brews.filter((b) => !b.sample && !b.author).reduce((s, b) => s + (b.water || 0), 0) / 1000;
}

export function progress(track: Track, value: number) {
  const reached = track.levels.filter((l) => value >= l.at);
  const current = reached[reached.length - 1] ?? null;
  const next = track.levels.find((l) => value < l.at) ?? null;
  const from = current?.at ?? 0;
  const ratio = next ? Math.min(1, (value - from) / (next.at - from)) : 1;
  return { current, next, ratio };
}

/** Достигнутый уровень как значок — показывается в профиле и уходит в рецепт */
export function achievementBadges(liters: number, ratings: number): BadgeLite[] {
  const out: BadgeLite[] = [];
  for (const [track, value] of [[TRACKS.liters, liters], [TRACKS.ratings, ratings]] as const) {
    const { current } = progress(track, value);
    if (current) out.push({ kind: 'achieve', title: current.name, detail: TIER_LABEL[current.tier], year: '' });
  }
  return out;
}
