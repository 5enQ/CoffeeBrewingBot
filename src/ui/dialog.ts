/** Built-in dialogs for the web (window.confirm is blocked in many webviews) */
export interface DialogState {
  message: string;
  kind: 'confirm' | 'alert';
  resolve: (ok: boolean) => void;
}

let current: DialogState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const dialog = {
  get: () => current,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  close(ok: boolean) {
    const c = current;
    current = null;
    emit();
    c?.resolve(ok);
  },
  confirm(message: string) {
    return new Promise<boolean>((resolve) => { current = { message, kind: 'confirm', resolve }; emit(); });
  },
  alert(message: string) {
    return new Promise<void>((resolve) => { current = { message, kind: 'alert', resolve: () => resolve() }; emit(); });
  },
};
