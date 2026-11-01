import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeHoliday, bannerHidden, fireworksDue, fireworksShown, hideBanner, holidayOn, setPreview } from '../../src/data/holidays';

const d = (m: number, day: number, y = 2026, h = 12) => new Date(y, m - 1, day, h);

describe('holiday windows: a couple of days before and after', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  it('Halloween 29 Oct – 2 Nov, Coffee Day 29 Sep – 3 Oct, New Year 30 Dec – 3 Jan', () => {
    expect(holidayOn(d(10, 28))).toBeNull();
    expect(holidayOn(d(10, 29))).toBe('halloween');
    expect(holidayOn(d(11, 2))).toBe('halloween');
    expect(holidayOn(d(11, 3))).toBeNull();
    expect(holidayOn(d(9, 29))).toBe('coffeeday');
    expect(holidayOn(d(10, 3))).toBe('coffeeday');
    expect(holidayOn(d(12, 30))).toBe('newyear');
    expect(holidayOn(d(1, 3, 2027))).toBe('newyear');
    expect(holidayOn(d(1, 4, 2027))).toBeNull();
    expect(holidayOn(d(6, 15))).toBeNull();
  });
  it('fireworks: the first start on or after 1 January in the window, once', () => {
    expect(fireworksDue(d(12, 31, 2026, 23))).toBe(false);   // not yet: before midnight
    expect(fireworksDue(d(1, 1, 2027, 0))).toBe(true);
    fireworksShown(d(1, 1, 2027, 0));
    expect(fireworksDue(d(1, 2, 2027))).toBe(false);          // already seen this year
    expect(fireworksDue(d(1, 5, 2027))).toBe(false);          // the window is over
  });
  it('a preview shows a holiday any day; «off» hides them', () => {
    setPreview('coffeeday');
    expect(activeHoliday(d(6, 15))).toBe('coffeeday');
    setPreview('off');
    expect(activeHoliday(d(10, 31))).toBeNull();
    setPreview('auto');
    expect(activeHoliday(d(10, 31))).toBe('halloween');
  });
  it('a closed greeting stays closed for this holiday this year, and comes back next year', () => {
    expect(bannerHidden('newyear', d(12, 31, 2026))).toBe(false);
    hideBanner('newyear', d(12, 31, 2026));
    expect(bannerHidden('newyear', d(1, 2, 2027))).toBe(true);    // the same New Year window
    expect(bannerHidden('newyear', d(12, 31, 2027))).toBe(false); // the next one
    expect(bannerHidden('halloween', d(10, 31, 2026))).toBe(false);
  });
});
