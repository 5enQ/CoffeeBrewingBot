import { HEALTH_CUPS } from './levels';
import type { Brew } from './store';

const KEY = 'brewbook.healthWarned';
const dayOf = (t: number) => new Date(t).toDateString();

/** own brews (no samples, cuppings or shared recipes) on the same local day as `at` */
export function cupsOn(brews: Brew[], at: number): number {
  const d = dayOf(at);
  return brews.filter((b) => !b.sample && !b.author && b.methodId !== 'cupping' && !b.cva && dayOf(b.date) === d).length;
}

/**
 * The health warning text when a newly saved brew takes the day past HEALTH_CUPS,
 * once per day; null otherwise.
 */
export function healthWarning(brews: Brew[], saved: Brew, now = Date.now()): string | null {
  if (saved.sample || saved.author || saved.methodId === 'cupping' || saved.cva) return null;
  if (dayOf(saved.date) !== dayOf(now)) return null;
  const others = brews.filter((b) => b.id !== saved.id);
  const n = cupsOn(others, now) + 1;
  if (n <= HEALTH_CUPS) return null;
  const today = dayOf(now);
  try { if (localStorage.getItem(KEY) === today) return null; localStorage.setItem(KEY, today); } catch { /* no storage */ }
  return `Сегодня уже ${n} заварок. Столько кофе за день — это много для здоровья: обычно советуют не больше 400 мг кофеина в сутки (примерно 3–5 чашек). Сделайте паузу и выпейте воды.`;
}
