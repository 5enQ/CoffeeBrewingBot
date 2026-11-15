"""The cold brew card in the chat with the bot (worker/src/widget.ts), drawn in a browser with a stand-in for
Telegram's widget sandbox: it counts down by itself, shows each state the bot gives it, follows «Фосфор», and its
buttons ask the bot. Plus the switch on the cold brew timer that turns it on and off."""
import asyncio, json, subprocess, time
from common import OUT, ROOT, async_playwright, check, done, page

HTML = subprocess.run(['node', '--input-type=module', '-e', "import('./worker/src/widget.ts').then((m) => process.stdout.write(m.WIDGET_HTML))"],
                      cwd=ROOT, capture_output=True, text=True, check=True).stdout
NOW = int(time.time() * 1000)


def stand_in(state):
    # TelegramWidget as the guide describes it: chatData is a string, events come with no arguments
    return """window.__asked = []; window.__h = {};
window.TelegramWidget = { chatData: %s, onEvent(n, f) { window.__h[n] = f; },
  request(d) { window.__asked.push(d); return Promise.resolve({ result: null }); } };""" % json.dumps(json.dumps(state))


async def card(b, state, width=320):
    ctx = await b.new_context(viewport={'width': width, 'height': 420}, device_scale_factor=2)
    await ctx.add_init_script(stand_in(state))
    pg = await ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    await pg.set_content('<!doctype html><meta charset="utf-8"><body>' + HTML + '</body>')
    await pg.wait_for_timeout(300)
    return pg, errors


async def text(pg):
    return await pg.evaluate("() => ['e','t','s','a','z','r'].map((i) => document.getElementById(i).textContent).concat([getComputedStyle(document.getElementById('bb')).display, document.getElementById('bd').textContent, document.body.className])")


async def main():
    OUT.mkdir(exist_ok=True)
    base = {'s': NOW - 3 * 3600_000, 'e': NOW + 9 * 3600_000 + 5000, 't': 'Колд брю', 'r': '60 г → 1 л', 'b': 'Эфиопия Гуджи'}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, err = await card(b, {**base, 'st': 'run'})
        t1 = await text(pg)
        check(t1[0] == 'КОЛД БРЮ · НАСТАИВАЕТСЯ' and t1[1].startswith('9:00:0') and t1[2] == 'осталось', f'running: the time left, counted by the card itself {t1[:3]}')
        await pg.wait_for_timeout(1300)
        t2 = await text(pg)
        check(t2[1] != t1[1], f'it ticks every second ({t1[1]} → {t2[1]})')
        check(t1[3].startswith('залито в ') and t1[4].startswith('готово ') and t1[5] == '60 г → 1 л · Эфиопия Гуджи', f'when it was poured, when it is ready, the recipe {t1[3:6]}')
        w = await pg.evaluate("() => document.getElementById('f').style.width")
        check(w == '25%', f'the bar shows a quarter gone ({w})')
        await pg.screenshot(path=str(OUT / 'chat-card-run.png'))
        await pg.click('#bh'); await pg.click('#bd')
        check(await pg.evaluate('window.__asked') == ['h', 'd'], 'the buttons ask the bot: h — an hour more, d — strained')
        # the bot changes the state: the card redraws on chatDataChanged
        await pg.evaluate("(s) => { TelegramWidget.chatData = s; window.__h.chatDataChanged.call(TelegramWidget); }", json.dumps({**base, 'st': 'strained'}))
        t3 = await text(pg)
        check(t3[1] == 'Процежено ✓' and t3[6] == 'none', f'a new state from the bot is drawn at once, without its buttons {t3[1]}')
        check(not err, f'no errors {err}')

        pr, _ = await card(b, {**base, 'e': NOW - 20 * 60_000, 'st': 'run'})
        tr = await text(pr)
        check(tr[1] == 'Пора процедить' and 'ждёт 0:20' in tr[2] and tr[7] == 'Процедил ✓', f'past its end it says so itself, even before the bot does {tr[1:3]}')
        await pr.screenshot(path=str(OUT / 'chat-card-ready.png'))
        pp, _ = await card(b, {**base, 'st': 'pause', 'pz': NOW - 3600_000})
        tp = await text(pp)
        check(tp[1] == 'Таймер на паузе' and tp[6] == 'none', f'paused: no countdown and no buttons {tp[1]}')
        pf, _ = await card(b, {**base, 'st': 'run', 'p': 1})
        tf = await text(pf)
        check(tf[8] == 'p', 'the green monitor when the app is in «Фосфор»')
        await pf.screenshot(path=str(OUT / 'chat-card-phosphor.png'))
        for st, want in (('done', 'В дневнике ✓'), ('stop', 'Таймер сброшен')):
            pd, _ = await card(b, {**base, 'st': st})
            check((await text(pd))[1] == want, f'{st}: «{want}»')
        pb, eb = await card(b, {})
        check(not eb, f'an empty state does not break it {eb}')

        # the switch on the cold brew timer (Telegram: reminders need the signed user)
        tg = """window.Telegram = { WebApp: { initData: 'query_id=x&user=%7B%22id%22%3A111%7D&auth_date=' + Math.floor(Date.now() / 1000) + '&hash=abc', initDataUnsafe: { user: { id: 111 } },
          version: '8.0', platform: 'ios', colorScheme: 'light', themeParams: {}, isVersionAtLeast: () => true, ready() {}, expand() {}, onEvent() {}, offEvent() {},
          setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {}, disableVerticalSwipes() {}, requestWriteAccess(cb) { cb(true); },
          enableClosingConfirmation() {}, disableClosingConfirmation() {}, openTelegramLink() {}, openLink() {},
          BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} } } };"""
        pt, et = await page(b, init=tg)
        sent = []
        async def handle(route):
            if route.request.url.endswith('/reminders'):
                sent.append(json.loads(route.request.post_data))
                return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'pending': None, 'last': None}))
            await route.continue_()
        await pt.route('**/*', handle)
        await pt.reload(); await pt.wait_for_timeout(1200)
        await pt.locator('.method-card:visible:has-text("Колд брю")').first.click(); await pt.wait_for_timeout(400)
        await pt.locator('.recipe-tile:visible').first.click(); await pt.wait_for_timeout(400)
        await pt.locator('button:visible:has-text("Начать")').last.click(); await pt.wait_for_timeout(600)
        sw = pt.locator('#chat-card')
        check(await sw.count() == 1 and await sw.is_checked(), 'cold brew: «Карточка в чате с ботом», on')
        await pt.locator('button:visible:has-text("Старт")').first.click(); await pt.wait_for_timeout(1200)
        arm = [x for x in sent if x.get('at')]
        check(arm and arm[-1].get('card', {}).get('brew') and arm[-1]['card']['recipe'], f'starting sends the card with the reminder ({arm[-1].get("card") if arm else None})')
        await pt.locator('label[for="chat-card"]').click(); await pt.wait_for_timeout(1200)
        arm = [x for x in sent if x.get('at')]
        check(arm[-1].get('card', 'x') is None, 'turned off: the card is taken away (null), the reminder stays')
        await pt.locator('button:visible:has-text("Пауза")').first.click(); await pt.wait_for_timeout(800)
        check(sent[-1].get('cancel') == 'pause', f'pause tells the bot why ({sent[-1].get("cancel")})')
        await pt.screenshot(path=str(OUT / 'chat-card-switch.png'))
        check(not et, f'no page errors {et[:3]}')

        pv, ev = await page(b, init=tg)
        await pv.locator('.method-card:visible:has-text("V60")').first.click(); await pv.wait_for_timeout(400)
        await pv.locator('.recipe-tile:visible').first.click(); await pv.wait_for_timeout(400)
        await pv.locator('button:visible:has-text("Начать")').last.click(); await pv.wait_for_timeout(500)
        check(await pv.locator('#chat-card').count() == 0, 'not for other methods')
        await b.close()
    done()

asyncio.run(main())
