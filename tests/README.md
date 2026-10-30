# Tests

| Command | What runs |
|---|---|
| `npm test` | unit tests (Vitest): i18n dictionaries, methods, roaster scales, grind units, SCA CVA score, page parser, crawler rules (robots.txt, sitemaps, site filters), cloud format, Markdown backup |
| `npm run test:e2e` | builds `dist-single/` and runs the browser tests (Python Playwright) |

Browser tests (`tests/e2e/`):

- `smoke.py` — all tabs on phone and desktop, light and dark; method list (renamed methods, Kalita hidden); recipe screen rules; old Kalita brews still display.
- `drip.py` — drip box defaults, fill-in from a roaster link (server mocked), one bag deducted per brew.
- `owner.py` — a link from a site that is not connected yet, a scan filled from the catalog, the owner's site approval (Telegram mode stub).
- `card.py` — profile card: unlocked metal themes, setup choice, sharing link, shared silver / gold / diamond cards, diamond tilt (light and dark).
- `sync.py` — two devices with a simulated Telegram CloudStorage: identical data, deletions, concurrent brews, gear rename keeps old brews' gear names.

Each check prints `ok` or `FAIL`; a script exits with 1 if any check failed. Screenshots are saved to `tests/e2e/out/` (not committed) for a visual pass before a release.

Requirements: Node 22+, Python 3.11+ with `playwright` and Chromium (`pip install playwright && playwright install chromium`).

Server: `cd worker && npm run typecheck`; a local run is `npx wrangler dev` with `.dev.vars` (`BOT_TOKEN="123:TEST"`). For the crawler see "Roaster sites and the crawler" in the main README.
