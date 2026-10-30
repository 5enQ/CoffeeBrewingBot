import { daysSince, type Bean, type Brew, type DripItem } from '../data/store';

type BeanLike = Partial<Pick<Bean, 'name' | 'country' | 'region' | 'farm' | 'process' | 'variety' | 'isBlend' | 'parts' | 'kind' | 'assorted' | 'drips'>>;

const isBlend = (b: BeanLike) => !!b.isBlend;

/** "Бразилия 60% · Эфиопия 40%" */
export const blendSummary = (b: BeanLike) =>
  (b.parts ?? []).map((p) => [p.country || 'компонент', p.share && `${p.share}%`].filter(Boolean).join(' ')).join(' · ');

export const beanTitle = (b?: BeanLike | null) => (b
  ? b.name || (b.kind === 'drip' && b.assorted ? 'Дрипы ассорти' : isBlend(b) ? `Бленд ${blendSummary(b)}`.trim() : [b.country, b.region].filter(Boolean).join(', ')) || (b.kind === 'drip' ? 'Дрип-пакеты' : 'Без названия')
  : 'Без зерна');

/** Name of one drip from an assorted box */
export const dripTitle = (d: Partial<DripItem>) => d.name || [d.country, d.region].filter(Boolean).join(', ') || 'Дрип';
export const dripMeta = (d: Partial<DripItem>) => [[d.country, d.region, d.farm].filter(Boolean).join(' · '), d.process].filter(Boolean).join(' · ');

/** What was brewed: "Гуджи Шакисо", or "Кения Ньери · Ассорти от Х" for a drip from an assorted box */
export function brewBeanTitle(brew: Pick<Brew, 'beanId' | 'dripId'>, bean?: Bean | null) {
  if (!bean) return beanTitle(null);
  const item = brew.dripId ? bean.drips?.find((d) => d.id === brew.dripId) : undefined;
  return item ? `${dripTitle(item)} · ${beanTitle(bean)}` : beanTitle(bean);
}

/** An assorted drip as a "pack" — for a recipe sent to a friend */
export function dripAsBean(bean: Bean, dripId?: string): Bean {
  const item = dripId ? bean.drips?.find((d) => d.id === dripId) : undefined;
  if (!item) return bean;
  return { ...bean, name: dripTitle(item), country: item.country, region: item.region, farm: item.farm, variety: item.variety,
    process: item.process, roastLevel: item.roastLevel || bean.roastLevel, packNotes: item.notes || bean.packNotes, isBlend: false, parts: undefined };
}

/** Origin: country · region · farm for a single origin, the composition for a blend */
export const beanOrigin = (b: BeanLike) => b.kind === 'drip' && b.assorted
  ? `Ассорти · ${(b.drips ?? []).length} ${(b.drips ?? []).length === 1 ? 'вид' : (b.drips ?? []).length < 5 ? 'вида' : 'видов'}`
  : isBlend(b)
  ? ['Бленд', blendSummary(b)].filter(Boolean).join(': ')
  : [b.country, b.region, b.farm].filter(Boolean).join(' · ');

/** Origin + process — a short caption under the name */
export const beanMeta = (b: BeanLike) => isBlend(b) || (b.kind === 'drip' && b.assorted)
  ? beanOrigin(b)
  : [beanOrigin(b), b.process].filter(Boolean).join(' · ');

/** Detailed composition, one line per component: "60% Бразилия, Серрадо · Жёлтый бурбон · натуральная" */
export const blendLines = (b: BeanLike) => (b.parts ?? []).map((p) => ({
  share: p.share ? `${p.share}%` : '',
  text: [[p.country, p.region, p.farm].filter(Boolean).join(', '), p.variety, p.process].filter(Boolean).join(' · ') || 'не указано',
}));

/** "Days after roast" label and a hint about resting the beans */
export function RestBadge({ roastDate }: { roastDate: string }) {
  const d = daysSince(roastDate);
  if (d === null) return null;
  const state = d < 5 ? 'young' : d <= 35 ? 'ready' : 'old';
  const label = d === 0 ? 'обжарен сегодня' : `${d} дн. после обжарки`;
  return <span className={`tag tag-rest-${state}`} title={state === 'young' ? 'Зерну стоит отдохнуть' : state === 'old' ? 'Вкус может угасать' : 'Хорошее окно'}>{label}</span>;
}

// not in the list — the user types their process in the "Своя обработка" field
export const PROCESSES = ['Мытая', 'Натуральная', 'Хани', 'Анаэробная', 'Углекислая мацерация', 'Wet-hulled'];
export const ROAST_LEVELS = ['Светлая', 'Омни', 'Средняя', 'Тёмная'];
