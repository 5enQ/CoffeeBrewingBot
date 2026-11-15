import { describe, expect, it } from 'vitest';
import { bootLines, KONAMI_LENGTH, konamiStep, phosphorOn } from '../../src/data/phosphor';
import { cleanCard } from '../../src/data/card';

const type = (codes: string[]) => codes.reduce((at, c) => konamiStep(at, c), 0);
const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

describe('Konami code', () => {
  it('the whole code reaches the end', () => expect(type(CODE)).toBe(KONAMI_LENGTH));
  it('a wrong key starts over; an extra ↑ at the start still works', () => {
    expect(type(['ArrowUp', 'ArrowDown', ...CODE.slice(2)])).toBeLessThan(KONAMI_LENGTH);
    expect(type(['ArrowUp', ...CODE])).toBe(KONAMI_LENGTH);
    expect(type(['KeyX', ...CODE])).toBe(KONAMI_LENGTH);
  });
});

describe('the style', () => {
  it('is on only with the card chosen and the secret found', () => {
    expect(phosphorOn({ cardTheme: 'phosphor', secrets: ['phosphor'] })).toBe(true);
    expect(phosphorOn({ cardTheme: 'paper', secrets: ['phosphor'] })).toBe(false);
    expect(phosphorOn({ cardTheme: 'phosphor' })).toBe(false);
  });
  it('a shared card keeps it', () => {
    expect(cleanCard({ name: 'Аня', theme: { base: 'phosphor' } })?.theme).toEqual({ base: 'phosphor' });
  });
  it('the BIOS names the setup, or says it is missing', () => {
    const l = bootLines({ version: '1.7.5', grinder: 'Comandante C40', packs: 2, grams: 430, brews: 12 });
    expect(l[0][0]).toBe('BREWBOOK BIOS v1.7.5');
    expect(l.map(([, v]) => v)).toEqual(['(c) 2026', '640K OK', 'Comandante C40', 'не найдена', '2 пачки · 430 г', '12', 'BREWBOOK.EXE']);
  });
});
