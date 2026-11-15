import { describe, expect, it } from 'vitest';
import { shareButton } from '../../worker/src/sharebutton';

describe('the button under a shared message', () => {
  it('a profile card opens a profile', () => {
    expect(shareButton('https://t.me/brewbook_bot/app?startapp=pabcDEF2345')).toBe('👤 Открыть профиль');
  });
  it('a recipe (short or full code) and anything else open a recipe', () => {
    expect(shareButton('https://t.me/brewbook_bot/app?startapp=sXy12')).toBe('☕ Открыть рецепт');
    expect(shareButton('https://t.me/brewbook_bot/app?startapp=rzAbC_12')).toBe('☕ Открыть рецепт');
    expect(shareButton('not a link')).toBe('☕ Открыть рецепт');
  });
});
