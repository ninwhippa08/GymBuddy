# GymBuddy

An offline-first workout generator. It proposes **one training session at a
time**, chosen from what you have recently trained, what is sore today, and how
long you have been back in the gym — and it prescribes every lift as a
percentage of your own personal records rather than an absolute weight.

**Live app:** <https://ninwhippa08.github.io/GymBuddy/>
Open it on a phone and add it to the home screen; after the first visit it runs
with no network at all.

The user it was built for is a retired college American football athlete
returning to training after a long lay-off, lifting 1–3 times per week on an
irregular schedule. Every rule the generator applies is written down and sourced
in [`docs/programming-basis.md`](docs/programming-basis.md).

---

## Table of contents

- [Running it](#running-it)
- [What the app does](#what-the-app-does)
- [Repository map](#repository-map)
- [How a session is generated](#how-a-session-is-generated)
- [Tests](#tests)
- [Design decisions worth knowing](#design-decisions-worth-knowing)
- [Known limitations](#known-limitations)

---

## Running it

There are three ways, in order of least effort.

### 1. Open the deployed app (nothing to install)

<https://ninwhippa08.github.io/GymBuddy/>

It is served from GitHub Pages straight out of this repository — the files in
`main` *are* the deployment, there is no build output. On a phone, use the
browser's **Add to Home Screen**; it then launches full-screen and works in
airplane mode.

### 2. Run it locally from a checkout

The app is static files, but it **must be served over HTTP** — it loads ES
modules and `fetch`es `data/exercises.json`, and browsers block both from a
`file://` page. Any static server works:

```bash
git clone https://github.com/ninwhippa08/GymBuddy.git
cd GymBuddy
python -m http.server 8000     # or: npx serve .
```

Then open <http://localhost:8000>. No install step, no dependencies, no build.

### 3. Run the test suite

Requires Node 18 or newer (developed on Node 24). Nothing to install first.

```bash
node --test tests/*.test.mjs
```

Expected result: **every test passing, 0 failing.** The current count is in
[Tests](#tests).

---

## What the app does

1. **First run** asks exactly one question: the date you started training again.
   The first five weeks ramp volume and the load ceiling, so the app cannot
   generate anything safe without it.
2. **Every launch lands on a home screen** showing which return week you're in,
   how long since you last trained, and a month calendar of the days you
   actually trained. Nothing is generated until you ask — opening the app
   writes nothing.
3. **Before generating**, a body map. Tapping a joint cycles it through
   clear → sore → hurt, and last session's flags come pre-ticked. An exercise
   that loads a **sore** joint is heavily downweighted; one that loads a
   **hurt** joint is excluded outright.
4. Tap **Generate today's workout** and the app **proposes a day type** — one of `max-strength`, `power`,
   `hypertrophy`, `aerobic-steady`, `interval`, `sprint`, `plyometric` — and
   states the reason it chose that one. You can reroll into a different type.
5. It builds the **full session**: a warm-up, main work, and a mobility and core
   cool-down, with sets, reps, rest, and a load written as a multiplier of a
   named lift — `0.85 × Back Squat PR`, never a number in kilograms.
6. Any exercise you cannot do today (equipment busy, machine missing) can be
   **swapped** for an equivalent one. That includes the two **core** movements
   in the cool-down — the static stretches deliberately have no swap, because
   they are matched to the patterns the session actually trained.
7. Tapping **"I did this workout"** marks the day trained. Only then does it
   appear on the calendar — if you didn't tap it, you didn't do it. Tapping a
   past day on the calendar reopens that session, read-only.

8. **Save a backup** on the home screen writes the whole state to a JSON file
   and hands it to the phone's share sheet, so it can go to Files, AirDrop or
   mail. Restoring reads one back: it names what the file holds and what it
   would destroy, then waits for a second tap before replacing anything.

There is no account, no server and no analytics. All state lives in the
browser's `localStorage` under a single key, which is why the backup exists.

---

## Repository map

Everything a grader needs to read is in four folders. There is no framework, no
package manager, and no generated code — every file here was written by hand.

```
GymBuddy/
├── index.html            App shell. ~30 lines: meta tags, one <main>, one <script>.
├── style.css             All styling (1,051 lines). Dark theme, CSS custom properties.
├── manifest.json         PWA metadata — name, icons, colours, standalone display.
├── sw.js                 Service worker. Cache-first offline shell.
├── .nojekyll             Tells GitHub Pages to serve the files as-is.
│
├── js/                   The application. Vanilla ES modules, no bundler.
│   ├── app.js            Entry point and screen routing. Wires storage → generator → UI.
│   ├── generator.js      The session pipeline. The core of the project (~1,700 lines).
│   ├── rules.js          Every training constant, transcribed from the basis doc. No logic.
│   ├── templates.js      Day types and their slot templates — the *shape* of a session.
│   ├── calendar.js       Month-grid arithmetic. Pure: no DOM, no toISOString.
│   ├── storage.js        localStorage read/write. Nothing else.
│   └── ui.js             DOM rendering. Pure: data in, detached DOM nodes out.
│
├── data/
│   └── exercises.json    The exercise library: 541 exercises + 6 PR roots.
│
├── tests/                Node's built-in test runner, zero dependencies.
│   ├── *.test.mjs        One file per subject (session, ramp, coverage, ui, storage, …).
│   ├── app.test.mjs      The launch path: asserts opening the app writes nothing.
│   ├── calendar.test.mjs The month model: leap years, month edges, Monday weeks.
│   ├── dom-shim.mjs      A minimal DOM so ui.js can be tested without a browser.
│   ├── cue-guard.mjs     Shared assertions for the exercise library's coaching cues.
│   ├── coef-provenance.mjs  Provenance record for every load coefficient in the library.
│   ├── derivation-guard.mjs Keeps a derived variant in step with the parent it copied.
│   └── mutate.mjs        Mutation testing. Breaks a rule on purpose to see if a test notices.
│
├── tools/
│   ├── derive.mjs        Scaffolds a new exercise from a reviewed parent. Prints a block
│   │                     to paste, with the cues left deliberately unwritten.
│   ├── playlist-diff.mjs Diffs a coach's YouTube playlist against the library: what is
│   │                     not a movement, what we already have, what is worth a look.
│   └── contact-sheet.mjs Six frames of one movement demo tiled into a single image,
│                         for the clips whose name is not enough. They are silent,
│                         so captions give nothing.
│
├── docs/                 Written before the code, and kept in step with it.
│   ├── spec.md              What the product is. Sections are cited from code as "spec §n".
│   ├── programming-basis.md The training science. Every number, with its source and a
│   │                        provenance tag: [verified] / [corroborated] / [unverified] /
│   │                        [measured].
│   ├── coverage-matrix.md   Which movement patterns the library actually covers.
│   ├── design-*.md          Design notes for each major feature, with open questions.
│   └── plan-*.md            The implementation plan each feature was built from.
│
└── icons/                PWA icons (192px, 512px, apple-touch).
```

### Where to start reading

| If you want to see… | Read |
|---|---|
| What the product is meant to be | `docs/spec.md` |
| The single most important file | `js/generator.js` — its header comment lists the 10-step pipeline |
| Why a number is what it is | `js/rules.js`, then the section it cites in `docs/programming-basis.md` |
| How the code is verified | `tests/session.test.mjs` and `tests/ramp.test.mjs` |
| How the UI is built without a framework | `js/ui.js` — the `el()` helper at the top explains the whole approach |

### Reading conventions used throughout the code

- Comments cite the document that justifies the code: `spec §4.3`,
  `design-card-flip.md §5.1`, `plan-07`. Those are real, findable sections.
- `js/rules.js` holds constants and no logic; `js/generator.js` holds logic and
  no magic numbers. Changing a training rule means editing one constant.
- `js/generator.js` is **pure** — the library, profile and history all arrive as
  arguments. It never touches `localStorage` or the DOM, which is exactly why it
  can be tested without a browser.
- `js/ui.js` builds nodes with `createElement` and `textContent`, never
  `innerHTML`.

---

## How a session is generated

`js/generator.js` runs ten steps in a fixed order. The header comment in that
file is the authoritative version; this is the summary.

| # | Step | What it decides |
|---|---|---|
| 1 | LOAD | Profile and recent history |
| 2 | STATE | Rolling volume per movement pattern, hours since each day type, a decayed "CNS account", and which week of the return ramp you are in |
| 3 | PROPOSE | Scores each day type by how neglected it is, then vetoes on fatigue and soreness |
| 4 | ENVELOPE | Turns the day type into an intensity zone, clamped by the ramp ceiling |
| 5 | ARCHITECT | Picks a session architecture: straight sets, a ladder, or an antagonist superset. Three more are declared in `templates.js` and deliberately not built |
| 6 | FILL | Chooses an actual exercise for each slot in the template |
| 7 | PRESCRIBE | Sets and reps at a percentage of a PR — or foot contacts, or minutes |
| 8 | PACK | Estimates duration and trims optional slots to the main-work budget, then pairs opposing lifts into supersets |
| 9 | PREP / COOL | Appends the dynamic warm-up and the static cool-down plus core, both **matched to the patterns the day actually trains**, then packs each to its budget |
| 10 | ORDER | Enforces the fixed sequence: prep first, cool-down last — **core before the static stretches**, which close the session — and a superset's two halves adjacent |

Two ideas hold the design together:

- **A template is a shape, not a workout.** A slot says "a primary-tier Olympic
  derivative in the power zone, 5–6 sets of 2–3"; step 6 decides which exercise
  lands there. Variety comes from that choice, not from maintaining dozens of
  hand-written workouts.
- **The venue is an output, not an input.** You are never asked whether you are
  at a gym or a park. The generated session decides.

---

## Tests

```bash
node --test tests/*.test.mjs
```

607 tests, using only Node's built-in `node:test` and `node:assert/strict`.
There is no `package.json` and nothing to install.

They are not only unit tests. Several are **sweeps**: they generate sessions in
bulk across profiles and histories and assert a property holds for every one —
that no gym session exceeds 70 minutes, that neither load ceiling — the
return ramp’s nor the standing one — is ever exceeded by any set the card
prints, that every movement pattern is eventually covered, that no
exercise is ever prescribed without the equipment it needs. The largest sweep
runs 10,000 seeds against each of the seven day types: 70,000 sessions. Those are
what catch the bugs that matter, because the generator is randomised and a
single example proves nothing.

`tests/dom-shim.mjs` is a hand-written ~120-line DOM, present so that `js/ui.js`
can be tested in Node without pulling in a dependency. Its own header is honest
about the limit: it is not a substitute for looking at the app in a real
browser, and the project has been bitten once by trusting it too far.

`tests/mutate.mjs` is a mutation-testing script — **not** part of the suite, run
by hand while writing a guard. It breaks a rule on purpose and reports whether
any test noticed; a rule whose mutant survives is a rule nothing is actually
checking. It exists because this project keeps producing tests that pass for
the wrong reason: four of the seven tasks that built the superset shipped one,
every time because the fixture could not tell the real rule from a wrong rule
that agreed with it on that input. **When a mutant survives, suspect the
fixture before the rule.**

```bash
# one rule
node tests/mutate.mjs js/generator.js tests/superset.test.mjs   "Math.min(A1.sets, A2.sets)" "Math.max(A1.sets, A2.sets)" "rounds take the longer block"

# several, with the control run once
node tests/mutate.mjs mutants.json
```

It refuses to report anything when the target text is absent, and refuses to
run at all when the suite is already red — both of those produced a convincing
false "survived" in the shell version it replaces.

`tests/app.test.mjs` boots the whole app headlessly to assert one thing above
all: **launching it writes nothing to history.** That was the app's oldest bug —
merely opening it on a rest day recorded a completed workout, which then fed the
fatigue and neglect models — and it is a regression nothing else in the suite
would catch.

---

## Design decisions worth knowing

**Zero dependencies, by requirement.** No npm, no bundler, no framework, no
transpiler, no CSS preprocessor. Every line in `js/`, `tests/` and `style.css`
is readable on its own terms, and the deployed app is byte-for-byte the source.

**Offline-first, not offline-capable.** The service worker is cache-first
always. A gym basement with no signal is the design target, not an edge case.
The cost is that `VERSION` in `sw.js` must be bumped on every deploy, which is
why that file opens with a large warning comment.

**The library grows by hand, and the suite is the gate.** There is no importer
and no second validator. Adding a movement means writing an entry and running
the tests — the cue guard caps a coaching line at 90 characters, the derivation
guard keeps a variant in step with the parent it was copied from, and the
coefficient ratchet refuses any *growth* in unsourced load ratios. `tools/
derive.mjs` does the mechanical half: it copies the nine inherited fields off a
reviewed parent and hands back a draft that is deliberately **wrong in exactly
one way** — the cues are still the parent's, which the suite rejects — so a
draft pasted in and forgotten fails rather than ships. What a video or a list of
names cannot supply is the rest: which pattern, which joints, how technical, and
three lines that are true for someone performing it unsupervised.
`docs/design-library-expansion.md` §13.

**The suite cannot read a coaching cue, and in September 2026 the athlete found
one that was wrong.** A prep drill hurt his knee. The entry was real — it is a
kneeling rock-back with hip internal rotation, filmed by several coaches — but
its cue said only *"let one hip roll inward so that thigh turns in"* and never
said what the foot does. Every source that teaches the drill leads with the
counterintuitive half: **to turn the thigh in, the foot travels out.** Without
it, with the shin on the floor and the knee planted, the only movement
available is torque applied straight to the knee. That is what he felt.

Nothing in this repository could have caught it. `cue-guard.mjs` checks length,
count, duplication and load-percentage leakage, and the old text passed all
four — a cue missing the segment that must move does not read as broken, it
reads as terse. The gate the library relies on is real but it is a gate on
*form*, and 127 of these entries were authored from playlist titles rather than
from watching the movement. **That is the weakest data in the project, the
suite cannot grade it, and the only detector is an athlete in a gym.**
`docs/design-mobility-and-warmup.md` §13.1.

**Anti-repetition is counted in sessions, because a calendar window could not
reach.** The generator downweights a movement used recently. That set was built
from a 14-day window — and with seven day types at 1-3 sessions a week, a day
type comes round about every 21 days, so **100%** of the time the penalty had
already expired before it could apply. Measured across 4,600 same-day-type
pairs: a third of a day type's main work repeated from its previous outing. The
target had been stated in the right unit all along (`SESSIONS_BEFORE_REPEAT =
16`, sizing every pool in the coverage matrix); only the mechanism was in days.
It is the third time this file has had to escape the volume window — the
neglect model and the chronic-load term both did, and both left a comment
saying so. Swept rather than guessed: 8 sessions is the measured minimum, and
a *wider* window is worse, because once every movement in a pool is penalised
the multiplier is uniform and a uniform penalty is no penalty.
`docs/design-library-expansion.md` §12.

**The warm-up is matched to the work, by movement pattern and not by joint.**
The prep block used to draw any 3–4 of the 19 dynamic drills, so a Romanian
deadlift and a close-grip bench could be prepped by a quad pull and a squat to
stand. The obvious fix — filter drills by the joints the day's lifts use — is
wrong, and the athlete broke it in one sentence: `deadlift` is
`[hip, knee, lumbar]` and `walking-quad-pull` is `[knee, hip]`, a perfect joint
overlap and still the wrong drill, because lengthening the quad does not
prepare a hinge. The library has no muscle tagging to fall back on. So every
drill and stretch names the movement **patterns** it serves, and the draw is
coverage-ordered — each pick aims at a pattern the previous ones did not
cover. The same applies to the cool-down, where `seated-hamstring-stretch`
`[hip, knee]` and `standing-quad-stretch` `[knee, hip]` are the identical
collision. Matching decides *which* movements, never *how many*: the 3–4 dose
is sourced and a day whose patterns no drill serves still gets a full warm-up.
`docs/design-mobility-and-warmup.md` §9.

**Loads are always relative.** The app never prescribes a weight in kilograms
directly — only `× PR`. Six PR roots cover the library; other lifts derive from
them through a `prCoef`, and every one of those coefficients has a provenance
record in `tests/coef-provenance.mjs`.

**The library grows by derivation, and the parent link is load-bearing.** A
variant moves exactly one axis — implement, stance or angle — off a reviewed
parent and inherits the eight fields that would break silently if it drifted
(`pattern`, `tier`, `joints`, `cnsCost`, `technical`, `unilateral`,
`modalities`, `isometric`). It records where it came from in `derivedFrom`, and
`tests/derivation-guard.mjs` fails the suite if a parent is ever repriced
without its children moving too. `docs/design-library-expansion.md` §11 has the
method; the first 15 entries built with it grew the `core` pool from 18 to 33.

**Two opposing lifts can be paired into a superset.** On a hypertrophy day a
horizontal push may be paired with a horizontal pull (or a vertical push with
a vertical pull), alternating between them with no rest in between and one
rest at the end of the round. It changes **only rest and order** — the sets,
the reps and the loads are identical to the straight session, and the tests
assert that by recomputing the volume from the blocks with the pairing
stripped off. Sourced to a 2025 *Sports Medicine* review of 26 studies:
roughly 37% less session time at preserved volume, with strength and
hypertrophy outcomes indistinguishable from straight sets. Tagged
`[corroborated]` rather than `[verified]`, because exactly one
agonist-antagonist trial in that review (n = 23) followed chronic adaptation.
It fires on **24.3%** of hypertrophy sessions and saves a mean of **3.43
minutes**. `docs/design-architectures.md` §3.6.

**A grown pool re-rolls every seeded draw, which is how the session ceiling
turned out to be unenforced.** The 70-minute limit was only ever *observed* on
a 70,000-session sweep, never guaranteed: prep, main work and cool-down are
packed against three independent budgets and nothing checks their sum. Adding
core entries did not make sessions longer — the duration distribution barely
moved — but it changed which seeds land in the tail, and at a cap of 50 the
tail sat exactly on the limit with nothing to spare. `MAIN_WORK_MAX_MIN` came
down 50 → 49 to buy one real minute of margin, at a measured cost of 3.1% of
max-strength working sets. The constant's comment carries the sweep.

A second minute came back later, and not by trimming anything: **`packPrep`
had never been called.** It was written for the case where a warm-up draws
several per-side drills — which price at double — shipped with a passing unit
test, and was simply not wired into the generator. The cool-down was packed;
the prep was not. It went unnoticed for as long as it did because the constant
bounding session length was itself derived from a sweep that assumed the
packer was running. Wiring it took the measured worst case 69 → 68 min.
`docs/design-mobility-and-warmup.md` §9.4.

**And a third minute, from a budget its own floors could not reach.** The
cool-down *was* packed, but `packCooldown` had only two levers — the third core
set, then dropping a stretch — and on the draw that produces the worst case
both bottom out at **16 minutes against a 12-minute budget**: three stretches
and two per-side, rep-based core blocks is 60 reps charged at the barbell
rate. Adding a third lever that trims the core dose from the top of its own
sourced range (`CORE_REPS` `[10,15]`) to the bottom, *before* dropping a
stretch the day's work earned, took the worst case 68 → 66 min. Nothing was
widened: both ends of that range already sit inside the trial envelope the
constant cites, so the trim lands on a dose the project already calls sourced.
`docs/design-library-expansion.md` §16.6.

**Then one minute went back out again, deliberately — because the budget it was
defending could not fit its own doses.** The 12-minute cool-down budget was
labelled as derived from the per-movement doses in `MOBILITY_DOSE`; it was
not, and summed properly those doses cost a mean of 14. The gap was not being
paid in overrun warnings, which had already fallen to 2%. It was being paid in
core work: `packCooldown` answers a cool-down it cannot afford by cutting the
dose, and at 12 min it was **deleting the third prescribed core set on 86% of
gym sessions** while reporting the block packed. Repricing the core rep first
(the third instance of the barbell-price error above, and the weakest — it is
tagged `[unverified]`) paid for most of the fix; `COOLDOWN_MIN` 12 → 14 spent
one measured minute for the rest. The third set now survives on 75% of
sessions, the warning fires on **0 of 70,000**, and the worst session is 67 min
against the athlete's stated 70. `docs/design-mobility-and-warmup.md` §11.

**Sources are tagged, including the weak ones.** `docs/programming-basis.md`
marks each number `[verified]`, `[corroborated]`, `[unverified]`, or
`[measured]`, and documents three discrepancies found when the secondary sources
were re-checked against primary ones. Numbers tagged `[measured]` have no source
at all and were derived by sweeping generated sessions — the doc says so rather
than dressing them up.

---

## Known limitations

Every item here is a decision with a reason, not an oversight found late. The
full record lives in `docs/spec.md` §6 and in the open-question sections of
the design documents, which is where the reasoning is kept.

### Limits of the design

**History records what was proposed, not what was performed.** Generating a
session marks it done. There is no set-by-set logging, because the athlete
asked for none: the app must not interrupt a workout. Two things reduce the
damage. Since `sw.js` v24, generating has sat behind a tap, so opening the
app on a rest day no longer writes a phantom workout. On the next launch it
asks *"Did you finish this?"* once per unanswered past day. Answering *I
didn't* removes the record entirely rather than flagging it, because a session
that did not happen must not reach the CNS account or the neglect score. What
survives is the case where a session was cut short and still counts as whole.

**The app cannot drive progressive overload.** Loads are percentages of PRs
the athlete keeps in his own head, so nothing tells the app that the squat got
stronger. It varies stimulus; it does not add weight over time. This follows
from the no-logging rule above rather than being a separate choice.

**Two inputs are taken on trust.** `plyoLevel` is self-declared and never
verified, and the return-to-training ramp assumes an honest `returnDate` —
backdating it skips the safety ramp completely.

**No individual injury modelling.** The soreness map excludes movements that
load a hurt joint, and that is the whole of it. Everything else is population
guidance, which is the documented scope limit.

**No way to retire a movement permanently.** `profile.banned` exists and
`js/generator.js:415` filters every exercise against it, but nothing writes to
that list and nothing will: the athlete was asked in September 2026 whether
any movement the app had offered him was one he wanted gone for good, and the
answer was no. Swap handles "not today", which is the case that actually comes
up. The field stays wired rather than being torn out, so the day a movement
does need retiring the work is a control and not a redesign.

**One warm-up constant is still unsourced, and the search for it found a
source that does not exist.** `WARMUP.FLOOR` (0.50) decides the working load
below which no ramp is built. Searching for a threshold returns, confidently
and repeatedly, a *"2017 NSCA position stand on resistance training warm-ups"*
putting it near 60% of 1RM. There is no such position stand: the underlying
paper is a 2010 systematic review in a different journal that names no
threshold, and the only chain of custody for the figure was a commercial
calculator page. The constant is therefore left `[unverified]` rather than
given a citation it does not have, and
`docs/design-mobility-and-warmup.md` §8 q5 records the dead end so the search
is not repeated. The other two constants in that block were anchored on
2026-09-04.

**No arm day, and there will not be one.** `isolation` is in the spec and was
declined on 2026-09-04. At 1–3 sessions a week an isolation day displaces a
compound session rather than adding to one, and the variety it was wanted for
is already there: 89.9% of hypertrophy sessions carry an isolation finisher,
drawn from 53 isolation-capable entries. Its scoring penalty stays wired and
dormant, like `profile.banned`, so a fourth weekly session would make it a
template rather than a redesign.

### Considered and declined

**The circuit was researched, costed and declined on 2026-09-04.** The training
case for it held up — with the round rest set to the longest of the members'
rests, every station recovers for at least its own prescribed rest (measured
worst margin +48 s), which preserves the volume load that the rest-interval
literature says the effect actually depends on. 94.8% of hypertrophy sessions
could have hosted a three-station circuit. What decided it was the gym: the
athlete can hold two stations, not three, and **a circuit of two is the
antagonist superset that already exists**. Building it would have been one
feature under two names. `docs/design-architectures.md` §3.7 keeps the full
reasoning, including what would reopen it.

### Specified but not built

**Eight of the nine day types in `docs/spec.md` §5 exist.** `mobility` was
built on 2026-09-04 as the deload; `isolation` was declined, above.

### Measured shortfalls, left open on purpose

**One movement pool does not meet the variety target, and the shortfall is now
two entries.** `docs/coverage-matrix.md` is generated by the test suite and
prints the raw shortfall. It stood at 94 until 2026-09-06, almost all of it in
the sprint, jump and interval pools. Four playlist expansions closed part of it
and could not close the rest: the library holds 11 sprint entries because those
are the sprints that exist, and inventing a sixteenth way to sprint is worse
than repeating the right one. On 2026-09-06 the athlete settled that question —
seven pools where variety's premise fails, rather than its conclusion being
unwanted, no longer carry the target. That left five, in two pools, and both
were worked on 2026-09-07.

`primary :: jump :: (any)` **closed and is now locked.** The two entries were
gaps in the movement rather than in the counter: the library had no unilateral
*vertical* jump at all — every one-legged jump in it travelled forward or
sideways — and nothing taking off from an approach. A single-leg box jump and
an approach vertical jump close it at 16.

`primary :: hinge/pull-h :: power` **went 13 to 14 and stopped there.** The
squat snatch was the one honest addition left, and it arrived with a sourced
coefficient. The last two are blocked twice over: what remains in the
catalogue is the same lift from a different bar height, which this library
refuses on principle, and the two movements with the best training case behind
them — the jump shrug and the mid-thigh pull — cannot be priced at all,
because a weightlifting pulling derivative has no 1RM of its own to take a
ratio of. That is a limit of the model, not a gap in the authoring, and it is
recorded next to the wall sit and the single-leg calf raise.
`docs/design-library-expansion.md` §19.

**One of those fourteen printed no weight at all, and he found it himself.**
Slot B on a power day exists to prescribe 75–85% of that lift's own max, and
`snatch-grip-deadlift` carried no coefficient, so the slot fell through to the
reps path and printed *5 × 2, leave 2–3 reps in reserve* — a rep target and an
effort target that do not describe the same set. It fired on **7.7% of power
sessions**. Fixed on 2026-09-09: priced at 1.25 × the snatch root, taken from
the overlap of two independent coaching bands, and tagged `[corroborated]`
rather than `[verified]` because a working-load band is not a 1RM ratio. The
entry was also **renamed Snatch Deadlift**, because the movement those bands
were measured on is not the wide-grip deadlift the old name and cues described
— the rack-pull lesson applied at authoring time instead of months later.
`docs/design-library-expansion.md` §23.

**Fixing it exposed a larger bug, and the athlete decided how it should be
closed.** The return ramp's final ceiling of 0.95 × PR was applied to every
week past the ramp, forever, while the app's own test for whether he is still
ramping said he is not. The load was right; the sentence was false. The card
told him he was *"held down by the return ramp"* on **38.3% of max-strength
load blocks** with no ramp running. Shown the measurement on 2026-09-09 he
chose to **keep the cap and fix the sentence**, so the ceiling is now a named
policy — `STANDING_PCT_CEILING` in `js/rules.js` — with its own wording on the
card, rather than a side effect of the ramp table being clamped at its last
row. It supersedes a stated intent: the ramp comment says the column was
chosen to approach an *open* ceiling, and it never opened.

**A test written for that fix found a third thing, and it was the one that
mattered.** The ladder architecture spreads a lift's working sets into a wave
bounded by its training zone, and a zone is not a ceiling once a coefficient
sits above 1.00. **4.0% of full-volume load blocks printed a working set above
the cap the card announces, worst 1.00 × PR on a push jerk.** The return ramp
itself was never breached, because a ramped load sits below the zone floor and
the wave collapses to straight sets before it can climb. Fixed by narrowing the
wave rather than clipping its top, which would have changed the average load
the ladder is explicitly not allowed to touch. **It costs ladders: the share of
laddered blocks falls from 42.8% to 23.5%**, because a wave centred on a load
already at the cap cannot be built. That is the price of keeping the cap, it
was not known when the cap was chosen, and it is the strongest argument for
lifting the ceiling after the ramp instead. `docs/design-library-expansion.md`
§24.

**Closing the jump pool turned up a bug in the app, and it is the more useful
half of that day's work.** A smoke test written only to check the new entries
could be drawn found one of them appearing 167 times in 1,500 generated
plyometric sessions and the other never. `venue: 'either'` on a day type means
"this session runs indoors or out", and the generator was reading it as a
requirement — so on the two day types that declare it, only movements that are
themselves venue-agnostic were reachable. The box jump and the depth jump, the
two most standard plyometrics in the library, could never be prescribed. Nine
primary jumps were reachable where the matrix reported sixteen. Fixed in one
clause; 23 distinct jumps now appear across the day's two main slots against 13
before, worst session 42 min, foot contacts inside the beginner band.
`docs/design-running-programming.md` §11.2 — which also corrects that
document's own September finding, where the same defect was diagnosed in the
test and wrongly cleared in the app.


**Three movements the app owned and could never prescribe.** Before mining a
new channel the library was checked for reachability, as §17.5 requires: is
there any slot, in any template, whose tier, pattern, modality and effort class
admit this entry? **Thirteen of 534 entries were admitted by nothing.** Three
were sprint starts — falling, half-kneeling and lateral half-kneeling — which
are accessory tier and maximal effort, a pair no slot accepted. The sprint day
took primary and secondary; the strides slot on easy-run days took submaximal
only. They sat in the library unprescribable, in the pool measuring third for
felt repetition.

**The minutes to fix it came from a slot that was running against its own
design.** The sprint day's fourth slot is documented as opt-in and unreachable
without measured ground, but the gate sits on the *entry* and only one entry
carries it, so the slot never emptied. It filled with an ordinary primary
sprint on 100% of sessions, giving a third maximal sprint block to a day
designed for two. Skipping it paid for a start slot outright: the worst sprint
session stays at 68 minutes, no constant moved, and the three starts now appear
on **every** sprint session, drawn evenly. It is the fourth instance of the
same shape as the venue filter, the prep budget and the ramp ceiling: a limit
checked against content it was never written to cover.

**Fixing it exposed a test asserting something that was never true.** The CNS
account test claimed a hard day is vetoed again at 48 hours. It checked one day
type at one seed, and it passed because the sprint day's CNS load was pinned at
exactly 9 for every seed — pinned by the phantom block above. Swept across
sixty seeds and all four high-CNS day types, 48-hour spacing held for **one of
the four**, and 0% for plyometric and max-strength. The test now sweeps, asserts
what holds everywhere, and pins the 48-hour rates with a ratchet that may rise
and never fall, so a real gap is recorded rather than deleted.
`docs/design-library-expansion.md` §25.



**The balance pool was one day old and already the most repeated in the
library.** The modality shipped with three entries, one of which is drawn on
every outdoor session and on no other day, which works out at 5.98 repeats per
entry per twelve-week block — ahead of running and sprinting. The coverage
matrix was satisfied by it, because that pool is sized by coverage rather than
by variety, so nothing failed. It was only visible in the repetition
measurement.

**Pool size was the only lever**, since raising the dose would have made it
worse. Three entries were added: balance with head turns, the free-standing hip
airplane, and single-leg balance throwing a ball against a wall. **Repetition
fell from 5.98 to 2.49 and session time did not move on any day type** — one
balance movement is drawn per session however many exist, so the additions were
free.

They came from the balance literature rather than the channel. Performance
Course trains speed, and its single-leg content is almost entirely jumps and
strength rather than proprioceptive holds. Two rungs of the documented
progression were declined on population: unstable-surface work is evidenced for
people who have already sprained an ankle, which he has not, and tandem stance
sits below the eyes-closed work he already does. `docs/design-library-expansion.md` §27.

**That placement question was answered the same day: balance now runs on the
deload.** The deload had inherited an exclusion written for someone else's
clock. It declared no warm-up variant of its own, so it fell through to the gym
one, and balance had been kept off the gym warm-up because gym days hold three
minutes of headroom. The deload holds fifty-two. It now has its own warm-up
variant — the gym one plus balance — and the gym days are untouched, so their
margin is unchanged.

The stage is optional there, where the identical stage is required on running
days, and the difference is the day. Every balance movement loads the ankle,
knee or hip, so any of those being hurt empties the pool, and the deload is the
day reached when everything else is vetoed, which is disproportionately the day
he is sore. Measured: with a hurt ankle, knee or hip the stage disappears and
nothing is reported as unfilled. Required, it would have announced a hole on
the one day that exists to be gentle.

**Balance is delivered on every deload, drawn from the whole pool of six**, and
the day runs 18 minutes where it ran 16. The dose did not change: the source it
comes from prescribes one balance exercise per warm-up, and having the time for
more is not a reason to prescribe more. Balance now reaches five of the eight
day types; the three without it are the gym days, and that remains a decision
about the clock rather than the evidence.
`docs/design-library-expansion.md` §28.
**The run pool was measured next and turned out not to need anything.** It
carried the highest repetition left, 3.85 per entry per twelve-week block, and
itemising it showed the average was one entry: the warm-up jog, at **19.98
repeats a block**. Every other run sits between 0.93 and 2.09, and **excluding
the jog the pool measures 1.55** — the least repetitive of any pool this
project has worked on. Authoring another tempo run or another interval would
have been correct, sourced and completely unnoticeable.

The warm-up jog repeats because the raise stage of the running warm-up is a
pool of one by construction: it asks for an accessory-tier run at easy effort,
and exactly one movement in the library is all three. The coverage matrix
records that pool as *have 1, short 0*, which is the same blindness the balance
pool exposed — **a pool of one can satisfy a matrix that asks about coverage
and never about repetition.**

Three fixes were considered and none survived. More steady or tempo runs are
invisible work. Widening the stage to accept marches looks like it would also
clear four orphaned entries, but three of those need a ruck or a sled and
walking does not raise core temperature, which is the one job the stage has.
Varying the jog itself leaves backward running as the only distinct candidate,
and the stage prescribes three to five minutes continuous, which is not how
backward running is used or safe outdoors.

**So the repetition is correct.** A warm-up is the thing you do the same way
every time, and variety's premise fails here as it does for the sprint pools.
What remains is a question rather than a gap: whether the athlete wants his
warm-up jog to vary at all. `docs/design-library-expansion.md` §29.
**The fifth channel pull, where the pre-flight was worth more than the batch.**
Performance Course offered 1078 titles across 26 movement playlists, 936 of
them unique, and **24.9% were already in the library** — the highest overlap of
any pull, and the sign the channel was chosen correctly, because it trains the
thing the measurement pointed at. Four entries were authored, all of them
starts, all into the pool that had just been opened: a two-point start, a
push-up start, a rolling start and a lateral crossover start. **1078 titles,
four entries, 0.37%.**

Most of what was declined fell into two families. Counts — *Boom Booms* at one,
two, three and four, *Wall Drill* at one, two and three — are a dose, and this
app prescribes dose separately from movement. The second family is new and
large: roughly thirty titles are partner and reactive work, chases and races
and coach-led calls, and **the athlete trains alone.** That is the equipment
filter applied to a resource the library has no field for. Two more are left
open rather than declined, because deciding either one would mean guessing:
wickets are not the `hurdles` the vocabulary carries, and a squatted falling
start is either a dose or a movement, and the clip was not watched.

**The payoff is the measurement it started from.** The sprint pool held eleven
entries of which seven were ever drawn, repeating 3.27 times per twelve-week
block. It now holds fifteen, fourteen are drawn, and repetition is **1.90** —
nearly halved. The only entry never drawn is the flying run, which is opt-in by
design. The worst sprint session is still 68 minutes and no constant moved:
four more entries in one slot replace each other rather than adding.
`docs/design-library-expansion.md` §26.

**A fourth expansion, and the measurement that should precede the next one.**
Before mining a new channel the library was measured for where repetition is
actually *felt* — 150 simulated 12-week blocks, history fed forward — rather
than by pool size. The gym half is finished: squat, hinge, push, pull and lunge
all come back fewer than 0.4 times per block, which is to say never. All the
repetition lives in two pools: `run` (8 entries, `warmup-jog` on 21 of 36
sessions) and `sprint` (11 entries, 7 of them ever drawn). That playlist —
Depth Training's "Exercise Videos", 170 titles — contained no running or sprint
work at all, and yielded **8 entries, a 4.7% hit rate**, taking the library to
493. Its useful lesson is about the tool: the matcher missed **57 duplicates**,
because this channel renames the thing rather than the words —
`Hex Bar Deadlift` → `trap-bar-deadlift`, `Row Machine` → `rower`,
`Cat and Camel Stretch` → `cat-cow`. The diff sorts; it does not decide.
`docs/design-library-expansion.md` §17.

**Settling the variety question found a measurement error, not a missing 60
entries.** Taking §11.0's recommendation on 2026-09-06 meant reading the
numbers one more time, and one of them was wrong. The coverage test passed the
plyometric day's `venue: 'either'` straight into the eligibility filter, which
reads a venue as a *requirement* — so it counted only jumps whose own venue was
`either`, dropping every gym-only and outdoor-only one. The app never had the
bug: it translates `either` to "no venue filter" before it asks. So the matrix
had been describing the three jump pools at 8/12/5 while the app drew from
14/21/6. One of them turned out to hold 21 against a target of 16 and was
closed outright; another went from short 8 to short 2. Two of the eight pools
§11.0 proposed exempting did not need exempting at all.

**18 of the 32 load coefficients are tagged `[unverified]`.**
`tests/coef-provenance.mjs` records the provenance of every one, and a test
fails if the unverified count rises above its budget, so the debt can shrink
and never grow. The number is visible rather than hidden, which is the point
of keeping the register. Four were sourced on 2026-09-03 and three of the four
were wrong: the front squat and the 30-degree incline bench were both 9% high,
and the close-grip bench was 3% low. Entries that were investigated and could
not be sourced say so, and say why, so the next pass does not repeat the
search.

The cheapest one yet came on 2026-09-07 and cost no reading at all. The paper
already cited for the snatch pull reports three ratios in one sentence and the
register had used the first; the third prices the hang power snatch, which had
been sitting at `[unverified]` since August. The inherited value was right and
did not move. Before hunting a new source, re-read the ones already cited.


**Trunk work lands on lifting days only, so its weekly frequency runs low.**
Core sits in the cool-down of `max-strength`, `power` and `hypertrophy` and on
no other day type — measured at 100% and 0% respectively over 1,500 seeds per
day type. Every one of the 31 trials pooled in Saeterbakken et al. 2022 trained
the trunk 2–5 times a week (mean 3.1), and at 1–3 irregular sessions a week
that target is missed more often than met. Adding a core slot to the
conditioning cool-down was costed — those days would run ~57–60 min instead of
~50–53, with lifting days untouched — and the athlete declined the session time
in September 2026. The sources, the measurement and the decision are in
`docs/design-mobility-and-warmup.md` §8, question 4, which also records why the
3 × 10–15 dose itself cannot be sourced any more precisely than "inside the
range that worked".

**The largest pull the project has made produced four entries, and that is the
result rather than a disappointment.** E3 Rehab's channel is 80 playlists and
2224 clips — ten times any previous source — and the measurement above was run
before diffing any of it. The gym half of the library was still finished
(≤ 0.09 repeats per block), and this channel is overwhelmingly gym-side: Squat
Variations alone offered 131 candidates. Authoring them would have been real,
correct and unnoticeable. So the 145-entry mobility pool was split by *joint*
instead, because pool size is not pressure — and the wrist held **one** option
and the elbow **two**, with **no dynamic option at either**. Since the warm-up
draws dynamic movements and the cool-down draws static ones, those two joints
could be stretched after a session and never prepared before one, in a library
full of front squats, cleans and carries. Four entries close that: Wrist and
Elbow CARs, and the two wrist stretches. 1657 candidates, four authored, a 0.24%
hit rate — the lowest ever, arrived at on purpose.
`docs/design-library-expansion.md` §20.

**The most pressured joint in the library turned out to need nothing.** The
ankle is drawn 2.04 times per option per twelve-week block and the knee 1.69,
the two highest in the library, so the next batch was going to be authored
into them. Two checks stopped it. The draws are spread evenly across all 27
ankle options rather than piling onto a few, and the 16-session variety target
does not govern mobility at all — `coverage.test.mjs` sizes the prep and
cool-down pools by joint coverage instead, and the ankle passes that nine
times over. Then every single ankle video on the channel turned out to already
be in the library: E3 names a drill by the wall it is done against, this
library names it by the joint action, and `Half Kneeling Knee to Wall` is
`ankle-dorsiflexion-rock`. So six `aka` aliases were added instead of six
exercises, which moved nine titles out of the candidate list. A joint under
pressure is not the same as a joint with a gap — the wrist in §20 was a
*zero*, and this was a distribution. `docs/design-library-expansion.md` §21.

**A twelfth modality, and the warm-up stages nobody was getting.** Balance work
— standing on one leg, reaching, eyes closed — could not be expressed at all: it
is not stretching, not range-of-motion work, and carries no load, so every one
of the eleven modalities would have dosed it wrongly. Adding `balance` took a
new modality, a new movement pattern and three entries. The first thing built
was a smoke test asking whether the generator actually drew them, and it read
**0.0%** — which is how a much older bug surfaced. `packPrep` trimmed the
warm-up by deleting blocks off the end against a three-minute *drill* budget:
correct for the gym warm-up, which is one group of interchangeable drills, and
catastrophic for the five-stage running warm-up, where it meant deleting whole
stages. The sprint drills and build-up runs that
`docs/design-running-programming.md` §5 specifies had **never appeared in a
generated session** — built by the template, asserted by three tests, and thrown
away before reaching the screen. Every one of those tests called the builder
directly; none asked what the app returns. Restoring them cost nothing. The
balance stage cost three minutes, and the athlete spent them knowingly: the
worst session is now 70, which is the stated limit exactly and leaves no margin.
`docs/design-library-expansion.md` §22.
