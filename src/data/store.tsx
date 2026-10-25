import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platform } from '../platform';
import type { Cupping } from './cupping';

export interface Bean {
  id: string;
  name: string;        // название лота
  roaster: string;
  country: string;
  region: string;
  farm: string;        // ферма / станция
  producer: string;
  variety: string;     // сорт
  process: string;     // обработка
  altitude: string;
  harvest: string;
  roastLevel: string;
  roastDate: string;   // YYYY-MM-DD
  weight: string;      // граммы в пачке
  barcode: string;
  link: string;
  packNotes: string;   // дескрипторы обжарщика
  comment: string;
  createdAt: number;
  sample?: boolean;
}

export interface QuickTaste {
  acidity: number;   // 1..5
  sweetness: number;
  bitterness: number;
  body: number;
}

export interface Brew {
  id: string;
  date: number;
  methodId: string;
  beanId: string | null;
  dose: number;
  water: number;     // вода или выход (для эспрессо)
  temp: number;
  grind: string;
  time: number;      // фактическое время, сек
  rating: number;    // 0..5
  taste: QuickTaste;
  descriptors: string[];
  notes: string;
  cupping: Cupping | null;
  sample?: boolean;
}

export interface Recipe { dose: number; ratio: number; temp: number; grind: string }

interface DB {
  v: 1;
  beans: Bean[];
  brews: Brew[];
  /** Последние параметры по методу — чтобы не вводить каждый раз */
  recipes: Record<string, Recipe>;
  seeded?: boolean;
}

const KEY = 'brewbook.db.v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function emptyBean(): Bean {
  return {
    id: uid(), name: '', roaster: '', country: '', region: '', farm: '', producer: '', variety: '',
    process: '', altitude: '', harvest: '', roastLevel: '', roastDate: '', weight: '', barcode: '',
    link: '', packNotes: '', comment: '', createdAt: Date.now(),
  };
}

export const daysSince = (iso: string) => {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(+d)) return null;
  return Math.floor((Date.now() - +d) / 86_400_000);
};

function seed(): Pick<DB, 'beans' | 'brews'> {
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const b1: Bean = {
    ...emptyBean(), id: 'sample-eth', name: 'Гуджи Ханджа', roaster: 'Пример обжарщика', country: 'Эфиопия',
    region: 'Гуджи', farm: 'Станция Ханджа', producer: 'Мелкие фермеры', variety: 'Эфиопские местные',
    process: 'Мытая', altitude: '2100–2300 м', harvest: '2026', roastLevel: 'Светлая (фильтр)',
    roastDate: iso(12), weight: '250', barcode: '4600000000017', packNotes: 'бергамот, персик, жасмин',
    createdAt: now - 12 * 86_400_000, sample: true,
  };
  const b2: Bean = {
    ...emptyBean(), id: 'sample-col', name: 'Финка Эль Мирадор', roaster: 'Пример обжарщика', country: 'Колумбия',
    region: 'Уила', farm: 'Эль Мирадор', producer: 'Семья Ортис', variety: 'Кастильо, Катурра',
    process: 'Анаэробная натуральная', altitude: '1750 м', harvest: '2026', roastLevel: 'Омни',
    roastDate: iso(20), weight: '250', packNotes: 'клубника, ром, молочный шоколад',
    createdAt: now - 20 * 86_400_000, sample: true,
  };
  const brews: Brew[] = [
    {
      id: 'sample-brew-1', date: now - 2 * 3_600_000, methodId: 'v60', beanId: b1.id, dose: 15, water: 250,
      temp: 95, grind: 'Comandante 24', time: 192, rating: 4,
      taste: { acidity: 4, sweetness: 4, bitterness: 1, body: 2 },
      descriptors: ['бергамот', 'персик', 'чёрный чай'],
      notes: 'Яркая, чайная. В следующий раз на 1 клик мельче — чуть водянисто в финише.',
      cupping: null, sample: true,
    },
    {
      id: 'sample-brew-2', date: now - 26 * 3_600_000, methodId: 'cupping', beanId: b2.id, dose: 8.25, water: 150,
      temp: 93, grind: 'EK43 · 9', time: 660, rating: 4,
      taste: { acidity: 3, sweetness: 5, bitterness: 2, body: 4 },
      descriptors: ['клубника', 'ромовый', 'молочный шоколад'],
      notes: 'Ферментация заметна, но чистая. Лучше раскрывается на остывании.',
      cupping: {
        scores: { fragrance: 8.25, flavor: 8.25, aftertaste: 7.75, acidity: 7.75, body: 8, balance: 7.75, overall: 8 },
        intensity: { fragrance: [4, 5], acidity: 3, body: 4 },
        cups: {
          uniformity: [true, true, true, true, true],
          cleanCup: [true, true, true, true, false],
          sweetness: [true, true, true, true, true],
        },
        defects: { taintCups: 0, faultCups: 0 },
        descriptors: ['клубника', 'ромовый', 'молочный шоколад'],
        notes: 'Одна чашка с винной резкостью.',
      },
      sample: true,
    },
  ];
  return { beans: [b1, b2], brews };
}

interface StoreApi {
  ready: boolean;
  beans: Bean[];
  brews: Brew[];
  recipes: Record<string, Recipe>;
  saveBean(b: Bean): void;
  deleteBean(id: string): void;
  saveBrew(b: Brew): void;
  deleteBrew(id: string): void;
  saveRecipe(methodId: string, r: Recipe): void;
  removeSamples(): void;
  exportJson(): string;
  importJson(json: string): void;
  hasSamples: boolean;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>({ v: 1, beans: [], brews: [], recipes: {} });
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      let next: DB = { v: 1, beans: [], brews: [], recipes: {} };
      try {
        const raw = await platform.storage.get(KEY);
        if (raw) next = { ...next, ...JSON.parse(raw) };
      } catch (e) { console.warn('Не удалось прочитать данные', e); }
      if (!next.seeded) next = { ...next, ...seed(), seeded: true };
      loaded.current = true;
      setDb(next);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => { platform.storage.set(KEY, JSON.stringify(db)); }, 250);
    return () => clearTimeout(t);
  }, [db]);

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

  const saveBean = useCallback((b: Bean) => setDb((d) => ({ ...d, beans: upsert(d.beans, b) })), []);
  const deleteBean = useCallback((id: string) => setDb((d) => ({
    ...d, beans: d.beans.filter((b) => b.id !== id),
    brews: d.brews.map((r) => (r.beanId === id ? { ...r, beanId: null } : r)),
  })), []);
  const saveBrew = useCallback((b: Brew) => setDb((d) => ({ ...d, brews: upsert(d.brews, b).sort((a, z) => z.date - a.date) })), []);
  const deleteBrew = useCallback((id: string) => setDb((d) => ({ ...d, brews: d.brews.filter((b) => b.id !== id) })), []);
  const saveRecipe = useCallback((methodId: string, r: Recipe) => setDb((d) => ({ ...d, recipes: { ...d.recipes, [methodId]: r } })), []);
  const removeSamples = useCallback(() => setDb((d) => ({
    ...d, beans: d.beans.filter((b) => !b.sample), brews: d.brews.filter((b) => !b.sample),
  })), []);

  const api = useMemo<StoreApi>(() => ({
    ready, beans: db.beans, brews: db.brews, recipes: db.recipes,
    saveBean, deleteBean, saveBrew, deleteBrew, saveRecipe, removeSamples,
    hasSamples: db.beans.some((b) => b.sample) || db.brews.some((b) => b.sample),
    exportJson: () => JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2),
    importJson(json) {
      const data = JSON.parse(json);
      if (!Array.isArray(data.beans) || !Array.isArray(data.brews)) throw new Error('Это не файл экспорта дневника');
      setDb({ v: 1, beans: data.beans, brews: data.brews, recipes: data.recipes ?? {}, seeded: true });
    },
  }), [db, ready, saveBean, deleteBean, saveBrew, deleteBrew, saveRecipe, removeSamples]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
