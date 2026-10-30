import { beforeEach, describe, expect, it, vi } from 'vitest';
import { healthWarning } from '../../src/data/health';
import type { Brew } from '../../src/data/store';

const NOW = new Date(2026, 9, 30, 20, 0).getTime();
const brew = (id: string, extra: Partial<Brew> = {}) => ({ id, methodId: 'v60', date: NOW - 60_000, ...extra }) as Brew;

describe('health warning', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
  });
  it('warns on the 11th own brew of the day, once', () => {
    const ten = Array.from({ length: 10 }, (_, i) => brew(`b${i}`));
    expect(healthWarning(ten.slice(0, 9), brew('n'), NOW)).toBeNull();
    expect(healthWarning(ten, brew('n'), NOW)).toMatch(/11 заварок/);
    expect(healthWarning([...ten, brew('n')], brew('m'), NOW)).toBeNull();
  });
  it('ignores samples, cuppings, recipes of others and other days', () => {
    const noise = [
      ...Array.from({ length: 5 }, (_, i) => brew(`s${i}`, { sample: true } as Partial<Brew>)),
      ...Array.from({ length: 5 }, (_, i) => brew(`c${i}`, { methodId: 'cupping' })),
      ...Array.from({ length: 5 }, (_, i) => brew(`y${i}`, { date: NOW - 86_400_000 })),
      ...Array.from({ length: 9 }, (_, i) => brew(`b${i}`)),
    ];
    expect(healthWarning(noise, brew('n'), NOW)).toBeNull();
    expect(healthWarning(noise, brew('n', { methodId: 'cupping' }), NOW)).toBeNull();
  });
});
