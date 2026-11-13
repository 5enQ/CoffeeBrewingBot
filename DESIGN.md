# Brewbook design rules

How a screen of Brewbook should look and move, so every update stays in one style. Adapted from the craft and
motion rules of the Stageshow skill (benjitaylor/skills) to a real app. Read before changing any screen; check a
change against it before it ships.

## The one idea

A calm screen with one thing to look at, each word where it is needed, and every change that moves for a reason.
The app looks like filter paper with a coffee-leaf green: quiet surfaces, one accent, real content.

## Tokens (src/index.css, `:root`)

- Colors only from tokens: `--bg`, `--card`, `--fg`, `--hint`, `--accent` (+ `--accent-soft`, `--accent-fg`),
  `--sep`, `--hint-soft`, `--fg-soft`, `--danger`, `--star`, `--cherry`. Every token has a dark value; never write a
  color that works in one theme only. In Telegram the theme comes from its settings — check light and dark.
- High contrast (`[data-contrast="high"]`, a profile setting) has its own token values and gives surfaces an edge
  (`--edge` outline). A new card-like surface joins that list in index.css; check it with high contrast on too.
- A folding section is `<Section fold="key">` (kit.tsx): the body opens with its height, the open state is remembered.
- Status colors mean status (`--danger` errors, `--star` ratings, `--cherry` scores); the accent is for the one
  action or the one selected thing on a screen.
- Radius `--r` (14px) for cards and groups; pills 99px; nested shapes: outer radius = inner radius + padding.
- Type: the system stack (`--font`), numbers in `--font-num` with `tabular-nums`. 13–17px for UI text, never under
  11px; sentence case; `.eyebrow` (12px caps, 0.08em) only for section labels. Hierarchy from size and one weight
  step, not from more boxes.

## The still frame

- **Say it once.** If an icon says the method, the line beside it does not; one link or button per action.
- **One number is big** on a screen (the timer's time, a stat); the rest are ordinary text.
- **One line under a title** in a list row: tag first, then the facts that tell rows apart. A unit or a value never
  wraps onto a line of its own: shorten the text, drop the least useful fact, or let a secondary name give way
  with an ellipsis (`.one-line`, `.one-line-text`). The title itself stays whole.
- **Tiles in a row keep one height:** labels short enough for one line each.
- **Words keep 12px from any edge** (cards, rows, buttons); row padding 12px (8px in dense lists). A title sits
  4–6px over its subtitle; more space goes between records, not inside them.
- **No near-tangents:** edges either line up exactly or stand 8px or more apart. Nothing pokes past the edge of
  what holds it (icons: a drip bag's arms end on the cup's rim).
- **Text never touches a neighbor:** fixed gaps of 8–12px, not leftover `space-between`.
- **Empty states** stand apart from the content above them, centered, with the one action as a real button in the
  middle — not a gray note glued under a card.
- **Words are Russian and grammatical:** plurals through `src/data/plural.ts` (`plural(n, BREWS)` and friends),
  never one form for every number; non-breaking spaces between a number and its unit.
- **Class names are unique per component.** Two components sharing a class name is how a grid got squeezed into one
  cell; prefix by component (`method-icon-pick`, `cup-line .cup`) and search the CSS before naming a class.

## Icons

- Our own line set: 24-unit UI icons (`Icon`), 32-unit method icons (`MethodIcon`), stroke 1.6, round caps and
  joins, `currentColor`, no fills except small details. A new icon is drawn in the same weight and checked at its
  smallest size and in both themes beside its neighbors (a sheet with the old icon, the new one large, the new one
  at tab size, and the new one on dark).
- A method icon at UI size gets `weight={2.1}` so it weighs as much as the 24-unit icons beside it.
- Draw the real object's silhouette (a cezve: flared rim, lip, narrow neck, round bottom, long handle), not a
  generic cup. Packs on the shelf are doypacks: a straight sealed top, nearly straight sides.
- Emoji are content, never icons.

## Press and feedback

- Every pressable thing answers: a press look (components with their own keep it; the rest dim via the global
  `:where(...)` rule) and, in Telegram, a light tap of the phone — added automatically unless the handler vibrates
  itself (`platform.haptic`). Disabled things do neither.
- A filled button keeps its color when pressed; success is the one real change.
- Destructive actions ask first (`platform.confirm`) and say what stays («заварки останутся в дневнике»).
- Screens with an own object (a brew, an own recipe) end in the same footer: round delete, «Изменить», then the
  main action, wide.

## Motion (src/ui/motion.tsx)

- **Every change moves; only what changed moves.** A value that changes rolls (`<Roll text=…>`: the changed digits
  roll, up when it grows, down when it falls, last digit first). Content replaced by content of the same kind
  slides in place (`<Swap id=…>`: the old leaves upward as the new comes from below, inside a clipped, soft-edged
  slot). The container stays; never remount a card with a `key` to "animate" a change.
- **Feedback is as quick as the input** (presses, steppers: 0.4s or less); only storytelling motion slows down.
- Easing: travel `cubic-bezier(0.45, 0, 0.1, 1)`, arrival `cubic-bezier(0.25, 0.8, 0.25, 1)`.
- Old content in a transition is not text the app reads (`Roll` draws the old digit with CSS), and a running clock's
  re-renders never cancel a transition (keep timers in refs).
- Nothing pops in or blinks out; a list that grows makes room as the new row arrives.
- Ambient motion (holiday decorations, card scenes, drip-timer water) loops seamlessly and stays behind content,
  and stops with «Анимация фонов» (`html[data-still]`): a new looping background honors that switch too.
- `prefers-reduced-motion`: nothing slides, scales or loops, but a change in place still shows itself with a 0.2 s
  opacity fade (`calm-in`); always check it.
- Focus is always visible: a field you type into gets a 2 px accent ring (inset), never only a darker fill; the
  page scrolls with room for the sticky title and the bottom bar.
  Inside a card that clips (`overflow: hidden`, a scroller) the ring goes inside the control; a new scroller or
  clipping card leaves room for it. `tests/e2e/keyboard.py` walks the main screens with Tab and fails on a cut ring.

## Checking a change

- Screenshot the changed screens at phone width (390) in light and dark; look at the result next to the screen
  before it, and at the neighbors of what changed.
- For motion, film it: a strip of frames 60–80ms apart through the change (the overlap mid-transition, the
  baseline of rolling digits, the last frame clean).
- Add an e2e check for the behavior (`tests/e2e`), including that the moving parts settle.
- **Only what you meant changes.** `tests/e2e/ui_snapshot.py` measures every visible element of the main screens
  (light, dark, high contrast, desktop) and lists what differs from the baseline. Read the list: a rule written for
  one label that also shrank a number shows up there as a line you did not expect. Update the baseline only when
  every line is intended.
