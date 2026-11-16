import { describe, expect, it } from 'vitest';
import { fishFrame } from '../../src/ui/ascii';

describe('the fish in a glass', () => {
  it('is a glass of 15 × 10 characters with the fish inside', () => {
    const f = fishFrame(0).split('\n');
    expect(f).toHaveLength(10);
    for (const l of f) expect(l).toHaveLength(15);
    expect(fishFrame(0)).toMatch(/><\(8>|<8\)></);
  });
  it('swims there and back, turning at the walls, and lets out bubbles', () => {
    const xs = Array.from({ length: 14 }, (_, t) => { const r = fishFrame(t).split('\n').find((l) => /><\(8>|<8\)></.test(l))!; return [r.search(/><\(8>|<8\)></), r.includes('><(8>')]; });
    expect(Math.min(...xs.map((x) => x[0] as number))).toBe(2);
    expect(Math.max(...xs.map((x) => x[0] as number))).toBe(9);
    expect(new Set(xs.map((x) => x[1])).size).toBe(2);
    expect(Array.from({ length: 8 }, (_, t) => fishFrame(t)).some((f) => /o/.test(f.split('\n').slice(3, 7).join('').replace(/><\(8>|<8\)></g, '')))).toBe(true);
  });
  it('only ASCII', () => {
    for (let t = 0; t < 30; t++) expect(fishFrame(t)).toMatch(/^[\x20-\x7e\n]+$/);
  });
});

describe('the steam over the cup', () => {
  it('rises: three rows of ( ) over the cup, changing every tick, fading at the top', async () => {
    const { steamFrame, CUP } = await import('../../src/ui/ascii');
    const f = Array.from({ length: 6 }, (_, t) => steamFrame(t));
    for (const x of f) {
      const l = x.split('\n');
      expect(l).toHaveLength(3 + CUP.split('\n').length - 2);
      expect(l.slice(3).join('\n')).toBe(CUP.split('\n').slice(2).join('\n'));
      expect(l[1] + l[2]).toMatch(/[()]/);
      expect(l[0]).not.toMatch(/[()]/);
    }
    expect(new Set(f).size).toBeGreaterThan(2);
  });
});
