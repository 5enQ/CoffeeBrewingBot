"""The recipe screen: numbers are edited in place and kept, an empty pack is never picked, the beans of a repeat change on a press."""
import asyncio, time
from common import async_playwright, check, done, local, page

NOW = int(time.time() * 1000)
BEAN = {'roaster': 'X', 'region': '', 'farm': '', 'producer': '', 'variety': '', 'process': 'Мытая', 'altitude': '', 'harvest': '',
        'roastLevel': 'Светлая', 'roastDate': '2026-10-20', 'barcode': '', 'link': '', 'packNotes': '', 'comment': '', 'createdAt': 1}
BREW = {'methodId': 'v60', 'water': 250, 'temp': 93, 'grind': 'средний', 'time': 180, 'rating': 0, 'notes': '',
        'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3}, 'descriptors': [], 'cupping': None, 'gear': []}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'gear': [],
      'profile': {'name': 'Аня', 'badges': []},
      'beans': [{**BEAN, 'id': 'e1', 'name': 'Пустая Эфиопия', 'country': 'Эфиопия', 'weight': '15'},
                {**BEAN, 'id': 'k1', 'name': 'Кения Ньери', 'country': 'Кения', 'weight': '250'}],
      'brews': [{**BREW, 'id': 'b1', 'date': NOW - 60_000, 'beanId': 'e1', 'dose': 15},
                {**BREW, 'id': 'b2', 'date': NOW - 120_000, 'beanId': 'k1', 'dose': 15}],
      'custom': [{'id': 'c1', 'methodId': 'v60', 'name': 'Мой V60', 'dose': 15, 'ratio': 16, 'temp': 93, 'grind': 'средний',
                  'total': 180, 'steps': [{'at': 0, 'title': 'Пролив', 'to': 1}], 'notes': '', 'createdAt': 1}]}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB, phone=True)
        V = lambda s: pg.locator(s + ':visible')

        # a repeat of a brew whose pack ran out: another pack, and the picker is open
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(300)
        await V('.tab-page .row:has-text("Эфиопия")').first.click(); await pg.wait_for_timeout(400)
        await V('button:has-text("Повторить")').click(); await pg.wait_for_timeout(500)
        on = V('.bean-pick.on')
        check(await on.count() == 1 and 'Кения' in await on.inner_text(), 'the empty pack is not picked: the one with coffee is')
        check(await V('.bean-pick:has-text("Эфиопия")').count() == 0, 'and the empty one is not offered at all')
        await pg.screenshot(path='out/recipe-empty-pack.png')
        await V('[aria-label="Назад"]').last.click(); await pg.wait_for_timeout(300)
        await V('[aria-label="Назад"]').last.click(); await pg.wait_for_timeout(300)

        # a repeat with coffee left: the beans are a row; a long press opens the picker
        await V('.tab-page .row:has-text("Кения")').first.click(); await pg.wait_for_timeout(400)
        await V('button:has-text("Повторить")').click(); await pg.wait_for_timeout(500)
        row = V('.bean-now')
        check(await row.count() == 1 and await V('.bean-picker').count() == 0, 'a repeat shows its beans as one row')
        bb = await row.bounding_box()
        await pg.mouse.move(bb['x'] + 40, bb['y'] + bb['height'] / 2); await pg.mouse.down(); await pg.wait_for_timeout(600)
        check(await V('.bean-picker').count() == 1, 'a long press on them opens the picker, before the finger is lifted')
        await pg.mouse.up(); await pg.wait_for_timeout(200)
        await V('.bean-pick:has-text("Без зерна")').click(); await pg.wait_for_timeout(200)
        check('Без зерна' in await V('.bean-pick.on').inner_text(), 'and other beans are picked right there')
        await V('[aria-label="Назад"]').last.click(); await pg.wait_for_timeout(300)
        await V('[aria-label="Назад"]').last.click(); await pg.wait_for_timeout(300)

        # an own recipe: no «Изменить»; a change on the screen goes into the recipe
        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("V60")').first.click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile:has-text("Мой V60")').click(); await pg.wait_for_timeout(500)
        footer = await V('.footer-actions').inner_text()
        check('Изменить' not in footer and 'Заварить' in footer, f'the footer has no «Изменить» ({footer!r})')
        check(await V('button:has-text("Изменить шаги")').count() == 1, 'the steps keep their way to the editor')
        db0 = await local(pg)
        check(db0['custom'][0]['temp'] == 93, 'opening the recipe changes nothing')
        await V('[aria-label="Увеличить: Температура"]').click(); await pg.wait_for_timeout(100)
        await V('[aria-label="Увеличить: Вода"]').click(); await pg.wait_for_timeout(800)
        r = (await local(pg))['custom'][0]
        check(abs(r['temp'] - 93.1) < 0.01 and round(r['dose'] * r['ratio']) == 250, f'the change is kept in the recipe: {r["temp"]} °C, {r["dose"]} г × {r["ratio"]}')
        check(abs((await local(pg))['recipes']['v60']['temp'] - 93.1) < 0.01, 'and as the method\'s last settings')
        await pg.screenshot(path='out/recipe-inline.png')
        # the recipe opens again with what was set
        await V('[aria-label="Назад"]').last.click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile:has-text("Мой V60")').click(); await pg.wait_for_timeout(500)
        t = await V('.stepper:has(.stepper-label:has-text("Температура")) .stepper-value').inner_text()
        check('93,1' in t, f'and opens with it next time ({t!r})')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
