/** Classic SCA form (100 points) */

export interface CuppingAttr {
  key: QualityKey;
  label: string;
  hint: string;
  /** whether there is an intensity scale (low — high) */
  intensity?: [string, string];
}

export type QualityKey =
  | 'fragrance' | 'flavor' | 'aftertaste' | 'acidity' | 'body' | 'balance' | 'overall';

export const QUALITY: CuppingAttr[] = [
  { key: 'fragrance', label: 'Аромат', hint: 'Сухой и влажный аромат', intensity: ['сухой', 'влажный'] },
  { key: 'flavor', label: 'Вкус', hint: 'Вкус и ретроназальный аромат' },
  { key: 'aftertaste', label: 'Послевкусие', hint: 'Длина и приятность' },
  { key: 'acidity', label: 'Кислотность', hint: 'Качество кислотности', intensity: ['низкая', 'высокая'] },
  { key: 'body', label: 'Тело', hint: 'Тактильность, плотность', intensity: ['лёгкое', 'плотное'] },
  { key: 'balance', label: 'Баланс', hint: 'Как сочетаются вкус, кислотность и тело' },
  { key: 'overall', label: 'Общее', hint: 'Личная оценка каппера' },
];

export type CupKey = 'uniformity' | 'cleanCup' | 'sweetness';
export const CUP_ATTRS: { key: CupKey; label: string; hint: string }[] = [
  { key: 'uniformity', label: 'Однородность', hint: 'Отметьте чашки без отклонений' },
  { key: 'cleanCup', label: 'Чистота', hint: 'Отметьте чашки без посторонних привкусов' },
  { key: 'sweetness', label: 'Сладость', hint: 'Отметьте сладкие чашки' },
];

export interface Cupping {
  scores: Record<QualityKey, number>;
  intensity: Partial<Record<QualityKey, [number, number] | number>>;
  cups: Record<CupKey, boolean[]>;
  defects: { taintCups: number; faultCups: number };
  descriptors: string[];
  roastColor?: string;
  notes: string;
}

export const SCORE_MIN = 6;
export const SCORE_MAX = 10;
export const SCORE_STEP = 0.25;

export function emptyCupping(): Cupping {
  const scores = Object.fromEntries(QUALITY.map((q) => [q.key, 7.5])) as Record<QualityKey, number>;
  return {
    scores,
    intensity: { fragrance: [3, 3], acidity: 3, body: 3 },
    cups: { uniformity: [true, true, true, true, true], cleanCup: [true, true, true, true, true], sweetness: [true, true, true, true, true] },
    defects: { taintCups: 0, faultCups: 0 },
    descriptors: [],
    notes: '',
  };
}

export function cupScore(c: Cupping) {
  const quality = QUALITY.reduce((s, q) => s + (c.scores[q.key] ?? 0), 0);
  const cups = CUP_ATTRS.reduce((s, a) => s + c.cups[a.key].filter(Boolean).length * 2, 0);
  const defects = c.defects.taintCups * 2 + c.defects.faultCups * 4;
  return { quality, cups, defects, total: quality + cups - defects };
}

/** SCA grade */
export function scoreGrade(total: number) {
  if (total >= 90) return 'Outstanding';
  if (total >= 85) return 'Excellent';
  if (total >= 80) return 'Very Good';
  return 'Ниже спешелти';
}

/** Simplified SCA flavor wheel */
export const FLAVOR_WHEEL: { group: string; tone: string; items: string[] }[] = [
  { group: 'Фруктовые', tone: 'fruit', items: ['клубника', 'малина', 'черника', 'ежевика', 'вишня', 'гранат', 'виноград', 'яблоко', 'груша', 'персик', 'ананас', 'изюм', 'чернослив', 'кокос'] },
  { group: 'Цитрусовые', tone: 'citrus', items: ['грейпфрут', 'апельсин', 'лимон', 'лайм', 'бергамот'] },
  { group: 'Цветочные', tone: 'floral', items: ['жасмин', 'роза', 'ромашка', 'чёрный чай'] },
  { group: 'Сладкие', tone: 'sweet', items: ['карамель', 'мёд', 'коричневый сахар', 'кленовый сироп', 'патока', 'ваниль'] },
  { group: 'Орехи и какао', tone: 'nut', items: ['фундук', 'миндаль', 'арахис', 'молочный шоколад', 'тёмный шоколад', 'какао'] },
  { group: 'Пряные', tone: 'spice', items: ['корица', 'гвоздика', 'мускатный орех', 'анис', 'перец'] },
  { group: 'Ферментация', tone: 'ferment', items: ['винный', 'ромовый', 'виски', 'перезрелый', 'йогурт', 'уксусный'] },
  { group: 'Зелёные', tone: 'green', items: ['травяной', 'сено', 'зелёный горошек', 'свежие овощи', 'оливковое масло'] },
  { group: 'Обжарочные', tone: 'roast', items: ['злаки', 'солод', 'хлебная корка', 'табак', 'дымный', 'жжёный'] },
  { group: 'Дефекты', tone: 'defect', items: ['бумажный', 'картонный', 'затхлый', 'землистый', 'резиновый', 'лекарственный'] },
];

export const toneOf = (descriptor: string) =>
  FLAVOR_WHEEL.find((g) => g.items.includes(descriptor))?.tone ?? 'other';
