/**
 * Holiday looks (see data/holidays.ts): decorations hanging from the top of each page (cobwebs, a garland, coffee branches)
 * and lying at the end of each tab page (pumpkins, snowmen, coffee farmers) — they scroll with the page —, snow and fireworks over the app, and a greeting card on the brew tab. Nothing takes taps (pointer-events: none) except the card's close button.
 * All motion stops when the system asks for reduced motion; canvases pause while the app is hidden.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { activeHoliday, bannerHidden, fireworksDue, fireworksShown, hideBanner, type Holiday } from '../data/holidays';
import { reduceMotion } from './motion';
import { toast } from './toast';

export function useHoliday(): Holiday | null {
  const [h, setH] = useState(() => activeHoliday());
  useEffect(() => {
    const on = () => setH(activeHoliday());
    window.addEventListener('brewbook-holiday', on);
    const t = setInterval(on, 3_600_000);
    return () => { window.removeEventListener('brewbook-holiday', on); clearInterval(t); };
  }, []);
  return h;
}

/** play the fireworks now (the preview button in the testers' panel) */
export const playFireworks = () => window.dispatchEvent(new Event('brewbook-fireworks'));

/* ---------- the overlay ---------- */

export function HolidayLayer() {
  const h = useHoliday();
  const [boom, setBoom] = useState(false);
  useEffect(() => {
    if (h === 'newyear' && fireworksDue()) { fireworksShown(); setBoom(true); }
    const on = () => setBoom(true);
    window.addEventListener('brewbook-fireworks', on);
    return () => window.removeEventListener('brewbook-fireworks', on);
  }, [h]);
  // the page gets room at the bottom so the last rows are not hidden behind the ground decoration
  useEffect(() => {
    const root = document.documentElement;
    if (h) root.dataset.holiday = h; else delete root.dataset.holiday;
    return () => { delete root.dataset.holiday; };
  }, [h]);
  return (
    <>
      {h === 'newyear' && <Snow />}
      {boom && <Fireworks onDone={() => { setBoom(false); toast('С Новым годом! Пусть каждая чашка удаётся ☕'); }} />}
    </>
  );
}

/** the width of an element, followed as it changes */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * What hangs from the top of a page (cobwebs, a garland, coffee branches). It is part of the page:
 * it scrolls away with the content, like the title would without the sticky bar.
 */
export function HolidayTop() {
  const h = useHoliday();
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  if (!h) return null;
  return (
    <div ref={ref} className={`holiday-top ${h}`} aria-hidden="true">
      {w > 0 && h === 'halloween' && <><WebDrape w={w} /><Cobweb className="web-l" /><Cobweb className="web-r" /><Spider /></>}
      {w > 0 && h === 'newyear' && <TopGarland w={w} />}
      {h === 'coffeeday' && <><CoffeeBranch className="branch-l" /><CoffeeBranch className="branch-r" flip />{w > 520 && <CoffeeBranch className="branch-m" small />}</>}
    </div>
  );
}

/**
 * What lies at the very end of a tab page (pumpkins, snowmen, coffee farmers). Part of the page too: it is seen
 * when the page is scrolled to the end (or right away on a short page), resting on the bottom bar.
 */
export function HolidayGround() {
  const h = useHoliday();
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  if (!h) return null;
  return (
    <div ref={ref} className={`holiday-ground ${h}`} aria-hidden="true">
      {h === 'halloween' && <>
        <div className="ground-l"><Pumpkin size={46} /><Pumpkin size={30} face={false} /><Leaf c="#c8641e" r={-30} /></div>
        {w > 420 && <div className="ground-m"><Leaf c="#a8431c" r={40} /><Pumpkin size={26} face={false} /></div>}
        <div className="ground-r"><Leaf c="#e0a02a" r={15} /><Pumpkin size={34} face={false} /><Pumpkin size={52} /></div>
      </>}
      {h === 'newyear' && <>
        <svg className="drift" viewBox="0 0 100 14" preserveAspectRatio="none"><path d="M0 14 L0 9 C8 3 16 4 24 8 C34 12 42 5 52 6 C62 7 70 11 80 7 C88 4 95 6 100 9 L100 14 Z" /></svg>
        <div className="ground-l"><Snowman size={64} wave /><Snowman size={40} hat={false} /></div>
        <div className="ground-r"><Gift /><Snowman size={56} scarf="#3f7cac" /></div>
      </>}
      {h === 'coffeeday' && <>
        <div className="ground-l"><Picker /></div>
        <Walker />
        <div className="ground-r"><Sacks /><Picker flip /></div>
      </>}
    </div>
  );
}

/** threads of an old cobweb sagging along the top edge between the two corner webs */
function WebDrape({ w }: { w: number }) {
  const a = 96, b = w - 80;
  if (b - a < 60) return null;
  const n = Math.max(2, Math.round((b - a) / 110)), s = (b - a) / n;
  const swag = (sag: number, dy = 0) => Array.from({ length: n }, (_, i) => `${i ? '' : `M${a} ${2 + dy}`} Q${(a + s * (i + 0.5)).toFixed(1)} ${sag + dy} ${(a + s * (i + 1)).toFixed(1)} ${2 + dy}`).join(' ');
  return (
    <svg className="web-drape" width={w} height="44" viewBox={`0 0 ${w} 44`}>
      <path d={swag(30)} /><path d={swag(18, 1)} />
      {Array.from({ length: n }, (_, i) => { const x = a + s * (i + 0.5); return <path key={i} d={`M${x} 17 L${x - 2} 30 M${x - 2} 30 l-1 9`} className="strand" />; })}
    </svg>
  );
}

/** the garland across the whole top: wire swags between hooks, bulbs that blink in turn */
function TopGarland({ w }: { w: number }) {
  const colors = ['#ff5d5d', '#ffd45c', '#5dc8ff', '#7dff8a', '#ff8de0'];
  const n = Math.max(2, Math.round(w / 120)), s = w / n, sag = 14;
  const wire = Array.from({ length: n }, (_, i) => `${i ? '' : 'M0 2'} Q${(s * (i + 0.5)).toFixed(1)} ${2 + sag * 2} ${(s * (i + 1)).toFixed(1)} 2`).join(' ');
  // a point on swag i at t: the quadratic curve from (x0, 2) to (x0 + s, 2) with the control point 2*sag below
  const bulbs = Array.from({ length: n }, (_, i) => [0.2, 0.5, 0.8].map((t) => ({ x: s * (i + t), y: 2 + 2 * sag * 2 * t * (1 - t) }))).flat();
  return (
    <svg className="garland top-garland" width={w} height="40" viewBox={`0 0 ${w} 40`}>
      <path d={wire} fill="none" stroke="#3d5a3f" strokeWidth="1.6" />
      {bulbs.map((p, i) => (
        <g key={i} className={`bulb b${i % 3}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
          <rect x="-2.5" y="-1" width="5" height="4" rx="1" fill="#6b7a6c" />
          <ellipse cx="0" cy="8" rx="4.6" ry="6.4" fill={colors[i % colors.length]} />
        </g>
      ))}
    </svg>
  );
}

/** a coffee branch growing from the top edge: leaves in pairs and clusters of cherries, swaying a little */
function CoffeeBranch({ className, small = false, flip = false }: { className: string; small?: boolean; flip?: boolean }) {
  const nodes = [[30, 8], [64, 15], [98, 21], [130, 25]];
  return (
    <svg className={'coffee-branch ' + className} viewBox="0 0 160 52" width={small ? 104 : 160} height={small ? 34 : 52}>
      <g transform={flip ? 'matrix(-1 0 0 1 160 0)' : undefined}>
      <path d="M0 2 C40 6 90 18 156 27" stroke="#6b4a2b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x - 4} cy={y - 6} rx="12" ry="4.6" transform={`rotate(${-18 + i * 4} ${x - 4} ${y - 6})`} fill={i % 2 ? '#2f6b3d' : '#3d8049'} />
          <ellipse cx={x + 3} cy={y + 9} rx="13" ry="4.8" transform={`rotate(${30 - i * 4} ${x + 3} ${y + 9})`} fill={i % 2 ? '#3d8049' : '#2f6b3d'} />
          {i > 0 && [[-1, 3], [4, 5], [-5, 6], [1, 8]].map(([dx, dy], k) => (
            <circle key={k} cx={x + dx} cy={y + dy} r="3.1" fill={(i + k) % 4 === 3 ? '#e8a23a' : '#c7332b'} stroke="#8e2019" strokeWidth="0.6" />
          ))}
        </g>
      ))}
      </g>
    </svg>
  );
}

/** a fallen leaf */
function Leaf({ c, r }: { c: string; r: number }) {
  return (
    <svg className="leaf" viewBox="0 0 24 14" width="22" height="13" style={{ transform: `rotate(${r}deg)` }}>
      <path d="M1 7 C6 0 16 0 23 7 C16 14 6 14 1 7 Z" fill={c} /><path d="M2 7 H21" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
    </svg>
  );
}

/** a snowman; one of them waves */
function Snowman({ size, wave = false, hat = true, scarf = '#d6453a' }: { size: number; wave?: boolean; hat?: boolean; scarf?: string }) {
  return (
    <svg className={'snowman' + (wave ? ' waving' : '')} viewBox="0 0 60 72" width={size * 60 / 72} height={size}>
      <path d="M12 40 L1 30 M4 33 l-3 -1 M4 33 l0 -4" className="arm" />
      <g className={wave ? 'arm-wave' : ''}><path d="M48 40 L58 28 M55 31.5 l3 0 M55 31.5 l-1 -3" className="arm" /></g>
      <circle cx="30" cy="56" r="15" className="snow" /><circle cx="30" cy="33" r="11" className="snow" /><circle cx="30" cy="15" r="8.5" className="snow" />
      <circle cx="30" cy="31" r="1.3" fill="#2a2a30" /><circle cx="30" cy="37" r="1.3" fill="#2a2a30" /><circle cx="30" cy="52" r="1.4" fill="#2a2a30" />
      <circle cx="27" cy="13.5" r="1.2" fill="#2a2a30" /><circle cx="33" cy="13.5" r="1.2" fill="#2a2a30" />
      <path d="M30 16 l8 2 l-8 1.4 z" fill="#f08a26" />
      <path d="M21 23 Q30 27 39 23 L39 26 Q30 30 21 26 Z" fill={scarf} /><path d="M35 26 l3 9 l-4 0 l-1 -8 z" fill={scarf} />
      {hat && <><rect x="21" y="5" width="18" height="2.6" rx="1" fill="#2a2a30" /><rect x="24" y="-4" width="12" height="10" rx="1.5" fill="#2a2a30" /><rect x="24" y="2" width="12" height="2" fill="#c7332b" /></>}
    </svg>
  );
}

function Gift() {
  return (
    <svg className="gift" viewBox="0 0 30 28" width="26" height="24">
      <rect x="2" y="9" width="26" height="18" rx="2" fill="#c7332b" /><rect x="0" y="6" width="30" height="6" rx="1.5" fill="#e04a3f" />
      <rect x="13" y="6" width="4" height="21" fill="#ffd45c" /><path d="M15 6 C10 0 5 3 9 6 Z M15 6 C20 0 25 3 21 6 Z" fill="#ffd45c" />
    </svg>
  );
}

/** a farmer at a coffee shrub: the arm goes up to the cherries and back down to the basket */
function Picker({ flip = false }: { flip?: boolean }) {
  return (
    <svg className={'picker' + (flip ? ' flip' : '')} viewBox="0 0 90 64" width="79" height="56">
      {/* the shrub */}
      <path d="M66 64 C66 52 67 40 65 26" stroke="#6b4a2b" strokeWidth="3" fill="none" />
      {[[58, 26, -30], [72, 22, 30], [56, 38, -40], [76, 36, 35], [60, 50, -25], [74, 50, 30], [66, 16, 0]].map(([x, y, a], i) => (
        <ellipse key={i} cx={x} cy={y} rx="9" ry="4" transform={`rotate(${a} ${x} ${y})`} fill={i % 2 ? '#2f6b3d' : '#3d8049'} />
      ))}
      {[[62, 30], [70, 28], [60, 42], [72, 42], [66, 34], [64, 54]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill={i % 3 === 2 ? '#e8a23a' : '#c7332b'} />)}
      {/* the farmer */}
      <g transform="translate(28 0)">
        <path d="M-6 44 l-3 20 M6 44 l3 20" stroke="#4a3b2a" strokeWidth="5" strokeLinecap="round" />
        <path d="M-10 22 Q0 17 10 22 L12 46 L-12 46 Z" fill="#3f7cac" />
        <path d="M-9 26 Q-17 34 -12 42" stroke="#3f7cac" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M-22 36 h15 l-2 12 h-11 z" fill="#a8743d" /><path d="M-20 40 h11" stroke="#7d5229" strokeWidth="1" />
        <circle cx="-17" cy="36" r="2" fill="#c7332b" /><circle cx="-13" cy="35.5" r="2" fill="#c7332b" />
        <g className="pick-arm"><path d="M8 25 Q20 22 28 26" stroke="#3f7cac" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="30" cy="26" r="3" fill="#c4875a" /></g>
        <circle cx="0" cy="13" r="6.5" fill="#c4875a" />
        <ellipse cx="0" cy="7" rx="15" ry="3.6" fill="#e6c27a" /><path d="M-8 6.5 Q0 -4 8 6.5 Z" fill="#d4ad5f" /><path d="M-8 6 h16" stroke="#9a3b2a" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** sacks of green coffee */
function Sacks() {
  return (
    <svg className="sacks" viewBox="0 0 50 36" width="46" height="33">
      <path d="M4 36 C2 24 4 14 10 10 L22 10 C28 14 30 24 28 36 Z" fill="#c9a874" /><path d="M10 10 q6 -5 12 0" stroke="#9a7a48" strokeWidth="2" fill="none" />
      <path d="M22 36 C20 26 22 18 28 15 L40 15 C46 18 48 26 46 36 Z" fill="#b8955e" /><path d="M28 15 q6 -5 12 0" stroke="#8a6a3a" strokeWidth="2" fill="none" />
      <text x="34" y="30" textAnchor="middle" fontSize="7" fontWeight="700" fill="#6b4a2b">CAFÉ</text>
    </svg>
  );
}

/** a farmer walking across with a full basket on the back */
function Walker() {
  return (
    <div className="walker">
      <svg viewBox="0 0 40 60" width="34" height="51">
        <path className="leg l1" d="M17 40 l-2 19" stroke="#3b3b4a" strokeWidth="4.5" strokeLinecap="round" />
        <path className="leg l2" d="M23 40 l2 19" stroke="#3b3b4a" strokeWidth="4.5" strokeLinecap="round" />
        <rect x="4" y="18" width="12" height="16" rx="2" fill="#9a6a3a" /><path d="M5 23 h10 M5 28 h10" stroke="#7d5229" strokeWidth="1" />
        <circle cx="7" cy="17" r="2.2" fill="#c7332b" /><circle cx="11" cy="16" r="2.2" fill="#c7332b" /><circle cx="14" cy="17.5" r="2.2" fill="#e8a23a" />
        <path d="M12 18 h14 l3 24 h-20 z" fill="#c9503b" />
        <path className="swing" d="M26 22 q4 8 2 14" stroke="#c9503b" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <circle cx="21" cy="11" r="6" fill="#b97a4e" />
        <ellipse cx="21" cy="5.5" rx="12" ry="3" fill="#d9b268" /><path d="M15 5 Q21 -4 27 5 Z" fill="#c9a055" />
      </svg>
    </div>
  );
}

/** a cobweb spun in a corner: spokes from the corner and sagging threads between them */
function Cobweb({ className }: { className: string }) {
  const R = 120, spokes = 6;
  const pt = (r: number, i: number) => { const a = (i / (spokes - 1)) * (Math.PI / 2); return [r * Math.cos(a), r * Math.sin(a)]; };
  const rings = [22, 44, 66, 88, 110];
  return (
    <svg className={'cobweb ' + className} viewBox="0 0 120 120" width="120" height="120">
      {Array.from({ length: spokes }, (_, i) => { const [x, y] = pt(R, i); return <line key={i} x1="0" y1="0" x2={x} y2={y} />; })}
      {rings.map((r) => (
        <path key={r} d={Array.from({ length: spokes - 1 }, (_, i) => {
          const [x1, y1] = pt(r, i), [x2, y2] = pt(r, i + 1), [mx, my] = pt(r * 0.82, i + 0.5);
          return `${i ? '' : `M${x1.toFixed(1)} ${y1.toFixed(1)}`} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        }).join(' ')} />
      ))}
    </svg>
  );
}

/** a little spider hanging on its thread, swaying */
function Spider() {
  return (
    <div className="spider">
      <svg viewBox="0 0 40 120" width="40" height="120">
        <line x1="20" y1="0" x2="20" y2="94" className="thread" />
        <g className="spider-body" transform="translate(20 100)">
          {[-1, 1].map((s) => [0, 1, 2, 3].map((k) => (
            <path key={`${s}${k}`} d={`M0 ${-2 + k * 1.6} q${s * 6} ${-6 + k * 3} ${s * 11} ${-1 + k * 4.5}`} />
          )))}
          <ellipse cx="0" cy="2" rx="5.2" ry="6.2" className="abdomen" />
          <circle cx="0" cy="-5" r="3.4" className="head" />
          <circle cx="-1.3" cy="-5.6" r="0.9" className="eye" /><circle cx="1.3" cy="-5.6" r="0.9" className="eye" />
        </g>
      </svg>
    </div>
  );
}

/** a jack-o'-lantern */
export function Pumpkin({ size = 56, face = true }: { size?: number; face?: boolean }) {
  return (
    <svg viewBox="0 0 64 58" width={size} height={size * 58 / 64} className="pumpkin" aria-hidden="true">
      <path d="M30 12c-.5-4 .5-8 4-10" stroke="#5b6b2f" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M34 8c4-3 9-3 12 0" stroke="#6f8a35" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="19" cy="35" rx="15" ry="20" fill="#d9661a" />
      <ellipse cx="45" cy="35" rx="15" ry="20" fill="#d9661a" />
      <ellipse cx="32" cy="35" rx="14" ry="21.5" fill="#f08a26" />
      <path d="M24 17c-4 10-4 26 0 37M40 17c4 10 4 26 0 37" stroke="#c45512" strokeWidth="1.4" fill="none" opacity="0.7" />
      <path d="M12 22c-3 6-3 20 1 27" stroke="#ffb35c" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round" />
      {face && <g className="face">
        <path d="M18 30l6-6 4 7z M46 30l-6-6-4 7z" fill="#ffd45c" />
        <path d="M31 34l2.5 4h-5z" fill="#ffd45c" />
        <path d="M16 40c5 6 27 6 32 0l-3 1-2 3-3-2-3 3-3-3-3 3-3-3-3 2-2-3z" fill="#ffd45c" />
      </g>}
    </svg>
  );
}

/** falling snow over the app: a light canvas loop, ~30 fps, paused while hidden */
function Snow() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c || reduceMotion()) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = 0;
    const dark = () => {
      const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
      return (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000 < 128;
    };
    let color = dark() ? 'rgba(255,255,255,0.9)' : 'rgba(150,178,205,0.85)';
    const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); color = dark() ? 'rgba(255,255,255,0.9)' : 'rgba(150,178,205,0.85)'; };
    size();
    addEventListener('resize', size);
    const n = Math.min(90, Math.round((w * h) / 9000));
    const flakes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.2, v: 18 + Math.random() * 30, ph: Math.random() * 6.3 }));
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (document.hidden || t - last < 33) return;
      const dt = Math.min(0.06, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const f of flakes) {
        f.y += f.v * dt * (0.6 + f.r / 3); f.ph += dt; f.x += Math.sin(f.ph) * 0.35;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
  }, []);
  return <canvas ref={cv} className="holiday-snow" aria-hidden="true" />;
}

/** New Year fireworks: rockets rise and burst for a few seconds, then the layer goes away */
function Fireworks({ onDone }: { onDone(): void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const c = cv.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (reduceMotion()) { done.current(); return; }
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#ffd45c', '#ff6b6b', '#6bd6ff', '#9dff7a', '#ff9de6', '#ffffff', '#ffa94d'];
    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string; rocket?: boolean; ty?: number };
    let ps: P[] = [];
    let born: P[] = []; // sparks of this frame's bursts join after the frame (ps is being filtered)
    const t0 = performance.now();
    let nextRocket = t0, raf = 0, last = t0;
    const launch = () => ps.push({ x: w * (0.15 + Math.random() * 0.7), y: h + 10, vx: (Math.random() - 0.5) * 40, vy: -(h * 0.9 + Math.random() * h * 0.3), life: 1, color: '#fff3c4', rocket: true, ty: h * (0.18 + Math.random() * 0.3) });
    const burst = (x: number, y: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)], n = 70 + Math.floor(Math.random() * 30), sp = 150 + Math.random() * 110;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = sp * (0.6 + Math.random() * 0.5); born.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color }); }
    };
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (t - t0 < 3600 && t >= nextRocket) { launch(); nextRocket = t + 280 + Math.random() * 260; }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 0, w, h); // trails fade
      ctx.globalCompositeOperation = 'lighter';
      ps = ps.filter((p) => {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.rocket) {
          p.vy += 520 * dt;
          if (p.y <= p.ty! || p.vy >= 0) { burst(p.x, p.y); return false; }
          ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.5, p.y - 4, 3, 8);
          return true;
        }
        p.vy += 90 * dt; p.vx *= 0.985; p.vy *= 0.985; p.life -= dt * 0.6;
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.max(0, p.life) * 0.25; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        return true;
      });
      if (born.length) { ps = ps.concat(born); born = []; }
      if (t - t0 > 3600 && !ps.length) { done.current(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} className="holiday-fireworks" aria-hidden="true" />;
}

/* ---------- the greeting card on the brew tab ---------- */

const TEXT: Record<Holiday, { title: string; text: string }> = {
  halloween: { title: 'Хеллоуин', text: 'Тыквенный латте сам себя не сварит. Только без паутины в кофемолке.' },
  newyear: { title: 'С Новым годом!', text: 'Пусть в новом году каждая чашка будет такой, как задумано.' },
  coffeeday: { title: 'Международный день кофе', text: '1 октября — спасибо всем, кто выращивает и собирает кофе, обжаривает его и варит для нас.' },
};

export function HolidayBanner() {
  const h = useHoliday();
  const [, re] = useState(0);
  if (!h || bannerHidden(h)) return null;
  return (
    <div className={`holiday-card holiday-${h}`}>
      <button type="button" className="holiday-close" aria-label="Скрыть поздравление" onClick={() => { hideBanner(h); re((n) => n + 1); }}>×</button>
      <div className="holiday-art" aria-hidden="true">
        {h === 'halloween' && <div className="pumpkins"><Pumpkin size={44} face={false} /><Pumpkin size={64} /><Pumpkin size={40} /></div>}
        {h === 'newyear' && <Garland />}
        {h === 'coffeeday' && <CoffeeDayScene />}
      </div>
      <div className="holiday-text"><b>{TEXT[h].title}</b><span>{TEXT[h].text}</span></div>
    </div>
  );
}

/** a garland of lights that blink in turn */
function Garland() {
  const colors = ['#ff5d5d', '#ffd45c', '#5dc8ff', '#7dff8a', '#ff8de0'];
  const pts = Array.from({ length: 11 }, (_, i) => { const x = 10 + i * 32; return { x, y: 14 + Math.sin((i / 10) * Math.PI) * 18 }; });
  return (
    <svg viewBox="0 0 340 52" className="garland" preserveAspectRatio="none">
      <path d={`M0 10 ${pts.map((p) => `L${p.x} ${p.y}`).join(' ')} L340 10`} fill="none" stroke="#3d5a3f" strokeWidth="1.6" />
      {pts.map((p, i) => (
        <g key={i} className={`bulb b${i % 3}`} transform={`translate(${p.x} ${p.y + 3})`}>
          <rect x="-2.5" y="-3" width="5" height="4" rx="1" fill="#6b7a6c" />
          <ellipse cx="0" cy="6" rx="4.6" ry="6.4" fill={colors[i % colors.length]} />
        </g>
      ))}
    </svg>
  );
}

/**
 * International Coffee Day: from the farm to the cup. On the left a farmer picks ripe cherries from a coffee shrub
 * into a basket, another works on the hill behind; on the right a barista pours from a gooseneck kettle into a dripper;
 * between them the coffee travels as a trail of beans.
 */
export function CoffeeDayScene() {
  const cherries = [[96, 52], [104, 60], [88, 66], [112, 48], [100, 74], [118, 64], [84, 54], [108, 80]];
  const leaves = [[92, 46, -30], [110, 42, 25], [80, 60, -50], [120, 56, 40], [96, 70, -20], [114, 74, 30], [86, 80, -40], [104, 88, 10], [124, 84, 50]];
  return (
    <svg viewBox="0 0 340 140" className="coffee-scene" role="img" aria-label="Фермер собирает кофе, бариста варит кофе">
      <defs>
        <linearGradient id="cd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdf3e1" /><stop offset="1" stopColor="#e9f1dc" /></linearGradient>
        <linearGradient id="cd-cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7b4a2a" /><stop offset="1" stopColor="#4a2b18" /></linearGradient>
      </defs>
      <rect width="340" height="140" rx="16" fill="url(#cd-sky)" />
      <circle cx="54" cy="30" r="14" fill="#ffd98a" opacity="0.8" />
      {/* hills of the farm */}
      <path d="M0 98 C40 70 90 74 140 90 C170 98 190 104 200 110 L200 140 L0 140 Z" fill="#9cc27f" />
      <path d="M0 112 C50 92 110 96 170 116 L170 140 L0 140 Z" fill="#7aa964" />
      {/* the second farmer on the hill, with a basket on the back */}
      <g transform="translate(150 78) scale(0.55)">
        <ellipse cx="0" cy="-30" rx="13" ry="3.5" fill="#d9b268" /><path d="M-7 -31 Q0 -42 7 -31 Z" fill="#c9a055" />
        <circle cx="0" cy="-24" r="6" fill="#b97a4e" />
        <path d="M-8 -17 h16 l3 22 h-22 z" fill="#c9503b" />
        <rect x="6" y="-16" width="10" height="14" rx="2" fill="#9a6a3a" />
        <path d="M-6 5 l-2 16 M6 5 l2 16" stroke="#3b3b4a" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* coffee shrub with ripe cherries */}
      <path d="M102 112 C100 96 103 80 100 60" stroke="#6b4a2b" strokeWidth="4" fill="none" strokeLinecap="round" />
      {leaves.map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx="9" ry="4.2" transform={`rotate(${a} ${x} ${y})`} fill={i % 2 ? '#2f6b3d' : '#3d8049'} />)}
      {cherries.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.3" fill={i % 4 === 3 ? '#e8a23a' : '#c7332b'} stroke="#8e2019" strokeWidth="0.6" />)}
      {/* the farmer: straw hat, reaching for the shrub, basket on the hip */}
      <g transform="translate(52 64)">
        <ellipse cx="0" cy="-14" rx="20" ry="5" fill="#e6c27a" /><path d="M-10 -15 Q0 -30 10 -15 Z" fill="#d4ad5f" /><path d="M-10 -16 h20" stroke="#9a3b2a" strokeWidth="2" />
        <circle cx="0" cy="-6" r="8" fill="#c4875a" />
        <path d="M-12 4 Q0 -2 12 4 L15 38 L-15 38 Z" fill="#3f7cac" />
        <path d="M10 8 Q26 0 36 -10" stroke="#3f7cac" strokeWidth="7" fill="none" strokeLinecap="round" />
        <circle cx="38" cy="-12" r="4" fill="#c4875a" />
        <path d="M-10 10 Q-20 22 -10 30" stroke="#3f7cac" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M-26 22 h20 l-3 16 h-14 z" fill="#a8743d" /><path d="M-24 27 h16 M-23 32 h14" stroke="#7d5229" strokeWidth="1.2" />
        <circle cx="-19" cy="21" r="2.6" fill="#c7332b" /><circle cx="-14" cy="20" r="2.6" fill="#c7332b" /><circle cx="-10" cy="22" r="2.6" fill="#e8a23a" />
        <path d="M-8 38 l-3 26 M8 38 l3 26" stroke="#4a3b2a" strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* the journey: a trail of beans from the shrub to the cup */}
      <path d="M132 70 C160 40 200 40 222 70" stroke="#a37a55" strokeWidth="1.4" strokeDasharray="3 5" fill="none" />
      {[[150, 52, -20], [176, 44, 0], [202, 52, 25]].map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}><ellipse rx="5" ry="3.6" fill="#6b3f22" /><path d="M-4 0 Q0 -1.5 4 0" stroke="#3d2212" strokeWidth="1" fill="none" /></g>
      ))}
      {/* the café counter */}
      <rect x="200" y="110" width="140" height="30" fill="#7a5238" /><rect x="200" y="106" width="140" height="6" fill="#9a6b4a" />
      {/* the barista: apron in the app's green, pouring from a gooseneck kettle */}
      <g transform="translate(292 60)">
        <path d="M-9 -16 Q0 -28 9 -16 Q10 -8 6 -6 L-6 -6 Q-10 -8 -9 -16 Z" fill="#3a2a22" />
        <circle cx="0" cy="-10" r="8" fill="#e0b08a" />
        <path d="M-13 0 Q0 -6 13 0 L15 46 L-15 46 Z" fill="#f4f1ea" />
        <path d="M-10 6 h20 l2 40 h-24 z" fill="#2c6a4c" /><path d="M-7 6 v-8 M7 6 v-8" stroke="#2c6a4c" strokeWidth="2" />
        <path d="M-12 6 Q-28 10 -34 0" stroke="#f4f1ea" strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* kettle */}
        <path d="M-50 -10 h16 v14 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 z" fill="#c9d1d6" />
        <path d="M-50 -6 Q-60 -8 -62 -18" stroke="#c9d1d6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M-34 -6 q6 0 6 6" stroke="#8a969c" strokeWidth="2" fill="none" />
      </g>
      {/* dripper over a glass server, the stream and steam */}
      <path d="M232 46 C231 56 232 66 233 72" stroke="#8a5a36" strokeWidth="1.2" fill="none" />
      <path d="M220 72 h26 l-9 14 h-8 z" fill="#efe8dc" stroke="#cbbfae" strokeWidth="1" />
      <path d="M223 88 h20 v18 a3 3 0 0 1 -3 3 h-14 a3 3 0 0 1 -3 -3 z" fill="#dfe9ee" opacity="0.8" stroke="#b9c8cf" strokeWidth="1" />
      <path d="M224 96 h18 v10 a2 2 0 0 1 -2 2 h-14 a2 2 0 0 1 -2 -2 z" fill="url(#cd-cup)" />
      <path className="steam" d="M258 92 q-4 -6 0 -12 q4 -6 0 -12 M266 94 q-4 -6 0 -12 q4 -6 0 -12" stroke="#b9a48e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M252 96 h20 v8 a8 8 0 0 1 -8 8 h-4 a8 8 0 0 1 -8 -8 z" fill="#ffffff" stroke="#d8cfc2" strokeWidth="1" />
      <path d="M272 99 q6 0 6 4 q0 4 -6 4" stroke="#d8cfc2" strokeWidth="1.6" fill="none" />
      <ellipse cx="262" cy="97.5" rx="9" ry="1.8" fill="#6b3f22" />
    </svg>
  );
}
