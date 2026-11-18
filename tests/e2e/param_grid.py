"""The brew page's parameter tiles fill every row: the last tile of an unfinished row takes the rest of it, no gray hole (brewbook-bugs#1)."""
import asyncio, time
from common import async_playwright, check, done, page

PROFILE = {'name': 'Т', 'about': '', 'telegram': '', 'badges': [], 'shareTelegram': True, 'shareBadges': True}
NOW = int(time.time() * 1000)
BASE = {'methodId': 'v60', 'dose': 15, 'water': 250, 'temp': 93, 'grind': 'средний, чуть крупнее, чем для V60', 'time': 180, 'rating': 1, 'notes': '',
        'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3}, 'descriptors': [], 'cupping': None, 'gear': []}
# 6 tiles, 7 (ppm — the reported case), 8 (ppm + TDS)
BREWS = [
    {**BASE, 'id': 'b6', 'date': NOW - 3000},
    {**BASE, 'id': 'b7', 'date': NOW - 2000, 'ppm': 170},
    {**BASE, 'id': 'b8', 'date': NOW - 1000, 'ppm': 170, 'tds': 1.3},
]
DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': BREWS, 'gear': [], 'beans': [], 'profile': PROFILE}

GEOM = """g => { const r = g.getBoundingClientRect(); const cells = [...g.children].map(c => c.getBoundingClientRect());
  const rows = {}; for (const c of cells) { const k = Math.round(c.top); rows[k] = (rows[k] || 0) + c.width + 1; }
  return { width: r.width, rows: Object.values(rows) } }"""

async def run(b, width, dark, tag):
    pg, errors = await page(b, width=width, dark=dark, db=DB)
    nav = pg.locator('.side-nav button:visible').filter(has_text='Дневник')
    await (nav.first if await nav.count() else pg.locator('.tabbar button').filter(has_text='Дневник')).click(); await pg.wait_for_timeout(300)
    for n, bid in ((6, 'b6'), (7, 'b7'), (8, 'b8')):
        # rows are newest first: b8, b7, b6
        idx = {'b8': 0, 'b7': 1, 'b6': 2}[bid]
        await pg.locator('.group .row:visible').nth(idx).click(); await pg.wait_for_timeout(350)
        grid = pg.locator('.param-grid:visible').first
        g = await grid.evaluate(GEOM)
        full = all(abs(w - (g['width'] + 1)) <= 2 for w in g['rows'])
        check(full, f'{tag}: {n} tiles — every row is filled to the edge ({[round(w) for w in g["rows"]]} of {round(g["width"])})')
        if n == 7: await grid.screenshot(path=f'out/param-grid-{tag}.png')
        if width < 700:
            await pg.locator('button.back:visible').first.click(); await pg.wait_for_timeout(350)
    check(not errors, f'{tag}: no page errors {errors}')
    await pg.context.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await run(b, 390, False, 'phone-light')
        await run(b, 390, True, 'phone-dark')
        await run(b, 1400, False, 'desktop')
        await b.close()
    done()

asyncio.run(main())
