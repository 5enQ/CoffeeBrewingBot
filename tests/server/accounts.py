"""Accounts API against a local worker (tests/server/run.sh starts it): counting, deletions, cards, forgery attempts, diamond numbers."""
import json, os, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from initdata import sign
FAILS = []
def post(path, body):
    req = urllib.request.Request('http://localhost:8799' + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e: return {'status': e.code, **json.loads(e.read() or b'{}')}
def get(path): return json.loads(urllib.request.urlopen('http://localhost:8799' + path).read())
DAY = 86400000; T0 = int(time.time() * 1000) - 300 * DAY
def ok(c, m):
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: FAILS.append(m)
A, B = sign(111), sign(222)
me = post('/me', {'initData': A}); ok(me.get('account') and me['methods'] == {}, f'account created {me.get("account")}')
again = post('/me', {'initData': A}); ok(again['account'] == me['account'], 'same Telegram user → same account')
hist = [{'id': f'v{i}', 'm': 'v60', 'w': 250, 't': T0 + i * DAY} for i in range(120)] + [{'id': f'x{i}', 'm': 'v60', 'w': 250, 't': T0 + 5 * DAY + i} for i in range(10)]
s = post('/brews', {'initData': A, 'brews': hist}); ok(s['methods'].get('v60') == 124, f'history import with the per-day limit: {s["methods"]}')
s = post('/brews', {'initData': A, 'brews': [], 'removed': ['v0', 'v1']}); ok(s['methods']['v60'] == 122, 'deleted brews stop counting')
s = post('/brews', {'initData': A, 'brews': [{'id': 'bad id!', 'm': 'v60', 'w': 1, 't': T0}]}); ok(s['methods']['v60'] == 122, 'malformed brews are ignored')
fake = {'name': 'Аня', 'theme': {'ach': 'method:v60'}, 'ach': ['method:v60', 'method:espresso', 'liters'],
        'badges': [{'kind': 'achieve', 'title': 'Эспрессо · 1000 заварок', 'detail': 'Объёмный'}, {'kind': 'sca', 'title': 'SCA Brewing'}],
        'earned': {'method:espresso': {'tier': 'volume', 'at': 1000}}, 'no': 1}
cid = post('/cards', {'initData': A, 'card': fake})['id']
c = get(f'/cards/{cid}')['card']
ok(c['earned'] == {'method:v60': {'tier': 'silver', 'at': 100}, 'liters': {'tier': 'bronze', 'at': 10}}, f'server fills levels from its count only (30 L → liters bronze): {c["earned"]}')
ok(c['ach'] == ['method:v60', 'liters'] and [b['title'] for b in c['badges']] == ['SCA Brewing'], 'the fake espresso achievement and the hand-written achievement badge are dropped')
ok('no' not in c, 'no diamond number without 1000 liters')
fake2 = {'name': 'Боб', 'theme': {'ach': 'liters'}, 'ach': []}
cid2 = post('/cards', {'initData': B, 'card': fake2})['id']
ok(get(f'/cards/{cid2}')['card']['theme'] == {'base': 'paper'}, 'diamond background without the liters → default background')
big = [{'id': f'b{i}', 'm': 'batch', 'w': 3000, 't': T0 + (i // 2) * DAY + i} for i in range(400)]
sb = post('/brews', {'initData': B, 'brews': big}); ok(sb['liters'] >= 1000 and sb.get('diamondNo') == 1, f'1000 liters → diamond № {sb.get("diamondNo")} ({sb["liters"]} L)')
c2 = get(f'/cards/{cid2}')['card']; ok(c2['theme'] == {'ach': 'liters'} and c2.get('no') == 1 and c2['earned']['liters']['tier'] == 'diamond', 'diamond card with the server number')
sa = post('/brews', {'initData': A, 'brews': [{'id': f'a{i}', 'm': 'batch', 'w': 3000, 't': T0 + (i // 2) * DAY + i} for i in range(400)]})
ok(sa.get('diamondNo') == 2, f'second person → № {sa.get("diamondNo")}')
ok(post('/brews', {'initData': B, 'brews': []}).get('diamondNo') == 1, 'the number never changes')
ok(post('/me', {'initData': 'forged'}).get('status') == 401, 'forged Telegram data is rejected')

print('\n' + (f'{len(FAILS)} check(s) failed' if FAILS else 'all checks passed'))
sys.exit(1 if FAILS else 0)
