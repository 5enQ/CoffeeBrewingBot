"""UI guard: what a change does to the screens it was not meant to touch.

Each screen is opened with the same data at the same frozen moment, and every element that shows something
(text, a control, an icon, a surface with a background or an edge) is measured: its font, color, size, padding,
corners, and where it sits against its neighbor. The result is compared with tests/e2e/ui-baseline/*.json, and
every difference is listed — «Дневник › .stats b "2": font-size 22 → 12». So a fix to one label that also
shrinks a number shows up as a second line nobody expected.

    python3 ui_snapshot.py            compare with the baseline (fails on any difference)
    UPDATE=1 python3 ui_snapshot.py   write the current state as the new baseline

After an intended change: run it, check that the listed differences are exactly the intended ones, then run with
UPDATE=1 and commit the baseline with the change; the baseline diff in the commit shows what moved.
The baseline belongs to this test machine (fonts differ between systems); it is not run in GitHub Actions.
"""
import asyncio, json, os, pathlib, time
from common import KEY, URL, async_playwright, check, done

BASE = pathlib.Path(__file__).resolve().parent / 'ui-baseline'
UPDATE = os.environ.get('UPDATE') == '1'
NOW = 1794301200000  # 2026-11-10 12:00 MSK — dates and «days after roast» stay the same on every run
DAY = 86400000

# ---------- the data every screen is shown with ----------

def _bean(id, name, roast_days_ago, **extra):
    roast = time.strftime('%Y-%m-%d', time.gmtime((NOW - roast_days_ago * DAY) / 1000))
    return {'id': id, 'name': name, 'roaster': 'Обжарщик', 'country': 'Эфиопия', 'region': 'Гуджи', 'farm': '', 'producer': '',
            'variety': 'Heirloom', 'process': 'Мытая', 'altitude': '2000 м', 'harvest': '', 'roastLevel': 'Светлая', 'roastDate': roast,
            'weight': '250', 'barcode': '', 'link': '', 'packNotes': 'жасмин, бергамот', 'comment': '', 'createdAt': NOW - 40 * DAY, **extra}

def _brew(id, days_ago, bean, rating, **extra):
    return {'id': id, 'date': NOW - days_ago * DAY, 'methodId': 'v60', 'beanId': bean, 'dose': 15, 'water': 250, 'temp': 93,
            'grind': 'средний', 'time': 180, 'rating': rating, 'taste': {'acidity': 3, 'sweetness': 4, 'bitterness': 2, 'body': 3},
            'descriptors': ['цитрус'], 'notes': 'Ярко и чисто', 'cupping': None, **extra}

CUPPING = {'scores': {k: 7.75 for k in ('fragrance', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'overall')},
           'intensity': {}, 'cups': {k: [True] * 5 for k in ('uniformity', 'cleanCup', 'sweetness')},
           'defects': {'taintCups': 0, 'faultCups': 0}, 'descriptors': ['цитрус'], 'notes': ''}

DB = {'v': 1, 'seeded': True, 'gearSeeded': True, 'recipes': {},
      'profile': {'name': 'Аня Кофеман', 'about': 'Пуроверы по утрам', 'telegram': 'anya', 'badges': [], 'shareTelegram': True, 'shareBadges': True},
      'gear': [{'id': 'g1', 'cat': 'grinder', 'name': 'Comandante C40', 'details': '', 'grindType': 'hand'},
               {'id': 'g2', 'cat': 'dripper', 'name': 'Hario V60 02', 'details': ''}],
      'beans': [_bean('b1', 'Гуджи Ханджа', 12), _bean('b2', 'Кения Ньери', 60, finished=True, finishedAt=NOW - 30 * DAY)],
      'brews': [_brew('r1', 0, 'b1', 5), _brew('r2', 1, 'b1', 4), _brew('r3', 3, None, 3), _brew('r4', 35, 'b2', 4, cupping=CUPPING)],
      'custom': [{'id': 'c1', 'methodId': 'v60', 'name': 'Мой утренний', 'dose': 15, 'ratio': 16, 'temp': 94, 'grind': 'средний', 'total': 180,
                  'steps': [{'at': 0, 'title': 'Блум', 'to': 0.2}, {'at': 45, 'title': 'Налить до конца', 'to': 1}], 'notes': '', 'createdAt': NOW - 5 * DAY}]}

# ---------- screens: how to get there from a fresh start ----------

async def tab(pg, name):
    # phone: the bottom bar; desktop: the side menu (the profile there is the person's own button)
    if await pg.locator('.side-nav').count() and await pg.locator('.side-nav').is_visible():
        if name == 'Профиль':
            return await pg.locator('.side-me').click()
        return await pg.locator('.side-nav button').filter(has_text=name).first.click()
    await pg.locator('.tabbar button').filter(has_text=name).first.click()

async def open_journal_brew(pg):
    await tab(pg, 'Дневник'); await pg.wait_for_timeout(300)
    await pg.locator('.tab-page:visible .row').first.click()

async def open_shelf(pg):
    await tab(pg, 'Полка'); await pg.wait_for_timeout(300)
    await pg.locator('.link-btn:visible:has-text("Показать")').first.click()

async def open_bean(pg):
    await tab(pg, 'Полка'); await pg.wait_for_timeout(300)
    await pg.locator('.bean-card:visible').first.click()

SCREENS = {
    'brew': lambda pg: tab(pg, 'Заварить'),
    'method': lambda pg: pg.locator('.method-card:visible:has-text("V60")').first.click(),
    'journal': lambda pg: tab(pg, 'Дневник'),
    'brew-detail': open_journal_brew,
    'shelf': open_shelf,
    'bean': open_bean,
    'profile': lambda pg: tab(pg, 'Профиль'),
}
# light and dark at phone width; high contrast; the desktop layout for the screens it changes most
VARIANTS = [('light', {}), ('dark', {'dark': True}), ('contrast', {'contrast': True})]
DESKTOP = ['journal', 'profile']

# ---------- measuring ----------

COLLECT = r"""() => {
  const R = (n) => Math.round(n * 2) / 2;
  const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const visible = (e, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01 && e.getClientRects().length > 0;
  const surface = (cs) => !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.backgroundImage !== 'none'
    || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || cs.boxShadow !== 'none' || cs.outlineStyle !== 'none';
  const CONTROL = /^(BUTTON|INPUT|TEXTAREA|SELECT|IMG|CANVAS|svg)$/;
  const sig = (e) => e.tagName.toLowerCase() + [...e.classList].map((c) => '.' + c).join('');
  const out = {}, seen = {};
  const walk = (e, parent, prevRect) => {
    let prev = prevRect;
    for (const c of e.children) {
      if (c.matches('.tab-page.leaving, script, style, template')) continue;
      // decorations (card scenes, sparkles) are hidden from readers and hold no words; icons are kept
      if (c.matches('[aria-hidden="true"]') && c.tagName !== 'svg' && !c.textContent.trim()) continue;
      const cs = getComputedStyle(c);
      if (!visible(c, cs)) continue;
      const box = c.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue; // text only for screen readers
      const text = own(c);
      const rec = !!text || CONTROL.test(c.tagName) || surface(cs);
      if (!rec) { prev = walk(c, parent, prev) ?? prev; continue; }
      const r = c.getBoundingClientRect();
      // where it is said: the section title it sits under, then the element and its own words
      const sec = c.closest('section')?.querySelector(':scope > .section-head h2, :scope > h2')?.textContent?.trim();
      // the path: the two nearest named (classed) ancestors, then the element itself
      const path = [];
      for (let a = c.parentElement; a && a !== document.body && path.length < 2; a = a.parentElement) if (a.classList.length) path.unshift(sig(a));
      let key = (sec ? `[${sec.slice(0, 24)}] ` : '') + [...path, sig(c)].join(' › ') + (text ? ` "${text.slice(0, 32)}"` : '');
      seen[key] = (seen[key] ?? 0) + 1;
      if (seen[key] > 1) key += ' #' + seen[key];
      const v = {
        w: R(r.width), h: R(r.height),
        x: R(r.left - (parent ? parent.rect.left : 0)),
        // the gap to the neighbor above (or the top of what holds it): a taller neighbor does not count as a move
        gap: R(r.top - (prev ? prev.bottom : parent ? parent.rect.top : 0)),
        bg: cs.backgroundColor, radius: cs.borderRadius, pad: cs.padding, border: parseFloat(cs.borderTopWidth) ? cs.borderTopWidth + ' ' + cs.borderTopColor : '',
        shadow: cs.boxShadow === 'none' ? '' : cs.boxShadow, outline: cs.outlineStyle === 'none' ? '' : cs.outlineWidth + ' ' + cs.outlineColor,
        opacity: cs.opacity,
      };
      if (text) Object.assign(v, { font: `${cs.fontSize} ${cs.fontWeight} / ${cs.lineHeight}`, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color, align: cs.textAlign });
      if (c.tagName === 'svg') v.stroke = cs.stroke + ' ' + cs.strokeWidth + ' ' + cs.color;
      out[key] = v;
      if (c.tagName !== 'svg') walk(c, { sig: sig(c), rect: r }, null);
      prev = r;
    }
    return prev;
  };
  walk(document.body, null, null);
  return out;
}"""

async def snapshot(b, screen, dark=False, contrast=False, width=390, css=None):
    ctx = await b.new_context(viewport={'width': width, 'height': 844}, color_scheme='dark' if dark else 'light',
                              reduced_motion='reduce', locale='ru-RU', timezone_id='Europe/Moscow')
    look = json.dumps({'theme': 'auto', 'contrast': contrast})
    await ctx.add_init_script(
        f"if(!sessionStorage.x){{localStorage.setItem('{KEY}', {json.dumps(json.dumps(DB))});"
        f"localStorage.setItem('brewbook.appearance', {json.dumps(look)});"
        "localStorage.setItem('brewbook.fold.recipes','1');localStorage.setItem('brewbook.fold.backup','1');sessionStorage.x=1}")
    # nothing from the network: the server rows read «нет связи» at once, every time
    await ctx.route(lambda u: not u.startswith('file:'), lambda r: r.abort())
    pg = await ctx.new_page()
    pg.set_default_timeout(8000)
    await pg.clock.set_fixed_time(NOW)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(500)
    await SCREENS[screen](pg); await pg.wait_for_timeout(700)
    if css:
        await pg.add_style_tag(content=css); await pg.wait_for_timeout(100)
    try:
        data = await pg.evaluate(COLLECT)
    finally:
        await ctx.close()
    return data, errors

def diff(old, new):
    lines = []
    for k in old.keys() - new.keys():
        lines.append(f'  gone: {k}')
    for k in new.keys() - old.keys():
        lines.append(f'  new:  {k}')
    for k in old.keys() & new.keys():
        ch = [f'{p} {old[k].get(p)} → {new[k].get(p)}' for p in sorted(old[k].keys() | new[k].keys()) if old[k].get(p) != new[k].get(p)]
        if ch:
            lines.append(f'  {k}: ' + '; '.join(ch))
    return sorted(lines)

async def main():
    BASE.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        runs = [(s, v, o, 390) for s in SCREENS for v, o in VARIANTS] + [(s, 'desktop', {}, 1100) for s in DESKTOP]
        reported = {}  # screen → the places that changed in its first variant, to say «the same» for the others
        for screen, variant, opts, width in runs:
            name = f'{screen}-{variant}'
            try:
                data, errors = await snapshot(b, screen, width=width, **opts)
            except Exception as e:  # a screen that cannot be reached is a failure of its own, the rest still run
                check(False, f'{name}: could not open the screen — {str(e).splitlines()[0][:160]}')
                continue
            check(not errors, f'{name}: no page errors {errors[:2]}')
            check(len(data) > 15, f'{name}: the screen has content ({len(data)} elements)')
            file = BASE / f'{name}.json'
            if UPDATE or not file.exists():
                file.write_text(json.dumps(data, ensure_ascii=False, indent=0, sort_keys=True) + '\n')
                print(f'  saved {name} ({len(data)} elements)')
                continue
            old = json.loads(file.read_text())
            lines = diff(old, data)
            places = {(l.split(': ')[0], tuple(sorted(c.split(' ')[0] for c in l.split(': ', 1)[1].split('; ')))) for l in lines}
            if lines and reported.get(screen) == places:
                check(False, f'{name}: the same {len(lines)} difference(s) as {screen}-{VARIANTS[0][0]}, in its colors')
                continue
            reported.setdefault(screen, places)
            check(not lines, f'{name}: same as the baseline' + ('' if not lines else f' — {len(lines)} difference(s):\n' + '\n'.join(lines[:40]) + ('\n  …' if len(lines) > 40 else '')))

        # the guard itself: the v1.7.2 slip (a label rule that also caught the rolling number) must be caught
        clean, _ = await snapshot(b, 'journal')
        broken, _ = await snapshot(b, 'journal', css='.stats span { font-size: 12px; }')
        lines = diff(clean, broken)
        check(any('.stats' in l and 'roll' in l and 'font' in l for l in lines), f'self-check: a shrunken stat number is reported ({len(lines)} line(s))')
        await b.close()
    done()

asyncio.run(main())
