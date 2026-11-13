#!/usr/bin/env bash
# Страж (the guard): every check a version has to pass before it is released (dev → test → main).
# Types, unit tests, the server's types and tests, the build, the browser tests and the UI autotests.
# Each stage runs even if an earlier one failed, so one run shows everything; the summary at the end says
# what passed. Exit code 0 only when all of it is green. A new kind of check joins Страж as a stage here.
#
#   npm run guard
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=$(mktemp -d)
names=(); results=()
stage() { # stage <name> <command…>
  local name=$1; shift
  printf '── %s … ' "$name"
  local t0=$SECONDS
  if "$@" > "$LOG/${#names[@]}.log" 2>&1; then r=ok; else r=FAIL; fi
  printf '%s (%ss)\n' "$r" $((SECONDS - t0))
  [ "$r" = FAIL ] && tail -n 25 "$LOG/${#names[@]}.log" | sed 's/^/   │ /'
  names+=("$name"); results+=("$r")
}

stage 'App types'          npx tsc -b
stage 'Unit tests'         npx vitest run
stage 'Server types'       bash -c 'cd worker && npm run -s typecheck'
stage 'Server tests'       npm run -s test:server
stage 'Build'              npm run -s build:single
cd tests/e2e
for t in $(grep -o '[a-z0-9_]*\.py' ../run-e2e.sh); do
  if [ "$t" = ui_snapshot.py ]; then stage 'UI autotests' python3 "$t"; else stage "Browser: ${t%.py}" python3 "$t"; fi
done
cd ../..

echo
fails=0
for i in "${!names[@]}"; do [ "${results[$i]}" = FAIL ] && { echo "  ✗ ${names[$i]}"; fails=$((fails + 1)); }; done
if [ $fails -eq 0 ]; then echo "Страж: all ${#names[@]} checks passed — the version may be released."; exit 0; fi
echo "Страж: $fails of ${#names[@]} checks failed — do not release. Logs: $LOG"
exit 1
