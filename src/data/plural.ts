import { getLocale, tr } from '../i18n';
/** Russian plural: 1 заварка, 2 заварки, 5 заварок (11–14 take the last form) */
export const plural = (n: number, f: readonly [string, string, string]) => {
  // English: one and the rest (the forms come through tr(): 'brew', 'brews', 'brews')
  if (getLocale() !== 'ru') return Math.abs(n) === 1 ? f[0] : f[2];
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2];
};
export const BREWS = [tr('заварка'), tr('заварки'), tr('заварок')] as const;
export const PACKS = [tr('пачка'), tr('пачки'), tr('пачек')] as const;
/** a grinder, a kettle, scales — devices */
export const DEVICES = [tr('устройство'), tr('устройства'), tr('устройств')] as const;
export const LOTS = [tr('лот'), tr('лота'), tr('лотов')] as const;
