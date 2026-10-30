/** achieve — awarded automatically (liters, ratings), never created manually */
export type BadgeKind = 'sca' | 'q' | 'champ' | 'custom' | 'achieve';

export interface Badge {
  id: string;
  kind: BadgeKind;
  /** main caption: module, championship, title */
  title: string;
  /** level, place, category */
  detail: string;
  year: string;
}

/** In a recipe the badge is sent without an id */
export type BadgeLite = Omit<Badge, 'id'>;

export const BADGE_KINDS: { id: BadgeKind; label: string; hint: string }[] = [
  { id: 'sca', label: 'Сертификат SCA', hint: 'Coffee Skills Program' },
  { id: 'q', label: 'Q Grader', hint: 'Coffee Quality Institute' },
  { id: 'champ', label: 'Чемпионат', hint: 'Место или выход в финал' },
  { id: 'custom', label: 'Другое', hint: 'Курсы, звания, работа' },
];

export const SCA_MODULES = [
  'Introduction to Coffee', 'Barista Skills', 'Brewing', 'Sensory Skills', 'Green Coffee', 'Roasting',
];
export const SCA_LEVELS = ['Foundation', 'Intermediate', 'Professional'];
export const SCA_EXTRA = ['SCA Coffee Skills Diploma', 'AST — авторизованный тренер'];

export const Q_TYPES = ['Arabica Q Grader', 'Robusta Q Grader', 'Q Processing Professional'];

export const CHAMPIONSHIPS = [
  'World Brewers Cup', 'World Barista Championship', 'World AeroPress Championship', 'World Cup Tasters',
  'World Latte Art', 'World Coffee Roasting', 'Coffee in Good Spirits', 'Чемпионат России по бреве',
  'Чемпионат России бариста', 'Чемпионат России по аэропрессу', 'Чемпионат России по каптестингу',
];
export const PLACES = ['1 место', '2 место', '3 место', 'Финалист', 'Полуфиналист', 'Участник'];

/** Badge tone: gold / silver / bronze for podium places, own color per type */
const ACHIEVE_TONES: Record<string, string> = { 'Бронза': 'bronze', 'Серебро': 'silver', 'Золото': 'gold', 'Объёмный': 'volume', 'Бриллиант': 'diamond' };

export function badgeTone(b: Pick<Badge, 'kind' | 'detail'>): string {
  if (b.kind === 'achieve') return ACHIEVE_TONES[b.detail] ?? 'bronze';
  if (b.kind === 'champ') {
    if (b.detail.startsWith('1')) return 'gold';
    if (b.detail.startsWith('2')) return 'silver';
    if (b.detail.startsWith('3')) return 'bronze';
    return 'champ';
  }
  return b.kind;
}

export const badgeText = (b: BadgeLite) => [b.title, b.detail, b.year].filter(Boolean).join(' · ');

/** Display order: podium places, Q, SCA, the rest */
export function sortBadges<T extends BadgeLite>(list: T[]): T[] {
  const rank = (b: BadgeLite) => {
    const base = ({ diamond: 0, volume: 0.6, gold: 1, silver: 2, bronze: 3, q: 4, champ: 5, sca: 6, custom: 7 } as Record<string, number>)[badgeTone(b)] ?? 9;
    return base + (b.kind === 'achieve' ? 0.5 : 0); // championship awards above achievements of the same color
  };
  return [...list].sort((a, z) => rank(a) - rank(z) || Number(z.year || 0) - Number(a.year || 0));
}
