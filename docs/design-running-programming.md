# Running programming — design

**Date:** 2026-08-26
**Status:** approved in brainstorming, awaiting user review before planning
**Supersedes:** the `aerobic-steady` template in `js/templates.js:174`

---

## 1. Problem

A generated session proposed a ~90% effort backward run followed by a 20-minute
run. Both prescriptions are legal under the current templates, and neither is
defensible training.

Root cause is **bucket conflation**, not a bad rule. Slot eligibility is tier +
pattern + modality only (`js/generator.js:236-249`), and two patterns each hold
several unrelated movement families:

- `pattern: "sprint"` (20 entries) holds true maximal efforts
  (`acceleration-sprint`, `flying-run`), technique drills (`a-skip`, `ankling`,
  `wall-drill`) and multidirectional movement prep (`carioca`, `backpedal`,
  `lateral-shuffle`).
- `pattern: "locomotion"` (15 entries) holds unloaded running alongside
  ergometers (`rower`, `assault-bike`), loaded marches (`ruck-march`,
  `sled-drag`) and `backward-walk`.

So the `aerobic-steady` "strides" slot (`tier: secondary+accessory ::
pattern: sprint :: modality: sprint`, prescribed *"build to about 90%"*) can
legally select `backpedal`, and its "steady run" slot can legally select
`backward-walk` for 20-45 minutes. Both selections are exactly what the filters
permit.

A second instance of the same class: `tempo-run`, `fartlek` and `stair-run`
carry `aerobic-steady` in their modalities, so a prescribed easy run can come
back as a fartlek.

A third instance, found on the phone on 2026-08-27 and fixed in §4.5: the
interval day's two slots share `modality: interval` and differ only in `mode`,
so the continuous tempo slot drew the entry named `run-interval` and printed
*"Running Intervals — 8 min"*, while the seconds-based work slot drew
`stair-run` and prescribed *"7 × 60 s"* — a staircase nobody owns. A slot
filtering on modality alone cannot tell an exercise's ENERGY SYSTEM from its
SHAPE, and these two slots differ only in shape.

## 2. Scope

**In scope.** Four running day types with correct pools; a four-stage running
prep block; the pattern re-split that makes both possible; a chronic-load term
coupling lifting fatigue to running selection.

**Explicit non-goals.** No changes to load prescription, `ZONES`, PR
coefficients, the return-to-training ramp, or any existing cue. All 235 library
cues survive untouched.

**Was deferred, now built.** Equipment-aware filtering — see §9.

## 3. Decisions taken

| Question | Answer |
|---|---|
| How many running session types | **Four**: easy run, intervals, sprint, plyometric |
| Tempo/threshold work | Folded into the interval day as an intensity variant, not its own day type |
| Equipment/terrain access | Was: assume full access, swap path handles gaps. **Superseded 2026-08-30** — the athlete names what is missing today and the session is rebuilt around it (§9) |
| How running days are selected | Programmed by the system from accumulated lifting load — never a mode the user requests |
| Integration approach | Extend the existing CNS account with a chronic horizon (approach A), rather than a weekly-shape planner or a modality-balance ledger |
| `jump-rope` | Moves to `pattern: jump` |
| `backward-walk` | Kept in the library under `pattern: march`; ineligible for any running slot |

The weekly-shape planner was rejected because it contradicts the decision
recorded at `js/rules.js:202` — a decaying budget was chosen over a fixed
weekly calendar precisely so irregular attendance does not break it, and
attendance here is 1-3x/week irregular.

---

## 4. Pattern taxonomy

### 4.1 `sprint` (20) splits into three

| Pattern | Members | Rationale |
|---|---|---|
| `sprint` (8) | acceleration-sprint, flying-run, hill-sprint, resisted-sprint, sled-push, three-point-start, falling-start, build-up-run | Maximal / near-maximal efforts. High CNS, full rest, counted against the metreage budget |
| `sprint-drill` (9) | a-skip, b-skip, a-march, ankling, wall-drill, fast-leg-drill, high-knees, straight-leg-bound, power-skip | Low-intensity technique work. Belongs in prep; must never fill a hard-effort slot, and must not accrue as sprint volume in neglect tracking |
| `agility` (3) | carioca, backpedal, lateral-shuffle | Multidirectional movement prep. Frontal and transverse plane hip work; never a maximal effort |

### 4.2 `locomotion` (15) splits into three

| Pattern | Members | Rationale |
|---|---|---|
| `run` (7) | easy-run, tempo-run, run-interval, fartlek, shuttle-run, stair-run, trail-run | Unloaded running on feet. The only pool the running templates draw from |
| `erg` (2) | assault-bike, rower | Machine conditioning. Same energy systems without running impact — the substitute for sore knees or hips |
| `march` (5) | incline-walk, ruck-march, sled-march, sled-drag, backward-walk | Loaded or low-intensity walking. Legitimate work, never a run |

`jump-rope` leaves `locomotion` for `jump`: mechanically it is repeated
low-amplitude hopping, the pogo-hop family, and it already carries the
`plyometric` modality. It stays available for conditioning through its
modalities but stops being eligible as a steady run.

### 4.3 `jump` (16 → 17)

Unchanged apart from receiving `jump-rope`. This bucket is already clean and
becomes the plyometric day's pool as-is.

### 4.4 New field: `effortClass`

Added to the 8 `sprint`-pattern entries. Values `submaximal` | `maximal`.

`build-up-run` is the only `submaximal` member. Without this field, an
easy-day strides slot filtering on `pattern: sprint` can select
`acceleration-sprint` at full effort — the same defect as the backward walk,
one layer down. One field closes the category permanently.

### 4.5 Modality cleanup

`tempo-run`, `fartlek` and `stair-run` lose `aerobic-steady` from their
`modalities`. They are interval work.

**Revised 2026-08-27.** "Interval work" was one bucket doing two jobs, and
`modality` is the field dosing follows from — the same reason `mobility` split
into `mobility-dynamic` and `mobility-static` (design 4.1). Interval work is
dosed in rounds of seconds; tempo work is dosed in continuous minutes. So
`interval` splits:

| Modality | Members | Dosed as |
|---|---|---|
| `interval` | run-interval, shuttle-run, rower, assault-bike | N rounds × 60-90 s, recovery from the work:rest ratio |
| `tempo` | tempo-run, fartlek, stair-run, rower, assault-bike | one continuous 8-12 min effort |

The split is by shape, not by hardness. `fartlek` is self-organising — its
hard pieces are chosen off landmarks, so prescribing it as `8 × 75 s` states
a structure the exercise already has and contradicts. `stair-run` is bound to
a staircase whose length is unknown, which is the same reason spec 9.1 keeps
every run in seconds rather than metres; as minutes ("run up, walk down,
repeat, for 10 min") it needs no knowledge of the terrain and stays in the
library. The ergs sit in both buckets because an erg genuinely is both.

**Cost, accepted.** The `interval` pool falls to two outdoor entries and
`tempo` to three, both far short of the VARIETY target of 16 (see
`docs/coverage-matrix.md`). Both are already floor-exempt and both are part of
the open §11.0 question. Leaving them conflated would have kept the pool
counts up by keeping the prescriptions wrong.

---

## 5. The running prep block

Structure: raise → mobilise → integrate → potentiate. Every running session
runs all four stages; the endpoint of stage 4 is what differs.

**Binding constraint.** `js/rules.js:255` records, `[corroborated]`, that
dynamic stretching volume must not scale with available time — three sets
induced acute fatigue and impaired sprint performance within five minutes.
Prep volume therefore comes from stages 3 and 4, never from more stage 2.

| Stage | Source pool | Dose |
|---|---|---|
| 1 · Raise | new `warmup-jog` entry | 3-5 min easy |
| 2 · Mobilise | `mobility` + `mobility-dynamic`, **restricted to hip/knee/ankle** (14 available) | `MOBILITY_DOSE.DYNAMIC_DRILLS` unchanged: 3-4 drills × 10-12 reps |
| 3 · Integrate | `sprint-drill` + `agility` (12 available) | 2-3 movements × 20 m |
| 4 · Potentiate | `sprint` where `effortClass: submaximal`; or `jump` at `plyoIntensity: low` | scales by session, see below |

### 5.1 Scaling

| Stage | Easy run | Intervals | Sprint | Plyometric |
|---|---|---|---|---|
| 1 Raise | 3-5 min | 3-5 min | 5 min | 5 min |
| 2 Mobilise | 3 drills | 3 drills | 4 drills | 4 drills |
| 3 Integrate | 2 | 2 | 3 | 3 |
| 4 Potentiate | none | 2 build-ups to ~80% | 3-4 build-ups to ~95% | 2-3 low-intensity plyos |
| Prep total | ~7 min | ~10 min | ~14 min | ~12 min |

The easy run omits stage 4 deliberately: build-ups before a conversational-pace
run make it something other than an easy run.

### 5.2 Available supply

30 movements are usable in a running warm-up: 14 hip/knee/ankle dynamic
mobility drills, 9 sprint drills, 3 agility, 3 low-intensity plyos, 1 build-up
run. Supply was never the constraint.

### 5.3 What this requires

- A new `PREP_BLOCK.running` variant in `js/templates.js`, replacing
  `PREP_BLOCK.short` for the four running day types. This resolves both
  existing `[unverified] count: [2,3]` markers.
- `eligibleFor` (`js/generator.js:236`) gains an optional `joints` filter, so a
  slot can require hip/knee/ankle. Same shape as the soreness check at
  `js/generator.js:246`. Without it, the block can prescribe
  `thread-the-needle` and `banded-shoulder-dislocate` before a sprint session.
- One new library entry, `warmup-jog`, distinct from `easy-run` (which is
  prescribed at 20-45 min). Cued to the same standard as the other 235.
- Stage order is preserved by the existing stable sort (`js/generator.js:606`),
  which breaks `SESSION_ORDER` ties by emission index. The builder must emit
  stages 1-4 in order; no other change is needed.

---

## 6. The four templates

Day-type keys are `aerobic-steady`, `interval`, `sprint`, `plyometric`. All
four are already named in spec §5, and the latter three already have recovery
vetoes wired in `proposeDayType` (`js/generator.js:156-161`). **No history
migration.**

### 6.1 `aerobic-steady` — easy run — low CNS

| Slot | Pool | Prescription |
|---|---|---|
| A | `run` + `erg`, modality `aerobic-steady` | 20-45 min, conversational |
| B (optional) | `sprint`, `effortClass: submaximal` | 4-6 × build-up run, 60-90 s rest |

After §4.5 the slot A pool is easy-run, trail-run, and the two ergs. This is
correct: variety on an easy day comes from duration and terrain, not exercise
selection.

### 6.2 `interval` — moderate CNS

| Slot | Pool | Prescription |
|---|---|---|
| A | `run`, modality `interval` | 6-10 × 60-90 s hard, work:rest 1:1 to 1:2 |
| B (optional) | `run`/`erg`, modality `tempo` | tempo finisher, 8-12 min |

Slot A pool: run-interval, shuttle-run, plus ergs.
Slot B pool: tempo-run, fartlek, stair-run, plus ergs.
The two slots differ in modality and not only in mode, so neither can draw an
exercise of the other's shape (§4.5). Threshold work lives in slot B, as the
continuous effort it is.

### 6.3 `sprint` — high CNS

| Slot | Pool | Prescription |
|---|---|---|
| A | `sprint`, `effortClass: maximal`, primary | 4-8 × 20-40 m, rest 96-160 s |
| B (optional) | `sprint`, hill or resisted | 4-6 × 20-30 m |
| C (opt-in only) | `flying-run` | 2-3 × 20 m |

Session metreage stays within `SPRINT.METERS_PER_SESSION` [200, 800] as an
internal budget, never shown as a target (spec 9.1). Rest derives from
`SPRINT.WORK_REST_RATIO`. Slot C is unreachable by default —
`requiresMeasuredGround` is excluded unconditionally at `js/generator.js:245`.

### 6.4 `plyometric` — high CNS

| Slot | Pool | Prescription |
|---|---|---|
| A | `jump`, primary, `plyoIntensity` moderate-high | contacts |
| B | `jump`, bounds / lateral | contacts |
| C (optional) | `jump`, `plyoIntensity: low` | contacts |

`PLYO_CONTACTS_PER_SESSION` and the week 1-2 `PLYO_TRANSITION_WEEKLY_CAP` are
already enforced in the pack step (`js/generator.js:702-708`). No new safety
machinery.

### 6.5 What this requires

1. `mode: 'interval'` in `prescribe()` — work seconds, rest seconds, reps. The
   only genuinely new prescription mode.
2. A metreage budget check in the pack step for sprint days, mirroring the plyo
   contact check at `js/generator.js:702`.
3. `orderClass` (`js/generator.js:587-602`) updated for the renamed patterns:
   `sprint` → `sprint`; `run`, `erg`, `march` → `conditioning`. `sprint-drill`
   and `agility` in prep are already caught by the `role === 'prep'` branch
   above them.

---

## 7. Coupling lifting load to running selection

### 7.1 Acute — unchanged

The 72-hour decaying CNS account (`js/generator.js:96-100`, `CNS_DECAY`)
already prevents a hard day stacking on a hard day via a veto at
`CNS_VETO_THRESHOLD`. `HIGH_CNS_DAY_TYPES` already includes `sprint` and
`plyometric` (`js/rules.js:218`), so they correctly compete with
max-strength and power for the same budget rather than serving as recovery.
**`CNS_VETO_THRESHOLD` was 8 at the time this section was written; it was
re-derived to 2 on 2026-08-31 after a mobility-accounting bug was found and
fixed — see `programming-basis.md` §7 for the current value and its
derivation. Not re-verifying the number here on every change is deliberate:
read it from `js/rules.js` rather than trusting this sentence.**

### 7.2 Chronic — new

Three fields added to the state built in `buildState`, all derived from history
already recorded (`s.dayType`, `s.cnsLoad`):

| Field | Definition |
|---|---|
| `chronicLoad` | Rolling 28-day sum of session `cnsLoad` |
| `gymShare` | Fraction of `chronicLoad` contributed by gym day types |
| `weeksSinceEasyWeek` | Consecutive weeks above a chronic-load floor with no lighter week |

They feed one new multiplicative term in `proposeDayType`:

```
score = min(daysSince, 21) × chronicBoost(dayType, state)
```

`chronicBoost` returns > 1 for `aerobic-steady` and `interval` when `gymShare`
is high or `weeksSinceEasyWeek` crosses its threshold; it returns 1 for every
other day type.

### 7.3 Required properties

1. **Boost, never veto.** Running is encouraged by chronic lifting load, never
   forced. If the user is fresh and has not lifted in a week, lifting still
   wins on neglect.
2. **No boost for `sprint` or `plyometric`.** They are high-CNS. Prescribing
   them as the answer to accumulated fatigue would be backwards.
3. **Degrades gracefully on irregular attendance.** A rolling 28-day sum has no
   concept of missed sessions, so a two-week gap lowers chronic load, which
   correctly makes lifting more attractive rather than less.

### 7.4 Scenarios

- *Lifted 3× this week, asks for a session*: `gymShare` climbs, running days
  are boosted, the easy run or interval day wins the next proposal.
- *Four weeks of lifting*: `weeksSinceEasyWeek` crosses its threshold, a larger
  boost applies until a lighter week resets it.

### 7.5 The rotation defect — found and fixed 2026-09-01 (plan-06)

§7.1–7.4 describe how lifting load *boosts* a running day. None of them
describe what the neglect score does when a day type is simply skipped for a
long time, and that turned out to be where the model failed. **At the
athlete's real 1–3×/week cadence the generator was withholding whole day types
for a year at a time.** Simulated against the real generator, committing each
session the way `app.js` does (replace-by-date), counting what was actually
proposed:

| cadence | max-str | power | hypertrophy | aerobic | interval | sprint | plyo |
|---|---|---|---|---|---|---|---|
| 1×/week (52 sessions) | 25 | 14 | **0** | 12 | 1 | **0** | **0** |
| 2×/week (104) | 26 | 26 | **1** | 26 | 25 | **0** | **0** |
| 3×/week (156) | 26 | 26 | 26 | 26 | 26 | 26 | **0** |
| **after the fix, 1×/week** | 8 | 8 | 8 | 7 | 7 | 7 | 7 |

**The mechanism, in three parts.** `buildState` read `hoursSince` from
`recent`, which it has already truncated to `VOLUME.HISTORY_DAYS` (14 days),
so every day type skipped for longer than a fortnight came back `Infinity` and
`proposeDayType` mapped it to `days = 99` — 15 days and 300 days were the same
number. `Math.min(days, 21)` then flattened whatever distinct values survived.
And the winner is chosen with `reduce((a, b) => (b.score > a.score ? b : a))`,
which keeps the **first** element on a tie — that is `PHASE_1_DAY_TYPES` order,
in which `plyometric` is last. So `plyometric` lost every tie it was ever in.

Instrumented over a simulated year at 3×/week, `plyometric` was open,
un-vetoed and **tied for the top score in 78 of 156 sessions**, losing to
`max-strength` (26), `power` (26) and `sprint` (26) — every one of them
earlier in the array. It was never vetoed. It simply never won.
`aerobic-steady` and `interval` escaped only because `chronicBoost` (§7.2)
lifts them above the cap, scoring 30–31 against everyone else's flat 21 —
which is why the two day types this section was written about were the two
that always appeared.

**The two halves mask each other, which is why this survived review.**
Measured as a 2×2, each variant in its own node process with the patch
asserted on disk:

| | window fixed | cap raised | 1×/wk | 2×/wk | 3×/wk |
|---|---|---|---|---|---|
| as shipped | — | — | hyp 0, spr 0, ply 0 | hyp 1, spr 0, ply 0 | ply 0 |
| window only | ✓ | — | hyp 12, spr 0, ply **0** | spr 1, ply **0** | ply 19 |
| cap only | — | ✓ | **byte-identical to shipped** | identical | identical |
| **both** | ✓ | ✓ | **8/8/8/7/7/7/7** | 14/13/13/19/19/13/13 | 20/20/20/29/29/19/19 |

The cap measured *alone* changes nothing at all, because the broken window
means no day type ever holds a value between 14 and 21 days for the cap to
bite on. Anyone measuring one half at a time would correctly conclude that
half was irrelevant and drop it. **Do not ship one without the other.**

**`NEGLECT_CAP_DAYS = 90` is a product decision, not a physiological one.** No
source sets a saturation point for neglect; the constant exists so a modality
abandoned for two years cannot score 730 and outrank everything for months
after it returns. It is tagged `[unverified]` in `js/rules.js` and must not be
given a fabricated citation. Removing the cap entirely measures identically
across 1–3×/week; it is retained only to bound a case no sweep at that cadence
can reach.

**What this does NOT move, checked rather than assumed.** The 70-minute
session ceiling is unaffected: `tests/session.test.mjs`'s sweep calls
`generate({ library, dayType, seed, now: 1e12 })` with the day type passed
explicitly and no history, so it never consults `proposeDayType` at all —
session length is a property of a day type's template, not of how often that
type is proposed. `CNS_VETO_THRESHOLD`, `FLOOR_OVERRUN_ALLOWANCE_MIN` and
`GYM_SESSION_TOTAL_MIN` likewise hold: all 290 tests predating this change
pass unchanged under it.

That last fact is the reason `tests/rotation.test.mjs` exists. **290 tests
were blind to day-type distribution** — nothing in the suite could see which
day types get proposed, which is exactly why a year-long starvation of three
of them shipped and sat unnoticed. The new file asserts the distribution
directly, and its year-long cases have each been watched fail against the
un-fixed generator.

---

## 8. Card rendering

The card flip is already mode-agnostic: `blockCard` (`js/ui.js:108`) attaches
the flip solely on whether `cuesFor(block.exerciseId)` returns cues, and never
branches on `mode`. All 51 running-related exercises are cued — 20 `sprint`,
15 `locomotion`, 16 `jump`, 0 missing — as are all 38 `mobility` entries. Every
running card flips to its explanation with no new work.

One defect to fix: `loadLine` (`js/ui.js:57`) ends in an unguarded fallthrough
to `block.displayMultiplier.toFixed(2)`. An `interval`-mode block has no
`displayMultiplier` and would throw a `TypeError`, killing the render.
`mode: 'interval'` therefore needs explicit branches in **both** `loadLine` and
`volumeLine` — e.g. `6 × 90 s` on the hero line, rest on the meta line.

**Revised 2026-08-27.** `6 × 90 s` shipped and was read on the phone as three
unanswered questions: how long is one round, how long do I jog, and how do I
know when I am done. It was true and unusable — a card the athlete has to
reason about mid-session is a card that failed. The interval card now states
the whole prescription on the front, without a flip:

| Line | Content | Example |
|---|---|---|
| hero (`loadLine`) | rounds, work, recovery | `6 rounds of 90 s hard, 2:55 easy between` |
| chip (`volumeLine`) | when it ends | `~24 min` |
| meta | what the recovery is for | `walk or jog the recovery -- never stand still` |

The chip is work plus the recoveries *between* rounds — there is no recovery
after the last one. `estimateMinutes` deliberately keeps that extra rest: it
packs against a time budget and the slack is the point, so the two numbers
differ by one recovery and neither is wrong.

Recovery is formatted by `spanText`, which is not `formatRest`: the meta line
prefixes the word "rest", and a recovery is not a rest. Under a minute it
stays in seconds, because `0:45` reads as a stopwatch fault.

---

## 9. Equipment-aware filtering — built 2026-08-30

**Was deferred; built in `sw.js` v9.** See
`design-equipment-and-swap.md` for the design and `plan-04-equipment-and-swap.md`
for the build.

The problem as stated here: `eligibleFor` filtered venue, soreness, bans and
measured ground, but **never equipment**, so a sled push or a stair run could be
proposed regardless of access.

**One prediction in this section was wrong, and it is the interesting part.**
It says implementation "would add an `equipment` array to the profile". It does
not. Equipment is not a standing property of the athlete — it is a property of
the room he is standing in this morning, and the sled that was free last Tuesday
is occupied today. So the constraint is per-session and lives on the session
record as `excludeEquipment`, the control is derived from the session in hand
rather than from a catalogue, and the profile is untouched. This also keeps
spec §8's "venue is an output — generate first, swap second" intact: the athlete
is asked what is missing only *after* he has a session to look at.

The filter line in `eligibleFor` was as small as predicted. What it cost was
everything downstream of an empty slot: tier relaxation (§4.2 of the equipment
design), the day-type fallback (§4.3), and a card that says when a movement was
substituted.

## 10. Sourcing status

Consistent with the rest of the project, numbers carry their status.

**Already sourced and reused unchanged:** `MOBILITY_DOSE.DYNAMIC_DRILLS`
`[corroborated]`; `PLYO_CONTACTS_PER_SESSION` and `PLYO_TRANSITION_WEEKLY_CAP`
`[corroborated]`; `SPRINT.METERS_PER_SESSION`, `WORK_REST_RATIO` and
`RECOVERY_HOURS`; `CNS_DECAY` and `CNS_VETO_THRESHOLD`.

**Sourced below.** Athlete context driving these choices throughout: a
retired college football athlete, returning after a long inactive period,
training 1-3x/week irregularly — not a competitive endurance athlete. Values
lean conservative accordingly.

| Constant | Value | Tag | Source |
|---|---|---|---|
| `PREP_INTEGRATE_COUNT` | 2 (easy run, intervals); 3 (sprint, plyometric) | `[unverified]` | No literature pins a stage-3 movement count. Scales qualitatively with session CNS demand, same judgement call as the core-count line at `js/rules.js:267`. The RAMP warm-up protocol (Jeffreys) sources the four-stage *structure* (design §10 note above), not this count. |
| `PREP_POTENTIATE_COUNT` | 0 (easy run); 2 (interval); 3-4 (sprint); 2-3 (plyometric) | `[unverified]` | Same reasoning — count scales with day-type intensity by design judgement, not a sourced figure. Easy run's 0 follows directly from design §5.1: build-ups before a conversational run defeat the point of an easy day. |
| `BUILDUP_PCT_INTERVAL` | ~80% effort | `[unverified]` | Young, Duthie, James, Talpey, Benton & Kilfoyle, "Gradual vs. Maximal Acceleration: Their Influence on the Prescription of Maximal Speed Sprinting in Team Sport Athletes," *Sports* 2018, PMC6162480, establishes staged sub-maximal running efforts as legitimate warm-up practice, testing discrete 60%/75%/90% stages (mean actual speed ~78% and ~89% respectively — prescribed and achieved diverge). It does not test 80% itself. Runners Connect (J. Gaudette) independently recommends ~90% effort for running strides — a different, adjacent figure, not a second source agreeing on 80%. No source pins 80%; chosen as a sub-maximal target sitting between the paper's tested 75% and 90% stages, appropriate for a lower-CNS interval-day prep stage below the near-maximal target reserved for sprint day. Prescribed as effort, not pace, per the terrain-agnostic constraint (design §5, spec 9.1). |
| `BUILDUP_PCT_SPRINT` | ~95% effort | `[unverified]` | Same paper (PMC6162480) tests discrete 60%/75%/90% stages only (individual max observed speed at the 90% stage reached 97% of true maximum). It contains no ≥95% threshold and no "true sprint" definition — a prior draft of this table wrongly attached that detail to this citation; it has been removed. 95% is this project's own choice: one step above the paper's highest tested stage (90%), used as the final progression rung before the maximal sprint reps in the sprint-day template (design §6.3). Reasoned extrapolation from the paper's demonstrated progression, not a figure the paper itself states. |
| `INTERVAL_WORK_SEC` | 60-90 s | `[corroborated]` | Multiple independent secondary sources on running-interval and HIIT prescription converge on 60-90 s as a standard hard-effort bout duration. No single named position stand pins this exact range, hence corroborated rather than verified. Seconds, not metres — required by the terrain-agnostic constraint (design §5). |
| `INTERVAL_REST_RATIO` | 1-2x work duration (work:rest 1:1 to 1:2) | `[corroborated]` | Same interval-training sources: 1:1 is the common baseline for aerobic-interval recovery, extending toward 1:2 for harder or longer reps. Mirrors the existing `SPRINT.WORK_REST_RATIO` house style (`js/rules.js:177`). |
| `CHRONIC_WINDOW_DAYS` | 28 | `[corroborated]` | The acute:chronic workload ratio literature (Gabbett 2016, *Br J Sports Med*, "The training-injury prevention paradox"; Hulin et al. 2016) standardizes on a rolling 7-day acute / 28-day chronic pairing. Read via secondary sources agreeing on this figure, not the primary papers directly, hence corroborated not verified. Borrowed as a *window length* only — this app's chronic term is a boost on session selection, not an injury-risk ratio, so only the window duration is imported, none of ACWR's risk thresholds. |
| `GYM_SHARE_TRIGGER` | 0.70 (70% of chronic load from gym day types) | `[unverified]` | No source sets a gym-share fraction for anything resembling this term — a modality split of workload does not appear in the ACWR literature, which totals load regardless of source. Chosen conservatively high so one heavy lifting week does not fire the boost; only a sustained lifting-dominated block does, appropriate given 1-3x/week irregular attendance where the share swings on its own week to week. |
| `WEEKS_TRIGGER` | 4 | `[unverified]` | Bell, Nolan, Immonen, Helms, Dallamore, Wolf & Androulakis Korakakis, "You can't shoot another bullet until you've reloaded the gun": Coaches' perceptions, practices and experiences of deloading in strength and physique sports, published online December 2022, PMC9811819 — surveyed 18 strength/physique coaches, reports deloads "programmed every 4 to 6 weeks." Rogerson, Nolan, Androulakis Korakakis, Immonen, Wolf & Bell, "Deloading Practices in Strength and Physique Sports: A Cross-sectional Survey," *Sports Medicine – Open* 2024, PMC10948666 — surveyed 246 competitive athletes, reports deloading undertaken "every 5.6 ± 2.3 weeks." Not corroboration: the two papers share five of roughly seven author names and are the same research group's coach-survey and athlete-survey follow-on, not an independent replication — and they sample different populations (coaches vs. athletes), which the two attempts at a `[corroborated]` tag on this row wrongly elided. Downgraded to `[unverified]` accordingly. Cited here for practice context only: 4 sits at the low end of what both report (4-6 weeks; 5.6 ± 2.3 weeks), chosen conservatively for a returning athlete training 1-3x/week, and independently fixed by design §7.4's own worked scenario ("Four weeks of lifting" crosses the threshold). Borrowed by analogy only: this literature governs when a *lifter* should deload, not when running should be boosted (design §7.2). |
| `CHRONIC_BOOST_MAX` | 1.5 (chronicBoost caps at 1.5x) | `[unverified]` | No source for a boost magnitude exists — the term itself is this app's invention (design §7.2), not a published construct. Capped modestly so the boost-never-veto rule (design §7.3.1) holds: even at the cap, `min(daysSince, 21)` from raw neglect can still dominate the score for a badly-neglected day type. |

The four-stage prep structure itself is standard practice (the RAMP protocol —
Raise, Activate/mobilise, Potentiate — Jeffreys) and needs no numeric
sourcing; only the counts and percentages above did.

## 11. Known limitations

### 11.0 The running main-work pools do not meet VARIETY — open decision

Measured after task 9 (`docs/coverage-matrix.md`). No pool fails its FLOOR;
every running pool is FLOOR_EXEMPT and correctly so. What they miss is
VARIETY, which asks for `SESSIONS_BEFORE_REPEAT` (16) × the slot's draw:

Restated 2026-08-27 after the `interval`/`tempo` split (§4.5), which turned
one short pool into two and made it **eight**, not seven:

| Pool | have | need | short |
|---|---|---|---|
| `secondary+accessory :: sprint :: sprint :: submaximal` | 1 | 16 | 15 |
| `primary+secondary+accessory :: run/erg :: interval` | 2 | 16 | 14 |
| `secondary :: sprint :: sprint :: maximal` | 2 | 16 | 14 |
| `primary+secondary+accessory :: run/erg :: tempo` | 3 | 16 | 13 |
| `primary :: sprint :: sprint :: maximal` | 3 | 16 | 13 |
| `secondary+accessory :: jump :: (any)` | 3 | 16 | 13 |
| `primary :: jump :: (any)` | 6 | 16 | 10 |
| `primary+secondary :: jump :: (any)` | 8 | 16 | 8 |

Raw shortfall across all pools rose from 18 to 87 when the running templates
landed, and to 100 with the split. `primary :: hinge/pull-h :: power` sits
just outside this list at 13/16 — short 3, and the one genuinely closeable by
authoring rather than by exemption.

The split did not make the app worse. It moved a defect out of the
prescriptions and into the counter, where it is visible.

Two ways out, and they are not equivalent:

1. **Author the entries.** Roughly 60 new sprint, jump and interval variants.
   The library has 8 sprint entries and 17 jumps *because those are the
   movements*, so most of the 60 would be padding — a "sprint variant" invented
   to satisfy a counter is worse than a repeat.
2. **Exempt them from VARIETY**, on the same grounds §3.2 of
   `design-library-expansion.md` already exempts `aerobic-steady`: the rule's
   *premise* fails rather than its conclusion being unwanted. Variety on a
   sprint day comes from distance, rest and effort, not from finding a
   sixteenth way to sprint. Repeating the acceleration sprint every third
   sprint session is what sprint training is.

Option 2 is the recommendation, and it matches the precedent already in the
codebase. It is recorded rather than taken because it widens a rule that
governs every pool in the app, not only these seven, and because
`VARIETY_EXEMPT_MODALITIES` is keyed on `slot.modality` — the jump pools carry
`modality: null`, so the exemption mechanism needs a small redesign before it
can express them. Neither belongs inside the running-programming change.

Until it is settled, the seven pools stay out of `CLOSED_POOLS`: they are
measured and visible in the matrix, and nothing asserts them green.


1. **Chronic load counts proposals, not performance.** This inherits spec §6
   limitation 1: history records what was generated, not what was completed, so
   a skipped-heavy month under-proposes running. The eventual fix is the
   one-tap "did you finish this?" confirmation already contemplated in spec §6.
2. **`warmup-jog` duration is not verifiable on unmeasured ground**, consistent
   with spec 9.1 — it is prescribed as time and effort, which is the point.
3. **No equipment filtering** until §9 lands.

## 12. Migration and test impact

| Change | Scale |
|---|---|
| `pattern` edits in `data/exercises.json` | 35 entries (20 sprint, 15 locomotion — `jump-rope` is one of the 15) |
| `effortClass` added | 8 entries |
| `modalities` cleanup | 3 entries |
| New library entry `warmup-jog` | 1, with cues |
| `js/rules.js` | new pattern names in `SESSION_ORDER` context; new chronic-load constants |
| `js/templates.js` | 4 new templates, `PREP_BLOCK.running` |
| `js/generator.js` | `joints` filter, `mode: 'interval'`, metreage check, `orderClass`, `chronicBoost`, 3 state fields |
| `js/ui.js` | `interval` branches in `loadLine` and `volumeLine` |
| `tests/cue-guard.mjs:18` | hardcoded `'sprint'` — add `sprint-drill`, `agility`, `run`, `erg`, `march` |
| `docs/coverage-matrix.md` | regenerated |

Coverage tests derive their pools from the templates and follow automatically.
No cue and no coefficient changes.
