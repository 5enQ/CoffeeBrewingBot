/** Анимации интерфейса: перелистывание вкладок, «пузырёк» под активной вкладкой, перестановка плиток */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)';

/* ---------- Перелистывание вкладок ---------- */

/**
 * Содержимое вкладок: при переключении новая въезжает сбоку, старая уезжает в другую сторону.
 * Направление — по порядку вкладок в нижнем меню.
 */
export function TabPages<T extends string>({ tab, order, render }: { tab: T; order: T[]; render(t: T): ReactNode }) {
  const [leaving, setLeaving] = useState<{ tab: T; dir: number; scroll: number } | null>(null);
  const [prevTab, setPrevTab] = useState(tab);
  const scroll = useRef(0);
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  // прокрутку уходящей вкладки запоминаем, чтобы она уезжала с того места, где была
  useLayoutEffect(() => {
    const on = () => { scroll.current = window.scrollY; };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  if (prevTab !== tab) {
    const dir = Math.sign(order.indexOf(tab) - order.indexOf(prevTab)) || 1;
    setPrevTab(tab);
    if (!reduceMotion()) setLeaving({ tab: prevTab, dir, scroll: scroll.current });
  }

  useLayoutEffect(() => {
    if (!leaving) return;
    const opts = { duration: 320, easing: EASE };
    const a = inRef.current?.animate([{ transform: `translateX(${leaving.dir * 100}%)` }, { transform: 'translateX(0)' }], opts);
    outRef.current?.animate([
      { transform: `translate(0, ${-leaving.scroll}px)` },
      { transform: `translate(${-leaving.dir * 100}%, ${-leaving.scroll}px)` },
    ], { ...opts, fill: 'forwards' });
    let done = false;
    const end = () => { if (!done) { done = true; setLeaving(null); } };
    a?.finished.then(end, end);
    const t = setTimeout(end, 500);
    return () => clearTimeout(t);
  }, [leaving]);

  return (
    <div className={'tab-pages' + (leaving ? ' moving' : '')}>
      {leaving && leaving.tab !== tab && (
        <div className="tab-page leaving" key={leaving.tab} ref={outRef} aria-hidden="true" inert>{render(leaving.tab)}</div>
      )}
      <div className="tab-page" key={tab} ref={inRef}>{render(tab)}</div>
    </div>
  );
}

/* ---------- «Пузырёк» активной вкладки ---------- */

/**
 * Подложка под активной вкладкой. При переключении она вытягивается до новой вкладки
 * и стягивается к ней — будто перетекает.
 */
export function useTabPill(navRef: RefObject<HTMLElement | null>, pillRef: RefObject<HTMLElement | null>, key: string) {
  const last = useRef<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current, pill = pillRef.current;
    if (!nav || !pill) return;
    const place = (animate: boolean) => {
      const btn = nav.querySelector<HTMLElement>('button.on');
      if (!btn) { pill.style.opacity = '0'; return; }
      const w = Math.min(btn.offsetWidth - 8, 84);
      const x = btn.offsetLeft + (btn.offsetWidth - w) / 2;
      pill.style.opacity = '1';
      pill.style.top = `${btn.offsetTop}px`;
      pill.style.height = `${btn.offsetHeight}px`;
      pill.style.width = `${w}px`;
      pill.style.transform = `translateX(${x}px)`;
      const from = last.current;
      last.current = { x, w };
      if (!animate || !from || (from.x === x && from.w === w) || reduceMotion()) return;
      const left = Math.min(from.x, x);
      const span = Math.abs(x - from.x) + Math.max(w, from.w);
      pill.animate([
        { transform: `translateX(${from.x}px)`, width: `${from.w}px` },
        { transform: `translateX(${left}px)`, width: `${span}px`, offset: 0.45 },
        { transform: `translateX(${x}px)`, width: `${w}px` },
      ], { duration: 420, easing: EASE });
    };
    place(true);
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [navRef, pillRef, key]);
}

/* ---------- Плавная перестановка (FLIP) ---------- */

/**
 * Дети контейнера с атрибутом data-flip плавно переезжают на новое место и меняют ширину.
 * Контейнер должен быть position: relative (offsetLeft считается от него).
 */
export function useFlip(ref: RefObject<HTMLElement | null>, skip?: string | null) {
  const prev = useRef(new Map<string, { x: number; y: number; w: number }>());
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const next = new Map<string, { x: number; y: number; w: number }>();
    const calm = reduceMotion();
    box.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip!;
      const now = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth };
      next.set(id, now);
      const was = prev.current.get(id);
      if (calm || !was || id === skip) return;
      if (was.x === now.x && was.y === now.y && was.w === now.w) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([
        { transform: `translate(${was.x - now.x}px, ${was.y - now.y}px)`, width: `${was.w}px` },
        { transform: 'translate(0, 0)', width: `${now.w}px` },
      ], { duration: 260, easing: EASE });
    });
    prev.current = next;
  });
}
