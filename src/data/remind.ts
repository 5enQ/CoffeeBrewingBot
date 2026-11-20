/**
 * Bot reminders: the server sends a Telegram message from the bot when a long timer ends,
 * even if the app is closed. One active reminder per account; a new one replaces it.
 */
import { RATINGS_API, TELEGRAM_APP, TELEGRAM_BOT } from '../config';
import { platform } from '../platform';
import { getAppearance } from '../appearance';
import { getLocale, tr } from '../i18n';

export const remindersAvailable = () => !!RATINGS_API && !!TELEGRAM_BOT && !!platform.initData();
/** the button in the bot's message opens the timer ("timer" launch parameter) */
const timerLink = () => `https://t.me/${TELEGRAM_BOT}${TELEGRAM_APP ? `/${TELEGRAM_APP}` : ''}?startapp=timer`;

async function call(body: Record<string, unknown>): Promise<boolean> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return false;
  try {
    const r = await fetch(`${RATINGS_API}/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, lang: getLocale(), ...body }) });
    return r.ok && !!(await r.json())?.ok;
  } catch { return false; }
}

let asked: boolean | null = null;
/**
 * Ask once per session whether the bot may write (Telegram shows its own dialog only if it has to).
 * Some clients never answer when access was given before: after 8 s we go on — the server reports
 * a refusal from Telegram anyway (see reminderStatus).
 */
async function writeAccess(): Promise<boolean> {
  if (asked !== null) return asked;
  if (!platform.requestWriteAccess) return (asked = false);
  const answer = await Promise.race([platform.requestWriteAccess(), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
  asked = answer !== false; // null (no answer) — try anyway
  return asked;
}

export interface ReminderStatus {
  pending: { at: number; title: string } | null;
  last: { at: number; state: 'scheduled' | 'cancelled' | 'sent' | 'failed'; detail: string | null; ts: number } | null;
}

/** what the server holds: the pending reminder and what happened to the last one */
export async function reminderStatus(): Promise<ReminderStatus | null> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return null;
  try {
    const r = await fetch(`${RATINGS_API}/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, status: true }) });
    return r.ok ? await r.json() as ReminderStatus : null;
  } catch { return null; }
}

/** a test message from the bot right now; error — Telegram's answer ("bot was blocked by the user"…) */
export async function testReminder(): Promise<{ ok: boolean; error?: string }> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return { ok: false, error: tr('Работает только в Telegram') };
  await writeAccess();
  try {
    const r = await fetch(`${RATINGS_API}/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, lang: getLocale(), test: true, link: timerLink() }) });
    return r.ok ? await r.json() : { ok: false, error: tr('сервер ответил {0}', r.status) };
  } catch { return { ok: false, error: tr('нет связи с сервером') }; }
}

/** a Telegram refusal in words a person understands */
export function explainRefusal(detail?: string | null): string {
  const d = (detail ?? '').toLowerCase();
  if (d.includes('blocked')) return tr('бот заблокирован — разблокируйте его в чате с ботом');
  if (d.includes("can't initiate") || d.includes('chat not found') || d.includes('forbidden')) return tr('бот ещё не может вам писать — откройте чат с ботом и нажмите «Старт»');
  return detail || tr('Telegram не принял сообщение');
}

/**
 * The cold brew card in the chat with the bot (worker/src/widget.ts): which brew, when it started, the recipe line
 * and the bean it shows; null — the person turned the card off (the server removes one already sent).
 */
export interface ChatCard { brew: string; start: number; recipe: string; bean: string; look: CardLook }
/** the card's look follows the app's: its theme (auto — Telegram's own colors) or «Фосфор» */
export type CardLook = 'auto' | 'light' | 'dark' | 'phosphor';
export const cardLook = (): CardLook => (getAppearance().style === 'phosphor' ? 'phosphor' : getAppearance().theme);
/** the look changed while a cold brew card is out: the bot repaints it */
export const sendCardLook = (look: CardLook) => (remindersAvailable() ? call({ look }) : Promise.resolve(false));

/** schedule "your brew is ready" at epoch ms `at`; `card` — with the cold brew card (undefined: not a cold brew) */
export async function scheduleReminder(at: number, title: string, card?: ChatCard | null): Promise<boolean> {
  if (!remindersAvailable() || !(await writeAccess())) return false;
  return call({ at, title, link: timerLink(), ...(card !== undefined ? { card } : {}) });
}

/** why: the card in the chat says «на паузе», «в дневнике» or «сброшен» */
export const cancelReminder = (why: 'pause' | 'finish' | 'stop' = 'stop') => (remindersAvailable() ? call({ cancel: why }) : Promise.resolve(false));
