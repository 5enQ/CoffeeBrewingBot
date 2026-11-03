import { describe, expect, it } from 'vitest';
import { pourPlan, pourSeconds, poursOf } from '../../src/data/recipes';

describe('drip pours', () => {
  it('a pour takes about 5 g a second, in steps of 5 s', () => {
    expect(pourSeconds(40)).toBe(10);
    expect(pourSeconds(10)).toBe(5);
    expect(pourSeconds(60)).toBe(15);
  });
  it('builds the steps: each pour, then a pause; the last pause is the drain', () => {
    const p = pourPlan({ count: 3, ml: 50, pause: 30 });
    expect(p.water).toBe(150);
    expect(p.total).toBe(3 * (10 + 30));
    expect(p.steps.map((s) => [s.at, s.title])).toEqual([[0, 'Пролив 1'], [10, 'Пауза'], [40, 'Пролив 2'], [50, 'Пауза'], [80, 'Пролив 3'], [90, 'Дать стечь']]);
    expect(p.steps.filter((s) => s.to !== undefined).map((s) => Math.round(s.to! * p.water))).toEqual([50, 100, 150]);
  });
  it('an older drip recipe gets pours from its steps', () => {
    const steps = [{ at: 0, title: 'a', to: 0.2 }, { at: 30, title: 'b', to: 0.6 }, { at: 70, title: 'c', to: 1 }, { at: 120, title: 'd' }];
    expect(poursOf({ steps, dose: 11, ratio: 15 })).toEqual({ count: 3, ml: 55, pause: 30 });
    expect(poursOf({ pours: { count: 2, ml: 90, pause: 15 }, steps, dose: 11, ratio: 15 })).toEqual({ count: 2, ml: 90, pause: 15 });
  });
});
