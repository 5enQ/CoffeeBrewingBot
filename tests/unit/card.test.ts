import { describe, expect, it } from 'vitest';
import { buildCard, cardSetup, cardView, cleanCard, unlockedThemes } from '../../src/data/card';
import type { Gear } from '../../src/data/gear';
import { EMPTY } from '../../src/data/store';
import type { Stats } from '../../src/data/levels';

const stats = (methods: Record<string, number>, liters = 0, ratings = 0): Stats => ({ methods, liters, ratings });

describe('card backgrounds', () => {
  it('method tiers: bronze 50, silver 100, gold 500, volume 1000', () => {
    const tierOf = (n: number) => unlockedThemes(stats({ v60: n })).find((x) => x.key === 'ach:method:v60');
    expect(tierOf(49)).toBeUndefined();
    expect(tierOf(50)).toMatchObject({ tier: 'bronze', icon: 'v60' });
    expect(tierOf(100)?.tier).toBe('silver');
    expect(tierOf(500)?.tier).toBe('gold');
    expect(tierOf(1000)).toMatchObject({ tier: 'volume', icon: 'v60' });
  });

  it('diamond only for 1000 liters; lower liters tiers and ratings give no background', () => {
    expect(unlockedThemes(stats({}, 999, 50000)).length).toBe(0);
    expect(unlockedThemes(stats({}, 1000))[0]).toMatchObject({ key: 'ach:liters', tier: 'diamond', icon: 'drop' });
  });

  it('keeps the achievement of a retired method', () => {
    expect(unlockedThemes(stats({ kalita: 100 })).map((x) => x.key)).toContain('ach:method:kalita');
  });
});

describe('card data', () => {
  const profile = { ...EMPTY.profile, name: 'Аня', telegram: 'anya', cardTheme: 'ach:method:v60' };
  const featured = [{ key: 'ach:method:v60', badge: { kind: 'achieve' as const, title: 'x', detail: '', year: '' } }, { key: 'b1', badge: { kind: 'sca' as const, title: 'SCA Brewing', detail: '', year: '' } }];

  it('names achievements by key and fills levels from the numbers', () => {
    const c = buildCard(profile, featured, [], stats({ v60: 120 }));
    expect(c.theme).toEqual({ ach: 'method:v60' });
    expect(c.ach).toEqual(['method:v60']);
    expect(c.badges.map((b) => b.title)).toEqual(['SCA Brewing']);
    const v = cardView(c);
    expect(v.theme).toMatchObject({ tier: 'silver', icon: 'v60' });
    expect(v.badges.map((b) => b.detail)).toContain('Серебро');
  });

  it('a background that is not earned falls back to the default', () => {
    expect(buildCard(profile, featured, [], stats({ v60: 10 })).theme).toEqual({ base: 'paper' });
  });

  it('without levels from the server a shared card shows no metal and no achievement badges', () => {
    const shared = cleanCard({ name: 'B', theme: { ach: 'method:v60' }, ach: ['method:v60'], badges: [{ kind: 'achieve', title: 'Fake' }, { kind: 'sca', title: 'Real' }] })!;
    expect(cardView(shared)).toEqual({ theme: { base: 'paper' }, badges: [{ kind: 'sca', title: 'Real', detail: '', year: '' }] });
    const withLevels = cleanCard({ ...shared, earned: { 'method:v60': { tier: 'gold', at: 500 } } })!;
    expect(cardView(withLevels).theme).toMatchObject({ tier: 'gold' });
  });

  it('setup: one item per category by default, no retired filters, chosen order kept', () => {
    const gear = [
      { id: 'a', cat: 'grinder', name: 'C40' }, { id: 'b', cat: 'grinder', name: 'K-Ultra' }, { id: 'c', cat: 'filter', name: 'Abaca' }, { id: 'd', cat: 'kettle', name: 'Stagg' },
    ] as Gear[];
    expect(cardSetup(gear).map((g) => g.name)).toEqual(['C40', 'Stagg']);
    expect(cardSetup(gear, ['d', 'b', 'c']).map((g) => g.name)).toEqual(['Stagg', 'K-Ultra']);
  });

  it('cleans a card from the network', () => {
    const c = cleanCard({ name: ' Аня ', username: 'anya<script>', photo: 'http://x', theme: { ach: 'evil' }, setup: [{ cat: 'nope', name: 'X' }], no: 3 });
    expect(c).toMatchObject({ name: 'Аня', username: 'anyascript', theme: { base: 'paper' }, setup: [{ cat: 'other', name: 'X' }], no: 3 });
    expect(c?.photo).toBeUndefined();
    expect(cleanCard({ name: '' })).toBeNull();
  });
});
