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
s = post('/brews', {'initData': A, 'brews': hist}); ok(s['methods'].get('v60') == 130, f'history import, no daily cap: {s["methods"]}')
s = post('/brews', {'initData': A, 'brews': [], 'removed': ['v0', 'v1']}); ok(s['methods']['v60'] == 128, 'deleted brews stop counting')
s = post('/brews', {'initData': A, 'brews': [{'id': 'bad id!', 'm': 'v60', 'w': 1, 't': T0}]}); ok(s['methods']['v60'] == 128, 'malformed brews are ignored')
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
ok(sa.get('diamondNo') == 0 and {'dev', 'tester'} <= set(sa['grants']), f'the owner is a tester automatically: diamond № {sa.get("diamondNo")}, grants {sa.get("grants")}')
E = sign(555)
se = post('/brews', {'initData': E, 'brews': [{'id': f'e{i}', 'm': 'batch', 'w': 3000, 't': T0 + (i // 2) * DAY + i} for i in range(400)]})
ok(se.get('diamondNo') == 2, f'the next real person → № {se.get("diamondNo")} (the owner did not take a number)')
ok(post('/brews', {'initData': B, 'brews': []}).get('diamondNo') == 1, 'the number never changes')
ok(post('/me', {'initData': 'forged'}).get('status') == 401, 'forged Telegram data is rejected')

# developers' background: only the owner (111) gives it
C = sign(333)
cid3 = post('/cards', {'initData': C, 'card': {'name': 'Разраб', 'theme': {'special': 'dev'}, 'ach': [], 'granted': ['dev']}})['id']
ok(get(f'/cards/{cid3}')['card']['theme'] == {'base': 'paper'}, 'a self-declared developers background is not shown')
ok(post('/admin', {'initData': C, 'action': 'grant', 'tg': '333', 'what': 'dev'}).get('status') == 403, 'a non-owner cannot give it')
g = post('/admin', {'initData': A, 'action': 'grant', 'tg': '333', 'what': 'dev'})
ok(any(x['tg'] == '333' and 'dev' in x['grants'] for x in g.get('grants', [])), 'the owner gives it by Telegram id')
c3 = get(f'/cards/{cid3}')['card']; ok(c3['theme'] == {'special': 'dev'} and c3['granted'] == ['dev'], 'then the card shows it')
ok('dev' in post('/me', {'initData': C})['grants'], 'the person sees it in their numbers')
ok('tester' not in post('/me', {'initData': C})['grants'], 'grants are separate: dev does not give tester')
tc = post('/cards', {'initData': C, 'card': {'name': 'Т', 'theme': {'ach': 'method:v60', 'tier': 'volume'}, 'ach': []}})['id']
ok(get(f'/cards/{tc}')['card']['theme'] == {'base': 'paper'}, 'without tester a chosen level is ignored')
post('/admin', {'initData': A, 'action': 'grant', 'tg': '333', 'what': 'tester'})
t1 = get(f'/cards/{tc}')['card']
ok(t1['theme'] == {'ach': 'method:v60'} and t1['earned']['method:v60'] == {'tier': 'volume', 'at': 1000}, f'a tester shows any level: {t1["earned"]}')
oc = post('/cards', {'initData': A, 'card': {'name': 'Владелец', 'theme': {'ach': 'liters', 'tier': 'diamond'}, 'ach': []}})['id']
o1 = get(f'/cards/{oc}')['card']; ok(o1.get('no') == 0 and o1['earned']['liters']['tier'] == 'diamond', 'owner test diamond shows № 0')
ok(post('/admin', {'initData': A, 'action': 'grant', 'tg': '333', 'what': 'gold-forever'}).get('status') == 400, 'unknown special backgrounds are refused')
# one card per person: put the developers card back, then take the grant away
post('/cards', {'initData': C, 'card': {'name': 'Разраб', 'theme': {'special': 'dev'}, 'ach': []}})
ok(get(f'/cards/{cid3}')['card']['theme'] == {'special': 'dev'}, 'the same link shows the updated card')
post('/admin', {'initData': A, 'action': 'revoke', 'tg': '333', 'what': 'dev'})
ok(get(f'/cards/{cid3}')['card']['theme'] == {'base': 'paper'}, 'taken away → the card falls back to the default')
ok('tester' in post('/me', {'initData': C})['grants'], 'taking dev away keeps the separate tester grant')

# testers' background and the owner's notes
ok('beta' in sa['grants'], 'the owner has the testers background too')
g = post('/admin', {'initData': A, 'action': 'grant', 'tg': '444', 'what': 'beta'})
p444 = next((x for x in g.get('grants', []) if x['tg'] == '444'), None)
ok(p444 and p444['grants'] == ['beta'] and not p444.get('username'), 'testers background given to someone who never opened the app')
g = post('/admin', {'initData': A, 'action': 'note', 'tg': '444', 'note': '  Аня,   бариста из Kojo ', 'username': '@anya_tests'})
p444 = next(x for x in g['grants'] if x['tg'] == '444')
ok(p444.get('note') == 'Аня, бариста из Kojo' and p444.get('username') == 'anya_tests', f'the owner signs a person and adds their @username ({p444})')
ok(post('/admin', {'initData': C, 'action': 'note', 'tg': '444', 'note': 'x'}).get('status') == 403, 'only the owner signs people')
D = sign(444, username='anya_real', first_name='Анна')
ok('beta' in post('/me', {'initData': D})['grants'], 'the tester sees the background in their numbers')
p444 = next(x for x in post('/admin', {'initData': A, 'action': 'list'})['grants'] if x['tg'] == '444')
ok(p444.get('username') == 'anya_real' and p444.get('name') == 'Анна' and p444.get('note') == 'Аня, бариста из Kojo', f'opening the app fills the real @username and name, the note stays ({p444})')
cid4 = post('/cards', {'initData': D, 'card': {'name': 'Аня', 'theme': {'special': 'beta'}, 'ach': [], 'granted': ['beta']}})['id']
ok(get(f'/cards/{cid4}')['card']['theme'] == {'special': 'beta'}, 'the testers card is shown')
g = post('/admin', {'initData': A, 'action': 'revoke', 'tg': '444', 'what': 'beta'})
ok(any(x['tg'] == '444' and x['grants'] == [] for x in g['grants']), 'a signed person stays in the list after their grants are taken away')
ok(post('/admin', {'initData': C, 'action': 'forget', 'tg': '444'}).get('status') == 403, 'only the owner removes people from the list')
g = post('/admin', {'initData': A, 'action': 'forget', 'tg': '444'})
ok(not any(x['tg'] == '444' for x in g['grants']), 'the owner removes a person from the list')
ok(get(f'/cards/{cid4}').get('card') is not None, 'their card stays (only grants and the note are gone)')

# rare lots: one brew of a Japanese pack opens its picture; unknown tags are dropped; a claimed picture without the brew is refused
F = sign(555); now = int(time.time() * 1000)
cf = post('/cards', {'initData': F, 'card': {'name': 'Ф', 'theme': {'rare': 'japan'}, 'ach': [], 'granted': ['japan']}})['id']
ok(get(f'/cards/{cf}')['card']['theme'] == {'base': 'paper'}, 'a rare picture without the brew is not shown')
sf = post('/brews', {'initData': F, 'brews': [{'id': 'f1', 'm': 'v60', 'w': 250, 't': now, 'x': 'japan,gold-forever'}]})
ok(sf.get('rare') == ['japan'], f'one brew of a Japanese pack counts, unknown tags dropped: {sf.get("rare")}')
post('/cards', {'initData': F, 'card': {'name': 'Ф', 'theme': {'rare': 'japan'}, 'ach': [], 'granted': ['japan']}})
cj = get(f'/cards/{cf}')['card']; ok(cj['theme'] == {'rare': 'japan'} and 'japan' in cj.get('granted', []), f'then the card shows it: {cj["theme"]}')
post('/cards', {'initData': F, 'card': {'name': 'Ф', 'theme': {'rare': 'liberica'}, 'ach': [], 'granted': ['liberica']}})
ok(get(f'/cards/{cf}')['card']['theme'] == {'base': 'paper'}, 'another rare picture stays closed')
sf = post('/brews', {'initData': F, 'brews': [{'id': 'f1', 'm': 'v60', 'w': 250, 't': now}]})
ok(sf.get('rare') == [], 'the pack edited to a plain lot: the brew no longer opens it')
# the lighthouse is given by the owner
ok(post('/admin', {'initData': A, 'action': 'grant', 'tg': '555', 'what': 'lighthouse'}).get('grants') is not None, 'the owner gives the lighthouse')
post('/cards', {'initData': F, 'card': {'name': 'Ф', 'theme': {'special': 'lighthouse'}, 'ach': [], 'granted': ['lighthouse']}})
ok(get(f'/cards/{cf}')['card']['theme'] == {'special': 'lighthouse'}, 'the lighthouse card is shown')

# metrics: counts only, the owner's own use left out
G = sign(666)
ok(post('/track', {'initData': 'forged', 'events': {'timer.start': 1}}).get('status') == 401, 'counters need a signed Telegram user')
ok(post('/track', {'initData': G, 'events': {'timer.start': 3, 'timer.skip': 1000, 'who.am.i': 5, 'brew.manual': -4}}).get('counted') == 2, 'only known counters, positive ones')
post('/track', {'initData': A, 'events': {'timer.start': 7}})
post('/brews', {'initData': G, 'brews': [{'id': 'g1', 'm': 'drip', 'w': 160, 't': int(time.time() * 1000)}]})
ok(post('/admin', {'initData': G, 'action': 'metrics'}).get('status') == 403, 'only the owner sees the metrics')
mx = post('/admin', {'initData': A, 'action': 'metrics'})
ok(mx['features'].get('timer.start') == 3 and mx['features'].get('timer.skip') == 50, f'counters add up, capped per report, the owner not counted: {mx["features"]}')
ok('who.am.i' not in mx['features'], 'unknown names are not kept')
drip = next((x for x in mx['brews']['methods'] if x['id'] == 'drip'), None)
ok(drip and drip['d30'] >= 1, f'brews by method: {mx["brews"]["methods"][:3]}')
ok(mx['users']['seen1'] >= 2 and mx['days'][-1]['active'] >= 2 and mx['users']['brewing7'] >= 1, f'people today: {mx["users"]}, {mx["days"][-1]}')
post('/brews', {'initData': A, 'brews': [{'id': f'ad{i}', 'm': 'drip', 'w': 160, 't': int(time.time() * 1000) - i} for i in range(5)]})
mx2 = post('/admin', {'initData': A, 'action': 'metrics'})
ok(next(x for x in mx2['brews']['methods'] if x['id'] == 'drip')['d30'] == drip['d30'], "the owner's own brews are left out")
txt = json.dumps(mx)
ok('"666"' not in txt and '"111"' not in txt and 'account' not in txt, 'no Telegram ids or accounts in the metrics')

# «Стакан» for 500 liters
E = sign(557)
hist = [{'id': f'w{i}', 'm': 'batch', 'w': 3000, 't': T0 + (i // 2) * DAY + (i % 2) * 3600_000} for i in range(170)]
se = post('/brews', {'initData': E, 'brews': hist})
ok(500 <= se['liters'] < 1000, f'500+ liters counted ({se["liters"]})')
cid5 = post('/cards', {'initData': E, 'card': {'name': 'Стакан', 'theme': {'ach': 'liters', 'tier': 'gold'}, 'ach': []}})['id']
c5 = get(f'/cards/{cid5}')['card']
ok(c5['theme'] == {'ach': 'liters'} and c5['earned']['liters']['tier'] == 'gold' and 'no' not in c5, f'500 L: the glass background is shown, no diamond number ({c5["earned"]})')
cid6 = post('/cards', {'initData': E, 'card': {'name': 'Стакан', 'theme': {'ach': 'liters', 'tier': 'diamond'}, 'ach': []}})['id']
ok(get(f'/cards/{cid6}')['card']['theme'] == {'base': 'paper'}, 'a level above the one earned is refused')

# testers: the checklist, answers, reports
post('/admin', {'initData': A, 'action': 'grant', 'tg': '444', 'what': 'beta'})
post('/admin', {'initData': A, 'action': 'note', 'tg': '444', 'note': 'Аня, бариста из Kojo'})
ok(post('/tester', {'initData': C, 'action': 'checks'}).get('status') == 403, 'the tester panel needs the testers grant')
g = post('/admin', {'initData': A, 'action': 'check_add', 'note': 'Колд брю: бот пишет, когда время вышло'})
post('/admin', {'initData': A, 'action': 'check_add', 'note': 'Замки кофе/воды/пропорции'})
ok([c['text'] for c in g.get('checks', [])] == ['Колд брю: бот пишет, когда время вышло'], 'the owner adds an item to check')
ch = post('/tester', {'initData': D, 'action': 'checks'})['checks']
ok(len(ch) == 2 and ch[0].get('mine') is None and 'answers' not in ch[0], 'the tester sees the list without others\' answers')
r = post('/tester', {'initData': D, 'action': 'answer', 'item': ch[0]['id'], 'state': 'ok', 'context': 'Приложение: 1.3.4'})
ok(r['checks'][0]['mine'] == 'ok' and r['checks'][0]['ok'] == 1, 'the tester marks it as working')
r = post('/tester', {'initData': D, 'action': 'answer', 'item': ch[1]['id'], 'state': 'bug', 'text': 'Замок воды не держится после перезапуска'})
ok(r['checks'][1]['mine'] == 'bug' and r['checks'][1]['bug'] == 1, 'and reports a problem on another')
oc = post('/admin', {'initData': A, 'action': 'list'})['checks']
ok(oc[1]['answers'][0]['note'] == 'Замок воды не держится после перезапуска' and oc[1]['answers'][0]['who'] == 'Аня, бариста из Kojo', f'the owner sees who answered what ({oc[1]["answers"]})')
ok(post('/tester', {'initData': D, 'action': 'report', 'text': ''}).get('status') == 400, 'an empty report is refused')
rep = post('/tester', {'initData': D, 'action': 'report', 'text': 'Падает экран', 'image': 'data:image/png;base64,iVBORw0KGgo='})
ok(rep.get('status') == 502, 'a report goes to the owner through the bot (refused here: fake token)')
# the bot webhook (button «Передать на исправление»): only Telegram with the derived secret gets in
import hashlib
def tg(update, secret):
    req = urllib.request.Request('http://localhost:8799/tg', data=json.dumps(update).encode(), headers={'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret})
    try: return urllib.request.urlopen(req).status
    except urllib.error.HTTPError as e: return e.code
SECRET = hashlib.sha256(b'brewbook-webhook:123:TEST').hexdigest()[:48]
ok(tg({'callback_query': {'id': '1', 'data': 'fix:x', 'from': {'id': 111}}}, 'wrong') == 403, 'the webhook refuses calls without the secret')
ok(tg({'callback_query': {'id': '1', 'data': 'fix:x', 'from': {'id': 111}}}, SECRET) == 200, 'the webhook takes Telegram button presses (no GitHub token here: answered with an error, nothing created)')
ok(tg({'callback_query': {'id': '2', 'data': 'fix:x', 'from': {'id': 999}}}, SECRET) == 200, 'a press from someone who is not the owner is ignored')

g = post('/admin', {'initData': A, 'action': 'check_remove', 'what': ch[0]['id']})
ok(len(g['checks']) == 1, 'the owner removes an item')
g = post('/admin', {'initData': A, 'action': 'check_clear'})
ok(g['checks'] == [], 'and clears the list for the next version')
n = 0
for _ in range(32):
    if post('/tester', {'initData': D, 'action': 'report', 'text': 'спам'}).get('status') == 429: break
    n += 1
ok(n < 32, f'reports are capped per day ({n} more went through)')

# bot reminders
LINK = 'https://t.me/CoffeeBrewingBot?startapp=timer'
now = int(time.time() * 1000)
ok(post('/reminders', {'initData': A, 'at': now + 3600_000, 'title': 'Колд брю', 'link': LINK}).get('ok') is True, 'reminder scheduled')
ok(post('/reminders', {'initData': A, 'at': now + 73 * 3600_000, 'title': 'x', 'link': LINK}).get('status') == 400, 'more than 72 h ahead is refused')
ok(post('/reminders', {'initData': A, 'at': now + 5000, 'title': 'x', 'link': LINK}).get('status') == 400, 'less than 30 s ahead is refused')
ok(post('/reminders', {'initData': A, 'at': now + 3600_000, 'title': 'x', 'link': 'https://evil.example/?startapp=timer'}).get('status') == 400, 'only a t.me timer link is accepted')
ok(post('/reminders', {'initData': 'forged', 'at': now + 3600_000, 'link': LINK}).get('status') == 401, 'unsigned requests are refused')
st = post('/reminders', {'initData': A, 'status': True})
ok(st.get('pending') and st['pending']['title'] == 'Колд брю' and st['last']['state'] == 'scheduled', f'status shows the pending reminder ({st})')
ok(post('/reminders', {'initData': A, 'cancel': True}).get('ok') is True, 'reminder cancelled')
st = post('/reminders', {'initData': A, 'status': True})
ok(st.get('pending') is None and st['last']['state'] == 'cancelled', 'status after cancel: nothing pending, last one cancelled')
t = post('/reminders', {'initData': A, 'test': True, 'link': LINK})
ok(t.get('ok') is False and t.get('error'), f'a test message reports Telegram\'s answer (fake token here: {t.get("error")})')
# a real one fires: the local token is fake, so Telegram refuses — the log shows the alarm ran
ok(post('/reminders', {'initData': B, 'at': int(time.time() * 1000) + 31_000, 'title': 'Колд брю', 'link': LINK}).get('ok') is True, 'short reminder scheduled')
st = None
for _ in range(25):
    time.sleep(2)
    st = post('/reminders', {'initData': B, 'status': True})
    if st.get('last', {}).get('state') != 'scheduled': break
ok(st.get('pending') is None and st['last']['state'] in ('sent', 'failed'), f'the alarm tries to send the bot message when the time comes ({st["last"]["state"]})')
ok(st['last']['state'] == 'failed' and st['last']['detail'], f'the result is kept with Telegram\'s reason (fake token here: {st["last"]["detail"]})')

print('\n' + (f'{len(FAILS)} check(s) failed' if FAILS else 'all checks passed'))
sys.exit(1 if FAILS else 0)
