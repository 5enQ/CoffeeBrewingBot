"""Profile card: themes, metal themes unlocked by achievements, diamond tilt, sharing a card and opening a shared one."""
import asyncio, json, time
from common import OUT, async_playwright, check, done, local, page

def card(theme, earned=None, **kw):
    return {'v': 2, 'ach': ['method:v60'], 'earned': {'method:v60': {'tier': 'bronze', 'at': 50}, **(earned or {})}, 'name': 'Аня Кофеман', 'username': 'anya_brews', 'about': 'Пуроверы по утрам, эспрессо по выходным',
            'badges': [{'kind': 'sca', 'title': 'SCA Brewing', 'detail': 'Professional', 'year': '2025'}],
            'setup': [{'cat': 'grinder', 'name': 'Comandante C40'}, {'cat': 'dripper', 'name': 'Hario V60 02'}, {'cat': 'kettle', 'name': 'Fellow Stagg EKG'}, {'cat': 'scale', 'name': 'Acaia Pearl'}],
            'theme': theme, **kw}

CARDS = {
    'silver1': card({'ach': 'method:aeropress'}, {'method:aeropress': {'tier': 'silver', 'at': 100}}),
    'gold1': card({'ach': 'method:espresso'}, {'method:espresso': {'tier': 'gold', 'at': 500}}),
    'diamond1': card({'ach': 'liters'}, {'liters': {'tier': 'diamond', 'at': 1000}}, no=7),
    'diamond0': card({'ach': 'liters'}, {'liters': {'tier': 'diamond', 'at': 1000}}, no=0),
    'volume1': card({'ach': 'method:aeropress'}, {'method:aeropress': {'tier': 'volume', 'at': 1000}}),
    'espresso1': card({'base': 'espresso'}),
    'dev1': {**card({'special': 'dev'}), 'granted': ['dev']},
    'devfake': {**card({'special': 'dev'}), 'granted': []},
    # a card whose owner faked a background: no levels from the server → plain card
    'fake1': {**card({'ach': 'method:espresso'}), 'earned': {}},
}
# what the server counted (it differs from the device on purpose: the app must show the server's numbers)
SERVER = {'account': 'acc1', 'methods': {'v60': 60, 'kalita': 100}, 'liters': 40, 'ratings': 0, 'at': 1}
TG = """window.__shared = [];
window.Telegram = { WebApp: {
  initData: 'query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc', initDataUnsafe: { user: { id: 111, first_name: 'Аня', username: 'anya_brews' } },
  version: '6.0', platform: 'ios', colorScheme: 'light', themeParams: {}, isVersionAtLeast: (v) => parseFloat(v) <= 6.0,
  ready() {}, expand() {}, onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
  enableClosingConfirmation() {}, disableClosingConfirmation() {}, disableVerticalSwipes() {}, openTelegramLink(u) { window.__shared.push(u); }, openLink(u) { window.__shared.push(u); },
  BackButton: { show() {}, hide() {}, onClick(cb) { window.__tgBack = cb; }, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} } } };"""

def brews(method, n):
    now = 1792900000000
    return [{'id': f'{method}{i}', 'date': now - i * 86400000, 'methodId': method, 'beanId': None, 'dose': 15, 'water': 250, 'temp': 93,
             'grind': '', 'time': 180, 'rating': 4, 'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3}, 'descriptors': [], 'notes': '', 'cupping': None} for i in range(n)]

DB = {'v': 1, 'beans': [], 'recipes': {}, 'seeded': True, 'gearSeeded': True, 'brews': brews('v60', 100) + brews('kalita', 100),
      'gear': [{'id': 'g1', 'cat': 'grinder', 'name': 'Comandante C40', 'details': ''}, {'id': 'g2', 'cat': 'dripper', 'name': 'Hario V60 02', 'details': ''},
               {'id': 'g3', 'cat': 'kettle', 'name': 'Fellow Stagg EKG', 'details': ''}, {'id': 'g4', 'cat': 'filter', 'name': 'Cafec Abaca', 'details': ''}],
      'profile': {'name': 'Аня Кофеман', 'about': 'Пуроверы по утрам', 'telegram': 'anya_brews', 'badges': [], 'shareTelegram': True, 'shareBadges': True}}

async def mock(pg, posted, sent=None):
    async def handle(route):
        u = route.request.url
        if route.request.method == 'POST' and (u.endswith('/me') or u.endswith('/brews')):
            if sent is not None and u.endswith('/brews'): sent.extend(json.loads(route.request.post_data)['brews'])
            return await route.fulfill(status=200, content_type='application/json', body=json.dumps(SERVER))
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
        posted, sent = [], []
        pg, errors = await page(b, db=DB, init=TG)
        await mock(pg, posted, sent)
        await pg.reload(); await pg.wait_for_timeout(3500)
        check(len(sent) == 200, f'the whole brew history is sent once to the server ({len(sent)})')
        check(set(sent[0]) == {'id', 'm', 'w', 't'}, f'only method, water and date leave the device ({sorted(sent[0])})')
        V = lambda s: pg.locator(s + ':visible')
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(500)
        check(await V('.pcard').count() == 1 and await V('.my-card-actions button').all_inner_texts() == ['Поделиться', 'Настроить'], 'Profile opens with the card and two buttons')
        check('@anya_brews' in await V('.pcard').inner_text(), 'own card shows the Telegram username')
        await pg.screenshot(path=str(OUT / 'profile-card.png'))
        await V('.my-card-actions button:has-text("Настроить")').click(); await pg.wait_for_timeout(500)
        check(await V('.topbar h1').inner_text() == 'Настроить профиль', 'settings screen')
        check(await pg.get_attribute('#profile-about', 'placeholder') == 'Пара слов о себе', 'about placeholder')
        await pg.fill('#profile-name', 'Аня К.'); await pg.wait_for_timeout(200)
        check('Аня К.' in await V('.pcard').inner_text(), 'the card updates while editing')
        sections = await V('.section h2').all_inner_texts()
        check(all(x in [t.lower() for t in sections] for x in ('о себе', 'значки', 'фон', 'сетап')), f'settings cover everything on the card ({sections})')
        check(await V('#card-tg').count() == 0, 'the Telegram link choice is not in settings')
        sw = await V('.theme-pick').all_inner_texts()
        tiles = [s.split('\n')[0] for s in sw if '\n' in s or s in ('Бронза', 'Серебро')]
        check('Бронза' in tiles and 'Серебро' in tiles, f'levels follow the server count: V60 60 → bronze, Kalita 100 → silver ({tiles})')
        await V('.theme-pick:has-text("Бронза")').click(); await pg.wait_for_timeout(300)
        chips = await V('.chips .chip').all_inner_texts()
        check('Cafec Abaca' not in chips, 'retired filter gear is not offered for the card')

        check(await V('.pcard.tier-bronze .pcard-corner').count() == 1, 'bronze V60 card with the method icon in the corner')
        await V('.chips .chip:has-text("Fellow Stagg EKG")').click(); await pg.wait_for_timeout(2500)
        check(posted and posted[-1]['theme'] == {'ach': 'method:v60'} and posted[-1]['name'] == 'Аня К.' and 'earned' not in posted[-1] and 'no' not in posted[-1] and [g['name'] for g in posted[-1]['setup']] == ['Comandante C40', 'Hario V60 02'], f'edits in settings update the stored card (name, theme, setup) ({posted[-1]["setup"] if posted else None})')
        await pg.screenshot(path=str(OUT / 'card-edit.png'))
        await V('.theme-picks').scroll_into_view_if_needed(); await V('.theme-picks').screenshot(path=str(OUT / 'card-themes.png'))
        await pg.evaluate('window.__tgBack()'); await pg.wait_for_timeout(400)
        await V('.my-card-actions button:has-text("Поделиться")').click(); await pg.wait_for_timeout(1200)
        check(await V('.topbar h1').inner_text() == 'Поделиться профилем', 'share screen')
        check(await V('.toggle-row').count() == 1 and await V('#card-tg').count() == 1, 'share screen has only the Telegram link choice')
        await pg.locator('label[for="card-tg"]').click(); await pg.wait_for_timeout(300)
        check('@anya_brews' not in await V('.pcard').inner_text(), 'without the link the shared card hides the username')
        await pg.wait_for_timeout(800)
        check(posted and 'username' not in posted[-1], 'stored card follows the choice')
        await pg.locator('label[for="card-tg"]').click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(OUT / 'card-share.png'))
        btn = V('.footer button:has-text("Отправить в Telegram")')
        check(await btn.is_enabled(), 'share button ready')
        await btn.click(); await pg.wait_for_timeout(400)
        shared = await pg.evaluate('window.__shared')
        check(any('startapp%3Dp' in s or 'startapp=p' in s or '%23r%3Dp' in s for s in shared), f'share opens Telegram with the card link ({shared[:1]})')
        await pg.evaluate('window.__tgBack()'); await pg.wait_for_timeout(300)
        await V('.my-card-actions button:has-text("Настроить")').click(); await pg.wait_for_timeout(500)
        for t in ('espresso', 'latte', 'ocean'):
            await V(f'.theme-pick:has-text("{ {"espresso": "Эспрессо", "latte": "Латте", "ocean": "Океан"}[t] }")').click(); await pg.wait_for_timeout(200)
            await pg.evaluate('window.scrollTo(0, 0)'); await pg.wait_for_timeout(150)
            await V('.pcard').first.screenshot(path=str(OUT / f'card-{t}.png'))
        check(not errors, f'no page errors: {errors[:3]}')

        # a tester sees every background at every level
        SERVER['grants'] = ['tester', 'dev']
        pt, et = await page(b, db=DB, init=TG)
        await mock(pt, [], [])
        await pt.reload(); await pt.wait_for_timeout(3500)
        await pt.click('.tabbar >> text=Профиль'); await pt.wait_for_timeout(400)
        await pt.locator('.my-card-actions button:visible:has-text("Настроить")').click(); await pt.wait_for_timeout(400)
        tiles = [s.split('\n')[0] for s in await pt.locator('.theme-pick:visible').all_inner_texts()]
        check(all(t in tiles for t in ('Разработчик', 'Бронза', 'Серебро', 'Золото', 'Объёмный', 'Бриллиант')), f'tester: all backgrounds ({tiles})')
        await pt.locator('.theme-pick:visible:has-text("Объёмный")').click(); await pt.wait_for_timeout(300)
        n_icons = await pt.locator('.icon-pick:visible').count()
        check(n_icons >= 10, f'tester: every method icon inside a tier ({n_icons})')
        await pt.locator('.icon-pick:visible[aria-label*="Аэропресс"]').click(); await pt.wait_for_timeout(300)
        check(await pt.locator('.pcard.tier-volume .pcard-volume').count() >= 1, 'tester: «Объёмный» Аэропресс on the card')
        await pt.locator('.theme-pick:visible:has-text("Бриллиант")').click(); await pt.wait_for_timeout(300)
        SERVER['diamondNo'] = 0
        check(await pt.locator('.pcard.tier-diamond').count() >= 1, 'tester: diamond card')
        await pt.evaluate('window.scrollTo(0, 0)'); await pt.locator('.theme-picks').screenshot(path=str(OUT / 'tester-themes.png'))
        check(not et, f'no page errors (tester): {et[:3]}')
        SERVER.pop('grants'); SERVER.pop('diamondNo', None)

        # shared cards: silver, gold, diamond (light and dark), espresso
        for dark in (False, True):
            for k in CARDS:
                if dark and k != 'diamond1': continue
                pv, err = await page(b, init=f"location.hash = '#r=p{k}';", dark=dark)
                await mock(pv, [])
                await pv.reload(); await pv.wait_for_timeout(900)
                check(await pv.locator('.pcard:visible').count() == 1, f'shared card {k} opens{" (dark)" if dark else ""}')
                if k == 'diamond0':
                    check((await pv.locator('.pcard-no').inner_text()).replace('\n', '') == '№0', 'test diamond shows № 0')
                elif k == 'devfake':
                    check(await pv.locator('.pcard.special-dev').count() == 0, 'developers background without the server grant is not shown')
                elif k == 'dev1':
                    check(await pv.locator('.pcard.special-dev .pcard-dev-mark').count() == 1, 'developers background with its mark')
                    for i, ga in enumerate((-20, 20)):
                        await tilt(pv, 0, 0); await pv.wait_for_timeout(50); await tilt(pv, 0, ga); await pv.wait_for_timeout(600)
                        await pv.locator('.pcard:visible').screenshot(path=str(OUT / f'card-dev-{i}.png'))
                elif k == 'fake1':
                    check(await pv.locator('.pcard.base-paper').count() == 1 and await pv.locator('.pcard .pcard-tier').count() == 0, 'a faked background without server levels is not shown')
                elif k in ('silver1', 'gold1'):
                    pos = []
                    for i, (be, ga) in enumerate([(0, 0), (0, -22), (0, 22)]):
                        await tilt(pv, 0, 0); await pv.wait_for_timeout(50)
                        await tilt(pv, be, ga); await pv.wait_for_timeout(700)
                        pos.append(await pv.locator('.pcard:visible').evaluate('e => getComputedStyle(e).backgroundPosition'))
                        await pv.locator('.pcard:visible').screenshot(path=str(OUT / f'card-{k}-{i}.png'))
                    check(len(set(pos[1:])) == 2, f'{k}: the light band moves with the tilt ({pos})')
                    check(await pv.locator('.pcard-glints g').count() > 0, f'{k}: glints flash at some tilt')
                elif k == 'volume1':
                    for i, (be, ga) in enumerate([(0, 0), (6, -22), (-6, 22)]):
                        await tilt(pv, 0, 0); await pv.wait_for_timeout(50)
                        await tilt(pv, be, ga); await pv.wait_for_timeout(700)
                        await pv.locator('.pcard:visible').screenshot(path=str(OUT / f'card-volume-{i}.png'))
                    check(await pv.locator('.pcard-volume-layer').count() > 10, 'volume card: the method icon is extruded')
                elif k == 'diamond1':
                    check((await pv.locator('.pcard-no').inner_text()).replace('\n', '') == '№7', 'diamond shows the holder number')
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
