# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Work in progress is collected under **Unreleased** and becomes a version on release.

## Unreleased

### Changed
- Testers' panel: «Датчик наклона» shows the motion sensor live — where the readings come from (Telegram or the browser, radians or degrees), the raw angles, how the phone is turned and how far the screen faces up — to check how a phone reports tilts.
- «Объёмный» card (1000 brews with a method): a deeper night sky — eight layers at different depths (star dust, the milky way, far stars, gas clouds, twinkling stars, near bright stars) that shift against the tilt by different amounts; now and then a comet streaks across. The constellation sits in the top right corner like the method icon on the other cards, and its faint drawing lies exactly under its stars. The metal sparkles are gone from this card.
- Owner, «Сайты обжарщиков»: after «Обойти заново» (or «Подключить») a line under the buttons shows how the pass goes — reading the sitemap, lot pages found and still queued — and the list refreshes by itself until the pass ends, with a toast «обход закончен — в продаже N лотов». A site whose sitemap cannot be read says so («карта сайта не прочиталась, повтор в 14:00»; after 5 failures in a row — that the server stopped trying). Before, the button only flashed a toast and nothing seemed to happen.
- Holiday looks dress the pages: decorations hang from the top of each page and lie at the end of each tab page, resting on the bottom bar when the page is scrolled down. They are part of the page and scroll with it, like the rest of the content. Halloween — cobwebs across the top with the spider, jack-o'-lanterns with flickering candles and fallen leaves at the bottom; New Year — a garland of blinking lights across the top, snowmen on a snowdrift (one waves) and a gift at the bottom, snow keeps falling; Coffee Day — coffee branches swaying at the top (pointed leaves in pairs, clusters of red and yellow cherries hanging under them, as coffee grows), farmers picking cherries into baskets, another walking across with a full basket and sacks of coffee at the bottom. The page leaves room for them, so they do not cover the content.
- Coffee Day card: the shrub is drawn like a real coffee shrub, and the barista's gooseneck kettle is redrawn — the stream falls from the tip of the spout into the dripper (before it started in the middle of the spout).
- Handed-over bug reports go to the private repository `brewbook-bugs`: the issue names the tester (note, name, @username) and shows the screenshot, which is copied there from Telegram. After a release the deploy closes the fixed ones («Исправление вышло в версии vX»).
- A report with a screenshot comes as one message: the photo with the report as its caption and «Передать на исправление» under it (a report longer than a caption goes as text first). Before, the screenshot came separately and could not be handed over with the report (brewbook-bugs: CoffeeBrewingBot#3).

### Fixed
- Cards on a computer shook under the mouse: with the cursor resting on a card, after 2.5 s the slow idle sway took over and the next small mouse move snapped it back; near the edges the diamond card measured its own turned box and chased itself. Now the cursor is read against the card's untransformed box, the card holds still under a resting cursor, and when the cursor leaves it eases back to the middle before the sway softly comes in.
- «Стакан»: the coffee now follows gravity. Before, it read the sideways angle of the sensor (gamma) directly: that angle jumps by 180° when the phone passes upright and hardly changes when a phone held upright is turned like a steering wheel, so the coffee jumped or did not react; tipping the phone forward and back also opened the surface the wrong way round. Now the surface stays level however the phone is turned (it tips on screen by exactly the phone's turn), it opens when the top of the phone tips away from you (you look down into the glass), lying flat keeps it calm. If a Telegram client reports the angles in degrees instead of the documented radians, that is recognized.
- Cards with a background (the night sky, metals, the beta ribbon) could show a sharp corner in Telegram for macOS and other Safari-based apps: the decorations are now clipped to the card's rounded corners in a layer of their own.
- The roaster crawler had stopped on 30 October and did not start again: its alarm threw during a deploy several times in a row, Cloudflare stopped retrying it but kept it set in the past, and the wake-up (cron, «Подключить», «Обойти заново») saw an alarm already set and did nothing. Since then no site was read (Silky Drum and Rockets were never crawled, thousands of pages of the others stayed queued). The wake-up now replaces an alarm stuck in the past, and one crawler step can take at most a minute, so a site that never answers cannot hang the crawler.
- Tea and capsules are not saved to the catalog any more, neither by the crawler nor by a scan (Silky Drum sells tea too); lots saved before are dropped when their page is read again. On Tilda pages a decorative heading («Способы приготовления») is no longer taken for the lot name — the page title is used.
- «Передать на исправление» did nothing: the bot's webhook was never registered (it was set only when the owner opened their panel). The worker now makes sure the webhook is there before it sends a report with the button, and logs whether Telegram accepted it.
- Sync could hang in «Синхронизация…» for good (seen on Telegram Desktop for macOS): a CloudStorage call whose callback never came back blocked every later sync. Each cloud call now gives up after 20 s, the sync ends with an error and is retried later. «Синхронизировать сейчас» is a real button now: it shows «Синхронизация…» while working and a toast with the result when done.

## v1.5.0 — Holidays & Hand-over (2026-11-01)

### Added
- Holiday looks, a couple of days around each holiday (local dates): Halloween (29 Oct – 2 Nov) — cobwebs in the top corners, a spider swaying on its thread, a card with jack-o'-lanterns; New Year (30 Dec – 3 Jan) — falling snow and a garland of blinking lights, and fireworks on the first start after midnight of 1 January (once a year, on each device); International Coffee Day (29 Sep – 3 Oct) — a scene from farm to cup: farmers picking cherries from a coffee shrub, a trail of beans, a barista pouring from a gooseneck kettle. The greeting on the brew tab can be closed for the year; nothing blocks taps; motion stops with reduced motion. Testers and the owner can preview any look in their panel («Праздничное оформление», with «Запустить салют»).
- Owner: «Убрать из списка» next to each person in «Разработчики и тестировщики» removes them from the list (all grants and the note go; their brews, card and numbers stay).
- Bug reports can be handed over for fixing: with the optional GitHub secret `GH_ISSUES_TOKEN`, every bug report (and «есть проблема» answer) in the owner's chat has a button «🛠 Передать на исправление» that opens a GitHub issue `tester-bug` with the text and diagnostics (the tester is anonymous there, screenshots stay in Telegram); the button then turns into a link to the issue.

### Changed
- The owner's and the testers' panels fold to their heading (closed by default, remembered on the device); the folded heading shows a summary («Проверить: 2 из 3», «новых сайтов: 1 · людей с правами: 4»). Inside: a cleaner heading with the role color, the usual spacing between sections, smaller buttons and readable text sizes.
- Testers' diagnostics: no «Таймер» line, and instead of the long browser string a short «Система» line («Android 14 · WebView 130», «iOS 17.5»), which now also goes into the report sent to the owner.

## v1.4.0 — Testers Update (2026-11-01)

### Fixed
- «Фильтр» card background is light filter paper (warm off-white with a faint crepe texture) in any app theme; it used to follow the app card color and was dark in a dark Telegram theme.
- Bot reminder for long timers: the app no longer waits forever when Telegram does not answer the «allow messages» request (some clients stay silent if access was given before) — after 8 s it schedules the reminder anyway. Opening a running cold brew asks the server whether the reminder is there and sets it again if not; pausing on any device cancels it even if it was set on another one.

### Added
- «Объёмный» (1000 brews of a method) is now a window into space: the card is a portal, and behind it lie layers at different depths — far stars, a nebula, nearer twinkling stars and the constellation — that shift against the tilt (far ones the most), with the rim darkened from inside like the edge of a portal; the card itself no longer turns. The method is drawn as on a star chart: the faint glowing figure of its icon, bright stars at its key points (corners, ends, junctions; bigger where more lines meet, the brightest with small flares) joined by straight lines. Painted once; per frame only transforms and a CSS twinkle change.
- Card backgrounds rearranged into a 3×3 set with coffee names: light — «Бумажный фильтр» (renamed from «Фильтр»), «Латте», «Цитрус» (new: pale lemon to peach); middle — «Матча», «Ягоды», «Жасмин» (new: cream white with lilac); dark — «Эспрессо», «Каскара» (new: the dried coffee cherry husk, wine red-brown), «Ристретто» (new: near black with a gold crema glow). «Океан» and «Графит» are retired; cards that used them show «Каскара» and «Ристретто».
- «Стакан» — the achievement background for 500 liters of coffee: the card is a smoky glass with black coffee in it, drawn in volume. Tilting the phone sideways tips the surface (it stays level); tilting it toward you shows the top of the coffee — a glossy plane with a window reflection and ripples; a sharp move throws the liquid (it overshoots, opens the surface and settles). Its own canvas loop: no React renders per frame, nothing drawn while still or off screen, 60 fps in tests. With 1000 liters both the glass and the diamond can be chosen (a lower earned level can be chosen in general); the diamond number shows only on the diamond.
- The server keeps what happened to each reminder (scheduled, cancelled, sent, or refused with Telegram's reason). The timer screen shows the time the bot will write («в 00:25») or why it could not («бот ещё не может вам писать — откройте чат с ботом и нажмите «Старт»»).
- Testers' card background «Тестировщик»: a lab blueprint — dark teal with a measuring grid that drifts with the tilt, an amber «BETA» ribbon in the corner, a glowing flask, «β Бета-тестер Brewbook». The owner gives it by Telegram ID like the developers' one (the grants are now «Тестировщик», «Разработчик» and «Все фоны (тест)», each separate).
- The owner's list of people with grants: a note on each person («Аня, бариста из Kojo», can be typed together with the grant), their Telegram name and an active @username link — filled in by itself when the person opens the app, or typed by the owner if they have not yet. A signed person stays in the list after their grants are taken away.
- Profile panels framed in color: «Панель владельца» (amber — roaster sites, people and grants, the testers' checklist) and «Панель тестировщика» (teal — for people with the «Тестировщик» grant; the owner has it too).
- Testers' panel: «Что проверить» — the owner's list for the version under test, each item answered «✓ Работает» or «⚠ Есть проблема» (with a description and a screenshot); «Сообщить об ошибке» — text and a screenshot; «Диагностика» — app and server versions, platform and Telegram version, screen, sync, timer, with «Скопировать отчёт». Everything reaches the owner as a bot message with the tester's name, @username link and the diagnostics line. At most 30 messages a tester a day.
- Owner: «Что проверить тестировщикам» — add and remove items, see ✓/⚠ counts and who answered what, clear the list for the next version.
- Profile → «О приложении» → «Сообщения от бота»: sends a test message right now and shows whether it arrived or why Telegram refused.

## v1.3.3 — Locks & Water (2026-10-31)

### Added
- Water mineralization (ppm) before brewing: optional «Минерализация воды» on the method screen and in the brew editor («не указана» until set; the first «+» gives 100 ppm, then 5 ppm steps), with a hint and the SCA range. Any value is accepted; outside 75–250 ppm the app says the water is softer or harder than SCA advises and what that does to the cup. The last value is offered for the next brew on any method.
- Cup TDS (%) after brewing, in the brew form («Измерения → TDS чашки», refractometer; the first «+» gives 1,30 %, espresso 9 %). The app shows the extraction yield and whether the cup is in the SCA golden range. Without the drink weight it is marked approximate («≈», the grounds are assumed to keep ~2 g of water per gram) with a note to weigh the drink; an optional «Вес напитка» (the first «+» starts from the estimate) makes it exact. Espresso uses the yield.
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
