import { describe, expect, it } from 'vitest';
import { canonical, fromBuckets, merge, strip, toBuckets } from '../../src/data/persist';
import { EMPTY, type DB } from '../../src/data/store';

const db = (over: Partial<DB>): DB => ({ ...EMPTY, profile: { ...EMPTY.profile }, ...over });

describe('cloud format', () => {
  it('canonical JSON does not depend on key order', () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('strip drops empty values but keeps zero and false', () => {
    expect(strip({ a: '', b: [], c: {}, d: null, e: 0, f: false, g: { h: undefined } })).toEqual({ e: 0, f: false });
  });

  it('round-trips beans and brews through buckets', () => {
    const local = db({
      beans: [{ id: 'k1', name: 'Кения', roaster: 'X', country: 'Кения', region: '', farm: '', variety: '', process: '', roastLevel: '', roastDate: '2026-10-01', weight: '250', notes: '', packNotes: '' } as DB['beans'][number]],
      brews: [{ id: 'b1', methodId: 'chemex', beanId: 'k1', date: Date.UTC(2026, 9, 10), dose: 30, water: 500, temp: 94, ppm: 120, tds: 1.32, grind: '22 щелчка', time: 240, rating: 4.5, notes: 'ok' } as DB['brews'][number]],
      mod: { 'k:k1': 1_790_000_000_000, 'b:b1': 1_790_000_000_000 },
    });
    const buckets = toBuckets(local);
    expect(Object.keys(buckets).sort()).toEqual(['b202610', 'k', 'm']);
    const merged = merge(db({}), fromBuckets(buckets, []));
    expect(merged.beans.map((b) => b.id)).toEqual(['k1']);
    expect(merged.brews[0]).toMatchObject({ id: 'b1', methodId: 'chemex', dose: 30, rating: 4.5, beanId: 'k1', ppm: 120, tds: 1.32 });
  });
});
