"""«Фосфор»: the Konami code on the profile tab opens the green-monitor style with a start-up of the old computer;
the style is a profile card — choosing another card turns it off, choosing it again on; a friend's shared card in
this style shows their profile in it, and the app turns back on leaving it."""
import asyncio, json
from common import OUT, URL, async_playwright, check, done, local, page

src = open('card.py').read().split('async def main')[0]
ns = {'__file__': 'card.py'}; exec(src, ns)
CARDS, DB, TG, mock = ns['CARDS'], ns['DB'], ns['TG'], ns['mock']
CARDS['phos1'] = ns['card']({'base': 'phosphor'})
KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
style = "() => document.documentElement.dataset.style || null"


async def konami(pg):
    for k in KONAMI:
        await pg.keyboard.press(k)


async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        posted = []
        pg, errors = await page(b, db=DB, init=TG)
        await mock(pg, posted)
        await pg.reload(); await pg.wait_for_timeout(1200)
        V = lambda s: pg.locator(s + ':visible')

        await konami(pg); await pg.wait_for_timeout(300)
        check(await pg.locator('.phos-boot').count() == 0, 'the code on another tab does nothing')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(500)
        check(await pg.evaluate(style) is None, 'the plain style before the code')
        await V('.my-card-actions button:has-text("Настроить")').click(); await pg.wait_for_timeout(500)
        check(await V('.theme-pick.base-phosphor').count() == 0, 'the «Фосфор» card is hidden until found')
        await pg.evaluate('window.__tgBack()'); await pg.wait_for_timeout(400)

        await konami(pg); await pg.wait_for_timeout(1700)
        check(await pg.locator('.phos-boot').count() == 1, 'the code on the profile tab starts the old computer')
        boot = await pg.locator('.phos-text').inner_text()
        check('BREWBOOK BIOS' in boot and 'Comandante C40' in boot and 'Hario V60 02' in boot, f'the BIOS lists the person’s own grinder and dripper ({boot.splitlines()[:4]})')
        await pg.screenshot(path=str(OUT / 'phosphor-boot.png'))
        check(await pg.evaluate(style) == 'phosphor', 'the app under it is already green')
        await pg.wait_for_timeout(3600)
        check(await pg.locator('.phos-boot').count() == 0, 'the start-up ends by itself')
        snack = await pg.locator('.snack').all_inner_texts()
        check(any('Фосфор' in s for s in snack), f'a note says how to turn it back ({snack})')
        prof = (await local(pg))['profile']
        check(prof.get('secrets') == ['phosphor'] and prof.get('cardTheme') == 'phosphor', f'opened and chosen in the profile ({prof.get("secrets")}, {prof.get("cardTheme")})')
        look = await pg.evaluate("() => { const s = getComputedStyle(document.body); return [s.backgroundColor, s.color, s.fontFamily.split(',')[0]]; }")
        check(look[0] == 'rgb(5, 8, 6)' and look[1] == 'rgb(139, 227, 155)' and 'mono' in look[2].lower(), f'green text on black in a monospace font {look}')
        await pg.screenshot(path=str(OUT / 'phosphor-profile.png'))
        # drawn in characters, as in the mockups
        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(600)
        sym = await pg.evaluate('''() => { const css = (e, p) => e ? getComputedStyle(e, p).content : null, v = (s) => [...document.querySelectorAll(s)].find((e) => e.getClientRects().length);
          return { hello: !!v('.ascii-hello pre'), tab: css(document.querySelector('.tabbar button'), '::before'), head: css(v('.section-head h2'), '::after'),
                   back: null, star: css(v('.star-fill'), '::before'), icon: getComputedStyle(document.querySelector('.method-card .method-icon')).display }; }''')
        check(sym['hello'] and sym['tab'] == '"F1"' and '=====' in (sym['head'] or '') and sym['star'] == '"*"' and sym['icon'] == 'none',
              f'a cup in symbols, F-key tabs, «== … ====» headings, * stars, methods as a text menu {sym}')
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(600)
        st = await pg.locator('.stat-star:visible').all_inner_texts()
        check(st == ['*'], f'the average in the journal is written with *, not ★ ({st})')
        for tab in ('Заварить', 'Дневник', 'Полка'):
            await pg.click(f'.tabbar >> text={tab}'); await pg.wait_for_timeout(600)
            await pg.screenshot(path=str(OUT / f'phosphor-{tab}.png'))

        # the card turns it off and on
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(500)
        check(await V('.pcard.base-phosphor .pcard-prompt').count() == 1, 'the own card is the green monitor')
        await V('.my-card-actions button:has-text("Настроить")').click(); await pg.wait_for_timeout(500)
        tile = V('.theme-pick.base-phosphor')
        check(await tile.count() == 1 and await tile.get_attribute('aria-pressed') == 'true', '«Фосфор» is among the backgrounds, chosen')
        await pg.screenshot(path=str(OUT / 'phosphor-card-edit.png'))
        await pg.wait_for_timeout(2000)
        check(posted and posted[-1]['theme'] == {'base': 'phosphor'}, f'the shared card carries the style ({posted[-1]["theme"] if posted else None})')
        await V('.theme-pick.base-paper').click(); await pg.wait_for_timeout(300)
        check(await pg.evaluate(style) is None, 'another card turns the style off')
        await tile.click(); await pg.wait_for_timeout(300)
        check(await pg.evaluate(style) == 'phosphor', 'the card turns it on again')
        check(not errors, f'no page errors {errors[:3]}')
        await pg.context.close()

        # on start the style comes from this device's own setting, before the data is read: no plain flash
        # (a fresh page with what the app saved: reloading a file:// page in Chromium now and then loses its storage)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        saved = {**DB, 'profile': {**DB['profile'], 'secrets': ['phosphor'], 'cardTheme': 'phosphor'}}
        await ctx.add_init_script("localStorage.setItem('brewbook.db.v1', " + json.dumps(json.dumps(saved)) + "); localStorage.setItem('brewbook.appearance', '{\"theme\":\"auto\",\"contrast\":false,\"style\":\"phosphor\"}')")
        ps = await ctx.new_page()
        await ps.goto(URL, wait_until='domcontentloaded'); await ps.wait_for_selector('#root > *', state='attached')
        first = await ps.evaluate(style)
        await ps.wait_for_timeout(800)
        check(first == 'phosphor' and await ps.evaluate(style) == 'phosphor', f'green from the first frame of a start, and still once the data is read ({first})')
        await ctx.close()

        # a friend who never found it opens a card in this style: the app is green while it is open
        pv, err = await page(b, init=TG + "\nlocation.hash = '#r=pphos1';", db=DB)
        await mock(pv, [])
        await pv.reload(); await pv.wait_for_timeout(1200)
        check(await pv.locator('.pcard.base-phosphor:visible').count() == 1 and await pv.evaluate(style) == 'phosphor', 'a shared «Фосфор» card shows the profile in the style')
        await pv.screenshot(path=str(OUT / 'phosphor-shared.png'))
        await pv.evaluate('window.__tgBack()'); await pv.wait_for_timeout(400)
        check(await pv.evaluate(style) is None, 'back from it, the friend’s app is as it was')
        check('phosphor' not in json.dumps((await local(pv))['profile']), 'looking at it opens nothing for the friend')
        check(not err, f'no page errors (friend) {err[:3]}')

        # the timer in characters (a fresh page: leaving a timer asks to confirm)
        pt, et = await page(b, db={**DB, 'profile': {**DB['profile'], 'secrets': ['phosphor'], 'cardTheme': 'phosphor'}})
        T = lambda s: pt.locator(s + ':visible')
        await T('.method-card:has-text("V60")').first.click(); await pt.wait_for_timeout(500)
        await T('.recipe-tile').first.click(); await pt.wait_for_timeout(400)
        await T('button:has-text("Начать")').last.click(); await pt.wait_for_timeout(500)
        dig = await T('.ascii-digits').first.inner_text() if await T('.ascii-digits').count() else ''
        check(dig.count('\n') == 4 and '#' in dig and await T('.ascii-bar').count() == 1, 'the timer: block digits of # and a [====>....] bar')
        await pt.screenshot(path=str(OUT / 'phosphor-timer.png'))
        check(not et, f'no page errors (timer) {et[:3]}')

        # a wide window: F1–F4 work as the tabs they sign; the empty half shows a picture in symbols
        pw, ew = await page(b, width=1280, height=800, db={**DB, 'profile': {**DB['profile'], 'secrets': ['phosphor'], 'cardTheme': 'phosphor'}})
        on = "() => document.querySelector('.side-nav button.on')?.innerText"
        await pw.keyboard.press('F3'); await pw.wait_for_timeout(400)
        a = await pw.evaluate(on)
        await pw.keyboard.press('F2'); await pw.wait_for_timeout(400)
        b2 = await pw.evaluate(on)
        check('Полка' in (a or '') and 'Дневник' in (b2 or ''), f'F3 and F2 open the shelf and the journal ({a!r}, {b2!r})')
        check(await pw.locator('.placeholder-art:visible').count() == 1, 'the empty half shows a picture in symbols')
        await pw.screenshot(path=str(OUT / 'phosphor-wide.png'))
        check(not ew, f'no page errors (wide) {ew[:3]}')
        pn, en = await page(b, width=1280, height=800, db=DB)
        await pn.keyboard.press('F3'); await pn.wait_for_timeout(300)
        check('Заварить' in (await pn.evaluate(on) or ''), 'in the plain style F-keys stay the browser’s')

        # reduced motion: no tube flash or typing, a short fade; any key skips
        pr, er = await page(b, db=DB)
        await pr.emulate_media(reduced_motion='reduce')
        await pr.click('.tabbar >> text=Профиль'); await pr.wait_for_timeout(400)
        await konami(pr); await pr.wait_for_timeout(100)
        check(await pr.locator('.phos-boot.calm .phos-prompt').count() == 1, 'reduced motion: the whole screen at once, no flash')
        await pr.keyboard.press('Space'); await pr.wait_for_timeout(500)
        check(await pr.locator('.phos-boot').count() == 0, 'a key skips the start-up')
        check(not er, f'no page errors (reduced motion) {er[:3]}')
        await b.close()
    done()

asyncio.run(main())
