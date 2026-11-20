"""English: a browser (or Telegram) in another language gets the app in English, with no Russian left on the main
screens; Профиль → Language switches it on this device and the app restarts in the language picked."""
import asyncio, re
from common import async_playwright, check, done, page

CYR = re.compile(r'[А-Яа-яЁё]')

async def russian_left(pg):
    # the language picker names Russian in Russian on purpose
    text = (await pg.evaluate("() => document.body.innerText")).replace('Русский', '')
    return sorted(set(m.group(0) for m in re.finditer(r'\S*[А-Яа-яЁё]\S*', text)))[:12]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, locale='ja-JP')
        V = lambda s: pg.locator(s + ':visible')
        check(await pg.evaluate("document.documentElement.lang") == 'en', 'a Japanese browser gets English')
        tabs = await V('.tabbar').inner_text()
        check(all(w in tabs for w in ('Brew', 'Journal', 'Shelf', 'Profile')), f'the tabs are in English ({tabs!r})')
        for tab in ('Brew', 'Journal', 'Shelf', 'Profile'):
            await pg.click(f'.tabbar >> text={tab}'); await pg.wait_for_timeout(400)
            left = await russian_left(pg)
            check(not left, f'{tab}: no Russian on the screen {left}')
        await pg.click('.tabbar >> text=Brew'); await pg.wait_for_timeout(300)
        await V('.method-card:has-text("V60")').first.click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(400)
        check(not await russian_left(pg), f'the recipe screen: no Russian {await russian_left(pg)}')
        check('Standard recipe' in await pg.evaluate("document.body.innerText"), 'the recipe screen speaks English')
        await V('button:has-text("Start")').last.click(); await pg.wait_for_timeout(400)
        check(not await russian_left(pg), f'the timer: no Russian {await russian_left(pg)}')
        # the decimal point: 1:16.7, not 1:16,7
        await V('[aria-label="Back"]').last.click(); await pg.wait_for_timeout(300)
        ratio = await V('.recipe-sum').inner_text()
        check('1:16.7' in ratio, f'numbers take a decimal point ({ratio!r})')
        for _ in range(3):
            if await V('[aria-label="Back"]').count(): await V('[aria-label="Back"]').last.click(); await pg.wait_for_timeout(300)

        # deeper screens: a pack and its editor, a brew and its rating, the profile card editor
        async def deeper(tab, opener, inner, name):
            await pg.click(f'.tabbar >> text={tab}'); await pg.wait_for_timeout(400)
            await V(opener).first.click(); await pg.wait_for_timeout(500)
            check(not await russian_left(pg), f'{name}: no Russian {await russian_left(pg)}')
            if inner:
                await V(inner).first.click(); await pg.wait_for_timeout(500)
                check(not await russian_left(pg), f'{name}, editing: no Russian {await russian_left(pg)}')
            for _ in range(3):
                if await V('[aria-label="Back"]').count(): await V('[aria-label="Back"]').last.click(); await pg.wait_for_timeout(300)
                if await V('.dialog button:has-text("Leave"), .dialog button:has-text("OK"), .dialog button:has-text("Yes")').count():
                    await V('.dialog button:has-text("Leave"), .dialog button:has-text("OK"), .dialog button:has-text("Yes")').last.click(); await pg.wait_for_timeout(300)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await deeper('Shelf', '.tab-page .bean-card, .tab-page .row', '[aria-label="Edit"]', 'a pack')
        await deeper('Journal', '.tab-page .row', '.footer-actions button:has-text("Edit")', 'a brew')
        await deeper('Profile', 'button:has-text("Customize")', None, 'the card editor')

        # pick Russian by hand: the app restarts in Russian and stays so
        await pg.click('.tabbar >> text=Profile'); await pg.wait_for_timeout(400)
        await V('.look-pick:has-text("Language") .segmented button:has-text("Русский")').click()
        await pg.wait_for_timeout(1500)
        check(await pg.evaluate("document.documentElement.lang") == 'ru' and 'Заварить' in await V('.tabbar').inner_text(), 'Русский picked: the app restarts in Russian')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(400)
        await V('.look-pick:has-text("Язык") .segmented button:has-text("Авто")').click()
        await pg.wait_for_timeout(1500)
        check('Brew' in await V('.tabbar').inner_text(), '«Авто» goes back to the browser\'s language')
        await pg.screenshot(path='out/english-profile.png')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
