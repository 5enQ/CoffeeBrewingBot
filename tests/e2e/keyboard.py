"""Keyboard only: Tab reaches every control of the main screens, each focus ring is whole (not cut by a rounded card
or a scroller into a stray line), Enter opens a brew from the journal, Esc goes back and focus returns to that row."""
import asyncio, copy, json
from common import async_playwright, check, done, page

src = open('ui_snapshot.py').read().split('# ---------- measuring')[0]
ns = {'__file__': __file__}; exec(src, ns)
DB = copy.deepcopy(ns['DB'])
extra = copy.deepcopy(DB['brews'][1]); extra['id'] = 'r9'; extra['methodId'] = 'clever'; DB['brews'].append(extra)  # two methods → filter chips

PROBE = r"""() => {
  const e = document.activeElement; if (!e || e === document.body) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const ext = ring ? parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset) : 0;
  let cut = null;
  for (let p = e.parentElement; p && !cut; p = p.parentElement) {
    const s = getComputedStyle(p); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
    const q = p.getBoundingClientRect();
    if (r.left - ext < q.left - .5 || r.right + ext > q.right + .5 || r.top - ext < q.top - .5 || r.bottom + ext > q.bottom + .5)
      cut = p.className.toString().split(' ')[0];
  }
  // a ring of its own, or the field around it lights up (text fields)
  const lit = ring || cs.boxShadow !== 'none' || (e.closest('.field') && getComputedStyle(e.closest('.field')).boxShadow !== 'none');
  return {name: (e.getAttribute('aria-label') || e.textContent || e.id).replace(/\s+/g, ' ').trim().slice(0, 30), cut, lit, vis: e.checkVisibility()};
}"""


async def walk(pg, label):
    await pg.evaluate("() => { document.activeElement?.blur(); window.scrollTo(0, 0); }")
    stops, first = [], None
    for i in range(140):
        await pg.keyboard.press('Tab'); await pg.wait_for_timeout(30)
        s = await pg.evaluate(PROBE)
        if not s: continue
        if first is None: first = s['name']
        elif s['name'] == first and len(stops) > 3: break
        stops.append(s)
    cut = [f"{s['name']} ({s['cut']})" for s in stops if s['cut'] and s['lit']]
    dark = [s['name'] for s in stops if not s['lit']]
    hidden = [s['name'] for s in stops if not s['vis']]
    check(len(stops) >= 4, f'{label}: Tab goes through the screen ({len(stops)} stops)')
    check(not cut, f'{label}: no focus ring is cut by its card or scroller {cut}')
    check(not dark, f'{label}: every stop shows where focus is {dark}')
    check(not hidden, f'{label}: Tab never lands on something hidden {hidden}')
    return [s['name'] for s in stops]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (390, 1280):
            pg, errors = await page(b, width=w, height=860, db=DB, dark=w > 800)
            for t in ('Заварить', 'Дневник', 'Полка', 'Профиль'):
                await ns['tab'](pg, t); await pg.wait_for_timeout(700)
                names = await walk(pg, f'{w}px {t}')
                if t == 'Дневник':
                    check(any(n.startswith('Гуджи Ханджа') for n in names) and 'Все' in names, f'{w}px: the brews and the filter are reachable')
            check(not errors, f'{w}px: no page errors {errors}')
            await pg.context.close()

        # a whole round trip by keyboard: open a brew, Esc back, focus is on the same row again (phone and the wide layout)
        for w in (1280, 390):
            pg, errors = await page(b, width=w, height=860, db=DB)
            await ns['tab'](pg, 'Дневник'); await pg.wait_for_timeout(700)
            row = pg.locator(':is(.pane-list, .tab-page:not(.leaving)) button.row:visible').nth(1)
            await row.focus(); name = (await row.inner_text()).split('\n')[0]
            await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
            title = await pg.evaluate('() => document.title')
            check(title.startswith(name), f'{w}px: Enter opens the brew ({title})')
            h = await pg.evaluate("() => [document.activeElement.tagName, document.activeElement.textContent]")
            check(h == ['H1', name], f'{w}px: focus moves to the opened card, onto its title {h}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
            f = await pg.evaluate("() => [document.activeElement.className, document.activeElement.textContent, document.title]")
            check(f[0].startswith('row') and f[1].startswith(name) and f[2].startswith('Дневник'), f'{w}px: Esc goes back and focus returns to that row {f[:1]}')
            if w > 800: await pg.context.close()
        # Esc in a text field leaves the field, it doesn't leave the screen
        await ns['tab'](pg, 'Профиль'); await pg.wait_for_timeout(500)
        await pg.locator('button:visible:has-text("Настроить")').first.click(); await pg.wait_for_timeout(500)
        await pg.locator('#profile-name').focus(); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        still = await pg.locator('#profile-name').count()
        check(still == 1 and await pg.evaluate("() => document.activeElement === document.body"), 'Esc in a field only leaves the field')
        check(not errors, f'no page errors {errors}')
        await b.close()
    done()

asyncio.run(main())
