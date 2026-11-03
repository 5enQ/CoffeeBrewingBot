"""Picture backgrounds: rare lots (Japan, eugenioides, liberica) after one brew, the lighthouse from the owner."""
import asyncio
from common import async_playwright, check, done, page

def db(theme, rare=(), grants=()):
    return {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [],
            'profile': {'name': 'Аня Кофеман', 'about': 'Пуроверы по утрам', 'telegram': 'anya', 'badges': [], 'shareTelegram': True, 'shareBadges': True, 'cardTheme': theme,
                        'serverStats': {'methods': {}, 'liters': 1, 'ratings': 0, 'rare': list(rare), 'at': 1, 'account': 'acc', 'grants': list(grants)}}}

CASES = [('japan', 'rare:japan', ['japan'], [], 'Ферма у горы'),
         ('eugenioides', 'rare:eugenioides', ['eugenioides'], [], 'Озеро Киву'),
         ('liberica', 'rare:liberica', ['liberica'], [], 'Закат в Либерии'),
         ('lighthouse', 'special:lighthouse', [], ['lighthouse'], 'Хранитель маяка')]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scene, theme, rare, grants, title in CASES:
            pg, errors = await page(b, db=db(theme, rare, grants), phone=True)
            await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(800)
            card = pg.locator(f'.pcard.scene-{scene}:visible').first
            check(await card.count() == 1, f'{scene}: the card shows the picture')
            check(await card.locator('.pcard-scene svg').count() == 1, f'{scene}: the scene is drawn')
            check(title.lower() in (await card.inner_text()).lower(), f'{scene}: the card names it «{title}»')
            if scene == 'lighthouse':
                t = await card.locator('.pcard-scene').evaluate("e => e.style.getPropertyValue('--lh-t')")
                check(t.startswith('-'), f'lighthouse: the CSS clock is set to the turn ({t})')
                crests = await card.locator('.pcard-scene rect[style*="bg-lh-crest"]').count()
                check(crests > 100, f'lighthouse: the light runs over the waves ({crests} crests)')
            # ids are unique per card, so a second copy on the page cannot steal the gradients
            dup = await pg.evaluate("() => { const ids = [...document.querySelectorAll('.pcard-scene [id]')].map((e) => e.id); return ids.length - new Set(ids).size; }")
            check(dup == 0, f'{scene}: no repeated ids ({dup})')
            await pg.wait_for_timeout(1200)
            await card.screenshot(path=f'out/scene-{scene}.png')
            check(not errors, f'{scene}: no page errors {errors}')
            await pg.close()
        # not brewed and not given: the picture falls back to paper
        for theme in ('rare:japan', 'special:lighthouse'):
            pg, errors = await page(b, db=db(theme), phone=True)
            await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(800)
            check(await pg.locator('.pcard.scene:visible').count() == 0, f'{theme} without the brew or the grant is not shown')
            await pg.close()
        await b.close()
    done()

asyncio.run(main())
