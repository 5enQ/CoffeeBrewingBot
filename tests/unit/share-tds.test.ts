import { describe, expect, it } from 'vitest';
import { decodeRecipe, encodeRecipe, recipeText, type SharedRecipe } from '../../src/data/share';

const r: SharedRecipe = { author: { name: 'Аня' }, date: Date.UTC(2026, 9, 31), methodId: 'v60', dose: 15, water: 250, temp: 93, tds: 140,
  grind: 'средний', time: 180, rating: 4, descriptors: [], notes: '', bean: null, gear: [] };

describe('water TDS in a shared recipe', () => {
  it('travels in the link and shows in the text', async () => {
    const back = await decodeRecipe(await encodeRecipe(r));
    expect(back?.tds).toBe(140);
    expect(recipeText(r)).toContain('вода 140 ppm');
  });
  it('is absent when not set', async () => {
    const { tds: _t, ...plain } = r; void _t;
    expect((await decodeRecipe(await encodeRecipe(plain)))?.tds).toBeUndefined();
  });
});
