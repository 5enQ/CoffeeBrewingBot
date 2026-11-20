import { N_, tr } from '../i18n';
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
  { key: 'fragrance', label: tr('Аромат'), hint: tr('Сухой и влажный аромат'), intensity: [tr('сухой'), tr('влажный')] },
  { key: 'flavor', label: tr('Вкус'), hint: tr('Вкус и ретроназальный аромат') },
  { key: 'aftertaste', label: tr('Послевкусие'), hint: tr('Длина и приятность') },
  { key: 'acidity', label: tr('Кислотность'), hint: tr('Качество кислотности'), intensity: [tr('низкая'), tr('высокая')] },
  { key: 'body', label: tr('Тело'), hint: tr('Тактильность, плотность'), intensity: [tr('лёгкое'), tr('плотное')] },
  { key: 'balance', label: tr('Баланс'), hint: tr('Как сочетаются вкус, кислотность и тело') },
  { key: 'overall', label: tr('Общее'), hint: tr('Личная оценка каппера') },
];

export type CupKey = 'uniformity' | 'cleanCup' | 'sweetness';
export const CUP_ATTRS: { key: CupKey; label: string; hint: string }[] = [
  { key: 'uniformity', label: tr('Однородность'), hint: tr('Отметьте чашки без отклонений') },
  { key: 'cleanCup', label: tr('Чистота'), hint: tr('Отметьте чашки без посторонних привкусов') },
  { key: 'sweetness', label: tr('Сладость'), hint: tr('Отметьте сладкие чашки') },
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
  return tr('Ниже спешелти');
}

/** Simplified SCA flavor wheel */
export const FLAVOR_WHEEL: { group: string; tone: string; items: string[] }[] = [
  { group: tr('Фруктовые'), tone: 'fruit', items: [N_('клубника'), N_('малина'), N_('черника'), N_('ежевика'), N_('вишня'), N_('гранат'), N_('виноград'), N_('яблоко'), N_('груша'), N_('персик'), N_('ананас'), N_('изюм'), N_('чернослив'), N_('кокос')] },
  { group: tr('Цитрусовые'), tone: 'citrus', items: [N_('грейпфрут'), N_('апельсин'), N_('лимон'), N_('лайм'), N_('бергамот')] },
  { group: tr('Цветочные'), tone: 'floral', items: [N_('жасмин'), N_('роза'), N_('ромашка'), N_('чёрный чай')] },
  { group: tr('Сладкие'), tone: 'sweet', items: [N_('карамель'), N_('мёд'), N_('коричневый сахар'), N_('кленовый сироп'), N_('патока'), N_('ваниль')] },
  { group: tr('Орехи и какао'), tone: 'nut', items: [N_('фундук'), N_('миндаль'), N_('арахис'), N_('молочный шоколад'), N_('тёмный шоколад'), N_('какао')] },
  { group: tr('Пряные'), tone: 'spice', items: [N_('корица'), N_('гвоздика'), N_('мускатный орех'), N_('анис'), N_('перец')] },
  { group: tr('Ферментация'), tone: 'ferment', items: [N_('винный'), N_('ромовый'), N_('виски'), N_('перезрелый'), N_('йогурт'), N_('уксусный')] },
  { group: tr('Зелёные'), tone: 'green', items: [N_('травяной'), N_('сено'), N_('зелёный горошек'), N_('свежие овощи'), N_('оливковое масло')] },
  { group: tr('Обжарочные'), tone: 'roast', items: [N_('злаки'), N_('солод'), N_('хлебная корка'), N_('табак'), N_('дымный'), N_('жжёный')] },
  { group: tr('Дефекты'), tone: 'defect', items: [N_('бумажный'), N_('картонный'), N_('затхлый'), N_('землистый'), N_('резиновый'), N_('лекарственный')] },
];

export const toneOf = (descriptor: string) =>
  FLAVOR_WHEEL.find((g) => g.items.includes(descriptor))?.tone ?? 'other';
