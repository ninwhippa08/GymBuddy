# GymBuddy — Specification

A workout generator for a retired college American football athlete. Trains 1–3×
per week, irregularly. Wants a different session every time, adapted to what is
sore that day, and prescribed as a fraction of his own PRs.

Rules cited as **§n** refer to sections of [`programming-basis.md`](./programming-basis.md).

---

## 1. Product shape

```
open app
  → HOME: return week, days since the last session, a month of training
  → tap body map for anything sore  (last session's flags pre-checked)
  → tap "Generate today's workout"
  → app proposes a day type, with a reason
  → accept, or reroll into another type
  → workout appears
  → swap any exercise that isn't possible today
  → go train
  → tap "I did this workout" at the foot of the card
```

Reopening the app while today's session is unconfirmed goes **straight back to
the card**, not to home: he reopens it between sets, and a calendar in front of
the workout he is halfway through is friction in the one place the app should
disappear. `design-home-and-calendar.md` §3.

The **venue is an output, not an input.** The generated session determines
whether this is a gym day or a park day. There is no equipment checklist.

**No logging.** Generating a session still marks it as done — but as of
`sw.js` v28, generating requires a **tap**. Opening the app writes nothing.
The user declined confirmation prompts; the residual drift is documented in §6.

---

## 2. Constraints

| Constraint | Value | Source |
|---|---|---|
| Sessions per week | 1–3, irregular | user |
| Gym session total | ≤ 70 min | user — enforced by a test as of 2026-08-31, see `tests/session.test.mjs`'s spec.md:36 sweep |
| Gym main work | ≤ 45 min, raised to ≤ 50 min 2026-08-31 | user — see `TIME.MAIN_WORK_MAX_MIN` in `js/rules.js` and design §8 open question 9 for why |
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
               loaded compound → per-set warm-up ramp (§4.1a)
8. PACK        estimate duration; trim to 45 min main work
9. APPEND      mobility + core block, always (§9)
10. ORDER      enforce fixed sequence (§8)
```

### 4.1 Soreness

**Built 2026-08-30, `sw.js` v13.** `ui.sorenessMap`, wired in `app.js`, with the
joint vocabulary in `rules.SORENESS_JOINTS`.

Two severities, one tap each:

- **Sore** — soft. Downweights exercises loading that joint; will still select
  one if nothing else fits, at reduced intensity.
- **Hurt** — hard. Excludes every exercise loading that joint, no exception.

Flags persist to the next session pre-checked, clearable with one tap. This gives
a de facto chronic-injury profile without asking the user to maintain one. They
live on the **profile**, not the session, which is what makes them persist; the
session records the soreness it was built from, the way it records
`excludeEquipment`.

**The map is a schematic figure with one dot per joint**, cycling
clear → sore → hurt → clear, and it sits on the session screen beside the
equipment control rather than gating it — the athlete's call, 2026-08-30,
consistent with §8's "generate first, adjust second".

**Both controls collapse, and this is not cosmetic.** Expanded, the map is 460px
and the equipment list 125px, which put the first exercise card at 884px — past
the fold on an 844px phone. The app's promise is that you open it at the gym
door and see the session, so the session leads and the controls fold to a line
that still carries their state ("What's sore today? — knee hurt"). Measured
before and after: 884px → 362px. `<details>`/`<summary>`, so it is native,
keyboard-operable and works with no script at all; `app.js` owns the open flag
because every tap rebuilds the tree and the panel would otherwise shut between
joints.

**Known, and correct rather than surprising:** the four-hurt veto in
`proposeDayType` only applies when the app *proposes* a day type. Changing
soreness on a day already generated keeps that day type and drops the movements
instead, because the athlete chose it directly.

### 4.1a Warm-up ramps on loaded compounds

**Built 2026-08-31, `sw.js` v15.** `js/rules.js` `WARMUP`, `js/generator.js`
`buildWarmup()`, wired into `prescribe()`. Design
`design-mobility-and-warmup.md` §4.3.

A loaded compound no longer prescribes one working number for every set. When
its clamped working load clears `WARMUP.FLOOR` (0.50 of the movement's own
max), `prescribe()` attaches `block.setPlan` — an array of per-set steps
climbing from `WARMUP.START` (0.30) to the working load in jumps no larger
than that movement's band — `WARMUP.MAX_JUMP` (0.15) for lower-body and
unclassified lifts, `WARMUP.MAX_JUMP_UPPER` (0.10) for the four upper-body
patterns — followed by the working sets themselves. Each
step carries its own `reps`, `pct` and `displayMultiplier`; `block.sets`,
`block.reps` and `block.pct` keep meaning the working sets only, unchanged
from before this work, so nothing downstream of `prescribe()` needed to learn
a new meaning for them.

**Warm-ups are excluded from volume accounting.** `patternSets`, `cnsLoad` and
`footContacts` are computed from the scalar `sets`/`reps` fields, which never
counted the ramp, so warm-up sets contribute nothing to the neglect model or
the CNS account.

**Warm-up rest is `TIME.WARMUP_REST_SEC` (60 s) and it is `[unverified]`** —
no source names a rest interval for a warm-up set specifically. It is
deliberately shorter than `TIME.DEFAULT_REST_SEC` (120 s) because a warm-up
set is never taken near failure.

**A ramped block floors at two working sets.** `packToBudget()` shaves working
sets to fit the main-work budget and never shaves a warm-up rung, so the old
one-set floor could leave a block that was all ramp and no work — measured at
136 blocks over a 21,000-session sweep, worst case five warm-up sets before a
single working set. The shave loop now stops at two working sets for any block
carrying a `setPlan`.

### 4.2 Swap

**Built 2026-08-30, `sw.js` v9.** `swapBlock` in `js/generator.js`.

Each exercise carries a swap control. It picks a replacement with the same
`pattern`, keeping the slot's own `tier`, `modality` and `zone`, and re-runs the
prescription. Everything already in the session is excluded, so a swap cannot
hand back a movement that appears three cards further down.

The load envelope comes off `session.rampWeek` — the session being edited — not
from a rebuilt profile. A swap joins a card whose other blocks were all priced
under one ramp ceiling, and recomputing lets it disagree with them. The ramp is
not skippable and a swap is not an exit from it.

**The rejection memory is built — 2026-08-30, later the same day.** It had been
promised by this section and missing since Phase 1. `session.rejected[slotId]`
records what left the card, rides on the session record, and is therefore
scoped to today exactly like the equipment constraint. Measured before it
existed: fifteen taps on one clean returned seven distinct lifts, trap-bar
deadlift twice and squat clean three times.

**And the tier widens once the slot's own tier is spent.** Every primary hinge
in the library is a barbell movement, so a clean's alternatives were fourteen
bars and the dumbbell and kettlebell answers sat one tier below, unreachable by
any number of taps. Widening after exhaustion is the rule `generate()` already
applies to an empty required slot; the central movements are still offered
first, and a widened block carries `tierRelaxed` so the card says so.

**The two gestures compose, and that is the point.** Tapping swap with no
constraint walks all fourteen bars before reaching a kettlebell — correct, and
useless at the rack. Unticking the barbell first empties the tier immediately,
so the very first tap returns Kettlebell Swing, then Dumbbell Snatch, then
Kettlebell Clean. The checklist is what tells the swap *why*.

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

### 4.4 Adding a movement — capture here, author elsewhere

**Built 2026-08-30, `sw.js` v14.** `ui.addMoveControl`, `storage.addDraft` /
`loadDrafts` / `removeDraft`.

The athlete's request: *"I will have a place where I can add a move to our move
library … I will write the name and a brief definition."*

**A draft is not a library entry, and the gap is the whole design.** An entry
carries `pattern`, `tier` and `modalities`, which decide whether it can ever be
selected and into which slot; `joints`, which is what a HURT joint excludes on
(§4.1); `equipment`, which the missing-kit filter reads; and a `prCoef`, which
is a load multiplier and by §8's standing rule arrives sourced or not at all.
None of that can be guessed from a sentence typed between sets, and a movement
admitted with guessed fields would start prescribing weight before anyone
checked it. So a draft is a **name and a note**, stored where the generator
cannot see it.

**Sending is a link, not a write.** Each draft carries an `<a href>` to GitHub's
pre-filled new-issue form, opened with his own signed-in session; he submits it
himself. **The app holds no credential and writes nothing.** The alternative he
first suggested — the app appending to a file in the repo — needs a token with
write access, and this repo is public and the app ships its own source, so that
token could never be stored safely on a phone. One tap on GitHub's own Submit
button is cheaper than that trade.

Both halves of the note are `encodeURIComponent`-ed. `&` ends a query parameter
and `#` ends a URL, so an unencoded note silently loses everything after the
first one it contains; there is a test for exactly that string.

Drafts are never auto-cleared when Send is tapped — the app cannot know whether
the issue was actually submitted, and a draft that vanished on an abandoned tap
would be the one thing this feature must not do. He deletes them himself.

**The loop:** capture at the rack, offline → tap Send when back on signal → say
"there are new entries" in a session → the issues are read with the public API,
the fields are written and the `prCoef` sourced, the entry is committed to
`exercises.json`, and the issue is closed.

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

1. **History is proposals, not performance — MITIGATED 2026-08-30 (`sw.js` v12),
   2026-09-01 (v18) and 2026-09-02 (v24).**
   There is still no confirmation *during* a session, so a shortened one counts
   as done. **v24 removed the largest source of these entirely:** generating
   moved behind a tap on the home screen, so merely opening the app no longer
   writes a workout. What remains is the smaller and far more deliberate set —
   days he asked for a session and then did not train — and the prompt below
   still catches those. `design-home-and-calendar.md` §2. The prompt was kept
   rather than replaced by silent auto-discard: training and forgetting to tap
   is likelier than the reverse, and deleting a real session would make the
   generator think he is fresher than he is. On launch the app asks
   **"Did you finish this?"** once per unanswered past day, most recent first,
   and keeps asking until none are left. *I did it* marks the record
   `confirmed`; *I didn't* **removes it from history entirely** — not a flag,
   because a session he did not do must not reach the CNS account or the
   neglect score, and absence is the cheapest guarantee of that. Today is never
   asked about: it is still in progress, and its turn comes tomorrow.
   `storage.pendingConfirmations` / `confirmSession` / `discardSession`.
   Since v18 the same record can be confirmed at the end of the session
   instead, by the **"I did this workout"** button at the foot of the card:
   same `confirmSession`, same field, just answered while he is still standing
   there. A day confirmed that way is never asked about on the next launch,
   and the session it confirms is locked against regeneration.
   **"No logging, no confirmation prompt" (§8) survives intact** — it was always
   a rule about not interrupting the workout, and this asks about a day that is
   already over.
2. **No load progression.** The app never learns that the squat got stronger.
   Percentages track the user's PRs, which he updates in his own head. Correct
   given the design, but it means the app cannot drive progressive overload — it
   can only vary stimulus.
3. **`plyoLevel` is self-declared** and never verified.
4. **The ramp assumes honesty about `returnDate`.** Setting it to a past date
   skips the safety ramp entirely.
5. **No individual injury modelling.** Population guidelines only (§ scope limit).
6. **`localStorage` was the only copy of the profile and the history — CLOSED
   2026-09-03 (`sw.js` v26).** Clearing site data, an origin evicted under
   storage pressure, or a new phone lost everything, and with no account and no
   server there was nothing to restore from. Unlike the other four this was not
   a consequence of a decision; it was missing. The home screen now carries a
   collapsed **Backup** panel. *Save a backup* wraps the whole state in an
   envelope (`app`, `schemaVersion`, `exportedAt`) and hands the file to
   `navigator.share`, falling back to `<a download>` and then to the clipboard;
   the athlete is on an iPhone, where the share sheet is the only one of the
   three that reliably works from an installed PWA. Restoring **replaces** and
   never merges — joining two histories by date needs a rule for every conflict
   and no way to be sure it chose right — and it takes two taps: choosing a
   file only produces a summary of what it holds and what it would destroy, and
   a second, separate tap writes. `storage.readImport` validates and returns;
   `storage.applyImport` is the only function that writes. That seam is the
   design: one function doing both would have exactly one bad day, the day a
   truncated file passes the first half of validation and fails the second,
   after the old data is already gone. A refused import is asserted to leave
   the store byte-identical. **Not covered by the suite:** the share/download/
   clipboard cascade needs a real device, and is checked by hand like every
   other release.

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
│   ├── calendar.js     month-grid arithmetic; no DOM, no toISOString
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
Soreness body map with sore/hurt severity · swap button · ~~ban list~~
(declined 2026-09-03, §10) · history in `localStorage` · remaining 5 day types ·
library to ~350.

**Phase 3 — intelligence.**
Neglect-aware proposals with reason strings ("nothing explosive in 9 days") ·
CNS account · ramp enforcement · architecture variation beyond straight sets ·
~~JSON export/import~~ — **built 2026-09-03, `sw.js` v26.** §6.6.

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

   That replacement is also what broke reroll, reported from the phone on
   2026-09-01 as *"it rerolls between aerobic-steady and interval, 2 types of
   program, I cannot move on"* and fixed the same day in `sw.js` v18.
   `proposeDayType` returns the arg-max of the neglect score, so the seed only
   ever varied the EXERCISES; the day type moved solely because the record
   moved. Each reroll rewrote today's slot, which zeroed the new pick's
   neglect score and simultaneously restored the previous pick's to full,
   because that entry no longer existed. Consecutive taps therefore swapped
   the top two open candidates forever and could not reach the third — with
   `max-strength` sitting open and unreachable at a score of 12.8. Two changes
   fix it, both in `generator.js`:

   - **A session built for a date ignores that date's own record.** There is
     only ever one, and it is the proposal being replaced, not training he
     did. Counting it let today's proposal score itself: its `cnsLoad` pushed
     the account over `CNS_VETO_THRESHOLD` and vetoed the heavy days out of
     the rotation mid-cycle.
   - **`offeredDayTypes` walks the ranking down.** The list of day types
     already offered today rides on the record (the only thing that survives
     a tap) and is excluded from selection, so repeated taps march down the
     open field instead of oscillating. When every open type has been
     offered the rotation wraps and the list resets — otherwise it would
     outgrow the field and every later tap would land on the wrap.

   One thing to watch: because generating marks a session done (§1), merely
   opening the app on a rest day writes a completed session. That is §6
   limitation 1 playing out, and the mitigation named there — a one-tap "did
   you finish this?" on next launch — **was built on 2026-08-30**, before the
   history got long enough to matter. Since v18 he can also close the loop at
   the time rather than the next morning: **"I did this workout"** at the foot
   of the card confirms today's record on the spot. A confirmed session is
   locked — the card drops Reroll and no soreness or equipment change
   regenerates it, because one tap must not replace a workout he has just
   reported doing.

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

**Phase 1 has been used in a gym. The feedback is in, and it invalidated three
things.** See `docs/design-mobility-and-warmup.md` — approved in shape,
revision 2. **Steps 1 and 2 of its build order are shipped (2026-08-24 and
2026-08-31); steps 3–4 have not been started.**

**The immediate next step is step 3 — the exercise count becomes a residual,
design §4.4 — and it is blocked; see finding B below.**

What the gym session found, in the order it was found:

1. ~~**Mobility was prescribed by time, ~3 min per movement.**~~ — **done
   2026-08-24.** The `mobility` modality split into `mobility-dynamic` (dosed
   in reps) and `mobility-static` (dosed in seconds), and the library was
   retagged. `loadLine` now prints `12 reps` for a drill and `30s hold` for a
   stretch, with `per side` where the movement is unilateral. Basis §9,
   discrepancy 4.
2. ~~**All mobility ran after the main work.**~~ — **done 2026-08-24.** The one
   block became two: a prep block of dynamic drills that runs first, and a
   cool-down of static stretching and core that runs last. `SESSION_ORDER` and
   `orderClass` sort on role, with no day-type branching, and the session screen
   renders three groups — Prep, Main work, Cool-down. Basis §8, discrepancy 6.
3. ~~**Loaded lifts had no warm-up ramp at all.**~~ — **done 2026-08-31,
   `sw.js` v15.** Note the inconsistency this exposed: §5.2 already prescribes
   a progressive ramp for sprints. The principle was accepted and simply never
   applied to the barbell. `prescribe()` now attaches `block.setPlan` — see
   §4.1a above. Design §4.3.
4. ~~**The exercise count was unsourced.**~~ — **done 2026-09-01, `sw.js`
   v23.** Four slots on max-strength and power, five on hypertrophy, invented
   and then cited to §4.3 of that file — this document citing itself. The
   count is now a residual: each lifting day declares the patterns it targets,
   `patternDebt` measures what the week still owes against the per-goal volume
   figures sourced the same day, and the FILL loop takes optional slots while
   debt remains and the clock allows. Trimming drops the LEAST overdue work
   rather than the last slot. Bounded by a measured `TIME.MAX_MAIN_SLOTS` and,
   during the return ramp, by the ramp itself — coverage may not spend the
   minutes the ramp frees by cutting sets, which it did at +35% working volume
   in week 1 until it was caught by measurement. Design §4.4, plan-06's
   successor `docs/plan-07-exercise-count.md`.

Two constants in the *first* draft of that design were also invented and were
caught in review: a fixed warm-up ladder, and a purely time-driven exercise
count. Both are now derived. The lesson generalises — see the design doc's §8
open questions, which lists what in it remains unsourced.

#### Two live findings carried out of step 1

**A. The static stretch pool is thin.** Seven `mobility-static` entries, with
`hip` in four of them. A single hurt hip leaves exactly three stretches — the
sourced floor, no margin — and two hurt joints collapse it to one or two. The
generator warns rather than shipping a short cool-down silently, so this is a
thinness problem and not a correctness bug, but it is the next data job. It
needs sourced stretches, not invented ones. Design §8 open question 8.

**B. RESOLVED 2026-09-01. Design §4.4 can ship.** It reads a pattern-level
weekly volume share that was not sourced: the ~10-sets-per-week figure is
`[verified]` for hypertrophy only, and §4.4's coverage rule leaned entirely on
transferring it to max-strength and power. The transfer turned out to be
**invalid** — Pelland et al. 2025 (67 studies, 2,058 participants) models the
two dose-responses separately and strength's efficient band ends at ~4 weekly
sets per muscle group, where hypertrophy's runs 5–10 and keeps paying past 20.
The shared constant was split the same day into per-goal targets
(`VOLUME.SETS_PER_PATTERN_PER_WEEK`), so §4.4 now has a sourced number to read.
Basis §2 "The dose-response differs by goal"; design §8 open question 6 carries
the evidence, including that power still has no dose-response literature and is
`[corroborated]` only.

Also carried out of step 1: the session total is **63 min measured, not the 60
the design arithmetic claimed** — see basis §9, discrepancy 7. The 60 is a
target; 63 is what the floors actually cost in the worst case. (That figure
predates the ramp; the ramp raised the ceiling further — see below.)

Build order is design §4.6. Step 1 is done and it freed the ~13 min step 2's
ramps now spend. **As first measured, the ramp did not lengthen sessions**
(average 51.78 → 52.37 min over a 21,000-session sweep); `packToBudget` paid
for the ramp minutes by shaving working sets instead (213,998 → 194,042, a
9.3% drop). **DECIDED 2026-08-31: the athlete raised `MAIN_WORK_MAX_MIN` from
45 to 50** (design §8 open question 9) to buy back most of that volume — a
full trim-budget exemption was tried first and rejected because it pushed the
observed maximum to 81 min, 31% of max-strength sessions over his stated
≤70 min limit (line 36 below). At `MAIN_WORK_MAX_MIN` 50, max-strength working
sets recover to 88% of their pre-ramp count (27,934 → 32,600, vs. 37,068
pre-ramp), and the observed maximum over the committed 10,000-seed sweep in
`tests/session.test.mjs` is exactly 70 min — inside his limit, with no
margin. `TIME.FLOOR_OVERRUN_ALLOWANCE_MIN` re-derived from 5 to 10 to match;
`GYM_SESSION_TOTAL_MIN` did not move. See `design-mobility-and-warmup.md`
§4.3's "as built" note item (1) and §8 open question 9 for the full option
table and before/after figures.

Still queued, unchanged by the above:

- ~~**"Did you finish this?" on next launch**~~ — **done 2026-08-30**, see §6
  limitation 1. It was fixed while the history was still short, which was the
  whole argument for doing it early.
- ~~**Soreness body map**~~ — **done 2026-08-30**, see §4.1. The engine had been
  finished since Phase 1; `app.js` passing a hardcoded `{}` was the whole gap.
- ~~**Ban list.**~~ — **DECLINED 2026-09-03, not deferred.** `eligibleFor`
  filters `profile.banned` and always has; the missing half was a UI to put
  something on that list. Asked directly whether any movement the app had
  offered was one he wanted gone permanently, the athlete said no and asked for
  the idea to be dropped. Swap covers "not today", which is the case that
  occurs; "not ever" was a case nobody had. **The field stays wired** — one
  line in `eligibleFor`, present in every profile already written — so this
  can become a control rather than a redesign if it is ever wanted. **The swap
  half was already done** in v9 with the equipment constraint (§4.2). Do not
  re-propose this without new evidence.
- **Architecture variation last.** `prescribe()` only knows straight sets, so
  EMOM, cluster, complex, circuit and ladder each need a prescription shape.
  Deepest change in the project. Note `setPlan` (design §4.3) is deliberately
  *not* shaped for these — day types before architectures.

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
