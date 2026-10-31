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
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(300)
        check('не измерен' in await cup.locator('.stepper-value').inner_text(), 'cup TDS is not measured by default')
        await cup.locator('button[aria-label^="Увеличить"]').click(); await cup.locator('button[aria-label^="Увеличить"]').click(); await pg.wait_for_timeout(150)
        hint = (await V('.tds-hint').inner_text()).replace('\xa0', ' ')
        check((await cup.locator('.stepper-value').inner_text()).startswith('1,31') and 'Экстракция ≈' in hint, f'the first + gives 1,30 %, then 0,01; extraction shown ({hint[:40]!r})')
        await pg.screenshot(path='out/tds-cup.png', full_page=True)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        br = db['brews'][0]
        check(br.get('ppm') == 105 and br.get('tds') == 1.31 and db['profile'].get('waterPpm') == 105, f'saved with the brew and remembered ({br.get("ppm")}, {br.get("tds")}, {db["profile"].get("waterPpm")})')
        grid = (await V('.param-grid').inner_text()).replace('\xa0', ' ').lower()
        check('105 ppm' in grid and '1,31 %' in grid and 'экстракция' in grid, f'the brew page shows water ppm, cup TDS and extraction')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("Кемекс")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check((await row.locator('.stepper-value').inner_text()).startswith('105'), 'the next brew offers the same water')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
