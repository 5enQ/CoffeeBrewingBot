# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Work in progress is collected under **Unreleased** and becomes a version on release.

## Unreleased

### Added
- Water mineralization (ppm) before brewing: optional «Минерализация воды» on the method screen and in the brew editor («не указана» until set; the first «+» gives 100 ppm, then 5 ppm steps), with a hint and the SCA range. The last value is offered for the next brew on any method.
- Cup TDS (%) after brewing, in the brew form («Измерения → TDS чашки», refractometer; the first «+» gives 1,30 %, espresso 9 %). The app shows the extraction yield: for espresso from the drink weight, for other methods estimated (the grounds keep ~2 g of water per gram), and whether the cup is in the SCA golden range.
- Both are saved with the brew, shown on its page («Вода 105 ppm · TDS 1,31 % · Экстракция ≈ 19,2 %») and travel in shared recipes.
- Coffee / water / ratio locks on the method screen and in the recipe editor: a lock next to each of the three (or a long press on its name). Lock coffee — water and ratio move each other; lock water — coffee and ratio; lock ratio (default, as before) — coffee and water. The locked value cannot be changed: a tap shakes it red with a hint. The choice is remembered per method on the device. A recipe known as «20 г и 300 г» is entered without counting the ratio.
- The running timer is shared between devices through the account cloud: a cold brew started on the phone shows up on the computer (banner on the brew tab), and pausing, resuming or finishing it on one device does the same on the other within half a minute.

### Fixed
- Coming back to «Заварить» from a recipe, the method tiles no longer shrink and fly in from the corner: positions measured while the tab was hidden are ignored.
- An empty profile card (only a name, a plain background) is as tall as its content instead of a large empty block.
- Developers' card: the background code scrolls in a seamless loop. Before, the code was shorter than the card, so the lower part ran empty and the code then jumped back in.

## v1.3.2 — Timers & Fixes (2026-10-31)

### Added
- Two more roaster sites in the catalog: Silky Drum (silkydrum.ru) and Rockets (rockets.coffee); crawled once after the release.
- Timers survive closing the app: the running timer is kept on the device by the clock, and reopening the app resumes it where it is (with pause). The brew tab shows a banner with the running timer («Колд брю · 3:00:01 из 12:00:00 · осталось 8:59:59»).
- Long timers (an hour and more — cold brew) run in the background: leaving the screen does not abandon them («Свернуть»), the screen is not kept awake, and the bot sends a Telegram message when the time is up, with a button that opens the timer — even if the app is closed. The app asks Telegram once for permission to receive bot messages. Pause, reset and «готово» cancel the message.
- Health warning: the 11th own brew of a day shows a one-time note that this much coffee is a lot for the body (cuppings and sample brews are not counted).
- Grinder mileage in Profile → equipment: «смолото 12,4 кг · 820 заварок» — what went through the burrs (dose plus loss; every cup in cupping), without drips and sample brews.
- Grinder loss: a grinder has «Потери при помоле, г» (what is purged or cleaned out per grind). The pack gives dose + loss, the recipe, ratio and timer use the dose that went into the brewer; the method screen shows «Из пачки 16,5 г → в воронку 15 г», and the brew editor has «Из пачки» to correct it for one brew. Not applied to drips and cupping.

### Changed
- «Сайты обжарщиков» (owner) no longer recounts every page and lot each time it opens: the counts are cached on the server and recounted only after the crawler or a new lot changed them (an open cost ~4000 rows read, now 1 while nothing changed).
- Diamond card: turns only slightly with the device (about a quarter of before) and is much lighter to draw — the rainbow layers move instead of being repainted, no backdrop blur, facet colors update in small steps — so it no longer lags on phones.
- The roaster crawler keeps to a daily budget: at most 70% of the Cloudflare free tier (3,5 M rows read and 70 k rows written per UTC day). It meters what each step really costs and, once either half is spent, sleeps until the limit resets (03:00 MSK); the rest stays for the app. The owner sees today's spend under «Сайты обжарщиков».
- No daily limit on brews any more: every brew counts toward achievements. Only a technical ceiling of 100 brews a day stays against scripts; the water limits (3 L per brew, 6 L per day) and the no-backdating rule are unchanged.

## v1.3.1 — Hotfix (2026-10-30)

### Changed
- Profile opens with the card itself, with two buttons: «Поделиться» and «Настроить». Settings hold everything shown on the card — name, Telegram username, about, badges (up to 3), background, setup; the share screen only asks whether to include the Telegram link. Edits update the shared card on the server, so the same link shows the new version.
- Roaster sites are crawled once, when a site is approved — no periodic re-crawl. New lots of known roasters enter the catalog when someone scans them; the owner can start a new pass by hand («Обойти заново»). A pass whose sitemaps cannot be read is retried after 1, 2, 4, 8 and 16 hours, then left for the owner. When there is nothing to crawl the crawler sets no alarm at all.

## v1.3.0 — Profile Update (2026-10-30)

### Added
- Profile card: avatar, name, optional Telegram link, featured badges, setup (chosen gear, up to 6) and a color theme. Shared by a link that never changes: friends always see the latest card.
- Card backgrounds from achievements. Every brew method: bronze (50 brews), silver (100), gold (500) and «Объёмный» (1000) — an obsidian card with the method icon extruded in 3D. Diamond for 1000 liters: faceted, iridescent, turns in 3D with the device, and carries the holder's number in the bottom-left corner (№ 1 for the first person to reach it, given by the server). Metals of one tier are one tile with a choice of the corner icon. Metals catch the light: a bright band travels across them with the tilt and small glints flash.

- Accounts on the server, linked to Telegram (ready for other sign-in methods in a standalone app). The app sends a short brew log (method, water, date) — the whole history once, then changes — and the server counts it with limits: 5 brews of a method per day, 3 L per brew, 6 L per day, no backdating after the first day.
- Developers' card background («Разработчик»: terminal black, scrolling code, a glowing "</>" mark).
- Owner tools (Profile → «Разработчики и тестировщики»): two grants given separately by Telegram ID — «Фон разработчика» and «Все фоны (тест)» (every background at every level; test accounts show diamond № 0 and never take a real number). Owners from `OWNER_TELEGRAM_ID` have both automatically. The server checks grants on every shared card.
- Achievements, card backgrounds, achievement badges on cards and diamond numbers are decided by the server's count: a shared card shows only what the server confirms.

### Fixed
- Server outage since v1.2.0: the catalog crawler read whole tables on every step and used up the free-tier daily limit of rows read in Durable Objects, after which every server feature failed (`Exceeded allowed rows read`). One-time migrations now run once (schema version in a `meta` table), seeded sites are written only when their rules change, the crawler picks the next page through an index and steps once a minute (~40k rows a day instead of millions); `/me` answers from the stored count.
- Achievements of retired methods (Kalita Wave) and deleted custom methods are no longer lost.

### Changed
- Achievement levels: method brews 50 / 100 / 500 / 1000 (bronze / silver / gold / «Объёмный»); liters 10 / 100 / 500 / 1000 (diamond). Liters below diamond and recipe ratings give badges only, no card background.
- New AeroPress icon: plunger, chamber with a flange, rubber seal, level marks, filter cap.
- Filters are no longer offered as gear (rarely relevant — a note on the brew covers it). Old brews keep the filter they were brewed with.
- Profile: the "about" placeholder is just "Пара слов о себе".

### Removed
- The in-app catalog picker ("Выбрать из каталога обжарщиков") and the `/roasters`, `/catalog/list`, `/catalog/<id>` endpoints: the catalog is a server-side cache for scans, users do not browse it. Stock status is not shown anywhere in the app.

## v1.2.0 — Roaster catalog (2026-10-30)

### Added
- Pick coffee from a roaster's catalog: pack editor → "Выбрать из каталога обжарщиков" → roaster → lot. Beans and drip boxes; lots on sale first, past lots one tap away and always in search; the drip box size comes from the lot.
- The server crawls approved roaster sites in the background (robots.txt → sitemaps → product pages), so lots are in the catalog before anyone scans them. Lots that leave a site are kept and marked "снят с продажи".
- Tasty Coffee (shop.tastycoffee.ru) joins Kojo, Submarine, HQ! coffee and Сварщица Екатерина. Pages with a "pack / drips" switch are offered both as beans and as drips.
- Site approval: the server fetches pages only from approved domains. A scan from an unknown site is queued, the owner gets a bot message and approves or rejects the site in Profile → "Сайты обжарщиков" (owner only). Profile shows "Ваш Telegram ID" for this setup.

### Changed
- Parser: English country names in titles (HQ! coffee), roast levels mapped to Светлая / Омни / Средняя / Тёмная, processes to Мытая / Натуральная / Хани / Анаэробная, stock status from the product markup, capsules skipped, "…, Фильтр" removed from names.

### Internal
- Worker type-checks in CI; crawler rules and parser are covered by unit tests; a browser test for the picker and the owner tools.


## v1.1.0 — Bug fixes (2026-10-30)

### Fixed
- The recipe screen no longer marks the standard recipe as "last time" for a method that was never brewed (sample brews do not count either).
- Removed the method description card from the recipe screen.

### Changed
- Method names in Russian: Кемекс, Аэропресс, Клевер (gear category "Аэропресс и прессы").
- Kalita Wave is retired: hidden from the method list and home tiles; old brews, backups and synced data still show it.

### Added
- Localization groundwork (`src/i18n/`): dictionaries for Russian, English, Japanese and Chinese, `t()` / `tn()` with plural rules, locale detection from Telegram `language_code`. Only Russian is enabled; tab labels and method names already go through `t()`.
- Test suite in the repository: unit tests (`npm test`, also run by CI before every deploy) and browser tests (`npm run test:e2e`).

### Internal
- Release process: work happens on the `dev` branch; a release is a merge into `main`, deployed in one go (app and server) and tagged `vX.Y.Z` by CI.
- Version and release title come from `package.json` and this changelog (`scripts/release-info.mjs`).
- Versions are named in English; documentation and code comments are in English (the interface stays Russian).

## v1.0.0 — Baseline (2026-10-28)

Everything built before release versioning was introduced, as deployed on 2026-10-28 (app build 1.52, server build 1.11):

- Brew guides for 14 methods with step timers; custom recipes and methods; pinned and editable home tiles.
- Shelf with packs and drip boxes (including assorted boxes), automatic stock deduction, remaining coffee drawn as beans or drip bags.
- Roaster profile scales; grind units by grinder type (clicks, µm, free text).
- SCA Coffee Value Assessment cupping (standards 102–105).
- Journal, sharing with short links, friends' ratings, achievements and badges.
- Desktop layout, animated tab bar and tab transitions.
- Sync via Telegram CloudStorage; Markdown backup.
- Shared coffee catalog with roaster page parsing (Kojo, Submarine, HQ! coffee, The Welder Catherine and similar sites).
