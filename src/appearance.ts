import { useSyncExternalStore } from 'react';

/**
 * How the interface looks on this device: the color theme, high contrast and whether backgrounds move.
 * A per-device setting (like the layout), kept in localStorage so it applies before the first paint.
 */
export type ThemePref = 'auto' | 'light' | 'dark';
/** still — the looping backgrounds (card scenes, holiday decorations) stand still: a pause for WCAG 2.2.2 */
/** style — a whole look on top of the palette: 'phosphor', the green monitor (data/phosphor.ts), set from the profile card */
export type Appearance = { theme: ThemePref; contrast: boolean; still?: boolean; style?: 'phosphor' };

const KEY = 'brewbook.appearance';
const DEFAULT: Appearance = { theme: 'auto', contrast: false };

function read(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object') {
      return { theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto', contrast: v.contrast === true, still: v.still === true, ...(v.style === 'phosphor' ? { style: 'phosphor' as const } : {}) };
    }
  } catch { /* no storage or broken value */ }
  return DEFAULT;
}

let current = read();
const listeners = new Set<() => void>();

export const getAppearance = () => current;

export function setAppearance(next: Appearance) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* no storage */ }
  listeners.forEach((l) => l());
}

/**
 * A friend's shared card in a style of its own: the screen showing it puts that style on while it is open
 * (null — back to the person's own). Not saved.
 */
let visit: Appearance['style'] | null = null;
export function setVisitStyle(style: Appearance['style'] | null) {
  if (visit === style) return;
  visit = style;
  listeners.forEach((l) => l());
}
/** the style on screen now: a friend's card being looked at, otherwise one's own */
export const activeStyle = () => visit ?? current.style;

export function onAppearance(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export const useAppearance = () => useSyncExternalStore(onAppearance, getAppearance, getAppearance);

/**
 * Put the choice on <html>: data-theme picks the palette (none — follow the device), data-contrast="high"
 * swaps in the stronger tokens. `scheme` is the device's own scheme, used when the choice is "auto"
 * and the platform has to name it (Telegram).
 */
export function markRoot(scheme?: 'light' | 'dark') {
  const el = document.documentElement;
  const style = activeStyle();
  // the green monitor is a dark screen whatever the palette chosen
  const theme = style === 'phosphor' ? 'dark' : current.theme === 'auto' ? scheme : current.theme;
  if (theme) el.dataset.theme = theme; else delete el.dataset.theme;
  if (style) el.dataset.style = style; else delete el.dataset.style;
  if (current.contrast) el.dataset.contrast = 'high'; else delete el.dataset.contrast;
  if (current.still) el.dataset.still = ''; else delete el.dataset.still;
}
