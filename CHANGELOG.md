# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Work in progress is collected under **Unreleased** and becomes a version on release.

## Unreleased

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
