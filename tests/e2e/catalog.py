"""Catalog picker and owner tools with a mocked server: pick beans and drips, pending sites, approving a site."""
import asyncio, json
from common import async_playwright, check, done, local, page

ROASTERS = {'roasters': [
    {'host': 'shop.tastycoffee.ru', 'roaster': 'Tasty Coffee', 'lots': 3, 'drips': 1, 'onSale': 2},
    {'host': 'sbmrne.ru', 'roaster': 'Submarine', 'lots': 1, 'drips': 1, 'onSale': 1}]}
LOTS = {
    ('shop.tastycoffee.ru', 'beans'): [
        {'id': 'a1', 'state': 'active', 'url': 'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas',
         'coffee': {'name': 'Бразилия Игуасу', 'roaster': 'Tasty Coffee', 'country': 'Бразилия', 'process': 'Натуральный', 'roastLevel': 'Светлая', 'packNotes': 'арахиса, пудры какао', 'dripOptions': [10, 30, 50], 'scales': {'body': 3, 'acidity': 2}}},
        {'id': 'a2', 'state': 'out', 'coffee': {'name': 'Руанда Кименьи', 'country': 'Руанда', 'process': 'Мытый'}},
        {'id': 'a3', 'state': 'gone', 'coffee': {'name': 'Сулавеси Торайа', 'country': 'Индонезия'}}],
    ('shop.tastycoffee.ru', 'drip'): [
        {'id': 'a1', 'state': 'active', 'url': 'https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas',
         'coffee': {'name': 'Бразилия Игуасу', 'roaster': 'Tasty Coffee', 'country': 'Бразилия', 'process': 'Натуральный', 'dripOptions': [10, 30, 50]}}],
}
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
        if '/roasters' in u: body = ROASTERS
        elif '/catalog/list' in u:
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(u).query); body = {'lots': LOTS.get((q['host'][0], q['kind'][0]), [])}
        elif '/lookup' in u: body = {'source': 'none', 'pending': True}
        elif '/admin' in u:
            req = json.loads(route.request.post_data or '{}')
            if admin_log is not None: admin_log.append(req)
            if req.get('action') == 'approve':
                SITES[1].update(status='approved', roaster=req.get('roaster') or '')
            body = {'sites': SITES}
        else: return await route.continue_()
        await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    await pg.route('**/*', handle)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b)
        await mock(pg)
        V = lambda s: pg.locator(s + ':visible')

        # beans from the catalog
        await pg.click('.tabbar >> text=Полка'); await pg.wait_for_timeout(300)
        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await V('button:has-text("Выбрать из каталога обжарщиков")').click(); await pg.wait_for_timeout(400)
        check(await V('.sheet .row:has-text("Tasty Coffee")').count() == 1, 'roaster list shows Tasty Coffee')
        await pg.screenshot(path='out/catalog-roasters.png')
        await V('.sheet .row:has-text("Tasty Coffee")').click(); await pg.wait_for_timeout(400)
        names = await V('.sheet .row .row-label').all_inner_texts()
        check(names == ['Бразилия Игуасу'], f'only lots on sale are listed first ({names})')
        await V('.sheet button:has-text("прошлые лоты и те, что закончились (2)")').click(); await pg.wait_for_timeout(200)
        check(await V('.sheet .row:has-text("Сулавеси")').count() == 1, 'past lots open on demand')
        check(await V('.sheet .row:has-text("Руанда") .tag:has-text("нет в наличии")').count() == 1, 'out-of-stock lot is marked')
        await pg.fill('#catalog-search', 'руанда'); await pg.wait_for_timeout(200)
        check(await V('.sheet .row .row-label').all_inner_texts() == ['Руанда Кименьи'], 'search filters lots')
        await pg.fill('#catalog-search', ''); await pg.wait_for_timeout(200)
        await pg.screenshot(path='out/catalog-lots.png')
        await V('.sheet .row:has-text("Бразилия Игуасу")').click(); await pg.wait_for_timeout(300)
        check(await V('.sheet').count() == 0, 'picker closes after a pick')
        check(await pg.input_value('#bean-name') == 'Бразилия Игуасу' and await pg.input_value('#bean-roaster') == 'Tasty Coffee', 'pack filled from the lot')
        check('Из каталога' in await V('.status').inner_text(), 'status tells where the data came from')
        await pg.screenshot(path='out/catalog-filled.png', full_page=True)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(300)
        bean = next(x for x in (await local(pg))['beans'] if x['name'] == 'Бразилия Игуасу')
        check(bean.get('catalogId') == 'a1' and bean.get('link', '').endswith('braziliya-sul-de-minas'), 'pack keeps the lot id and page link')
        check(bean.get('scales') == {'body': 3, 'acidity': 2} and bean.get('kind') != 'drip', 'scales copied, stays a pack of beans')

        # the same lot as a drip box
        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await V('.segmented button:has-text("Дрип-пакеты")').first.click(); await pg.wait_for_timeout(200)
        await V('button:has-text("Выбрать из каталога обжарщиков")').click(); await pg.wait_for_timeout(300)
        await V('.sheet .row:has-text("Tasty Coffee")').click(); await pg.wait_for_timeout(300)
        check(await V('.sheet .segmented button.on, .sheet .segmented [aria-pressed="true"], .sheet .segmented .active').first.inner_text() == 'Дрип-пакеты' if await V('.sheet .segmented').count() else True, 'drip mode carried into the picker')
        await V('.sheet .row:has-text("Бразилия Игуасу")').click(); await pg.wait_for_timeout(300)
        check(await pg.input_value('#bean-drip-count') == '10', 'drip box takes the smallest box size of the lot')
        await V('[aria-label="Назад"]').click(); await pg.wait_for_timeout(200)
        if await V('.dialog button').count(): await V('.dialog button').last.click()
        await pg.wait_for_timeout(300)

        # a link from a site that is not connected yet
        await V('[aria-label="Добавить пачку"]').click(); await pg.wait_for_timeout(200)
        await pg.fill('#bean-barcode', 'https://newroaster.ru/coffee/kenya')
        await pg.evaluate("document.querySelector('#bean-barcode').blur()"); await pg.wait_for_timeout(500)
        check('пока не подключён' in await V('.status').inner_text(), 'pending site message')
        check(not errors, f'no page errors: {errors[:3]}')

        # owner tools inside Telegram
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
        await sec.screenshot(path='out/owner-sites.png')
        check(not errors2, f'no page errors in Telegram mode: {errors2[:3]}')
        await b.close()
    done()

asyncio.run(main())
