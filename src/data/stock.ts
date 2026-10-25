import type { Bean, Brew } from './store';
import { brewBeanIds, gramsFromBean } from './cva';

export interface Stock {
  /** вес пачки, г (0 — не указан) */
  total: number;
  /** списано заварками */
  used: number;
  /** осталось с учётом ручной поправки */
  left: number;
  /** доля оставшегося 0..1 */
  ratio: number;
  /** примерно на сколько заварок хватит (по средней дозе с этой пачки) */
  brewsLeft: number | null;
  /** сколько раз заваривали */
  brewCount: number;
}

const num = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function beanStock(bean: Bean, brews: Brew[]): Stock {
  // каппинг: доза × чашки по каждому образцу этой пачки
  const mine = brews.filter((b) => brewBeanIds(b).includes(bean.id));
  const used = mine.reduce((s, b) => s + gramsFromBean(b, bean.id), 0);
  const total = num(bean.weight);
  const left = total ? Math.max(0, Math.round((total - used + (bean.adjust ?? 0)) * 10) / 10) : 0;
  const avgDose = mine.length ? used / mine.length : 0;
  return {
    total, used, left,
    ratio: total ? Math.min(1, left / total) : 0,
    brewsLeft: total && avgDose ? Math.floor(left / avgDose) : null,
    brewCount: mine.length,
  };
}

/** Пачка закончилась: отмечена вручную или вес кончился */
export const isFinished = (bean: Bean, st: Stock) => !!bean.finished || (st.total > 0 && st.left <= 0);

export const PACK_SIZES = ['100', '200', '250', '500', '1000'];
