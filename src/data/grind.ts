/**
 * Grind depending on the grinder:
 *  hand — in clicks, electronic — in microns (µm), mechanical — as before, in words or its own scale.
 */
import type { Gear } from './gear';

export type GrindType = 'manual' | 'electric' | 'mechanical';
export type GrindUnit = 'clicks' | 'um';

export const GRIND_TYPES: { id: GrindType; label: string; hint: string }[] = [
  { id: 'manual', label: 'Ручная', hint: 'Помол в щелчках' },
  { id: 'electric', label: 'Электронная', hint: 'Помол в микронах, µm' },
  { id: 'mechanical', label: 'Механическая', hint: 'Помол словами или по своей шкале' },
];

/** Popular hand grinders — the type is set automatically when picking a model from suggestions */
const MANUAL = /comandante|1zpresso|timemore\s*(c\d|chestnut|nano|g1|slim)|kinu|kingrinder|hario|porlex|lido|pietro|mazzer\s*omega|knock|hand\s*ground|ручн/i;
export const guessGrindType = (name: string): GrindType | undefined => (MANUAL.test(name) ? 'manual' : undefined);

export const unitOf = (t?: GrindType): GrindUnit | null => (t === 'manual' ? 'clicks' : t === 'electric' ? 'um' : null);

export const GRIND_RULES: Record<GrindUnit, { step: number; min: number; max: number; def: number; short: string }> = {
  clicks: { step: 1, min: 0, max: 200, def: 20, short: 'щелч.' },
  um: { step: 10, min: 50, max: 2000, def: 600, short: 'µm' },
};

const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};

/** "22 щелчка", "650 µm" — how grind is stored in a brew as text and shown everywhere */
export function fmtGrind(value: number, unit: GrindUnit) {
  if (unit === 'um') return `${Math.round(value)} µm`;
  return `${value} ${plural(value, ['щелчок', 'щелчка', 'щелчков'])}`;
}

/** Type of the grinder chosen for the brew (from the gear list) */
export function grinderOf(gearRefs: { id: string; cat: string }[] | undefined, myGear: Gear[]) {
  const ref = gearRefs?.find((g) => g.cat === 'grinder');
  if (!ref) return null;
  const g = myGear.find((x) => x.id === ref.id);
  return { id: ref.id, type: g?.grindType, loss: g?.loss && g.loss > 0 ? g.loss : 0 };
}

/**
 * Grinder "mileage": coffee ground on it over all brews where it was used.
 * Counts what went through the burrs — the dose plus the grinder's loss (fromPack); cupping — every cup of every sample.
 * Drips (pre-ground) and sample brews are not counted.
 */
export function grinderMileage(grinderId: string, brews: { gear?: { id: string }[]; methodId: string; sample?: boolean; dose: number; fromPack?: number; cva?: { cups: number; samples: unknown[] } | null }[]) {
  let grams = 0, count = 0;
  for (const b of brews) {
    if (b.sample || b.methodId === 'drip' || !b.gear?.some((g) => g.id === grinderId)) continue;
    grams += b.cva ? b.cva.cups * b.cva.samples.length * b.dose : b.fromPack ?? b.dose ?? 0;
    count++;
  }
  return { grams: Math.round(grams), count };
}

/** "850 г", "12,4 кг" */
export const fmtMass = (g: number) => (g < 1000 ? `${g} г` : `${(Math.round(g / 100) / 10).toLocaleString('ru-RU')} кг`);
