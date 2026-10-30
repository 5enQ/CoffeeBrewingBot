import { describe, expect, it } from 'vitest';
import { AFF_SECTIONS, affectiveScore, dosePerCup, emptyAffective } from '../../src/data/cva';

describe('SCA CVA', () => {
  it('dose is 8.25 g per 150 ml', () => {
    expect(dosePerCup(150)).toBe(8.3);
    expect(dosePerCup(200)).toBe(11);
  });
  it('affective score follows SCA 104, 5.5', () => {
    const a = emptyAffective();
    expect(affectiveScore(a)).toBeNull();
    AFF_SECTIONS.forEach((s) => { a.scores[s.key] = 6; });
    expect(affectiveScore(a)).toBe(84.25); // 0.65625·48 + 52.75 = 84.25
    a.nonUniform[0] = true;
    a.defective[0] = true;
    expect(affectiveScore(a)).toBe(82.25); // defect without a type is not counted
    a.defectType = 'moldy';
    expect(affectiveScore(a)).toBe(78.25);
  });
});
