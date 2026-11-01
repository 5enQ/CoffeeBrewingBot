"""Holiday looks (previewed on the device): Halloween cobwebs and pumpkins, New Year snow and fireworks, Coffee Day scene."""
import asyncio
from common import async_playwright, check, done, page

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [],
      'profile': {'name': 'Аня', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for h, what in (('halloween', '.cobweb'), ('newyear', '.holiday-snow'), ('coffeeday', '.coffee-scene')):
            pg, errors = await page(b, db=DB, init=f"localStorage.setItem('brewbook.holiday.preview', '{h}')")
            check(await pg.locator(f'.holiday-card.holiday-{h}').count() == 1, f'{h}: the greeting on the brew tab')
            check(await pg.locator(what).count() >= 1, f'{h}: its decoration ({what})')
            check(await pg.evaluate("getComputedStyle(document.querySelector('.holiday-layer, .holiday-snow, .holiday-card')).pointerEvents") in ('none', 'auto'), f'{h}: nothing blocks taps')
            await pg.locator('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
            check(await pg.locator('.recipe-tile:visible').count() > 0, f'{h}: the app works under the decoration')
            await pg.locator('.icon-btn.back:visible').first.click(); await pg.wait_for_timeout(200)
            await pg.locator('.holiday-close:visible').click(); await pg.wait_for_timeout(200)
            check(await pg.locator('.holiday-card').count() == 0, f'{h}: the greeting can be closed')
            await pg.wait_for_timeout(1500)  # file:// pages: let the storage write reach the browser before reloading
            await pg.reload(); await pg.wait_for_timeout(600)
            check(await pg.locator('.holiday-card').count() == 0, f'{h}: and stays closed this year')
            if h == 'newyear':
                await pg.evaluate("window.dispatchEvent(new Event('brewbook-fireworks'))"); await pg.wait_for_timeout(1500)
                check(await pg.locator('.holiday-fireworks').count() == 1, 'fireworks play on request')
                await pg.locator('.holiday-fireworks').wait_for(state='detached', timeout=15000)
                check(await pg.locator('.holiday-fireworks').count() == 0, 'and go away by themselves')
            check(not errors, f'{h}: no page errors {errors}')
            await pg.context.close()
        # outside a holiday nothing is shown
        pg, errors = await page(b, db=DB, init="localStorage.setItem('brewbook.holiday.preview', 'off')")
        check(await pg.locator('.holiday-card, .holiday-layer, .holiday-snow').count() == 0, '«off»: no decoration')
        await b.close()
    done()

asyncio.run(main())
