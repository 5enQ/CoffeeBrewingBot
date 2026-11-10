"""Review fixes (v1.7.3): footers fit narrow phones, the timer's next step keeps one line, sound is an icon toggle,
small controls answer to a finger-sized area, no zero counters for a new profile, a hand-written brew starts with
the coffee and the parameters, hints readable on the page background."""
import asyncio, json
from common import async_playwright, check, done, page

src = open('ui_snapshot.py').read().split('# ---------- screens')[0]
ns = {'__file__': __file__}; exec(src, ns)
DB = ns['DB']
EMPTY = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'beans': [], 'gear': [], 'profile': {'name': '', 'badges': []}}

def lum(rgb):
    c = [v / 255 for v in rgb]; c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (320, 390):
            pg, errors = await page(b, db=DB, width=w)
            V = lambda s: pg.locator(s + ':visible')
            # a brew's footer stays inside the screen
            await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(300)
            await V('.tab-page .row').first.click(); await pg.wait_for_timeout(500)
            edge = await pg.evaluate("() => { const f = [...document.querySelectorAll('.footer-actions')].find((e) => e.getClientRects().length); return [...f.children].map((c) => c.getBoundingClientRect().right).reduce((a, b) => Math.max(a, b), 0) - f.getBoundingClientRect().right; }")
            check(edge <= 0.5, f'{w}px: the brew footer fits ({edge:+.1f}px past its edge)')
            label = await V('.footer-actions .btn-secondary').first.inner_text()
            check('Изменить' in label or w < 375, f'{w}px: «Изменить» keeps its words where they fit')
            check(await V('.footer-actions .btn-secondary').first.evaluate('e => e.textContent.trim()') == 'Изменить', f'{w}px: the edit button still says «Изменить» to screen readers')
            # the timer: one line under the step card, sound as an icon
            await pg.click('.back, [aria-label="Назад"]') if await V('[aria-label="Назад"]').count() else None
            await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(300)
            await V('.method-card:has-text("V60")').first.click(); await pg.wait_for_timeout(300)
            await V('.recipe-tile').first.click(); await pg.wait_for_timeout(400)
            await V('button:has-text("Начать")').last.click(); await pg.wait_for_timeout(400)
            st = V('button:has-text("Старт")')
            if await st.count(): await st.first.click()
            await pg.wait_for_timeout(600)
            h = await V('.step-next').first.evaluate('e => e.getBoundingClientRect().height')
            check(h < 30, f'{w}px: the next step stays on one line ({h:.0f}px)')
            g = await V('.step-next-g').first.inner_text()
            check('до' in g and 'г' in g, f'{w}px: its grams are whole ({g.strip()})')
            snd = V('[aria-label="Звук"]').first
            check(await snd.get_attribute('aria-pressed') == 'true' and await snd.locator('svg').count() == 1, f'{w}px: sound is an icon toggle, on')
            await snd.click(); await pg.wait_for_timeout(100)
            check(await snd.get_attribute('aria-pressed') == 'false', f'{w}px: and turns off')
            check(not errors, f'{w}px: no page errors {errors[:2]}')
            await pg.close()

        # finger-sized areas around small controls
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        await V('.method-card:has-text("V60")').first.click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(400)
        await V('button:has-text("Без таймера")').first.click(); await pg.wait_for_timeout(500)
        heads = await V('.section-head h2').all_inner_texts()
        hi = lambda t: next((i for i, x in enumerate(heads) if x.lower().startswith(t)), 99)
        check(hi('зерно') < hi('оценка') and hi('параметры') < hi('вкус'), f'written by hand: coffee and parameters come first ({heads[:4]})')
        dot = V('.dots-row button').first
        area = await dot.evaluate("e => { const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::before'); return [r.height - parseFloat(a.top) - parseFloat(a.bottom), r.width - parseFloat(a.left) - parseFloat(a.right)]; }")
        check(area[0] >= 44, f'a taste dot answers to a {area[0]:.0f}×{area[1]:.0f} area')
        await dot.evaluate('e => e.scrollIntoView({block: "center"})'); await pg.wait_for_timeout(200)
        tap = await dot.bounding_box()
        el = await pg.evaluate(f"document.elementFromPoint({tap['x'] + tap['width'] / 2}, {tap['y'] - 8}).closest('button')?.getAttribute('aria-label')")
        check(el and el.endswith(': 1'), f'a tap 8px above a dot still picks it ({el})')
        star = V('.star-half').first
        await star.evaluate('e => e.scrollIntoView({block: "center"})')
        h = await star.evaluate("e => e.getBoundingClientRect().height - 2 * parseFloat(getComputedStyle(e, '::before').top)")
        check(h >= 44, f'a star half answers to {h:.0f}px in height')
        # the hint is readable on the page background (WCAG AA, 4.5:1)
        c = await pg.evaluate("() => { const t = document.createElement('span'); t.style.color = 'var(--hint)'; document.body.append(t); const a = getComputedStyle(t).color; const b = getComputedStyle(document.body).backgroundColor; t.remove(); return [a, b]; }")
        nums = [list(map(int, x[x.index('(') + 1:x.index(')')].split(',')[:3])) for x in c]
        l1, l2 = lum(nums[0]), lum(nums[1]); cr = (max(l1, l2) + .05) / (min(l1, l2) + .05)
        check(cr >= 4.5, f'hints on the page: {cr:.2f}:1')
        check(not errors, f'no page errors {errors[:2]}')
        await pg.close()

        # a new profile shows no row of zeros
        pg, errors = await page(b, db=EMPTY)
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(400)
        check(await pg.locator('.stats:visible').count() == 0, 'new profile: no zero counters')
        await pg.close()
        await b.close()
    done()

asyncio.run(main())
