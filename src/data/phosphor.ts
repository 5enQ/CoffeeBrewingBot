/**
 * «Фосфор» — a secret style: the whole app as an old green-phosphor monitor.
 *
 * It is opened by the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) typed on the profile tab with a keyboard, and from then on
 * it is a profile card background like any other. Choosing that card turns the style on for the whole app; choosing
 * another card turns it off. A shared card with this background shows the friend's profile in the same style.
 *
 * Nothing about it is checked by the server: it is an easter egg, not an achievement.
 */
import { PACKS, plural } from './plural';
import type { Profile } from './store';
import { tr } from '../i18n';

export const PHOSPHOR = 'phosphor';

/** e.code of each step: codes, not letters, so B and A work in the Russian layout (И, Ф) and with Caps Lock */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

/**
 * How far into the code the keys have come: the next position after this key (KONAMI.length — done).
 * A wrong key starts over, but counts as the first step if it is one (↑ ↑ ↑ ↓ … still works).
 */
export function konamiStep(at: number, code: string): number {
  if (KONAMI[at] === code) return at + 1;
  // ↑ ↑ ↑: the extra ↑ keeps the last two as the start
  if (code === 'ArrowUp') return at === 2 ? 2 : 1;
  return 0;
}
export const KONAMI_LENGTH = KONAMI.length;

export const hasPhosphor = (p: Pick<Profile, 'secrets'>) => (p.secrets ?? []).includes(PHOSPHOR);
/** the style is on: the card is chosen (and it was opened on some device of this person) */
export const phosphorOn = (p: Pick<Profile, 'secrets' | 'cardTheme'>) => p.cardTheme === PHOSPHOR && hasPhosphor(p);

/** What the old computer reports while it starts: the person's own setup and shelf, as a BIOS would list drives */
export function bootLines(o: { version: string; grinder?: string; brewer?: string; packs: number; grams: number; brews: number }): [string, string][] {
  return [
    [`BREWBOOK BIOS v${o.version}`, '(c) 2026'],
    [tr('Проверка памяти'), '640K OK'],
    [tr('Кофемолка'), o.grinder || tr('не найдена')],
    [tr('Воронка'), o.brewer || tr('не найдена')],
    [tr('Зерно на полке'), o.packs ? tr('{0} {1} · {2} г', o.packs, plural(o.packs, PACKS), o.grams) : tr('пусто')],
    [tr('Заварок в дневнике'), String(o.brews)],
    [tr('Загрузка'), 'BREWBOOK.EXE'],
  ];
}
