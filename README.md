# Brewbook — coffee brewing journal

A Telegram Mini App that also builds, without code changes, into an Android/iOS app (Capacitor).
The user interface is in Russian; code, comments and documentation are in English.
Plans and ideas for later: [ROADMAP.md](ROADMAP.md); changes by version: [CHANGELOG.md](CHANGELOG.md).

## Features

- **Brew guides** for 13 methods: V60, Chemex, AeroPress, French press, Clever, espresso, moka, cezve, siphon, cold brew, batch brew, drip bags and cupping (Kalita Wave is retired: hidden from lists, old brews still show it). Step-by-step timer with "pour to N g" marks, haptics and sound; the screen stays awake while brewing.
- **Home screen tiles**: long-press to pin a method; the pencil button opens edit mode to reorder tiles (drag) and resize them (handle on the right, like Android Quick Settings). Undo is available while editing.
- **Custom recipes and methods**: own steps, dose, water, temperature, grind; shared recipes keep their steps.
- **Grind by grinder type**: hand grinders use clicks, electronic grinders use microns (µm), mechanical grinders keep free text. The last value is remembered per grinder and method.
- **Shelf**: coffee packs with weight and roast date; every brew deducts its dose. Remaining coffee is drawn as beans (10 beans = full pack). Finished packs move to "Finished"; "Buy again" copies a pack.
- **Drip bags**: a drip box holds N bags (default 1), or an assorted box with different drips, each with its own origin and count. Remaining bags are drawn one icon per bag. The Drip method only takes drips from the shelf.
- **Roaster profile**: optional 1–5 scales (acidity, sweetness, bitterness, body, fermentation).
- **Cupping** by the SCA Coffee Value Assessment (standards 102–105): up to 6 blind-coded samples, locked protocol parameters, affective form with the official score formula, descriptive form with CATA limits, extrinsic information.
- **Journal** with stars (half stars), quick taste scales, flavor-wheel descriptors and notes.
- **Sharing** a brew to friends via short links; friends can rate recipes (stored on the server).
- **Achievements** (hidden until earned) and a showcase of up to 3 badges in the profile.
- **Profile card** to share: avatar, name, optional Telegram link, badges, setup and a theme. Backgrounds unlock with achievements: per method bronze 50, silver 100, gold 500, «Объёмный» 1000 brews (3D method icon); diamond for 1000 liters, numbered in the order people reach it.
- **Desktop layout** (window wider than 860 px): sidebar, list and detail panes.
- **Sync between devices** via Telegram CloudStorage (see below).
- **Backup** as a Markdown file that can be edited in any text editor and restored (old JSON backups are accepted too).
- **Scanning** barcodes and QR codes; QR links to roaster pages fill in the coffee automatically (see "Coffee catalog").

## Development

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # dist/ — for hosting, Telegram and Capacitor
npm run build:single  # dist-single/index.html — everything in one file (used by the browser tests)
```

Server (Cloudflare Worker) locally: `cd worker && npm i && echo 'BOT_TOKEN="123:TEST"' > .dev.vars && npx wrangler dev`.

## Branches, releases and versions

- Day-to-day work goes to the **`dev`** branch. Pushing to `dev` deploys nothing.
- A release is a merge of `dev` into **`main`**. Pushing `main` deploys the app (GitHub Pages) and, if server code changed, the server (Cloudflare). After the deploy, CI tags the commit **`vX.Y.Z`**.
- Before merging: set `"version"` in `package.json` (semantic versioning: `X` — major changes or data format breaks, `Y` — new features, `Z` — fixes only) and turn **Unreleased** in [`CHANGELOG.md`](CHANGELOG.md) into `## vX.Y.Z — Title (YYYY-MM-DD)`. The title is used as the release name everywhere (`scripts/release-info.mjs`).
- The running versions are visible in the app (Profile → "О приложении": app and server versions), at `https://brewbook-ratings.brewbook.workers.dev/version`, and in the Cloudflare dashboard (Workers → brewbook-ratings → Deployments: tag `v1.1.0` with the release title).
- Before a release the change set is tested: unit tests (parser, scales), browser end-to-end tests on mobile/desktop and light/dark themes, a two-device sync simulation, backup round trip, a local server run and a live check of the roaster-page parser.

## Localization

The interface is Russian today; English, Japanese and Chinese are prepared. Code: `src/i18n/`.

- `ru.ts` is the source of truth: every key lives there. `en.ts`, `ja.ts`, `zh.ts` may be partial.
- `t('key', vars)` returns a string, `tn('key', n)` a plural form (Intl.PluralRules categories). Lookup order: current locale → English → Russian → the key.
- The locale is picked at start from Telegram `language_code`, then browser languages (`detectLocale`). Only locales listed in `ENABLED_LOCALES` can be chosen — currently `['ru']`, so users never see a half-translated app.
- Already translated through `t()`: tab labels and method names. Other strings are still literal Russian; move them to keys screen by screen.
- Adding a string: add the key to `ru.ts`, use `t()`, then add the translations. A unit test checks that every locale only uses keys that exist in `ru.ts`.
- Enabling a language: translate all keys, add it to `ENABLED_LOCALES`, test on mobile and desktop.

## Platform layer

All environment access goes through `src/platform`:

| | Telegram | Browser | Capacitor (phone) |
|---|---|---|---|
| Storage | `DeviceStorage` (Bot API 9.0+), otherwise localStorage | localStorage | `@capacitor/preferences` |
| Sync | `CloudStorage` (Bot API 6.9+), shared by all devices of the account | — | — |
| Back button | Telegram `BackButton` | arrow in the header | hardware back on Android + header arrow |
| Haptics | `HapticFeedback` | `navigator.vibrate` | `@capacitor/haptics` |
| Dialogs | `showConfirm` / `showAlert` | built-in dialog | `@capacitor/dialog` |
| Theme | Telegram theme colors → CSS variables | system light/dark | system |
| Keep awake | Wake Lock API | Wake Lock API | `@capacitor-community/keep-awake` |

In Telegram the interface takes its colors from the Telegram theme (background, cards, text, hints, buttons/accent, links, separators). The active-tab bubble and the remaining-coffee icons use the button color.

## Telegram setup

1. The app is hosted on GitHub Pages (`https://5enq.github.io/CoffeeBrewingBot/`).
2. In @BotFather: `/mybots` → the bot → **Bot Settings → Configure Mini App** → the URL above (or `/newapp` for a `t.me/<bot>/<app>` link).
3. Optional: **Menu Button** → the same URL.

## Phone app (Capacitor)

```bash
npm i @capacitor/core @capacitor/cli @capacitor/app @capacitor/haptics @capacitor/preferences @capacitor/dialog @capacitor-community/keep-awake
npx cap init Brewbook com.example.brewbook --web-dir dist
npm run build
npx cap add android      # and/or: npx cap add ios
npx cap sync
npx cap open android
```

Camera permission for the scanner: Android — `<uses-permission android:name="android.permission.CAMERA" />` in `AndroidManifest.xml`; iOS — `NSCameraUsageDescription` in `Info.plist`.

## Server (Cloudflare Worker)

`worker/` — a Cloudflare Worker with Durable Objects (SQLite), free plan. It verifies Telegram `initData` signatures with the bot token.

| Endpoint | Purpose |
|---|---|
| `GET /version` | running server version and build time |
| `POST /me { initData }` | the account of this Telegram user (created on first call) with its counted numbers |
| `POST /brews { initData, brews, removed }` | brew log: `[{ id, m (method), w (water, ml), t (date) }]`, the first call imports the history; returns counted numbers and the diamond number |
| `POST /cards`, `GET /cards/:id` | profile card: one per account, the link never changes; levels, achievement badges and the diamond number are filled in by the server |
| `POST /reminders { initData, at, title, link }` / `{ initData, cancel: true }` | bot message when a long timer ends (30 s – 72 h ahead, one per account; a Durable Object alarm sends it) |
| `POST /rate`, `GET /stats` | friends' ratings of shared recipes (one rating per user, own recipes can't be rated) |
| `POST /recipes`, `GET /recipes/:id` | short share links |
| `POST /share` | prepared Telegram message for `shareMessage` |
| `GET /lookup?url=…&code=…` | coffee by QR link or barcode (catalog first, then the roaster page if the site is approved) |
| `POST /catalog` | a user saved a pack: fill in or confirm the catalog entry |
| `POST /admin { initData, action, host, roaster }` | owner only: list / approve / reject / recrawl roaster sites |

Setup: Cloudflare account → Account ID and an API token (template "Edit Cloudflare Workers") → GitHub **Settings → Secrets and variables → Actions**: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BOT_TOKEN`, `OWNER_TELEGRAM_ID` (your numeric Telegram id, shown in the app under Profile → "О приложении" → "Ваш Telegram ID"; several ids can be comma-separated); variable `RATINGS_ENABLED` = `true`. The server address is `RATINGS_API` in `src/config.ts`.

## Free-tier limits (important)

Durable Objects on the free plan have a daily limit of rows read (about 5 million) and written (about 100 thousand), shared by the whole account; when it is used up, every server feature fails until 00:00 UTC. Rules for server code:

- Frequent paths (every crawler step, every app start, every scan) must use indexed lookups only — check new queries with `EXPLAIN QUERY PLAN`.
- One-time migrations are gated by the schema version in the `meta` table, never run unconditionally in a constructor: an object wakes up many times a day.
- Recount from logs only on writes; answer reads from stored results.

## Accounts and verified achievements

Achievements, card backgrounds and diamond numbers are decided on the server, so they cannot be faked by editing the app's data.

- **Account.** One account per person (`worker/src/accounts.ts`), with linked sign-in identities: `tg:<telegram id>` now, verified through the `initData` signature. A standalone app can link the same account later (for example "Sign in with Telegram", or another provider added as an identity).
- **Brew log.** The app sends only method, water and date of each own brew (no notes, beans, recipes or gear) — the whole history once, then only changes and deletions (`src/data/stats.ts`). Samples and recipes saved from friends are not sent.
- **Counting rules** (`src/data/levels.ts`, shared by the app and the server): no daily limit on brews for people (a technical ceiling of 100 a day against scripts; the app warns past 10 cups a day); water up to 3 L per brew and 6 L per day; history imported on the first day of an account counts as is, after that a brew must arrive within 14 days of its date (no backdating). So 1000 liters take months, not an evening of tapping.
- **Levels.** Methods: bronze 50, silver 100, gold 500, «Объёмный» 1000. Liters: 10 / 100 / 500, diamond 1000 (numbered 1, 2, 3… in the order people reach it). Ratings of the user's recipes: badges only. Backgrounds come from method levels and the liters diamond.
- **Cards** name achievements by key (`method:v60`, `liters`) and never carry a level. When a card is opened, the server fills in levels from its own count and drops what is not earned. Self-declared badges (SCA certificates, championships) are shown as entered.
- **Grants** are given by hand, each separately: `dev` — the developers' background «Разработчик»; `tester` — every background at every level for testing (diamond shows № 0, real numbers are not taken). The owner gives or takes them away by Telegram ID in Profile → «Разработчики и тестировщики» (`POST /admin` actions `grant` / `revoke` with `what`). Accounts whose Telegram ID is in `OWNER_TELEGRAM_ID` have both automatically. A shared card shows a grant-only background only if the account has the grant.
- Outside Telegram (no account) the app shows its own estimate with the same rules; such a card cannot be shared.

## Coffee catalog

A shared catalog of coffee lots on the server — the basis for a future global coffee rating.

- Scanning a QR link (or pasting a roaster page link) calls `/lookup`. If the lot is already in the catalog, fields are filled instantly; otherwise the server fetches the roaster page, parses it (`worker/src/parse.ts`) and stores the lot.
- The parser understands Tilda stores, 1C-Bitrix (Aspro template and name/value lists), WooCommerce, schema.org Product JSON-LD and "Label: value" lines. New labels go to the `LABELS` dictionary; roaster scales are mapped by `src/data/scales.ts` (dots `one…five`, words, numbers).
- When `parse.ts` learns something new, bump `PARSER_VERSION` in `worker/src/index.ts`: unconfirmed lots are re-parsed on the next scan.
- Saving a pack sends only the coffee description (no roast date, stock, notes or brews). While a lot has at most one confirmation, user edits replace parsed values; after that edits only fill empty fields. Each Telegram user counts once.
- Missing fields are simply not stored.
- Lot state: `active` (on sale), `out` (out of stock), `archived` (the roaster's archive section), `gone` (removed from the site). Lots are never deleted: an old pack in hand is still recognized.

### Roaster sites and the crawler

- The server fetches pages **only from approved domains**. A scan from an unknown site is queued as "pending", the owner gets a Telegram message from the bot and approves or rejects the site in the app (Profile → "Сайты обжарщиков", visible only to `OWNER_TELEGRAM_ID`).
- Approved from the start (`SEED_SITES` in `worker/src/crawl.ts`, with per-site URL rules): kojocoffee.ru, sbmrne.ru, hq-coffee.com, theweldercatherine.ru, shop.tastycoffee.ru, silkydrum.ru, rockets.coffee. A newly approved site uses all sitemap URLs; a page becomes a lot only if it has at least two coffee facts (or a name and a country).
- The crawler is a Durable Object alarm: one request per step, a step every minute, at least 2 minutes between requests to the same site; robots.txt is respected. Each site is crawled **once**, when it is approved; there is no periodic re-crawl — new lots of known roasters enter the catalog when someone scans them. The owner can start a new pass by hand («Обойти заново»): then a page is fetched again only if its `lastmod` changed or it is older than 14 days, and pages that left the sitemap turn their lots `gone`. A failed pass is retried after 1, 2, 4, 8, 16 hours. A cron trigger every 6 hours only resumes an interrupted pass.
- Users never browse the catalog: it is a server-side cache, so a scan of a known pack is filled instantly without fetching the roaster page. The lot state is kept for the future global rating and is not shown in the app.
- Local test of the crawler: run a fixture server and set `CRAWL_PROXY="http://127.0.0.1:8800/"` and `CRAWL_STEP_MS="300"` in `worker/.dev.vars` (requests to `https://host/path` go to `http://127.0.0.1:8800/host/path`).

## Sync between devices

In Telegram data lives on the device (DeviceStorage) and is mirrored to the account's CloudStorage (up to 1024 keys × 4096 chars). Code: `src/data/persist.ts` (format) and `src/data/sync.ts` (exchange).

- Buckets: `m` — profile, gear, custom recipes and methods, tiles; `k` — packs; `bYYYYMM` — brews of a month. Each bucket is deflated, base64url-encoded and split into 4096-char parts; `idx` lists bucket hashes. Only changed buckets are transferred.
- Per-record merge: the later edit wins; deletions travel as tombstones (kept 180 days).
- Not synced: sample data, cached friends' ratings, layout preference (per device).
- Space savings: empty/default fields are omitted; brew gear is stored by id, or as a versioned snapshot `id~hash` in the metadata archive when the gear was renamed or deleted (a brew always shows the gear as it was); descriptors from the dictionary are stored as indices (**only append to the dictionary in `cupping.ts`**); cup marks are bitmasks; dates are in seconds.

## Project structure

```
src/
  platform/      Telegram / web / native adapters and the shared interface
  data/          methods, recipes, cupping (SCA CVA), store, sync, backup, catalog client
  i18n/          localization dictionaries (ru, en, ja, zh) and t()
  screens/       screens
  ui/            components, scanner, forms, icons, animations
  router.tsx     screen stack and "leave without saving?" guards
tests/           unit and browser tests (see tests/README.md)
worker/
  src/index.ts   server endpoints
  src/catalog.ts coffee catalog (Durable Object)
  src/parse.ts   roaster page parser
```
