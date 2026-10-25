import type { IconKey } from '../data/methods';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const METHOD_PATHS: Record<IconKey, React.ReactNode> = {
  v60: <><path d="M5 8h22l-8.5 12h-5z" /><path d="M8 8l2-2h12l2 2" /><path d="M11 26h10M13.5 20v6M18.5 20v6" /><path d="M27 10c2 0 2.5 3 0 4" /></>,
  kalita: <><path d="M6 9h20l-4 11H10z" /><path d="M11 9l2 11M16 9v11M21 9l-2 11" /><path d="M8 25h16" /></>,
  chemex: <><path d="M9 4h14l-5.5 11L23 28H9l5.5-13z" /><path d="M12 13h8" strokeWidth={3} /><path d="M20 4l3-1" /></>,
  aeropress: <><rect x="10" y="10" width="12" height="16" rx="1.5" /><path d="M12 10V5h8v5" /><path d="M9 26h14" /><path d="M13 16h6M13 20h6" /></>,
  french: <><rect x="8" y="9" width="13" height="18" rx="2" /><path d="M14.5 9V3M11 3h7" /><path d="M8 15h13" /><path d="M21 12h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" /></>,
  clever: <><path d="M5 8h20l-4 13H9z" /><path d="M9 21v3h12v-3" /><path d="M25 10c3 0 3 5 0 5" /></>,
  espresso: <><path d="M8 12h14v6a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z" /><path d="M22 14h2a2.5 2.5 0 0 1 0 5h-2.5" /><path d="M5 27h21" /><path d="M13 5c-1 2 1 3 0 5M17 5c-1 2 1 3 0 5" /></>,
  moka: <><path d="M10 4h12l-2 10h-8z" /><path d="M12 14h8l2.5 13h-13z" /><path d="M22 6l4 1-1 6-4 1" /><path d="M16 2v2" /></>,
  cezve: <><path d="M7 11h12l-1.5 15h-9z" /><path d="M6 11l1-2h12l1 2" /><path d="M19 13l9-5" /></>,
  cupping: <><path d="M5 15h20a10 9 0 0 1-20 0z" /><path d="M10 27h10" /><path d="M23 8l6-4M21.5 9.5a2 2 0 1 0 2.8-2.8" /></>,
};

export function MethodIcon({ icon, size = 32 }: { icon: IconKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" {...P}>
      {METHOD_PATHS[icon]}
    </svg>
  );
}

type UiIcon = 'brew' | 'journal' | 'beans' | 'more' | 'back' | 'plus' | 'scan' | 'chevron' | 'play' | 'pause' | 'reset' | 'check' | 'star' | 'trash' | 'repeat' | 'edit' | 'camera' | 'image' | 'close';

const UI_PATHS: Record<UiIcon, React.ReactNode> = {
  brew: <><path d="M5 8h14l-5 7h-4z" /><path d="M9 19h6M12 15v4" /><path d="M10 3v2M14 3v2" /></>,
  journal: <><path d="M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z" /><path d="M5 18a2 2 0 0 1 2-2h12" /><path d="M9 7h6M9 10h4" /></>,
  beans: <><ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)" /><path d="M9 5c3 3 0 8 6 14" /></>,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 8v8M11 8v8M13.5 8v8M16 8v8" /></>,
  chevron: <path d="M9 5l7 7-7 7" />,
  play: <path d="M8 5l11 7-11 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  reset: <><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  trash: <><path d="M5 7h14M10 7V4h4v3" /><path d="M7 7l1 13h8l1-13" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M20 16l-5-5-8 8" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 22, filled = false }: { name: UiIcon; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth={1.8} fill={filled ? 'currentColor' : 'none'}>
      {UI_PATHS[name]}
    </svg>
  );
}
