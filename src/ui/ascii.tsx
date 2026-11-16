/**
 * The «Фосфор» style drawn in characters: what CSS alone cannot do — block digits of the timer, a loading bar,
 * pictures made of symbols, beans as «oooooooo..». Everything else of the style is in index.css
 * (`html[data-style="phosphor"]`); these are used only while it is on (useAscii).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { activeStyle, getAppearance, onAppearance } from '../appearance';
import { BREWS, plural } from '../data/plural';

const isAscii = () => activeStyle() === 'phosphor';
/** the green-monitor style is on screen (one's own, or a friend's card being looked at) */
export const useAscii = () => useSyncExternalStore(onAppearance, isAscii, isAscii);

/** 3×5 block digits, as an old terminal's big clock */
const GLYPH: Record<string, string[]> = {
  0: ['###', '# #', '# #', '# #', '###'], 1: [' # ', '## ', ' # ', ' # ', '###'], 2: ['###', '  #', '###', '#  ', '###'],
  3: ['###', '  #', '###', '  #', '###'], 4: ['# #', '# #', '###', '  #', '  #'], 5: ['###', '#  ', '###', '  #', '###'],
  6: ['###', '#  ', '###', '# #', '###'], 7: ['###', '  #', '  #', '  #', '  #'], 8: ['###', '# #', '###', '# #', '###'],
  9: ['###', '# #', '###', '  #', '###'], ':': [' ', '#', ' ', '#', ' '],
};
export function blockText(text: string): string {
  const chars = [...text].map((c) => GLYPH[c] ?? ['   ', '   ', '###', '   ', '   ']);
  return [0, 1, 2, 3, 4].map((r) => chars.map((g) => g[r]).join(' ')).join('\n');
}
export function AsciiDigits({ text, className = '' }: { text: string; className?: string }) {
  return <pre className={'ascii-digits ' + className} role="img" aria-label={text}>{blockText(text)}</pre>;
}

/** [=========>..........] — share 0…1 over `width` characters */
export function asciiBar(share: number, width = 24): [string, string] {
  const n = Math.max(0, Math.min(width, Math.round(share * width)));
  const done = n >= width ? '='.repeat(width) : n ? '='.repeat(n - 1) + '>' : '';
  return [done, '.'.repeat(width - done.length)];
}
export function AsciiBar({ share, width = 24, after }: { share: number; width?: number; after?: string }) {
  const [a, b] = asciiBar(share, width);
  return <div className="ascii-bar" aria-hidden="true">[<span>{a}</span><i>{b}</i>]{after && ` ${after}`}</div>;
}

/** «oooooooo..» — what is left, one character per tenth (beans) or per item (drips) */
export function AsciiStock({ on, of, mark = 'o' }: { on: number; of: number; mark?: string }) {
  const full = Math.max(0, Math.min(of, Math.round(on)));
  return <div className="stock-icons ascii-stock" aria-hidden="true">{mark.repeat(full)}<i>{'.'.repeat(of - full)}</i></div>;
}

/** a cup with steam, over the brewing screen */
export const CUP = `   ( (
    ) )
 ........
 |      |]
 \\      /
  \`----'`;

/** a doypack with the country's first letters on its label */
export const pack = (label: string) => {
  const l = (label || '').replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase().padEnd(3, ' ');
  return ` _______
|=======|
|       |
| ${l}   |
| ~~~~~ |
|  .:.  |
|_______|`;
};

/** a star written in text (an average «4 ★»): an asterisk on the green monitor */
export const starChar = () => (isAscii() ? '*' : '★');
export function StarChar() {
  return <>{useAscii() ? '*' : '★'}</>;
}

/** an open diary, for the empty half of the journal on a wide screen */
export const BOOK = `  _______ _______
 /       Y       \\
|  ----  |  ---- |
|  ----  |  ---- |
|  ----  |  ---- |
 \\_______|_______/`;

/** a person at a terminal, for the empty half of the profile */
export const PERSON = `    .---.
   ( o o )
    \\ - /
  .--'-'--.
 /  [___]  \\`;

/**
 * Brewbook's own easter-egg fish: a small fish of symbols swimming to and fro in a glass, bubbles rising to a
 * rippling surface. On the «Фосфор» card it takes the place of the whole avatar. A frame for tick `t`.
 */
export function fishFrame(t: number): string {
  const W = 13; // inside the glass
  // to and fro between the shine on the left wall and the right wall
  const at = (u: number) => { const p = ((u % 14) + 14) % 14; return { x: 1 + (p < 7 ? p : 14 - p), right: p < 7 }; };
  // four rows of water: the fish swims in the upper three, the bottom one has a weed and pebbles
  const water = Array.from({ length: 4 }, () => Array(W).fill(' ') as string[]);
  for (let r = 0; r < 3; r++) water[r][0] = r === 0 ? "'" : ':';
  water[3][2] = ','; water[3][3] = (t >> 1) % 2 ? ')' : '(';
  water[3][8] = '.'; water[3][9] = '_'; water[3][10] = '.';
  const y = (t >> 3) % 2 ? 1 : 2;
  const f = at(t);
  // bubbles: let out from the mouth every 4 ticks, a row up each tick; one reaching the surface pops on it
  let pop = -1;
  for (let k = 0; k < 2; k++) {
    const age = (t % 4) + 4 * k, fe = at(t - age), row = y - 1 - age;
    const col = Math.max(1, Math.min(W - 1, fe.right ? fe.x + 5 : fe.x - 1));
    if (row >= 0) water[row][col] = age < 2 ? 'o' : '.';
    else if (row === -1) pop = col;
  }
  const fish = f.right ? '><(8>' : '<8)><';
  for (let i = 0; i < 5; i++) water[y][f.x + i] = fish[i];
  const surface = (t % 2 ? '~-~-~-~-~-~-~' : '-~-~-~-~-~-~-').split('');
  if (pop >= 0) surface[pop] = '*';
  return [
    '.-------------.',
    "|          '  |",
    '|' + surface.join('') + '|',
    ...water.map((r) => '|' + r.join('') + '|'),
    '|.:,:.:.,:.:.:|',
    "'-------------'",
    ' \\___________/ ',
  ].join('\n');
}

/** the fish, moving unless the backgrounds are still (Профиль → Вид интерфейса) or motion is reduced */
export function PhosphorFish({ still = false }: { still?: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (still || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const id = setInterval(() => setT((x) => x + 1), 350);
    return () => clearInterval(id);
  }, [still]);
  return <pre className="pcard-fish" role="img" aria-label="Рыбка в стакане">{fishFrame(t)}</pre>;
}

/**
 * The cup on the brew tab with its steam rising: two wisps of ( and ), each a step up per tick, fading into
 * ' and . at the top. A frame for tick `t` (the cup itself is CUP without its still steam).
 */
export function steamFrame(t: number): string {
  const rows = [Array(10).fill(' '), Array(10).fill(' '), Array(10).fill(' ')] as string[][];
  [[3, 0], [6, 1]].forEach(([col, ph]) => {
    for (let r = 0; r < 3; r++) {
      const s = t - r + ph * 2, odd = ((s % 2) + 2) % 2 === 1;
      const ch = r === 0 ? (((s % 3) + 3) % 3 === 0 ? ' ' : odd ? "'" : '.') : odd ? ')' : '(';
      rows[r][col + (odd ? 1 : 0)] = ch;
    }
  });
  return [...rows.map((r) => r.join('').replace(/\s+$/, '')), ...CUP.split('\n').slice(2)].join('\n');
}

/** ticks while motion is welcome: none with «Анимация фонов» off or reduced motion */
function useTick(ms: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const calm = () => getAppearance().still || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (calm()) return;
    const id = setInterval(() => { if (!calm() && !document.hidden) setT((x) => x + 1); }, ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

/** the cup with its steam rising (brew tab, the empty half of a wide window) */
export function SteamCup({ className = '' }: { className?: string }) {
  const t = useTick(450);
  return <pre className={'ascii-art ' + className} aria-hidden="true">{steamFrame(t)}</pre>;
}

/* ---------- the coffee tree: a bonsai of symbols for the empty half of the profile ---------- */

/** how the tree is doing: brews in the last two weeks → 1 dying … 4 lush */
export function treeStage(brewsIn14Days: number): 1 | 2 | 3 | 4 {
  return brewsIn14Days >= 10 ? 4 : brewsIn14Days >= 4 ? 3 : brewsIn14Days >= 1 ? 2 : 1;
}

type Cell = [string, string]; // character, class: t trunk, l bright leaf, d dim leaf, y yellowed leaf, p pot, f falling leaf
const TW = 48, TH = 21, CX = 24;

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/** the still parts (pot, trunk, branches) and the leaves of one stage, made once */
function treeParts(stage: 1 | 2 | 3 | 4) {
  const r = rng(7);
  const g: (Cell | null)[][] = Array.from({ length: TH }, () => Array(TW).fill(null));
  const put = (x: number, y: number, c: string, k: string) => { if (x >= 0 && x < TW && y >= 0 && y < TH && c !== ' ') g[y][x] = [c, k]; };
  const text = (x: number, y: number, s: string, k: string) => [...s].forEach((c, i) => put(x + i, y, c, k));
  // the pot
  text(CX - 14, 18, '\\' + '_'.repeat(10) + './||\\.' + '_'.repeat(10) + '/', 'p');
  text(CX - 14, 19, ' \\    ~' + ' '.repeat(14) + '.   / ', 'p');
  text(CX - 14, 20, '  \\' + '_'.repeat(22) + '/  ', 'p');
  // the trunk, with a little bark
  const bark = ['||', '=|', '|\\', '~|', '||', '|:'];
  for (let y = 10; y <= 17; y++) text(CX - 1, y, bark[Math.floor(r() * bark.length)], 't');
  // branches: a line of / \ _ ~ from the trunk to each tip
  const branch = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    let py = y0;
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps), y = Math.round(y0 + ((y1 - y0) * i) / steps);
      const c = y === py ? (r() < 0.2 ? '~' : '_') : (x1 < x0 ? '\\' : x1 > x0 ? '/' : '|');
      put(x, y, c, 't'); py = y;
    }
  };
  const tips: [number, number, number, number][] = [];
  const twig = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number) => { branch(x0, y0, x1, y1); tips.push([x1, y1, rx, ry]); };
  twig(CX - 1, 13, CX - 12, 8, 7, 2.2);
  twig(CX, 12, CX + 11, 6, 7, 2.2);
  twig(CX - 1, 10, CX - 5, 4, 6, 2);
  twig(CX, 10, CX + 4, 3, 6, 2);
  twig(CX - 12, 8, CX - 18, 6, 4, 1.6);
  twig(CX + 11, 6, CX + 17, 4, 4, 1.6);
  tips.push([CX - 7, 9, 4, 1.2], [CX + 7, 8, 4, 1.2]);
  // leaves: thick on a lush tree, sparse and yellowing on a thirsty one
  const p = { 4: 0.86, 3: 0.55, 2: 0.26, 1: 0.07 }[stage];
  const leaves: { x: number; y: number; c: string; k: string; h: number }[] = [];
  const seen = new Set<string>();
  // a lush crown spreads wider
  const grow = { 4: 1.3, 3: 1.08, 2: 1, 1: 1 }[stage];
  for (const [cx, cy, rx0, ry0] of tips) {
    const rx = rx0 * grow, ry = ry0 * (grow > 1 ? grow * 0.95 : 1);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1 || y < 0 || seen.has(`${x},${y}`)) continue;
      const roll = r();
      if (roll > p * (1 - d * 0.45)) continue;
      seen.add(`${x},${y}`);
      const k = stage === 1 ? 'y' : stage === 2 && r() < 0.3 ? 'y' : r() < 0.6 ? 'l' : 'd';
      leaves.push({ x, y, c: '&%@#'[Math.floor(r() * 4)], k, h: Math.floor(r() * 1000) });
    }
  }
  return { g, leaves };
}
const TREES = new Map<number, ReturnType<typeof treeParts>>();

/** a frame of the tree at tick `t`: rows of [text, class] runs; the leaves sway with the wind, some fall */
export function treeFrame(stage: 1 | 2 | 3 | 4, t: number): Cell[][] {
  if (!TREES.has(stage)) TREES.set(stage, treeParts(stage));
  const { g, leaves } = TREES.get(stage)!;
  const grid = g.map((row) => row.slice());
  for (const l of leaves) {
    const amp = l.y < 5 ? 1.3 : l.y < 8 ? 0.9 : 0.5;
    const x = l.x + Math.round(amp * Math.sin(t * 0.45 + l.y * 0.7 + l.x * 0.04));
    const c = (l.h + t) % 23 === 0 ? '&%@#'[(l.h + t) % 4] : l.c;
    if (x >= 0 && x < TW) grid[l.y][x] = [c, l.k];
  }
  // a thirsty tree drops leaves: they drift down to the pot
  const falling = { 4: 0, 3: 0, 2: 2, 1: 4 }[stage];
  for (let i = 0; i < falling; i++) {
    const span = 13, y = 5 + ((Math.floor(t / 2) + i * 5) % span), x = CX - 14 + ((i * 11) % 28) + Math.round(Math.sin((t + i * 3) * 0.5) * 2);
    if (y < 18 && !grid[y][x]) grid[y][x] = [(t + i) % 2 ? ',' : '`', 'f'];
  }
  return grid.map((row) => {
    const runs: Cell[] = [];
    for (const cell of row) {
      const [c, k] = cell ?? [' ', ''];
      const last = runs[runs.length - 1];
      if (last && last[1] === k) last[0] += c; else runs.push([c, k]);
    }
    return runs;
  });
}

const STAGE_TEXT = { 4: 'пышное', 3: 'крепкое', 2: 'редеет', 1: 'засыхает' } as const;
/** the tree for a number of brews in the last two weeks, swaying unless motion is unwelcome */
export function CoffeeTree({ brews }: { brews: number }) {
  const t = useTick(380);
  const stage = treeStage(brews);
  const rows = treeFrame(stage, t);
  return (
    <figure className="coffee-tree">
      <pre className={'bonsai stage-' + stage} role="img" aria-label={`Дерево кофемана: ${STAGE_TEXT[stage]}`}>
        {rows.map((runs, y) => <span key={y}>{runs.map(([s, k], i) => (k ? <span key={i} className={k}>{s}</span> : s))}{'\n'}</span>)}
      </pre>
      <figcaption>
        <span>== ДЕРЕВО КОФЕМАНА: {STAGE_TEXT[stage].toUpperCase()} ==</span>
        <span>{stage === 1 ? 'Две недели без кофе. Заварите что-нибудь — оно оживёт.' : `${brews} ${plural(brews, BREWS)} за две недели.${stage < 4 ? ' Чаще заваривайте — оно разрастётся.' : ''}`}</span>
      </figcaption>
    </figure>
  );
}
