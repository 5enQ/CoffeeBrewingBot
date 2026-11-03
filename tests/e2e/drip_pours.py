"""Drip recipe by pours: no coffee or ratio, the water, time and steps come from the pours; the timer skips to the next step."""
import asyncio
from common import async_playwright, check, done, local, page

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {}, 'brews': [], 'gear': [],
      'beans': [{'id': 'box', 'name': 'Кения дрип', 'kind': 'drip', 'dripCount': 5, 'roastDate': '', 'country': 'Кения', 'createdAt': 1}],
      'profile': {'name': 'Аня', 'badges': []}}

async def setv(pg, label, value):
    await pg.locator(f'[aria-label="{label}: ввести вручную"]:visible').click()
    inp = pg.locator(f'input.stepper-input[aria-label="{label}"]')
    await inp.fill(str(value)); await inp.press('Enter'); await pg.wait_for_timeout(100)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg, errors = await page(b, db=DB)
        V = lambda s: pg.locator(s + ':visible')
        await V('.method-card:has-text("Дрип")').click(); await pg.wait_for_timeout(300)
        await V('.recipe-tile').first.click(); await pg.wait_for_timeout(300)
        check(await V('.stepper:has-text("Пропорция")').count() == 0, 'brewing a drip: no ratio')
        await V('button:has-text("Изменить под себя")').click(); await pg.wait_for_timeout(300)
        check(await V('.stepper:has-text("Кофе")').count() == 0 and await V('.stepper:has-text("Пропорция")').count() == 0, 'drip recipe: no coffee and no ratio')
        check(await V('#recipe-grind').count() == 0, 'drip recipe: no grind (the bag has it)')
        await setv(pg, 'Проливов', 4); await setv(pg, 'Воды в проливе', 40); await setv(pg, 'Пауза между проливами', 20)
        summary = await V('#pour-sum').inner_text()
        # 4 × 40 g; a 40 g pour takes 10 s: 4 × (10 + 20) = 2:00
        check('160' in summary and '2:00' in summary, f'water and time are counted: {summary!r}')
        steps = await V('.pour-steps li').all_inner_texts()
        check(len(steps) == 8 and 'Пролив 1' in steps[0] and 'Пауза' in steps[1] and 'Пролив 4' in steps[6] and 'Дать стечь' in steps[7], f'steps are built: {steps}')
        check('0:30' in steps[2] and '120' in steps[4], f'pour 2 at 0:30, pour 3 up to 120 g: {steps[2]!r} {steps[4]!r}')
        await pg.screenshot(path='out/drip-pours-recipe.png', full_page=True)
        await pg.fill('#recipe-name', 'Четыре по сорок')
        await V('button:has-text("Сохранить рецепт")').click(); await pg.wait_for_timeout(400)
        db = await local(pg)
        r = db['custom'][0]
        check(r.get('pours') == {'count': 4, 'ml': 40, 'pause': 20} and r['total'] == 120 and round(r['dose'] * r['ratio']) == 160, f'saved: {r.get("pours")}, {r["total"]} s')
        water = await V('.stepper:has-text("Вода") .stepper-value').inner_text()
        check('160' in water, f'the method screen takes the water from the recipe: {water!r}')

        await V('button:has-text("Начать")').click(); await pg.wait_for_timeout(300)
        check(await V('.step-skip').count() == 0, 'no skip before the start')
        await V('button:has-text("Старт")').click(); await pg.wait_for_timeout(1200)
        check('Пролив 1' in await V('.step-now h2').inner_text(), 'starts with the first pour')
        await V('.step-skip').click(); await pg.wait_for_timeout(200)
        check('Пауза' in await V('.step-now h2').inner_text(), 'skip: the pause comes now')
        await V('.step-skip').click(); await pg.wait_for_timeout(200)
        now = await V('.step-now').inner_text()
        check('Пролив 2' in now and '80' in now, f'skip again: the second pour, up to 80 g ({now!r})')
        await pg.screenshot(path='out/drip-pours-timer.png')
        t = await V('.timer-time').inner_text()
        check(t.startswith('0:3'), f'the plan clock moved to the step ({t})')
        await pg.wait_for_timeout(1500)
        check('Пролив 2' in await V('.step-now h2').inner_text(), 'and runs on from there')
        await V('[aria-label="Готово, записать"]').click(); await pg.wait_for_timeout(300)
        await V('button:has-text("Сохранить")').click(); await pg.wait_for_timeout(400)
        brew = (await local(pg))['brews'][0]
        check(brew['time'] <= 5, f'the brew keeps the real time, not the skipped one ({brew["time"]} s)')
        check(not errors, f'no page errors: {errors[:3]}')
        await b.close()
    done()

asyncio.run(main())
