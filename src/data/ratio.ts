/**
 * Coffee, water and ratio are tied by one rule: water = coffee × ratio.
 * One of them is locked (ratio by default); editing either of the other two adjusts the third.
 *   lock coffee: water → ratio,  ratio → water
 *   lock water:  coffee → ratio, ratio → coffee
 *   lock ratio:  coffee → water, water → coffee
 * The state is kept as dose + ratio (water is derived), so a locked water is held through the ratio.
 */
export type Lock = 'dose' | 'water' | 'ratio';
export type Field = Lock;

export interface Mix { dose: number; ratio: number }

const round = (v: number, step: number) => Math.round(v / step) * step;
const fix = (v: number) => Number(v.toFixed(4));

/**
 * New dose and ratio after `field` was set to `value`.
 * doseStep — how finely a computed dose is rounded; water — the current water (what a water lock holds).
 * Editing the locked field itself is refused (null).
 */
export function solve(cur: Mix, field: Field, value: number, lock: Lock, doseStep = 0.1): Mix | null {
  if (field === lock) return null;
  const water = cur.dose * cur.ratio;
  if (field === 'dose') {
    if (value <= 0) return null;
    // ratio locked: water follows; water locked: the ratio changes to keep it
    return lock === 'ratio' ? { dose: value, ratio: cur.ratio } : { dose: value, ratio: fix(water / value) };
  }
  if (field === 'water') {
    if (value <= 0) return null;
    if (lock === 'dose') return { dose: cur.dose, ratio: fix(value / cur.dose) };
    // ratio locked: the dose follows (rounded to the dose step); the ratio stays exactly as set
    return { dose: Math.max(doseStep, fix(round(value / cur.ratio, doseStep))), ratio: cur.ratio };
  }
  // field === 'ratio'
  if (value <= 0) return null;
  if (lock === 'dose') return { dose: cur.dose, ratio: value };
  // water locked: the dose follows; the ratio is recomputed from the rounded dose so the water stays put
  const dose = Math.max(doseStep, fix(round(water / value, doseStep)));
  return { dose, ratio: fix(water / dose) };
}

const KEY = 'brewbook.locks';
/** the lock is remembered per method on this device */
export function loadLock(methodId: string): Lock {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}')[methodId]; return v === 'dose' || v === 'water' ? v : 'ratio'; } catch { return 'ratio'; }
}
export function saveLock(methodId: string, lock: Lock) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[methodId] = lock; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* no storage */ }
}

export const LOCKED_TEXT: Record<Lock, string> = { dose: 'Кофе закреплён', water: 'Вода закреплена', ratio: 'Пропорция закреплена' };
