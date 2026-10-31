"""Timer survives closing the app (reload); long timers run in the background with a banner; >10 cups a day warns."""
import asyncio, json, time
from common import KEY, async_playwright, check, done, local, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')

        # cold brew: start, leave the screen without a question, the banner keeps counting
        await V('.method-card:has-text("Колд брю")').click(); await pg.wait_for_timeout(200)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Начать")').click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Старт")').click(); await pg.wait_for_timeout(400)
        check(await V('.timer-long').count() == 1, 'a long timer says it runs without the app')
        await pg.screenshot(path='out/timer-cold.png', full_page=True)
        stored = json.loads(await pg.evaluate("localStorage.getItem('brewbook.timer')"))
        check(stored and stored['startedAt'] and stored['total'] == 43200, 'the running timer is kept on the device')
        await V('button:has-text("Свернуть")').click(); await pg.wait_for_timeout(400)
        check(await V('.dialog').count() == 0, 'leaving a long timer does not ask to abandon it')
        check(await V('.timer-banner').count() == 1, 'the brew tab shows the running timer')

        # "close the app" for 3 hours: move the start back and reload
        await pg.evaluate("""() => { const t = JSON.parse(localStorage.getItem('brewbook.timer')); t.startedAt -= 3 * 3600 * 1000; localStorage.setItem('brewbook.timer', JSON.stringify(t)); }""")
        await pg.reload(); await pg.wait_for_timeout(700)
        banner = (await V('.timer-banner').inner_text()) if await V('.timer-banner').count() else ''
        check('3:00:0' in banner and ('осталось 8:59:' in banner or 'осталось 9:00:' in banner), f'after reopening the banner shows the real time ({banner!r})')
        await pg.screenshot(path='out/timer-banner.png', full_page=True)
        await V('.timer-banner').click(); await pg.wait_for_timeout(500)
        t = await V('.timer-time').inner_text()
        check(t.startswith('3:00:'), f'the timer resumes where it was ({t})')
        check(await V('button:has-text("Пауза")').count() == 1, 'and it is still running')
        await V('button:has-text("Пауза")').click(); await pg.wait_for_timeout(200)
        check(json.loads(await pg.evaluate("localStorage.getItem('brewbook.timer')"))['startedAt'] is None, 'pause is kept too')
        await V('button[aria-label="Готово, записать"]').click(); await pg.wait_for_timeout(400)
        check(await pg.evaluate("localStorage.getItem('brewbook.timer')") is None, 'finishing forgets the timer')
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        check(round((await local(pg))['brews'][0]['time'] / 60) == 180, 'the brew is saved with the elapsed time')

        # a short pour-over survives a reload, leaving it abandons it
        pg2, errors2 = await page(b, db=DB)
        V2 = lambda s: pg2.locator(s + ':visible')
        await V2('.method-card:has-text("V60")').click(); await pg2.wait_for_timeout(200)
        await V2('.recipe-tile').first.click(); await pg2.wait_for_timeout(300)
        await V2('button:has-text("Начать")').click(); await pg2.wait_for_timeout(300)
        await V2('button:has-text("Старт")').click(); await pg2.wait_for_timeout(1300)
        await pg2.reload(); await pg2.wait_for_timeout(700)
        check(await V2('.timer-banner').count() == 1, 'a short timer is not lost when the app closes')
        await V2('.timer-banner').click(); await pg2.wait_for_timeout(400)
        await V2('.icon-btn.back').click(); await pg2.wait_for_timeout(300)
        if await V2('.dialog').count():
            await V2('.dialog button:has-text("ОК"), .dialog button:has-text("Да"), .dialog .btn-primary').first.click(); await pg2.wait_for_timeout(300)
        check(await pg2.evaluate("localStorage.getItem('brewbook.timer')") is None, 'abandoning a short brew forgets it')

        # 11th cup today → health warning, once
        now = int(time.time() * 1000)
        many = dict(DB, brews=[{'id': f'b{i}', 'methodId': 'v60', 'date': now - i * 60_000, 'dose': 15, 'water': 250, 'temp': 93, 'grind': '', 'time': 180,
                                'rating': 0, 'descriptors': [], 'notes': '', 'beanId': None, 'cupping': None} for i in range(10)])
        pg3, errors3 = await page(b, db=many)
        V3 = lambda s: pg3.locator(s + ':visible')
        await V3('.method-card:has-text("V60")').click(); await pg3.wait_for_timeout(200)
        await V3('.recipe-tile').first.click(); await pg3.wait_for_timeout(300)
        await V3('button:has-text("Без таймера")').click(); await pg3.wait_for_timeout(300)
        await V3('button:has-text("Сохранить")').click(); await pg3.wait_for_timeout(900)
        dlg = (await V3('.dialog').inner_text()) if await V3('.dialog').count() else ''
        check('11 заварок' in dlg and 'здоровья' in dlg, f'the 11th cup today shows a health warning ({dlg[:60]!r})')
        await pg3.screenshot(path='out/health-warning.png')
        check(len((await local(pg3))['brews']) == 11, 'and the brew is saved anyway — nothing is capped')

        check(not errors and not errors2 and not errors3, f'no page errors {errors + errors2 + errors3}')
        await b.close()
    done()

asyncio.run(main())
