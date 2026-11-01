"""«Стакан» card background: the coffee stays level, tips with the roll, shows its surface on a sharp tilt, keeps 60 fps."""
import asyncio
from common import async_playwright, check, done, page

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [], 'beans': [],
      'profile': {'name': 'Аня Кофеман', 'about': 'Пуроверы по утрам', 'telegram': 'anya', 'badges': [], 'shareTelegram': True, 'shareBadges': True, 'cardTheme': 'ach:liters',
                  # the glass is the 500-liter background: the numbers come from the server's cache
                  'serverStats': {'methods': {}, 'liters': 620, 'ratings': 0, 'at': 1, 'account': 'acc', 'grants': []}}}
SURFACE = '''() => { const c = document.querySelector('.pcard-coffee'); const g = c.getContext('2d');
  const col = (x) => { const d = g.getImageData(x, 0, 1, c.height).data; for (let y = 0; y < c.height; y++) if (d[y * 4 + 3] > 200) return y; return -1; };
  return [col(4), col(c.width >> 1), col(c.width - 5)]; }'''
FPS = '''() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })'''

async def tilt(pg, beta, gamma):
    await pg.evaluate(f"window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {{ beta: {beta}, gamma: {gamma}, alpha: 0 }}))")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(600)
        card = pg.locator('.pcard.base-glass:visible').first
        check(await card.count() == 1, 'with 500+ liters the profile card can be the glass')
        await tilt(pg, 0, 0); await pg.wait_for_timeout(50); await tilt(pg, 0, 0); await pg.wait_for_timeout(1800)
        flat = await pg.evaluate(SURFACE)
        check(flat[0] > 0 and abs(flat[0] - flat[2]) < 12, f'level phone: the coffee is level ({flat})')
        await tilt(pg, 0, 20); await pg.wait_for_timeout(1800)
        roll = await pg.evaluate(SURFACE)
        check(roll[0] - roll[2] > 40, f'sideways tilt tips the surface ({flat} → {roll})')
        await card.screenshot(path='out/glass-roll.png')
        await tilt(pg, 0, 0); await pg.wait_for_timeout(1800)
        await tilt(pg, 22, 0); await pg.wait_for_timeout(200)
        sharp = await pg.evaluate(SURFACE)
        await card.screenshot(path='out/glass-surface.png')
        check(sharp[1] < flat[1] - 25, f'a sharp tilt toward you opens the surface from above (top edge {flat[1]} → {sharp[1]})')
        await pg.wait_for_timeout(2500)
        settled = await pg.evaluate(SURFACE)
        check(settled[1] >= sharp[1], f'then it does not open further: it settles back toward the resting view ({sharp[1]} → {settled[1]})')
        # keep it moving and count frames
        await pg.evaluate("window.__shake = setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: Math.random() * 30, gamma: Math.random() * 40 - 20, alpha: 0 })), 150)")
        fps = await pg.evaluate(FPS)
        check(fps >= 55, f'about 60 fps while the coffee sloshes ({fps})')
        await pg.evaluate("clearInterval(window.__shake)")
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
