"""Brewing from the shelf and the timer's «Ждать»: the bean card has «Заварить» in its footer (beans — the method last
used, drips — the drip), «Купить ещё» asks for the new roast date first and keeps the rest folded as it was, a drip box
has only the count field (no 1/5/6 шт presets), and «Ждать» holds the next step while the clock runs on."""
import asyncio, copy
from common import async_playwright, check, done, page

src = open('ui_snapshot.py').read().split('# ---------- measuring')[0]
ns = {'__file__': __file__}; exec(src, ns)
DB = copy.deepcopy(ns['DB'])
k0 = DB['beans'][0]
DB['beans'] += [dict(copy.deepcopy(k0), id='d1', name='Дрипы Лавка', kind='drip', dripCount=10, weight='', roastDate='2026-11-01'),
                dict(copy.deepcopy(k0), id='f1', name='Колумбия Уила', finished=True, finishedAt=1794000000000, roastDate='2026-10-01')]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        async def esc(n=1):
            for _ in range(n): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)

        await ns['tab'](pg, 'Полка'); await pg.wait_for_timeout(500)
        await V(f'.tab-page .bean-card:has-text("{k0["name"]}")').first.click(); await pg.wait_for_timeout(600)
        label = await V('.footer .btn').inner_text()
        check('Заварить' in label and 'V60' in label, f'a bean card offers «Заварить» with the last method ({label.strip()})')
        await V('.footer .btn').click(); await pg.wait_for_timeout(600)
        check((await pg.evaluate('document.title')).startswith('V60'), 'and it opens that method for this coffee')
        await esc(2)

        await V('.tab-page .bean-card:has-text("Дрипы Лавка")').first.click(); await pg.wait_for_timeout(600)
        check((await V('.footer .btn').inner_text()).strip() == 'Заварить дрип', 'a drip box offers «Заварить дрип»')
        await V('.footer .btn').click(); await pg.wait_for_timeout(600)
        check((await pg.evaluate('document.title')).startswith('Дрип'), 'and it opens the drip')
        await esc()
        await V('[aria-label="Изменить"]').click(); await pg.wait_for_timeout(600)
        chips = await V('.chip:has-text(" шт")').count()
        check(chips == 0 and await V('#bean-drip-count').count() == 1, f'a drip box has the count field only, no presets ({chips})')
        await esc(2)

        await V('.link-btn:has-text("Показать")').last.click(); await pg.wait_for_timeout(400)
        await V('.tab-page .bean-card:has-text("Колумбия Уила")').first.click(); await pg.wait_for_timeout(600)
        check(await V('.footer').count() == 0, 'a finished pack has no «Заварить» footer')
        await V('button:has-text("Купить ещё")').click(); await pg.wait_for_timeout(600)
        first = await pg.evaluate("() => [...document.querySelectorAll('input')].find((e) => e.checkVisibility())?.id")
        check((await pg.evaluate('document.title')).startswith('Ещё пачка') and first == 'bean-roastDate', f'«Купить ещё» starts with the roast date ({first})')
        check(await V('.row:has-text("Колумбия Уила")').count() == 1 and await V('#bean-country').count() == 0, 'the rest is folded «как у прошлой пачки»')
        await pg.fill('#bean-roastDate', '2026-11-10')
        await V('.row:has-text("Колумбия Уила")').click(); await pg.wait_for_timeout(400)
        check(await V('#bean-country').input_value() == k0['country'], 'unfolded, the old details are there to change')
        await V('.footer .btn').click(); await pg.wait_for_timeout(700)
        while await V('[aria-label="Назад"]').count() or not await V('.tabbar').count(): await esc()
        n = await V('.tab-page .bean-card:has-text("Колумбия Уила")').count()
        check(n == 2, f'the new pack is on the shelf, the old one stays under «Допито» ({n})')

        # «Ждать»: the next step waits, the clock and the end move on, and stay moved after release
        await ns['tab'](pg, 'Заварить'); await pg.wait_for_timeout(400)
        await V('.method-card:has-text("V60")').first.click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(400)
        await V('button:has-text("Начать")').last.click(); await pg.wait_for_timeout(500)
        st = V('button:has-text("Старт")')
        if await st.count(): await st.first.click()
        await pg.wait_for_timeout(1200)
        q = "() => [document.querySelector('.step-next > span').textContent, document.querySelector('.timer-total').textContent]"
        before = await pg.evaluate(q)
        await V('.step-hold').click(); await pg.wait_for_timeout(2600)
        mid = await pg.evaluate(q)
        check(mid[0].startswith('Ждём') and mid[1] != before[1], f'held: «Ждём», the end moves later {before} → {mid}')
        await V('.step-hold').click(); await pg.wait_for_timeout(300)
        after = await pg.evaluate(q)
        check(after[0] == before[0] or after[0].startswith('Через'), f'released: the countdown to the next step goes on from where it stood {after}')
        check(after[1] == mid[1], 'and the end stays later')
        await V('[aria-label="Готово, записать"]').click(); await pg.wait_for_timeout(600)
        check((await pg.evaluate('document.title')).startswith('Как получилось'), 'the brew goes on to be written down')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
