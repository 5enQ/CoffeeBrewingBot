"""A cold brew started on the phone shows up on the computer (account cloud), pausing on one device pauses the other."""
import asyncio, json
from common import async_playwright, check, done
from common import page

CLOUD: dict[str, str] = {}
def cloud_get(keys): return {k: CLOUD[k] for k in keys if k in CLOUD}
def cloud_set(k, v):
    assert len(v) <= 4096, (k, len(v)); CLOUD[k] = v
def cloud_rm(keys):
    for k in keys: CLOUD.pop(k, None)
INIT = """window.__brewbookCloud = {
  getItems: (keys) => window.cloudGet(keys), setItem: (k, v) => window.cloudSet(k, v),
  removeItems: (keys) => window.cloudRm(keys), getKeys: async () => [] };"""

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': PROFILE}

async def device(b, **kw):
    pg, errors = await page(b, db=DB, init=INIT, **kw)
    await pg.context.expose_function('cloudGet', cloud_get)
    await pg.context.expose_function('cloudSet', cloud_set)
    await pg.context.expose_function('cloudRm', cloud_rm)
    await pg.reload(); await pg.wait_for_timeout(1500)
    return pg, errors

async def wake(pg):
    await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(800)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        phone, e1 = await device(b)
        pc, e2 = await device(b, width=1280, height=800)
        V = lambda pg, s: pg.locator(s + ':visible')

        await V(phone, '.method-card:has-text("Колд брю")').click(); await phone.wait_for_timeout(200)
        await V(phone, '.recipe-tile').first.click(); await phone.wait_for_timeout(300)
        await V(phone, 'button:has-text("Начать")').click(); await phone.wait_for_timeout(300)
        await V(phone, 'button:has-text("Старт")').click(); await phone.wait_for_timeout(600)
        check('timer' in CLOUD and json.loads(CLOUD['timer']).get('startedAt'), 'the running timer goes to the account cloud')

        await wake(pc)
        banner = (await V(pc, '.timer-banner').inner_text()) if await V(pc, '.timer-banner').count() else ''
        check('Колд брю' in banner, f'the computer shows the cold brew started on the phone ({banner!r})')
        await pc.screenshot(path='out/timer-sync-pc.png')
        await V(pc, '.timer-banner').click(); await pc.wait_for_timeout(500)
        check(await V(pc, 'button:has-text("Пауза")').count() == 1, 'on the computer it is running')

        # pause on the computer → the phone's open timer pauses
        await V(pc, 'button:has-text("Пауза")').click(); await pc.wait_for_timeout(400)
        await wake(phone)
        check(await V(phone, 'button:has-text("Продолжить")').count() == 1, 'pausing on the computer pauses the phone')
        t1 = await V(phone, '.timer-time').inner_text(); await phone.wait_for_timeout(1500); t2 = await V(phone, '.timer-time').inner_text()
        check(t1 == t2 and t1.count(':') == 1, f'and the phone stops counting at the right time ({t1} → {t2})')

        # finish on the phone → the computer leaves the timer and the banner is gone
        await V(phone, 'button[aria-label="Готово, записать"]').click(); await phone.wait_for_timeout(400)
        check(json.loads(CLOUD['timer']).get('none') is True, 'finishing clears the timer in the cloud')
        await wake(pc)
        check(await V(pc, '.timer-time').count() == 0, 'the computer closes the timer finished on the phone')
        check(await V(pc, '.timer-banner').count() == 0, 'and shows no banner')

        check(not e1 and not e2, f'no page errors {e1 + e2}')
        await b.close()
    done()

asyncio.run(main())
