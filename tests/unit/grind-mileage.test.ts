import { describe, expect, it } from 'vitest';
import { fmtMass, grinderMileage } from '../../src/data/grind';

const g = [{ id: 'g1' }];
describe('grinder mileage', () => {
  it('sums what went through the burrs, skipping drips, samples and other grinders', () => {
    const brews = [
      { methodId: 'v60', dose: 15, fromPack: 16.5, gear: g },
      { methodId: 'espresso', dose: 18, gear: g },
      { methodId: 'cupping', dose: 11, gear: g, cva: { cups: 5, samples: [1, 2] } },
      { methodId: 'drip', dose: 12, gear: g },
      { methodId: 'v60', dose: 15, gear: g, sample: true },
      { methodId: 'v60', dose: 15, gear: [{ id: 'g2' }] },
      { methodId: 'v60', dose: 15 },
    ];
    expect(grinderMileage('g1', brews)).toEqual({ grams: 145, count: 3 });
  });
  it('formats grams and kilograms', () => {
    expect(fmtMass(850)).toBe('850 г');
    expect(fmtMass(12_440).replace(' ', ' ')).toBe('12,4 кг');
  });
});
