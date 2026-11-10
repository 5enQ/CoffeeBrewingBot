/** UI animations: tab transitions, the active-tab "bubble", tile reordering */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)';

/* ---------- Tab transitions ---------- */

/**
 * Tab contents: on switch the new tab slides in from the side, the old one slides out the other way.
 * Direction follows the tab order in the bottom bar.
 */
export function TabPages<T extends string>({ tab, order, render }: { tab: T; order: T[]; render(t: T): ReactNode }) {
  const [leaving, setLeaving] = useState<{ tab: T; dir: number; scroll: number } | null>(null);
  const [prevTab, setPrevTab] = useState(tab);
  const scroll = useRef(0);
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  // remember the leaving tab's scroll so it slides away from where it was
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

/* ---------- Active tab "bubble" ---------- */

/**
 * Background under the active tab. On switch it stretches to the new tab
 * and shrinks onto it — as if flowing over.
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

/* ---------- Smooth reordering (FLIP) ---------- */

type Box = { x: number; y: number; w: number };

/**
 * Container children with a data-flip attribute glide to their new place and width.
 * Call snapshot() before a change: it records where tiles are visible now (including a running animation),
 * so the new animation continues from there instead of jumping back to the old point.
 * The container must be position: relative (offsetLeft is measured from it).
 */
export function useFlip(ref: RefObject<HTMLElement | null>, skip?: string | null) {
  const prev = useRef(new Map<string, Box>());
  const snap = useRef<Map<string, Box> | null>(null);

  const snapshot = useCallback(() => {
    const box = ref.current;
    if (!box) return;
    const br = box.getBoundingClientRect();
    const m = new Map<string, Box>();
    box.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const r = el.getBoundingClientRect();
      m.set(el.dataset.flip!, { x: r.left - br.left - box.clientLeft, y: r.top - br.top - box.clientTop, w: r.width });
    });
    snap.current = m;
  }, [ref]);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    // the screen is hidden (another screen is open on top): every box measures 0×0 here.
    // Keep the last real positions, or coming back would animate the tiles from a zero size in the corner.
    if (!box.getClientRects().length) { snap.current = null; return; }
    const next = new Map<string, Box>();
    const calm = reduceMotion();
    box.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip!;
      const now = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth };
      next.set(id, now);
      const was = snap.current?.get(id) ?? prev.current.get(id);
      if (calm || !was || id === skip) return;
      if (Math.abs(was.x - now.x) < 0.5 && Math.abs(was.y - now.y) < 0.5 && Math.abs(was.w - now.w) < 0.5) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([
        { transform: `translate(${was.x - now.x}px, ${was.y - now.y}px)`, width: `${was.w}px` },
        { transform: 'translate(0, 0)', width: `${now.w}px` },
      ], { duration: 240, easing: EASE });
    });
    prev.current = next;
    snap.current = null;
  });

  return snapshot;
}

/* ---------- Changes that move ----------
   After the craft rules of the Stageshow skill: «every change moves», «change only what changed».
   Off with reduced motion: the new value just stands there. */

const ROLL_MS = 420;

/**
 * A value that rolls: only the characters that changed move — the old one up and out, the new one in from below
 * (down when the number went down), the last digit first; unchanged characters stand still. Right-aligned, so
 * «95» → «100» grows to the left like a counter.
 */
export function Roll({ text, className }: { text: string; className?: string }) {
  const prev = useRef(text);
  const [pair, setPair] = useState<{ from: string; to: string; down: boolean; n: number } | null>(null);
  useLayoutEffect(() => {
    if (prev.current === text) return;
    const from = prev.current;
    prev.current = text;
    if (reduceMotion()) return;
    const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    const a = num(from), b = num(text);
    setPair((p) => ({ from, to: text, down: !Number.isNaN(a) && !Number.isNaN(b) && b < a, n: (p?.n ?? 0) + 1 }));
    const t = setTimeout(() => setPair(null), ROLL_MS + 200);
    return () => clearTimeout(t);
  }, [text]);
  if (!pair || pair.to !== text) return <span className={'roll' + (className ? ' ' + className : '')}>{text}</span>;
  const len = Math.max(pair.from.length, text.length);
  const A = [...pair.from.padStart(len, ' ')], B = [...text.padStart(len, ' ')];
  return (
    <span className={'roll' + (className ? ' ' + className : '')} aria-label={text} key={pair.n}>
      {B.map((ch, i) => (A[i] === ch
        ? <span key={i} aria-hidden="true">{ch === ' ' ? '' : ch}</span>
        // the old character is the box's ::before (absolutely placed), so the element's text is only the new value
        : <span key={i} className={'roll-d' + (pair.down ? ' down' : '')} data-c={A[i] === '\u2007' ? '' : A[i]} style={{ animationDelay: `${(len - 1 - i) * 35}ms` }} aria-hidden="true">
            <span className="roll-new">{ch === '\u2007' ? '' : ch}</span>
          </span>))}
    </span>
  );
}

/**
 * Content that is replaced by other content of the same kind (a step's title, its hint): the old leaves upward
 * as the new arrives from below, in the same place; the container stays.
 */
export function Swap({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  const last = useRef<{ id: string | number; node: ReactNode }>({ id, node: children });
  const [old, setOld] = useState<{ id: string | number; node: ReactNode } | null>(null);
  // the old layer leaves on its own timer: re-renders in between (a running clock) must not cancel it
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (last.current.id !== id && !reduceMotion()) {
      setOld(last.current);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOld(null), 420);
    }
    last.current = { id, node: children };
  });
  return (
    <span className={'swap' + (className ? ' ' + className : '')}>
      {old && <span className="swap-l out" key={'o' + old.id} aria-hidden="true">{old.node}</span>}
      <span className={'swap-l' + (old ? ' in' : '')} key={'n' + id}>{children}</span>
    </span>
  );
}
