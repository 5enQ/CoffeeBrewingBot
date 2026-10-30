import type { Bean, Brew } from './store';
import { brewBeanIds, gramsFromBean } from './cva';

export interface Stock {
  /** g — grams of beans, pcs — drip bags, pieces */
  unit: 'g' | 'pcs';
  /** pack weight, g (0 — not set) */
  total: number;
  /** used by brews */
  used: number;
  /** remaining, including the manual correction */
  left: number;
  /** remaining share 0..1 */
  ratio: number;
  /** roughly how many brews are left (by the average dose from this pack) */
  brewsLeft: number | null;
  /** how many times brewed */
  brewCount: number;
}

const num = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

/** Drips in the box: the sum over kinds for an assorted box */
export const dripTotal = (bean: Bean) => (bean.assorted ? (bean.drips ?? []).reduce((s, d) => s + (d.count || 0), 0) : bean.dripCount ?? 0);

export function beanStock(bean: Bean, brews: Brew[]): Stock {
  if (bean.kind === 'drip') {
    // one brew — one drip
    const mine = brews.filter((b) => b.beanId === bean.id);
    const total = dripTotal(bean);
    const used = mine.length;
    const left = total ? Math.max(0, total - used + (bean.adjust ?? 0)) : 0;
    return { unit: 'pcs', total, used, left, ratio: total ? Math.min(1, left / total) : 0, brewsLeft: total ? left : null, brewCount: used };
  }
  // cupping: dose × cups for each sample of this pack
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

/** Pack is finished: marked manually or out of weight */
export const isFinished = (bean: Bean, st: Stock) => !!bean.finished || (st.total > 0 && st.left <= 0);

/** Remaining count of one drip kind in an assorted box */
export function dripItemLeft(bean: Bean, itemId: string, brews: Brew[]) {
  const item = bean.drips?.find((d) => d.id === itemId);
  if (!item) return 0;
  return Math.max(0, (item.count || 0) - brews.filter((b) => b.beanId === bean.id && b.dripId === itemId).length);
}

export const DRIP_COUNTS = [1, 5, 6, 8, 10, 12, 15, 20];

export const PACK_SIZES = ['100', '200', '250', '500', '1000'];
