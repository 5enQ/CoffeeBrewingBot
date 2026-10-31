/**
 * SCA Coffee Value Assessment (CVA), standards 2024–2025:
 *  102 — sample preparation and cupping mechanics,
 *  103 — descriptive assessment,
 *  104 — affective assessment (score),
 *  105 — extrinsic assessment.
 * Replaces the SCA 2004 cupping protocol.
 */
import type { Bean, Brew } from './store';
import type { Cupping } from './cupping';
import { cupScore } from './cupping';

/* ---------- 102: preparation protocol (fixed) ---------- */

export const PROTOCOL = {
  gramsPer150: 8.25,        // 8.25 g of coffee per 150 ml of cup volume
  doseTolerance: 0.2,       // ±0.2 g
  waterTemp: 93,            // 93 ± 3 °C
  waterTempTolerance: 3,
  cupMin: 200,              // 200–350 ml cups, glass or ceramic, 75–90 mm diameter
  cupMax: 350,
  cupsAffective: 5,         // affective: 5 cups per sample
  cupsDescriptiveMin: 3,    // descriptive: 3–5 cups
  cupsDescriptiveMax: 5,
  maxSamples: 6,            // at most 6 samples per session
  crustMin: 3,              // leave the crust for 3–5 minutes
  crustMax: 5,
  liquorTemp: 70,           // tasting starts at about 70 °C
  minRounds: 3,             // at least three rounds
};

export const CUP_VOLUMES = [200, 220, 250, 300, 350];

/** Dose per cup by brim volume: 8.25 g per 150 ml, rounded to 0.1 g */
export const dosePerCup = (volumeMl: number) => Math.round((volumeMl * PROTOCOL.gramsPer150) / 150 * 10) / 10;

/** Preparation rules — shown as locked parameters */
export const PROTOCOL_RULES: { label: string; value: string; hint?: string }[] = [
  { label: 'Соотношение', value: '8,25 г на 150 мл', hint: 'Доза считается от объёма чашки до края, точность весов 0,1 г, допуск ±0,2 г' },
  { label: 'Вода', value: '93 ± 3 °C', hint: 'Лить до края, создавая лёгкую турбулентность' },
  { label: 'Помол', value: '70–75 % проходит сито 850 мкм', hint: '20 US mesh — чуть крупнее, чем для фильтра. Каждую чашку молоть отдельно, мельницу прочищать новым образцом' },
  { label: 'Обжарка', value: 'Средняя · Agtron 63', hint: 'Agtron «Gourmet» 63, CIELAB L* 26–29, плитка Agtron/SCA №65. Без недоразвитости, подгорания и «запечённости»' },
  { label: 'Отдых', value: '8–24 ч после обжарки', hint: 'Остывание воздухом до ~20 °C, хранение герметично, в прохладном тёмном месте' },
  { label: 'Чашки', value: '200–350 мл', hint: 'Стекло или керамика, диаметр 75–90 мм, все одинаковые' },
  { label: 'Состав воды', value: 'без хлора · pH 6–8', hint: 'Кальциевая жёсткость 50–175 ppm CaCO₃, щёлочность около 40–70 ppm CaCO₃' },
  { label: 'Сессия', value: 'до 6 образцов', hint: 'Все образцы завариваются и оцениваются параллельно' },
];

/* ---------- Assessment mode ---------- */

export type CvaMode = 'affective' | 'descriptive' | 'combined';
export const MODES: { id: CvaMode; label: string; hint: string }[] = [
  { id: 'affective', label: 'Аффективная', hint: 'Впечатление о качестве 1–9 и итоговый балл (SCA 104). 5 чашек на образец' },
  { id: 'descriptive', label: 'Дескриптивная', hint: 'Интенсивность 0–15 и дескрипторы, без балла (SCA 103). 3–5 чашек' },
  { id: 'combined', label: 'Обе', hint: 'Обе формы параллельно, раздел за разделом. 5 чашек' },
];
export const cupsFor = (mode: CvaMode, wanted?: number) =>
  mode === 'descriptive' ? Math.min(PROTOCOL.cupsDescriptiveMax, Math.max(PROTOCOL.cupsDescriptiveMin, wanted ?? 5)) : PROTOCOL.cupsAffective;
export const hasAffective = (m: CvaMode) => m !== 'descriptive';
export const hasDescriptive = (m: CvaMode) => m !== 'affective';

/* ---------- 104: affective assessment ---------- */

export type AffKey = 'fragrance' | 'aroma' | 'flavor' | 'aftertaste' | 'acidity' | 'sweetness' | 'mouthfeel' | 'overall';

export const AFF_SECTIONS: { key: AffKey; label: string; step: 1 | 2 | 3; hint: string }[] = [
  { key: 'fragrance', label: 'Сухой аромат', step: 1, hint: 'Запах молотого кофе до заливки (fragrance)' },
  { key: 'aroma', label: 'Аромат', step: 2, hint: 'Запах настоя: нетронутая корочка и её разбивание (aroma)' },
  { key: 'flavor', label: 'Вкус', step: 3, hint: 'Вкус и ретроназальный аромат, пока настой во рту (flavor)' },
  { key: 'aftertaste', label: 'Послевкусие', step: 3, hint: 'Что остаётся после того, как кофе сплюнули или проглотили' },
  { key: 'acidity', label: 'Кислотность', step: 3, hint: 'Восприятие кислого вкуса' },
  { key: 'sweetness', label: 'Сладость', step: 3, hint: 'Вкусовая и ретроназальная сладость' },
  { key: 'mouthfeel', label: 'Тактильность', step: 3, hint: 'Плотность, текстура, вяжущесть (mouthfeel)' },
  { key: 'overall', label: 'Общее', step: 3, hint: 'Целостное впечатление, в т. ч. баланс и личное предпочтение' },
];

/** "Impression of quality" scale, 1–9 (center 5 — neither high nor low) */
export const IMPRESSION: Record<number, string> = {
  1: 'Крайне низкое', 2: 'Очень низкое', 3: 'Умеренно низкое', 4: 'Слегка низкое', 5: 'Ни высокое, ни низкое',
  6: 'Слегка высокое', 7: 'Умеренно высокое', 8: 'Очень высокое', 9: 'Крайне высокое',
};

export type DefectType = 'moldy' | 'phenolic' | 'potato';
export const DEFECT_TYPES: { id: DefectType; label: string }[] = [
  { id: 'moldy', label: 'Плесневый' },
  { id: 'phenolic', label: 'Фенольный' },
  { id: 'potato', label: 'Картофельный' },
];

export interface Affective {
  scores: Partial<Record<AffKey, number>>;
  notes: Partial<Record<AffKey, string>>;
  /** cups 1–5: qualitatively different from the rest */
  nonUniform: boolean[];
  /** cups 1–5: defective */
  defective: boolean[];
  /** without a defect type, defective cups are not counted (104, 5.4.1) */
  defectType: DefectType | '';
}

export const emptyAffective = (cups = PROTOCOL.cupsAffective): Affective => ({
  scores: {}, notes: {}, nonUniform: Array(cups).fill(false), defective: Array(cups).fill(false), defectType: '',
});

/** Defective cups count only when a defect type is given */
export const countedDefects = (a: Affective) => (a.defectType ? a.defective.filter(Boolean).length : 0);

/**
 * Score per SCA 104, 5.5: S = 0.65625·Σh + 52.75 − 2u − 4d, rounded to 0.25.
 * u — non-uniform cups, d — defective cups (with a defect type).
 * null — until all eight sections are filled in.
 */
export function affectiveScore(a: Affective): number | null {
  const vals = AFF_SECTIONS.map((s) => a.scores[s.key]);
  if (vals.some((v) => v === undefined)) return null;
  const sum = (vals as number[]).reduce((s, v) => s + v, 0);
  const u = a.nonUniform.filter(Boolean).length;
  const d = countedDefects(a);
  const raw = 0.65625 * sum + 52.75 - 2 * u - 4 * d;
  return Math.round(raw * 4) / 4;
}

/** Every defective cup must also be marked non-uniform — except when all 5 are defective (104, 5.4.2) */
export function syncUniformity(a: Affective): Affective {
  const all = a.defective.length > 0 && a.defective.every(Boolean);
  if (all) return a;
  return { ...a, nonUniform: a.nonUniform.map((v, i) => v || a.defective[i]) };
}

/* ---------- 103: descriptive assessment ---------- */

export type DescKey = 'fragrance' | 'aroma' | 'flavor' | 'aftertaste' | 'acidity' | 'sweetness' | 'mouthfeel';
export const DESC_SECTIONS: { key: DescKey; label: string }[] = [
  { key: 'fragrance', label: 'Сухой аромат' },
  { key: 'aroma', label: 'Аромат' },
  { key: 'flavor', label: 'Вкус' },
  { key: 'aftertaste', label: 'Послевкусие' },
  { key: 'acidity', label: 'Кислотность' },
  { key: 'sweetness', label: 'Сладость' },
  { key: 'mouthfeel', label: 'Тактильность' },
];

/** Olfactory lexicon: category and refinements. Both the category and a refinement can be checked. */
export const OLFACTORY: { id: string; label: string; tone: string; children?: { id: string; label: string; tone?: string }[] }[] = [
  { id: 'floral', label: 'Цветочный', tone: 'floral' },
  { id: 'fruity', label: 'Фруктовый', tone: 'fruit', children: [{ id: 'berry', label: 'Ягодный' }, { id: 'dried-fruit', label: 'Сухофрукты' }, { id: 'citrus', label: 'Цитрусовый', tone: 'citrus' }] },
  { id: 'sour-fermented', label: 'Кислый/ферментированный', tone: 'ferment', children: [{ id: 'sour', label: 'Кислый' }, { id: 'fermented', label: 'Ферментированный' }] },
  { id: 'green', label: 'Зелёный/растительный', tone: 'green' },
  { id: 'other', label: 'Другое', tone: 'defect', children: [{ id: 'chemical', label: 'Химический' }, { id: 'musty', label: 'Затхлый/землистый' }, { id: 'woody', label: 'Древесный' }] },
  { id: 'roasted', label: 'Обжарочный', tone: 'roast', children: [{ id: 'cereal', label: 'Злаковый' }, { id: 'burnt', label: 'Жжёный' }, { id: 'tobacco', label: 'Табачный' }] },
  { id: 'nutty-cocoa', label: 'Орехи/какао', tone: 'nut', children: [{ id: 'nutty', label: 'Ореховый' }, { id: 'cocoa', label: 'Какао' }] },
  { id: 'spice', label: 'Пряный', tone: 'spice' },
  { id: 'sweet', label: 'Сладкий', tone: 'sweet', children: [{ id: 'vanilla', label: 'Ваниль/ванилин' }, { id: 'brown-sugar', label: 'Коричневый сахар' }] },
];
export const OLFACTORY_LABEL: Record<string, string> = Object.fromEntries(
  OLFACTORY.flatMap((c) => [[c.id, c.label], ...(c.children ?? []).map((x) => [x.id, x.label])]),
);
export const OLFACTORY_TONE: Record<string, string> = Object.fromEntries(
  OLFACTORY.flatMap((c) => [[c.id, c.tone], ...(c.children ?? []).map((x) => [x.id, x.tone ?? c.tone])]),
);
export const MAX_OLFACTORY = 5;

export const MAIN_TASTES = [
  { id: 'salty', label: 'Солёный', tone: 'defect' }, { id: 'sour', label: 'Кислый', tone: 'citrus' }, { id: 'sweet', label: 'Сладкий', tone: 'sweet' },
  { id: 'bitter', label: 'Горький', tone: 'roast' }, { id: 'umami', label: 'Умами', tone: 'spice' },
];
export const MAX_MAIN_TASTES = 2;

export const MOUTHFEEL_CATA = [
  { id: 'rough', label: 'Грубое', hint: 'зернистое, меловое, песчаное' },
  { id: 'oily', label: 'Маслянистое' },
  { id: 'smooth', label: 'Гладкое', hint: 'бархатистое, шелковистое, сиропистое' },
  { id: 'drying', label: 'Вяжущее', hint: 'сушит рот' },
  { id: 'metallic', label: 'Металлическое' },
];
export const MAX_MOUTHFEEL = 2;

/** Visual roast level assessment before tasting (103, 6.1a) */
export const ROAST_LEVELS = ['Очень светлая', 'Светлая', 'Средняя', 'Средне-тёмная', 'Тёмная'];

export interface Descriptive {
  roast: string;
  intensity: Partial<Record<DescKey, number>>;   // 0–15, integers
  /** fragrance (dry fragrance + aroma), up to 5 */
  olfactory: string[];
  /** flavor + aftertaste (retronasal), up to 5 */
  retronasal: string[];
  /** main tastes, up to 2 */
  mainTastes: string[];
  /** mouthfeel, up to 2 */
  mouthfeel: string[];
  /** free descriptors and notes per section (acidity and sweetness have no lists) */
  notes: Partial<Record<DescKey, string>>;
}

export const emptyDescriptive = (): Descriptive => ({
  roast: '', intensity: {}, olfactory: [], retronasal: [], mainTastes: [], mouthfeel: [], notes: {},
});

/* ---------- 105: extrinsic assessment ---------- */

export interface ExtrinsicGroup { id: 'farming' | 'processing' | 'trading' | 'certification' | 'other'; label: string; items: { id: string; label: string; sub?: boolean }[] }

export const EXTRINSIC: ExtrinsicGroup[] = [
  { id: 'farming', label: 'Выращивание', items: [
    { id: 'country', label: 'Страна' }, { id: 'region', label: 'Регион', sub: true }, { id: 'farm', label: 'Ферма или кооператив' },
    { id: 'producer', label: 'Производитель' }, { id: 'species', label: 'Вид' }, { id: 'variety', label: 'Сорт или смесь сортов', sub: true },
    { id: 'harvest', label: 'Дата/год урожая' }, { id: 'farming-other', label: 'Другое' },
  ] },
  { id: 'processing', label: 'Обработка', items: [
    { id: 'processor', label: 'Переработчик' }, { id: 'wet-mill', label: 'Станция мокрой обработки', sub: true }, { id: 'dry-mill', label: 'Сухая мельница', sub: true },
    { id: 'processor-other', label: 'Другое', sub: true }, { id: 'process-type', label: 'Тип обработки' }, { id: 'washed', label: 'Мытая', sub: true },
    { id: 'natural', label: 'Натуральная', sub: true }, { id: 'process-other', label: 'Другая', sub: true },
    { id: 'decaf', label: 'Без кофеина' }, { id: 'process-description', label: 'Описание обработки' },
  ] },
  { id: 'trading', label: 'Торговля', items: [
    { id: 'grade', label: 'Грейд' }, { id: 'ico', label: 'Номер ICO' }, { id: 'importer', label: 'Импортёр' }, { id: 'exporter', label: 'Экспортёр' },
    { id: 'farm-gate', label: 'Цена у ворот фермы' }, { id: 'lot-size', label: 'Размер лота' }, { id: 'trading-other', label: 'Другое' },
  ] },
  { id: 'certification', label: 'Сертификаты', items: [
    { id: '4c', label: '4C' }, { id: 'fairtrade', label: 'Fairtrade' }, { id: 'organic', label: 'Органик' },
    { id: 'rainforest', label: 'Rainforest Alliance' }, { id: 'food-safety', label: 'Пищевая безопасность' }, { id: 'cert-other', label: 'Другое' },
  ] },
  { id: 'other', label: 'Другое', items: [{ id: 'awards', label: 'Награды' }] },
];

export interface Extrinsic {
  checked: string[];
  notes: Partial<Record<ExtrinsicGroup['id'], string>>;
}

/** Prefill from the pack card: whatever is known gets checked */
export function extrinsicFromBean(b?: Bean | null): Extrinsic {
  const c = new Set<string>();
  if (b) {
    const parts = b.isBlend ? b.parts ?? [] : [];
    const has = (k: 'country' | 'region' | 'farm' | 'variety' | 'process') => !!b[k] || parts.some((p) => p[k]);
    if (has('country')) c.add('country');
    if (has('region')) c.add('region');
    if (has('farm')) c.add('farm');
    if (b.producer) c.add('producer');
    if (has('variety')) c.add('variety');
    if (b.harvest) c.add('harvest');
    const procs = [b.process, ...parts.map((p) => p.process)].filter(Boolean).map((p) => p.toLowerCase());
    if (procs.length) c.add('process-type');
    if (procs.some((p) => p.includes('мыт') || p.includes('wash'))) c.add('washed');
    if (procs.some((p) => p.includes('натур') || p.includes('natur'))) c.add('natural');
    if (procs.some((p) => !(p.includes('мыт') || p.includes('wash') || p.includes('натур') || p.includes('natur')))) c.add('process-other');
  }
  const farming = b ? [b.isBlend ? 'Бленд' : '', b.altitude && `высота ${b.altitude}`].filter(Boolean).join(', ') : '';
  const processing = b ? [b.process].filter(Boolean).join(', ') : '';
  return { checked: [...c], notes: { farming, processing } };
}

/* ---------- Cupping session ---------- */

export interface CvaSample {
  id: string;
  /** sample number on the table */
  code: string;
  beanId: string | null;
  affective?: Affective;
  descriptive?: Descriptive;
  extrinsic?: Extrinsic;
}

export interface CvaSession {
  mode: CvaMode;
  cupVolume: number;
  cups: number;
  purpose: string;
  samples: CvaSample[];
}

export function newSample(id: string, code: string, beanId: string | null, mode: CvaMode, cups: number, bean?: Bean | null): CvaSample {
  return {
    id, code, beanId,
    affective: hasAffective(mode) ? emptyAffective(cups) : undefined,
    descriptive: hasDescriptive(mode) ? emptyDescriptive() : undefined,
    extrinsic: extrinsicFromBean(bean),
  };
}

/** Rebuild samples for a new mode / cup count, keeping what was already entered */
export function adaptSession(s: CvaSession, mode: CvaMode, cups: number): CvaSession {
  const fit = (arr: boolean[]) => Array.from({ length: cups }, (_, i) => arr[i] ?? false);
  return {
    ...s, mode, cups,
    samples: s.samples.map((x) => ({
      ...x,
      affective: hasAffective(mode) ? (x.affective ? { ...x.affective, nonUniform: fit(x.affective.nonUniform), defective: fit(x.affective.defective) } : emptyAffective(cups)) : x.affective,
      descriptive: hasDescriptive(mode) ? x.descriptive ?? emptyDescriptive() : x.descriptive,
    })),
  };
}

/* ---------- Shared rating helpers ---------- */

/** SCA score of a brew: CVA (best sample) or the old 2004 protocol. null — no score. */
export function brewSca(b: Pick<Brew, 'cva' | 'cupping'>): number | null {
  if (b.cva) {
    const scores = b.cva.samples.map((s) => (s.affective ? affectiveScore(s.affective) : null)).filter((x): x is number => x !== null);
    return scores.length ? Math.max(...scores) : null;
  }
  return b.cupping ? cupScore(b.cupping as Cupping).total : null;
}

/** Score of a specific pack within a session */
export function beanSca(b: Pick<Brew, 'cva' | 'cupping' | 'beanId'>, beanId: string): number | null {
  if (b.cva) {
    const s = b.cva.samples.filter((x) => x.beanId === beanId).map((x) => (x.affective ? affectiveScore(x.affective) : null)).filter((x): x is number => x !== null);
    return s.length ? Math.max(...s) : null;
  }
  return b.beanId === beanId && b.cupping ? cupScore(b.cupping as Cupping).total : null;
}

/** Packs used in a brew/session */
export const brewBeanIds = (b: Pick<Brew, 'cva' | 'beanId'>) =>
  b.cva ? [...new Set(b.cva.samples.map((s) => s.beanId).filter((x): x is string => !!x))] : b.beanId ? [b.beanId] : [];

/** Grams of a pack used by a brew: for cupping — dose × cups for each sample of that pack */
export function gramsFromBean(b: Pick<Brew, 'cva' | 'beanId' | 'dose' | 'fromPack'>, beanId: string) {
  if (b.cva) return b.cva.samples.filter((s) => s.beanId === beanId).length * b.cva.cups * b.dose;
  // the grinder's loss comes from the pack too: what went into the brewer is the dose, what left the pack is fromPack
  return b.beanId === beanId ? b.fromPack ?? b.dose ?? 0 : 0;
}
