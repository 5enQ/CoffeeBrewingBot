"""Shared helpers for browser tests. They run against dist-single/index.html (npm run build:single)."""
import json, pathlib, sys
from playwright.async_api import async_playwright  # noqa: F401  (re-exported for tests)

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'dist-single' / 'index.html').as_uri()
KEY = 'brewbook.db.v1'
OUT = ROOT / 'tests' / 'e2e' / 'out'

FAILS: list[str] = []


def check(cond, msg):
    """Soft assertion: collect failures and keep going so one run shows everything."""
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond:
        FAILS.append(msg)


def done():
    if FAILS:
        print(f'\n{len(FAILS)} check(s) failed')
        sys.exit(1)
    print('\nall checks passed')


async def page(browser, width=390, height=844, dark=False, db=None, init=None):
    ctx = await browser.new_context(viewport={'width': width, 'height': height}, color_scheme='dark' if dark else 'light')
    if init:
        await ctx.add_init_script(init)
    if db is not None:
        await ctx.add_init_script(f"if(!sessionStorage.x){{localStorage.setItem('{KEY}', {json.dumps(json.dumps(db))}); sessionStorage.x=1}}")
    pg = await ctx.new_page()
    errors: list[str] = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    await pg.goto(URL)
    await pg.wait_for_timeout(600)
    return pg, errors


async def local(pg):
    return json.loads(await pg.evaluate(f"localStorage.getItem('{KEY}')"))
