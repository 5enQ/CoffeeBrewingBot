/**
 * Russian — the source language. Every key used in the app must exist here;
 * other locales may be incomplete and fall back to English, then to Russian.
 *
 * Plural forms are objects with Intl.PluralRules categories (one / few / many / other).
 */
export const ru = {
  // bottom tabs and desktop sidebar
  'tab.brew': 'Заварить',
  'tab.journal': 'Дневник',
  'tab.shelf': 'Полка',
  'tab.profile': 'Профиль',

  // brew methods (custom methods keep the name the user typed)
  'method.v60': 'V60',
  'method.kalita': 'Kalita Wave',
  'method.chemex': 'Кемекс',
  'method.aeropress': 'Аэропресс',
  'method.french': 'Френч-пресс',
  'method.clever': 'Клевер',
  'method.espresso': 'Эспрессо',
  'method.moka': 'Мока',
  'method.cezve': 'Джезва',
  'method.siphon': 'Сифон',
  'method.coldbrew': 'Колд брю',
  'method.batch': 'Батч брю',
  'method.drip': 'Дрип',
  'method.cupping': 'Каппинг',
  'method.deleted': 'Удалённый метод',

  // common words
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.done': 'Готово',
  'common.back': 'Назад',
  'common.edit': 'Изменить',
  'common.delete': 'Удалить',

  // plurals
  'unit.brews': { one: '{n} заварка', few: '{n} заварки', many: '{n} заварок', other: '{n} заварки' },
  'unit.drips': { one: '{n} дрип', few: '{n} дрипа', many: '{n} дрипов', other: '{n} дрипа' },
} as const;

export type MessageKey = keyof typeof ru;
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>>;
export type Messages = { [K in MessageKey]?: string | PluralMessage };
