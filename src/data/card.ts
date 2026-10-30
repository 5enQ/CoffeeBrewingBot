/**
 * Profile card: a small shareable card with avatar, name, optional Telegram link, badges, setup and a theme.
 *
 * The card names achievements by key ('method:v60', 'liters') and never says which level they are:
 * levels come from the numbers — on a shared card the server fills them in from its own count,
 * so a background or an achievement badge cannot be faked by editing the card.
 */
import { RATINGS_API } from '../config';
import { platform } from '../platform';
import { achievementBadge } from './achievements';
import { sortBadges, type BadgeLite } from './badges';
import { catById, GEAR_CATS, type Gear, type GearCat } from './gear';
import { earnedLevels, givesBackground, TIER_ORDER, type Level, type Stats, type Tier } from './levels';
import { methodById } from './methods';
import type { Profile } from './store';

export const BASE_THEMES = [
  { id: 'paper', label: 'Фильтр' },
  { id: 'latte', label: 'Латте' },
  { id: 'espresso', label: 'Эспрессо' },
  { id: 'matcha', label: 'Матча' },
  { id: 'berry', label: 'Ягоды' },
  { id: 'ocean', label: 'Океан' },
  { id: 'graphite', label: 'Графит' },
] as const;
export type BaseTheme = typeof BASE_THEMES[number]['id'];

/** Backgrounds the owner gives by hand (Profile → owner tools); the server checks them on every shared card */
export const SPECIAL_THEMES = [{ id: 'dev', label: 'Разработчик', title: 'Команда Brewbook' }] as const;
export type SpecialTheme = typeof SPECIAL_THEMES[number]['id'];

export interface CardData {
  v: 2;
  name: string;
  username?: string;
  about?: string;
  photo?: string;
  /** the user's own badges (certificates, championships) */
  badges: BadgeLite[];
  /** featured achievements by key, up to 3 together with badges */
  ach: string[];
  setup: { cat: GearCat; name: string }[];
  /** a base color, the achievement whose metal background is shown, or a special background */
  theme: { base: BaseTheme } | { ach: string } | { special: SpecialTheme };
  /** levels of the achievements above (filled in by the server on a shared card) */
  earned?: Record<string, Level>;
  /** diamond only: the holder's place among everyone who reached 1000 liters (given by the server) */
  no?: number;
  /** special backgrounds confirmed for this person (filled in by the server on a shared card) */
  granted?: string[];
}

/** What is painted: a base color, a metal tier with the achievement's icon, or a special background */
export type CardTheme = { base: BaseTheme } | { tier: Tier; icon: string; title: string } | { special: SpecialTheme; title: string };

export const MAX_SETUP = 6;

/** Icon of an achievement: the method's icon, a drop for liters, a star for ratings */
export const achievementIcon = (key: string) => (key.startsWith('method:') ? methodById(key.slice(7)).icon : key === 'ratings' ? 'star' : 'drop');

export interface UnlockedTheme { key: string; ach: string; tier: Tier; icon: string; label: string }

/** Metal backgrounds the numbers allow, best tier first. key 'ach:<achievement key>' is stored in the profile. */
export function unlockedThemes(stats: Stats): UnlockedTheme[] {
  return Object.entries(earnedLevels(stats))
    .filter(([k, l]) => givesBackground(k, l.tier))
    .map(([k, l]) => ({ key: `ach:${k}`, ach: k, tier: l.tier, icon: achievementIcon(k), label: achievementBadge(k, l.tier, l.at).title }))
    .sort((x, y) => TIER_ORDER.indexOf(y.tier) - TIER_ORDER.indexOf(x.tier));
}

/** The card as it looks: theme and the full list of badges */
export function cardView(c: CardData): { theme: CardTheme; badges: BadgeLite[] } {
  const earned = c.earned ?? {};
  let theme: CardTheme = { base: 'paper' };
  if ('base' in c.theme) theme = { base: c.theme.base };
  else if ('special' in c.theme) {
    const sp = SPECIAL_THEMES.find((x) => x.id === (c.theme as { special: string }).special);
    if (sp && c.granted?.includes(sp.id)) theme = { special: sp.id, title: sp.title };
  } else {
    const l = earned[c.theme.ach];
    if (l && givesBackground(c.theme.ach, l.tier)) theme = { tier: l.tier, icon: achievementIcon(c.theme.ach), title: achievementBadge(c.theme.ach, l.tier, l.at).title };
  }
  const ach = c.ach.filter((k) => earned[k]).map((k) => achievementBadge(k, earned[k].tier, earned[k].at));
  return { theme, badges: sortBadges([...ach, ...c.badges]).slice(0, 3) };
}

/** Gear shown on the card: the user's choice, otherwise one item per category (offered categories only) */
export function cardSetup(gear: Gear[], chosen?: string[]) {
  const offered = new Set(GEAR_CATS.map((c) => c.id));
  const own = gear.filter((g) => offered.has(g.cat));
  const list = chosen ? chosen.map((id) => own.find((g) => g.id === id)).filter(Boolean) as Gear[]
    : GEAR_CATS.map((c) => own.find((g) => g.cat === c.id)).filter(Boolean) as Gear[];
  return list.slice(0, MAX_SETUP).map((g) => ({ cat: g.cat, name: g.name }));
}

/** featured: showcase keys — 'ach:<key>' for achievements, an own badge id otherwise */
export function buildCard(p: Profile, featured: { key: string; badge: BadgeLite }[], gear: Gear[], stats: Stats, diamondNo?: number, grants: string[] = []): CardData {
  const tg = p.telegram.trim();
  const photo = platform.user()?.photo;
  const levels = earnedLevels(stats);
  const ach = featured.filter((f) => f.key.startsWith('ach:')).map((f) => f.key.slice(4)).filter((k) => levels[k]);
  const own = featured.filter((f) => !f.key.startsWith('ach:')).map((f) => { const { id: _id, ...b } = f.badge as BadgeLite & { id?: string }; return b; });
  const chosen = p.cardTheme?.startsWith('ach:') ? p.cardTheme.slice(4) : null;
  const special = p.cardTheme?.startsWith('special:') ? SPECIAL_THEMES.find((x) => `special:${x.id}` === p.cardTheme && grants.includes(x.id)) : undefined;
  const theme: CardData['theme'] = special ? { special: special.id }
    : chosen && levels[chosen] && givesBackground(chosen, levels[chosen].tier) ? { ach: chosen }
    : { base: (BASE_THEMES.find((t) => t.id === p.cardTheme)?.id ?? 'paper') as BaseTheme };
  const earned = Object.fromEntries([...ach, ...('ach' in theme ? [theme.ach] : [])].map((k) => [k, levels[k]]));
  return {
    v: 2,
    name: p.name.trim() || (tg ? '@' + tg : 'Без имени'),
    username: p.shareTelegram && tg ? tg : undefined,
    about: p.about.trim() || undefined,
    photo: photo && /^https:\/\//.test(photo) ? photo : undefined,
    badges: p.shareBadges ? own : [],
    ach: p.shareBadges ? ach : [],
    setup: cardSetup(gear, p.cardGear),
    theme,
    earned,
    no: 'ach' in theme && theme.ach === 'liters' ? diamondNo : undefined,
    granted: special ? [special.id] : [],
  };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const KEY = /^(method:[a-z0-9_-]{1,40}|liters|ratings)$/i;

/** A card from the network: known fields of sane size only. Levels are trusted only when given (by the server). */
export function cleanCard(raw: unknown): CardData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 60);
  if (!name) return null;
  const t = (r.theme ?? {}) as Record<string, unknown>;
  const theme: CardData['theme'] = typeof t.ach === 'string' && KEY.test(t.ach) ? { ach: t.ach }
    : SPECIAL_THEMES.some((x) => x.id === t.special) ? { special: t.special as SpecialTheme }
    : { base: (BASE_THEMES.find((x) => x.id === t.base)?.id ?? 'paper') as BaseTheme };
  const badges = Array.isArray(r.badges) ? r.badges.slice(0, 3).map((b: Record<string, unknown>) => ({
    kind: str(b?.kind, 20) as BadgeLite['kind'], title: str(b?.title, 80), detail: str(b?.detail, 60), year: str(b?.year, 10),
  })).filter((b) => b.title && b.kind !== 'achieve') : [];
  const ach = Array.isArray(r.ach) ? r.ach.filter((k): k is string => typeof k === 'string' && KEY.test(k)).slice(0, 3) : [];
  const earned: Record<string, Level> = {};
  if (r.earned && typeof r.earned === 'object') {
    for (const [k, v] of Object.entries(r.earned as Record<string, { tier?: string; at?: number }>)) {
      if (KEY.test(k) && TIER_ORDER.includes(v?.tier as Tier) && Number.isFinite(v?.at)) earned[k] = { tier: v.tier as Tier, at: Number(v.at) };
    }
  }
  const setup = Array.isArray(r.setup) ? r.setup.slice(0, MAX_SETUP).map((g: Record<string, unknown>) => ({ cat: catById(g?.cat as GearCat).id, name: str(g?.name, 60) })).filter((g) => g.name) : [];
  const username = str(r.username, 32).replace(/[^A-Za-z0-9_]/g, '');
  const photo = str(r.photo, 300);
  const no = Number(r.no);
  return {
    v: 2, name, username: username || undefined, about: str(r.about, 200) || undefined, photo: /^https:\/\//.test(photo) ? photo : undefined,
    badges, ach, setup, theme, earned, no: Number.isInteger(no) && no > 0 ? no : undefined,
    granted: Array.isArray(r.granted) ? r.granted.filter((g): g is string => SPECIAL_THEMES.some((x) => x.id === g)) : [],
  };
}

/* ---------- sharing ---------- */

/** Store the card on the server: one card per account, the link stays the same. null — failed (needs Telegram). */
export async function storeCard(card: CardData): Promise<string | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  const { earned: _e, no: _n, granted: _g, ...body } = card; // the server decides these
  void _e; void _n; void _g;
  try {
    const r = await fetch(`${RATINGS_API}/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, card: body }) });
    if (!r.ok) return null;
    const { id } = await r.json();
    return typeof id === 'string' ? id : null;
  } catch { return null; }
}

export async function loadCard(id: string): Promise<CardData | null> {
  if (!RATINGS_API) return null;
  try {
    const r = await fetch(`${RATINGS_API}/cards/${encodeURIComponent(id)}`);
    return r.ok ? cleanCard((await r.json()).card) : null;
  } catch { return null; }
}

/** Text that goes to the chat with the link */
export function cardText(c: CardData) {
  const v = cardView(c);
  const lines = [`☕ ${c.name}${c.username ? ` (@${c.username})` : ''} — профиль в Brewbook`];
  if (c.about) lines.push(c.about);
  if ('tier' in v.theme) lines.push(`🏅 ${v.theme.title}`);
  if ('special' in v.theme) lines.push(`⌘ ${v.theme.title}`);
  if (v.badges.length) lines.push(v.badges.map((b) => b.title).join(' · '));
  if (c.setup.length) lines.push('', 'Сетап:', ...c.setup.map((g) => `• ${g.name}`));
  return lines.join('\n');
}
