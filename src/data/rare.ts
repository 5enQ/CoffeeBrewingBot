/**
 * Rare lots: brewing one opens a card background. The tag is worked out on the device from the pack
 * (country, variety — of the lot or of any part of a blend) and sent to the server with the brew;
 * the server counts it like any brew (same limits), so a background appears on a shared card only when counted.
 */
export const RARE = [
  { id: 'japan', label: 'Япония', title: 'Ферма у горы' },
  { id: 'eugenioides', label: 'Эужениоидис', title: 'Озеро Киву' },
  { id: 'liberica', label: 'Либерика', title: 'Закат в Либерии' },
] as const;
export type RareId = typeof RARE[number]['id'];
export const RARE_IDS: readonly string[] = RARE.map((r) => r.id);

const low = (s?: string) => (s ?? '').toLowerCase().replace(/ё/g, 'е');

/** what a coffee (country, variety) counts as; Excelsa is a Liberica (Coffea liberica var. dewevrei) */
export function rareOf(country?: string, variety?: string): RareId[] {
  const c = low(country), v = low(variety), out: RareId[] = [];
  if (/япони|japan|окинав|okinawa|огасавар|ogasawara/.test(c)) out.push('japan');
  if (/eugenioides|эужени|эугени|евгениоид/.test(v)) out.push('eugenioides');
  if (/liberica|либерик|excelsa|эксцельс|экселс|dewevrei|barako|барако/.test(v)) out.push('liberica');
  return out;
}

/** the tags of a pack: the lot itself and every part of a blend */
export function rareOfBean(bean?: { country?: string; variety?: string; parts?: { country?: string; variety?: string }[] } | null): RareId[] {
  if (!bean) return [];
  const all = [bean, ...(bean.parts ?? [])].flatMap((p) => rareOf(p.country, p.variety));
  return [...new Set(all)];
}
