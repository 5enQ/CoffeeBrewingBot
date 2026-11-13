/** Russian plural: 1 заварка, 2 заварки, 5 заварок (11–14 take the last form) */
export const plural = (n: number, f: readonly [string, string, string]) => {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};
export const BREWS = ['заварка', 'заварки', 'заварок'] as const;
export const PACKS = ['пачка', 'пачки', 'пачек'] as const;
/** a grinder, a kettle, scales — devices */
export const DEVICES = ['устройство', 'устройства', 'устройств'] as const;
export const LOTS = ['лот', 'лота', 'лотов'] as const;
