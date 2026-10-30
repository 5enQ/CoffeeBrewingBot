"""Drip boxes: defaults, catalog fill-in from a roaster link (mocked server), brewing a drip deducts one bag."""
import asyncio, json
from common import async_playwright, check, done, local, page

LOT = {'source': 'page', 'id': 'x1', 'confirms': 0,
       'coffee': {'name': 'Коста-Рика Эстебан Замора', 'country': 'Коста-Рика', 'process': 'Инфьюз', 'roaster': 'Сварщица Екатерина', 'kind': 'drip'}}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b)
        await pg.route('**/lookup?*', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(LOT)))
        V = lambda s: pg.locator(s + ':visible')
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(400)
        check(await V('button:has-text("+ Коробка дрипов")').count() == 0, 'no separate "+ drip box" button')
        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await V('.segmented button:has-text("Дрип-пакеты")').click(); await pg.wait_for_timeout(200)
        check(await pg.input_value('#bean-drip-count') == '1', 'a drip box defaults to 1 bag')
        check(await V('#bean-drip-weight').count() == 0 and await V('#bean-harvest').count() == 0, 'no weight or harvest fields for drips')
        await pg.fill('#bean-barcode', 'https://theweldercatherine.ru/catalog/kofe_v_filtr_pakete/x/')
        await pg.evaluate("document.querySelector('#bean-barcode').blur()"); await pg.wait_for_timeout(600)
        check(await pg.input_value('#bean-name') == 'Коста-Рика Эстебан Замора', 'fields filled from the roaster link')
        await pg.fill('#bean-drip-count', '3')
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        check(await V('.bean-card:has-text("Эстебан Замора") .stock-icons, .bean-card:has-text("Эстебан Замора") svg').count() > 0, 'stock is drawn as icons')

        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(400)
        await V('.method-card:has-text("Дрип")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        box = next(x for x in db['beans'] if x['name'] == 'Коста-Рика Эстебан Замора')
        brew = next(x for x in db['brews'] if x['methodId'] == 'drip')
        check(brew['beanId'] == box['id'], 'the drip brew uses the box from the shelf')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(400)
        card = await V('.bean-card:has-text("Эстебан Замора")').inner_text()
        check('2 из 3\xa0дрипов' in card, f'one bag deducted: {card!r}')
        check(not errors, f'no page errors: {errors[:3]}')
        await b.close()
    done()

asyncio.run(main())
