/**
 * Profile card. Base themes are flat colors; bronze / silver / gold are brushed metal with a sheen that follows the tilt;
 * diamond is a faceted, iridescent 3D card that turns with the device (or the mouse on a computer).
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cardView, type CardData } from '../data/card';
import { catById } from '../data/gear';
import type { IconKey } from '../data/methods';
import { platform } from '../platform';
import { requestTiltPermission } from '../platform/web';
import { BadgeRow } from './Badges';
import { Icon, MethodIcon } from './icons';
import { reduceMotion } from './motion';

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
  let lastInput = 0;
  // the first reading is "level": tilting from how the phone is held, not from flat on a table
  const off = platform.onTilt((beta, gamma) => {
    if (!base) base = { b: beta, g: gamma };
    target = { x: clamp((gamma - base.g) / 25), y: clamp((beta - base.b) / 25) };
    lastInput = performance.now();
  });
  const move = (e: PointerEvent) => {
    const r = el!.getBoundingClientRect();
    target = { x: clamp(((e.clientX - r.left) / r.width) * 2 - 1), y: clamp(((e.clientY - r.top) / r.height) * 2 - 1) };
    lastInput = performance.now();
  };
  el?.addEventListener('pointermove', move);
  return {
    read(now: number) {
      if (now - lastInput > 2500) target = { x: Math.sin(now / 1700) * 0.4, y: Math.cos(now / 2300) * 0.3 };
      return target;
    },
    stop() { off(); el?.removeEventListener('pointermove', move); },
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

/**
 * A starry sky painted once into four canvases: the still stars and three twinkle layers whose opacity is animated
 * by CSS (compositor only — no repaint per frame). Layers drift a little with the tilt for depth.
 */
function NightSky() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const paint = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rnd = seeded(11);
      const layers = Array.from(el.querySelectorAll('canvas'));
      const ctxs = layers.map((c) => {
        c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
        const x = c.getContext('2d')!; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, r.width, r.height); return x;
      });
      const n = Math.round((r.width * r.height) / 900);
      for (let k = 0; k < n; k++) {
        const x = rnd() * r.width, y = rnd() * r.height, big = rnd() < 0.12, a = 0.35 + rnd() * 0.65;
        const layer = rnd() < 0.55 ? 0 : 1 + Math.floor(rnd() * 3);
        const ctx = ctxs[layer];
        const rad = big ? 1.1 + rnd() * 0.6 : 0.35 + rnd() * 0.5;
        const tint = rnd() < 0.2 ? '255,226,190' : rnd() < 0.3 ? '190,210,255' : '255,255,255';
        if (big) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 4);
          g.addColorStop(0, `rgba(${tint},${a * 0.5})`); g.addColorStop(1, `rgba(${tint},0)`);
          ctx.fillStyle = g; ctx.fillRect(x - rad * 4, y - rad * 4, rad * 8, rad * 8);
        }
        ctx.fillStyle = `rgba(${tint},${a})`;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="pcard-sky" ref={box} aria-hidden="true">
      <canvas className="sky-still" /><canvas className="sky-tw a" /><canvas className="sky-tw b" /><canvas className="sky-tw c" />
    </div>
  );
}

/**
 * The method icon as a constellation: stars sampled along its lines (measured from the real icon),
 * joined by faint lines; a few stars twinkle. Shown in the corner like the old extruded icon.
 */
function Constellation({ icon }: { icon: IconKey }) {
  const probe = useRef<HTMLDivElement>(null);
  type Star = { x: number; y: number; r: number; tw: number };
  const [sky, setSky] = useState<{ stars: Star[]; lines: Star[][] }>({ stars: [], lines: [] });
  useLayoutEffect(() => {
    const svg = probe.current?.querySelector('svg');
    if (!svg) return;
    const rnd = seeded(icon.length * 97 + icon.charCodeAt(0));
    const stars: Star[] = [];
    const lines: Star[][] = [];
    // a star near an existing one is that star (shapes share corners): lines join instead of doubling stars
    const starAt = (x: number, y: number) => stars.find((q) => Math.hypot(q.x - x, q.y - y) < 3.6)
      ?? (stars.push({ x, y, r: rnd() < 0.3 ? 1.25 : 0.7 + rnd() * 0.3, tw: rnd() < 0.35 ? 1 + Math.floor(rnd() * 3) : 0 }), stars[stars.length - 1]);
    svg.querySelectorAll<SVGGeometryElement>('path, rect, circle, ellipse, line, polyline, polygon').forEach((g) => {
      let len = 0;
      try { len = g.getTotalLength(); } catch { return; }
      if (!len) return;
      const n = Math.max(1, Math.round(len / 6.5)); // a constellation is sparse: a star every ~6 units
      const run: Star[] = [];
      for (let k = 0; k <= n; k++) {
        const p = g.getPointAtLength((k / n) * len);
        const st = starAt(p.x, p.y);
        if (run[run.length - 1] !== st) run.push(st);
      }
      if (run.length > 1) lines.push(run);
    });
    setSky({ stars, lines });
  }, [icon]);
  return (
    <div className="pcard-constellation" aria-hidden="true">
      <div className="probe" ref={probe}><MethodIcon icon={icon} size={32} /></div>
      <svg viewBox="-1 -1 34 34" className="const-lines">
        {sky.lines.map((run, i) => <polyline key={i} points={run.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} />)}
      </svg>
      {[0, 1, 2, 3].map((layer) => (
        <svg key={layer} viewBox="-1 -1 34 34" className={'const-stars' + (layer ? ` tw t${layer}` : '')}>
          {sky.stars.filter((p) => p.tw === layer).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} />)}
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
    const N = 24;       // points along the surface: enough for smooth waves, cheap to fill
    const front = new Float32Array(N + 1), back = new Float32Array(N + 1);

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      const t = input ? input.read(now) : { x: 0, y: 0 };
      const px0 = sx, py0 = sy;
      sx += (t.x - sx) * Math.min(1, dt * 14); sy += (t.y - sy) * Math.min(1, dt * 14);
      card.style.setProperty('--tx', sx.toFixed(3));
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

/* ---------- card ---------- */

export function ProfileCard({ card, live = true }: { card: CardData; live?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const view = cardView(card);
  const tier = 'tier' in view.theme ? view.theme.tier : null;
  const t = useTilt(live && ((!!tier && !('look' in view.theme && view.theme.look === 'glass')) || 'special' in view.theme), ref);
  const [photoOk, setPhotoOk] = useState(true);
  const icon = 'tier' in view.theme ? view.theme.icon : null;

  // diamond and volume cards turn in 3D; the diamond only slightly (its shine does the work)
  const turn = tier === 'diamond' ? [5, 4] : tier === 'volume' ? [6, 5] : null;
  const style = {
    '--tx': t.x.toFixed(3), '--ty': t.y.toFixed(3),
    ...(turn ? { transform: `perspective(800px) rotateY(${(t.x * turn[0]).toFixed(2)}deg) rotateX(${(-t.y * turn[1]).toFixed(2)}deg)` } : {}),
  } as React.CSSProperties;
  const volume = tier === 'volume' && icon && icon !== 'star';
  // «Стакан» (500 L) is an achievement background drawn as the glass, not as a metal
  const glass = 'tier' in view.theme && view.theme.look === 'glass';
  const metal = tier && !glass;

  return (
    <div ref={ref} className={`pcard ${glass ? 'tier tier-glass base-glass' : 'tier' in view.theme ? `tier tier-${view.theme.tier}` : 'special' in view.theme ? `special special-${view.theme.special}` : `base-${view.theme.base}`}`} style={style}
      onClick={turn || glass ? () => requestTiltPermission() : undefined}>
      {tier === 'diamond' && <><Facets x={t.x} y={t.y} /><div className="pcard-iris" aria-hidden="true" /><div className="pcard-film" aria-hidden="true" /><div className="pcard-edge" aria-hidden="true" /></>}
      {metal && <div className="pcard-sheen" aria-hidden="true" />}
      {metal && tier !== 'diamond' && <Glints x={t.x} y={t.y} />}
      {glass && <GlassLayer host={ref} still={!live} />}
      {tier === 'volume' && <NightSky />}
      {volume && <Constellation icon={icon as IconKey} />}
      {'special' in view.theme && view.theme.special === 'dev' && <DevLayer />}
      {'special' in view.theme && view.theme.special === 'beta' && <BetaLayer />}
      {tier === 'diamond' && card.no !== undefined && <div className="pcard-no" aria-label={`Бриллиант № ${card.no}`}><small>№</small>{card.no}</div>}
      {icon && !volume && !glass && (
        <div className="pcard-corner" aria-hidden="true">
          {icon === 'star' ? <Icon name="star" size={64} filled /> : <MethodIcon icon={icon as IconKey} size={72} />}
        </div>
      )}
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
        {('tier' in view.theme || 'special' in view.theme) && <div className="pcard-tier">{view.theme.title}</div>}
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
