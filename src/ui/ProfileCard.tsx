/**
 * Profile card. Base themes are flat colors; bronze / silver / gold are brushed metal with a sheen that follows the tilt;
 * diamond is a faceted, iridescent 3D card that turns with the device (or the mouse on a computer).
 */
import { memo, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cardView, type CardData } from '../data/card';
import { catById } from '../data/gear';
import type { IconKey } from '../data/methods';
import { platform } from '../platform';
import { requestTiltPermission } from '../platform/web';
import { BadgeRow } from './Badges';
import { Icon, MethodIcon } from './icons';
import { LeavingCtx, reduceMotion } from './motion';
import { useAppearance } from '../appearance';
import { gravityOf, lookOf, planeOf, rollOf } from '../data/tilt';
import { LIGHTHOUSE_T, sceneMarkup, type SceneId } from './scenes';

const initials = (s: string) => s.replace(/^@/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));

/**
 * Raw tilt input in -1..1 on both axes. Sources: device sensors, then the pointer over the element;
 * without either it sways slowly by itself (idle) so the effect is still visible.
 * read(now) gives the current target; no smoothing, no React state.
 */
export function tiltInput(el: HTMLElement | null) {
  let target = { x: 0, y: 0 };
  let base: { b: number; g: number } | null = null;
  let lastInput = 0, lastSensor = 0;
  let raw = { b: 0, g: 0 };
  let inside = false; // the mouse is over the card
  // the first reading is "level": tilting from how the phone is held, not from flat on a table.
  // A sensor counts only once its angles have really changed: Telegram for computers may send readings of a sensor
  // that is not there (the same numbers again and again); taken as input they pulled the card back to the middle
  // between mouse moves, and the card jumped between two poses. Computers do not read the sensor at all.
  let live = false;
  const off = platform.isDesktopClient() ? () => {} : platform.onTilt((beta, gamma) => {
    if (!base) base = { b: beta, g: gamma };
    raw = { b: beta, g: gamma };
    if (!lastSensor) lastSensor = performance.now(); // the glass reads gravity from the very first reading
    if (!live && Math.abs(beta - base.b) + Math.abs(gamma - base.g) < 0.8) return;
    live = true;
    if (inside) return; // the mouse is on the card: it leads
    target = { x: clamp((gamma - base.g) / 25), y: clamp((beta - base.b) / 25) };
    lastInput = lastSensor = performance.now();
  });
  // the pointer is read against the card's untransformed box: the card itself turns and shrinks under
  // the cursor, and measuring that moving box made the tilt chase itself — the card shook near its edges
  let swayFrom = 0;
  const box = () => {
    // offsetLeft/Top/Width/Height ignore the card's own transform; its offset parent does not turn
    const p = (el!.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const left = p.left + el!.offsetLeft, top = p.top + el!.offsetTop;
    return { left, top, width: el!.offsetWidth, height: el!.offsetHeight, right: left + el!.offsetWidth, bottom: top + el!.offsetHeight };
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // a finger scrolls the page; phones tilt by the sensor
    const r = box(), m = 24;
    const over = e.clientX > r.left - m && e.clientX < r.right + m && e.clientY > r.top - m && e.clientY < r.bottom + m;
    if (over) {
      inside = true;
      target = { x: clamp(((e.clientX - r.left) / r.width) * 2 - 1), y: clamp(((e.clientY - r.top) / r.height) * 2 - 1) };
      lastInput = performance.now();
    } else if (inside) {
      // the cursor left: back to the middle first, the slow sway comes in later and softly
      inside = false; target = { x: 0, y: 0 }; lastInput = performance.now();
    }
  };
  const leave = () => { if (inside) { inside = false; target = { x: 0, y: 0 }; lastInput = performance.now(); } };
  if (el) { window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave); }
  return {
    read(now: number) {
      // no sway while the cursor rests on the card: it would swing away under a still mouse and snap back on the next move
      if (!inside && now - lastInput > 2500) {
        if (!swayFrom) swayFrom = now;
        const k = Math.min(1, (now - swayFrom) / 1500); // fade the sway in
        target = { x: Math.sin(now / 1700) * 0.4 * k, y: Math.cos(now / 2300) * 0.3 * k };
      } else swayFrom = 0;
      return target;
    },
    /**
     * The motion sensor as gravity (see data/tilt.ts) once it has spoken and no pointer moved since; null — pointer or
     * no sensor. A phone lying still may send no new readings for a while: the last one still holds.
     */
    gravity() {
      return lastSensor && lastSensor >= lastInput - 1 ? gravityOf(raw.b, raw.g) : null;
    },
    stop() { off(); window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); },
  };
}

/** Smoothed tilt as React state, for cards whose look is styled from it (metals, diamond, volume, special) */
export function useTilt(active: boolean, ref: React.RefObject<HTMLElement | null>) {
  const [t, setT] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!active || reduceMotion()) return;
    const input = tiltInput(ref.current);
    let raf = 0;
    const tick = (now: number) => {
      const target = input.read(now);
      setT((cur) => {
        const nx = cur.x + (target.x - cur.x) * 0.12, ny = cur.y + (target.y - cur.y) * 0.12;
        // tiny steps are not worth a repaint
        return Math.abs(nx - cur.x) < 0.004 && Math.abs(ny - cur.y) < 0.004 ? cur : { x: nx, y: ny };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { input.stop(); cancelAnimationFrame(raf); };
  }, [active, ref]);
  return t;
}

/* ---------- diamond facets ---------- */

interface Facet { pts: string; nx: number; ny: number; hue: number }

/** A fixed, seeded facet pattern: a brilliant-cut star around the corner icon plus a jittered triangle mesh */
function makeFacets(): Facet[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = 7, rows = 5, W = 100, H = 64;
  const p: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    p.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      p[j].push([(i / cols) * W + (edge ? 0 : (rnd() - 0.5) * 9), (j / rows) * H + (edge ? 0 : (rnd() - 0.5) * 7)]);
    }
  }
  const out: Facet[] = [];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) =>
    out.push({ pts: [a, b, c].map((q) => q.map((v) => v.toFixed(2)).join(',')).join(' '), nx: rnd() * 2 - 1, ny: rnd() * 2 - 1, hue: rnd() * 360 });
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = p[j][i], b = p[j][i + 1], c = p[j + 1][i + 1], d = p[j + 1][i];
    if ((i + j) % 2) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  return out;
}

function Facets({ x: rx, y: ry }: { x: number; y: number }) {
  // colors in 1/50 steps: invisible, and the SVG is rebuilt far less often
  const x = Math.round(rx * 50) / 50, y = Math.round(ry * 50) / 50;
  return <FacetsAt x={x} y={y} />;
}

const FacetsAt = memo(function FacetsAt({ x, y }: { x: number; y: number }) {
  const facets = useMemo(makeFacets, []);
  return (
    <svg className="pcard-facets" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
      {facets.map((f, i) => {
        // brightness: how much this facet faces the light that moves with the tilt
        const lit = clamp(0.5 + (f.nx * x + f.ny * y) * 0.65, 0, 1);
        const fire = lit > 0.82;
        // facets facing away go dark, facing the light go white, the brightest split into rainbow "fire"
        const fill = fire ? `hsl(${((f.hue + x * 160 + y * 110) % 360 + 360) % 360} 90% 80%)`
          : lit < 0.4 ? `rgba(30,50,110,${((0.4 - lit) * 1.1).toFixed(3)})` : `rgba(255,255,255,${(lit * 0.78).toFixed(3)})`;
        return (
          <polygon key={i} points={f.pts} fill={fill} fillOpacity={fire ? Math.min(0.85, (lit - 0.72) * 3).toFixed(3) : 1}
            stroke="rgba(255,255,255,0.85)" strokeWidth="0.22" strokeLinejoin="round" />
        );
      })}
    </svg>
  );
});

/* ---------- metal glints ---------- */

/** Fixed spots on the metal that flash when the tilt brings them into the light */
const GLINTS = [[14, 18, 1.1], [78, 12, 0.9], [62, 40, 1.3], [30, 52, 0.8], [88, 50, 1], [46, 8, 0.7], [8, 40, 0.9]] as const;

function Glints({ x, y }: { x: number; y: number }) {
  return (
    <svg className="pcard-glints" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {GLINTS.map(([gx, gy, s], i) => {
        // each spot has its own "angle"; it shines only in a narrow tilt window
        const phase = (gx / 100) * 2 - 1 + (gy / 64 - 0.5) * 0.8;
        const a = Math.max(0, 1 - Math.abs(x * 0.9 + y * 0.5 - phase) * 3.2) ** 2;
        if (a < 0.02) return null;
        const r = 2.6 * s * (0.6 + a * 0.6);
        return (
          <g key={i} transform={`translate(${gx} ${gy}) rotate(${(x * 30).toFixed(1)})`} opacity={a.toFixed(3)}>
            <path d={`M0 ${-r}Q${r * 0.12} ${-r * 0.12} ${r} 0Q${r * 0.12} ${r * 0.12} 0 ${r}Q${-r * 0.12} ${r * 0.12} ${-r} 0Q${-r * 0.12} ${-r * 0.12} 0 ${-r}Z`} fill="#fff" />
            <circle r={r * 0.35} fill="#fff" opacity="0.8" />
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- volume tier: an extruded method icon ---------- */

/* ---------- volume tier: the night sky with the method as a constellation ---------- */

/** seeded random, so the sky is the same on every render and every device */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** paint stars into a canvas sized to its box; `pick` decides which of the seeded stars go into this layer */
function paintStars(c: HTMLCanvasElement, seed: number, density: number, size: [number, number], bright: number, band = false) {
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = seeded(seed);
  const n = Math.round((r.width * r.height) / density);
  for (let k = 0; k < n; k++) {
    const x = rnd() * r.width;
    // the milky way: stars gather along a slanted band across the card (a rough normal spread around its line)
    const y = band ? r.height * 0.5 + (x - r.width / 2) * -0.42 + (rnd() + rnd() + rnd() - 1.5) * r.height * 0.22 : rnd() * r.height;
    const a = (0.3 + rnd() * 0.7) * bright;
    const rad = size[0] + rnd() * (size[1] - size[0]);
    const tint = rnd() < 0.18 ? '255,228,196' : rnd() < 0.3 ? '196,214,255' : '255,255,255';
    if (rad > 0.9) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 4);
      g.addColorStop(0, `rgba(${tint},${a * 0.45})`); g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - rad * 4, y - rad * 4, rad * 8, rad * 8);
    }
    ctx.fillStyle = `rgba(${tint},${a})`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
}

/** a canvas of stars that repaints only when its size changes */
function StarLayer({ className, seed, density, size, bright = 1, band = false }: { className: string; seed: number; density: number; size: [number, number]; bright?: number; band?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const paint = () => paintStars(c, seed, density, size, bright, band);
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [seed, density, size[0], size[1], bright, band]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={cv} className={className} />;
}

/**
 * The card as a window into space. Eight layers sit at different depths and shift against the tilt —
 * the farthest dust and the milky way the most, the near bright stars hardly at all — so it looks like
 * looking *through* the card into a deep sky, not at a picture on it. Now and then a comet streaks across.
 * The rim is darkened from inside, like the edge of a portal.
 * Everything is painted once; per frame only transforms change (compositor), plus a CSS twinkle.
 */
function SpacePortal({ icon }: { icon: IconKey | null }) {
  return (
    <div className="pcard-portal" aria-hidden="true">
      <div className="portal-layer depth-base"><div className="nebula" /></div>
      <div className="portal-layer depth-dust"><StarLayer className="sky" seed={5} density={150} size={[0.2, 0.45]} bright={0.5} /></div>
      <div className="portal-layer depth-band"><div className="milky" /><StarLayer className="sky" seed={17} density={90} size={[0.2, 0.55]} bright={0.6} band /></div>
      <div className="portal-layer depth-far"><StarLayer className="sky" seed={11} density={420} size={[0.3, 0.7]} bright={0.75} /></div>
      <div className="portal-layer depth-clouds"><div className="clouds" /></div>
      <div className="portal-layer depth-mid">
        <StarLayer className="sky" seed={23} density={1500} size={[0.4, 1.3]} />
        <StarLayer className="sky tw a" seed={37} density={2600} size={[0.5, 1.5]} />
        <StarLayer className="sky tw b" seed={41} density={2600} size={[0.5, 1.4]} />
      </div>
      <div className="portal-layer depth-comets"><Comets /></div>
      {icon && <div className="portal-layer depth-figure"><Constellation icon={icon} /></div>}
      <div className="portal-layer depth-near"><StarLayer className="sky tw c" seed={53} density={14000} size={[1.1, 1.9]} /></div>
      <div className="portal-rim" />
    </div>
  );
}

type Comet = { id: number; top: number; left: number; ang: number; dist: number; len: number; dur: number };

/** now and then (every 7–16 s) a comet crosses the sky; none while the app is hidden or motion is reduced */
function Comets() {
  const [list, setList] = useState<Comet[]>([]);
  const still = useAppearance().still === true;
  useEffect(() => {
    if (reduceMotion() || still) return;
    let id = 0, timer = 0;
    const next = (wait: number) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          const right = Math.random() < 0.6; // most fly down to the right, some down to the left
          setList((l) => [...l, {
            id: ++id, top: 8 + Math.random() * 36, left: right ? 6 + Math.random() * 40 : 40 + Math.random() * 40,
            ang: right ? 16 + Math.random() * 20 : 144 + Math.random() * 20, dist: 170 + Math.random() * 110,
            len: 70 + Math.random() * 50, dur: 1700 + Math.random() * 900,
          }]);
        }
        next(7000 + Math.random() * 9000);
      }, wait);
    };
    next(1500 + Math.random() * 3500);
    return () => clearTimeout(timer);
  }, [still]);
  return (
    <>
      {list.map((c) => (
        <span key={c.id} className="comet" onAnimationEnd={() => setList((l) => l.filter((x) => x.id !== c.id))}
          style={{ top: `${c.top}%`, left: `${c.left}%`, '--ang': `${c.ang}deg`, '--dist': `${c.dist}px`, width: `${c.len}px`, animationDuration: `${c.dur}ms` } as React.CSSProperties} />
      ))}
    </>
  );
}

type CStar = { x: number; y: number; r: number; tw: number; deg: number };

/**
 * The method as a constellation drawn the way star charts do: a faint glowing figure (the icon's own drawing),
 * a few bright stars at its key points — corners, ends, junctions — and straight lines between them.
 * Key points are found on the real icon geometry: where a line turns sharply, where it ends, rectangle corners.
 */
function Constellation({ icon }: { icon: IconKey }) {
  const probe = useRef<HTMLDivElement>(null);
  const [sky, setSky] = useState<{ stars: CStar[]; lines: [CStar, CStar][] }>({ stars: [], lines: [] });
  useLayoutEffect(() => {
    const svg = probe.current?.querySelector('svg');
    if (!svg) return;
    const rnd = seeded(icon.length * 131 + icon.charCodeAt(0) * 7);
    const stars: CStar[] = [];
    const lines: [CStar, CStar][] = [];
    const starAt = (x: number, y: number) => {
      const near = stars.find((q) => Math.hypot(q.x - x, q.y - y) < 3.2);
      if (near) return near;
      const st = { x, y, r: 0, tw: rnd() < 0.3 ? 1 + Math.floor(rnd() * 2) : 0, deg: 0 };
      stars.push(st);
      return st;
    };
    const link = (a: CStar, b: CStar) => {
      if (a === b || lines.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) return;
      lines.push([a, b]); a.deg++; b.deg++;
    };
    svg.querySelectorAll<SVGGeometryElement>('path, rect, circle, ellipse, line, polyline, polygon').forEach((g) => {
      let keys: { x: number; y: number }[] = [];
      let closed = false;
      if (g instanceof SVGRectElement) {
        const x = g.x.baseVal.value, y = g.y.baseVal.value, w = g.width.baseVal.value, h = g.height.baseVal.value;
        keys = w < 3 || h < 3 ? [{ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }] : [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
        closed = keys.length === 4;
      } else if (g instanceof SVGCircleElement) {
        const cx = g.cx.baseVal.value, cy = g.cy.baseVal.value, rr = g.r.baseVal.value;
        const n = rr < 2.5 ? 1 : 5;
        keys = Array.from({ length: n }, (_, k) => ({ x: cx + rr * Math.cos(k / n * Math.PI * 2 - Math.PI / 2), y: cy + rr * Math.sin(k / n * Math.PI * 2 - Math.PI / 2) }));
        closed = n > 1;
      } else {
        let len = 0;
        try { len = g.getTotalLength(); } catch { return; }
        if (!len) return;
        const N = Math.max(8, Math.round(len * 2));
        const pts = Array.from({ length: N + 1 }, (_, k) => g.getPointAtLength((k / N) * len));
        closed = Math.hypot(pts[0].x - pts[N].x, pts[0].y - pts[N].y) < 0.5;
        keys.push(pts[0]);
        const W = Math.max(2, Math.round(N / 24));
        let lastKey = 0;
        for (let k = W; k <= N - W; k++) {
          const a = Math.atan2(pts[k].y - pts[k - W].y, pts[k].x - pts[k - W].x), b = Math.atan2(pts[k + W].y - pts[k].y, pts[k + W].x - pts[k].x);
          let turn = Math.abs(b - a); if (turn > Math.PI) turn = 2 * Math.PI - turn;
          // a sharp turn is a corner; along a long smooth curve put a star every ~9 units so it keeps its shape
          const along = ((k - lastKey) / N) * len;
          if ((turn > 0.6 && along > 2.5) || along > 9) { keys.push(pts[k]); lastKey = k; }
        }
        if (!closed) keys.push(pts[N]);
      }
      const st = keys.map((p) => starAt(p.x, p.y));
      for (let k = 1; k < st.length; k++) link(st[k - 1], st[k]);
      if (closed && st.length > 2) link(st[st.length - 1], st[0]);
    });
    // junctions shine brighter: the more lines meet at a star, the bigger it is
    for (const st of stars) st.r = 0.55 + Math.min(3, st.deg) * 0.17 + rnd() * 0.25;
    setSky({ stars, lines });
  }, [icon]);
  const sparkle = (p: CStar) => p.r > 1.05;
  return (
    <div className="pcard-constellation" aria-hidden="true">
      <div className="probe" ref={probe}><MethodIcon icon={icon} size={32} /></div>
      {/* the figure itself, faint, like the drawing on a star chart */}
      <div className="const-figure"><MethodIcon icon={icon} size={32} /></div>
      <svg viewBox="-2 -2 36 36" className="const-lines">
        {sky.lines.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)}
      </svg>
      {[0, 1, 2].map((layer) => (
        <svg key={layer} viewBox="-2 -2 36 36" className={'const-stars' + (layer ? ` tw t${layer}` : '')}>
          {sky.stars.filter((p) => p.tw === layer).map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={p.r} />
              {sparkle(p) && <path className="flare" d={`M${p.x - p.r * 2.6} ${p.y}H${p.x + p.r * 2.6}M${p.x} ${p.y - p.r * 2.6}V${p.y + p.r * 2.6}`} />}
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}

/* ---------- developers' background ---------- */

const CODE = [
  'const brew = await v60({ dose: 15, water: 250 });', 'if (bloom.done) pour(to: 150);', 'export default function Brewbook() {',
  '  return <Coffee strength="just right" />;', 'git commit -m "more coffee"', '// TODO: drink while hot', 'while (awake) refill(cup);',
  'npm run brew --profile=light', 'SELECT * FROM beans WHERE roast > now() - 14d;', '} catch (e) { makeEspresso(); }',
];

/**
 * Four copies of the code, scrolled by exactly one copy per loop: the copies below always fill the card,
 * so the loop restart is invisible (with two copies the bottom ran empty, then the code jumped back in).
 */
const CODE_LOOP = [...CODE, ...CODE, ...CODE, ...CODE];

/** Terminal-dark card with faint code, a glowing cursor and a "</>" mark in the corner */
function DevLayer() {
  return (
    <>
      <div className="pcard-code" aria-hidden="true"><div className="pcard-code-in">{CODE_LOOP.map((l, i) => <div key={i}>{l}</div>)}</div></div>
      <div className="pcard-corner pcard-dev-mark" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 9l-6 7 6 7M21 9l6 7-6 7M18 7l-4 18" />
        </svg>
      </div>
    </>
  );
}

/* ---------- glass of black coffee ---------- */

/**
 * The card is a glass box with black coffee in it, seen slightly from above.
 *  - sideways tilt (roll) tips the surface: it stays level while the glass turns;
 *  - toward/away tilt (pitch) shows the top of the liquid: a lit plane between the front and the back edge;
 *  - quick moves make it slosh: two damped springs (roll and pitch) overshoot and settle, and kick a wave.
 * A sharp tilt swings the pitch spring past the target, so the surface opens up for a moment, then calms down.
 * Its own animation loop on a canvas: no React renders per frame, nothing drawn while still or off screen.
 */
function GlassLayer({ host, still }: { host: React.RefObject<HTMLElement | null>; still?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current, card = host.current;
    if (!c || !card) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const calm = still || reduceMotion();
    const input = calm ? null : tiltInput(card);
    let w = 0, h = 0, raf = 0, visible = true, dirty = true;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // soft gradients: 1.5× is enough and saves fill rate
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(c);

    // springs: roll (surface angle, rad) and pitch (how much of the top is seen, 0..1)
    let roll = 0, rollV = 0, pitch = 0.1, pitchV = 0, amp = 0, phase = 0, last = performance.now();
    let sx = 0, sy = 0; // smoothed input
    let baseLook: number | null = null; // how the phone was held when the card opened
    const N = 24;       // points along the surface: enough for smooth waves, cheap to fill
    const front = new Float32Array(N + 1), back = new Float32Array(N + 1);

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      let t = input ? input.read(now) : { x: 0, y: 0 };
      // with the motion sensor the surface follows gravity: it stays level however the phone is turned
      // (sx = turn / 0.42, so the surface tilts on screen by exactly the opposite of the phone's turn)
      const g = input?.gravity();
      if (g) {
        const plane = clamp((planeOf(g) - 0.2) / 0.3, 0, 1); // almost flat: the turn means nothing, keep the surface level
        if (baseLook === null) baseLook = lookOf(g);
        t = { x: clamp((rollOf(g) / 0.42) * plane, -1.6, 1.6), y: clamp((lookOf(g) - baseLook) / 0.35) };
      }
      const px0 = sx, py0 = sy;
      sx += (t.x - sx) * Math.min(1, dt * 14); sy += (t.y - sy) * Math.min(1, dt * 14);
      card.style.setProperty('--tx', clamp(sx).toFixed(3));
      const rollT = -sx * 0.42, pitchT = 0.1 + Math.max(0, sy) * 0.32 + Math.max(0, -sy) * 0.1;
      const aR = -(roll - rollT) * 42 - rollV * 3.4;            // water: stiff and lively
      const aP = -(pitch - pitchT) * 48 - pitchV * 2.6;         // underdamped: a sharp tilt overshoots and opens the surface
      // a quick move throws the liquid: the faster the tilt changed, the harder the kick
      rollV += -(sx - px0) * 9; pitchV += Math.abs(sy - py0) * 7;
      rollV += aR * dt; roll += rollV * dt;
      pitchV += aP * dt; pitch += pitchV * dt;
      amp = Math.min(12, amp * Math.exp(-1.7 * dt) + (Math.abs(rollV) + Math.abs(pitchV) * 1.5) * dt * 30);
      phase += dt * 7;
      const moving = amp > 0.15 || Math.abs(rollV) > 0.002 || Math.abs(pitchV) > 0.002;
      if (!moving && !dirty) return; // settled: the last frame stays on the canvas
      dirty = false;
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const level = h * 0.56;
      const slope = Math.tan(roll);
      // the top plane's height on screen (a short card still shows a proper surface)
      const depth = Math.max(2, Math.min(level - 6, Math.min(0.62, pitch) * Math.max(h, 190) * 0.55));
      for (let i = 0; i <= N; i++) {
        const px = (i / N) * w, u = i / N;
        const tilt = level + (px - w / 2) * slope;
        // standing waves: the back edge moves against the front one (front-to-back slosh)
        const wave = Math.sin(u * Math.PI * 2 + phase) * amp * 0.45 + Math.sin(u * Math.PI * 5 - phase * 1.4) * amp * 0.15;
        const slosh = Math.sin(phase * 0.9) * amp * 0.5;
        front[i] = tilt + wave + slosh * 0.5;
        back[i] = tilt - depth + wave * 0.6 - slosh * 0.5;
      }
      const path = (ys: Float32Array, rev = false) => {
        if (!rev) for (let i = 0; i <= N; i++) ctx.lineTo((i / N) * w, ys[i]);
        else for (let i = N; i >= 0; i--) ctx.lineTo((i / N) * w, ys[i]);
      };
      // body: almost black, brown where light comes through near the top
      const top = Math.min(...front);
      ctx.beginPath(); ctx.moveTo(0, h); path(front); ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, h);
      g.addColorStop(0, 'rgba(96,54,26,0.96)'); g.addColorStop(0.16, 'rgba(36,19,10,0.97)'); g.addColorStop(1, 'rgba(10,6,4,0.98)');
      ctx.fillStyle = g; ctx.fill();
      // the back wall below the surface: the far side of the liquid, seen through the top
      // top plane: dark glossy coffee reflecting the room; lighter toward the front edge
      ctx.beginPath(); ctx.moveTo(0, back[0]); path(back); path(front, true); ctx.closePath();
      const sg = ctx.createLinearGradient(0, Math.min(...back), 0, top + 4);
      sg.addColorStop(0, 'rgba(22,12,7,0.97)'); sg.addColorStop(0.55, 'rgba(58,32,16,0.97)'); sg.addColorStop(1, 'rgba(128,78,40,0.95)');
      ctx.fillStyle = sg; ctx.fill();
      if (depth > 8) {
        // reflection of a window on the surface: a soft highlight that slides with the roll
        ctx.save();
        ctx.beginPath(); ctx.moveTo(0, back[0]); path(back); path(front, true); ctx.closePath(); ctx.clip();
        const cx = w * (0.62 - roll * 0.9), cy = (back[N >> 1] + front[N >> 1]) / 2;
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(30, depth * 1.4));
        hg.addColorStop(0, 'rgba(255,236,210,0.32)'); hg.addColorStop(1, 'rgba(255,236,210,0)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
        // a few ripple lines across the plane
        ctx.strokeStyle = 'rgba(255,225,190,0.10)'; ctx.lineWidth = 1;
        for (let k = 1; k <= 3; k++) {
          const f = k / 4;
          ctx.beginPath();
          for (let i = 0; i <= N; i++) ctx.lineTo((i / N) * w, back[i] + (front[i] - back[i]) * f + Math.sin(i * 0.9 + phase * 1.6 + k) * amp * 0.12);
          ctx.stroke();
        }
        ctx.restore();
      }
      // edges catching the light: the back line where liquid meets the far glass, the bright front meniscus
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,214,170,0.22)'; ctx.beginPath(); path(back); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,220,175,0.6)'; ctx.beginPath(); path(front); ctx.stroke();
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); input?.stop(); };
  }, [host, still]);
  return (
    <>
      <canvas ref={cv} className="pcard-coffee" aria-hidden="true" />
      <div className="pcard-glass" aria-hidden="true" />
    </>
  );
}

/* ---------- testers' background ---------- */

/** Lab blueprint: a measuring grid that drifts with the tilt, a "BETA" ribbon and a glowing flask in the corner */
function BetaLayer() {
  return (
    <>
      <div className="pcard-blueprint" aria-hidden="true" />
      <div className="pcard-ribbon" aria-hidden="true"><span>BETA</span></div>
      <div className="pcard-corner pcard-beta-mark" aria-hidden="true">
        <svg width="56" height="56" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4h8M13.5 4v8.5L6.8 24.2A2.4 2.4 0 0 0 8.9 28h14.2a2.4 2.4 0 0 0 2.1-3.8L18.5 12.5V4" />
          <path d="M9.5 19.5h13" />
          <circle cx="14" cy="23.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="18.5" cy="22" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </div>
    </>
  );
}

/* ---------- picture backgrounds: rare lots and the lighthouse ---------- */

/**
 * A drawn scene behind the card (see scenes.ts). Its own animations loop by themselves. The lighthouse also has
 * SMIL parts (the beam, the light on the water) that must keep time with its CSS parts (the crests, the flash):
 * both are set to one clock — the phase of the turn now — whenever the card comes into view, since hiding a card
 * (display: none) restarts CSS animations but not SMIL ones.
 */
function SceneLayer({ id, still }: { id: SceneId; still?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const box = useRef<HTMLDivElement>(null);
  const html = useMemo(() => `<svg viewBox="0 0 360 224" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${sceneMarkup(id, uid)}</svg>`, [id, uid]);
  useEffect(() => {
    const el = box.current, svg = el?.querySelector('svg');
    if (!el || !svg) return;
    if (still || reduceMotion()) { svg.pauseAnimations(); return; }
    if (id !== 'lighthouse') return;
    const sync = () => {
      const phase = (performance.now() / 1000) % LIGHTHOUSE_T;
      el.style.setProperty('--lh-t', `${(-phase).toFixed(3)}s`);
      svg.setCurrentTime(phase);
    };
    sync();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) sync(); });
    io.observe(el);
    return () => io.disconnect();
  }, [id, html, still]);
  return <div ref={box} className={'pcard-scene' + (still ? ' still' : '')} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------- card ---------- */

export function ProfileCard({ card, live: liveProp = true }: { card: CardData; live?: boolean }) {
  // the copy of a tab sliding away keeps the picture but stops its motion: a second live scene made the switch stall
  // and a paused background (Профиль → Вид интерфейса) stands still the same way
  const live = liveProp && !useContext(LeavingCtx) && !useAppearance().still;
  const ref = useRef<HTMLDivElement>(null);
  const view = cardView(card);
  const tier = 'tier' in view.theme ? view.theme.tier : null;
  // the picture backgrounds (rare lots, the lighthouse) do not follow the tilt
  const scene: SceneId | null = 'rare' in view.theme ? view.theme.rare : 'special' in view.theme && view.theme.special === 'lighthouse' ? 'lighthouse' : null;
  const t = useTilt(live && ((!!tier && !('look' in view.theme && view.theme.look === 'glass')) || ('special' in view.theme && !scene)), ref);
  const [photoOk, setPhotoOk] = useState(true);
  const icon = 'tier' in view.theme ? view.theme.icon : null;

  // diamond and volume cards turn in 3D; the diamond only slightly (its shine does the work)
  // the diamond turns a little; the volume card stays put — its depth is inside, the card is a window
  const turn = tier === 'diamond' ? [5, 4] : null;
  const style = {
    '--tx': t.x.toFixed(3), '--ty': t.y.toFixed(3),
    ...(turn ? { transform: `perspective(800px) rotateY(${(t.x * turn[0]).toFixed(2)}deg) rotateX(${(-t.y * turn[1]).toFixed(2)}deg)` } : {}),
  } as React.CSSProperties;
  const volume = tier === 'volume' && icon && icon !== 'star';
  // «Стакан» (500 L) is an achievement background drawn as the glass, not as a metal
  const glass = 'tier' in view.theme && view.theme.look === 'glass';
  // the night sky has its own stars: no metal sheen or glints on it
  const metal = tier && !glass && tier !== 'volume';

  return (
    <div ref={ref} className={`pcard ${glass ? 'tier tier-glass base-glass' : 'tier' in view.theme ? `tier tier-${view.theme.tier}` : 'special' in view.theme ? `special special-${view.theme.special}` : 'rare' in view.theme ? 'rare' : `base-${view.theme.base}`}${scene ? ` scene scene-${scene}` : ''}`} style={style}
      onClick={turn || glass ? () => requestTiltPermission() : undefined}>
      {/* decorations in one clipped layer: Safari (Telegram for macOS) does not clip composited children to the rounded
          corners of an overflow:hidden card, so a sparkle or a star layer poked out as a sharp corner */}
      <div className="pcard-clip" aria-hidden="true">
        {tier === 'diamond' && <><Facets x={t.x} y={t.y} /><div className="pcard-iris" /><div className="pcard-film" /></>}
        {metal && <div className="pcard-sheen" />}
        {metal && tier !== 'diamond' && <Glints x={t.x} y={t.y} />}
        {glass && <GlassLayer host={ref} still={!live} />}
        {tier === 'volume' && <SpacePortal icon={volume ? icon as IconKey : null} />}
        {'special' in view.theme && view.theme.special === 'dev' && <DevLayer />}
        {'special' in view.theme && view.theme.special === 'beta' && <BetaLayer />}
        {scene && <SceneLayer id={scene} still={!live} />}
        {icon && !volume && !glass && (
          <div className="pcard-corner">
            {icon === 'star' ? <Icon name="star" size={64} filled /> : <MethodIcon icon={icon as IconKey} size={72} />}
          </div>
        )}
      </div>
      {tier === 'diamond' && <div className="pcard-edge" aria-hidden="true" />}
      {tier === 'diamond' && card.no !== undefined && <div className="pcard-no" aria-label={`Бриллиант № ${card.no}`}><small>№</small>{card.no}</div>}
      <div className="pcard-body">
        <div className="pcard-head">
          {card.photo && photoOk
            ? <img className="pcard-avatar" src={card.photo} alt="" onError={() => setPhotoOk(false)} referrerPolicy="no-referrer" />
            : <span className="pcard-avatar">{initials(card.name)}</span>}
          <div className="pcard-name">
            <b>{card.name}</b>
            {card.username && <a href={`https://t.me/${card.username}`} target="_blank" rel="noreferrer"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); platform.openLink(`https://t.me/${card.username}`); }}>@{card.username}</a>}
          </div>
        </div>
        {('tier' in view.theme || 'special' in view.theme || 'rare' in view.theme) && <div className="pcard-tier">{view.theme.title}</div>}
        {card.about && <p className="pcard-about">{card.about}</p>}
        {view.badges.length > 0 && <BadgeRow badges={view.badges} max={3} />}
        {card.setup.length > 0 && (
          <ul className="pcard-setup">
            {card.setup.map((g, i) => <li key={i}><span>{catById(g.cat).one}</span><b>{g.name}</b></li>)}
          </ul>
        )}
        <div className="pcard-brand">Brewbook</div>
      </div>
    </div>
  );
}
