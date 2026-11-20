# Brewbook — notes for coding agents

- **Design:** any change to how a screen looks or moves follows [`DESIGN.md`](DESIGN.md). Read it first; check the
  change against it (light and dark, phone width, a filmed strip for motion) before handing over.
- The interface is in Russian and English; code, comments and commit messages in English. Every interface string is
  written in Russian inside `tr('…')` (or `N_('…')` for a stored value shown with `trValue`), and its English goes into
  `src/i18n/en-strings.ts` — `tests/unit/i18n.test.ts` fails on a missing one. `node scripts/i18n-wrap.mjs file.tsx`
  wraps new Russian strings; `node scripts/i18n-keys.mjs --loose` lists Russian left outside `tr()`.
- Work on `dev`. Releases go dev → test → main; don't release unless asked. Before merging into `test` and again
  before `main`, run **Страж** (`npm run guard`): all checks of the project in one run. Release only when it is all green.
- After a change: `npx tsc -b`, `npx vitest run`, `npm run build:single`, then the e2e suites in `tests/e2e`
  (`npm run test:e2e`), and an entry in `CHANGELOG.md` under «Unreleased».
- UI autotests (`tests/e2e/ui_snapshot.py`) list every element whose font, color, size, padding or spacing
  differs from `tests/e2e/ui-baseline/`. Each listed line must be a change you meant; anything else is a side effect
  to fix. Once only the intended lines remain, `UPDATE=1 python3 ui_snapshot.py` and commit the baseline with the change.
