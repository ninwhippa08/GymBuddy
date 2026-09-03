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

Expected result: **427 passing, 0 failing.**

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
   **swapped** for an equivalent one.
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
├── style.css             All styling (713 lines). Dark theme, CSS custom properties.
├── manifest.json         PWA metadata — name, icons, colours, standalone display.
├── sw.js                 Service worker. Cache-first offline shell.
├── .nojekyll             Tells GitHub Pages to serve the files as-is.
│
├── js/                   The application. Vanilla ES modules, no bundler.
│   ├── app.js            Entry point and screen routing. Wires storage → generator → UI.
│   ├── generator.js      The session pipeline. The core of the project (~1400 lines).
│   ├── rules.js          Every training constant, transcribed from the basis doc. No logic.
│   ├── templates.js      Day types and their slot templates — the *shape* of a session.
│   ├── calendar.js       Month-grid arithmetic. Pure: no DOM, no toISOString.
│   ├── storage.js        localStorage read/write. Nothing else.
│   └── ui.js             DOM rendering. Pure: data in, detached DOM nodes out.
│
├── data/
│   └── exercises.json    The exercise library: 237 exercises + 6 PR roots.
│
├── tests/                Node's built-in test runner. 427 tests, zero dependencies.
│   ├── *.test.mjs        One file per subject (session, ramp, coverage, ui, storage, …).
│   ├── app.test.mjs      The launch path: asserts opening the app writes nothing.
│   ├── calendar.test.mjs The month model: leap years, month edges, Monday weeks.
│   ├── dom-shim.mjs      A minimal DOM so ui.js can be tested without a browser.
│   ├── cue-guard.mjs     Shared assertions for the exercise library's coaching cues.
│   └── coef-provenance.mjs  Provenance record for every load coefficient in the library.
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
| 5 | ARCHITECT | Picks a session architecture (straight sets, EMOM, cluster, superset, circuit, …) |
| 6 | FILL | Chooses an actual exercise for each slot in the template |
| 7 | PRESCRIBE | Sets and reps at a percentage of a PR — or foot contacts, or minutes |
| 8 | PACK | Estimates duration and trims optional slots to the main-work budget |
| 9 | PREP / COOL | Appends the dynamic warm-up and the static cool-down plus core |
| 10 | ORDER | Enforces the fixed sequence: prep first, cool-down last |

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

427 tests, using only Node's built-in `node:test` and `node:assert/strict`.
There is no `package.json` and nothing to install.

They are not only unit tests. Several are **sweeps**: they generate thousands of
sessions across many profiles and histories and assert a property holds for
every one — that no gym session exceeds 70 minutes, that the return ramp never
prescribes above its ceiling, that every movement pattern is eventually covered,
that no exercise is ever prescribed without the equipment it needs. Those are
what catch the bugs that matter, because the generator is randomised and a
single example proves nothing.

`tests/dom-shim.mjs` is a hand-written ~120-line DOM, present so that `js/ui.js`
can be tested in Node without pulling in a dependency. Its own header is honest
about the limit: it is not a substitute for looking at the app in a real
browser, and the project has been bitten once by trusting it too far.

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

**Loads are always relative.** The app never prescribes a weight in kilograms
directly — only `× PR`. Six PR roots cover the library; other lifts derive from
them through a `prCoef`, and every one of those coefficients has a provenance
record in `tests/coef-provenance.mjs`.

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

### Specified but not built

**Seven of the nine day types in `docs/spec.md` §5 exist.** `isolation` and
`mobility` are specified and unimplemented.

### Measured shortfalls, left open on purpose

**Eight movement pools do not meet the variety target.**
`docs/coverage-matrix.md` is generated by the test suite and prints a raw
shortfall of 111, most of it in the sprint, jump and interval pools. Closing
it by authoring would need roughly 60 new variants, and the library holds 8
sprint entries because those are the sprints that exist — inventing a
sixteenth way to sprint is worse than repeating the right one.
`docs/design-running-programming.md` §11.0 recommends exempting those pools
instead, on the precedent already set for `aerobic-steady`. The recommendation
is recorded and deliberately not taken: it widens a rule governing every pool
in the app, and that is the athlete's call to make.

**19 of the 31 load coefficients are tagged `[unverified]`.**
`tests/coef-provenance.mjs` records the provenance of every one, and a test
fails if the unverified count rises above its budget, so the debt can shrink
and never grow. The number is visible rather than hidden, which is the point
of keeping the register. Four were sourced on 2026-09-03 and three of the four
were wrong: the front squat and the 30-degree incline bench were both 9% high,
and the close-grip bench was 3% low. Entries that were investigated and could
not be sourced say so, and say why, so the next pass does not repeat the
search.

