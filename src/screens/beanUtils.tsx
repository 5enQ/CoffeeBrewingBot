import { daysSince, type Bean } from '../data/store';

export const beanTitle = (b?: Bean | null) => (b ? b.name || [b.country, b.region].filter(Boolean).join(', ') || 'Без названия' : 'Без зерна');

export const beanOrigin = (b: Bean) => [b.country, b.region, b.farm].filter(Boolean).join(' · ');

/** Подпись «дней после обжарки» и подсказка про отдых зерна */
export function RestBadge({ roastDate }: { roastDate: string }) {
  const d = daysSince(roastDate);
  if (d === null) return null;
  const state = d < 5 ? 'young' : d <= 35 ? 'ready' : 'old';
  const label = d === 0 ? 'обжарен сегодня' : `${d} дн. после обжарки`;
  return <span className={`tag tag-rest-${state}`} title={state === 'young' ? 'Зерну стоит отдохнуть' : state === 'old' ? 'Вкус может угасать' : 'Хорошее окно'}>{label}</span>;
}

export const PROCESSES = ['Мытая', 'Натуральная', 'Хани', 'Анаэробная', 'Карбоническая мацерация', 'Wet-hulled', 'Экспериментальная'];
export const ROAST_LEVELS = ['Светлая (фильтр)', 'Омни', 'Средняя', 'Тёмная (эспрессо)'];
