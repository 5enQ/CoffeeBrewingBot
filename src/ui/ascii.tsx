/**
 * The «Фосфор» style drawn in characters: what CSS alone cannot do — block digits of the timer, a loading bar,
 * pictures made of symbols, beans as «oooooooo..». Everything else of the style is in index.css
 * (`html[data-style="phosphor"]`); these are used only while it is on (useAscii).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { activeStyle, onAppearance } from '../appearance';

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
