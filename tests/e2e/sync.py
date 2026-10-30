"""Two-device sync through a simulated Telegram CloudStorage: fidelity, deletions, concurrent edits, gear snapshots."""
import asyncio, json, random, re
from common import async_playwright, check, done, local, page

random.seed(7)
CLOUD: dict[str, str] = {}

def cloud_get(keys): return {k: CLOUD[k] for k in keys if k in CLOUD}
def cloud_set(k, v):
    assert re.fullmatch(r'[A-Za-z0-9_-]{1,128}', k), k
    assert len(v) <= 4096, (k, len(v))
    CLOUD[k] = v
    assert len(CLOUD) <= 1024
def cloud_rm(keys):
    for k in keys: CLOUD.pop(k, None)

INIT = """window.__brewbookCloud = {
  getItems: (keys) => window.cloudGet(keys), setItem: (k, v) => window.cloudSet(k, v),
  removeItems: (keys) => window.cloudRm(keys), getKeys: async () => [] };"""
DESC = ['бергамот', 'персик', 'жасмин', 'карамель', 'черника', 'мёд', 'мой странный дескриптор']

def gen():
    now = 1792900000000
    gear = [{'id': f'g{i}', 'cat': c, 'name': n, 'details': d} for i, (c, n, d) in
            enumerate([('grinder', 'Comandante C40', 'Red Clix'), ('dripper', 'Hario V60 02', ''), ('kettle', 'Fellow Stagg EKG', '')])]
    beans = [{'id': f'bean{i}', 'name': f'Лот {i}', 'roaster': 'Обжарщик', 'country': 'Колумбия', 'region': 'Уила', 'farm': '', 'producer': '',
              'variety': 'Катурра', 'process': 'Мытая', 'altitude': '1800 м', 'roastLevel': 'Светлая', 'roastDate': '2026-10-01',
              'weight': '250', 'barcode': '', 'link': '', 'packNotes': 'клубника', 'comment': '', 'createdAt': now - i * 86400000} for i in range(20)]
    brews = [{'id': f'brew{i}', 'date': now - i * 3600 * 7 * 1000, 'methodId': random.choice(['v60', 'aeropress', 'batch', 'kalita']),
              'beanId': f'bean{i % 20}', 'dose': 15, 'water': 250, 'temp': 93.5, 'grind': '22 щелчка', 'grindValue': 22, 'grindUnit': 'clicks',
              'time': 180 + i % 30, 'rating': random.choice([0, 3.5, 4.5, 5]), 'taste': {'acidity': 3, 'sweetness': 3, 'bitterness': 2, 'body': 3},
              'descriptors': random.sample(DESC, 3), 'notes': random.choice(['', 'Чуть мельче.']), 'cupping': None,
              'gear': [{'id': 'g0', 'cat': 'grinder', 'name': 'Comandante C40', 'details': 'Red Clix'}, {'id': 'gOld', 'cat': 'kettle', 'name': 'Старый чайник'}]}
             for i in range(300)]
    brews.sort(key=lambda b: -b['date'])
    return {'v': 1, 'beans': beans, 'brews': brews, 'recipes': {'v60': {'dose': 15, 'ratio': 16, 'temp': 93, 'grind': '22', 'gear': ['g0']}},
            'gear': gear, 'seeded': True, 'gearSeeded': True, 'pinned': ['batch'],
            'profile': {'name': 'Тест', 'about': '', 'telegram': 'tester', 'badges': [], 'shareTelegram': False, 'shareBadges': True, 'layout': 'desktop'}}

async def device(b, db=None):
    pg, errors = await page(b, db=db, init=INIT)
    await pg.context.expose_function('cloudGet', cloud_get)
    await pg.context.expose_function('cloudSet', cloud_set)
    await pg.context.expose_function('cloudRm', cloud_rm)
    await pg.reload(); await pg.wait_for_timeout(3500)
    return pg, errors

def norm(x):
    x = json.loads(json.dumps(x)); x.pop('sample', None)
    if x.get('gear') is None: x.pop('gear', None)
    return x

async def wake(pg):
    await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(2500)

async def new_brew(pg, method):
    await pg.click('.tabbar >> text=Заварить'); await pg.wait_for_timeout(200)
    await pg.locator(f'.method-card:visible:has-text("{method}")').click(); await pg.wait_for_timeout(200)
    await pg.locator('.recipe-tile:visible').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('button:visible:has-text("Без таймера")').click(); await pg.wait_for_timeout(200)
    await pg.locator('button:visible:has-text("Сохранить")').click(); await pg.wait_for_timeout(300)
    await pg.locator('button:visible:has-text("Домой")').click(); await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A, ea = await device(b, gen())
        check(len(CLOUD) > 0 and 'idx' in CLOUD, f'device A uploaded {len(CLOUD)} keys')
        B, eb = await device(b)
        la, lb = await local(A), await local(B)
        check(len(lb['brews']) == len(la['brews']) == 300, f'B received all brews ({len(lb["brews"])})')
        A_br = {x['id']: norm(x) for x in la['brews']}
        check(sum(1 for x in lb['brews'] if A_br[x['id']] != norm(x)) == 0, 'brews are identical on both devices')
        A_bn = {x['id']: norm(x) for x in la['beans']}
        diffs = [(k, A_bn[x['id']].get(k), x.get(k)) for x in lb['beans'] for k in set(A_bn[x['id']]) | set(x) if (A_bn[x['id']].get(k) or '') != (norm(x).get(k) or '')]  # a missing field and its empty default are equal
        check(not diffs, f'packs are identical on both devices {diffs[:4]}')
        check(lb['profile'].get('layout') != 'desktop', 'layout preference is not synced')
        check(lb.get('pinned') == ['batch'], 'pins are synced')

        # deletion on B reaches A
        await B.click('.tabbar >> text=Дневник'); await B.wait_for_timeout(300)
        await B.locator('.row:visible').first.click(); await B.wait_for_timeout(300)
        await B.locator('[aria-label="Удалить"]:visible').click(); await B.wait_for_timeout(300)
        await B.locator('.dialog button:has-text("OK"), .dialog button:has-text("Да"), .dialog button:has-text("Удалить")').first.click()
        await B.wait_for_timeout(3000); await wake(A)
        check(len((await local(A))['brews']) == 299, 'deletion on B reaches A')

        # concurrent brews on both devices
        await B.locator('[aria-label="Назад"]:visible').first.click() if await B.locator('[aria-label="Назад"]:visible').count() else None
        await new_brew(A, 'Кемекс'); await new_brew(B, 'Сифон')
        await A.wait_for_timeout(3000); await B.wait_for_timeout(3000)
        await wake(A); await wake(B); await wake(A)
        la, lb = await local(A), await local(B)
        both = lambda d: sum(1 for x in d['brews'] if x['methodId'] in ('chemex', 'siphon'))
        check(both(la) == 2 and both(lb) == 2, f'concurrent brews merged (A {both(la)}, B {both(lb)})')

        # renamed gear: old brews keep the old name
        await A.click('.tabbar >> text=Профиль'); await A.wait_for_timeout(300)
        await A.locator('.row:visible:has-text("Comandante C40")').first.click(); await A.wait_for_timeout(300)
        await A.fill('#gear-name', 'Comandante C40 Nitro'); await A.locator('button:visible:has-text("Сохранить")').click()
        await A.wait_for_timeout(3000); await wake(B)
        lb = await local(B)
        check('Comandante C40 Nitro' in [g['name'] for g in lb['gear']], 'gear rename synced')
        names = {g['name'] for x in lb['brews'] if x['id'].startswith('brew') for g in (x.get('gear') or []) if g['id'] == 'g0'}
        check(names == {'Comandante C40'}, f'old brews keep the gear name they were brewed with ({names})')
        check(not ea and not eb, f'no page errors: {(ea + eb)[:3]}')
        await b.close()
    done()

asyncio.run(main())
