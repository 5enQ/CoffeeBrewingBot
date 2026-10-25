import { daysSince, type Bean } from '../data/store';

type BeanLike = Partial<Pick<Bean, 'name' | 'country' | 'region' | 'farm' | 'process' | 'variety' | 'isBlend' | 'parts'>>;

const isBlend = (b: BeanLike) => !!b.isBlend;

/** «Бразилия 60% · Эфиопия 40%» */
export const blendSummary = (b: BeanLike) =>
  (b.parts ?? []).map((p) => [p.country || 'компонент', p.share && `${p.share}%`].filter(Boolean).join(' ')).join(' · ');

export const beanTitle = (b?: BeanLike | null) => (b
  ? b.name || (isBlend(b) ? `Бленд ${blendSummary(b)}`.trim() : [b.country, b.region].filter(Boolean).join(', ')) || 'Без названия'
  : 'Без зерна');

/** Происхождение: для моносорта — страна · регион · ферма, для бленда — состав */
export const beanOrigin = (b: BeanLike) => isBlend(b)
  ? ['Бленд', blendSummary(b)].filter(Boolean).join(': ')
  : [b.country, b.region, b.farm].filter(Boolean).join(' · ');

/** Происхождение + обработка — короткая подпись под названием */
export const beanMeta = (b: BeanLike) => isBlend(b)
  ? beanOrigin(b)
  : [beanOrigin(b), b.process].filter(Boolean).join(' · ');

/** Подробный состав одной строкой на компонент: «60% Бразилия, Серрадо · Жёлтый бурбон · натуральная» */
export const blendLines = (b: BeanLike) => (b.parts ?? []).map((p) => ({
  share: p.share ? `${p.share}%` : '',
  text: [[p.country, p.region, p.farm].filter(Boolean).join(', '), p.variety, p.process].filter(Boolean).join(' · ') || 'не указано',
}));

/** Подпись «дней после обжарки» и подсказка про отдых зерна */
export function RestBadge({ roastDate }: { roastDate: string }) {
  const d = daysSince(roastDate);
  if (d === null) return null;
  const state = d < 5 ? 'young' : d <= 35 ? 'ready' : 'old';
  const label = d === 0 ? 'обжарен сегодня' : `${d} дн. после обжарки`;
  return <span className={`tag tag-rest-${state}`} title={state === 'young' ? 'Зерну стоит отдохнуть' : state === 'old' ? 'Вкус может угасать' : 'Хорошее окно'}>{label}</span>;
}

export const PROCESSES = ['Мытая', 'Натуральная', 'Хани', 'Анаэробная', 'Карбоническая мацерация', 'Wet-hulled', 'Экспериментальная'];
export const ROAST_LEVELS = ['Светлая', 'Омни', 'Средняя', 'Тёмная'];
