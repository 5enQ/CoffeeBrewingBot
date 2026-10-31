"""Water TDS: optional, the first «+» gives 100 ppm, saved with the brew, shown in the journal, offered next time."""
import asyncio
from common import async_playwright, check, done, local, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        row = V('.stepper:has(.stepper-label:has-text("TDS воды"))').first
        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check('не указан' in await row.locator('.stepper-value').inner_text(), 'TDS is not set by default')
        await row.locator('button[aria-label^="Увеличить"]').click(); await row.locator('button[aria-label^="Увеличить"]').click(); await pg.wait_for_timeout(150)
        check((await row.locator('.stepper-value').inner_text()).replace('\xa0', ' ').startswith('105'), 'the first + jumps to 100 ppm, then 5 ppm steps')
        await pg.screenshot(path='out/tds-method.png', full_page=True)
        await V('button:has-text("Без таймера")').click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        check(db['brews'][0].get('tds') == 105 and db['profile'].get('waterTds') == 105, f'saved with the brew and remembered ({db["brews"][0].get("tds")}, {db["profile"].get("waterTds")})')
        grid = (await V('.param-grid').inner_text()).replace('\xa0', ' ')
        check('tds воды' in grid.lower() and '105 ppm' in grid, 'the brew page shows the water TDS')
        await V('button:has-text("Домой")').click(); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("Кемекс")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check((await row.locator('.stepper-value').inner_text()).startswith('105'), 'the next brew offers the same water')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
