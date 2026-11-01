"""Signed Telegram initData for local tests (bot token 123:TEST, as in worker/.dev.vars)."""
import hmac, hashlib, json, time, urllib.parse, sys
def sign(uid, token='123:TEST', username=None, first_name='T'):
    u = {'id': int(uid), 'first_name': first_name}
    if username: u['username'] = username
    p = {'auth_date': str(int(time.time())), 'query_id': 'AAA', 'user': json.dumps(u)}
    check = '\n'.join(f'{k}={v}' for k, v in sorted(p.items()))
    secret = hmac.new(b'WebAppData', token.encode(), hashlib.sha256).digest()
    p['hash'] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(p)
if __name__ == '__main__':
    print(sign(sys.argv[1]))
