import { describe, expect, it } from 'vitest';
import { cardSetup, cleanCard, resolveTheme, unlockedThemes } from '../../src/data/card';
import type { Gear } from '../../src/data/gear';
import type { Brew } from '../../src/data/store';

const brews = (methodId: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${methodId}${i}`, methodId, water: 250, date: i } as unknown as Brew));

describe('profile card', () => {
  it('unlocks metal themes from achievements, best tier first, with the method icon', () => {
    const t = unlockedThemes([...brews('v60', 100), ...brews('aeropress', 1000)], 0);
    expect(t[0].theme).toMatchObject({ tier: 'silver' });
    expect(t.find((x) => x.key === 'ach:method:aeropress')?.theme).toMatchObject({ tier: 'silver', icon: 'aeropress' });
    expect(t[t.length - 1].theme).toMatchObject({ tier: 'bronze' });
    expect(t.map((x) => x.key)).toContain('ach:method:v60');
    expect(t.find((x) => x.key === 'ach:liters')?.theme).toMatchObject({ tier: 'silver', icon: 'drop' });
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
  });
});
