# GymBuddy — Specification

A workout generator for a retired college American football athlete. Trains 1–3×
per week, irregularly. Wants a different session every time, adapted to what is
sore that day, and prescribed as a fraction of his own PRs.

Rules cited as **§n** refer to sections of [`programming-basis.md`](./programming-basis.md).

---

## 1. Product shape

```
open app
  → tap body map for anything sore  (last session's flags pre-checked)
  → app proposes a day type, with a reason
  → accept, or reroll into another type
  → workout appears
  → swap any exercise that isn't possible today
  → go train
```

The **venue is an output, not an input.** The generated session determines
whether this is a gym day or a park day. There is no equipment checklist.

**No logging.** Generating a session marks it as done. The user declined
confirmation prompts; the drift this introduces is accepted and documented in §6.

---

## 2. Constraints

| Constraint | Value | Source |
|---|---|---|
| Sessions per week | 1–3, irregular | user |
| Gym session total | ≤ 70 min | user |
| Gym main work | ≤ 45 min | user |
| Mobility + core | every gym session, ~25 min | user |
| Running/cardio duration | uncapped | user |
| Load prescription | `× PR` only, never absolute weight | user |
| Storage | on-device, no server, no account | user |
| Dependencies | zero third-party | user |

---

## 3. Data model

### 3.1 Exercise (`data/exercises.json`)

```json
{
  "id": "back-squat",
  "name": "Back Squat",
  "pattern": "squat",
  "tier": "primary",
  "loadable": true,
  "prRef": "back-squat",
  "joints": ["knee", "hip", "lumbar"],
  "equipment": ["barbell", "rack"],
  "venue": "gym",
  "cnsCost": 3,
  "technical": 3,
  "unilateral": false,
  "modalities": ["max-strength", "power", "hypertrophy"]
}
```

| Field | Purpose |
|---|---|
| `pattern` | `squat` `hinge` `lunge` `push-h` `push-v` `pull-h` `pull-v` `carry` `rotate` `jump` `throw` `sprint` `locomotion` `core` `mobility` — the unit of volume balancing (§2) |
| `tier` | `primary` `secondary` `accessory` `core` `mobility` — slot eligibility |
| `loadable` | false for plyos, sprints, mobility. Gates whether a `%PR` applies at all (§1) |
| `prRef` | which PR to reference. A front squat may reference the back squat PR with a coefficient |
| `joints` | drives soreness filtering |
| `venue` | `gym` `outdoor` `either` — determines where the session sends you |
| `cnsCost` | 1–3, feeds the CNS account (§7) |
| `technical` | 1–3, how much freshness the movement needs; drives ordering (§8) |
| `modalities` | which day types may select it |
| `prCoef` | multiplier from the referenced PR to this movement's own max. Front squat is `prRef: back-squat, prCoef: 0.85`, so a prescription of 85% reads `0.85 × 0.85 × back-squat PR`. `null` when `loadable` is false |
| `contactsPerRep` | ground contacts per rep, for the plyometric budget (§4 step 7). Present on every `plyometric` exercise; `0` for upper-body plyos, which cost CNS but not foot contacts |
| `nominalMeters` | assumed distance per rep, for the internal sprint budget (9.1). Never shown to the user |
| `plyoIntensity` | `low` `moderate` `high` — selects against the per-level contact bands in basis §4 |
| `requiresMeasuredGround` | `true` marks the movement as opt-in only; the generator never selects it by default (9.1) |

The file wraps the library in `{ schemaVersion, prRoots, exercises }`. `prRoots`
is the list of PRs the app expects the user to hold in his head — currently six:
back squat, deadlift, bench press, overhead press, power clean, snatch. Every
`prRef` must resolve to one of them. Since the app stores no maxes, this list is
the whole of what he has to know.

### 3.2 Session (history record)

```json
{
  "date": "2026-08-20",
  "dayType": "power",
  "venue": "gym",
  "architecture": "straight",
  "soreness": ["shoulder-l"],
  "blocks": [
    {
      "slot": "A",
      "exerciseId": "hang-power-clean",
      "sets": 5,
      "reps": 3,
      "pct": 0.72,
      "restSec": 180
    }
  ],
  "patternSets": { "hinge": 9, "push-v": 6, "core": 9 },
  "footContacts": 0,
  "sprintMeters": 0,
  "cnsLoad": 7,
  "durationMin": 68
}
```

`patternSets`, `footContacts`, `sprintMeters`, and `cnsLoad` are denormalised at
write time so the generator never recomputes them while reading history.

### 3.3 Profile

```json
{
  "returnDate": "2026-08-20",
  "units": "kg",
  "banned": ["barbell-hip-thrust"],
  "stickySoreness": ["knee-r"],
  "plyoLevel": "beginner"
}
```

`returnDate` drives the ramp (§3). It is set once, on first launch, and is the
only thing standing between a college PR and a hurt back.

---

## 4. Generator pipeline

```
1. LOAD        profile + last 14 days of sessions
2. STATE       rolling 7-day patternSets
               hours since each dayType
               CNS account (decayed, §7)
               rampWeek = weeksSince(returnDate)
3. PROPOSE     score each dayType by neglect
               veto on CNS account (§7) and soreness
               → present with a reason string
4. ENVELOPE    dayType → intensity zone (§1)
               clamp by rampWeek ceiling (§3)
5. ARCHITECT   pick session architecture (see 4.3)
6. FILL        for each slot in template:
                 filter by modality, tier, soreness joints, ban list
                 penalise anything used in last 14 days
                 weighted random pick
7. PRESCRIBE   assign sets/reps/% from the zone, jittered
               plyo → foot contacts; sprint → metres
8. PACK        estimate duration; trim to 45 min main work
9. APPEND      mobility + core block, always (§9)
10. ORDER      enforce fixed sequence (§8)
```

### 4.1 Soreness

Two severities, one tap each:

- **Sore** — soft. Downweights exercises loading that joint; will still select
  one if nothing else fits, at reduced intensity.
- **Hurt** — hard. Excludes every exercise loading that joint, no exception.

Flags persist to the next session pre-checked, clearable with one tap. This gives
a de facto chronic-injury profile without asking the user to maintain one.

### 4.2 Swap

Each exercise carries a swap control. It picks a replacement with the same
`pattern` and `tier`, re-runs the prescription, and records the rejection so the
same exercise is not offered again in that session.

### 4.3 The variety engine

Variety comes from combination, not from library size. With 150 exercises
choosing 6, C(150,6) ≈ 1.4 × 10¹⁰ before any other dial moves. The dials:

| Dial | Range |
|---|---|
| Exercise selection | which N of ~350 |
| Set/rep/% scheme | anywhere in the zone (§1) |
| **Architecture** | straight · antagonist superset · EMOM · cluster · complex · circuit · ladder |
| Ordering & pairing | which lift leads, what is paired |
| Tempo & rest | tempo notation, 90 s–4 min |

Architecture is the dial most apps ignore and the one that does the most work. A
front squat as an EMOM, as a heavy 5×3, as part of a barbell complex, and as
cluster sets are four sessions that feel unrelated.

Architectures are gated by day type — no EMOM on a max-strength day, no cluster
sets on a conditioning day.

---

## 5. Day types

| Day type | Venue | Volume unit | Intensity (§1) | CNS |
|---|---|---|---|---|
| `max-strength` | gym | sets × reps | 85–95% | High |
| `power` | gym | sets × reps | 75–85% own max; 40–60% dynamic effort | High |
| `plyometric` | either | foot contacts (§4) | — | High |
| `sprint` | outdoor | metres (§5) | — | High |
| `hypertrophy` | gym | sets × reps | 67–85% | Moderate |
| `isolation` | gym | sets × reps | 65–80% | Low |
| `aerobic-steady` | outdoor | minutes, HR zone | — | Low |
| `interval` | outdoor | work:rest | — | Moderate |
| `mobility` | either | time, quality | — | None |

`isolation` (arm day) is always **selectable** but rarely **proposed** — at 1–3
sessions per week the literature is explicit that multi-joint work comes first
(§2).

### 5.1 Example template — `power`

| Slot | Tier | Pattern | Prescription |
|---|---|---|---|
| A | primary | jump/throw | 3 × 3, low contacts — potentiation |
| B | primary | hinge/pull | Oly derivative, 5–6 × 2–3 @ 75–85% **of that lift's own max** |
| C | secondary | squat/push | dynamic effort, 6–8 × 3 @ 40–60% of the squat/bench max |
| D | accessory | opposing | 3 × 8 @ 70% |
| E | core+mobility | — | mandatory block |

### 5.2 Example template — `sprint`

| Slot | Prescription |
|---|---|
| A | progressive warm-up ramp — build to 90% over 4–6 runs |
| B | 4–8 × 20–40 m acceleration, rest 1:12–1:20 (§5) |
| C | flying runs, 2–3 × 20 m — *optional, requires measured ground* |
| D | mobility block |

Session total 300–600 m, inside the 200–800 m guideline (§5). That total is an
internal budget, not a target shown to the user — see 9.1. Short accelerations
are kept because 20–40 m is pace-able by eye on any surface.

---

## 6. Known limitations

Recorded deliberately, each traceable to a decision the user made:

1. **History is proposals, not performance.** No confirmation step, so a skipped
   or shortened session still counts as done. Every neglect-based nudge inherits
   this error. Mitigation available later: a one-tap "did you finish this?" on
   next launch.
2. **No load progression.** The app never learns that the squat got stronger.
   Percentages track the user's PRs, which he updates in his own head. Correct
   given the design, but it means the app cannot drive progressive overload — it
   can only vary stimulus.
3. **`plyoLevel` is self-declared** and never verified.
4. **The ramp assumes honesty about `returnDate`.** Setting it to a past date
   skips the safety ramp entirely.
5. **No individual injury modelling.** Population guidelines only (§ scope limit).

---

## 7. Technical stack

Zero third-party dependencies. No build step. No server.

| Layer | Choice |
|---|---|
| Language | JavaScript, ES modules |
| UI | Hand-written DOM, no framework |
| Styling | Plain CSS |
| Storage | `localStorage` |
| Offline / install | Hand-written `manifest.json` + service worker |
| Hosting | GitHub Pages |
| Deploy | `git push` |

Everything is either a web standard Safari implements, or a file in this repo
that can be read end to end.

### 7.1 File structure

```
gymbuddy/
├── index.html
├── style.css
├── manifest.json
├── sw.js
├── js/
│   ├── app.js          entry, screen routing
│   ├── ui.js           DOM rendering
│   ├── generator.js    the pipeline in §4
│   ├── rules.js        constants transcribed from programming-basis.md
│   ├── templates.js    day-type templates (§5)
│   └── storage.js      localStorage read/write
├── data/
│   └── exercises.json  the library
└── docs/
    ├── programming-basis.md
    └── spec.md
```

`rules.js` contains no logic — only the tables from §1, §3, §4, §5, §7, each with
a comment pointing at its section. Changing a training rule should mean editing
one constant, not hunting through the generator.

---

## 8. Build order

Each phase is independently usable.

**Phase 1 — a working generator.**
`exercises.json` seeded to ~150 across all patterns · `rules.js` · `templates.js`
for 4 day types · generator pipeline · one workout screen · deployed to GitHub
Pages and installed on the phone.

**Phase 2 — adaptation.**
Soreness body map with sore/hurt severity · swap button · ban list · history in
`localStorage` · remaining 5 day types · library to ~350.

**Phase 3 — intelligence.**
Neglect-aware proposals with reason strings ("nothing explosive in 9 days") ·
CNS account · ramp enforcement · architecture variation beyond straight sets ·
JSON export/import.

---

## 9. Resolved decisions

Confirmed by the user 2026-08-20.

| Question | Answer | Consequence |
|---|---|---|
| Units | **kg** | Display only; loads remain percentages |
| Returning from inactivity? | **Yes** | Ramp (§3) is **active from week 1** — not skippable |
| Mobility/core content | **General** | No problem-area targeting; standard full-body block |
| Running venue | **Anywhere — no fixed track** | Prescriptions must be terrain-agnostic; see 9.1 |

### 9.1 Terrain-agnostic running

There is no measured track. Every running prescription must be executable on
grass, a park path, or a pavement loop, with nothing measured in advance.

| Prescribe by | Use for | Notes |
|---|---|---|
| **Time** | aerobic steady, tempo, intervals | Default. Works anywhere. `4 × 3 min @ hard, 2 min walk` |
| **Effort** | all running | Paired with time. Described in words, not pace or HR |
| **Short distance** | accelerations | 20–40 m is pace-able by eye. Acceptable |
| **Long distance** | — | **Avoid.** "Run 1.6 km" is unverifiable without a measured route |

Flying runs and anything needing a precise split are marked **optional — requires
measured ground**, and the generator does not select them by default.

The metre-based volume caps in §5 of `programming-basis.md` still apply as
internal budgets. They are estimated from prescribed reps × nominal distance,
never shown to the user as a target to hit.

---

## 10. Session state — where this stands

**Last worked: 2026-08-21.** Phase 1 code complete and deployed. Live at
https://ninwhippa08.github.io/GymBuddy/

### Done
- `docs/programming-basis.md` — research synthesis, 9 rule sets, cited
- `docs/spec.md` — this file
- All requirements gathered and all open questions resolved

### Next step — Phase 1 (see §8)

**Done since:** repo initialised, docs committed, remote set to
`git@github.com:ninwhippa08/GymBuddy.git`. Commits use the GitHub noreply
identity — never a real address, since the repo is public.

1. ~~`data/exercises.json`~~ — **done.** 186 exercises, all 15 patterns covered,
   35 of them loadable against the six `prRoots`. Validated for unique ids,
   resolvable `prRef`s, vocabulary conformance, and 1–3 ranges.

   Two findings for whoever writes the templates:
   - **`max-strength` has no accessory-tier candidates** (15 primary, 17
     secondary, 0 accessory). An accessory slot on a max-strength day must draw
     from the `hypertrophy` pool instead. This is correct as data — accessory
     work is not max-strength work — so fix it in `templates.js`, not here.
   - **`aerobic-steady` is the thinnest pool at 9.** Fine for Phase 1; worth
     widening when the library grows toward 350 in Phase 2.

2. ~~`js/rules.js`~~ — **done.** Constants only, no logic. Every value carries a
   source section and a provenance tag (`[verified]` / `[corroborated]` /
   `[unverified]`) from the verification pass. Holds the corrected numbers.
3. ~~`js/templates.js`~~ — **done.** Four day types. Accessory slots filter by
   the `hypertrophy` modality, which resolves the starvation gap above. Slots
   carry an explicit `mode` (`load` / `contacts` / `time`). Verified: no starved
   slots across 16 template slots + 3 mobility/core slots, venue filtering on.
4. ~~`js/generator.js`~~ — **done.** All ten pipeline steps. Pure — library,
   profile, history and soreness arrive as arguments, so it runs without a
   browser. Seeded RNG, so the same seed reproduces a session and a reroll is
   just a new seed.

   Verified across 800 sessions (4 day types × 5 ramp weeks × 40 seeds): ramp
   ceiling never exceeded, no repeated exercise inside a session, nothing over
   70 min, no unfilled slot, mobility block always present. Plus: hurt joints
   excluded, ban list held, CNS veto fires, neglect scoring avoids yesterday's
   day type, seeds deterministic.

   **The ramp ceiling is applied twice, deliberately.** Once to the fraction of
   the movement's own max, once to the displayed multiplier. A snatch pull has
   `prCoef` 1.15, so 65% of its own max prints as `0.75 × snatch PR` — above the
   ceiling the app claims to enforce. A ceiling the printed number exceeds is
   not a ceiling. This makes the app slightly more conservative than the
   literature strictly requires; that is the intended direction here. Don't
   "fix" it back without reading basis §3.

5. ~~`index.html` + `js/ui.js` + `style.css`~~ — **done.** One workout screen.
   `ui.js` is pure: data in, detached DOM out, `createElement` and
   `textContent` only, never `innerHTML`. 56px tap targets, and the load line
   is the largest text on the screen because it is the only thing read
   mid-set. `js/storage.js` came with it — the ramp needs `returnDate` and the
   generator needs `history`, so the screen cannot run without persistence.

   Reroll **replaces** today's history entry rather than appending. Two
   entries for one training day would double-count `patternSets` and
   `cnsLoad`, and the neglect model reads both.

   One thing to watch: because generating marks a session done (§1), merely
   opening the app on a rest day writes a completed session. That is §6
   limitation 1 playing out, and the mitigation named there — a one-tap "did
   you finish this?" on next launch — is worth doing before the history gets
   long enough to matter.

6. ~~`manifest.json` + `sw.js`~~ — **done.** Installable and offline.
   Every path is relative; Pages serves from `/GymBuddy/`, so a leading slash
   resolves wrong on the real host while passing on localhost. No
   `skipWaiting` — a worker taking over mid-session would swap the code under
   a workout being read between sets, so updates land on next launch.

   **`VERSION` in `sw.js` must be bumped by hand on every deploy.** There is
   no build step to do it. Ship a changed file without bumping it and
   installed phones keep serving the old cache forever.

   Two bugs that only a real browser could surface, both fixed:
   - The reps-mode line said `bodyweight`. The generator drops to that mode
     for anything it has no reference max for — bodyweight, machine **and**
     dumbbell — and 122 of the library's 151 non-loadable entries hold
     something, a barbell hip thrust among them. It prints the effort cue now.
   - Install used a bare `cache.addAll()`, which fetches through the browser's
     HTTP cache and precached the *previous* deploy's files: version bumped,
     cache renamed, old bytes inside. Now fetches with `{cache: 'reload'}`.
     This one would have looked like a broken deploy, not a broken worker.

7. **Published.** Live at https://ninwhippa08.github.io/GymBuddy/, served from
   `main` at repo root. Verified on the live host: all 15 files 200, correct
   MIME types (`application/javascript` for the modules), service worker
   active at scope `/GymBuddy/`, all 14 shell entries present in
   `gymbuddy-v3` and retrievable, library loads, generator runs clean.

   The subpath was tested before deploying, by serving a `git archive` export
   from a parent directory so the app sat at `/GymBuddy/`. Worth repeating if
   the path assumptions ever change: localhost serves from `/`, so a
   leading-slash mistake passes locally and 404s every asset on the real host.

   Note for anyone adding a file to Pages later: enable it from the
   **repository's** Settings → Pages, not the account-level Pages screen,
   which only offers domain verification.

### Next up — resume here

Install to the home screen and use it once for real. Phase 1 is not finished
until a session has been read in a gym. Then Phase 2 (§8).

Suggested order for what follows, given how much engine already exists:

1. **"Did you finish this?" on next launch** — §6 limitation 1. Opening the
   app on a rest day currently writes a completed session, and those phantom
   entries feed the rolling pattern counts, the CNS account and the neglect
   scoring that everything in Phase 3 reads. Cheapest to fix while the history
   is short.
2. **Soreness body map** — the engine is already done. `eligibleFor` excludes
   `hurt` joints outright and `fillSlot` downweights `sore` by 0.2; `app.js`
   passes `soreness: {}` hardcoded. This is a UI job, not a generator job.
3. **Ban list, then swap** — `eligibleFor` already filters `profile.banned`.
   Swap needs a small generator function to re-fill one slot (§4.2).
4. **The five remaining day types, and the library toward 350.** Thinnest
   pools today: `rotate` 4, `throw` 5, `carry` 6, `pull-v` 7, `lunge` 9.
5. **Architecture variation last.** `chooseArchitecture` returns `'straight'`
   because `phase1` defaults true, but flipping that flag is not enough:
   `prescribe()` only knows straight sets, so EMOM, cluster, complex, circuit
   and ladder each need a prescription shape. Deepest change in the project.

Already done ahead of schedule, despite §8 filing them under Phase 3: neglect
scoring with reason strings, the decayed CNS account with its veto, and ramp
enforcement.

### Decisions already made — do not relitigate
- **No framework, no build step, zero dependencies.** The user explicitly
  distrusts tooling he cannot read. Plain ES modules only.
- **GitHub Pages, not Vercel.** User's call on infrastructure durability.
- **Never display an absolute weight.** Always `0.75 × PR`. The app stores no
  maxes at all.
- **No logging, no confirmation prompt.** Generating a session marks it done.
  Consequences accepted and recorded in §6.
- **Venue is an output.** No equipment checklist — generate first, swap second.
