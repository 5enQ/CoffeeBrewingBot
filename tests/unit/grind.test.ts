import { describe, expect, it } from 'vitest';
import { fmtGrind, guessGrindType, unitOf } from '../../src/data/grind';

describe('grind units', () => {
  it('detects popular hand grinders', () => {
    expect(guessGrindType('Comandante C40')).toBe('manual');
    expect(guessGrindType('Timemore C2')).toBe('manual');
    expect(guessGrindType('Fellow Ode')).toBeUndefined();
  });
  it('picks the unit by grinder type', () => {
    expect(unitOf('manual')).toBe('clicks');
    expect(unitOf('electric')).toBe('um');
    expect(unitOf('mechanical')).toBeNull();
  });
  it('formats values (with a non-breaking space)', () => {
    const f = (v: number, u: 'clicks' | 'um') => fmtGrind(v, u).replace(/\u00a0/g, ' ');
    expect(f(22, 'clicks')).toBe('22 щелчка');
    expect(f(25, 'clicks')).toBe('25 щелчков');
    expect(f(650, 'um')).toBe('650 µm');
  });
});
