import { describe, expect, it } from 'vitest';
import { countStats, type BrewStat } from '../../src/data/levels';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const b = (m: string, t: number, r = T0 + 400 * DAY, w = 250): BrewStat => ({ m, t, r, w });

describe('server counting rules', () => {
  const created = T0 + 400 * DAY;

  it('history imported at account creation counts', () => {
    const rows = Array.from({ length: 60 }, (_, i) => b('v60', T0 + i * DAY, created));
    expect(countStats(rows, created).methods.v60).toBe(60);
  });

  it('no daily cap for people, only a technical ceiling of 100 a day', () => {
    const rows = Array.from({ length: 20 }, (_, i) => b('v60', T0 + i * 60_000, created));
    expect(countStats(rows, created).methods.v60).toBe(20);
    const flood = Array.from({ length: 150 }, (_, i) => b(i % 2 ? 'v60' : 'aeropress', T0 + i * 1000, created));
    const s = countStats(flood, created).methods;
    expect((s.v60 ?? 0) + (s.aeropress ?? 0)).toBe(100);
  });

  it('water: 3 L per brew, 6 L per day', () => {
    expect(countStats([b('batch', T0, created, 50_000)], created).liters).toBe(3);
    const day = Array.from({ length: 5 }, (_, i) => b('batch', T0 + i, created, 3000));
    expect(countStats(day, created).liters).toBe(6);
  });

  it('no backdating after the import window; late sync within 14 days is fine', () => {
    const later = created + 30 * DAY;
    expect(countStats([b('v60', later - 20 * DAY, later)], created).methods.v60).toBeUndefined();
    expect(countStats([b('v60', later - 10 * DAY, later)], created).methods.v60).toBe(1);
  });

  it('dates in the future or before 2015 do not count', () => {
    expect(countStats([b('v60', created + 3 * DAY, created), b('v60', Date.UTC(2010, 0, 1), created)], created).methods.v60).toBeUndefined();
  });

  it('1000 liters needs months, not one evening', () => {
    // 6 L a day at most → 1000 L takes at least 167 days of history
    const rows = Array.from({ length: 400 }, (_, i) => b('batch', T0 + Math.floor(i / 2) * DAY + i, created, 3000));
    expect(countStats(rows, created).liters).toBe(1200);
    expect(countStats(rows.slice(0, 300), created).liters).toBeLessThan(1000);
  });
});
