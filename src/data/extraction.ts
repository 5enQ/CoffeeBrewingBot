/**
 * Extraction yield from the cup TDS (refractometer): EY % = TDS % × beverage mass / dose.
 * The beverage is weighed for espresso (its "water" is the yield); for other methods it is estimated
 * as water minus what the grounds keep (about 2 g of water per gram of coffee), so the result is approximate.
 * SCA "golden cup": TDS 1.15–1.35 %, extraction 18–22 %.
 */
import type { Brew } from './store';

export const GOLDEN = { tds: [1.15, 1.35], ey: [18, 22] } as const;
const RETAINED = 2;

export function beverageMass(b: Pick<Brew, 'methodId' | 'water' | 'dose'>): number {
  return b.methodId === 'espresso' ? b.water : Math.max(0, b.water - RETAINED * b.dose);
}

export function extraction(b: Pick<Brew, 'methodId' | 'water' | 'dose' | 'tds'>): number | null {
  if (!b.tds || !b.dose) return null;
  const mass = beverageMass(b);
  if (!mass) return null;
  return Math.round((b.tds * mass / b.dose) * 10) / 10;
}
