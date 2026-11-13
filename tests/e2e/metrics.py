"""Owner metrics (mocked server) and the anonymous counters the app sends."""
import asyncio, json
from common import async_playwright, check, done, page
TG = """window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 111, first_name: 'Owner', username: 'owner' } },
  version: '6.0', platform: 'tdesktop', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 6.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {},
  BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
  MainButton: { hide() {} }, SettingsButton: { hide() {} } } };"""

DAYS = [{'day': f'2026-10-{d:02d}', 'active': d % 7, 'brews': d % 9} for d in range(5, 32)] + [{'day': f'2026-11-0{d}', 'active': 4, 'brews': 6} for d in range(1, 4)]
METRICS = {'at': 1, 'users': {'total': 42, 'new7': 5, 'new30': 17, 'seen1': 6, 'seen7': 19, 'seen30': 33, 'brewing7': 12, 'brewing30': 25, 'back': {'of': 10, 'n': 4}},
           'brews': {'total': 900, 'd7': 80, 'd30': 310, 'liters30': 61.5, 'perActive30': 12.4,
                     'methods': [{'id': 'v60', 'all': 500, 'd30': 150}, {'id': 'drip', 'all': 200, 'd30': 90}, {'id': 'aeropress', 'all': 200, 'd30': 70}]},
           'days': DAYS, 'features': {'timer.start': 120, 'timer.skip': 15, 'recipe.drip': 4}, 'extra': {'cards': 9, 'reminders30': 3, 'rare': 2}}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, init=TG, phone=True)
        sent = []
        pushed = []
        slow = {'on': False}
        async def handle(route):
            u = route.request.url
            req = json.loads(route.request.post_data or '{}')
            if '/track' in u: sent.append(req); body = {'counted': 1}
            elif '/brews' in u: pushed.append((asyncio.get_event_loop().time(), req)); body = {'account': 'a', 'methods': {}, 'liters': 0, 'ratings': 0, 'at': 1}
            elif '/admin' in u:
                body = METRICS if req.get('action') == 'metrics' else {'sites': [], 'grants': [], 'checks': []}
                if slow['on'] and req.get('action') == 'metrics': await asyncio.sleep(1.2)
            else: body = {}
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
        await pg.route('**/brewbook-ratings.brewbook.workers.dev/**', handle)
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(800)
        await pg.locator('.role-panel.role-owner .role-panel-head').click(); await pg.wait_for_timeout(500)
        txt = await pg.locator('.metric-tiles').first.inner_text()
        check('42' in txt and 'человек всего' in txt and '+5 за неделю' in txt, f'people: {txt[:80]!r}')
        check('40%' in txt and 'возвращаются' in txt, 'share of people who come back')
        check(await pg.locator('.metric-day').count() == 30, '30 days drawn')
        methods = await pg.locator('.metric-list').first.inner_text()
        check(methods.index('V60') < methods.index('Дрип'), f'methods by use: {methods[:60]!r}')
        feats = await pg.locator('.metric-list').nth(1).inner_text()
        check('Запуск таймера' in feats and '120' in feats, 'feature counters')
        await pg.locator('.metric-tiles').first.scroll_into_view_if_needed()
        await pg.locator('.section:has(.metric-tiles)').first.screenshot(path='out/metrics.png')

        # «Обновить» shows it is working, then that it is done
        slow['on'] = True
        btn = pg.locator('.metric-reload')
        await btn.click(); await pg.wait_for_timeout(300)
        busy = [await btn.inner_text(), await btn.is_disabled(), await pg.locator('.metric-body.stale').count(),
                await pg.evaluate("() => getComputedStyle(document.querySelector('.metric-reload svg')).animationName")]
        check(busy[0].strip() == 'Обновляем…' and busy[1] and busy[2] == 1 and busy[3] != 'none', f'while it asks: the arrow turns, the numbers dim {busy}')
        await pg.locator('.section:has(.metric-tiles)').first.screenshot(path='out/metrics-loading.png')
        await pg.wait_for_timeout(1300)
        done_ = [await btn.inner_text(), await pg.locator('.metric-body.stale').count()]
        check(done_[0].strip() == 'Обновлено' and done_[1] == 0, f'then «Обновлено» and the numbers are back {done_}')
        await pg.wait_for_timeout(2700)
        check((await btn.inner_text()).strip() == 'Обновить', 'and the button is back to «Обновить»')

        # counters: the app sends only names and numbers
        await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(300)
        await pg.locator('.method-card:visible').first.click(); await pg.wait_for_timeout(300)
        if await pg.locator('.recipe-tile:visible').count(): await pg.locator('.recipe-tile:visible').first.click(); await pg.wait_for_timeout(300)
        await pg.locator('button:has-text("Начать"):visible').click(); await pg.wait_for_timeout(200)
        await pg.locator('button:has-text("Старт"):visible').click(); await pg.wait_for_timeout(300)
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        await pg.evaluate("Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(800)
        check(sent and sent[-1]['events'].get('timer.start') == 1, f'starting the timer is counted: {sent}')
        check(sent and set(sent[-1].keys()) == {'initData', 'events'}, 'nothing but the counters goes with them')
        check(not errors, f'no page errors {errors}')

        # a brew saved and the app closed at once: it goes to the server on leaving, not on the next start
        pg2, err2 = await page(b, init=TG, phone=True)
        await pg2.route('**/brewbook-ratings.brewbook.workers.dev/**', handle)
        await pg2.wait_for_timeout(3500)  # the start-up sync has gone by
        pushed.clear()
        await pg2.locator('.method-card:visible').first.click(); await pg2.wait_for_timeout(300)
        if await pg2.locator('.recipe-tile:visible').count(): await pg2.locator('.recipe-tile:visible').first.click(); await pg2.wait_for_timeout(300)
        await pg2.locator('button:has-text("Без таймера"):visible').click(); await pg2.wait_for_timeout(400)
        await pg2.locator('.footer:visible .btn-primary').click(); await pg2.wait_for_timeout(200)
        await pg2.evaluate("Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
        await pg2.wait_for_timeout(600)
        ids = await pg2.evaluate("() => JSON.parse(localStorage.getItem('brewbook.db.v1') || '{}').brews?.map((x) => x.id) ?? []")
        got = [x for _, r in pushed for x in r.get('brews', [])]
        check(got and got[-1]['id'] in ids, f'leaving within 2.5 s still sends the new brew ({len(pushed)} request(s))')
        await b.close()
    done()

asyncio.run(main())
