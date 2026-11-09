"""Own recipes: with none, the way to make one stands in the middle; an opened own recipe can be deleted, changed and brewed."""
import asyncio
from common import async_playwright, check, done, page, local

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': {'name': 'Аня', 'badges': []}}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB, phone=True)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        V = lambda s: pg.locator(s + ':visible')
        await V('.method-card:has-text("Клевер")').click(); await pg.wait_for_timeout(400)
        empty = V('.recipes-empty')
        check(await empty.count() == 1 and 'пока нет' in await empty.inner_text(), 'no own recipes: a note of its own, apart from the standard one')
        check(await V('.footer-actions').count() == 0, 'and no button at the bottom')
        btn = empty.locator('button:has-text("Свой рецепт")')
        bb, vb = await btn.bounding_box(), pg.viewport_size
        check(abs(bb['x'] + bb['width'] / 2 - vb['width'] / 2) < 4, 'the button stands in the middle')
        tile = await V('.recipe-tile').first.bounding_box()
        eb = await empty.bounding_box()
        gap = (await empty.locator('p').bounding_box())['y'] - (tile['y'] + tile['height'])
        check(gap > 30, f'the note stands well below the standard recipe ({round(gap)} px)')
        await pg.screenshot(path='out/recipes-empty.png')
        await btn.click(); await pg.wait_for_timeout(400)
        await pg.fill('#recipe-name', 'Мой клевер')
        await V('button:has-text("Сохранить рецепт")').click(); await pg.wait_for_timeout(500)
        check(await V('.recipes-empty').count() == 0 and await V('.footer-actions button:has-text("Свой рецепт")').count() == 1, 'with an own recipe the button is at the bottom again')
        await V('.recipe-tile:has-text("Мой клевер")').click(); await pg.wait_for_timeout(500)
        check(await V('[aria-label="Удалить рецепт"]').count() == 1, 'the saved recipe opens with a delete button')
        footer = await V('.footer-actions').inner_text()
        check('Изменить' in footer and 'Заварить' in footer, f'and «Изменить», «Заварить» ({footer!r})')
        check(await V('button:has-text("Записать без таймера")').count() == 1, 'brewing without the timer is still there')
        await pg.screenshot(path='out/recipe-own.png')
        await V('[aria-label="Удалить рецепт"]').click(); await pg.wait_for_timeout(300)
        if await V('.dialog').count(): await V('.dialog button:has-text("Удалить"), .dialog button:has-text("OK"), .dialog button:has-text("Да")').last.click(); await pg.wait_for_timeout(400)
        check(not (await local(pg)).get('custom'), 'deleted')
        check(await V('.recipes-empty').count() == 1, 'back to the list, which has no own recipes again')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
