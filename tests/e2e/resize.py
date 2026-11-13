"""Resizing the window (Telegram on a computer): the method tiles take their new size at once instead of gliding
after the window, and on a Mac the page keeps the system's own scrollbars (a styled one sat at the window edge
and caught the mouse before the window's resize border)."""
import asyncio
from common import async_playwright, check, done, page

src = open('ui_snapshot.py').read().split('# ---------- measuring')[0]
ns = {'__file__': __file__}; exec(src, ns)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, width=420, height=800, db=ns['DB'])
        await pg.wait_for_timeout(500)
        moving = []
        for w in (440, 470, 500, 540, 600, 520, 460):
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(60)
            moving.append(await pg.evaluate("() => [...document.querySelectorAll('[data-flip]')].filter((e) => e.getAnimations().length).length"))
        check(not any(moving), f'tiles do not glide while the window is resized {moving}')
        # an edit that moves tiles still animates (the glide is only skipped for a resize)
        check(not errors, f'no page errors {errors}')
        mac_cls = await pg.evaluate("() => document.documentElement.classList.contains('mac')")
        check(not mac_cls, 'not a Mac: the thin styled scrollbar stays')
        await pg.context.close()

        ctx = await b.new_context(viewport={'width': 420, 'height': 800}, user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko)')
        pg2 = await ctx.new_page()
        await pg2.goto(ns['URL']); await pg2.wait_for_timeout(400)
        check(await pg2.evaluate("() => document.documentElement.classList.contains('mac')"), 'a Mac: the page leaves the scrollbars to the system')
        await b.close()
    done()

asyncio.run(main())
