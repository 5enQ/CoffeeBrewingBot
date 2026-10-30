# Tests

| Command | What runs |
|---|---|
| `npm test` | unit tests (Vitest): i18n dictionaries, methods, roaster scales, grind units, SCA CVA score, page parser, cloud format, Markdown backup |
| `npm run test:e2e` | builds `dist-single/` and runs the browser tests (Python Playwright) |

Browser tests (`tests/e2e/`):

- `smoke.py` — all tabs on phone and desktop, light and dark; method list (renamed methods, Kalita hidden); recipe screen rules; old Kalita brews still display.
- `drip.py` — drip box defaults, fill-in from a roaster link (server mocked), one bag deducted per brew.
- `sync.py` — two devices with a simulated Telegram CloudStorage: identical data, deletions, concurrent brews, gear rename keeps old brews' gear names.

Each check prints `ok` or `FAIL`; a script exits with 1 if any check failed. Screenshots are saved to `tests/e2e/out/` (not committed) for a visual pass before a release.

Requirements: Node 22+, Python 3.11+ with `playwright` and Chromium (`pip install playwright && playwright install chromium`).

Server checks are manual: `cd worker && npx wrangler dev` with `.dev.vars` (`BOT_TOKEN="123:TEST"`), then call `/version`, `/lookup`.
