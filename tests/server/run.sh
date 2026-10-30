#!/usr/bin/env bash
# Start the worker locally with a fresh state, run the server tests, stop it.
set -uo pipefail
cd "$(dirname "$0")/../../worker"
STATE=$(mktemp -d)
[ -f .dev.vars ] || echo 'BOT_TOKEN="123:TEST"' > .dev.vars
# a server left from an earlier run would serve old data
if curl -s localhost:8799/version > /dev/null; then echo "port 8799 is busy — stop the running wrangler dev first"; exit 1; fi
setsid npx wrangler dev --port 8799 --persist-to "$STATE" --var OWNER_IDS:111 > "$STATE/wrangler.log" 2>&1 &
PID=$!
for _ in $(seq 1 60); do curl -s localhost:8799/version > /dev/null && break; sleep 1; done
python3 ../tests/server/accounts.py; status=$?
kill -- -$PID 2>/dev/null; wait $PID 2>/dev/null
exit $status
