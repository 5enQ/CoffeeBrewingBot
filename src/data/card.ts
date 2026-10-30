/**
 * Profile card: a small shareable card with avatar, name, optional Telegram link, featured badges, setup and a theme.
 * Base themes are always available. Metal themes (bronze, silver, gold, diamond) unlock with achievements of that tier
 * and carry the achievement's icon in the corner (the method icon for "N brews with a method").
 */
import { RATINGS_API } from '../config';
import { platform } from '../platform';
import { earnedAchievements, type Achievement, type Tier } from './achievements';
import type { BadgeLite } from './badges';
import { catById, GEAR_CATS, type Gear, type GearCat } from './gear';
import { methodById } from './methods';
import type { Brew, Profile } from './store';

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

/** What the card is painted with. Metal themes keep the icon so a friend sees the same card. */
export type CardTheme = { base: BaseTheme } | { tier: Tier; icon: string; title: string };

export interface CardData {
  v: 1;
  name: string;
  username?: string;
  about?: string;
  photo?: string;
  badges: BadgeLite[];
  setup: { cat: GearCat; name: string }[];
  theme: CardTheme;
}

export const MAX_SETUP = 6;
const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'diamond'];

/** Icon for an achievement: the method's icon, a drop for liters, a star for ratings */
function achievementIcon(a: Achievement) {
  if (a.id.startsWith('method:')) return methodById(a.id.slice(7)).icon;
  return a.id === 'ratings' ? 'star' : 'drop';
}

export interface UnlockedTheme { key: string; theme: CardTheme; label: string }

/** Metal themes the user has earned, best tier first. Key 'ach:<achievement id>' is stored in the profile. */
export function unlockedThemes(brews: Brew[], ratingsCount: number): UnlockedTheme[] {
  return earnedAchievements(brews, ratingsCount)
    .map((a) => {
      const tier = a.unlock.split(':').pop() as Tier;
      return { key: `ach:${a.id}`, theme: { tier, icon: achievementIcon(a), title: a.badge.title } as CardTheme, label: a.badge.title };
    })
    .sort((x, y) => TIER_ORDER.indexOf((y.theme as { tier: Tier }).tier) - TIER_ORDER.indexOf((x.theme as { tier: Tier }).tier));
}

/** The theme chosen in the profile; a metal theme whose achievement is gone falls back to the default */
export function resolveTheme(key: string | undefined, unlocked: UnlockedTheme[]): CardTheme {
  if (key?.startsWith('ach:')) return unlocked.find((u) => u.key === key)?.theme ?? { base: 'paper' };
  return { base: (BASE_THEMES.find((t) => t.id === key)?.id ?? 'paper') as BaseTheme };
}

/** Gear shown on the card: the user's choice, otherwise one item per category (offered categories only) */
export function cardSetup(gear: Gear[], chosen?: string[]) {
  const offered = new Set(GEAR_CATS.map((c) => c.id));
  const own = gear.filter((g) => offered.has(g.cat));
  const list = chosen ? chosen.map((id) => own.find((g) => g.id === id)).filter(Boolean) as Gear[]
    : GEAR_CATS.map((c) => own.find((g) => g.cat === c.id)).filter(Boolean) as Gear[];
  return list.slice(0, MAX_SETUP).map((g) => ({ cat: g.cat, name: g.name }));
}

export function buildCard(p: Profile, badges: BadgeLite[], gear: Gear[], theme: CardTheme): CardData {
  const tg = p.telegram.trim();
  const photo = platform.user()?.photo;
  return {
    v: 1,
    name: p.name.trim() || (tg ? '@' + tg : 'Без имени'),
    username: p.shareTelegram && tg ? tg : undefined,
    about: p.about.trim() || undefined,
    photo: photo && /^https:\/\//.test(photo) ? photo : undefined,
    badges: badges.slice(0, 3),
    setup: cardSetup(gear, p.cardGear),
    theme,
  };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A card that came from the network: keep only known fields of sane size */
export function cleanCard(raw: unknown): CardData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const t = (r.theme ?? {}) as Record<string, unknown>;
  const theme: CardTheme = TIER_ORDER.includes(t.tier as Tier)
    ? { tier: t.tier as Tier, icon: str(t.icon, 20) || 'drop', title: str(t.title, 80) }
    : { base: (BASE_THEMES.find((x) => x.id === t.base)?.id ?? 'paper') as BaseTheme };
  const badges = Array.isArray(r.badges) ? r.badges.slice(0, 3).map((b: Record<string, unknown>) => ({
    kind: str(b?.kind, 20) as BadgeLite['kind'], title: str(b?.title, 80), detail: str(b?.detail, 60), year: str(b?.year, 10),
  })).filter((b) => b.title) : [];
  const setup = Array.isArray(r.setup) ? r.setup.slice(0, MAX_SETUP).map((g: Record<string, unknown>) => ({ cat: catById(g?.cat as GearCat).id, name: str(g?.name, 60) })).filter((g) => g.name) : [];
  const name = str(r.name, 60);
  if (!name) return null;
  const username = str(r.username, 32).replace(/[^A-Za-z0-9_]/g, '');
  const photo = str(r.photo, 300);
  return { v: 1, name, username: username || undefined, about: str(r.about, 200) || undefined, photo: /^https:\/\//.test(photo) ? photo : undefined, badges, setup, theme };
}

/* ---------- sharing ---------- */

/** Store the card on the server: one card per user, the link stays the same. null — failed (needs Telegram). */
export async function storeCard(card: CardData): Promise<string | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  try {
    const r = await fetch(`${RATINGS_API}/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, card }) });
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
  const lines = [`☕ ${c.name}${c.username ? ` (@${c.username})` : ''} — профиль в Brewbook`];
  if (c.about) lines.push(c.about);
  if ('tier' in c.theme) lines.push(`🏅 ${c.theme.title}`);
  if (c.badges.length) lines.push(c.badges.map((b) => b.title).join(' · '));
  if (c.setup.length) lines.push('', 'Сетап:', ...c.setup.map((g) => `• ${g.name}`));
  return lines.join('\n');
}
