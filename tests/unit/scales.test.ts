import { describe, expect, it } from 'vitest';
import { scaleKeyOf, scaleValueOf } from '../../src/data/scales';

describe('roaster scales', () => {
  it.each([
    ['two', 2], ['five', 5], ['Высокая', 5], ['Средняя', 3], ['Низкая', 1], ['ниже средней', 2], ['выше средней', 4],
    ['очень высокая', 5], ['3/5', 3], ['4 из 5', 4], ['7/10', 4], ['3', 3], ['9', null], ['что-то', null],
  ] as [string, number | null][])('%s → %s', (raw, want) => expect(scaleValueOf(raw)).toBe(want));

  it('maps labels to keys', () => {
    expect(scaleKeyOf('Кислотность')).toBe('acidity');
    expect(scaleKeyOf('Плотность')).toBe('body');
    expect(scaleKeyOf('Горечь:')).toBe('bitterness');
    expect(scaleKeyOf('Оценка')).toBeNull();
  });
});
