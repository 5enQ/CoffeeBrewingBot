import { describe, expect, it } from 'vitest';
import { rareOf, rareOfBean } from '../../src/data/rare';
import { countStats } from '../../src/data/levels';

describe('rare lots', () => {
  it('finds Japan by the country, in either language', () => {
    expect(rareOf('Япония', 'Typica')).toEqual(['japan']);
    expect(rareOf('Japan (Okinawa)')).toEqual(['japan']);
    expect(rareOf('Эфиопия', 'Heirloom')).toEqual([]);
  });
  it('finds eugenioides and liberica by the variety; excelsa counts as liberica', () => {
    expect(rareOf('Колумбия', 'Eugenioides')).toEqual(['eugenioides']);
    expect(rareOf('Колумбия', 'эужениоидис')).toEqual(['eugenioides']);
    expect(rareOf('Филиппины', 'Liberica Barako')).toEqual(['liberica']);
    expect(rareOf('Вьетнам', 'Excelsa')).toEqual(['liberica']);
    expect(rareOf('Бразилия', 'Catuai')).toEqual([]);
  });
  it('a blend counts each part once', () => {
    expect(rareOfBean({ country: 'Бленд', parts: [{ country: 'Япония' }, { variety: 'liberica' }, { variety: 'excelsa' }] }).sort()).toEqual(['japan', 'liberica']);
    expect(rareOfBean(null)).toEqual([]);
  });
  it('one counted brew opens the picture; a brew that does not count does not', () => {
    const T = Date.UTC(2026, 5, 1);
    const s = countStats([{ m: 'v60', w: 250, t: T, r: T, x: 'japan,liberica' }, { m: 'v60', w: 250, t: T, r: T }], T);
    expect(s.rare).toEqual(['japan', 'liberica']);
    // backdated past the import window: not counted, so no picture either
    const late = countStats([{ m: 'v60', w: 250, t: T, r: T + 30 * 86_400_000, x: 'eugenioides' }], T);
    expect(late.rare).toEqual([]);
  });
});
