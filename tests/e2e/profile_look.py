"""Profile and journal batch: big stat numbers, no score tile without cupping, finished packs keep their age,
folding Profile sections, theme choice and high contrast."""
import asyncio, time
from common import async_playwright, check, done, page

DAY = 86400000
NOW = int(time.time() * 1000)

def iso(days_ago):
    return time.strftime('%Y-%m-%d', time.localtime((NOW - days_ago * DAY) / 1000))

def bean(id, name, roast_days, **extra):
    return {'id': id, 'name': name, 'roaster': 'X', 'country': 'Кения', 'region': '', 'farm': '', 'producer': '', 'variety': '', 'process': 'Мытая',
            'altitude': '', 'harvest': '', 'roastLevel': 'Светлая', 'roastDate': iso(roast_days), 'weight': '250', 'barcode': '', 'link': '',
            'packNotes': '', 'comment': '', 'createdAt': 1, **extra}

BREW = {'id': 'b1', 'methodId': 'kalita', 'date': NOW - DAY, 'beanId': 'live', 'dose': 15, 'water': 250, 'temp': 93, 'grind': '', 'time': 180,
        'rating': 4, 'taste': {}, 'descriptors': [], 'notes': '', 'cupping': None}

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [BREW], 'gear': [],
      'profile': {'name': 'Т', 'about': '', 'telegram': '', 'badges': []},
      'beans': [bean('live', 'Живая пачка', 12),
                # finished 20 days after roast, 30 days ago: shows 20, not 50
                bean('gone', 'Допитая пачка', 50, finished=True, finishedAt=NOW - 30 * DAY)]}

async def font_px(loc):
    return float((await loc.evaluate('e => getComputedStyle(e).fontSize'))[:-2])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB, phone=True)
        V = lambda s: pg.locator(s + ':visible')

        # journal: two tiles without cupping, numbers large
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(500)
        tiles = V('.stats > div')
        check(await tiles.count() == 2, f'journal: no «лучший балл» tile without cupping ({await tiles.count()} tiles)')
        check('лучший балл' not in (await V('.stats').first.inner_text()), 'journal: the score label is gone too')
        n = await font_px(V('.stats b').first)
        check(n >= 20, f'journal: stat numbers are big ({n}px)')
        await pg.screenshot(path='out/look-journal.png')

        # profile: stat numbers large
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(600)
        n = await font_px(V('.stats b').first)
        check(n >= 20, f'profile: stat numbers are big ({n}px)')

        # order: recipes after the equipment; recipes and backup folded by default
        heads = await V('.section-head h2').all_inner_texts()
        gi = next((i for i, h in enumerate(heads) if h.lower().startswith('моё оборудование')), -1)
        ri = next((i for i, h in enumerate(heads) if h.lower().startswith('мои рецепты')), -1)
        check(-1 < gi < ri, f'profile: «Мои рецепты» comes after «Моё оборудование» ({heads})')
        for title in ('Мои рецепты', 'Резервная копия'):
            btn = V(f'.section-fold:has-text("{title}")').first
            check(await btn.get_attribute('aria-expanded') == 'false', f'{title}: folded at first')
            body = btn.locator('xpath=ancestor::section[1]').locator('.fold-body')
            h = (await body.bounding_box())['height']
            check(h < 2, f'{title}: folded body takes no room ({h:.0f}px)')
            await btn.click(); await pg.wait_for_timeout(450)
            h = (await body.bounding_box())['height']
            check(await btn.get_attribute('aria-expanded') == 'true' and h > 20, f'{title}: opens ({h:.0f}px)')
        check(await V('button:has-text("Сохранить в файл"), button:has-text("Скачать")').count() + await V('#backup-paste').count() > 0, 'backup: its controls show when open')

        # theme and contrast
        await V('.segmented button:has-text("Тёмная")').first.click(); await pg.wait_for_timeout(200)
        check(await pg.evaluate('document.documentElement.dataset.theme') == 'dark', 'theme: «Тёмная» makes the page dark in a light browser')
        bg = await pg.evaluate("getComputedStyle(document.body).backgroundColor")
        check(bg == 'rgb(15, 19, 17)', f'theme: the dark background is used ({bg})')
        await V('label[for="contrast"]').first.click(); await pg.wait_for_timeout(200)
        check(await pg.evaluate('document.documentElement.dataset.contrast') == 'high', 'contrast: switched on')
        fg = await pg.evaluate("getComputedStyle(document.body).color")
        check(fg == 'rgb(255, 255, 255)', f'contrast + dark: pure white text ({fg})')
        await pg.screenshot(path='out/look-contrast-dark.png', full_page=True)
        await V('.segmented button:has-text("Светлая")').first.click(); await pg.wait_for_timeout(200)
        fg = await pg.evaluate("getComputedStyle(document.body).color")
        check(fg == 'rgb(0, 0, 0)', f'contrast + light: pure black text ({fg})')

        # all of it survives a reload; folds remember their state
        await pg.reload(); await pg.wait_for_timeout(700)
        check(await pg.evaluate('document.documentElement.dataset.theme') == 'light', 'theme: remembered after reload')
        check(await pg.evaluate('document.documentElement.dataset.contrast') == 'high', 'contrast: remembered after reload')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(600)
        check(await V('.section-fold:has-text("Мои рецепты")').first.get_attribute('aria-expanded') == 'true', 'folds: an opened section stays open')
        await V('.segmented').first.locator('button').first.click()
        await V('label[for="contrast"]').first.click(); await pg.wait_for_timeout(200)
        check(await pg.evaluate('document.documentElement.dataset.contrast') is None, 'contrast: switched off')

        # finished pack keeps the age it had when it was finished
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(500)
        await V('.link-btn:has-text("Показать")').first.click(); await pg.wait_for_timeout(300)
        tag = V('.bean-list.done .tag-rest-done').first
        check(await tag.count() == 1 and (await tag.inner_text()).startswith('20'), f'finished pack: 20 days after roast, frozen ({await tag.inner_text() if await tag.count() else "—"})')
        live = await V('.bean-list:not(.done) [class*="tag-rest-"]').first.inner_text()
        check(live.startswith('12'), f'pack on the shelf keeps counting ({live})')
        check(not errors, f'no page errors {errors}')
        await pg.close()
        await b.close()
    done()

asyncio.run(main())
