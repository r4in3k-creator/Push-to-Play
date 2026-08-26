# Push to Play

A workout app in a single self-contained HTML file. No build step, no server, no sign-in —
open `push-to-play.html` in a browser and it works. Everything you enter is stored in that
browser's local storage on that device.

Exercises are categorised **Push / Pull / Legs / Abs**, sourced from the
[ExRx.net exercise directory](https://exrx.net/Lists/Directory) and its
[3-day Push/Pull/Legs template](https://exrx.net/Workouts/Workout3PPL).
Not affiliated with ExRx.net.

## Running it

Open the file. That's it.

```
open push-to-play.html
```

It is deliberately dependency-free: all CSS and JavaScript are inline, and the only external
request is a Google Fonts stylesheet. It works offline apart from the fonts falling back.

## What's in it

| Tab | What it does |
| --- | --- |
| **Train** | The exercise directory with search and equipment filtering, plus the workout tray. Add your own exercises here. |
| **Splits** | 11 programme templates (PPL, PPLUL, Upper/Lower, Full Body, PHUL, Arnold, Bro Split, Batman, Smolov Jr, GVT, StrongLifts 5×5). Swap, add and remove exercises; rename, add and delete days; or build a split from scratch. |
| **Calendar** | Every logged session, with category dots per day, monthly stats and a current streak. Reload any past session back into the tray. |
| **Records** | Personal records per lift with an Epley estimated 1RM, a progression chart and full entry history. Bench, deadlift and squat by default. |
| **Account** | A local profile — name, bodyweight, goal, experience. No password, no server. |
| **Settings** | Units, week start, default sets and rest, theme, plus Share and Import. |

### The workout tray

Each exercise sits collapsed showing its name, equipment and set count. `+` expands it into
one row per set with a reps field and a completion checkbox. `⋯` opens per-exercise options:
link it into a superset with another exercise, or set a rest timer that starts counting down
when you tick a set off.

### Sharing

A share is one block of plain text — a readable plan for the person reading it, plus a short
import code on the last line so their copy of the app can load it without retyping:

```
Push to Play — Push day
Raine · 2 exercises, 7 sets

1) Barbell Bench Press · Barbell
   4 sets: 12, 10, 8, 6
...

PTP2~W~UmFpbmU~0:12-10-8-6+A!k*3+A
```

The code addresses built-in exercises by their index in the catalogue, which is what keeps it
short. Exercises you added yourself have no shared index, so those travel by name instead and
still import correctly for someone who has never seen them.

Paste a whole message into **Settings → Import** — the code is found automatically. A shared
training log lists each day with a "Do this one" button so someone can work through your
programme session by session.

## Repository layout

```
push-to-play.html          the entire application
docs/palette-study.html    live comparison of the colour directions considered
```

## Notes for future edits

A few decisions in the source are load-bearing and easy to break:

- **Only ever append to the built-in `EX` array.** Share codes address built-ins by array
  index, so inserting or reordering an entry silently changes what every existing code means.
  `BUILTIN_EX_COUNT` marks the boundary; anything past it is a user-added exercise and is
  encoded by name.
- **Validate category colours across every pair, not just neighbours.** A calendar day can
  show any two dots side by side. An earlier palette passed an adjacent-only check at ΔE 12.8
  while push and legs were actually 2.7 apart under red-green colourblindness — indistinguishable.
- **Filled accent controls use their own ink token** (`--on-push` and friends), not the page
  background, because a single ink colour does not clear 4.5:1 contrast on all four accents.
- **The per-exercise `⋯` panel sits in normal flow**, not absolutely positioned. As a floating
  popover it covered the expanded set rows underneath it.
