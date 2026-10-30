"""Grinder loss: set on the grinder, the pack gives dose + loss, the recipe keeps the dose; corrected per brew."""
import asyncio
from common import async_playwright, check, done, local, page

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [],
      'profile': {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True},
      'gear': [{'id': 'g1', 'cat': 'grinder', 'name': 'Eureka Mignon', 'details': '', 'grindType': 'mechanical'}],
      'beans': [{'id': 'k1', 'name': 'Кения Ньери', 'roaster': 'X', 'country': 'Кения', 'region': '', 'farm': '', 'producer': '', 'variety': '', 'process': 'Мытая',
                 'altitude': '', 'harvest': '', 'roastLevel': 'Светлая', 'roastDate': '2026-10-20', 'weight': '250', 'barcode': '', 'link': '', 'packNotes': '', 'comment': '', 'createdAt': 1}]}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(400)
        await V('.row:has-text("Eureka Mignon")').first.click(); await pg.wait_for_timeout(300)
        await pg.fill('#gear-loss', '1,'); await pg.wait_for_timeout(100)
        check(await pg.input_value('#gear-loss') == '1,', 'a decimal comma can be typed')
        await pg.fill('#gear-loss', '1,5')
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(300)
        check(next(g for g in (await local(pg))['gear'] if g['id'] == 'g1').get('loss') == 1.5, 'loss saved on the grinder')

        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(400)
        note = await V('.grind-loss').inner_text() if await V('.grind-loss').count() else ''
        check('Из пачки 16,5 г → в воронку 15 г' in note.replace('\xa0', ' '), f'method screen explains the loss ({note!r})')
        await pg.screenshot(path='out/loss-method.png', full_page=True)
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(400)
        check(await V('.stepper:has-text("Из пачки")').count() == 1, 'brew editor shows «Из пачки»')
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        brew = db['brews'][0]
        check(brew['dose'] == 15 and brew.get('fromPack') == 16.5, f'brew keeps dose 15 and from pack 16.5 ({brew.get("dose")}, {brew.get("fromPack")})')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(300)
        card = (await V('.bean-card:has-text("Кения Ньери")').inner_text()).replace('\xa0', ' ')
        check('234 из 250 г' in card, f'stock goes down by 16.5 g: 233.5 left, shown rounded ({card.splitlines()})')
        check(not errors, f'no page errors: {errors[:3]}')
        await b.close()
    done()

asyncio.run(main())
