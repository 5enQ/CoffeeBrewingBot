"""Smoke test: every tab on phone and desktop, light and dark; method list and recipe screen rules."""
import asyncio
from common import OUT, async_playwright, check, done, page

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # phone, fresh install
        pg, errors = await page(b)
        V = lambda s: pg.locator(s + ':visible')
        names = await V('.method-card').all_inner_texts()
        joined = ' '.join(names)
        for n in ('Кемекс', 'Аэропресс', 'Клевер', 'V60'):
            check(n in joined, f'home lists {n}')
        for n in ('Kalita', 'Chemex', 'AeroPress', 'Clever'):
            check(n not in joined, f'home does not list {n}')
        check(await V('.tabbar button').all_inner_texts() == ['Заварить', 'Дневник', 'Полка', 'Профиль'], 'tab labels')

        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(300)
        check(await V('.recipe-tile .tag').count() == 0, 'the sample V60 brew does not mark a recipe as "last time"')
        await V('[aria-label="Назад"]').click(); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("Кемекс")').click(); await pg.wait_for_timeout(300)
        check(await V('.topbar h1').inner_text() == 'Кемекс', 'recipes screen title')
        check(await V('.method-hero').count() == 0, 'no method description card on the recipes screen')
        check(await V('.recipe-tile .tag:has-text("в прошлый раз")').count() == 0, 'no "last time" tag before the first brew')
        await pg.screenshot(path=str(OUT / 'recipes-fresh.png'), full_page=True)

        # brew once, then the tag appears
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        check(await V('button:has-text("Домой")').count() == 1, '"Home" button after a fresh brew')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(400)
        await V('.method-card:has-text("Кемекс")').click(); await pg.wait_for_timeout(300)
        check(await V('.recipe-tile:has-text("Стандартный") .tag:has-text("в прошлый раз")').count() == 1, '"last time" tag after a brew')

        await V('[aria-label="Назад"]').click(); await pg.wait_for_timeout(400)
        for tab in ('Дневник', 'Полка', 'Профиль'):
            await pg.click(f'.tabbar >> text={tab}'); await pg.wait_for_timeout(450)
            await pg.screenshot(path=str(OUT / f'phone-{tab}.png'))
        check(not errors, f'no page errors on phone: {errors[:3]}')

        # desktop + dark
        for dark in (False, True):
            pg, errors = await page(b, 1280, 800, dark=dark)
            for tab in ('Заварить', 'Дневник', 'Полка', 'Профиль'):
                await pg.locator(f'button:visible:has-text("{tab}")').first.click(); await pg.wait_for_timeout(400)
                await pg.screenshot(path=str(OUT / f'desk-{"dark" if dark else "light"}-{tab}.png'))
            width = await pg.evaluate('document.documentElement.scrollWidth')
            check(width <= 1280, f'no horizontal scroll on desktop ({"dark" if dark else "light"})')
            check(not errors, f'no page errors on desktop: {errors[:3]}')

        # an old Kalita brew still shows its method name
        old = {'v': 1, 'beans': [], 'gear': [], 'recipes': {}, 'seeded': True, 'gearSeeded': True,
               'profile': {'name': '', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True},
               'brews': [{'id': 'old1', 'date': 1790000000000, 'methodId': 'kalita', 'beanId': None, 'dose': 15, 'water': 250, 'temp': 93,
                          'grind': '', 'time': 180, 'rating': 4, 'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3},
                          'descriptors': [], 'notes': '', 'cupping': None}]}
        pg, errors = await page(b, db=old)
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(400)
        check('Kalita Wave' in await pg.locator('.tab-page:visible').inner_text(), 'old Kalita brew keeps its method name in the journal')
        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(400)
        check(await pg.locator('.method-card:visible:has-text("Kalita")').count() == 0, 'Kalita is not offered even with old brews')
        check(not errors, f'no page errors with old data: {errors[:3]}')
        await b.close()
    done()

asyncio.run(main())
