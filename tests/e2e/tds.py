"""Water mineralization (ppm) before brewing and cup TDS (%) after: optional, the first «+» gives 100 ppm, saved with the brew, shown in the journal, offered next time."""
import asyncio
from common import async_playwright, check, done, local, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        row = V('.stepper:has(.stepper-label:has-text("Минерализация воды"))').first
        cup = V('.stepper:has(.stepper-label:has-text("TDS чашки"))').first
        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check('не указана' in await row.locator('.stepper-value').inner_text(), 'TDS is not set by default')
        await row.locator('button[aria-label^="Увеличить"]').click(); await row.locator('button[aria-label^="Увеличить"]').click(); await pg.wait_for_timeout(150)
        check((await row.locator('.stepper-value').inner_text()).replace('\xa0', ' ').startswith('105'), 'the first + jumps to 100 ppm, then 5 ppm steps')
        await pg.screenshot(path='out/tds-method.png', full_page=True)
        # outside the SCA range: a note, the value stays
        await row.locator('.stepper-value').click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('400'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        check('Жёстче, чем советует SCA' in await V('.ppm-hint').inner_text() and (await row.locator('.stepper-value').inner_text()).startswith('400'), 'hard water: a warning, 400 ppm kept')
        await row.locator('.stepper-value').click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('40'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        check('Мягче, чем советует SCA' in await V('.ppm-hint').inner_text(), 'soft water: a warning')
        await pg.screenshot(path='out/tds-ppm-warn.png')
        await row.locator('.stepper-value').click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('105'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        check(await V('.ppm-hint').count() == 0, 'within the range: no note')
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(300)
        check('не измерен' in await cup.locator('.stepper-value').inner_text(), 'cup TDS is not measured by default')
        await cup.locator('button[aria-label^="Увеличить"]').click(); await cup.locator('button[aria-label^="Увеличить"]').click(); await pg.wait_for_timeout(150)
        hint = (await V('.tds-hint').inner_text()).replace('\xa0', ' ')
        check((await cup.locator('.stepper-value').inner_text()).startswith('1,31') and 'Экстракция ≈' in hint, f'the first + gives 1,30 %, then 0,01; extraction shown ({hint[:40]!r})')
        check('примерно' in hint and 'взвесьте' in hint, 'without the drink weight the extraction is marked approximate')
        weight = V('.stepper:has(.stepper-label:has-text("Вес напитка"))').first
        await weight.locator('button[aria-label^="Увеличить"]').click(); await pg.wait_for_timeout(100)
        check((await weight.locator('.stepper-value').inner_text()).startswith('220'), 'the first + on the weight starts from the estimate (220 g)')
        await weight.locator('.stepper-value').click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('225'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        hint = (await V('.tds-hint').inner_text()).replace('\xa0', ' ')
        check('Экстракция 19,7 %' in hint and 'примерно' not in hint, f'weighed: the extraction is exact ({hint[:50]!r})')
        await pg.screenshot(path='out/tds-cup.png', full_page=True)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        br = db['brews'][0]
        check(br.get('ppm') == 105 and br.get('tds') == 1.31 and br.get('beverage') == 225 and db['profile'].get('waterPpm') == 105, f'saved with the brew and remembered ({br.get("ppm")}, {br.get("tds")}, {db["profile"].get("waterPpm")})')
        grid = (await V('.param-grid').inner_text()).replace('\xa0', ' ').lower()
        check('105 ppm' in grid and '1,31 %' in grid and '225 г' in grid and 'экстракция' in grid and '≈' not in grid, f'the brew page shows water ppm, cup TDS and extraction')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("Кемекс")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check((await row.locator('.stepper-value').inner_text()).startswith('105'), 'the next brew offers the same water')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
