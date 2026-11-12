"""Accessibility fixes (WCAG 2.2 review): a ring on the field being typed into, fields named for screen readers,
a real modal confirm, focus clear of the bottom bar, a new screen takes focus and names the tab, segmented controls
read as pressed buttons, one live region for popups, a switch that stills the backgrounds, autofill for name and
nick, 16 px fields (no iPhone zoom), short fades under reduced motion, the profile buttons fit a 320 px phone."""
import asyncio
from common import async_playwright, check, done, page

src = open('ui_snapshot.py').read().split('# ---------- screens')[0]
ns = {'__file__': __file__}; exec(src, ns)
DB = ns['DB']


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        live = await pg.evaluate("() => [...document.querySelectorAll('[role=status]')].map((e) => e.textContent)")
        check(live == [''], f'one empty live region is there from the start ({live})')

        # open a brew from the journal with the keyboard: focus lands on its heading, the tab title follows
        await pg.click('.tabbar >> text=Дневник'); await pg.wait_for_timeout(700)
        await V('.tab-page:not(.leaving) button.row').first.focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        f = await pg.evaluate("() => [document.activeElement.tagName, document.activeElement.textContent, document.title]")
        check(f[0] == 'H1' and f[2] == f'{f[1]} · Brewbook', f'a new screen takes focus on its heading and names the tab {f}')

        # the delete confirm is a modal: Tab stays inside, Esc says no, focus returns to the button
        await V('[aria-label="Удалить"]').first.focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        snap = (await pg.locator('.dialog').aria_snapshot()).splitlines()[0]
        check(snap.startswith('- alertdialog "'), f'the confirm is named by its question ({snap})')
        inside = []
        for _ in range(4):  # past the last button focus may go out to the browser itself, never to the page under
            await pg.keyboard.press('Tab')
            inside.append(await pg.evaluate("() => !!document.activeElement.closest('.dialog') || document.activeElement === document.body"))
        check(all(inside), f'Tab never reaches the page under the confirm {inside}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        st = await pg.evaluate("() => [!!document.querySelector('.dialog'), document.activeElement.getAttribute('aria-label'), document.querySelector('.tabbar, .screen') && [...document.querySelectorAll('[inert]')].length]")
        check(st[:2] == [False, 'Удалить'], f'Esc closes it and focus goes back to «Удалить» {st}')

        # edit: the focused field shows a ring; notes are named; a focused control clears the footer
        await V('.footer-actions .btn-secondary').first.click(); await pg.wait_for_timeout(500)
        await V('.field input').first.focus()
        ring = await V('.field input').first.evaluate("e => getComputedStyle(e.closest('.field')).boxShadow")
        check('2px' in ring, f'the field being typed into has a ring ({ring})')
        name = (await V('#brew-notes').first.aria_snapshot()).splitlines()[0]
        check('"Заметки"' in name, f'the notes field has a name ({name})')
        for _ in range(60):
            await pg.keyboard.press('Tab')
            r = await pg.evaluate("() => { const e = document.activeElement, f = [...document.querySelectorAll('.footer')].find((x) => x.getClientRects().length); if (!f || !e || e.closest('.footer')) return null; const a = e.getBoundingClientRect(), b = f.getBoundingClientRect(); return a.top >= b.top ? [e.getAttribute('aria-label') || e.tagName, Math.round(a.top), Math.round(b.top)] : null; }")
            if r: break
        check(r is None, f'no focused control hides under the footer ({r})')

        # profile: segmented as pressed buttons, the backgrounds switch, the 16 px paste field
        while await V('[aria-label="Назад"]').count():
            await V('[aria-label="Назад"]').first.click(); await pg.wait_for_timeout(400)
        await pg.click('.tabbar >> text=Профиль'); await pg.wait_for_timeout(700)
        seg = (await V('.look-card .segmented').first.aria_snapshot()).splitlines()
        check(seg[0].startswith('- group "Тема"') and '[pressed]' in seg[1], f'theme choice reads as pressed buttons {seg[:2]}')
        await V('label[for="backgrounds-move"]').click(); await pg.wait_for_timeout(200)
        check(await pg.evaluate("() => document.documentElement.hasAttribute('data-still')"), '«Анимация фонов» off stills the backgrounds')
        await V('label[for="backgrounds-move"]').click(); await pg.wait_for_timeout(200)
        check(not await pg.evaluate("() => document.documentElement.hasAttribute('data-still')"), 'and on again lets them move')
        fs = await pg.locator('#backup-paste').evaluate('e => getComputedStyle(e).fontSize')
        check(fs == '16px', f'the backup paste field is 16 px ({fs})')
        await V('button:has-text("Настроить")').first.click(); await pg.wait_for_timeout(500)
        ac = await pg.evaluate("() => ['#profile-name', '#profile-tg'].map((s) => document.querySelector(s).autocomplete)")
        check(ac == ['name', 'username'], f'name and nick offer autofill {ac}')
        check(not errors, f'no page errors {errors}')

        # reduced motion: a new timer step fades in rather than switching unseen
        pg2, err2 = await page(b, db=DB)
        await pg2.emulate_media(reduced_motion='reduce')
        await pg2.locator('.method-card:visible:has-text("V60")').first.click(); await pg2.wait_for_timeout(300)
        await pg2.locator('.recipe-tile:visible').first.click(); await pg2.wait_for_timeout(400)
        await pg2.locator('button:visible:has-text("Начать")').last.click(); await pg2.wait_for_timeout(500)
        st = pg2.locator('button:visible:has-text("Старт")')
        if await st.count(): await st.first.click()
        await pg2.wait_for_timeout(300)
        await pg2.locator('.step-skip:visible').click(); await pg2.wait_for_timeout(100)
        anim = await pg2.evaluate("() => [...document.querySelectorAll('.step-now .swap-l')].map((e) => getComputedStyle(e).animationName)")
        check(anim and all(a == 'calm-in' for a in anim), f'reduced motion: the new step fades in {anim}')

        # the timer on a short phone (360×640): the step card and «Дальше» fit above the footer, no scrolling to reach them
        pg4, err4 = await page(b, db=DB, width=360, height=640)
        await pg4.locator('.method-card:visible:has-text("V60")').first.click(); await pg4.wait_for_timeout(300)
        await pg4.locator('.recipe-tile:visible').first.click(); await pg4.wait_for_timeout(400)
        await pg4.locator('button:visible:has-text("Начать")').last.click(); await pg4.wait_for_timeout(500)
        st = pg4.locator('button:visible:has-text("Старт")')
        if await st.count(): await st.first.click()
        await pg4.wait_for_timeout(600)
        fit = await pg4.evaluate("""() => { const v = (s) => [...document.querySelectorAll(s)].find((e) => e.getClientRects().length);
          return [Math.round(v('.step-skip').getBoundingClientRect().bottom), Math.round(v('.footer').getBoundingClientRect().top)]; }""")
        check(fit[0] <= fit[1], f'360×640: «Дальше» is above the footer without scrolling {fit}')

        # 320 px: «Поделиться» and «Настроить» stay inside the screen
        pg3, err3 = await page(b, db=DB, width=320)
        await pg3.click('.tabbar >> text=Профиль'); await pg3.wait_for_timeout(400)
        over = await pg3.evaluate("() => Math.max(...[...document.querySelectorAll('.my-card-actions .btn')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right)) - innerWidth")
        check(over <= -8, f'320 px: the profile buttons stay inside the screen ({over:+.0f}px)')
        await b.close()
    done()

asyncio.run(main())
