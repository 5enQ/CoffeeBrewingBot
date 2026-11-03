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
        async def handle(route):
            u = route.request.url
            req = json.loads(route.request.post_data or '{}')
            if '/track' in u: sent.append(req); body = {'counted': 1}
            elif '/admin' in u: body = METRICS if req.get('action') == 'metrics' else {'sites': [], 'grants': [], 'checks': []}
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
        await b.close()
    done()

asyncio.run(main())
