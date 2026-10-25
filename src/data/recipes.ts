import { methodById, type BrewStep, type IconKey, type Method } from './methods';
import type { Author } from './store';

/** Свой рецепт: параметры + собственная схема проливов */
export interface CustomRecipe {
  id: string;
  methodId: string;
  name: string;
  dose: number;
  ratio: number;
  temp: number;
  grind: string;
  /** время до «готово», сек */
  total: number;
  steps: BrewStep[];
  notes: string;
  /** если рецепт сохранён от друга */
  author?: Author;
  createdAt: number;
}

/** Схема заварки, по которой идёт таймер. Хранится снимком в заварке и уходит в «Поделиться». */
export interface BrewPlan {
  recipeId?: string;
  name: string;
  total: number;
  steps: BrewStep[];
}

export function planFromRecipe(r: CustomRecipe): BrewPlan {
  return { recipeId: r.id, name: r.name, total: r.total, steps: r.steps };
}

/** Схема для таймера: своя, если есть, иначе стандартная для метода */
export function effectivePlan(methodId: string, plan?: BrewPlan | null): BrewPlan {
  if (plan && plan.steps.length) return plan;
  const m = methodById(methodId);
  return { name: 'Стандартный', total: m.total, steps: m.steps };
}

/** Новый рецепт на основе стандартного (или текущих параметров) */
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

/** Свой метод заваривания: как стандартный, но создан пользователем */
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
