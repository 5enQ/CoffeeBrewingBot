"""Holiday looks (previewed on the device): what hangs at the top (cobwebs, garland, coffee branches) and stays there
while the page scrolls, what lies at the bottom (pumpkins, snowmen, farmers), New Year snow and fireworks, the greeting card."""
import asyncio
from common import async_playwright, check, done, page

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [],
      'profile': {'name': 'Аня', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for h, top, ground in (('halloween', '.cobweb', '.pumpkin'), ('newyear', '.top-garland', '.snowman'), ('coffeeday', '.coffee-branch', '.picker')):
            pg, errors = await page(b, db=DB, init=f"localStorage.setItem('brewbook.holiday.preview', '{h}')")
            check(await pg.locator(f'.holiday-card.holiday-{h}').count() == 1, f'{h}: the greeting on the brew tab')
            check(await pg.locator(f'.holiday-top {top}').count() >= 1, f'{h}: hangs at the top ({top})')
            check(await pg.locator(f'.tabbar .holiday-ground {ground}').count() >= 1, f'{h}: lies on the bottom bar ({ground})')
            y0 = await pg.locator('.holiday-top').evaluate('e => e.getBoundingClientRect().top')
            g0 = await pg.locator('.holiday-ground').evaluate('e => e.getBoundingClientRect().bottom')
            await pg.mouse.wheel(0, 500); await pg.wait_for_timeout(300)
            check(await pg.evaluate('scrollY') > 0, f'{h}: the page scrolled')
            check(await pg.locator('.holiday-top').evaluate('e => e.getBoundingClientRect().top') == y0, f'{h}: the top decoration stays while scrolling')
            check(await pg.locator('.holiday-ground').evaluate('e => e.getBoundingClientRect().bottom') == g0, f'{h}: and the bottom one too')
            await pg.mouse.wheel(0, -2000); await pg.wait_for_timeout(200)
            if h == 'newyear': check(await pg.locator('.holiday-snow').count() == 1, 'newyear: snow')
            check(await pg.evaluate("getComputedStyle(document.querySelector('.holiday-layer, .holiday-snow, .holiday-card')).pointerEvents") in ('none', 'auto'), f'{h}: nothing blocks taps')
            await pg.locator('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
            check(await pg.locator('.recipe-tile:visible').count() > 0, f'{h}: the app works under the decoration')
            check(await pg.locator('.holiday-top').count() == 1, f'{h}: the top decoration on inner screens too')
            await pg.locator('.icon-btn.back:visible').first.click(); await pg.wait_for_timeout(200)
            await pg.locator('.holiday-close:visible').click(); await pg.wait_for_timeout(200)
            check(await pg.locator('.holiday-card').count() == 0, f'{h}: the greeting can be closed')
            # the choice is kept on the device (the year logic is in tests/unit/holidays.test.ts; a second file:// tab
            # in headless Chromium does not reliably see a fresh storage write, so it is not reopened here)
            check((await pg.evaluate("localStorage.getItem('brewbook.holiday.hidden')") or '').startswith(h + ':'), f'{h}: and the choice is remembered')
            if h == 'newyear':
                await pg.evaluate("window.dispatchEvent(new Event('brewbook-fireworks'))"); await pg.wait_for_timeout(1500)
                check(await pg.locator('.holiday-fireworks').count() == 1, 'fireworks play on request')
                await pg.locator('.holiday-fireworks').wait_for(state='detached', timeout=15000)
                check(await pg.locator('.holiday-fireworks').count() == 0, 'and go away by themselves')
            check(not errors, f'{h}: no page errors {errors}')
            await pg.context.close()
        # outside a holiday nothing is shown
        pg, errors = await page(b, db=DB, init="localStorage.setItem('brewbook.holiday.preview', 'off')")
        check(await pg.locator('.holiday-card, .holiday-layer, .holiday-snow, .holiday-ground').count() == 0, '«off»: no decoration')
        check(await pg.evaluate('document.documentElement.dataset.holiday') is None, '«off»: no room reserved for it')
        await b.close()
    done()

asyncio.run(main())
