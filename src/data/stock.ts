import type { Bean, Brew } from './store';
import { brewBeanIds, gramsFromBean } from './cva';

export interface Stock {
  /** g — граммы зерна, pcs — дрип-пакеты, штуки */
  unit: 'g' | 'pcs';
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

/** Дрипов в коробке: у ассорти — сумма по видам */
export const dripTotal = (bean: Bean) => (bean.assorted ? (bean.drips ?? []).reduce((s, d) => s + (d.count || 0), 0) : bean.dripCount ?? 0);

export function beanStock(bean: Bean, brews: Brew[]): Stock {
  if (bean.kind === 'drip') {
    // одна заварка — один дрип
    const mine = brews.filter((b) => b.beanId === bean.id);
    const total = dripTotal(bean);
    const used = mine.length;
    const left = total ? Math.max(0, total - used + (bean.adjust ?? 0)) : 0;
    return { unit: 'pcs', total, used, left, ratio: total ? Math.min(1, left / total) : 0, brewsLeft: total ? left : null, brewCount: used };
  }
  // каппинг: доза × чашки по каждому образцу этой пачки
  const mine = brews.filter((b) => brewBeanIds(b).includes(bean.id));
  const used = mine.reduce((s, b) => s + gramsFromBean(b, bean.id), 0);
  const total = num(bean.weight);
  const left = total ? Math.max(0, Math.round((total - used + (bean.adjust ?? 0)) * 10) / 10) : 0;
  const avgDose = mine.length ? used / mine.length : 0;
  return {
    unit: 'g', total, used, left,
    ratio: total ? Math.min(1, left / total) : 0,
    brewsLeft: total && avgDose ? Math.floor(left / avgDose) : null,
    brewCount: mine.length,
  };
}

/** Пачка закончилась: отмечена вручную или вес кончился */
export const isFinished = (bean: Bean, st: Stock) => !!bean.finished || (st.total > 0 && st.left <= 0);

/** Остаток одного вида дрипа в коробке-ассорти */
export function dripItemLeft(bean: Bean, itemId: string, brews: Brew[]) {
  const item = bean.drips?.find((d) => d.id === itemId);
  if (!item) return 0;
  return Math.max(0, (item.count || 0) - brews.filter((b) => b.beanId === bean.id && b.dripId === itemId).length);
}

export const DRIP_COUNTS = [1, 5, 6, 8, 10, 12, 15, 20];

export const PACK_SIZES = ['100', '200', '250', '500', '1000'];
