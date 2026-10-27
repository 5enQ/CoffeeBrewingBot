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
  siphon: <><path d="M11 3h10v7l-3 3h-4l-3-3z" /><path d="M16 13v3" /><circle cx="16" cy="22" r="6" /><path d="M11 30h10" /><path d="M10 3h12" /></>,
  coldbrew: <><path d="M9 8h14v18a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" /><path d="M8 4h16v4H8z" /><rect x="12" y="13" width="4" height="4" rx="1" /><rect x="16.5" y="18" width="4" height="4" rx="1" /></>,
  batch: <><path d="M7 4h18v6H7z" /><path d="M9 10l2 5h10l2-5" /><path d="M16 15v2" /><path d="M11 18h10v8a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z" /><path d="M21 20h1.5a2 2 0 0 1 0 4H21" /><path d="M7 4v24h3" /></>,
  dripbag: <><path d="M9 5h14v11l-7 5-7-5z" /><path d="M9 8L5 11M23 8l4 3" /><path d="M12 10h8" /><path d="M7 22h18v2a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5z" /></>,
  cup: <><path d="M7 11h16v7a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" /><path d="M23 13h2a3 3 0 0 1 0 6h-2.5" /><path d="M6 28h19" /></>,
  kettle: <><path d="M8 14h15l-1.5 13h-12z" /><path d="M10 14a5.5 4 0 0 1 11 0" /><path d="M15.5 8.5v1.5" /><path d="M8 17l-5-5" /><path d="M23 16h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2.5" /></>,
  drop: <><path d="M16 4c5 6.5 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8.5 8-15z" /><path d="M12 20a4 4 0 0 0 4 4" /></>,
  bean: <><ellipse cx="16" cy="16" rx="8" ry="11" transform="rotate(30 16 16)" /><path d="M12 7c4 4 0 10 8 18" /></>,
  cupping: <><path d="M5 15h20a10 9 0 0 1-20 0z" /><path d="M10 27h10" /><path d="M23 8l6-4M21.5 9.5a2 2 0 1 0 2.8-2.8" /></>,
};

export function MethodIcon({ icon, size = 32 }: { icon: IconKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" {...P}>
      {METHOD_PATHS[icon]}
    </svg>
  );
}

type UiIcon = 'brew' | 'journal' | 'beans' | 'more' | 'profile' | 'share' | 'gear' | 'medal' | 'copy' | 'back' | 'plus' | 'scan' | 'chevron' | 'play' | 'pause' | 'reset' | 'check' | 'star' | 'trash' | 'repeat' | 'edit' | 'camera' | 'image' | 'close' | 'lock' | 'pin' | 'undo';

const UI_PATHS: Record<UiIcon, React.ReactNode> = {
  brew: <><path d="M5 8h14l-5 7h-4z" /><path d="M9 19h6M12 15v4" /><path d="M10 3v2M14 3v2" /></>,
  journal: <><path d="M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z" /><path d="M5 18a2 2 0 0 1 2-2h12" /><path d="M9 7h6M9 10h4" /></>,
  beans: <><ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)" /><path d="M9 5c3 3 0 8 6 14" /></>,
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" /></>,
  gear: <><path d="M6 4h12l-1 5H7z" /><path d="M9 9v3h6V9" /><rect x="7" y="12" width="10" height="8" rx="1.5" /><path d="M12 15v2" /></>,
  medal: <><circle cx="12" cy="14.5" r="5.5" /><path d="M8.5 10 6 3h4l2 4 2-4h4l-2.5 7" /><path d="m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
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
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  pin: <><path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 16v5" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export function Icon({ name, size = 22, filled = false }: { name: UiIcon; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth={1.8} fill={filled ? 'currentColor' : 'none'}>
      {UI_PATHS[name]}
    </svg>
  );
}
