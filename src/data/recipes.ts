import { methodById, type BrewStep, type IconKey, type Method } from './methods';
import type { Author } from './store';

/** Custom recipe: parameters + its own pour schedule */
export interface CustomRecipe {
  id: string;
  methodId: string;
  name: string;
  dose: number;
  ratio: number;
  temp: number;
  grind: string;
  /** time until "done", s */
  total: number;
  steps: BrewStep[];
  notes: string;
  /** if the recipe was saved from a friend */
  author?: Author;
  createdAt: number;
  /** drip bags: the steps are built from the pours (see pourPlan) */
  pours?: Pours;
}

/** Pours for a drip bag: how many, how much water each (g), the pause after each, s */
export interface Pours { count: number; ml: number; pause: number }

/** a pour from a kettle takes about this long: 5 g a second, in steps of 5 s */
export const pourSeconds = (ml: number) => Math.max(5, Math.ceil(ml / 5 / 5) * 5);

/**
 * The drip schedule from its pours: each pour, then a pause while the water drains through the bag;
 * the last pause is the final drain. Grams on each pour are what the cup holds by then.
 */
export function pourPlan(p: Pours): { water: number; total: number; steps: BrewStep[] } {
  const water = p.count * p.ml;
  const pour = pourSeconds(p.ml);
  const steps: BrewStep[] = [];
  for (let i = 0; i < p.count; i++) {
    const at = i * (pour + p.pause);
    steps.push({ at, title: `Пролив ${i + 1}`, to: ((i + 1) * p.ml) / water,
      hint: i === 0 ? 'Смочите кофе равномерно — тонкой струёй по кругу' : 'Тонкой струёй по кругу, не заливая край фильтра' });
    const last = i === p.count - 1;
    steps.push({ at: at + pour, title: last ? 'Дать стечь' : 'Пауза',
      hint: last ? 'Снимите пакет, когда капли станут редкими' : `Ждём ${p.pause} с, пока вода уходит через пакет` });
  }
  return { water, total: p.count * (pour + p.pause), steps };
}

/** pours of a drip recipe made before they existed: one per step with grams, the water split evenly */
export function poursOf(r: Pick<CustomRecipe, 'pours' | 'steps' | 'dose' | 'ratio'>): Pours {
  if (r.pours) return r.pours;
  const count = Math.max(1, Math.min(10, r.steps.filter((s) => s.to !== undefined).length || 3));
  return { count, ml: Math.max(10, Math.round((r.dose * r.ratio) / count / 5) * 5), pause: 30 };
}

/** Brew schedule the timer follows. Stored as a snapshot in the brew and sent with "Share". */
export interface BrewPlan {
  recipeId?: string;
  name: string;
  total: number;
  steps: BrewStep[];
}

export function planFromRecipe(r: CustomRecipe): BrewPlan {
  return { recipeId: r.id, name: r.name, total: r.total, steps: r.steps };
}

/** Schedule for the timer: the custom one if present, otherwise the method's standard one */
export function effectivePlan(methodId: string, plan?: BrewPlan | null): BrewPlan {
  if (plan && plan.steps.length) return plan;
  const m = methodById(methodId);
  return { name: 'Стандартный', total: m.total, steps: m.steps };
}

/** New recipe based on the standard one (or the current parameters) */
export function recipeFromStandard(methodId: string, id: string, params?: Partial<CustomRecipe>): CustomRecipe {
  const m = methodById(methodId);
  return {
    id, methodId, name: `Мой ${m.name}`, dose: m.dose, ratio: m.ratio, temp: m.temp, grind: m.grind,
    total: m.total, steps: m.steps.map((s) => ({ ...s })), notes: '', createdAt: Date.now(),
    ...params,
  };
}

export function sortSteps(steps: BrewStep[]) {
  return [...steps].sort((a, b) => a.at - b.at);
}

/** Custom brew method: like a standard one, but created by the user */
export interface CustomMethod {
  id: string;
  name: string;
  about: string;
  icon: IconKey;
  dose: number;
  ratio: number;
  temp: number;
  grind: string;
  total: number;
  steps: BrewStep[];
  tips: string[];
  archived?: boolean;
  createdAt: number;
}

export const toMethod = (c: CustomMethod): Method => ({ ...c, custom: true });

export function newCustomMethod(id: string): CustomMethod {
  return {
    id, name: '', about: '', icon: 'cup', dose: 15, ratio: 16, temp: 93, grind: 'средний', total: 180,
    steps: [{ at: 0, title: 'Залить', to: 1 }], tips: [], createdAt: Date.now(),
  };
}
