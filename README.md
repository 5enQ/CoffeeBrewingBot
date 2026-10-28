# Brewbook — coffee brewing journal

A Telegram Mini App that also builds, without code changes, into an Android/iOS app (Capacitor).
The user interface is in Russian; code, comments and documentation are in English.

## Features

- **Brew guides** for 14 methods: V60, Kalita Wave, Chemex, AeroPress, French press, Clever, espresso, moka, cezve, siphon, cold brew, batch brew, drip bags and cupping. Step-by-step timer with "pour to N g" marks, haptics and sound; the screen stays awake while brewing.
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
| `POST /rate`, `GET /stats` | friends' ratings of shared recipes (one rating per user, own recipes can't be rated) |
| `POST /recipes`, `GET /recipes/:id` | short share links |
| `POST /share` | prepared Telegram message for `shareMessage` |
| `GET /lookup?url=…&code=…` | coffee by QR link or barcode (catalog first, then the roaster page) |
| `POST /catalog` | a user saved a pack: fill in or confirm the catalog entry |

Setup: Cloudflare account → Account ID and an API token (template "Edit Cloudflare Workers") → GitHub **Settings → Secrets and variables → Actions**: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BOT_TOKEN`; variable `RATINGS_ENABLED` = `true`. The server address is `RATINGS_API` in `src/config.ts`.

## Coffee catalog

A shared catalog of coffee lots on the server — the basis for a future global coffee rating.

- Scanning a QR link (or pasting a roaster page link) calls `/lookup`. If the lot is already in the catalog, fields are filled instantly; otherwise the server fetches the roaster page, parses it (`worker/src/parse.ts`) and stores the lot.
- The parser understands Tilda stores, 1C-Bitrix (Aspro template and name/value lists), WooCommerce, schema.org Product JSON-LD and "Label: value" lines. New labels go to the `LABELS` dictionary; roaster scales are mapped by `src/data/scales.ts` (dots `one…five`, words, numbers).
- When `parse.ts` learns something new, bump `PARSER_VERSION` in `worker/src/index.ts`: unconfirmed lots are re-parsed on the next scan.
- Saving a pack sends only the coffee description (no roast date, stock, notes or brews). While a lot has at most one confirmation, user edits replace parsed values; after that edits only fill empty fields. Each Telegram user counts once.
- Missing fields are simply not stored.

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
  screens/       screens
  ui/            components, scanner, forms, icons, animations
  router.tsx     screen stack and "leave without saving?" guards
worker/
  src/index.ts   server endpoints
  src/catalog.ts coffee catalog (Durable Object)
  src/parse.ts   roaster page parser
```
