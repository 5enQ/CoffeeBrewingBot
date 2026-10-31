import { describe, expect, it } from 'vitest';
import { beanStock } from '../../src/data/stock';
import type { Bean, Brew } from '../../src/data/store';

const bean = { id: 'k1', weight: '250' } as Bean;
const brew = (dose: number, fromPack?: number) => ({ id: String(Math.random()), beanId: 'k1', dose, fromPack } as unknown as Brew);

describe('stock with grinder loss', () => {
  it('takes fromPack from the pack when set, the dose otherwise', () => {
    const st = beanStock(bean, [brew(16, 17), brew(15)]);
    expect(st.used).toBe(32);
    expect(st.left).toBe(218);
    expect(st.brewCount).toBe(2);
  });
});
