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

The **⋯** beside any exercise's name opens its options. On all 92 built-ins and
your own alike you can attach **notes and setup cues** — "seat 4, pin 7, elbows
tucked" — which then show on the exercise while it's in your workout, and set a
**default number of sets and rest timer** for that exercise specifically, so
heavy squats load at 4×3:00 and curls at 3×0:45 without resetting anything.
**Archive** hides an exercise from the directory without touching a single thing
you've logged, which is how you get rid of the machines your gym doesn't have.
Exercises you added can also be renamed or recategorised, and deleted — the menu
sits at the opposite end of the card from the **+**, and delete is two taps
inside it.

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

**Cardio** — strictly cardio, with an interval timer built around the fact that
you cannot look at your phone while you are running. Pick a machine, and the
interval rows take that machine's own dials:

```
Treadmill                          Stairmaster
  Incline 3   Speed 2.5   2:30       Level 4    5:00
  Incline 8   Speed 3.8  15:00       Level 8    2:00
  Incline 10  Speed 4    10:00       Level 9    2:00
  Incline 2   Speed 3.3   2:30       Level 10   1:00
  Incline 15  Speed 2.5   6:00       Level 8    2:00
  Incline 6   Speed 2.5   2:00       Level 12   1:00
                          38:00      Level 6    2:00      15:00
```

Treadmill, stairmaster, indoor bike, rower, elliptical and jump rope are built
in; add your own machine and name its dials whatever the console calls them.
Running a plan beeps and buzzes at every change, shows the next interval's
settings before you get there, and keeps the screen awake. Save a plan as a
preset and it is one tap next time. Pause, skip and stop all work, and a run you
stop early logs what you actually did.

**Calendar** — every finished session lands on a day, dotted by the categories
you trained, cardio included. Pick a day to see exactly what you did — sets and
reps for lifting, interval by interval for cardio.

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
- If the device's storage is full or blocked, a banner says so at the top of the
  page. Anything logged while that banner is up is lost on reload — copy the
  session out through Settings → Share before closing the app.

**Export my data** in the avatar menu writes a JSON file holding everything —
profile, settings, history, records, your own exercises and splits, every note
and per-exercise default, and all of your cardio. Paste that file back into
Settings → Import and it offers to restore the lot. It says what it contains and
warns that restoring replaces what is on the device, because it does.

Keys are all prefixed `ptp-`: `ptp-tray`, `ptp-history`, `ptp-prs`,
`ptp-splits`, `ptp-profile`, `ptp-settings`, `ptp-theme`, `ptp-active-split`,
`ptp-custom-ex`, `ptp-custom-splits`, `ptp-cardio-plans`, `ptp-cardio-log`,
`ptp-cardio-machines`, `ptp-ex-prefs`.

---

## Keeping it up to date

Settings → **App version** shows the build you are running and a **Check for
updates** button. The app also checks quietly a few seconds after every launch
that has a signal, so the button is a way to hurry it rather than the only way
an update is ever noticed. When one is found, a banner offers a reload.

The check does not trust a version string: it fetches the published page and
compares it byte for byte against the copy the service worker has cached. That
catches a deploy even if `VERSION` was not bumped. It also calls
`registration.update()`, which is the only way a changed `sw.js` can be picked
up. Pressing reload primes the cache with the copy it already fetched, so the
new version lands even if the connection drops in between.

After a `git push`, GitHub Pages takes up to a minute or so to publish before
the check will see it.

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

Interface icons are [Tabler Icons](https://tabler.io/icons) (MIT), outline set —
31 of them, inlined into `index.html` as an `ICONS` map. Not a CDN and not an
icon font: both are one more thing to fail with no signal, and the whole set is
5 KB.

Paths in the manifest and service worker are relative (`./`), so the app works
from a GitHub project page as happily as from a domain root.

---

## Notes for future edits

Things that look like details and are not:

1. **A backup means every key, and a restore is not a share import.** The export
   object has to list each store explicitly, so a new feature that adds one is a
   new line here — miss it and the backup silently omits that data, which you
   only discover when you restore. Routing a backup through the share importer
   is what once reduced a full file to history alone: that path only understands
   sessions.

2. **`x` dismisses, `trash` destroys.** Seventeen `×` buttons once covered
   everything from "remove an interval you just added" to "delete a training day,
   no confirm, no undo", with nothing to tell them apart. Anything that destroys
   saved data now carries `trash`, turns `--danger` on hover, and confirms with a
   count of what goes with it.

3. **Icons are inlined SVG, never a text glyph.** Thirteen Unicode characters
   used to do icon duty. Two of them — U+23F1 STOPWATCH and U+2699 GEAR — are in
   the emoji set and iOS has no monochrome glyph for either, so it drew them from
   Apple Color Emoji: a colour stopwatch inside a monochrome badge. The rest
   simply arrived at whatever weight the device's fallback font used. `×` and `–`
   still appear all over the app and are *correct* there — "80kg × 8",
   "3–6 days/week" — so a blanket find-and-replace would be wrong; only the ones
   inside a control were swapped.

4. **A custom exercise's `uid` is assigned once and never changes.** The id was
   derived from the name slug, which made renaming one quietly destructive:
   every tray item, logged session, personal record and split day points at the
   id. Entries written before the uid existed adopt their current slug as the
   uid, so their ids survive the upgrade. Names are also *copied* into those
   records at the time they were made, so a rename has to walk them —
   `renameEverywhere()` does that.

5. **Per-exercise preferences live apart from `customEx`.** `ptp-ex-prefs` is
   keyed by exercise id and holds notes, default sets and rest, and the archived
   flag. It is separate because it applies to the built-ins too, and because
   nothing in it may ever reach a share code — codes carry catalogue indices and
   names, never preferences. Archived exercises stay in `EX` so history, records
   and split days still resolve; they are filtered at render only.

6. **`BUILTIN_EX_COUNT` is a boundary, not a statistic.** Share codes address
   built-in exercises by their index in `EX`. Anything past that index is a
   user's own exercise and travels by name instead. `mountCustomEx()` truncates
   to that count before re-appending, so indices can never shift. Adding a new
   built-in exercise anywhere but the end of its category's block will
   invalidate every share code already in the wild.

7. **The phone stylesheet must stay last.** Nearly every rule in the
   `@media (max-width: 560px)` block narrows a rule declared further up the
   file, and at equal specificity the later rule wins. A breakpoint written
   above the rule it means to override loses silently — that has bitten this
   file twice (the bottom tab bar's footer clearance, and the mobile `.tiles`
   gap).

8. **`[hidden]` needs `!important` here.** An author `display` rule outranks
   the user-agent `[hidden]` rule, so several flex containers ignored the
   attribute until `[hidden]{ display: none !important; }` was added near the
   top.

9. **`.layout > * { min-width: 0 }` is load-bearing.** A grid track's automatic
   minimum is `min-content`, and a text input's `min-content` is its default
   character width. Two of them per set row pushed the tray 144px off a 390px
   screen before that guard existed.

10. **The `⋯` menu is in the flow, deliberately.** It was an absolutely
   positioned popover and covered the expanded set rows underneath it. Do not
   put it back.

11. **Colours are separated by lightness, not hue.** The four category colours
   (`#c04529` push, `#2c6bb0` pull, `#94670c` legs, `#00846f` abs) were checked
   for every pair under protanopia, deuteranopia and tritanopia — not just
   adjacent pairs, which is what let an earlier palette ship with push-red and
   legs-gold at ΔE 2.7 under deuteranopia. Each accent also carries its own
   `--on-*` ink token so text on a filled control clears 4.5:1.

12. **Inputs are 16px on phones.** Anything smaller makes Safari zoom the page
   on focus, which on the workout screen means every reps and weight box.

13. **Safe-area insets go through `--sa-t/-r/-b/-l`, not raw `env()`.**
   `env()` cannot be set from script, so raw calls are untestable. The four
   variables on `:root` default to the `env()` values and let a test inject a
   real iPhone's insets. The rules that consume them live in the *last* block
   of the stylesheet, because the phone block above sets `header{ padding: ... }`
   as a shorthand — which is exactly how the landscape inset got wiped once.

14. **The iOS status bar is `default`, deliberately.** `black-translucent` hands
   the strip under the status bar and Dynamic Island to the page and forces
   white status text, which is unreadable over the light theme. With `default`,
   iOS reserves and paints that strip itself and picks its own contrast. The
   top inset is therefore 0 in portrait; the `max()` in the header padding
   means the layout is still correct if that ever changes. The side insets do
   real work in landscape, where the island and the rounded corners are on the
   left and right.

15. **`<meta name="ptp-version">` and `VERSION` in `sw.js` must stay in step.**
    The meta is what Settings displays and what the update check names in
    "version X is available". The comparison itself is a byte compare and does
    not depend on it, so a mismatch degrades the message, not the mechanism.

16. **Bump `VERSION` in `sw.js` on every change.** Installed copies serve from
    the old cache until the version string changes.

17. **The service worker only caches a response that proves it is this page.**
    A captive portal answers a same-origin GET with 200 and its own sign-in HTML,
    which status and type cannot tell apart from a deploy — and caching it
    replaces the offline app with the portal, permanently. The page carries a
    `<meta name="ptp-app">` sentinel and the worker checks for it before writing
    the shell. Do not remove that meta tag.

18. **`load()` takes a shape validator, and every call site passes one.**
    `JSON.parse` succeeding says nothing about shape. One wrong-typed value used
    to throw during init, before any listener was attached — so the tabs went
    dead and Settings → Reset, the only in-app way out, was unreachable. Init is
    also stepped, so one broken panel costs that panel and nothing else.

19. **Cardio is deliberately not a fifth entry in `CAT_ORDER`.** That constant
    drives the exercise tiles, the muscle-group chips and the share codec's
    catalogue indices; adding to it would shift every share code ever written.
    Cardio is a calendar category only — it has its own store, its own data
    shape (intervals with machine dials, not sets with weight and reps), and it
    appears in `CAT_LABEL` so the calendar can name it.

20. **The interval timer runs on wall-clock timestamps.** Decrementing a counter
    per tick drifts over a 40-minute plan, and a backgrounded tab throttles the
    ticks to nothing — with timestamps, returning to the app shows the right
    time rather than however many callbacks fired. Overshoot at an interval
    boundary is carried into the next one rather than discarded.

21. **Category colours are two sets, not one.** The saturated hues are for a
    filled surface with white ink on it. `--push-ink` and friends are the same
    hues re-searched in OKLCH for 4.5:1 as *text*; deriving them by lifting
    luminance alone walks push-red and legs-gold back together under
    deuteranopia. Calendar dots carry category by colour alone, so they also
    carry a shape — circle, square, diamond, bar, triangle.

22. **A logged session is editable in place; the tray is what moves it.** The
    calendar's day detail owns everything that happens *on* that day — the sets
    inside an exercise, the order of the exercises, the order of a cardio
    session's intervals, and the day's own date. Nothing there routes through
    the tray, because a round trip would mean the day briefly does not exist.

23. **Nothing may copy a logged session into the tray while leaving it in
    history.** That is what "Load into workout tray" used to do, and because
    logging merges same-day entries by appending `setLog`, re-logging it doubled
    every set. The two safe shapes are the only two offered: *Add exercises to
    this day* copies nothing and only aims the tray's date, and *Repeat this
    workout today* copies but lands on a different date — so it is hidden on
    today's own day, where it would merge back into its own source.

24. **`trayDate` is a one-trip instruction, and it is cleared by the log that
    consumes it.** It also expires: a stored date already in the past when the
    app reopens is dropped at boot, because silently filing today's session
    under last Tuesday is worse than forgetting which day was meant. While it is
    set it must be *visible* — the banner sits above the mode switch, not inside
    the tray, since on a phone the tray is a mode you have to be in and the
    whole point is knowing the target while browsing for what to add.

25. **Re-dating a day is a merge, not a move.** The target date may already hold
    work. It uses the same rule as logging — same exercise twice in a day
    appends its sets — because that is what a two-a-day is. Lifting and cardio
    on the same date move together.

26. **Every cardio entry carries a `cid`.** The store is one flat array across
    all dates, so position was the only handle on a row and reordering or
    re-dating made position a lie. Old entries are assigned one on first read
    and written straight back — an id regenerated each boot is not an id.

27. **`.btn-danger` is coloured at rest, not only on hover.** A phone has no
    hover, so every destructive button looked exactly like the harmless one
    beside it right up until it fired.

28. **"Reset all data" clears every key in `KEY`** — it iterates the object
    rather than listing names, plus the two `-draft`/`-m` suffixes, and spares
    only the theme. The hand-written list it replaced stopped at the nine stores
    that existed when it was written, so a reset left the cardio log and every
    exercise note in place while telling the user the opposite. Same rule as
    the backup: anything added to `KEY` is covered automatically.

### The share format

```
PTP2~W<u>~<name>~<item>!<item>…                 one workout
PTP2~L<u>~<name>~<YYYYMMDD>~<off>=<items>;…     a training log

<u>     unit the weights are in: "k" kg, "l" lb. Absent on codes written before
        units were carried; those read as kg and are converted on import.
item = <ref><mode><body>[+<letter>]
  ref   base36 index into the built-in catalogue, or "?" + base64url of
        "<name>" or "<name>\u001f<cat>\u001e<equipment>" for your own exercises
  mode  "*" = a plain set count
        ":" = "-"-joined sets, each "80x8" (weight × reps) or a bare rep count
  +A    superset group, scoped to this one message
  off   days after the start date, base36, 0…3650
```

The importer also still reads the older `PTP1` base64 format, so codes shared
before the compact encoding landed keep working.

---

Exercise names and categories follow [ExRx.net](https://exrx.net/Lists/Directory).
Each card links back to the directory.
