"""Profile card: themes, metal themes unlocked by achievements, diamond tilt, sharing a card and opening a shared one."""
import asyncio, json, time
from common import OUT, async_playwright, check, done, local, page

def card(theme, **kw):
    return {'v': 1, 'name': 'Аня Кофеман', 'username': 'anya_brews', 'about': 'Пуроверы по утрам, эспрессо по выходным',
            'badges': [{'kind': 'sca', 'title': 'SCA Brewing', 'detail': 'Professional', 'year': '2025'}, {'kind': 'achieve', 'title': 'V60 · 100 заварок', 'detail': 'Бронза', 'year': ''}],
            'setup': [{'cat': 'grinder', 'name': 'Comandante C40'}, {'cat': 'dripper', 'name': 'Hario V60 02'}, {'cat': 'kettle', 'name': 'Fellow Stagg EKG'}, {'cat': 'scale', 'name': 'Acaia Pearl'}],
            'theme': theme, **kw}

CARDS = {
    'silver1': card({'tier': 'silver', 'icon': 'aeropress', 'title': 'Аэропресс · 1 000 заварок'}),
    'gold1': card({'tier': 'gold', 'icon': 'espresso', 'title': 'Эспрессо · 10 000 заварок'}),
    'diamond1': card({'tier': 'diamond', 'icon': 'drop', 'title': '10 000 литров кофе'}),
    'espresso1': card({'base': 'espresso'}),
}
TG = """window.__shared = [];
window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 111, first_name: 'Аня', username: 'anya_brews' } },
  version: '6.0', platform: 'ios', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 6.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {}, openTelegramLink(u) { window.__shared.push(u); }, openLink(u) { window.__shared.push(u); },
  BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} } } };"""

def brews(method, n):
    now = 1792900000000
    return [{'id': f'{method}{i}', 'date': now - i * 3600000, 'methodId': method, 'beanId': None, 'dose': 15, 'water': 250, 'temp': 93,
             'grind': '', 'time': 180, 'rating': 4, 'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3}, 'descriptors': [], 'notes': '', 'cupping': None} for i in range(n)]

DB = {'v': 1, 'beans': [], 'recipes': {}, 'seeded': True, 'gearSeeded': True, 'brews': brews('v60', 100) + brews('kalita', 100),
      'gear': [{'id': 'g1', 'cat': 'grinder', 'name': 'Comandante C40', 'details': ''}, {'id': 'g2', 'cat': 'dripper', 'name': 'Hario V60 02', 'details': ''},
               {'id': 'g3', 'cat': 'kettle', 'name': 'Fellow Stagg EKG', 'details': ''}, {'id': 'g4', 'cat': 'filter', 'name': 'Cafec Abaca', 'details': ''}],
      'profile': {'name': 'Аня Кофеман', 'about': 'Пуроверы по утрам', 'telegram': 'anya_brews', 'badges': [], 'shareTelegram': True, 'shareBadges': True}}

async def mock(pg, posted):
    async def handle(route):
        u = route.request.url
        if route.request.method == 'POST' and u.endswith('/cards'):
            posted.append(json.loads(route.request.post_data)['card'])
            return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'id': 'abcDEF2345'}))
        for k, c in CARDS.items():
            if u.endswith(f'/cards/{k}'):
                return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'card': c}))
        if '/stats' in u or '/share' in u: return await route.fulfill(status=404, body='{}')
        await route.continue_()
    await pg.route('**/*', handle)

async def tilt(pg, beta, gamma):
    await pg.evaluate(f"window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {{ beta: {beta}, gamma: {gamma}, alpha: 0 }}))")

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        posted = []
        pg, errors = await page(b, db=DB, init=TG)
        await mock(pg, posted)
        V = lambda s: pg.locator(s + ':visible')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(500)
        check(await pg.get_attribute('#profile-about', 'placeholder') == 'Пара слов о себе', 'about placeholder')
        check(await V('.pcard').count() == 1, 'profile shows the card')
        await V('button:has-text("Настроить и поделиться")').click(); await pg.wait_for_timeout(500)
        sw = await V('.theme-pick').all_inner_texts()
        check(any('Бронза' in s and 'V60' in s for s in sw), f'bronze V60 theme unlocked ({[s for s in sw if "Бронза" in s]})')
        check(any('Kalita' in s for s in sw), 'achievement of the retired Kalita method is kept')
        check(not any('Серебро' in s for s in sw), 'silver is not offered without the achievement')
        chips = await V('.chips .chip').all_inner_texts()
        check('Cafec Abaca' not in chips, 'retired filter gear is not offered for the card')
        await V('.theme-pick:has-text("V60")').click(); await pg.wait_for_timeout(300)
        check(await V('.pcard.tier-bronze .pcard-corner').count() == 1, 'bronze card with the method icon in the corner')
        await V('.chips .chip:has-text("Fellow Stagg EKG")').click(); await pg.wait_for_timeout(1500)
        check(posted and posted[-1]['theme'].get('tier') == 'bronze' and [g['name'] for g in posted[-1]['setup']] == ['Comandante C40', 'Hario V60 02'], f'card stored with theme and chosen setup ({posted[-1]["setup"] if posted else None})')
        await pg.screenshot(path=str(OUT / 'card-edit-bronze.png'))
        await V('.theme-picks').scroll_into_view_if_needed(); await V('.theme-picks').screenshot(path=str(OUT / 'card-themes.png'))
        btn = V('.footer button:has-text("Поделиться профилем")')
        check(await btn.is_enabled(), 'share button ready')
        await btn.click(); await pg.wait_for_timeout(400)
        shared = await pg.evaluate('window.__shared')
        check(any('startapp%3Dp' in s or 'startapp=p' in s or '%23r%3Dp' in s for s in shared), f'share opens Telegram with the card link ({shared[:1]})')
        for t in ('espresso', 'latte', 'ocean'):
            await V(f'.theme-pick:has-text("{ {"espresso": "Эспрессо", "latte": "Латте", "ocean": "Океан"}[t] }")').click(); await pg.wait_for_timeout(200)
            await pg.evaluate('window.scrollTo(0, 0)'); await pg.wait_for_timeout(150)
            await V('.pcard').first.screenshot(path=str(OUT / f'card-{t}.png'))
        check(not errors, f'no page errors: {errors[:3]}')

        # shared cards: silver, gold, diamond (light and dark), espresso
        for dark in (False, True):
            for k in CARDS:
                if dark and k != 'diamond1': continue
                pv, err = await page(b, init=f"location.hash = '#r=p{k}';", dark=dark)
                await mock(pv, [])
                await pv.reload(); await pv.wait_for_timeout(900)
                check(await pv.locator('.pcard:visible').count() == 1, f'shared card {k} opens{" (dark)" if dark else ""}')
                if k == 'diamond1':
                    for i, (be, ga) in enumerate([(0, 0), (8, -18), (-10, 20)]):
                        await tilt(pv, 0, 0); await pv.wait_for_timeout(50)
                        await tilt(pv, be, ga); await pv.wait_for_timeout(700)
                        await pv.locator('.pcard:visible').screenshot(path=str(OUT / f'card-diamond{"-dark" if dark else ""}-{i}.png'))
                    tr = await pv.locator('.pcard:visible').evaluate('e => e.style.transform')
                    check('rotateY' in tr and 'rotateY(0' not in tr, f'diamond turns with the tilt ({tr})')
                else:
                    await pv.locator('.pcard:visible').screenshot(path=str(OUT / f'card-{k}.png'))
                check(not err, f'no page errors on {k}: {err[:2]}')
        await b.close()
    done()

asyncio.run(main())
