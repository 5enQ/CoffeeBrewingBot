/**
 * The button under a shared message: what the link opens. A profile card link (startapp=p…) opens a profile,
 * everything else shared from the app is a recipe.
 */
export function shareButton(link: string): string {
  let start = '';
  try { start = new URL(link).searchParams.get('startapp') ?? ''; } catch { /* not a URL */ }
  return start.startsWith('p') ? '👤 Открыть профиль' : '☕ Открыть рецепт';
}
