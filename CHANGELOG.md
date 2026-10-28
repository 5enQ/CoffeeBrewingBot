# Changelog

All notable changes are listed here. Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Work in progress is collected under **Unreleased** and becomes a version on release.

## Unreleased

### Changed
- Release process: work happens on the `dev` branch; a release is a merge into `main`, deployed in one go (app and server) and tagged `vX.Y.Z` by CI.
- Version and release title come from `package.json` and this changelog (`scripts/release-info.mjs`).
- Versions are named in English (`v1.1.0 — Title`); documentation and code comments are in English.

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
