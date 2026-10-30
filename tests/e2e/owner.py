"""Scans against the catalog (mocked server) and the owner's roaster sites section."""
import asyncio, json
from common import async_playwright, check, done, local, page

LOT = {'source': 'catalog', 'id': 'a1', 'confirms': 0, 'state': 'out', 'link': 'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas',
       'coffee': {'name': 'Бразилия Игуасу', 'roaster': 'Tasty Coffee', 'country': 'Бразилия', 'process': 'Натуральная', 'roastLevel': 'Светлая', 'dripOptions': [10, 30, 50]}}
SITES = [
    {'host': 'shop.tastycoffee.ru', 'roaster': 'Tasty Coffee', 'status': 'approved', 'added': 0, 'requests': 0, 'sample': None, 'crawled': 1793300000000, 'crawling': False, 'pages': {'ok': 120, 'queued': 30}, 'lots': {'active': 100, 'gone': 20}},
    {'host': 'newroaster.ru', 'roaster': '', 'status': 'pending', 'added': 0, 'requests': 3, 'sample': 'https://newroaster.ru/coffee/kenya', 'crawled': None, 'crawling': False, 'pages': {}, 'lots': {}},
]
TG = """window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 111, first_name: 'Owner', username: 'owner' } },
  version: '6.0', platform: 'tdesktop', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 6.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {},
  BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
  MainButton: { hide() {} }, SettingsButton: { hide() {} } } };"""

async def mock(pg, admin_log=None):
    async def handle(route):
        u = route.request.url
        if '/lookup' in u: body = LOT if 'tastycoffee' in u else {'source': 'none', 'pending': True}
        elif '/admin' in u:
            req = json.loads(route.request.post_data or '{}')
            if admin_log is not None: admin_log.append(req)
            if req.get('action') == 'approve': SITES[1].update(status='approved', roaster=req.get('roaster') or '')
            body = {'sites': SITES}
        else: return await route.continue_()
        await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    await pg.route('**/*', handle)

async def scan(pg, url):
    await pg.fill('#bean-barcode', url)
    await pg.evaluate("document.querySelector('#bean-barcode').blur()"); await pg.wait_for_timeout(500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b)
        await mock(pg)
        V = lambda s: pg.locator(s + ':visible')
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(300)
        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        check(await V('button:has-text("каталог")').count() == 0, 'no catalog browsing in the app')
        await scan(pg, 'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas?back=%2Fcoffee')
        check(await pg.input_value('#bean-name') == 'Бразилия Игуасу', 'a scan of a known lot fills the pack from the catalog')
        status = await V('.status').inner_text()
        check('общий каталог' in status and 'наличи' not in status, f'status names the catalog, no stock info ({status[:60]}…)')
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(300)
        bean = next(x for x in (await local(pg))['beans'] if x['name'] == 'Бразилия Игуасу')
        check(bean.get('catalogId') == 'a1', 'pack keeps the lot id')

        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await V('.segmented button:has-text("Дрип-пакеты")').first.click(); await pg.wait_for_timeout(200)
        await scan(pg, 'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas')
        check(await pg.input_value('#bean-drip-count') == '10', 'drip box from a lot sold as beans and drips takes the smallest box')
        await V('[aria-label="Назад"]').click(); await pg.wait_for_timeout(200)
        if await V('.dialog button').count(): await V('.dialog button').last.click()
        await pg.wait_for_timeout(300)

        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await scan(pg, 'https://newroaster.ru/coffee/kenya')
        check('пока не подключён' in await V('.status').inner_text(), 'a site that is not connected yet: fill in manually')
        check(not errors, f'no page errors: {errors[:3]}')

        log = []
        pg2, errors2 = await page(b, init=TG)
        await mock(pg2, log)
        await pg2.click('.tabbar >> text=Профиль'); await pg2.wait_for_timeout(600)
        sec = pg2.locator('.section:has(h2:text("Сайты обжарщиков"))')
        check(await sec.count() == 1, 'owner sees the roaster sites section')
        check(await pg2.locator('.row:has-text("Ваш Telegram ID")').count() == 1, 'Telegram ID row')
        await sec.locator('.row:has-text("newroaster.ru")').click(); await pg2.wait_for_timeout(200)
        await pg2.fill('#site-name-newroaster\\.ru', 'Новый обжарщик')
        await sec.locator('button:has-text("Подключить")').click(); await pg2.wait_for_timeout(400)
        check(any(x.get('action') == 'approve' and x.get('host') == 'newroaster.ru' and x.get('roaster') == 'Новый обжарщик' for x in log), 'approve request sent with the roaster name')
        check(not errors2, f'no page errors in Telegram mode: {errors2[:3]}')
        await b.close()
    done()

asyncio.run(main())
