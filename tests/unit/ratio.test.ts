import { describe, expect, it } from 'vitest';
import { solve } from '../../src/data/ratio';

const cur = { dose: 15, ratio: 16 }; // 240 g water
const water = (m: { dose: number; ratio: number }) => Math.round(m.dose * m.ratio * 10) / 10;

describe('coffee / water / ratio locks', () => {
  it('ratio locked (default): coffee moves water, water moves coffee', () => {
    expect(solve(cur, 'dose', 20, 'ratio')).toEqual({ dose: 20, ratio: 16 });
    expect(solve(cur, 'water', 320, 'ratio')).toEqual({ dose: 20, ratio: 16 });
    expect(solve(cur, 'ratio', 17, 'ratio')).toBeNull();
  });
  it('coffee locked: water and ratio move each other', () => {
    const a = solve(cur, 'water', 300, 'dose')!;
    expect(a.dose).toBe(15); expect(a.ratio).toBe(20);
    const b = solve(cur, 'ratio', 17, 'dose')!;
    expect(b.dose).toBe(15); expect(water(b)).toBe(255);
    expect(solve(cur, 'dose', 18, 'dose')).toBeNull();
  });
  it('water locked: coffee and ratio move, the water stays', () => {
    const a = solve(cur, 'dose', 20, 'water')!;
    expect(a.dose).toBe(20); expect(water(a)).toBe(240); expect(a.ratio).toBe(12);
    const b = solve(cur, 'ratio', 17, 'water')!;
    expect(water(b)).toBe(240); expect(b.dose).toBe(14.1);
    expect(solve(cur, 'water', 300, 'water')).toBeNull();
  });
  it('a recipe given as 20 g and 300 g: lock coffee, set the water — the ratio is found', () => {
    const r = solve({ dose: 20, ratio: 16 }, 'water', 300, 'dose')!;
    expect(r.ratio).toBe(15);
  });
});
