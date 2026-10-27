import { CloudFullError, CloudSync, type SyncStatus } from './sync';
import { merge, toBuckets } from './persist';
import { fromMarkdown, toMarkdown } from './backup';
import { emptyAffective, emptyDescriptive } from './cva';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platform } from '../platform';
import { emptyCupping, type Cupping } from './cupping';
import type { Scales } from './scales';
import type { Gear, GearRef } from './gear';
import type { Badge, BadgeLite } from './badges';
import type { RatingStats } from './ratings';
import { toMethod, type BrewPlan, type CustomMethod, type CustomRecipe } from './recipes';
import { setCustomMethods } from './methods';
import type { CvaSession } from './cva';

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
  /** бленд из нескольких зёрен (иначе — моносорт) */
  isBlend?: boolean;
  /** состав бленда */
  parts?: BlendPart[];
  /** ручная поправка остатка, г (просыпал, отдал другу, взвесил) */
  adjust?: number;
  /** пачка допита (убрана с полки) */
  finished?: boolean;
  sample?: boolean;
  /** 'drip' — коробка дрип-пакетов (иначе — пачка зерна) */
  kind?: 'beans' | 'drip';
  /** дрипов в коробке (если все одинаковые) */
  dripCount?: number;
  /** кофе в одном дрипе, г */
  dripWeight?: number;
  /** в коробке разные дрипы — каждый описан в drips */
  assorted?: boolean;
  drips?: DripItem[];
  /** профиль от обжарщика: шкалы 1–5 (кислотность, сладость, горечь, плотность, ферментация) */
  scales?: Scales;
}

/** Дрип в коробке-ассорти: своё происхождение и сколько штук */
export interface DripItem {
  id: string;
  name: string;
  country: string;
  region: string;
  farm: string;
  variety: string;
  process: string;
  roastLevel: string;
  /** дескрипторы с упаковки */
  notes: string;
  count: number;
}

export const isDrip = (b?: Pick<Bean, 'kind'> | null) => b?.kind === 'drip';
export const newDripItem = (): DripItem => ({ id: uid(), name: '', country: '', region: '', farm: '', variety: '', process: '', roastLevel: '', notes: '', count: 1 });

/** Компонент бленда */
export interface BlendPart {
  id: string;
  /** доля в %, строкой — как ввели */
  share: string;
  country: string;
  region: string;
  farm: string;
  variety: string;
  process: string;
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
  /** каппинг по SCA CVA: образцы, формы, режим */
  cva?: CvaSession;
  /** своя схема проливов (если варили не по стандартному рецепту) */
  plan?: BrewPlan;
  /** снимок оборудования, которым варили */
  gear?: GearRef[];
  /** автор, если рецепт пришёл от друга */
  author?: Author;
  /** id рецепта для оценок: свой — при первой отправке, чужой — из присланной ссылки */
  shareId?: string;
  /** telegram id автора (для чужих рецептов) — куда уходят оценки */
  authorId?: string;
  /** какой дрип из коробки-ассорти заварили */
  dripId?: string;
  sample?: boolean;
}

export interface Author { name: string; username?: string; badges?: BadgeLite[] }

export interface Profile {
  name: string;
  about: string;
  /** username в Telegram без @ */
  telegram: string;
  badges: Badge[];
  /** настройки «Поделиться» */
  shareTelegram: boolean;
  shareBadges: boolean;
  /** отправлять ли свои заметки к заварке */
  shareNotes?: boolean;
  /** вид интерфейса: авто, компьютер, телефон */
  layout?: 'auto' | 'desktop' | 'mobile';
  /** значки на витрине профиля (до 3): id своего значка или 'ach:<id>' достижения. undefined — выбрать автоматически */
  featured?: string[];
  /** оценки моих рецептов с сервера (кэш) */
  ratingStats?: RatingStats;
}

export interface Recipe { dose: number; ratio: number; temp: number; grind: string; gear?: string[]; recipeId?: string }

export interface TileLayout { order: string[]; size: Record<string, 1 | 2> }

export interface DB {
  v: 1;
  beans: Bean[];
  brews: Brew[];
  /** Последние параметры по методу — чтобы не вводить каждый раз */
  recipes: Record<string, Recipe>;
  gear: Gear[];
  profile: Profile;
  seeded?: boolean;
  gearSeeded?: boolean;
  /** свои рецепты */
  custom?: CustomRecipe[];
  /** свои методы заваривания */
  customMethods?: CustomMethod[];
  /** достижения, о которых уже показали уведомление */
  seenAch?: string[];
  /** мои оценки чужих рецептов: shareId → звёзды */
  rated?: Record<string, number>;
  /** закреплённые методы — наверху списка, в порядке закрепления */
  pinned?: string[];
  /** раскладка плиток методов на главной: порядок и размер (1 — только значок, 2 — значок с названием) */
  tiles?: TileLayout;
  /** когда менялась запись (для синхронизации): «b:id» заварка, «k:id» пачка, «g:id» оборудование,
   *  «c:id» свой рецепт, «x:id» свой метод, «r:метод» последние параметры, «p» профиль, «n» закрепы. Мс. */
  mod?: Record<string, number>;
  /** когда запись удалили — чтобы удаление дошло до других устройств. Мс. */
  del?: Record<string, number>;
}

/** Отметить изменённые и удалённые записи */
/** Подставить значения по умолчанию в данные из резервной копии (в Markdown пустые поля не пишутся) */
function normalizeBackup(data: { beans: Partial<Bean>[]; brews: Partial<Brew>[]; gear?: Partial<Gear>[]; custom?: Partial<CustomRecipe>[]; customMethods?: Partial<CustomMethod>[]; profile?: Partial<Profile> }) {
  const bean0 = emptyBean();
  return {
    ...data,
    beans: data.beans.map((b) => ({
      ...bean0, ...b, id: String(b.id ?? uid()),
      parts: b.parts?.map((x) => ({ share: '', country: '', region: '', farm: '', variety: '', process: '', ...(x as Partial<BlendPart>) })),
      drips: b.drips?.map((x) => ({ ...newDripItem(), ...(x as Partial<DripItem>) })),
    }) as Bean).map((b) => { if (!b.parts) delete b.parts; if (!b.drips) delete b.drips; return b; }),
    brews: data.brews.map((b) => ({
      beanId: null, grind: '', notes: '', time: 0, temp: 0, dose: 0, water: 0, rating: 0, descriptors: [],
      taste: { acidity: 3, sweetness: 3, bitterness: 2, body: 3 }, date: Date.now(), methodId: 'v60',
      ...b, id: String(b.id ?? uid()),
      cupping: b.cupping ? { ...emptyCupping(), ...b.cupping } : null,
      cva: b.cva ? { purpose: '', ...(b.cva as Partial<CvaSession>), samples: (b.cva.samples ?? []).map((x) => ({
        code: '', beanId: null, ...(x as Partial<typeof x>),
        affective: x.affective ? { ...emptyAffective(b.cva!.cups), ...x.affective } : undefined,
        descriptive: x.descriptive ? { ...emptyDescriptive(), ...x.descriptive } : undefined,
        extrinsic: x.extrinsic ? { checked: [], notes: {}, ...(x.extrinsic as Partial<typeof x.extrinsic>) } : undefined,
      })) } : undefined,
    }) as Brew),
    gear: (data.gear ?? []).map((g) => ({ details: '', cat: 'other' as const, name: '', ...g, id: String(g.id ?? uid()) }) as Gear),
    custom: (data.custom ?? []).map((r) => ({ notes: '', grind: '', steps: [], ...r }) as CustomRecipe),
    customMethods: (data.customMethods ?? []).map((m) => ({ about: '', grind: '', steps: [], tips: [], icon: 'cup' as const, ...m }) as CustomMethod),
    profile: { ...data.profile, badges: (data.profile?.badges ?? []).map((x) => ({ title: '', detail: '', year: '', ...(x as Partial<Badge>) }) as Badge) },
  };
}

export function stamp(d: DB, changed: string[], removed: string[] = []): Pick<DB, 'mod' | 'del'> {
  const t = Date.now();
  const mod = { ...(d.mod ?? {}) };
  const del = { ...(d.del ?? {}) };
  for (const k of changed) { mod[k] = t; delete del[k]; }
  for (const k of removed) { del[k] = t; delete mod[k]; }
  return { mod, del };
}

const KEY = 'brewbook.db.v1';
export const EMPTY: DB = { v: 1, beans: [], brews: [], recipes: {}, gear: [], profile: { name: '', about: '', telegram: '', badges: [], shareTelegram: true, shareBadges: true } };

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

function seedGear(): Gear[] {
  return [
    { id: 'sample-grinder', cat: 'grinder', name: 'Comandante C40', details: 'Red Clix', sample: true },
    { id: 'sample-dripper', cat: 'dripper', name: 'Hario V60 02', details: 'керамика', sample: true },
    { id: 'sample-kettle', cat: 'kettle', name: 'Fellow Stagg EKG', details: '', sample: true },
  ];
}

function seed(): Pick<DB, 'beans' | 'brews'> {
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const b1: Bean = {
    ...emptyBean(), id: 'sample-eth', name: 'Гуджи Ханджа', roaster: 'Пример обжарщика', country: 'Эфиопия',
    region: 'Гуджи', farm: 'Станция Ханджа', producer: 'Мелкие фермеры', variety: 'Эфиопские местные',
    process: 'Мытая', altitude: '2100–2300 м', harvest: '2026', roastLevel: 'Светлая',
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
      gear: [
        { id: 'sample-grinder', cat: 'grinder', name: 'Comandante C40', details: 'Red Clix' },
        { id: 'sample-dripper', cat: 'dripper', name: 'Hario V60 02', details: 'керамика' },
        { id: 'sample-kettle', cat: 'kettle', name: 'Fellow Stagg EKG' },
      ],
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
  gear: Gear[];
  profile: Profile;
  saveGear(g: Gear): void;
  deleteGear(id: string): void;
  saveProfile(p: Profile): void;
  rated: Record<string, number>;
  saveRated(rid: string, stars: number): void;
  setRatingStats(st: RatingStats): void;
  custom: CustomRecipe[];
  customMethods: CustomMethod[];
  saveMethod(m: CustomMethod): void;
  seenAch: string[] | null;
  pinned: string[];
  tiles: TileLayout;
  /** сохранить раскладку плиток (и закрепы — они идут первыми) */
  saveTiles(t: TileLayout, pinned: string[]): void;
  togglePin(methodId: string): void;
  markSeen(keys: string[]): void;
  saveCustom(r: CustomRecipe): void;
  deleteCustom(id: string): void;
  saveBean(b: Bean): void;
  deleteBean(id: string): void;
  saveBrew(b: Brew): void;
  deleteBrew(id: string): void;
  saveRecipe(methodId: string, r: Recipe): void;
  removeSamples(): void;
  exportJson(): string;
  exportMarkdown(): string;
  /** Markdown или JSON */
  importBackup(text: string): void;
  hasSamples: boolean;
  /** синхронизация между устройствами (Telegram CloudStorage) */
  sync: SyncStatus;
  syncNow(): void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(EMPTY);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const dbRef = useRef(db);
  dbRef.current = db;
  const [sync, setSync] = useState<SyncStatus>({ state: 'off' });
  const syncer = useRef<CloudSync | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const runSync = useCallback(async () => {
    const s = syncer.current;
    if (!s || !loaded.current) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    setSync((x) => ({ ...x, state: 'syncing' }));
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const got = await s.pull(dbRef.current.gear);
        if (got) {
          const base = dbRef.current;
          const merged = merge(base, got.remote);
          dbRef.current = merged;
          // если пользователь что-то поменял за это время — сливаем поверх его правок
          setDb((d) => (d === base ? merged : merge(d, got.remote)));
          await s.applied(got.names);
          await new Promise((res) => setTimeout(res, 0));
        }
        if ((await s.push(toBuckets(dbRef.current))) === 'ok') break;
      }
      setSync({ state: 'idle', at: Date.now(), usage: s.usage });
    } catch (e) {
      console.warn('Синхронизация не удалась', e);
      setSync({ state: 'error', at: s.lastAt, usage: s.usage, error: e instanceof CloudFullError ? e.message : e instanceof Error && e.message.startsWith('Данные') ? e.message : 'Нет связи с облаком Telegram — попробуем позже' });
    } finally {
      running.current = false;
      if (again.current) { again.current = false; setTimeout(runSync, 500); }
    }
  }, []);

  useEffect(() => {
    (async () => {
      let next: DB = EMPTY;
      try {
        const raw = await platform.storage.get(KEY);
        if (raw) next = { ...next, ...JSON.parse(raw) };
      } catch (e) { console.warn('Не удалось прочитать данные', e); }
      if (!next.seeded) next = { ...next, ...seed(), seeded: true };
      if (!next.gearSeeded) next = { ...next, gear: [...next.gear, ...(next.beans.some((b) => b.sample) ? seedGear() : [])], gearSeeded: true };
      next = { ...next, profile: { ...EMPTY.profile, ...next.profile } };
      // старые подписи степени обжарки: «Светлая (фильтр)» → «Светлая»
      next = { ...next, beans: next.beans.map((b) => (/ \(.+\)$/.test(b.roastLevel ?? '') ? { ...b, roastLevel: b.roastLevel.replace(/ \(.+\)$/, '') } : b)) };
      const tgUser = platform.user();
      if (!next.profile.name && tgUser?.name) next = { ...next, profile: { ...next.profile, name: tgUser.name } };
      if (!next.profile.telegram && tgUser?.username) next = { ...next, profile: { ...next.profile, telegram: tgUser.username } };
      loaded.current = true;
      dbRef.current = next;
      setDb(next);
      setReady(true);
      const cloud = platform.cloud;
      if (cloud) {
        syncer.current = new CloudSync(cloud, platform.storage);
        const st = await syncer.current.init();
        setSync({ state: 'idle', at: st.at, usage: st.usage });
        runSync();
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => { platform.storage.set(KEY, JSON.stringify(db)); }, 250);
    // в облако — чуть позже, чтобы серия правок ушла одним пакетом
    const c = syncer.current ? setTimeout(runSync, 2000) : undefined;
    return () => { clearTimeout(t); if (c) clearTimeout(c); };
  }, [db, runSync]);

  // вернулись в приложение — забираем правки с других устройств; уходим — отправляем свои
  useEffect(() => {
    const onVis = () => { if (syncer.current) runSync(); };
    document.addEventListener('visibilitychange', onVis);
    const every = setInterval(() => { if (document.visibilityState === 'visible') onVis(); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(every); };
  }, [runSync]);

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

  const saveBean = useCallback((b: Bean) => setDb((d) => ({ ...d, beans: upsert(d.beans, b), ...stamp(d, ['k:' + b.id]) })), []);
  const deleteBean = useCallback((id: string) => setDb((d) => ({
    ...d, beans: d.beans.filter((b) => b.id !== id),
    brews: d.brews.map((r) => (r.beanId === id ? { ...r, beanId: null } : r)),
    ...stamp(d, d.brews.filter((r) => r.beanId === id).map((r) => 'b:' + r.id), ['k:' + id]),
  })), []);
  const saveBrew = useCallback((b: Brew) => setDb((d) => ({ ...d, brews: upsert(d.brews, b).sort((a, z) => z.date - a.date), ...stamp(d, ['b:' + b.id]) })), []);
  const deleteBrew = useCallback((id: string) => setDb((d) => ({ ...d, brews: d.brews.filter((b) => b.id !== id), ...stamp(d, [], ['b:' + id]) })), []);
  const saveRecipe = useCallback((methodId: string, r: Recipe) => setDb((d) => ({ ...d, recipes: { ...d.recipes, [methodId]: r }, ...stamp(d, ['r:' + methodId]) })), []);
  const removeSamples = useCallback(() => setDb((d) => ({
    ...d, beans: d.beans.filter((b) => !b.sample), brews: d.brews.filter((b) => !b.sample), gear: d.gear.filter((g) => !g.sample),
  })), []);
  const saveGear = useCallback((g: Gear) => setDb((d) => ({ ...d, gear: d.gear.some((x) => x.id === g.id) ? d.gear.map((x) => (x.id === g.id ? g : x)) : [...d.gear, g], ...stamp(d, ['g:' + g.id]) })), []);
  const deleteGear = useCallback((id: string) => setDb((d) => ({ ...d, gear: d.gear.filter((g) => g.id !== id), ...stamp(d, [], ['g:' + id]) })), []);
  const saveProfile = useCallback((profile: Profile) => setDb((d) => {
    // вид интерфейса — настройка конкретного устройства, не синхронизируется
    const onlyLayout = JSON.stringify({ ...d.profile, layout: undefined }) === JSON.stringify({ ...profile, layout: undefined });
    return { ...d, profile, ...(onlyLayout ? {} : stamp(d, ['p'])) };
  }), []);
  const saveMethod = useCallback((m: CustomMethod) => setDb((d) => {
    const list = d.customMethods ?? [];
    return { ...d, customMethods: list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m], ...stamp(d, ['x:' + m.id]) };
  }), []);
  const saveTiles = useCallback((tiles: TileLayout, pinned: string[]) => setDb((d) => ({ ...d, tiles, pinned, ...stamp(d, ['h', 'n']) })), []);
  const togglePin = useCallback((id: string) => setDb((d) => { const p = d.pinned ?? []; return { ...d, pinned: p.includes(id) ? p.filter((x) => x !== id) : [...p, id], ...stamp(d, ['n']) }; }), []);
  const markSeen = useCallback((keys: string[]) => setDb((d) => ({ ...d, seenAch: [...new Set([...(d.seenAch ?? []), ...keys])] })), []);
  const saveCustom = useCallback((r: CustomRecipe) => setDb((d) => {
    const list = d.custom ?? [];
    return { ...d, custom: list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r], ...stamp(d, ['c:' + r.id]) };
  }), []);
  const deleteCustom = useCallback((id: string) => setDb((d) => ({ ...d, custom: (d.custom ?? []).filter((x) => x.id !== id), ...stamp(d, [], ['c:' + id]) })), []);
  const setRatingStats = useCallback((ratingStats: RatingStats) => setDb((d) => ({ ...d, profile: { ...d.profile, ratingStats } })), []);
  const saveRated = useCallback((rid: string, stars: number) => setDb((d) => ({ ...d, rated: { ...(d.rated ?? {}), [rid]: stars } })), []);

  const api = useMemo<StoreApi>(() => ({
    ready, beans: db.beans, brews: db.brews, recipes: db.recipes, gear: db.gear, profile: db.profile,
    saveBean, deleteBean, saveBrew, deleteBrew, saveRecipe, removeSamples, saveGear, deleteGear, saveProfile,
    rated: db.rated ?? {}, saveRated, setRatingStats,
    custom: db.custom ?? [], saveCustom, deleteCustom,
    customMethods: db.customMethods ?? [], saveMethod,
    seenAch: db.seenAch ?? null, markSeen, pinned: db.pinned ?? [], togglePin, tiles: db.tiles ?? { order: [], size: {} }, saveTiles,
    hasSamples: db.beans.some((b) => b.sample) || db.brews.some((b) => b.sample) || db.gear.some((g) => g.sample),
    sync, syncNow: () => { runSync(); },
    exportJson: () => JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2),
    exportMarkdown: () => toMarkdown(db),
    importBackup(text) {
      const t = text.trim();
      let data: Record<string, unknown> & { beans: Bean[]; brews: Brew[]; recipes?: Record<string, Recipe>; gear?: Gear[]; custom?: CustomRecipe[]; customMethods?: CustomMethod[]; pinned?: string[]; tiles?: TileLayout; profile?: Partial<Profile>; rated?: Record<string, number>; seenAch?: string[] };
      try { data = (t.startsWith('{') ? JSON.parse(t) : fromMarkdown(t)) as typeof data; }
      catch (e) { throw new Error(e instanceof Error && e.message.startsWith('Не похоже') ? e.message : 'Не получилось прочитать копию — проверьте файл'); }
      if (!Array.isArray(data.beans) || !Array.isArray(data.brews)) throw new Error('Это не файл резервной копии');
      data = normalizeBackup(data) as typeof data;
      setDb((d) => {
        const next: DB = { ...EMPTY, beans: data.beans, brews: data.brews, recipes: data.recipes ?? {}, gear: data.gear ?? [], custom: data.custom ?? [], customMethods: data.customMethods ?? [], pinned: data.pinned ?? [], tiles: data.tiles, rated: data.rated ?? {}, seenAch: data.seenAch ?? [], profile: { ...EMPTY.profile, ...(data.profile ?? {}) }, seeded: true, gearSeeded: true };
        const keys = (x: DB) => [
          ...x.beans.map((b) => 'k:' + b.id), ...x.brews.map((b) => 'b:' + b.id), ...x.gear.map((g) => 'g:' + g.id),
          ...(x.custom ?? []).map((c) => 'c:' + c.id), ...(x.customMethods ?? []).map((m) => 'x:' + m.id),
          ...Object.keys(x.recipes).map((m) => 'r:' + m), 'p', 'n',
        ];
        const fresh = keys(next);
        return { ...next, ...stamp(d, fresh, keys(d).filter((k) => !fresh.includes(k))) };
      });
    },
  }), [db, ready, saveBean, deleteBean, saveBrew, deleteBrew, saveRecipe, removeSamples, saveGear, deleteGear, saveProfile, saveRated, setRatingStats, saveCustom, deleteCustom, markSeen, saveMethod, togglePin, saveTiles, sync, runSync]);

  // Свои методы должны быть известны methodById() до отрисовки экранов
  setCustomMethods((db.customMethods ?? []).map(toMethod));

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
