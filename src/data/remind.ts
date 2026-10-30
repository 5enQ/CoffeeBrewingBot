/**
 * Bot reminders: the server sends a Telegram message from the bot when a long timer ends,
 * even if the app is closed. One active reminder per account; a new one replaces it.
 */
import { RATINGS_API, TELEGRAM_APP, TELEGRAM_BOT } from '../config';
import { platform } from '../platform';

export const remindersAvailable = () => !!RATINGS_API && !!TELEGRAM_BOT && !!platform.initData();
/** the button in the bot's message opens the timer ("timer" launch parameter) */
const timerLink = () => `https://t.me/${TELEGRAM_BOT}${TELEGRAM_APP ? `/${TELEGRAM_APP}` : ''}?startapp=timer`;

async function call(body: Record<string, unknown>): Promise<boolean> {
  const initData = platform.initData();
  if (!RATINGS_API || !initData) return false;
  try {
    const r = await fetch(`${RATINGS_API}/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, ...body }) });
    return r.ok && !!(await r.json())?.ok;
  } catch { return false; }
}

let asked: boolean | null = null;
/** ask once per session whether the bot may write (Telegram shows its own dialog only if it has to) */
async function writeAccess(): Promise<boolean> {
  if (asked !== null) return asked;
  asked = platform.requestWriteAccess ? await platform.requestWriteAccess() : false;
  return asked;
}

/** schedule "your brew is ready" at epoch ms `at` */
export async function scheduleReminder(at: number, title: string): Promise<boolean> {
  if (!remindersAvailable() || !(await writeAccess())) return false;
  return call({ at, title, link: timerLink() });
}

export const cancelReminder = () => (remindersAvailable() ? call({ cancel: true }) : Promise.resolve(false));
