import { describe, expect, it } from 'vitest';
import { METHODS, allMethods, methodById, setCustomMethods, type Method } from '../../src/data/methods';

describe('methods', () => {
  it('uses Russian names for Chemex, AeroPress and Clever', () => {
    expect(methodById('chemex').name).toBe('Кемекс');
    expect(methodById('aeropress').name).toBe('Аэропресс');
    expect(methodById('clever').name).toBe('Клевер');
  });

  it('hides Kalita Wave from lists but still resolves it for old brews', () => {
    expect(allMethods().map((m) => m.id)).not.toContain('kalita');
    expect(methodById('kalita').name).toBe('Kalita Wave');
    expect(methodById('kalita').steps.length).toBeGreaterThan(0);
  });

  it('hides archived custom methods and names unknown ones', () => {
    const base = METHODS[0];
    setCustomMethods([{ ...base, id: 'cm1', name: 'Мой', custom: true }, { ...base, id: 'cm2', name: 'Старый', custom: true, archived: true }] as Method[]);
    const ids = allMethods().map((m) => m.id);
    expect(ids).toContain('cm1');
    expect(ids).not.toContain('cm2');
    expect(methodById('cm2').name).toBe('Старый');
    expect(methodById('nope').name).toBe('Удалённый метод');
    setCustomMethods([]);
  });

  it('a copied method keeps its name', () => {
    const copy = { ...methodById('chemex') };
    expect(copy.name).toBe('Кемекс');
  });
});
