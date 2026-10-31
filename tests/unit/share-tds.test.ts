import { describe, expect, it } from 'vitest';
import { decodeRecipe, encodeRecipe, recipeText, type SharedRecipe } from '../../src/data/share';
import { extraction } from '../../src/data/extraction';

const r: SharedRecipe = { author: { name: 'Аня' }, date: Date.UTC(2026, 9, 31), methodId: 'v60', dose: 15, water: 250, temp: 93, ppm: 140, tds: 1.35, beverage: 221,
  grind: 'средний', time: 180, rating: 4, descriptors: [], notes: '', bean: null, gear: [] };

describe('water ppm and cup TDS', () => {
  it('travel in a shared recipe and show in the text', async () => {
    const back = await decodeRecipe(await encodeRecipe(r));
    expect(back?.ppm).toBe(140); expect(back?.tds).toBe(1.35); expect(back?.beverage).toBe(221);
    expect(recipeText(r)).toContain('вода 140 ppm');
    expect(recipeText(r)).toContain('TDS 1,35 %');
  });
  it('are absent when not set', async () => {
    const { ppm: _p, tds: _t, beverage: _b, ...plain } = r; void _p; void _t; void _b;
    const back = await decodeRecipe(await encodeRecipe(plain));
    expect(back?.ppm).toBeUndefined(); expect(back?.tds).toBeUndefined();
  });
  it('extraction: pour-over estimates the beverage, espresso uses the yield', () => {
    // 15 g → 250 g water, ~220 g in the cup, TDS 1.35 % → 19.8 %
    expect(extraction({ methodId: 'v60', dose: 15, water: 250, tds: 1.35 })).toBe(19.8);
    // 18 g → 36 g espresso at 9 % → 18 %
    expect(extraction({ methodId: 'espresso', dose: 18, water: 36, tds: 9 })).toBe(18);
    expect(extraction({ methodId: 'v60', dose: 15, water: 250 })).toBeNull();
    // weighed drink: exact — 15 g, 225 g in the cup at 1.35 % → 20.3 %
    expect(extraction({ methodId: 'v60', dose: 15, water: 250, tds: 1.35, beverage: 225 })).toBe(20.3);
  });
});
