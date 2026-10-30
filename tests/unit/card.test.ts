import { describe, expect, it } from 'vitest';
import { cardSetup, cleanCard, resolveTheme, unlockedThemes } from '../../src/data/card';
import type { Gear } from '../../src/data/gear';
import type { Brew } from '../../src/data/store';

const brews = (methodId: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${methodId}${i}`, methodId, water: 250, date: i } as unknown as Brew));

describe('profile card', () => {
  it('method tiers: bronze 50, silver 100, gold 500, volume 1000', () => {
    const tierOf = (n: number) => unlockedThemes(brews('v60', n), 0).find((x) => x.key === 'ach:method:v60')?.theme;
    expect(tierOf(49)).toBeUndefined();
    expect(tierOf(50)).toMatchObject({ tier: 'bronze', icon: 'v60' });
    expect(tierOf(100)).toMatchObject({ tier: 'silver' });
    expect(tierOf(500)).toMatchObject({ tier: 'gold' });
    expect(tierOf(1000)).toMatchObject({ tier: 'volume', icon: 'v60' });
  });

  it('diamond only for 1000 liters; lower liters tiers and ratings give no background', () => {
    const big = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, methodId: `cm${i % 300}`, water: 1000, date: i } as unknown as Brew));
    expect(unlockedThemes(big(999), 50000).some((x) => x.key === 'ach:liters' || x.key === 'ach:ratings')).toBe(false);
    expect(unlockedThemes(big(1000), 0).find((x) => x.key === 'ach:liters')?.theme).toMatchObject({ tier: 'diamond', icon: 'drop' });
  });

  it('keeps the achievement of a retired method', () => {
    expect(unlockedThemes(brews('kalita', 100), 0).map((x) => x.key)).toContain('ach:method:kalita');
  });

  it('falls back to the default theme when an achievement is gone', () => {
    expect(resolveTheme('ach:method:v60', [])).toEqual({ base: 'paper' });
    expect(resolveTheme('ocean', [])).toEqual({ base: 'ocean' });
    expect(resolveTheme('nonsense', [])).toEqual({ base: 'paper' });
  });

  it('setup: one item per category by default, no retired filters, chosen order kept', () => {
    const gear = [
      { id: 'a', cat: 'grinder', name: 'C40' }, { id: 'b', cat: 'grinder', name: 'K-Ultra' }, { id: 'c', cat: 'filter', name: 'Abaca' }, { id: 'd', cat: 'kettle', name: 'Stagg' },
    ] as Gear[];
    expect(cardSetup(gear).map((g) => g.name)).toEqual(['C40', 'Stagg']);
    expect(cardSetup(gear, ['d', 'b', 'c']).map((g) => g.name)).toEqual(['Stagg', 'K-Ultra']);
  });

  it('cleans a card from the network', () => {
    const c = cleanCard({ name: ' Аня ', username: 'anya<script>', photo: 'http://x', theme: { tier: 'diamond', icon: 'drop', title: '10 000 литров' },
      badges: [{ title: 'A' }, { title: '' }], setup: [{ cat: 'nope', name: 'X' }], extra: 1 });
    expect(c).toMatchObject({ name: 'Аня', username: 'anyascript', theme: { tier: 'diamond' }, setup: [{ cat: 'other', name: 'X' }] });
    expect(c?.photo).toBeUndefined();
    expect(c?.badges).toHaveLength(1);
    expect(cleanCard({ name: '' })).toBeNull();
    expect(cleanCard({ name: 'B', theme: { tier: 'platinum' } })?.theme).toEqual({ base: 'paper' });
    expect(cleanCard({ name: 'B', theme: { tier: 'diamond', icon: 'drop' }, no: 3 })?.no).toBe(3);
    expect(cleanCard({ name: 'B', theme: { tier: 'gold', icon: 'v60' }, no: 3 })?.no).toBeUndefined();
    expect(cleanCard({ name: 'B', theme: { tier: 'volume', icon: 'v60' } })?.theme).toMatchObject({ tier: 'volume' });
  });
});
