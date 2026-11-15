/**
 * Codes that are clearly not from a coffee pack: a Wi‑Fi network, a business card, a payment, a receipt, a private
 * document or map link. A person may scan one by mistake or out of curiosity; it must not land in the pack, and its
 * link must not reach the server or the owner (a payment or shared-document link is private).
 *
 * Shared by the app (lookup.ts — nothing is saved or sent) and the worker (/lookup — an old app that still sends one
 * gets nothing, and the site is not queued for approval). Pure: no DOM, no worker types.
 */

/** Data codes recognised by their opening: what it is, for the message «Это …, а не код с пачки кофе» */
const DATA: [RegExp, string][] = [
  [/^WIFI:/i, 'код сети Wi‑Fi'],
  [/^(?:BEGIN:VCARD|MECARD:|BIZCARD:)/i, 'визитка'],
  [/^BEGIN:(?:VEVENT|VCALENDAR)/i, 'событие календаря'],
  [/^(?:tel|sms|smsto|mms):/i, 'номер телефона'],
  [/^(?:mailto:|MATMSG:)/i, 'адрес почты'],
  [/^geo:/i, 'место на карте'],
  [/^otpauth(?:-migration)?:/i, 'ключ двухфакторной защиты'],
  // ГОСТ Р 56042 (bank transfers, utility bills) and the European EPC transfer
  [/^ST0001[12]\|/, 'платёжный QR-код'],
  [/^BCD\r?\n/, 'платёжный QR-код'],
  [/^(?:bitcoin|ethereum|litecoin|ton|lightning|monero):/i, 'адрес криптокошелька'],
  // a cash-register receipt: t=20261115T1803&s=…&fn=…&i=…&fp=…&n=1
  [/^t=\d{8}T\d{4,6}&s=/i, 'QR-код с чека'],
  [/^(?:whatsapp|tg|viber|skype|zoommtg|intent|market|itms-apps|fb|instagram):/i, 'ссылка на приложение'],
];

/** Sites that are never a roaster's shop and whose links are often private */
const HOSTS: [RegExp, string][] = [
  [/(?:^|\.)(?:nspk\.ru|sbp\.ru|yoomoney\.ru|qiwi\.com|paypal\.com|paypal\.me|revolut\.me|pay\.google\.com|sberbank\.ru|sber\.ru|tinkoff\.ru|tbank\.ru|alfabank\.ru|vtb\.ru|raiffeisen\.ru|gazprombank\.ru|pochtabank\.ru|sovcombank\.ru|ozon\.bank)$/i, 'ссылка на оплату или банк'],
  [/(?:^|\.)(?:gosuslugi\.ru|nalog\.ru|nalog\.gov\.ru|mos\.ru)$/i, 'ссылка на госуслуги'],
  [/^(?:docs|drive|forms|sheets|slides)\.google\.com$|(?:^|\.)(?:forms\.gle|disk\.yandex\.ru|disk\.yandex\.com|docs\.yandex\.ru|dropbox\.com|onedrive\.live\.com|1drv\.ms|notion\.so|notion\.site|cloud\.mail\.ru|icloud\.com)$/i, 'ссылка на документ или файл'],
  [/^maps\.google\.[a-z.]+$|^maps\.app\.goo\.gl$|(?:^|\.)(?:2gis\.ru|2gis\.com|maps\.apple\.com)$/i, 'ссылка на карту'],
  [/(?:^|\.)(?:zoom\.us|telemost\.yandex\.ru|meet\.google\.com|teams\.microsoft\.com)$/i, 'ссылка на видеовстречу'],
  [/^(?:apps\.apple\.com|play\.google\.com|apps\.rustore\.ru|appgallery\.huawei\.com)$/i, 'ссылка на приложение'],
];

/** Yandex keeps maps under the main domain: yandex.ru/maps/… */
const MAP_PATH = /^(?:www\.)?yandex\.(?:ru|com|by|kz)$/i;

/** What the code is, when it is clearly not from a coffee pack; null otherwise */
export function foreignCode(raw: string): string | null {
  const code = raw.trim();
  for (const [re, what] of DATA) if (re.test(code)) return what;
  if (!/^https?:\/\//i.test(code)) return null;
  let u: URL;
  try { u = new URL(code); } catch { return null; }
  const host = u.hostname;
  if (MAP_PATH.test(host) && /^\/maps\b/.test(u.pathname)) return 'ссылка на карту';
  if (/^(?:www\.)?google\.[a-z.]+$/i.test(host) && /^\/maps\b/.test(u.pathname)) return 'ссылка на карту';
  if (/^goo\.gl$/i.test(host) && /^\/maps\b/.test(u.pathname)) return 'ссылка на карту';
  for (const [re, what] of HOSTS) if (re.test(host)) return what;
  return null;
}

const SOCIAL = /^(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am|t\.me|telegram\.me|telegram\.dog|vk\.com|vk\.ru|vk\.cc|ok\.ru|facebook\.com|fb\.com|fb\.me|youtube\.com|youtu\.be|tiktok\.com|x\.com|twitter\.com|wa\.me|whatsapp\.com|linktr\.ee|taplink\.cc|taplink\.ws|dzen\.ru|pinterest\.com|threads\.net)$/i;
/** A link to a roaster's social page: the same on every pack, no lot data in it */
export function isSocialLink(url: string): boolean {
  try { return SOCIAL.test(new URL(url).hostname); } catch { return false; }
}

/** A link shown to the owner: the site and the page, without the query and fragment (they may carry tokens) */
export function bareUrl(url: string): string {
  try { const u = new URL(url); return u.origin + u.pathname; } catch { return ''; }
}
