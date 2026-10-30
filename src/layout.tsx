import { createContext, useContext, useEffect, useState } from 'react';
import { platform } from './platform';
import { useStore } from './data/store';

export type LayoutMode = 'mobile' | 'desktop';

/** Window width from which the desktop layout is used (same for "Auto" and "Desktop") */
export const DESKTOP_MIN = 860;

export const LayoutCtx = createContext<LayoutMode>('mobile');
export const useLayout = () => useContext(LayoutCtx);

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

/** Which layout to show: profile choice → device → window width */
export function useLayoutMode(): { mode: LayoutMode; desktopClient: boolean; width: number } {
  const { profile } = useStore();
  const width = useWidth();
  const desktopClient = platform.isDesktopClient();
  const pref = profile.layout ?? 'auto';
  let mode: LayoutMode = 'mobile';
  if (pref === 'desktop') mode = width >= DESKTOP_MIN ? 'desktop' : 'mobile';
  else if (pref === 'auto') mode = desktopClient && width >= DESKTOP_MIN ? 'desktop' : 'mobile';
  return { mode, desktopClient, width };
}
