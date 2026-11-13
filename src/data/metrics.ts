/**
 * Anonymous usage counters — shared by the app and the server (worker imports this file). No imports.
 * The app only says «this happened N times»; the server adds it to one number per event per day and
 * does not keep who sent it. Only these names are counted, anything else is dropped.
 */
export const EVENTS = {
  'timer.start': 'Запуск таймера',
  'timer.skip': '«Следующий шаг»',
  'timer.hold': '«Ждать» в таймере',
  'brew.timer': 'Заварка с таймером',
  'brew.manual': 'Заварка без таймера',
  'brew.rated': 'Оценка своей чашки',
  'recipe.save': 'Свой рецепт',
  'recipe.drip': 'Рецепт дрипа по проливам',
  'method.save': 'Свой метод',
  'share.recipe': 'Поделились рецептом',
  'share.card': 'Поделились карточкой',
  'pack.add': 'Новая пачка',
  'pack.drip': 'Новая коробка дрипов',
  'pack.lookup': 'Поиск пачки по коду или ссылке',
  'cupping.save': 'Каппинг',
} as const;
export type MetricEvent = keyof typeof EVENTS;
export const EVENT_NAMES = Object.keys(EVENTS) as MetricEvent[];
/** per event in one report: more than a person does between two syncs */
export const EVENT_CAP = 50;

/** What the owner sees: counts only, nobody in them can be told apart */
export interface Metrics {
  at: number;
  users: { total: number; new7: number; new30: number; seen1: number; seen7: number; seen30: number; brewing7: number; brewing30: number;
    /** of people who came 8–37 days ago: how many opened the app in the last 7 days */
    back: { of: number; n: number } };
  brews: { total: number; d7: number; d30: number; liters30: number; perActive30: number;
    methods: { id: string; all: number; d30: number }[] };
  /** the last 30 days, oldest first: people who opened the app that day, brews dated that day */
  days: { day: string; active: number; brews: number }[];
  /** counters over the last 30 days */
  features: Partial<Record<MetricEvent, number>>;
  extra: { cards: number; reminders30: number; rare: number };
}
