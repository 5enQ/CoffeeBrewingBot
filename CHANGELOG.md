# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Work in progress is collected under **Unreleased** and becomes a version on release.

## Unreleased

### Added
- Profile card: avatar, name, optional Telegram link, featured badges, setup (chosen gear, up to 6) and a color theme. Shared by a link that never changes: friends always see the latest card.
- Card backgrounds from achievements. Every brew method: bronze (50 brews), silver (100), gold (500) and «Объёмный» (1000) — an obsidian card with the method icon extruded in 3D. Diamond for 1000 liters: faceted, iridescent, turns in 3D with the device, and carries the holder's number in the bottom-left corner (№ 1 for the first person to reach it, given by the server). Metals of one tier are one tile with a choice of the corner icon. Metals catch the light: a bright band travels across them with the tilt and small glints flash.

### Fixed
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
