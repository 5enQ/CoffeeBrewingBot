"""Every press answers: the phone taps (once — not on top of the handler's own vibration), and the thing dims."""
import asyncio
from common import async_playwright, check, done, page

TG = """window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A555%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 555, first_name: 'Owner', username: 'owner' } },
  version: '8.0', platform: 'tdesktop', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 8.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {},
  BackButton: { show() {}, hide() {}, onClick(cb) { window.__tgBack = cb; }, offClick() {} }, HapticFeedback: { impactOccurred(k) { (window.__h = window.__h || []).push('impact:' + k); }, notificationOccurred(k) { (window.__h = window.__h || []).push('note:' + k); }, selectionChanged() { (window.__h = window.__h || []).push('select'); } },
  MainButton: { hide() {} }, SettingsButton: { hide() {} } } };"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        db = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [], 'profile': {'name': 'Аня', 'badges': []}}
        pg, errors = await page(b, init=TG, phone=True, db=db)
        await pg.route('**/brewbook-ratings.brewbook.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
        await pg.wait_for_timeout(1500)
        H = lambda: pg.evaluate("() => { const h = window.__h || []; window.__h = []; return h }")
        await H()
        # a tab with no vibration of its own
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(200)
        h = await H()
        check(len(h) == 1, f'a tab answers once ({h})')
        # the press shows: a tab dims while the finger is on it
        tab = pg.locator('.tabbar button:has-text("Полка")')
        box = await tab.bounding_box()
        await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); await pg.mouse.down(); await pg.wait_for_timeout(60)
        op = await tab.evaluate('e => getComputedStyle(e).opacity')
        await pg.mouse.up(); await pg.wait_for_timeout(300)
        check(float(op) < 0.9, f'a pressed tab dims ({op})')
        # a plain row: the light tap
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(400); await H()
        link = pg.locator('.link-btn:visible').first
        if await link.count():
            await link.click(); await pg.wait_for_timeout(300)
            h = await H(); check(len(h) == 1, f'a link button answers once ({h})')
            await pg.go_back(); await pg.wait_for_timeout(300)
        # a button with no vibration of its own gets the light tap
        await pg.evaluate("() => { const b = document.createElement('button'); b.id = 'plain'; b.textContent = 'x'; b.style.cssText = 'position:fixed;top:60px;left:10px;z-index:99999'; document.body.appendChild(b); }")
        await H(); await pg.click('#plain'); await pg.wait_for_timeout(100)
        check(await H() == ['impact:light'], 'a plain button answers with a light tap')
        await pg.evaluate("() => { const b = document.getElementById('plain'); b.disabled = true; }")
        await pg.click('#plain', force=True); await pg.wait_for_timeout(100)
        check(await H() == [], 'a disabled button does not')
        await pg.evaluate("() => document.getElementById('plain').remove()")
        # a button that vibrates by itself: only its own vibration
        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(300); await H()
        await pg.locator('.method-card:visible').first.click(); await pg.wait_for_timeout(300)
        if await pg.locator('.recipe-tile:visible').count(): await pg.locator('.recipe-tile:visible').first.click(); await pg.wait_for_timeout(300)
        await H()
        await pg.locator('button:has-text("Начать"):visible').click(); await pg.wait_for_timeout(200); await H()
        await pg.locator('button:has-text("Старт"):visible').click(); await pg.wait_for_timeout(200)
        h = await H()
        check(len(h) == 1, f'a button with its own vibration is not doubled ({h})')
        # the page's scrollbar ends above the bar at the bottom
        await pg.locator('button:has-text("Стоп"), button:has-text("Пауза")').first.click() if await pg.locator('button:has-text("Пауза"):visible').count() else None
        bar = await pg.evaluate("() => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bottom-bar'))")
        check(bar > 40, f'the scrollbar is told the height of the bottom bar ({bar}px)')
        # the icons of a new method lie in a grid (a style of the card's icon picker once squeezed them into one cell)
        pg2, _ = await page(b, init=TG, phone=True, db=db); pg = pg2; await pg.wait_for_timeout(1200)
        await pg.locator('[aria-label="Свой метод"]:visible').first.click(); await pg.wait_for_timeout(500)
        g = await pg.locator('.method-icon-pick').bounding_box()
        rows = await pg.evaluate("() => new Set([...document.querySelectorAll('.method-icon-pick button')].map((b) => Math.round(b.getBoundingClientRect().top))).size")
        check(g and g['width'] > 300 and 2 <= rows <= 4, f'new method: the icons lie in a grid ({rows} rows, {g and round(g["width"])} px wide)')
        # «Заварить» wears the method brewed last
        vb = lambda: pg.evaluate("() => document.querySelector('.tabbar button svg').getAttribute('viewBox')")
        pg, _ = await page(b, init=TG, phone=True, db=db); await pg.wait_for_timeout(1000)
        check(await vb() == '0 0 24 24', 'no brews yet: the plain brewing icon')
        import time as _t
        db2 = {**db, 'brews': [{'id': 'b1', 'methodId': 'cezve', 'date': int(_t.time() * 1000), 'dose': 10, 'water': 100, 'temp': 0, 'grind': '', 'time': 120, 'rating': 0, 'notes': ''}]}
        pg, _ = await page(b, init=TG, phone=True, db=db2); await pg.wait_for_timeout(1000)
        check(await vb() == '0 0 32 32', 'after a brew: the icon of its method')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
