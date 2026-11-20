/**
 * The language of what the bot writes to a person: the app sends its own (ru or en) with the request.
 * Anything else, or an older app that sends nothing — Russian, as before.
 */
export type Lang = 'ru' | 'en';
export const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'ru');
/** pick the line for the language */
export const say = (lang: Lang, ru: string, en: string) => (lang === 'en' ? en : ru);
