# Roadmap

Plans and ideas for later, so they are not lost between conversations.
What is already done but not released lives in [CHANGELOG.md](CHANGELOG.md) under **Unreleased**.

How to use this file:
- an idea that is put off goes to **Ideas** (or **Next**, if it is agreed to do it soon);
- when work starts, it moves to **In progress**; when it is released, it is removed from here (the changelog keeps the history);
- **To check** lists things that are built but not yet verified in real use.

## In progress

_Nothing right now._ Unreleased work for 1.3.3 is in the changelog.

## Next

_Nothing agreed yet._

## Ideas

- **Global coffee rating.** The server catalog of roaster lots was built as its base: lots already carry their state (on sale, out of stock, archived, gone) and how many users confirmed them. Missing: collecting ratings per lot from brews, a screen to browse it, protection against rating the same lot many times.
- **Standalone app outside Telegram.** Accounts are ready for it: one account with linked sign-in identities (`tg:<id>` now). Missing: another way to sign in (for example "Log in with Telegram" on the web, or Apple/Google), an app shell, sync without Telegram CloudStorage.
- **Other languages.** English, Japanese and Chinese strings are prepared (`src/i18n`), only Russian is enabled (`ENABLED_LOCALES`). Missing: translating the rest of the UI that is still written in Russian directly, a language switch.
- **Diamond card on weak phones.** If it still lags after 1.3.2, turn off the 3D turn on slow devices and keep only the shimmer.
- **Crawler budget for the whole server.** The 70% limit covers only the roaster crawler; ordinary app requests are not capped. Fine at the current number of users; worth a look if the audience grows.

## To check

- **Bot reminder when a cold brew ends** — never seen live yet: start a cold brew in Telegram, allow messages from the bot, wait for the message (or pause/resume to re-arm it).
- **Rockets (rockets.coffee) crawl rules** — the site could not be opened from the build environment; check the lot count in Profile → «Сайты обжарщиков» and adjust the rules if pages are missing or merch slipped in.
- **Owner tools** need the GitHub secret `OWNER_TELEGRAM_ID`; confirm it is set (Profile shows «Сайты обжарщиков» and «Разработчики и тестировщики» only to the owner).

## Small polish

- Lock rows (Кофе / Вода / Пропорция) are slightly indented compared with «Температура» and «Помол» below them.
- «Минерализация воды» wraps to two lines on narrow phones; a shorter label («Вода, ppm») is an option.
- The `probe-pages` branch is a helper for checking production (curl + log tail); delete it when no longer needed.
