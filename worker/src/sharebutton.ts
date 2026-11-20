/**
 * The button under a shared message: what the link opens. A profile card link (startapp=p…) opens a profile,
 * everything else shared from the app is a recipe.
 */
import { say, type Lang } from './lang.ts';

export function shareButton(link: string, lang: Lang = 'ru'): string {
  let start = '';
  try { start = new URL(link).searchParams.get('startapp') ?? ''; } catch { /* not a URL */ }
  return start.startsWith('p') ? say(lang, '👤 Открыть профиль', '👤 Open the profile') : say(lang, '☕ Открыть рецепт', '☕ Open the recipe');
}
