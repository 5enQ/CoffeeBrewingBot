import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../../src/data/backup';
import { EMPTY, type DB } from '../../src/data/store';

describe('Markdown backup', () => {
  it('round-trips packs, brews and notes', () => {
    const db: DB = {
      ...EMPTY,
      profile: { ...EMPTY.profile, name: 'Тест', cardTheme: 'ach:method:v60', cardGear: ['g1', 'g2'] },
      beans: [{ id: 'k1', name: 'Кения "АА"', roaster: 'X', country: 'Кения', region: '', farm: '', variety: 'SL28', process: 'Мытая', roastLevel: 'Светлая', roastDate: '2026-10-01', weight: '250', notes: '', packNotes: 'смородина' } as unknown as DB['beans'][number]],
      brews: [{ id: 'b1', methodId: 'kalita', beanId: 'k1', date: Date.UTC(2026, 9, 10, 8), dose: 15.5, water: 250, temp: 93, grind: '22 щелчка', time: 185, rating: 4.5,
        taste: { acidity: 3, sweetness: 4, bitterness: 2, body: 3 }, descriptors: ['черника'], notes: 'Строка 1\nСтрока 2', cupping: null } as unknown as DB['brews'][number]],
    };
    const md = toMarkdown(db);
    expect(md).toContain('Kalita Wave');
    const back = fromMarkdown(md) as { beans: Record<string, unknown>[]; brews: Record<string, unknown>[] };
    expect(back.beans[0]).toMatchObject({ id: 'k1', name: 'Кения "АА"', variety: 'SL28', weight: '250' });
    expect((back as unknown as { profile: Record<string, unknown> }).profile).toMatchObject({ cardTheme: 'ach:method:v60', cardGear: ['g1', 'g2'] });
    expect(back.brews[0]).toMatchObject({ id: 'b1', methodId: 'kalita', beanId: 'k1', dose: 15.5, rating: 4.5, notes: 'Строка 1\nСтрока 2', descriptors: ['черника'] });
  });
});
