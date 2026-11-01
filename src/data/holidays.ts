/**
 * Holiday looks: a few days around a holiday the app dresses up.
 *  - halloween: 29 Oct – 2 Nov — cobwebs in the corners, a spider on a thread, pumpkins on the brew tab;
 *  - newyear:   30 Dec – 3 Jan — falling snow; the first start after midnight of 1 January brings fireworks (once);
 *  - coffeeday: 29 Sep – 3 Oct — International Coffee Day: a scene with the farmers who pick coffee and a barista who brews it.
 * Dates are local. The owner and testers can preview any look (Profile → panel) — kept on the device only.
 */
export type Holiday = 'halloween' | 'newyear' | 'coffeeday';

export const HOLIDAYS: { id: Holiday; label: string }[] = [
  { id: 'halloween', label: 'Хеллоуин' },
  { id: 'newyear', label: 'Новый год' },
  { id: 'coffeeday', label: 'День кофе' },
];

const PREVIEW = 'brewbook.holiday.preview';
const FIREWORKS = 'brewbook.fireworks';
const HIDDEN = 'brewbook.holiday.hidden';

/** days are compared as month*100 + day; the New Year window wraps around the year */
const inWindow = (d: Date, from: [number, number], to: [number, number]) => {
  const v = (d.getMonth() + 1) * 100 + d.getDate(), a = from[0] * 100 + from[1], b = to[0] * 100 + to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};

export function holidayOn(d: Date): Holiday | null {
  if (inWindow(d, [10, 29], [11, 2])) return 'halloween';
  if (inWindow(d, [12, 30], [1, 3])) return 'newyear';
  if (inWindow(d, [9, 29], [10, 3])) return 'coffeeday';
  return null;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } };

/** 'auto' — by the date; 'off' — never; a holiday — always (preview) */
export type HolidayPreview = 'auto' | 'off' | Holiday;
export const getPreview = (): HolidayPreview => (read(PREVIEW) as HolidayPreview | null) ?? 'auto';
export function setPreview(v: HolidayPreview) { write(PREVIEW, v === 'auto' ? null : v); window.dispatchEvent(new Event('brewbook-holiday')); }

export function activeHoliday(now = new Date()): Holiday | null {
  const p = getPreview();
  if (p === 'off') return null;
  if (p !== 'auto') return p;
  return holidayOn(now);
}

/** the year a holiday window belongs to (the New Year window spans two calendar years) */
const seasonYear = (h: Holiday, d: Date) => (h === 'newyear' && d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear());

/** the fireworks: on the first start on or after 1 January inside the window, once per new year and device */
export function fireworksDue(now = new Date()): boolean {
  if (activeHoliday(now) !== 'newyear') return false;
  if (getPreview() === 'newyear') return false; // previews show them on request only
  if (now.getMonth() !== 0) return false;        // before midnight there are no fireworks yet
  return read(FIREWORKS) !== String(now.getFullYear());
}
export const fireworksShown = (now = new Date()) => write(FIREWORKS, String(now.getFullYear()));

/** the greeting on the brew tab can be closed for this holiday this year */
export const bannerHidden = (h: Holiday, now = new Date()) => read(HIDDEN) === `${h}:${seasonYear(h, now)}`;
export const hideBanner = (h: Holiday, now = new Date()) => { write(HIDDEN, `${h}:${seasonYear(h, now)}`); window.dispatchEvent(new Event('brewbook-holiday')); };
