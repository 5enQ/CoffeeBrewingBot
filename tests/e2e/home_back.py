"""Coming back to the brew tab from a method screen: the method tiles stay put (no animation from a zero size)."""
import asyncio
from common import async_playwright, check, done, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}
MOVING = """() => [...document.querySelectorAll('[data-flip]')].filter((el) => el.getClientRects().length && el.getAnimations().length).length"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        for name in ('Дрип', 'V60', 'Кемекс'):
            await V(f'.method-card:has-text("{name}")').click(); await pg.wait_for_timeout(250)
            if await V('.recipe-tile').count():
                await V('.recipe-tile').first.click(); await pg.wait_for_timeout(250)
            # change something on the method screen, so the hidden brew tab re-renders
            if await V('.stepper button').count():
                await V('.stepper button').last.click(); await pg.wait_for_timeout(100)
            while await V('.icon-btn.back').count():
                await V('.icon-btn.back').first.click(); await pg.wait_for_timeout(120)
                if await V('.dialog').count():
                    await V('.dialog .btn-primary, .dialog button:has-text("Да")').first.click(); await pg.wait_for_timeout(120)
            await pg.wait_for_timeout(30)
            moving = await pg.evaluate(MOVING)
            check(moving == 0, f'back from {name}: no tile is animating ({moving})')
            await pg.wait_for_timeout(400)
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
