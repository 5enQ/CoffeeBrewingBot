/**
 * Picture backgrounds of the card: rare lots (Japan, eugenioides, liberica) and the owner's lighthouse.
 * The drawings come from sceneSvg.ts (made from the approved sketches); ids get a per-card suffix so several cards
 * on a page (one of them maybe hidden) never borrow each other's gradients.
 *
 * The lighthouse is traced: the beam turns once in T seconds — left at 0, toward us at 1/4, right at 1/2, away at 3/4.
 * Every wave crest on the sea is mapped back to the water plane (the horizon at y 138, perspective) and lights up at
 * the moment the beam's direction passes over it; a soft patch shows where the beam meets the water; the beam in the
 * air stretches with the sideways part of the same direction. All of it from one angle, so it moves as one.
 */
import { EUGENIOIDES_SVG, JAPAN_SVG, LIBERICA_SVG, LIGHTHOUSE_SVG } from './sceneSvg';

export type SceneId = 'japan' | 'eugenioides' | 'liberica' | 'lighthouse';
export const LIGHTHOUSE_T = 14;

const f = (n: number, d = 1) => n.toFixed(d);

/** the lighthouse's computed parts: crests on the water, the patch where the beam meets it, the beam's stretch */
function lighthouseParts() {
  const H = 138, T = LIGHTHOUSE_T, N = 180;
  const world = (x: number, y: number) => { const z = 4000 / (y - H); return { X: ((x - 180) * z) / 400, Z: z }; };
  const L = world(284, 192); // the foot of the tower
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // crests are grouped by the moment the beam passes them: one animated group per 1/BINS of the turn instead of
  // one animation per crest — 520 animated rects made switching to and from the Profile tab stall (v1.7.3)
  const BINS = 72;
  const bins: string[] = Array.from({ length: BINS }, () => '');
  for (let k = 0; k < 520; k++) {
    const y = H + 3 + Math.pow(rnd(), 1.6) * 84, x = rnd() * 360;
    if (x > 236 && y > 186) continue; // the cliff
    const w = world(x, y), dx = w.X - L.X, dz = L.Z - w.Z; // dz > 0: nearer to us than the lighthouse
    const ang = (Math.atan2(dz, dx) * 180) / Math.PI;       // 180 left, 90 toward us, 0 right, -90 away
    const t = ((((180 - ang) / 360) % 1) + 1) % 1;           // the moment of the turn the beam points there
    const bright = Math.max(0.25, Math.min(1, 2.2 / (1 + Math.hypot(dx, dz) / 30))) * (dz < -2 ? 0.4 : 1);
    const len = (2 + (y - H) * 0.1) * (0.7 + rnd() * 0.8);
    bins[Math.round(t * BINS) % BINS] += `<rect x="${f(x - len / 2)}" y="${f(y)}" width="${f(len)}" height="${f(0.6 + (y - H) * 0.012, 2)}" rx=".5" fill-opacity="${f(bright, 2)}"/>`;
  }
  let water = '';
  bins.forEach((rects, i) => {
    if (rects) water += `<g class="lh-crests" fill="#fff1b8" style="opacity:0;animation:bg-lh-crest ${T}s linear infinite calc(var(--lh-t, 0s) + ${f(-(1 - i / BINS) * T, 2)}s)">${rects}</g>`;
  });
  // the lantern's own reflection straight down the water toward us, shimmering (each period divides T)
  const SHIM = [1.4, 1.75, 2, 2.8, 3.5];
  for (let k = 0; k < 26; k++) {
    const y = 142 + rnd() * 46, spread = 2 + (y - 142) * 0.25, len = 1.5 + rnd() * 3;
    water += `<rect x="${f(262 + (rnd() - 0.5) * spread - len / 2)}" y="${f(y)}" width="${f(len)}" height="1" fill="#ffe9a0" style="opacity:0;animation:bg-lh-shim ${SHIM[Math.floor(rnd() * SHIM.length)]}s linear infinite ${f(-rnd() * 3, 2)}s"/>`;
  }
  const scr = (X: number, Z: number) => [180 + (X * 400) / Z, H + 4000 / Z];
  const ds: string[] = [], ops: string[] = [], scales: string[] = [], bops: string[] = [];
  for (let i = 0; i <= N; i++) {
    const a = ((180 - (360 * i) / N) * Math.PI) / 180, toward = Math.sin(a), side = -Math.cos(a);
    // the patch: a narrow wedge (±5°) out from the foot of the tower; toward us it stops at the card's bottom edge
    const ray = (da: number, d: number) => {
      const b = a + da, sb = Math.sin(b);
      const dd = Math.min(d, sb > 0 ? (L.Z - 40) / sb : Infinity);
      return scr(L.X + Math.cos(b) * dd, L.Z - sb * dd);
    };
    const w = (5 * Math.PI) / 180;
    const pts = [ray(0, 2), ...[20, 60, 140, 260, 460].map((d) => ray(-w, d)), ...[460, 260, 140, 60, 20].map((d) => ray(w, d))];
    ds.push('M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + 'Z');
    ops.push(f(0.14 + 0.1 * (1 + toward) + 0.12 * Math.max(0, toward) ** 2, 3));
    // the beam in the air: drawn to the left, stretched by the sideways part of the direction; smooth all round
    const sx = Math.abs(side) < 0.002 ? (side < 0 ? -0.002 : 0.002) : side;
    scales.push(`${f(sx, 4)} 1`);
    bops.push(f((0.25 + 0.75 * Math.abs(side)) * (0.8 + 0.2 * toward), 3));
  }
  const anim = (attr: string, vals: string[], type?: string) =>
    `<${type ? 'animateTransform' : 'animate'} attributeName="${attr}"${type ? ` type="${type}"` : ''} values="${vals.join(';')}" dur="${T}s" repeatCount="indefinite"/>`;
  return {
    water, spotD: ds[0], spotO: ops[0],
    spotAnim: anim('d', ds) + anim('opacity', ops),
    beamScale: anim('transform', scales, 'scale'),
    beamOp: anim('opacity', bops),
  };
}

let lh: ReturnType<typeof lighthouseParts> | null = null;

/** the markup inside the scene's <svg>, ids made unique with uid */
export function sceneMarkup(id: SceneId, uid: string): string {
  let svg = id === 'japan' ? JAPAN_SVG : id === 'eugenioides' ? EUGENIOIDES_SVG : id === 'liberica' ? LIBERICA_SVG : LIGHTHOUSE_SVG;
  if (id === 'lighthouse') {
    lh ??= lighthouseParts();
    svg = svg.replace('__WATER__', lh.water).replace('__SPOTD__', lh.spotD).replace('__SPOTO__', lh.spotO)
      .replace('__SPOTANIM__', lh.spotAnim).replace('__BEAMSCALE__', lh.beamScale).replace('__BEAMOP__', lh.beamOp);
  }
  return svg.replaceAll('__U', '-' + uid);
}
