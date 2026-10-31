/**
 * Extraction yield from the cup TDS (refractometer): EY % = TDS % × beverage mass / dose.
 * The beverage mass is exact when the drink was weighed (brew.beverage) or for espresso (its "water" is the yield);
 * otherwise it is estimated as water minus what the grounds keep (about 2 g of water per gram of coffee).
 * SCA "golden cup": TDS 1.15–1.35 %, extraction 18–22 %.
 */
import type { Brew } from './store';

export const GOLDEN = { tds: [1.15, 1.35], ey: [18, 22] } as const;
/** SCA water standard: total dissolved solids 75–250 ppm, target 150 */
export const WATER_PPM = { min: 75, max: 250, target: 150 } as const;

type ForEy = Pick<Brew, 'methodId' | 'water' | 'dose' | 'tds' | 'beverage'>;

/** the beverage mass is known (weighed, or espresso yield), not estimated */
export const exactMass = (b: Pick<Brew, 'methodId' | 'beverage'>) => !!b.beverage || b.methodId === 'espresso';
const RETAINED = 2;

export function beverageMass(b: Pick<Brew, 'methodId' | 'water' | 'dose' | 'beverage'>): number {
  if (b.beverage) return b.beverage;
  return b.methodId === 'espresso' ? b.water : Math.max(0, b.water - RETAINED * b.dose);
}

export function extraction(b: ForEy): number | null {
  if (!b.tds || !b.dose) return null;
  const mass = beverageMass(b);
  if (!mass) return null;
  return Math.round((b.tds * mass / b.dose) * 10) / 10;
}
