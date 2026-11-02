"""Cards on a computer follow the mouse calmly: no shaking at the edges, no sway under a resting cursor."""
import asyncio, json
from common import async_playwright, check, done, page

def card(theme, earned):
    return {'v': 2, 'ach': [], 'earned': earned, 'name': 'Coffee Chort', 'username': 'brewer', 'about': 'Знатный чертяка', 'badges': [], 'setup': [], 'theme': theme}

CARDS = {'td': card({'ach': 'liters'}, {'liters': {'tier': 'diamond', 'at': 1000}}),
         'tg': card({'ach': 'method:chemex'}, {'method:chemex': {'tier': 'gold', 'at': 500}}),
         'tv': card({'ach': 'method:v60'}, {'method:v60': {'tier': 'volume', 'at': 1000}})}

def mock(c, k):
    async def handle(route):
        u = route.request.url
        if u.endswith(f'/cards/{k}'): return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'card': c}))
        if route.request.method == 'POST' and (u.endswith('/me') or u.endswith('/brews')): return await route.fulfill(status=404, body='{}')
        if '/stats' in u: return await route.fulfill(status=404, body='{}')
        await route.continue_()
    return handle

async def tx(el):
    return await el.evaluate("e => parseFloat(e.style.getPropertyValue('--tx') || '0')")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for k, c in CARDS.items():
            pg, errors = await page(b, width=1280, height=860, init=f"location.hash = '#r=p{k}';")
            await pg.route('**/*', mock(c, k))
            await pg.reload(); await pg.wait_for_timeout(1000)
            el = pg.locator('.pcard').first
            bx = await el.bounding_box()
            # the cursor rests at the very edge of a turned card: the tilt holds still, for longer than the idle delay
            await pg.mouse.move(bx['x'] + bx['width'] - 2, bx['y'] + bx['height'] / 2); await pg.wait_for_timeout(1200)
            xs = []
            for _ in range(70):
                await pg.wait_for_timeout(50); xs.append(await tx(el))
            check(max(xs) - min(xs) < 0.02 and xs[-1] > 0.85, f'{k}: the cursor rests at the edge — the card holds still ({min(xs):.3f}…{max(xs):.3f})')
            # slow moves along the edge: small steady changes, no jumps back and forth
            ys = []
            for i in range(30):
                await pg.mouse.move(bx['x'] + bx['width'] - 3 - (i % 2), bx['y'] + 10 + i * (bx['height'] - 20) / 30); await pg.wait_for_timeout(30)
                ys.append(await tx(el))
            flips = sum(1 for i in range(2, len(ys)) if (ys[i] - ys[i - 1]) * (ys[i - 1] - ys[i - 2]) < 0 and abs(ys[i] - ys[i - 1]) > 0.03)
            check(flips <= 1, f'{k}: moving along the edge does not shake ({flips} reversals)')
            # the cursor leaves: back to the middle, softly
            await pg.mouse.move(5, 5); await pg.wait_for_timeout(1500)
            check(abs(await tx(el)) < 0.15, f'{k}: the cursor left — the card returns to the middle ({await tx(el):.3f})')
            check(not errors, f'{k}: no page errors {errors[:2]}')
            await pg.context.close()
        await b.close()
    done()

asyncio.run(main())
