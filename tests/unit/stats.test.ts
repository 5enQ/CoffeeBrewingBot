import { describe, expect, it } from 'vitest';
import { pendingStats } from '../../src/data/stats';
import type { Brew } from '../../src/data/store';

const brew = (id: string, date: number, extra: Partial<Brew> = {}) => ({ id, date, methodId: 'v60', water: 250, notes: 'secret', beanId: 'k1', ...extra } as unknown as Brew);

describe('brew log for the server', () => {
  const db = {
    brews: [brew('a', 1000), brew('b', 2000), brew('s', 3000, { sample: true }), brew('f', 4000, { author: { name: 'friend' } })],
    mod: { 'b:a': 5000, 'b:b': 9000 },
    del: { 'b:z': 8000, 'k:bean': 9500 },
  };

  it('first run sends the whole history, without samples and friends\' recipes, and only method/water/date', () => {
    const p = pendingStats(db, 0);
    expect(p.brews).toEqual([{ id: 'a', m: 'v60', w: 250, t: 1000 }, { id: 'b', m: 'v60', w: 250, t: 2000 }]);
    expect(p.removed).toEqual(['z']);
    expect(p.top).toBe(9500);
  });

  it('later runs send only what changed since', () => {
    const p = pendingStats(db, 6000);
    expect(p.brews.map((b) => b.id)).toEqual(['b']);
    expect(p.removed).toEqual(['z']);
    expect(pendingStats(db, 9500)).toMatchObject({ brews: [], removed: [] });
  });
});
