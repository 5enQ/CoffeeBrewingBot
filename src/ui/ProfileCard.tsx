/**
 * Profile card. Base themes are flat colors; bronze / silver / gold are brushed metal with a sheen that follows the tilt;
 * diamond is a faceted, iridescent 3D card that turns with the device (or the mouse on a computer).
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
 * Tilt in -1..1 on both axes. Sources: device sensors, then the pointer over the card;
 * without either the card sways slowly by itself so the effect is still visible.
 */
export function useTilt(active: boolean, ref: React.RefObject<HTMLElement | null>) {
  const [t, setT] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const base = useRef<{ b: number; g: number } | null>(null);
  const lastInput = useRef(0);

  useEffect(() => {
    if (!active || reduceMotion()) return;
    // the first reading is "level": tilting from how the phone is held, not from flat on a table
    const off = platform.onTilt((beta, gamma) => {
      if (!base.current) base.current = { b: beta, g: gamma };
      target.current = { x: clamp((gamma - base.current.g) / 25), y: clamp((beta - base.current.b) / 25) };
      lastInput.current = performance.now();
    });
    const el = ref.current;
    const move = (e: PointerEvent) => {
      const r = el!.getBoundingClientRect();
      target.current = { x: clamp(((e.clientX - r.left) / r.width) * 2 - 1), y: clamp(((e.clientY - r.top) / r.height) * 2 - 1) };
      lastInput.current = performance.now();
    };
    el?.addEventListener('pointermove', move);
    let raf = 0;
    const tick = (now: number) => {
      if (now - lastInput.current > 2500) {
        // idle sway
        target.current = { x: Math.sin(now / 1700) * 0.4, y: Math.cos(now / 2300) * 0.3 };
      }
      setT((cur) => {
        const nx = cur.x + (target.current.x - cur.x) * 0.12, ny = cur.y + (target.current.y - cur.y) * 0.12;
        // tiny steps are not worth a repaint
        return Math.abs(nx - cur.x) < 0.004 && Math.abs(ny - cur.y) < 0.004 ? cur : { x: nx, y: ny };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { off(); el?.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
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

/** The method icon stacked in depth: back layers dark, the front one bright, so turning the card shows its thickness */
function VolumeIcon({ icon, x, y }: { icon: IconKey; x: number; y: number }) {
  const depth = 12;
  // a resting three-quarter turn, so the depth is visible even when the phone is level
  const ry = x * 32 - 24, rx = -y * 24 + 12;
  return (
    <div className="pcard-volume" aria-hidden="true">
      <div className="pcard-volume-rot" style={{ transform: `rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)` }}>
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className="pcard-volume-layer" style={{ transform: `translateZ(${((i - depth) * 1.7).toFixed(1)}px)`, color: `hsl(222 14% ${20 + (i / depth) * 22}%)` }}>
            <MethodIcon icon={icon} size={104} />
          </span>
        ))}
        <span className="pcard-volume-layer front"><MethodIcon icon={icon} size={104} /></span>
      </div>
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
 * The card is a glass with black coffee in it. Tilting the phone sideways tips the surface (it stays level
 * to gravity), tilting it toward you or away shows more or less of the surface from above; quick moves make it
 * slosh — a damped spring on the surface angle plus a wave that is kicked by the change and dies down.
 * Drawn on a canvas in its own animation loop (no React renders per frame).
 */
function GlassLayer({ tilt }: { tilt: { x: number; y: number } }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef(tilt);
  tiltRef.current = tilt;
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const calm = reduceMotion();
    let w = 0, h = 0, raf = 0;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);
    // state: surface angle (rad) and its speed; slosh wave amplitude and phase; how much of the top is seen
    let ang = 0, vel = 0, amp = 0, phase = 0, top = 0.2, last = performance.now(), prevTarget = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { x, y } = tiltRef.current;
      const target = calm ? 0 : -x * 0.42;           // the surface stays level while the glass turns
      const k = 38, damp = 3.2;                        // spring stiffness and damping: water, not honey
      vel += (-(ang - target) * k - vel * damp) * dt;
      ang += vel * dt;
      amp = Math.min(14, amp * Math.exp(-1.6 * dt) + Math.abs(target - prevTarget) * 90 + Math.abs(vel) * dt * 6);
      prevTarget = target;
      phase += dt * 7.5;
      top += ((0.12 + Math.abs(y) * 0.55) - top) * Math.min(1, dt * 6);   // forward/back tilt shows the surface from above
      draw(ang, amp, phase, top, y);
      raf = requestAnimationFrame(frame);
    };
    const draw = (a: number, A: number, ph: number, tp: number, y: number) => {
      ctx.clearRect(0, 0, w, h);
      const level = h * (0.56 - y * 0.04);           // fill line; tipping toward you moves it a little
      const slope = Math.tan(a);
      const surf = (px: number) => level + (px - w / 2) * slope + Math.sin(px / w * Math.PI * 2 + ph) * A * 0.5 + Math.sin(px / w * Math.PI * 5 - ph * 1.3) * A * 0.18;
      // the body of the coffee: almost black, a brown glow where light comes through near the surface
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let px = 0; px <= w; px += 6) ctx.lineTo(px, surf(px));
      ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, level - 30, 0, h);
      g.addColorStop(0, 'rgba(92,52,24,0.96)'); g.addColorStop(0.18, 'rgba(38,20,10,0.97)'); g.addColorStop(1, 'rgba(10,6,4,0.98)');
      ctx.fillStyle = g; ctx.fill();
      // the surface seen from above: a band whose depth grows with the forward/back tilt
      const band = 3 + tp * 26;
      ctx.beginPath();
      for (let px = 0; px <= w; px += 6) ctx.lineTo(px, surf(px) - band * 0.5);
      for (let px = w; px >= 0; px -= 6) ctx.lineTo(px, surf(px) + band * 0.5);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, level - band, 0, level + band);
      sg.addColorStop(0, 'rgba(160,100,50,0.55)'); sg.addColorStop(1, 'rgba(40,22,12,0.0)');
      ctx.fillStyle = sg; ctx.fill();
      // meniscus: the bright line where light catches the edge of the surface
      ctx.beginPath();
      for (let px = 0; px <= w; px += 6) ctx.lineTo(px, surf(px) - band * 0.5);
      ctx.strokeStyle = 'rgba(255,214,160,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
      // a few highlights riding on the waves
      ctx.fillStyle = 'rgba(255,230,190,0.18)';
      for (let i = 0; i < 3; i++) {
        const px = ((i + 0.5) / 3) * w + Math.sin(ph * 0.6 + i * 2) * 18;
        ctx.beginPath(); ctx.ellipse(px, surf(px) - band * 0.3, 16 + A, 1.6 + band * 0.12, a, 0, Math.PI * 2); ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
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
  const t = useTilt(live && (!!tier || 'special' in view.theme || ('base' in view.theme && view.theme.base === 'glass')), ref);
  const [photoOk, setPhotoOk] = useState(true);
  const icon = 'tier' in view.theme ? view.theme.icon : null;

  // diamond and volume cards turn in 3D; the diamond only slightly (its shine does the work)
  const turn = tier === 'diamond' ? [5, 4] : tier === 'volume' ? [10, 8] : null;
  const style = {
    '--tx': t.x.toFixed(3), '--ty': t.y.toFixed(3),
    ...(turn ? { transform: `perspective(800px) rotateY(${(t.x * turn[0]).toFixed(2)}deg) rotateX(${(-t.y * turn[1]).toFixed(2)}deg)` } : {}),
  } as React.CSSProperties;
  const volume = tier === 'volume' && icon && icon !== 'star';

  return (
    <div ref={ref} className={`pcard ${'tier' in view.theme ? `tier tier-${view.theme.tier}` : 'special' in view.theme ? `special special-${view.theme.special}` : `base-${view.theme.base}`}`} style={style}
      onClick={turn || ('base' in view.theme && view.theme.base === 'glass') ? () => requestTiltPermission() : undefined}>
      {tier === 'diamond' && <><Facets x={t.x} y={t.y} /><div className="pcard-iris" aria-hidden="true" /><div className="pcard-film" aria-hidden="true" /><div className="pcard-edge" aria-hidden="true" /></>}
      {tier && <div className="pcard-sheen" aria-hidden="true" />}
      {tier && tier !== 'diamond' && <Glints x={t.x} y={t.y} />}
      {volume && <VolumeIcon icon={icon as IconKey} x={t.x} y={t.y} />}
      {'base' in view.theme && view.theme.base === 'glass' && <GlassLayer tilt={t} />}
      {'special' in view.theme && view.theme.special === 'dev' && <DevLayer />}
      {'special' in view.theme && view.theme.special === 'beta' && <BetaLayer />}
      {tier === 'diamond' && card.no !== undefined && <div className="pcard-no" aria-label={`Бриллиант № ${card.no}`}><small>№</small>{card.no}</div>}
      {icon && !volume && (
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
