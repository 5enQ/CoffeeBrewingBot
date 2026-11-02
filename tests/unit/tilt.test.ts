import { describe, expect, it } from 'vitest';
import { gravityOf, lookOf, planeOf, rollOf } from '../../src/data/tilt';

describe('tilt as gravity', () => {
  it('upright phone: no turn, the screen faces the viewer', () => {
    const g = gravityOf(90, 0);
    expect(rollOf(g)).toBeCloseTo(0);
    expect(lookOf(g)).toBeCloseTo(0);
    expect(planeOf(g)).toBeCloseTo(1);
  });
  it('flat on a table: faces up, the turn has no meaning', () => {
    const g = gravityOf(0, 0);
    expect(lookOf(g)).toBeCloseTo(1);
    expect(planeOf(g)).toBeCloseTo(0);
  });
  it('held at 60° from the table: half way up', () => {
    expect(lookOf(gravityOf(60, 0))).toBeCloseTo(0.5);
  });
  it('the right edge down is a clockwise turn, the left edge down an anticlockwise one', () => {
    expect(rollOf(gravityOf(60, 20))).toBeGreaterThan(0.1);
    expect(rollOf(gravityOf(60, -20))).toBeLessThan(-0.1);
  });
  it('past upright (gamma flips by 180°) the turn stays continuous', () => {
    // the same physical pose written two ways: beta 100, gamma 10 and beta 80, gamma -170
    const a = rollOf(gravityOf(100, 10)), b = rollOf(gravityOf(80, -170));
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});
