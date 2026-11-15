import { describe, expect, it } from 'vitest';
import { fishFrame } from '../../src/ui/ascii';

describe('the fish in a glass', () => {
  it('is a glass of 13 × 7 characters with the fish inside', () => {
    const f = fishFrame(0).split('\n');
    expect(f).toHaveLength(7);
    for (const l of f) expect(l).toHaveLength(13);
    expect(fishFrame(0)).toMatch(/><\(o>|<o\)></);
  });
  it('swims there and back, turning at the walls, and lets out bubbles', () => {
    const xs = Array.from({ length: 12 }, (_, t) => { const r = fishFrame(t).split('\n').find((l) => /><\(o>|<o\)></.test(l))!; return [r.search(/><\(o>|<o\)></), r.includes('><(o>')]; });
    expect(Math.min(...xs.map((x) => x[0] as number))).toBe(1);
    expect(Math.max(...xs.map((x) => x[0] as number))).toBe(7);
    expect(new Set(xs.map((x) => x[1])).size).toBe(2);
    expect(Array.from({ length: 8 }, (_, t) => fishFrame(t)).some((f) => /o/.test(f.split('\n').slice(1, 6).join('').replace(/><\(o>|<o\)></g, '')))).toBe(true);
  });
  it('only ASCII', () => {
    for (let t = 0; t < 30; t++) expect(fishFrame(t)).toMatch(/^[\x20-\x7e\n]+$/);
  });
});
