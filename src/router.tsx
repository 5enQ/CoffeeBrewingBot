import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platform } from './platform';
import type { Bean, Brew } from './data/store';
import type { Gear } from './data/gear';
import type { SharedRecipe } from './data/share';

export type Tab = 'brew' | 'journal' | 'beans' | 'profile';

export type Route =
  | { name: 'method'; methodId: string; beanId?: string | null; from?: Brew }
  | { name: 'timer'; draft: Brew }
  | { name: 'brewEdit'; draft: Brew; isNew: boolean; openCupping?: boolean }
  | { name: 'brew'; id: string }
  | { name: 'bean'; id: string }
  | { name: 'beanEdit'; bean: Bean; isNew: boolean; scanOnOpen?: boolean }
  | { name: 'gearEdit'; gear: Gear; isNew: boolean }
  | { name: 'share'; id: string }
  | { name: 'shared'; recipe: SharedRecipe };

interface RouterApi {
  tab: Tab;
  setTab(t: Tab): void;
  stack: Route[];
  push(r: Route): void;
  replace(r: Route): void;
  /** force — без вопроса «выйти без сохранения?» */
  back(force?: boolean): void;
  reset(): void;
}

const Ctx = createContext<RouterApi | null>(null);

/** Подтверждения «назад» по глубине стека: экран может спросить, точно ли уходить */
const guards = new Map<number, string>();
export const DepthCtx = createContext(0);

export function useBackGuard(active: boolean, message: string) {
  const depth = useContext(DepthCtx);
  useEffect(() => {
    if (active) guards.set(depth, message); else guards.delete(depth);
    return () => { guards.delete(depth); };
  }, [active, message, depth]);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('brew');
  const [stack, setStack] = useState<Route[]>([]);

  const depthRef = useRef(0);
  depthRef.current = stack.length;

  const back = useCallback(async (force?: boolean) => {
    const msg = guards.get(depthRef.current);
    if (!force && msg && !(await platform.confirm(msg))) return;
    guards.delete(depthRef.current);
    platform.haptic('light');
    setStack((s) => s.slice(0, -1));
  }, []);

  // помним прокрутку каждого экрана, чтобы «назад» возвращал на то же место
  const scrolls = useRef<number[]>([]);
  const prevLen = useRef(0);
  useEffect(() => {
    platform.setBackHandler(stack.length ? () => back() : null);
    const grew = stack.length > prevLen.current;
    prevLen.current = stack.length;
    requestAnimationFrame(() => window.scrollTo({ top: grew ? 0 : scrolls.current[stack.length] ?? 0 }));
  }, [stack.length, back]);

  const api = useMemo<RouterApi>(() => ({
    tab,
    setTab(t) { platform.haptic('select'); guards.clear(); setTabState(t); setStack([]); window.scrollTo({ top: 0 }); },
    stack,
    push(r) { platform.haptic('light'); scrolls.current[depthRef.current] = window.scrollY; setStack((s) => [...s, r]); },
    replace(r) { guards.delete(depthRef.current); setStack((s) => [...s.slice(0, -1), r]); },
    back,
    reset() { guards.clear(); setStack([]); },
  }), [tab, stack, back]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRouter() {
  const r = useContext(Ctx);
  if (!r) throw new Error('RouterProvider missing');
  return r;
}
