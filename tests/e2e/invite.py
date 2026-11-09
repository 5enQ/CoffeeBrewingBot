"""The tester role is offered: on the first start the person agrees or declines; declining leaves the role out."""
import asyncio, json
from common import async_playwright, check, done, page

TG = """window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A444%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 444, first_name: 'Owner', username: 'owner' } },
  version: '6.0', platform: 'tdesktop', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 6.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {},
  BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
  MainButton: { hide() {} }, SettingsButton: { hide() {} } } };"""

STATS = {'account': 'acc', 'at': 1, 'methods': {}, 'liters': 0, 'ratings': 0, 'grants': [], 'invites': ['beta']}

async def run(b, answer):
    # the owner used this phone before, with another Telegram account (the mark of 1.7.0 and earlier)
    pg, errors = await page(b, init=TG + "\ntry { localStorage.setItem('brewbook.owner', '1'); } catch (e) {}", phone=True)
    sent = []
    async def handle(route):
        u = route.request.url
        req = json.loads(route.request.post_data or '{}')
        if '/invite' in u:
            sent.append(req)
            body = {**STATS, 'invites': [], 'grants': ['beta'] if req.get('answer') == 'accept' else []}
        elif '/admin' in u: await route.fulfill(status=403, content_type='application/json', body='{"error":"forbidden"}'); return
        elif '/me' in u or '/brews' in u: body = STATS
        else: body = {}
        await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    await pg.route('**/brewbook-ratings.brewbook.workers.dev/**', handle)
    await pg.wait_for_timeout(3500)
    dlg = pg.locator('.dialog.invite')
    check(await dlg.count() == 1 and 'пригласили в тестировщики' in await dlg.inner_text(), f'{answer}: the invitation is shown on start')
    check('дополнительные данные' in await dlg.inner_text(), f'{answer}: it says more data will be collected')
    if answer == 'accept': await pg.screenshot(path='out/invite.png')
    await dlg.locator('button:has-text("%s")' % ('Согласиться' if answer == 'accept' else 'Отказаться')).click(); await pg.wait_for_timeout(500)
    check(sent and sent[-1].get('answer') == answer and sent[-1].get('what') == 'beta', f'{answer}: the answer goes to the server')
    check(await dlg.count() == 0, f'{answer}: the invitation closes')
    await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(500)
    check(await pg.locator('.role-panel.role-owner').count() == 0, f'{answer}: no owner panel for another account on the owner\'s phone')
    has = await pg.locator('.role-panel.role-tester').count()
    check(has == (1 if answer == 'accept' else 0), f'{answer}: the tester panel is {"there" if answer == "accept" else "not there"}')
    check(not errors, f'no page errors {errors}')
    await pg.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await run(b, 'decline')
        await run(b, 'accept')
        await b.close()
    done()

asyncio.run(main())
