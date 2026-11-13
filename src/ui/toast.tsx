import { useEffect, useState, useSyncExternalStore } from 'react';

/** Short popup message at the bottom of the screen ("Copied" etc.) */
let current: { id: number; text: string } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string) {
  current = { id: ++seq, text };
  emit();
  announce(text);
}

/* One live region, present from the start; only its text changes. Screen readers often miss a region that
   appears together with its words, so the visible popups are hidden from them and speak through this (WCAG 4.1.3). */
let said = '';
const ears = new Set<() => void>();
export function announce(text: string) {
  said = '';
  ears.forEach((l) => l());
  // cleared first, filled on the next frame: the same words twice in a row are still read out
  requestAnimationFrame(() => { said = text; ears.forEach((l) => l()); });
}

export function LiveRegion() {
  const [, tick] = useState(0);
  useEffect(() => { const l = () => tick((n) => n + 1); ears.add(l); return () => { ears.delete(l); }; }, []);
  return <div className="sr-only" role="status" aria-live="polite">{said}</div>;
}

export function ToastHost() {
  const t = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current);
  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const timer = setTimeout(() => { if (current?.id === id) { current = null; emit(); } }, 2200);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return <div className="snack" aria-hidden="true" key={t.id}>{t.text}</div>;
}

/** Copy with a fallback for webviews without the Clipboard API */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
