/**
 * The «Фосфор» style drawn in characters: what CSS alone cannot do — block digits of the timer, a loading bar,
 * pictures made of symbols, beans as «oooooooo..». Everything else of the style is in index.css
 * (`html[data-style="phosphor"]`); these are used only while it is on (useAscii).
 */
import { useSyncExternalStore } from 'react';
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
