"""In Telegram, picking the theme other than Telegram's uses the colors of Telegram's other theme, remembered
from when the app was last opened in it; before that the app's own palette stands in. High contrast: own palette."""
import asyncio
from common import URL, async_playwright, check, done

LIGHT = {'bg_color': '#ffffff', 'secondary_bg_color': '#f1f1f4', 'section_bg_color': '#fefefe', 'text_color': '#111111', 'hint_color': '#7a7a80',
         'button_color': '#3390ec', 'button_text_color': '#ffffff', 'link_color': '#2481cc'}
DARK = {'bg_color': '#212121', 'secondary_bg_color': '#0f0f0f', 'section_bg_color': '#1c1c1d', 'text_color': '#f5f5f5', 'hint_color': '#aaaaaa',
        'button_color': '#8774e1', 'button_text_color': '#ffffff', 'link_color': '#8774e1'}

def tg(scheme, params):
    import json
    return f"""window.__bars = []; window.Telegram = {{ WebApp: {{
  initData: 'query_id=x&auth_date=1&hash=abc', initDataUnsafe: {{}}, version: '7.0', platform: 'android', colorScheme: '{scheme}', themeParams: {json.dumps(params)},
  isVersionAtLeast: (v) => parseFloat(v) <= 7.0, ready() {{}}, expand() {{}}, onEvent() {{}}, offEvent() {{}},
  setHeaderColor(c) {{ window.__bars.push(c); }}, setBackgroundColor() {{}}, setBottomBarColor() {{}}, disableVerticalSwipes() {{}},
  BackButton: {{ show() {{}}, hide() {{}}, onClick() {{}}, offClick() {{}} }}, HapticFeedback: {{ impactOccurred() {{}}, notificationOccurred() {{}}, selectionChanged() {{}} }},
  MainButton: {{ hide() {{}} }}, SettingsButton: {{ hide() {{}} }} }} }};"""

BG = "getComputedStyle(document.body).backgroundColor"

async def pick(pg, label):
    await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(400)
    await pg.locator('.segmented:visible').first.locator(f'button:has-text("{label}")').click(); await pg.wait_for_timeout(200)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        # 1. Telegram dark, never seen light: «Светлая» uses the app's own light palette
        pg = await ctx.new_page()
        await pg.add_init_script(tg('dark', DARK))
        await pg.goto(URL); await pg.wait_for_timeout(600)
        check(await pg.evaluate(BG) == 'rgb(15, 15, 15)', f'dark Telegram: its own dark colors ({await pg.evaluate(BG)})')
        await pick(pg, 'Светлая')
        check(await pg.evaluate(BG) == 'rgb(239, 241, 236)', f'light picked, Telegram light never seen: the app\'s light palette ({await pg.evaluate(BG)})')
        await pg.close()
        # 2. opened once in Telegram light: its light colors are remembered
        pg = await ctx.new_page(); await pg.add_init_script(tg('light', LIGHT))
        await pg.goto(URL); await pg.wait_for_timeout(600)
        check(await pg.evaluate(BG) == 'rgb(241, 241, 244)', f'light picked in light Telegram: Telegram light ({await pg.evaluate(BG)})')
        await pg.close()
        # 3. back in Telegram dark with «Светлая»: Telegram's light colors, and the bars follow
        pg = await ctx.new_page(); await pg.add_init_script(tg('dark', DARK))
        await pg.goto(URL); await pg.wait_for_timeout(600)
        check(await pg.evaluate(BG) == 'rgb(241, 241, 244)', f'dark Telegram, «Светлая»: the remembered Telegram light colors ({await pg.evaluate(BG)})')
        btn = await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
        check(btn == '#3390ec', f'…including its button color ({btn})')
        bars = await pg.evaluate('window.__bars')
        check(bars and bars[-1] == '#f1f1f4', f'Telegram\'s bars take the light background ({bars[-1:]})')
        # 4. «Тёмная» in dark Telegram: the current colors again
        await pick(pg, 'Тёмная')
        check(await pg.evaluate(BG) == 'rgb(15, 15, 15)', f'«Тёмная» in dark Telegram: Telegram dark ({await pg.evaluate(BG)})')
        # 5. high contrast: the app's own palette
        await pg.locator('label[for="contrast"]:visible').click(); await pg.wait_for_timeout(200)
        check(await pg.evaluate(BG) == 'rgb(0, 0, 0)', f'high contrast: the app\'s own black ({await pg.evaluate(BG)})')
        await pg.close()
        await b.close()
    done()

asyncio.run(main())
