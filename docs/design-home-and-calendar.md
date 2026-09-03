# Design — a home screen and a month calendar

Status: approved 2026-09-01, not built.
Sits after: `design-equipment-and-swap.md`, `plan-07-exercise-count.md`.
Reason for that order: this moves the soreness map off the session card and
takes one regeneration path out of `showSession`. Both are easier to do once the
card's controls have stopped changing shape every fortnight.

## 1  The feature

The app currently opens straight onto a workout. Two things follow from that,
and both are problems.

**The app decides for you.** There is no moment between launching and being
handed a session. Opening the app to check what you did on Tuesday means being
issued a workout for today.

**Opening the app is indistinguishable from training.** `storage.js` says it
plainly at line 78:

> Generating a session marks it done (spec §1), so merely OPENING the app on a
> rest day writes a completed workout.

Those entries feed the rolling pattern counts, the CNS account and the neglect
score, and since design §4.4 the exercise count reads the same counts — so they
distort session *shape*, not only scoring. The `pendingConfirmations` prompt
exists to clean up after them the next day.

The feature is a home screen that generates nothing until asked, and a month
calendar showing the days actually trained.

## 2  What generation means now

**Tapping Generate is what writes a session. Launching the app is not.**

This is the load-bearing change; everything else is arrangement. `resolveSession`
and `commitSession` move out of the launch path and behind the button.

It does not eliminate phantom entries. Tapping Generate and then not training
still writes a day, and the next-launch prompt still has to ask about it. What it
does is shrink the population from *every launch* to *every launch where you
asked for a workout*, which is a much smaller and much more deliberate set.

Spec §1's "Generating a session marks it as done" stays true. Spec §1's product
sketch — `open app → tap body map → app proposes` — does not, and is amended in
this design's §9.

### 2.1  What was rejected

**Confirm from the calendar instead of the next-launch prompt.** Tapping a day
to mark it trained or not would fold two mechanisms into one. Rejected because
it makes the calendar a control that mutates the generator's inputs, and the
calendar is the one screen that should be safe to poke at. The prompt already
works and is not the thing being fixed.

**Auto-discard unconfirmed past days silently.** "If I did not click completed,
assume I did not complete it" is the athlete's own rule (§4), and taken to its
conclusion it would delete unconfirmed days without asking. Rejected: training
and forgetting to tap is more likely than the reverse, and silently deleting a
real session makes the generator think he is fresher than he is. Under-recovery
is the failure mode this app exists to avoid. The prompt is the safety net and
it stays.

## 3  Entry flow

```
boot()
 ├─ no profile                          → setup            (unchanged)
 ├─ pending unconfirmed past days       → "Did you finish this?"  (unchanged)
 ├─ today generated and not confirmed   → session
 └─ otherwise                           → HOME
```

The third branch is the one worth defending. A home screen that always
intercepts is a speed bump at the gym: the athlete reopens the app between sets,
and making him tap past a calendar to get back to the workout he is halfway
through is friction in exactly the place the app is supposed to disappear.

So: the home screen is where you land on a rest day, and before you start. Once
today has an unconfirmed session, the app assumes you are training and goes
straight to it. A Home control on the card gets back.

A **confirmed** session for today does not trigger that branch — training is
over, and home is the right place to be.

## 4  The calendar shows confirmed days only

A day appears once `confirmed === true` and not before. Two cell states: blank,
or trained. There is no third "generated but unanswered" state.

The athlete's rule, verbatim: *if I did not click workout completed, assume I
have not completed the workout.*

The consequence is worth stating because it is mildly counterintuitive: **train,
forget to tap, and the day stays blank.** It appears retroactively when the
next-launch prompt is answered Yes. The calendar can gain a past day after the
fact.

There is a narrow inconsistency here. The generator counts an unconfirmed entry
while the calendar hides it, so for a short window the two disagree about
whether a day happened. It is self-correcting: `showPendingOrSession` resolves
every pending day at launch before anything can be generated, so the only
unconfirmed entry the generator ever sees is today's own. Not worth machinery.

## 5  `js/calendar.js` — a new module

Month-grid arithmetic goes in its own file, with no DOM in it.

```js
monthGrid(year, month, history, today) -> [[cell, ...], ...]   // weeks
```

A cell is `{ date, inMonth, isToday, session }`, where `session` is the
**confirmed** history record for that date or `null`.

Two reasons for a module rather than another function in `ui.js`:

**`ui.js` is already 704 lines.** A month grid plus a legend plus a header is not
a small addition, and the file is at the size where things start getting lost.

**Date arithmetic is where this project has actually been bitten.** `localDate()`
exists because `toISOString()` locked the card the morning after an evening
session, and `ui.js` imports it for that reason alone rather than keeping a
second copy. Month boundaries, leap years and DST transitions are the same class
of bug one step harder. That logic wants to be pure and tested directly, the way
`generator.js` is — not reachable only through a rendered grid.

**No `Date.toISOString()` anywhere in this file.** Dates are `YYYY-MM-DD`
strings compared as strings, and constructed from local components. The history
records are already keyed that way.

Weeks start **Monday**. The athlete trains in kg.

## 6  The home screen

Four things, top to bottom.

**Status line.** Ramp week, and days since the last confirmed session. Both are
facts the app knows and currently shows nowhere. Kept deliberately to two —
this is a landing screen, not a dashboard.

**The soreness body map**, moved here from the session card.

**The primary button.** `Generate today's workout`. When today is confirmed it is
replaced by the day type and a View link — there is nothing to generate.

**The calendar.**

### 6.1  Moving the soreness map is a fix, not a relocation

Today the map lives on the workout card, and `app.js:56` shows what changing it
does: `soreChanged: true`, which rebuilds the session being looked at. The
workout reshuffles under you.

On the home screen the ordering is the one that makes sense — flag what is sore,
*then* generate — and soreness informs the first build instead of forcing a
second. The `soreChanged` path leaves `showSession` entirely.

Soreness continues to live on the **profile**, not the session. That is what
makes the flags persist pre-checked into the next session and turns them into a
de facto chronic-injury profile (spec §4.1). Nothing about that changes.

## 7  Reading a past day

Tapping a trained cell opens that session read-only.

`renderSession` gains a `readOnly` option rather than acquiring a duplicate
renderer — the block rendering, the load lines and the flip cards are a few
hundred lines that must not fork. The function already guards its swap control
with `typeof onSwap === 'function'`, so most of read-only is passing no
handlers; the option additionally suppresses the footer actions and the
soreness, equipment and add-move panels.

Rejected: rendering past sessions with a lighter, separate component. It would
drift from the real card within two features, and the first time it drifted the
athlete would be reading a past workout laid out differently from the one he
trained.

## 8  Accessibility and the colour question

Seven day types need seven distinguishable marks on a dark background.

**Colour is never the only encoding.** Each trained cell carries a two-letter
code as well as a colour, with a legend below the grid:

| Day type | Code |
|---|---|
| max-strength | `ST` |
| power | `PW` |
| hypertrophy | `HY` |
| aerobic-steady | `AE` |
| interval | `IV` |
| sprint | `SP` |
| plyometric | `PL` |

Two letters, not one. Single initials collide — `S` is both max-**s**trength and
**s**print, `P` is both **p**ower and **p**lyometric — and resolving a collision
by reaching for a letter that is not in the word (`R` for sprint, `Y` for plyo)
produces a legend nobody can read without consulting it every time. Seven hues
separable by every form of colour vision do not exist; seven two-letter codes do.

The cell shows the date number and the code. That is two pieces of text in a
phone-width grid cell and it is the tightest layout in the app — see §10 on why
this one gets looked at on a real device.

Cells are real buttons with an accessible name (`"14 September, Max Strength"`),
not styled divs. Blank days are not focusable — there is nothing to open.

Tap targets follow the existing card controls; a 7-column grid on a phone is the
tightest target in the app and is the thing to check on a real device rather
than in a desktop window narrowed to phone width.

## 9  Documentation that stops being true

Not optional, and not a tidy-up afterwards. Spec §1's product sketch opens
`open app → tap body map for anything sore → app proposes a day type`. After
this it is `open app → home → tap body map → tap Generate → app proposes`.

- **spec §1** — amend the flow sketch; keep "generating marks it done", now
  reached by a tap.
- **spec §6 limitation 1** — the phantom-entry limitation shrinks in scope and
  the sentence describing it needs to say so.
- **spec §7** — `js/calendar.js` joins the module list.

## 10  Testing

**`tests/calendar.test.mjs`**, new. The month model, directly:

- a month that starts on a Monday, and one that starts on a Sunday
- February in a leap year and a common year
- a session on the 1st and a session on the 31st — both must land in the grid
- a month with no training at all
- unconfirmed sessions do not appear (§4)
- leading and trailing cells carry `inMonth: false`
- `isToday` is set for exactly one cell, and only in the month containing it

**`tests/ui.test.mjs`**, extended. `renderHome` in its three states — nothing
generated, today generated and unconfirmed, today confirmed — plus the read-only
session render suppressing every control it should.

**The existing 328 must stay green.** `generator.js`, `rules.js`, `templates.js`
and `storage.js` are untouched by this design. A red test in any of them means
something unintended broke, not that an expectation needs updating.

The `dom-shim` limit from `design-card-flip.md` §8 applies with full force here:
a 7×5 grid is a layout problem, and the shim has no layout. This gets looked at
in a browser before it is called done.

## 11  Build order

1. `js/calendar.js` and its tests — pure, no UI, nothing else depends on it yet
2. `renderCalendar` in `ui.js`, against the model
3. `renderHome` with the status line and the button, calendar embedded
4. Move the soreness map; delete the `soreChanged` path from `showSession`
5. Re-route `boot()` (§3); move `resolveSession`/`commitSession` behind the tap
6. `readOnly` on `renderSession`; wire cell taps
7. Styles
8. Docs (§9)
9. `sw.js`: add `js/calendar.js` to `SHELL`, bump `VERSION` to `v24`
10. Browser check on a real phone — **done 2026-09-03, passed.** See the
    note at the foot of `plan-08-home-and-calendar.md`.

Step 9 is the one that silently ruins a deploy. A new file absent from `SHELL`
is a file installed phones never fetch, and a `VERSION` left at `v23` means they
never look. `sw.js` opens with a warning comment about exactly this.

## 12  Open questions

**Does the status line survive contact with the athlete?** It is two facts on a
screen that otherwise has one button and one grid. If it reads as clutter it
comes out; nothing depends on it.

**How far back should the calendar page?** Arrows go back indefinitely today
because history is small and there is nothing to paginate. If it ever gets long
enough to matter, the answer is probably to stop at the return date — there is
nothing before it.

**Does the home screen want a "train anyway" for a confirmed day?** Confirming
today currently means the day is done. Whether a second session on one day is a
thing he ever wants is unknown, and guessing would add a control nobody asked
for. Left alone until it comes up.
