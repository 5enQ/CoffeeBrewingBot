/**
 * Roaster coffee profile: 1–5 scales as shown on sites and packs
 * (dots at Submarine, words "Низкая / Средняя / Высокая" at Kojo).
 * Not given — the field is not stored at all.
 */
export type ScaleKey = 'acidity' | 'sweetness' | 'bitterness' | 'body' | 'ferment';
export type Scales = Partial<Record<ScaleKey, number>>;

export const SCALES: { key: ScaleKey; label: string; aliases: string[] }[] = [
  { key: 'acidity', label: 'Кислотность', aliases: ['кислотность', 'кислинка'] },
  { key: 'sweetness', label: 'Сладость', aliases: ['сладость'] },
  { key: 'bitterness', label: 'Горечь', aliases: ['горечь', 'горчинка'] },
  { key: 'body', label: 'Плотность', aliases: ['плотность', 'тело', 'насыщенность'] },
  { key: 'ferment', label: 'Ферментация', aliases: ['фермент', 'ферментация', 'ферментированность'] },
];

/** Scale label on a site → key */
export function scaleKeyOf(label: string): ScaleKey | null {
  const l = label.trim().toLowerCase().replace(/[:\s]+$/, '');
  return SCALES.find((s) => s.aliases.includes(l))?.key ?? null;
}

const WORDS: [RegExp, number][] = [
  [/^(очень\s+низк|минимальн|отсутств|нет)/, 1],
  [/^(ниже\s+средн|невысок|слаб|лёгк|легк)/, 2],
  [/^(средн|умеренн)/, 3],
  [/^(выше\s+средн|заметн|плотн|насыщенн|густ)/, 4],
  [/^(очень\s+высок|высок|ярк|сильн|максимальн)/, 5],
  [/^низк/, 1],
];
const CLASS_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/**
 * Scale value from a site → 1–5. Understands numbers ("3", "3/5", "3 из 5"),
 * words ("Высокая", "ниже средней") and dot classes (one…five).
 */
export function scaleValueOf(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (CLASS_NUM[v]) return CLASS_NUM[v];
  const m = v.match(/^(\d+(?:[.,]\d+)?)\s*(?:\/|из)\s*(\d+)$/);
  if (m) return clamp(Math.round((parseFloat(m[1].replace(',', '.')) / parseFloat(m[2])) * 5));
  if (/^\d+$/.test(v)) return clamp(Number(v));
  for (const [re, n] of WORDS) if (re.test(v)) return n;
  return null;
}
const clamp = (n: number) => (n >= 1 && n <= 5 ? n : null);

export const hasScales = (s?: Scales) => !!s && SCALES.some((x) => s[x.key]);
