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

describe('the coffee tree', () => {
  it('four stages by the brews of two weeks', async () => {
    const { treeStage } = await import('../../src/ui/ascii');
    expect([0, 1, 3, 4, 9, 10, 30].map(treeStage)).toEqual([1, 2, 2, 3, 3, 4, 4]);
  });
  it('a lush tree has far more leaves than a dying one, which is yellow and drops them', async () => {
    const { treeFrame } = await import('../../src/ui/ascii');
    const count = (st: 1 | 2 | 3 | 4, k: string) => treeFrame(st, 0).flat().filter(([, c]) => c === k).reduce((n, [s]) => n + s.replace(/ /g, '').length, 0);
    const leaves = (st: 1 | 2 | 3 | 4) => count(st, 'l') + count(st, 'd') + count(st, 'y');
    expect(leaves(4)).toBeGreaterThan(leaves(3));
    expect(leaves(3)).toBeGreaterThan(leaves(2));
    expect(leaves(2)).toBeGreaterThan(leaves(1));
    expect(count(1, 'l') + count(1, 'd')).toBe(0);
    expect(Array.from({ length: 8 }, (_, t) => count(1, 'f') + treeFrame(1, t).flat().filter(([, c]) => c === 'f').length).some((n) => n > 0)).toBe(true);
  });
  it('sways: frames differ, the pot and trunk stay', async () => {
    const { treeFrame } = await import('../../src/ui/ascii');
    const txt = (t: number) => treeFrame(4, t).map((r) => r.map(([s]) => s).join('')).join('\n');
    expect(txt(0)).not.toBe(txt(3));
    expect(txt(0).split('\n').slice(17).join()).toBe(txt(3).split('\n').slice(17).join());
    for (const row of treeFrame(4, 5)) expect(row.map(([s]) => s).join('')).toHaveLength(48);
  });
});
