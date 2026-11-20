import { decSep, t, tr } from '../i18n';
export interface BrewStep {
  /** second from start */
  at: number;
  title: string;
  /** pour up to this share of the total water (0..1) */
  to?: number;
  hint?: string;
}

export interface Method {
  id: string;
  name: string;
  /** short method description */
  about: string;
  icon: IconKey;
  dose: number;   // g of coffee
  ratio: number;  // 1:ratio
  temp: number;   // °C, 0 — "cold water"
  grind: string;
  /** espresso — count the beverage yield rather than water */
  yieldLabel?: string;
  /** duration until "done", s */
  total: number;
  steps: BrewStep[];
  tips: string[];
  /** the user's custom method */
  custom?: boolean;
  /** archived: hidden from lists, but old brews still resolve it (deleted custom methods, retired standard ones) */
  archived?: boolean;
}

export type IconKey =
  | 'v60' | 'chemex' | 'kalita' | 'aeropress' | 'french' | 'clever'
  | 'espresso' | 'moka' | 'cezve' | 'cupping' | 'siphon' | 'coldbrew' | 'batch' | 'dripbag'
  | 'cup' | 'kettle' | 'drop' | 'bean';

/** Icons available for a custom method */
export const ICON_CHOICES: IconKey[] = ['cup', 'drop', 'kettle', 'bean', 'v60', 'kalita', 'chemex', 'aeropress', 'french', 'clever', 'espresso', 'moka', 'cezve', 'siphon', 'coldbrew', 'batch', 'dripbag', 'cupping'];

export const METHODS: Method[] = [
  {
    id: 'v60', get name() { return t('method.v60'); }, icon: 'v60',
    about: tr('Конусная воронка: чистая чашка, яркая кислотность.'),
    dose: 15, ratio: 16.67, temp: 95, grind: tr('средне-мелкий'), total: 210,
    steps: [
      { at: 0, title: tr('Блуминг'), to: 0.2, hint: tr('Смочите всю таблетку и покрутите воронку') },
      { at: 45, title: tr('Первый пролив'), to: 0.6, hint: tr('Спиралью от центра, не по стенкам') },
      { at: 75, title: tr('Второй пролив'), to: 1, hint: tr('Плавно, к краю таблетки не подходите') },
      { at: 105, title: tr('Покрутить'), hint: tr('Лёгкий свирл, чтобы выровнять кофейное ложе') },
      { at: 120, title: tr('Слив'), hint: tr('Ждём, пока вода уйдёт. Цель — 3:00–3:30') },
    ],
    tips: [
      tr('Кисло и пусто — мельче помол или горячее вода'),
      tr('Горько и сухо — крупнее помол'),
      tr('Промойте фильтр горячей водой перед заваркой'),
    ],
  },
  {
    id: 'kalita', archived: true, get name() { return t('method.kalita'); }, icon: 'kalita',
    about: tr('Плоское дно и импульсные проливы: ровная экстракция, сладость.'),
    dose: 20, ratio: 16, temp: 94, grind: tr('средний'), total: 210,
    steps: [
      { at: 0, title: tr('Блуминг'), to: 0.15 },
      { at: 40, title: tr('Пролив 2'), to: 0.4 },
      { at: 70, title: tr('Пролив 3'), to: 0.6 },
      { at: 100, title: tr('Пролив 4'), to: 0.8 },
      { at: 130, title: tr('Пролив 5'), to: 1 },
      { at: 150, title: tr('Слив'), hint: tr('Цель — около 3:30') },
    ],
    tips: [tr('Лейте в центр небольшими кругами'), tr('Уровень воды держите примерно одинаковым')],
  },
  {
    id: 'chemex', get name() { return t('method.chemex'); }, icon: 'chemex',
    about: tr('Плотный фильтр: очень чистая, лёгкая чашка на двоих.'),
    dose: 30, ratio: 16.67, temp: 94, grind: tr('средне-крупный'), total: 270,
    steps: [
      { at: 0, title: tr('Блуминг'), to: 0.15, hint: tr('Перемешайте ложкой, чтобы не было сухих участков') },
      { at: 45, title: tr('Пролив 2'), to: 0.5 },
      { at: 90, title: tr('Пролив 3'), to: 0.8 },
      { at: 135, title: tr('Пролив 4'), to: 1 },
      { at: 165, title: tr('Слив'), hint: tr('Цель — 4:00–4:30') },
    ],
    tips: [tr('Складка фильтра в три слоя — к носику'), tr('Если слив дольше 5 минут, сделайте помол крупнее')],
  },
  {
    id: 'aeropress', get name() { return t('method.aeropress'); }, icon: 'aeropress',
    about: tr('Иммерсия с давлением: насыщенно и прощает ошибки.'),
    dose: 15, ratio: 15.3, temp: 90, grind: tr('средне-мелкий'), total: 180,
    steps: [
      { at: 0, title: tr('Залить воду'), to: 1, hint: tr('Всю сразу, вставьте поршень на 1 см — будет вакуум') },
      { at: 120, title: tr('Покрутить'), hint: tr('Аккуратно покрутите колбу, снимите поршень') },
      { at: 150, title: tr('Жать'), hint: tr('Плавно, около 30 секунд, до шипения не доводите') },
    ],
    tips: [tr('Для кофе посветлее — температура до 95°'), tr('Горчит — уменьшите время до прожима')],
  },
  {
    id: 'french', get name() { return t('method.french'); }, icon: 'french',
    about: tr('Полная иммерсия: плотное тело, мягкая кислотность.'),
    dose: 30, ratio: 16.67, temp: 96, grind: tr('средний'), total: 540,
    steps: [
      { at: 0, title: tr('Залить воду'), to: 1, hint: tr('Всю сразу, крышку не ставим') },
      { at: 240, title: tr('Разбить корочку'), hint: tr('Перемешайте поверхность, ложкой снимите пену') },
      { at: 270, title: tr('Отстаивание'), hint: tr('Не трогайте — гуща оседает') },
      { at: 480, title: tr('Поршень к поверхности'), hint: tr('Не прожимайте до дна — только как сито') },
    ],
    tips: [tr('Чем дольше отстаивание, тем чище чашка'), tr('Наливайте медленно, последние 10% не выливайте')],
  },
  {
    id: 'clever', get name() { return t('method.clever'); }, icon: 'clever',
    about: tr('Иммерсия с бумажным фильтром: тело френча, чистота пуровера.'),
    dose: 20, ratio: 15, temp: 94, grind: tr('средний'), total: 180,
    steps: [
      { at: 0, title: tr('Вода, затем кофе'), to: 1, hint: tr('Сначала вода, потом кофе — меньше забивается фильтр') },
      { at: 30, title: tr('Перемешать'), hint: tr('3–4 движения ложкой') },
      { at: 120, title: tr('Поставить на чашку'), hint: tr('Клапан откроется, начнётся слив') },
    ],
    tips: [tr('Слив должен закончиться к 3:00–3:30')],
  },
  {
    id: 'espresso', get name() { return t('method.espresso'); }, icon: 'espresso',
    about: tr('Давление 9 бар: концентрат за полминуты.'),
    dose: 18, ratio: 2, temp: 93, grind: tr('мелкий'), yieldLabel: tr('Выход'), total: 30,
    steps: [
      { at: 0, title: tr('Старт'), hint: tr('Пролив начинается после предсмачивания') },
      { at: 6, title: tr('Первые капли'), hint: tr('Если потекло раньше 5 с — помол мельче') },
      { at: 15, title: tr('Середина'), to: 0.5, hint: tr('Цвет — от тёмного к карамельному') },
      { at: 26, title: tr('Остановить на выходе'), to: 1 },
    ],
    tips: [tr('Кисло и солоно — мельче помол или больше выход'), tr('Горько и вяжет — крупнее или меньше выход')],
  },
  {
    id: 'moka', get name() { return t('method.moka'); }, icon: 'moka',
    about: tr('Гейзерная кофеварка: крепко и плотно.'),
    dose: 18, ratio: 10, temp: 70, grind: tr('чуть крупнее эспрессо'), total: 270,
    steps: [
      { at: 0, title: tr('На огонь'), to: 1, hint: tr('Горячая вода до клапана, средний огонь, крышку не закрывать') },
      { at: 150, title: tr('Пошёл кофе'), hint: tr('Убавьте огонь — поток должен быть медовым') },
      { at: 230, title: tr('Снять с огня'), hint: tr('Как только струя посветлеет. Остудите низ мокрым полотенцем') },
    ],
    tips: [tr('Не трамбуйте кофе в корзинке'), tr('Холодная вода даёт подгоревший вкус')],
  },
  {
    id: 'cezve', get name() { return t('method.cezve'); }, icon: 'cezve',
    about: tr('Кофе по-турецки: очень мелкий помол, густая пенка.'),
    dose: 10, ratio: 10, temp: 0, grind: tr('пудра'), total: 180,
    steps: [
      { at: 0, title: tr('Кофе и вода'), to: 1, hint: tr('Холодная вода, перемешайте, малый огонь') },
      { at: 90, title: tr('Следим за шапкой'), hint: tr('Пенка темнеет и поднимается. Не мешаем') },
      { at: 150, title: tr('Снять с огня'), hint: tr('Как только шапка поднимется к горлышку') },
    ],
    tips: [tr('Не доводите до кипения'), tr('Дайте гуще осесть 1–2 минуты')],
  },
  {
    id: 'siphon', get name() { return t('method.siphon'); }, icon: 'siphon',
    about: tr('Вакуумная заварка: чистый, ароматный и очень горячий кофе.'),
    dose: 20, ratio: 15, temp: 92, grind: tr('средний'), total: 120,
    steps: [
      { at: 0, title: tr('Засыпать кофе'), to: 1, hint: tr('Вода поднялась в верхнюю колбу — всыпьте кофе и погрузите его ложкой') },
      { at: 30, title: tr('Перемешать'), hint: tr('3–4 мягких круга, чтобы не было сухих комков') },
      { at: 60, title: tr('Снять с огня'), hint: tr('Перемешайте 4–5 кругов — начнётся слив в нижнюю колбу') },
      { at: 90, title: tr('Слив'), hint: tr('Цель — куполок кофейной гущи на фильтре к 2:00') },
    ],
    tips: [tr('Кисло — дольше настаивание или мельче помол'), tr('Горько и мутно — убавьте огонь, крупнее помол'), tr('Ткань фильтра храните в воде в холодильнике')],
  },
  {
    id: 'coldbrew', get name() { return t('method.coldbrew'); }, icon: 'coldbrew',
    about: tr('Холодная экстракция 12–18 часов: мягкий, сладкий, без горечи.'),
    dose: 70, ratio: 10, temp: 0, grind: tr('крупный'), total: 43200,
    steps: [
      { at: 0, title: tr('Залить холодной водой'), to: 1, hint: tr('Вода комнатной температуры или холодная, перемешайте') },
      { at: 120, title: tr('Перемешать и закрыть'), hint: tr('Убедитесь, что весь кофе намок. Уберите в холодильник на 12–18 часов, потом процедите через бумажный фильтр') },
    ],
    tips: [tr('Таймер можно закрыть — запишите заварку и процедите через 12–18 часов'), tr('Пейте с водой или льдом 1:1'), tr('Слишком крепко — разбавьте водой'), tr('Хранится в холодильнике до 2 недель')],
  },
  {
    id: 'batch', get name() { return t('method.batch'); }, icon: 'batch',
    about: tr('Фильтр-кофе в капельной машине на большой объём: Moccamaster, Fetco, Bunn и подобные.'),
    dose: 60, ratio: 1000 / 60, temp: 93, grind: tr('средний, чуть крупнее, чем для V60'), total: 360,
    steps: [
      { at: 0, title: tr('Запустить машину'), to: 1, hint: tr('Фильтр промыт горячей водой, кофе разровнен в корзине. Вода 92–96 °C') },
      { at: 30, title: tr('Перемешать слой'), hint: tr('Когда кофе намокнет, аккуратно перемешайте ложкой, чтобы не было сухих комков') },
      { at: 270, title: tr('Пролив заканчивается'), hint: tr('Цель — 4–6 минут на литр. Дайте корзине стечь полностью') },
      { at: 330, title: tr('Перемешать в кувшине'), hint: tr('Первые и последние капли разные по крепости — перемешайте перед подачей') },
    ],
    tips: [tr('SCA Golden Cup — около 55–60 г на литр'), tr('Кисло и пусто — мельче помол'), tr('Горько и долго капает — крупнее помол или меньше кофе'), tr('Не держите на подогреве дольше 30 минут — лучше термос')],
  },
  {
    id: 'drip', get name() { return t('method.drip'); }, icon: 'dripbag',
    about: tr('Дрип-пакет: уже смолотый кофе в фильтре, который вешается на чашку. Зерно и помол задаёт сам пакет.'),
    dose: 11, ratio: 15, temp: 92, grind: tr('уже смолот в пакете'), total: 150,
    steps: [
      { at: 0, title: tr('Блум'), to: 0.2, hint: tr('Раскройте держатели, повесьте на чашку. Смочите кофе равномерно — около 30 г воды') },
      { at: 30, title: tr('Второй пролив'), to: 0.6, hint: tr('Тонкой струёй по кругу, не заливая край фильтра') },
      { at: 70, title: tr('Третий пролив'), to: 1, hint: tr('Доливайте небольшими порциями, чтобы вода не переливалась через пакет') },
      { at: 120, title: tr('Дать стечь'), hint: tr('Снимите пакет, когда капли станут редкими') },
    ],
    tips: [tr('Чашка повыше — пакет не должен касаться кофе'), tr('Кисло и пусто — горячее вода или медленнее пролив'), tr('Горько — меньше воды или снимите пакет раньше'), tr('Лучше выпить коробку в течение месяца после обжарки')],
  },
  {
    id: 'cupping', get name() { return t('method.cupping'); }, icon: 'cupping',
    about: tr('Протокол SCA Coffee Value Assessment: 8,25 г на 150 мл, 93 °C, 5 чашек на образец.'),
    // parameters are fixed by SCA 102; the dose depends only on cup volume
    dose: 11, ratio: 150 / 8.25, temp: 93, grind: tr('70–75 % через сито 850 мкм'), total: 1440,
    steps: [
      { at: 0, title: tr('Залить до края'), to: 1, hint: tr('Вода 93 ± 3 °C, лёгкая турбулентность. Сухой аромат уже оценён до заливки') },
      { at: 30, title: tr('Аромат корочки'), hint: tr('Корочку не трогать 3–5 минут — оцените запах нетронутого настоя') },
      { at: 240, title: tr('Разбить корочку'), hint: tr('Три движения ложкой, вдыхайте пары. Ложку ополаскивайте горячей водой перед каждой чашкой') },
      { at: 300, title: tr('Снять пену'), hint: tr('Одной-двумя ложками уберите гущу и масла с поверхности') },
      { at: 600, title: tr('1-й круг · около 70 °C'), hint: tr('Сёрбайте с ложки, покрывая язык и нёбо, затем сплюньте. Вкус, послевкусие, кислотность, сладость, тактильность') },
      { at: 900, title: tr('2-й круг'), hint: tr('Кофе остывает — уточните впечатление и интенсивность') },
      { at: 1200, title: tr('3-й круг'), hint: tr('Ниже температуры тела. Отметьте неоднородные и дефектные чашки') },
    ],
    tips: [
      tr('Все образцы сессии завариваются параллельно: сначала шаг 1 для всех, потом шаг 2, потом шаг 3'),
      tr('Не больше 6 образцов за сессию'),
      tr('Если где-то не долили — после разбивания корочки долейте до общего объёма'),
    ],
  },
];

/** User's custom methods — registered by the store on load and on changes */
let customMethods: Method[] = [];
export function setCustomMethods(list: Method[]) { customMethods = list; }
/** All methods: standard and custom (archived ones only resolve for old brews) */
/** Methods offered in lists. Archived ones (e.g. Kalita Wave) are hidden but old brews still resolve via methodById */
export const allMethods = () => [...METHODS, ...customMethods].filter((m) => !m.archived);

export const methodById = (id: string) =>
  METHODS.find((m) => m.id === id) ?? customMethods.find((m) => m.id === id) ?? { ...METHODS[0], id, name: t('method.deleted') };

export function fmtRatio(r: number) {
  return `1:${(Math.round(r * 10) / 10).toString().replace('.', decSep())}`;
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1:30", "90", "12:00:00" → seconds */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(\d{1,4})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!m) return null;
  if (m[3] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  if (m[2] !== undefined) return Number(m[1]) * 60 + Number(m[2]);
  return Number(m[1]);
}

export function fmtNum(n: number, digits = 1) {
  const p = 10 ** digits;
  const v = (Math.round(n * p) / p).toString();
  return v.replace('.', decSep());
}
