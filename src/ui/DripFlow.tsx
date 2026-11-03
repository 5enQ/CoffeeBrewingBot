import { useEffect, useId, useRef } from 'react';
import type { BrewStep } from '../data/methods';

/**
 * Drip timer motion inside the ring, behind the time: while a pour runs, water falls down the whole circle
 * (soft sheets, glints sliding down them, eddies that bend the water and draw small curls); in a pause,
 * drops fall in from above and splash at the bottom — often right after the pour, sparse by its end.
 * A pour is a step with grams (`to`), any other step is a wait. Drawn straight into the SVG every frame,
 * React only mounts the groups. The timer's viewBox is 260 × 260, the ring at r 112, so the motion keeps to r 100.
 */
const NS = 'http://www.w3.org/2000/svg';
const CX = 130, IN = 100;

const SHEETS = [{ x: 70, w: 22, op: 0.07 }, { x: 102, w: 30, op: 0.09 }, { x: 134, w: 20, op: 0.08 }, { x: 160, w: 34, op: 0.09 }, { x: 192, w: 22, op: 0.07 }];
const GLINTS = Array.from({ length: 16 }, (_, j) => ({ x: 58 + j * 9.4 + ((j * 7) % 5) - 2, w: 0.8 + ((j * 5) % 3) * 0.5, op: 0.18 + ((j * 3) % 4) * 0.07,
  v: 150 + ((j * 37) % 6) * 22, dash: 40 + ((j * 13) % 5) * 14, gap: 70 + ((j * 11) % 4) * 30, ph: j * 0.9, light: j % 3 === 1 }));
/** a round drop drawn like the method icons: an outline with a little arc of light inside */
const DROP = '<g transform="translate(-16 -19)"><path class="drop-o" d="M16 8.5c2.6 3.2 9 7.6 9 12.5a9 9 0 0 1-18 0c0-4.9 6.4-9.3 9-12.5z" /><path class="drop-o" d="M11.6 21.6a4.6 4.6 0 0 0 4.4 4.2" /></g>';

interface Eddy { x: number; y: number; r: number; a: number; dir: number; spin: number; v: number; ang: number; curls: SVGPathElement[] }
interface Drop { g: SVGGElement; x: number; y: number; end: number; v: number; age: number; size: number; state: 'fall' | 'splash'; ring?: SVGEllipseElement; bits?: { e: SVGCircleElement; vx: number; vy: number }[] }

const edge = (x: number) => Math.sqrt(Math.max(0, IN * IN - (x - CX) ** 2));
const el = <K extends keyof SVGElementTagNameMap>(tag: K, cls: string, parent: Element) => {
  const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); parent.appendChild(e); return e;
};

export function DripFlow({ steps, total, now, running }: { steps: BrewStep[]; total: number; now: () => number; running: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const river = useRef<SVGGElement>(null), dropsG = useRef<SVGGElement>(null);
  // the latest plan and clock for the frame loop (a skip changes the steps while it runs)
  const live = useRef({ steps, total, now, running }); live.current = { steps, total, now, running };

  useEffect(() => {
    const rv = river.current, dg = dropsG.current;
    if (!rv || !dg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sheets = SHEETS.map((l) => { const e = el('path', 'flow-sheet', rv); e.style.strokeWidth = String(l.w); e.style.opacity = String(l.op); return e; });
    const glints = GLINTS.map((l) => { const e = el('path', 'flow-glint' + (l.light ? ' light' : ''), rv); e.style.strokeWidth = String(l.w); e.style.opacity = String(l.op);
      e.setAttribute('stroke-dasharray', `${l.dash} ${l.gap}`); return e; });
    const eddyG = el('g', '', rv);
    let eddies: Eddy[] = [], drops: Drop[] = [], eddyAcc = 0, dropAcc = 0, last = performance.now(), raf = 0, t = 0;

    // a line of water: almost straight, bent sideways where an eddy passes
    const fall = (x: number, ph: number) => {
      let d = '';
      for (let y = 16; y <= 248; y += 6) {
        let xx = x + 1.6 * Math.sin(y * 0.012 + ph + t * 0.6) * (y / 248);
        for (const e of eddies) { const dy = (y - e.y) / 24, dx = (x - e.x) / 30, f = Math.exp(-dy * dy - dx * dx); if (f > 0.01) xx += e.a * f * Math.sin(dy * 1.3 + e.ang * 0.5) * e.dir; }
        d += (d ? ' L' : 'M') + xx.toFixed(1) + ' ' + y;
      }
      return d;
    };
    // a curl: a short spiral arc, turning as it goes down
    const curl = (e: Eddy, k: number) => {
      let d = '';
      for (let i = 0; i <= 10; i++) { const a = e.ang + k * 1.6 + e.dir * i * 0.42, r = e.r * (1 - (i / 10) * 0.55) * (k ? 0.7 : 1);
        d += (i ? ' L' : 'M') + (e.x + r * Math.cos(a)).toFixed(1) + ' ' + (e.y + r * Math.sin(a) * 0.8).toFixed(1); }
      return d;
    };
    const place = (p: Drop, sx: number, sy: number) => p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(sx * p.size).toFixed(3)} ${(sy * p.size).toFixed(3)})`);

    const frame = (ms: number) => {
      // paused: everything holds still where it is
      const dt = live.current.running ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms; t += dt;
      const { steps: st, total: end, now: clock } = live.current;
      const at = clock();
      const i = st.reduce((acc, s, j) => (s.at <= at ? j : acc), -1);
      const s = st[i], len = (st[i + 1]?.at ?? end) - (s?.at ?? 0), into = s ? at - s.at : 0, k = len > 0 ? into / len : 1;
      const pour = !!s && s.to !== undefined && at < end, wait = !!s && s.to === undefined && at < end;

      // the pour fades in and out with its step
      const on = pour ? Math.max(0, Math.min(1, into / 0.4, (len - into) / 0.4)) : 0;
      rv.style.opacity = on.toFixed(2);
      eddyAcc += on > 0.5 ? dt : 0;
      if (on > 0.5 && eddyAcc > 0.45) {
        eddyAcc = 0;
        const dir = Math.random() < 0.5 ? -1 : 1;
        eddies.push({ x: 66 + Math.random() * 128, y: 30 + Math.random() * 40, r: 5 + Math.random() * 5, a: 4 + Math.random() * 4, dir, spin: (2.5 + Math.random() * 2) * dir,
          v: 95 + Math.random() * 45, ang: Math.random() * 6.28, curls: [0, 1].map((n) => { const e = el('path', 'flow-eddy' + (n ? ' light' : ''), eddyG); e.style.strokeWidth = n ? '1' : '1.6'; return e; }) });
      }
      eddies = eddies.filter((e) => {
        e.y += e.v * dt; e.ang += e.spin * dt;
        const life = Math.min(1, (e.y - 20) / 40, (240 - e.y) / 50);
        if ((life <= 0 && e.y > 100) || on === 0) { e.curls.forEach((c) => c.remove()); return false; }
        e.curls.forEach((c, n) => { c.setAttribute('d', curl(e, n)); c.style.opacity = (Math.max(0, life) * (n ? 0.45 : 0.22)).toFixed(2); });
        return true;
      });
      if (on > 0) {
        SHEETS.forEach((l, j) => { sheets[j].setAttribute('d', fall(l.x, j * 1.7)); sheets[j].style.strokeWidth = (l.w * (0.92 + 0.08 * Math.sin(t * 1.3 + j))).toFixed(1); });
        GLINTS.forEach((l, j) => { glints[j].setAttribute('d', fall(l.x, l.ph)); glints[j].setAttribute('stroke-dashoffset', (-t * l.v).toFixed(1)); });
      }

      // a pause: drops fall in from above the circle and splash at its bottom
      if (wait) { dropAcc += dt * (2.2 * Math.exp(-3 * k) + 0.45); if (dropAcc > 1) {
        dropAcc = 0;
        const x = 64 + Math.random() * 132, g = el('g', 'flow-drop', dg); g.innerHTML = DROP;
        drops.push({ g, x, y: CX - edge(x) - 14, end: CX + edge(x) - 14, v: 140 + Math.random() * 60, age: 0, size: 0.8 + Math.random() * 0.3, state: 'fall' });
      } }
      drops = drops.filter((p) => {
        p.age += dt;
        if (p.state === 'fall') {
          p.v += 300 * dt; p.y += p.v * dt;
          const sy = Math.min(1.12, 1 + p.v / 1800);
          place(p, 1 / Math.sqrt(sy), sy);
          if (p.y >= p.end) {
            // a ring spreads, two tiny drops jump out and fall back
            p.state = 'splash'; p.age = 0; p.g.innerHTML = '';
            p.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.end + 4).toFixed(1)})`);
            p.ring = el('ellipse', 'flow-ring', p.g);
            p.bits = [-1, 1].map((side) => { const e = el('circle', 'flow-bit', p.g); e.setAttribute('r', String(1.3 + Math.random() * 0.6)); return { e, vx: side * (14 + Math.random() * 14), vy: 50 + Math.random() * 30 }; });
          }
          return true;
        }
        const q = p.age / 0.8;
        if (q >= 1) { p.g.remove(); return false; }
        p.ring!.setAttribute('rx', (3 + q * 18).toFixed(1)); p.ring!.setAttribute('ry', (1 + q * 3.4).toFixed(1)); p.ring!.style.opacity = (0.5 * (1 - q)).toFixed(2);
        p.bits!.forEach((b) => { b.e.setAttribute('cx', (b.vx * p.age).toFixed(1)); b.e.setAttribute('cy', (-b.vy * p.age + 300 * p.age * p.age).toFixed(1)); b.e.style.opacity = Math.max(0, 0.6 * (1 - q * 1.4)).toFixed(2); });
        return true;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); rv.replaceChildren(); dg.replaceChildren(); rv.style.opacity = '0'; };
  }, []);

  return (
    <g className="drip-flow">
      <defs>
        <clipPath id={`fl-in-${uid}`}><circle cx={CX} cy={CX} r={IN} /></clipPath>
        <radialGradient id={`fl-fade-${uid}`}><stop offset="0.55" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <mask id={`fl-soft-${uid}`}><circle cx={CX} cy={CX} r={IN} fill={`url(#fl-fade-${uid})`} /></mask>
      </defs>
      <g clipPath={`url(#fl-in-${uid})`}>
        <g ref={river} mask={`url(#fl-soft-${uid})`} style={{ opacity: 0 }} />
        <g ref={dropsG} />
      </g>
    </g>
  );
}
