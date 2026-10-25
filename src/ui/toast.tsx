import { useEffect, useSyncExternalStore } from 'react';

/** Короткое всплывающее сообщение внизу экрана («Скопировано» и т. п.) */
let current: { id: number; text: string } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string) {
  current = { id: ++seq, text };
  emit();
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
  return <div className="snack" role="status" key={t.id}>{t.text}</div>;
}

/** Копирование с запасным способом для вебвью, где Clipboard API недоступен */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* ниже */ }
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
