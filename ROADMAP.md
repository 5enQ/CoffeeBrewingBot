# Roadmap

Plans and ideas for later, so they are not lost between conversations.
This file lives in the `dev` branch only: changes go `dev` → `test` → `main`, and the merge into `test` leaves it out (see README → Branches, releases and versions).
What is already done but not released lives in [CHANGELOG.md](CHANGELOG.md) under **Unreleased**.

How to use this file:
- an idea that is put off goes to **Ideas** (or **Next**, if it is agreed to do it soon);
- when work starts, it moves to **In progress**; when it is released, it is removed from here (the changelog keeps the history);
- **To check** lists things that are built but not yet verified in real use.

## In progress

_Nothing right now._ Unreleased work is in the changelog.

## Next

- **Bug reports → fixes.** Works in production since 2026-11-01 (after the webhook was set by hand): the first reports became CoffeeBrewingBot#1–#3, #2 was fixed by the daily check. In dev, not released yet: reports go to the private `5enQ/brewbook-bugs` with names and screenshots, one Telegram message per report with a screenshot, the webhook is registered before a report with the button is sent, the release closes `claude-fixed` issues in both repositories. After the release: send a report with a screenshot, press the button, the issue must appear in brewbook-bugs with the picture.

## Ideas

- **Test build for testers.** The `test` branch exists, but testers use the production app. A separate build of `test` (its own Mini App link and, ideally, its own copy of the server so tests do not touch real data) would let them try versions before the release.

- **Global coffee rating.** The server catalog of roaster lots was built as its base: lots already carry their state (on sale, out of stock, archived, gone) and how many users confirmed them. Missing: collecting ratings per lot from brews, a screen to browse it, protection against rating the same lot many times.
- **Standalone app outside Telegram.** Accounts are ready for it: one account with linked sign-in identities (`tg:<id>` now). Missing: another way to sign in (for example "Log in with Telegram" on the web, or Apple/Google), an app shell, sync without Telegram CloudStorage.
- **Other languages.** English, Japanese and Chinese strings are prepared (`src/i18n`), only Russian is enabled (`ENABLED_LOCALES`). Missing: translating the rest of the UI that is still written in Russian directly, a language switch.
- **Diamond card on weak phones.** If it still lags after 1.3.2, turn off the 3D turn on slow devices and keep only the shimmer.
- **Crawler budget for the whole server.** The 70% limit covers only the roaster crawler; ordinary app requests are not capped. Fine at the current number of users; worth a look if the audience grows.

## To check

- **Testers' panel** — the bot messages to the owner (answers on the checklist, bug reports with a screenshot) were tested locally only; check that they arrive.
- **Bot reminder when a cold brew ends** — did not arrive on 2026-11-01 (the server never had it scheduled: no alarm ran). Fixed in dev (no hang on the write-access request, self-repair, status on the server). After the release: Profile → «О приложении» → «Сообщения от бота» must say «Работает», then a real cold brew must bring the message.
- **Rockets (rockets.coffee) does not answer foreign servers** (checked 2026-11-02): from GitHub (USA) and from a Cloudflare worker every request timed out, while silkydrum.ru answered in 1.4 s. The site most likely accepts only Russian addresses, so the crawler cannot read it and scans of its links cannot be looked up. Options: ask Rockets to allow the crawler, fetch through a server in Russia, or leave the site out. The crawl rules for it were never checked against real pages.
- **Owner tools** need the GitHub secret `OWNER_TELEGRAM_ID`; confirm it is set (Profile shows «Сайты обжарщиков» and «Разработчики и тестировщики» only to the owner).

## Small polish

- Lock rows (Кофе / Вода / Пропорция) are slightly indented compared with «Температура» and «Помол» below them.
- «Минерализация воды» wraps to two lines on narrow phones; a shorter label («Вода, ppm») is an option.
- The `probe-pages` branch is a helper for checking production (curl + log tail); delete it when no longer needed.
