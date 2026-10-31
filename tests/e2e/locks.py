"""Coffee / water / ratio locks on the method screen."""
import asyncio
from common import async_playwright, check, done, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}
N = lambda s: s.replace('\xa0', ' ').replace(' ', '')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        row = lambda name: V(f'.stepper:has(.stepper-label:has-text("{name}"))').first
        val = lambda name: row(name).locator('.stepper-value').inner_text()
        plus = lambda name: row(name).locator('button[aria-label^="Увеличить"]').click()
        lockbtn = lambda name: row(name).locator('.stepper-lock').click()

        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check(await row('Пропорция').locator('.stepper-lock.on').count() == 1, 'the ratio is locked by default')
        d0, w0, r0 = N(await val('Кофе')), N(await val('Вода')), N(await val('Пропорция'))
        await plus('Кофе'); await pg.wait_for_timeout(150)
        check(N(await val('Пропорция')) == r0 and N(await val('Вода')) != w0, f'ratio locked: coffee moves the water ({w0} → {await val("Вода")})')
        await plus('Пропорция'); await pg.wait_for_timeout(100)
        check(await row('Пропорция').locator('.stepper-ctrl.denied').count() == 1, 'the locked ratio refuses the tap and flashes')
        check(N(await val('Пропорция')) == r0, 'and does not change')
        await pg.screenshot(path='out/locks-denied.png'); await pg.wait_for_timeout(500)

        # lock coffee: the water moves the ratio
        await lockbtn('Кофе'); await pg.wait_for_timeout(150)
        d1, r1 = N(await val('Кофе')), N(await val('Пропорция'))
        await plus('Вода'); await plus('Вода'); await pg.wait_for_timeout(150)
        check(N(await val('Кофе')) == d1 and N(await val('Пропорция')) != r1, f'coffee locked: the water changes the ratio ({r1} → {await val("Пропорция")})')
        await plus('Пропорция'); await pg.wait_for_timeout(150)
        check(N(await val('Кофе')) == d1, 'coffee locked: the ratio changes the water, not the coffee')

        # lock water: the coffee moves the ratio
        await lockbtn('Вода'); await pg.wait_for_timeout(150)
        w2, r2 = N(await val('Вода')), N(await val('Пропорция'))
        await plus('Кофе'); await plus('Кофе'); await pg.wait_for_timeout(150)
        check(N(await val('Вода')) == w2 and N(await val('Пропорция')) != r2, f'water locked: the coffee changes the ratio, water stays {w2}')
        await pg.screenshot(path='out/locks-water.png')

        # remembered for the method
        await V('.icon-btn.back').first.click(); await pg.wait_for_timeout(300)
        if await V('.dialog').count(): await V('.dialog .btn-primary').first.click(); await pg.wait_for_timeout(200)
        while await V('.icon-btn.back').count():
            await V('.icon-btn.back').first.click(); await pg.wait_for_timeout(200)
        await V('.method-card:has-text("V60")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check(await row('Вода').locator('.stepper-lock.on').count() == 1, 'the lock is remembered for V60')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
