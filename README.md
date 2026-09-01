# Push to Play

A workout tracker that runs entirely in the browser. One HTML file, no build
step, no server, no sign-in. Open it, and it works — including offline, once
it has been installed.

Live: https://r4in3k-creator.github.io/Push-to-Play/

---

## What it does

**Browse** — 92 exercises from the [ExRx directory](https://exrx.net/Lists/Directory),
sorted into Push (27), Pull (24), Legs (24) and Abs (17). Tap a category to see
its muscle groups; tap a muscle-group chip to narrow to one — triceps without
the chest and shoulders. Search and an equipment filter compose on top of both.
Anything the directory doesn't cover, you add yourself under **+ New exercise**;
your own exercises sit alongside the built-ins everywhere.

**Workout** — add exercises to the tray, set how many sets, and expand a card
into one row per set with a weight field, a reps field and a completion
checkbox. Each row shows what you did last time as its placeholder, so you are
never guessing. Filling in a set carries the same numbers forward to the next
one. The ellipsis menu handles supersets and rest timers, per exercise.

**Splits** — eleven templates, each editable: swap an exercise, add a day, add
your own. One tap loads a day into the tray.

| Split | Days | Goal |
|---|---|---|
| Push / Pull / Legs | 3–6 | Hypertrophy |
| PPLUL | 5 | Size + strength |
| Upper / Lower | 4 | Balanced |
| Full Body | 3 | General fitness |
| PHUL | 4 | Power + size |
| Arnold Split | 6 | Mass |
| Bro Split | 5 | Mass |
| Batman | 4 | Athletic strength |
| Smolov Jr | 4 (3 weeks) | Peak one lift |
| German Volume Training | 5 | Hypertrophy |
| StrongLifts 5×5 | 3 | Strength |

**Calendar** — every finished session lands on a day, dotted by the categories
you trained. Pick a day to see exactly what you did.

**Records** — estimated one-rep max per lift, on the Epley formula
(`weight × (1 + reps / 30)`), charted over time. Bench press, deadlift and
squat are there by default; swap in anything from the directory.

**Share** — Settings → Share turns a workout, or every session in a date range,
into a short text code you can paste into WhatsApp or a text message. Whoever
receives it pastes it back into their own copy and the workouts load, sets and
all. No account, no upload, nothing to sign up for.

---

## Where the data lives

In your browser's `localStorage`, under this site's origin. Nothing is sent
anywhere — there is no server to send it to. That has two consequences worth
knowing:

- Clearing site data for this origin erases your history.
- Your phone and your laptop keep separate copies. The share code is how you
  move a workout between them.

Keys are all prefixed `ptp-`: `ptp-tray`, `ptp-history`, `ptp-prs`,
`ptp-splits`, `ptp-profile`, `ptp-settings`, `ptp-theme`, `ptp-active-split`,
`ptp-custom-ex`, `ptp-custom-splits`.

---

## Installing it as an app

Open the live URL, then:

- **Android / Chrome** — the install prompt appears in the app itself, or use
  ⋮ → *Install app*.
- **iOS / Safari** — Share → *Add to Home Screen*. (Safari has no install
  prompt; the app detects iOS and says so.)

Installed, it opens full-screen with no browser chrome and loads offline.

---

## The files

| File | What it is |
|---|---|
| `index.html` | The whole app — markup, styles and script in one file |
| `manifest.webmanifest` | Name, icons, colours, standalone display |
| `sw.js` | Service worker: network-first for the page, cache-first for assets |
| `icons/` | 192/512 icons, maskable variants, apple-touch-icon |

Paths in the manifest and service worker are relative (`./`), so the app works
from a GitHub project page as happily as from a domain root.

---

## Notes for future edits

Things that look like details and are not:

1. **`BUILTIN_EX_COUNT` is a boundary, not a statistic.** Share codes address
   built-in exercises by their index in `EX`. Anything past that index is a
   user's own exercise and travels by name instead. `mountCustomEx()` truncates
   to that count before re-appending, so indices can never shift. Adding a new
   built-in exercise anywhere but the end of its category's block will
   invalidate every share code already in the wild.

2. **The phone stylesheet must stay last.** Nearly every rule in the
   `@media (max-width: 560px)` block narrows a rule declared further up the
   file, and at equal specificity the later rule wins. A breakpoint written
   above the rule it means to override loses silently — that has bitten this
   file twice (the bottom tab bar's footer clearance, and the mobile `.tiles`
   gap).

3. **`[hidden]` needs `!important` here.** An author `display` rule outranks
   the user-agent `[hidden]` rule, so several flex containers ignored the
   attribute until `[hidden]{ display: none !important; }` was added near the
   top.

4. **`.layout > * { min-width: 0 }` is load-bearing.** A grid track's automatic
   minimum is `min-content`, and a text input's `min-content` is its default
   character width. Two of them per set row pushed the tray 144px off a 390px
   screen before that guard existed.

5. **The `⋯` menu is in the flow, deliberately.** It was an absolutely
   positioned popover and covered the expanded set rows underneath it. Do not
   put it back.

6. **Colours are separated by lightness, not hue.** The four category colours
   (`#c04529` push, `#2c6bb0` pull, `#94670c` legs, `#00846f` abs) were checked
   for every pair under protanopia, deuteranopia and tritanopia — not just
   adjacent pairs, which is what let an earlier palette ship with push-red and
   legs-gold at ΔE 2.7 under deuteranopia. Each accent also carries its own
   `--on-*` ink token so text on a filled control clears 4.5:1.

7. **Inputs are 16px on phones.** Anything smaller makes Safari zoom the page
   on focus, which on the workout screen means every reps and weight box.

8. **Safe-area insets go through `--sa-t/-r/-b/-l`, not raw `env()`.**
   `env()` cannot be set from script, so raw calls are untestable. The four
   variables on `:root` default to the `env()` values and let a test inject a
   real iPhone's insets. The rules that consume them live in the *last* block
   of the stylesheet, because the phone block above sets `header{ padding: ... }`
   as a shorthand — which is exactly how the landscape inset got wiped once.

9. **The iOS status bar is `default`, deliberately.** `black-translucent` hands
   the strip under the status bar and Dynamic Island to the page and forces
   white status text, which is unreadable over the light theme. With `default`,
   iOS reserves and paints that strip itself and picks its own contrast. The
   top inset is therefore 0 in portrait; the `max()` in the header padding
   means the layout is still correct if that ever changes. The side insets do
   real work in landscape, where the island and the rounded corners are on the
   left and right.

10. **Bump `VERSION` in `sw.js` on every change.** Installed copies serve from
    the old cache until the version string changes.

### The share format

```
PTP2~W~<name>~<item>!<item>…                 one workout
PTP2~L~<name>~<YYYYMMDD>~<off>=<items>;…     a training log

item = <ref><mode><body>[+<letter>]
  ref   base36 index into the built-in catalogue, or "?" + base64url(name)
  mode  "*" = a plain set count
        ":" = "-"-joined sets, each "80x8" (weight × reps) or a bare rep count
  +A    superset group, if any
```

The importer also still reads the older `PTP1` base64 format, so codes shared
before the compact encoding landed keep working.

---

Exercise names and categories follow [ExRx.net](https://exrx.net/Lists/Directory).
Each card links back to the directory.
