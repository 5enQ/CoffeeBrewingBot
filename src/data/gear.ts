import type { GrindType } from './grind';
import { tr } from '../i18n';

export type GearCat = 'grinder' | 'machine' | 'dripper' | 'press' | 'stovetop' | 'kettle' | 'scale' | 'filter' | 'other';

export interface Gear {
  id: string;
  cat: GearCat;
  name: string;
  /** burrs, mods, settings — anything */
  details: string;
  sample?: boolean;
  /** grinders only: hand (clicks), electronic (µm), mechanical (as before) */
  grindType?: GrindType;
  /** grinders only: grams lost per grind (purged, cleaned out); taken from the pack on top of the dose */
  loss?: number;
}

/** Gear snapshot inside a brew: stays even if the item is deleted later */
export interface GearRef { id: string; cat: GearCat; name: string; details?: string }

/** Every category, including retired ones: old brews keep their gear snapshots and still need the labels */
export const ALL_GEAR_CATS: { id: GearCat; label: string; one: string; hint: string; suggestions: string[] }[] = [
  { id: 'grinder', label: tr('Кофемолки'), one: tr('Кофемолка'), hint: tr('Ручные и электрические'), suggestions: ['Comandante C40', '1Zpresso K-Ultra', '1Zpresso ZP6 Special', '1Zpresso J-Ultra', 'Timemore C3', 'Timemore Sculptor 078', 'Kinu M47', 'Niche Zero', 'DF64', 'Fellow Ode Gen 2', 'Mahlkönig EK43', 'Baratza Encore ESP'] },
  { id: 'machine', label: tr('Кофемашины'), one: tr('Кофемашина'), hint: tr('Эспрессо-машины и батч-брюеры'), suggestions: ['Gaggia Classic Pro', 'Rancilio Silvia', 'Breville Bambino Plus', 'Lelit Bianca', 'Lelit Mara X', 'La Marzocco Linea Micra', 'Decent DE1', 'Flair 58', 'De’Longhi Dedica', 'Moccamaster KBGV Select', 'Fetco CBS-2152', 'Bunn ICB', 'Wilfa Classic+'] },
  { id: 'dripper', label: tr('Воронки'), one: tr('Воронка'), hint: tr('Пуроверы и фильтр-кофе'), suggestions: ['Hario V60 02', 'Hario V60 01', 'Kalita Wave 185', 'Origami Dripper M', tr('Chemex 6 чашек'), 'April Brewer', 'Orea V4', 'Hario Switch', 'Clever Dripper'] },
  { id: 'press', label: tr('Аэропресс и прессы'), one: tr('Пресс'), hint: tr('Иммерсия: аэропресс, френч-пресс'), suggestions: ['AeroPress Original', 'AeroPress Go', 'AeroPress XL', 'Bodum Chambord', 'Espro P7'] },
  { id: 'stovetop', label: tr('Мока и джезвы'), one: tr('Мока / джезва'), hint: tr('Для плиты'), suggestions: ['Bialetti Moka Express 3', 'Bialetti Brikka', tr('Медная джезва 200 мл')] },
  { id: 'kettle', label: tr('Чайники'), one: tr('Чайник'), hint: tr('С носиком «гусиная шея»'), suggestions: ['Fellow Stagg EKG', 'Hario Buono', 'Brewista Artisan', 'Timemore Fish'] },
  { id: 'scale', label: tr('Весы'), one: tr('Весы'), hint: tr('С таймером'), suggestions: ['Acaia Pearl', 'Acaia Lunar', 'Timemore Black Mirror', 'Hario V60 Drip Scale'] },
  { id: 'filter', label: tr('Фильтры'), one: tr('Фильтр'), hint: tr('Бумажные и металлические'), suggestions: ['Hario V60 Tabbed', 'Cafec Abaca', 'Sibarist FAST', tr('Kalita Wave 185 белые'), 'Chemex Bonded'] },
  { id: 'other', label: tr('Другое'), one: tr('Другое'), hint: tr('Дистрибьюторы, WDT, вода'), suggestions: [tr('WDT-инструмент'), tr('Дистрибьютор'), 'Third Wave Water', tr('Рефрактометр')] },
];

/** Filters are retired: rarely relevant, and a note on the brew covers it. Offered categories: */
const RETIRED: GearCat[] = ['filter'];
export const GEAR_CATS = ALL_GEAR_CATS.filter((c) => !RETIRED.includes(c.id));

export const catById = (c: GearCat) => ALL_GEAR_CATS.find((x) => x.id === c) ?? ALL_GEAR_CATS[ALL_GEAR_CATS.length - 1];

/** Which gear makes sense to ask for a method */
export function catsForMethod(methodId: string): GearCat[] {
  const base: GearCat[] = ['grinder'];
  switch (methodId) {
    case 'v60': case 'kalita': case 'chemex': case 'clever': return [...base, 'dripper', 'kettle', 'scale'];
    case 'aeropress': case 'french': return [...base, 'press', 'kettle', 'scale'];
    case 'espresso': return [...base, 'machine', 'scale', 'other'];
    case 'moka': case 'cezve': return [...base, 'stovetop', 'scale'];
    case 'drip': return ['kettle', 'scale'];
    case 'batch': return [...base, 'machine', 'scale'];
    case 'cupping': return [...base, 'kettle', 'scale'];
    default: return [...base, 'kettle', 'scale'];
  }
}

export const gearLabel = (g: { name: string; details?: string }) => g.details ? `${g.name} · ${g.details}` : g.name;
