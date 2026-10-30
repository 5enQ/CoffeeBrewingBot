/**
 * Profile card. Base themes are flat colors; bronze / silver / gold are brushed metal with a sheen that follows the tilt;
 * diamond is a faceted, iridescent 3D card that turns with the device (or the mouse on a computer).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
        target.current = { x: Math.sin(now / 1700) * 0.55, y: Math.cos(now / 2300) * 0.4 };
      }
      setT((cur) => {
        const nx = cur.x + (target.current.x - cur.x) * 0.12, ny = cur.y + (target.current.y - cur.y) * 0.12;
        return Math.abs(nx - cur.x) < 0.001 && Math.abs(ny - cur.y) < 0.001 ? cur : { x: nx, y: ny };
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

function Facets({ x, y }: { x: number; y: number }) {
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
}

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

/** Terminal-dark card with faint code, a glowing cursor and a "</>" mark in the corner */
function DevLayer() {
  return (
    <>
      <div className="pcard-code" aria-hidden="true"><div className="pcard-code-in">{[...CODE, ...CODE].map((l, i) => <div key={i}>{l}</div>)}</div></div>
      <div className="pcard-corner pcard-dev-mark" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 9l-6 7 6 7M21 9l6 7-6 7M18 7l-4 18" />
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
  const t = useTilt(live && (!!tier || 'special' in view.theme), ref);
  const [photoOk, setPhotoOk] = useState(true);
  const icon = 'tier' in view.theme ? view.theme.icon : null;

  // diamond and volume cards turn in 3D; diamond the most
  const turn = tier === 'diamond' ? [18, 15] : tier === 'volume' ? [10, 8] : null;
  const style = {
    '--tx': t.x.toFixed(3), '--ty': t.y.toFixed(3),
    ...(turn ? { transform: `perspective(800px) rotateY(${(t.x * turn[0]).toFixed(2)}deg) rotateX(${(-t.y * turn[1]).toFixed(2)}deg)` } : {}),
  } as React.CSSProperties;
  const volume = tier === 'volume' && icon && icon !== 'star';

  return (
    <div ref={ref} className={`pcard ${'tier' in view.theme ? `tier tier-${view.theme.tier}` : 'special' in view.theme ? `special special-${view.theme.special}` : `base-${view.theme.base}`}`} style={style}
      onClick={turn ? () => requestTiltPermission() : undefined}>
      {tier === 'diamond' && <><Facets x={t.x} y={t.y} /><div className="pcard-iris" aria-hidden="true" /><div className="pcard-film" aria-hidden="true" /><div className="pcard-edge" aria-hidden="true" /></>}
      {tier && <div className="pcard-sheen" aria-hidden="true" />}
      {tier && tier !== 'diamond' && <Glints x={t.x} y={t.y} />}
      {volume && <VolumeIcon icon={icon as IconKey} x={t.x} y={t.y} />}
      {'special' in view.theme && view.theme.special === 'dev' && <DevLayer />}
      {tier === 'diamond' && card.no && <div className="pcard-no" aria-label={`Бриллиант № ${card.no}`}><small>№</small>{card.no}</div>}
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
