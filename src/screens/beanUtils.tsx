import { daysSince, type Bean, type Brew, type DripItem } from '../data/store';
import { N_, tr, trValue } from '../i18n';

type BeanLike = Partial<Pick<Bean, 'name' | 'country' | 'region' | 'farm' | 'process' | 'variety' | 'isBlend' | 'parts' | 'kind' | 'assorted' | 'drips'>>;

const isBlend = (b: BeanLike) => !!b.isBlend;
/** a country or process stored in Russian, shown in the app's language */
const v = (s?: string) => (s ? trValue(s) : s);

/** "Бразилия 60% · Эфиопия 40%" */
export const blendSummary = (b: BeanLike) =>
  (b.parts ?? []).map((p) => [v(p.country) || tr('компонент'), p.share && `${p.share}%`].filter(Boolean).join(' ')).join(' · ');

export const beanTitle = (b?: BeanLike | null) => (b
  ? b.name || (b.kind === 'drip' && b.assorted ? tr('Дрипы ассорти') : isBlend(b) ? tr('Бленд {0}', blendSummary(b)).trim() : [v(b.country), b.region].filter(Boolean).join(', ')) || (b.kind === 'drip' ? tr('Дрип-пакеты') : tr('Без названия'))
  : tr('Без зерна'));

/** Name of one drip from an assorted box */
export const dripTitle = (d: Partial<DripItem>) => d.name || [v(d.country), d.region].filter(Boolean).join(', ') || tr('Дрип');
export const dripMeta = (d: Partial<DripItem>) => [[v(d.country), d.region, d.farm].filter(Boolean).join(' · '), v(d.process)].filter(Boolean).join(' · ');

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
  ? tr('Ассорти · {0} {1}', (b.drips ?? []).length, (b.drips ?? []).length === 1 ? tr('вид') : (b.drips ?? []).length < 5 ? tr('вида') : tr('видов'))
  : isBlend(b)
  ? [tr('Бленд'), blendSummary(b)].filter(Boolean).join(': ')
  : [v(b.country), b.region, b.farm].filter(Boolean).join(' · ');

/** Origin + process — a short caption under the name */
export const beanMeta = (b: BeanLike) => isBlend(b) || (b.kind === 'drip' && b.assorted)
  ? beanOrigin(b)
  : [beanOrigin(b), v(b.process)].filter(Boolean).join(' · ');

/** Detailed composition, one line per component: "60% Бразилия, Серрадо · Жёлтый бурбон · натуральная" */
export const blendLines = (b: BeanLike) => (b.parts ?? []).map((p) => ({
  share: p.share ? `${p.share}%` : '',
  text: [[v(p.country), p.region, p.farm].filter(Boolean).join(', '), p.variety, v(p.process)].filter(Boolean).join(' · ') || tr('не указано'),
}));

/** "Days after roast" label and a hint about resting the beans; a finished pack keeps the age it was finished at */
export function RestBadge({ roastDate, until }: { roastDate: string; until?: number | null }) {
  const d = daysSince(roastDate, until ?? undefined);
  if (d === null) return null;
  const state = d < 5 ? 'young' : d <= 35 ? 'ready' : 'old';
  const label = d === 0 ? tr('обжарен сегодня') : tr('{0} дн. после обжарки', d);
  if (until) return <span className="tag tag-rest-done" title={tr('Столько дней прошло после обжарки, когда пачка закончилась')}>{label}</span>;
  return <span className={`tag tag-rest-${state}`} title={state === 'young' ? tr('Зерну стоит отдохнуть') : state === 'old' ? tr('Вкус может угасать') : tr('Хорошее окно')}>{label}</span>;
}

// not in the list — the user types their process in the "Своя обработка" field
export const PROCESSES = [N_('Мытая'), N_('Натуральная'), N_('Хани'), N_('Анаэробная'), N_('Углекислая мацерация'), 'Wet-hulled'];
export const ROAST_LEVELS = [N_('Светлая'), N_('Омни'), N_('Средняя'), N_('Тёмная')];
