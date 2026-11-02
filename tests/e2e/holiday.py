"""Holiday looks (previewed on the device): what hangs from the top of the page (cobwebs, garland, coffee branches)
and lies at its end (pumpkins, snowmen, farmers) — part of the page, they scroll with it — New Year snow and fireworks, the greeting card."""
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
            check(await pg.locator(f'.holiday-ground {ground}').count() >= 1, f'{h}: lies at the end of the page ({ground})')
            # both are part of the page: they scroll with it
            y0 = await pg.locator('.holiday-top:visible').evaluate('e => e.getBoundingClientRect().top')
            await pg.mouse.wheel(0, 200); await pg.wait_for_timeout(300)
            dy = await pg.evaluate('scrollY')
            check(dy > 0, f'{h}: the page scrolled')
            check(abs(await pg.locator('.holiday-top:visible').evaluate('e => e.getBoundingClientRect().top') - (y0 - dy)) < 1, f'{h}: the top decoration scrolls away with the page')
            await pg.mouse.wheel(0, 5000); await pg.wait_for_timeout(400)
            bar = await pg.locator('.tabbar').evaluate('e => e.getBoundingClientRect().top')
            gb = await pg.locator('.holiday-ground').evaluate('e => e.getBoundingClientRect().bottom')
            check(abs(gb - bar) < 2, f'{h}: at the end of the page the ground rests on the bottom bar ({gb} vs {bar})')
            await pg.mouse.wheel(0, -2000); await pg.wait_for_timeout(200)
            if h == 'newyear': check(await pg.locator('.holiday-snow').count() == 1, 'newyear: snow')
            check(await pg.evaluate("[...document.querySelectorAll('.holiday-top, .holiday-ground')].every(e => getComputedStyle(e).pointerEvents === 'none')"), f'{h}: nothing blocks taps')
            await pg.locator('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
            check(await pg.locator('.recipe-tile:visible').count() > 0, f'{h}: the app works under the decoration')
            check(await pg.locator('.holiday-top:visible').count() == 1, f'{h}: the top decoration on inner screens too')
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
        check(await pg.locator('.holiday-card, .holiday-top, .holiday-snow, .holiday-ground').count() == 0, '«off»: no decoration')
        check(await pg.evaluate('document.documentElement.dataset.holiday') is None, '«off»: no room reserved for it')
        await b.close()
    done()

asyncio.run(main())
