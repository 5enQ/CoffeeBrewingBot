#!/usr/bin/env bash
# Build the single-file app and run every browser test. Screenshots go to tests/e2e/out/.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:single >/dev/null
cd tests/e2e
status=0
for t in smoke.py drip.py owner.py sync.py; do
  echo "== $t"
  python3 "$t" || status=1
done
exit $status
