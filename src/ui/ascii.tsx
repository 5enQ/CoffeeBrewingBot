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
  const W = 11, H = 5; // inside the glass
  const at = (u: number) => { const p = ((u % 12) + 12) % 12; return { x: p < 6 ? p : 12 - p, right: p < 6 }; };
  const rows = Array.from({ length: H }, () => Array(W).fill(' ') as string[]);
  const y = (t >> 3) % 2 ? 2 : 3;
  const f = at(t);
  // two bubbles in the water: let out from the mouth every 4 ticks, a row up each tick, popping at the surface
  for (let k = 0; k < 2; k++) {
    const age = (t % 4) + 4 * k, fe = at(t - age), row = y - 1 - age;
    const col = Math.max(0, Math.min(W - 1, fe.right ? fe.x + 5 : fe.x - 1));
    if (row >= 0) rows[row][col] = age < 2 ? 'o' : '.';
  }
  const fish = f.right ? '><(o>' : '<o)><';
  for (let i = 0; i < 5; i++) rows[y][f.x + i] = fish[i];
  const surface = t % 2 ? '~-~-~-~-~-~' : '-~-~-~-~-~-';
  return ['.' + surface + '.', ...rows.map((r) => '|' + r.join('') + '|'), ' \\' + '_'.repeat(W - 2) + '/ '].join('\n');
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
