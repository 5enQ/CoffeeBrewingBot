import type { GrindType } from './grind';

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
}

/** Gear snapshot inside a brew: stays even if the item is deleted later */
export interface GearRef { id: string; cat: GearCat; name: string; details?: string }

export const GEAR_CATS: { id: GearCat; label: string; one: string; hint: string; suggestions: string[] }[] = [
  { id: 'grinder', label: 'Кофемолки', one: 'Кофемолка', hint: 'Ручные и электрические', suggestions: ['Comandante C40', '1Zpresso K-Ultra', '1Zpresso ZP6 Special', '1Zpresso J-Ultra', 'Timemore C3', 'Timemore Sculptor 078', 'Kinu M47', 'Niche Zero', 'DF64', 'Fellow Ode Gen 2', 'Mahlkönig EK43', 'Baratza Encore ESP'] },
  { id: 'machine', label: 'Кофемашины', one: 'Кофемашина', hint: 'Эспрессо-машины и батч-брюеры', suggestions: ['Gaggia Classic Pro', 'Rancilio Silvia', 'Breville Bambino Plus', 'Lelit Bianca', 'Lelit Mara X', 'La Marzocco Linea Micra', 'Decent DE1', 'Flair 58', 'De’Longhi Dedica', 'Moccamaster KBGV Select', 'Fetco CBS-2152', 'Bunn ICB', 'Wilfa Classic+'] },
  { id: 'dripper', label: 'Воронки', one: 'Воронка', hint: 'Пуроверы и фильтр-кофе', suggestions: ['Hario V60 02', 'Hario V60 01', 'Kalita Wave 185', 'Origami Dripper M', 'Chemex 6 чашек', 'April Brewer', 'Orea V4', 'Hario Switch', 'Clever Dripper'] },
  { id: 'press', label: 'Аэропресс и прессы', one: 'Пресс', hint: 'Иммерсия: аэропресс, френч-пресс', suggestions: ['AeroPress Original', 'AeroPress Go', 'AeroPress XL', 'Bodum Chambord', 'Espro P7'] },
  { id: 'stovetop', label: 'Мока и джезвы', one: 'Мока / джезва', hint: 'Для плиты', suggestions: ['Bialetti Moka Express 3', 'Bialetti Brikka', 'Медная джезва 200 мл'] },
  { id: 'kettle', label: 'Чайники', one: 'Чайник', hint: 'С носиком «гусиная шея»', suggestions: ['Fellow Stagg EKG', 'Hario Buono', 'Brewista Artisan', 'Timemore Fish'] },
  { id: 'scale', label: 'Весы', one: 'Весы', hint: 'С таймером', suggestions: ['Acaia Pearl', 'Acaia Lunar', 'Timemore Black Mirror', 'Hario V60 Drip Scale'] },
  { id: 'filter', label: 'Фильтры', one: 'Фильтр', hint: 'Бумажные и металлические', suggestions: ['Hario V60 Tabbed', 'Cafec Abaca', 'Sibarist FAST', 'Kalita Wave 185 белые', 'Chemex Bonded'] },
  { id: 'other', label: 'Другое', one: 'Другое', hint: 'Дистрибьюторы, WDT, вода', suggestions: ['WDT-инструмент', 'Дистрибьютор', 'Third Wave Water', 'Рефрактометр'] },
];

export const catById = (c: GearCat) => GEAR_CATS.find((x) => x.id === c) ?? GEAR_CATS[GEAR_CATS.length - 1];

/** Which gear makes sense to ask for a method */
export function catsForMethod(methodId: string): GearCat[] {
  const base: GearCat[] = ['grinder'];
  switch (methodId) {
    case 'v60': case 'kalita': case 'chemex': return [...base, 'dripper', 'filter', 'kettle', 'scale'];
    case 'clever': return [...base, 'dripper', 'filter', 'kettle', 'scale'];
    case 'aeropress': case 'french': return [...base, 'press', 'kettle', 'scale'];
    case 'espresso': return [...base, 'machine', 'scale', 'other'];
    case 'moka': case 'cezve': return [...base, 'stovetop', 'scale'];
    case 'drip': return ['kettle', 'scale'];
    case 'batch': return [...base, 'machine', 'filter', 'scale'];
    case 'cupping': return [...base, 'kettle', 'scale'];
    default: return [...base, 'kettle', 'scale'];
  }
}

export const gearLabel = (g: { name: string; details?: string }) => g.details ? `${g.name} · ${g.details}` : g.name;
