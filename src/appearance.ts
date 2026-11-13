import { useSyncExternalStore } from 'react';

/**
 * How the interface looks on this device: the color theme, high contrast and whether backgrounds move.
 * A per-device setting (like the layout), kept in localStorage so it applies before the first paint.
 */
export type ThemePref = 'auto' | 'light' | 'dark';
/** still — the looping backgrounds (card scenes, holiday decorations) stand still: a pause for WCAG 2.2.2 */
export type Appearance = { theme: ThemePref; contrast: boolean; still?: boolean };

const KEY = 'brewbook.appearance';
const DEFAULT: Appearance = { theme: 'auto', contrast: false };

function read(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object') {
      return { theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto', contrast: v.contrast === true, still: v.still === true };
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
  const theme = current.theme === 'auto' ? scheme : current.theme;
  if (theme) el.dataset.theme = theme; else delete el.dataset.theme;
  if (current.contrast) el.dataset.contrast = 'high'; else delete el.dataset.contrast;
  if (current.still) el.dataset.still = ''; else delete el.dataset.still;
}
