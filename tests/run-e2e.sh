#!/usr/bin/env bash
# Build the single-file app and run every browser test. Screenshots go to tests/e2e/out/.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:single >/dev/null
cd tests/e2e
status=0
for t in smoke.py drip.py loss.py owner.py card.py sync.py timer.py timer_sync.py home_back.py locks.py tds.py glass.py holiday.py pointer_tilt.py scenes.py drip_pours.py metrics.py invite.py press.py recipes_own.py; do
  echo "== $t"
  python3 "$t" || status=1
done
exit $status
