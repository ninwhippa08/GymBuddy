# Design — mobility dosing, warm-up ramps, and where the exercise count comes from

**Date:** 2026-08-21
**Status:** proposed, revision 2 — awaiting review
**Supersedes:** `programming-basis.md` §9 (time budget), `templates.js`
`MOBILITY_CORE_BLOCK` and `TEMPLATES`, `generator.js` `buildMobilityCore`,
`prescribe`, `packToBudget` and `SESSION_ORDER`

**Revision 2** replaced two constants that revision 1 invented: a fixed
three-set warm-up ladder (now a function of load and technical demand, §4.3)
and a purely time-driven exercise count (now coverage-driven and time-bounded,
§4.4). It also widened §2.3 beyond a single training tradition and added §4.5 on
new day types. Both corrections came from the user, who caught the same class of
error the document was written to fix.

This document exists because the user used the app in a gym and brought back
three complaints. All three were correct, and checking them surfaced a fourth
problem neither of us was looking for. The provenance vocabulary is the one
already used in `programming-basis.md`: `[verified]` read in a primary source,
`[corroborated]` consistent across independent secondary sources,
`[unverified]` single source or practitioner claim.

---

## 1. What was wrong

**1.1 The mobility block prescribed ~3 minutes per movement.** Nobody chose
that number. `generator.js` `buildMobilityCore` computes
`between(rng, group.durationMin) / n` — a block budget divided by however many
movements the fill step happened to pick. It is an artifact of a division, not
a dose.

**1.2 Everything in the block was time-dosed.** Both slots carry
`mode: 'time'`, so a dynamic drill and a static stretch are prescribed
identically.

**1.3 The library cannot tell them apart.** `couch-stretch` (a static hold) and
`ninety-ninety-hip-switch` (a dynamic drill) carry byte-identical fields in
`exercises.json` — same `pattern`, same `tier`, same `modalities: ["mobility"]`.
No generator change alone can fix 1.2, because the data does not encode the
distinction.

**1.4 All mobility runs after the main work.** `SESSION_ORDER` in `rules.js`
ends with `mobility`, and `orderClass()` maps mobility, core and rotate into
that one class. Every dynamic drill therefore happens after the lifting is
finished. This was found while checking 1.2 and is the most consequential of
the four.

**1.5 Loaded exercises had no warm-up sets.** `prescribe()` returns scalar
`sets`, `reps` and one `displayMultiplier`, so every set of an exercise carries
identical load and there is no ramp into it.

Note the internal inconsistency this reveals: spec §234 already prescribes a
progressive warm-up ramp for sprint work — "build to 90% over 4–6 runs." The
app therefore already accepts the principle. It was applied to running and
never to the barbell.

**1.6 The exercise count per day type was unsourced.** Four slots on
max-strength and power, five on hypertrophy, two on aerobic-steady. No section
of `programming-basis.md` justifies these; the comment in `templates.js` cites
spec §4.3, which is this project citing itself.

---

## 2. What the sources say

### 2.1 Mobility dosing splits by movement type

| Type | Dose | Provenance |
|---|---|---|
| Dynamic drill | ~10–12 reps per drill | `[corroborated]` |
| Static stretch | 10–30 s hold, 2–4 reps per muscle group | `[corroborated]` — ACSM |
| Core | sets and reps; isometric holds by time | `[corroborated]` |

ACSM's flexibility guidance is 10–30 s per hold for most adults (30–60 s for
older adults), 2–4 repetitions per muscle group, 2–3 days per week. The total
static dose for an entire muscle group is therefore **20–120 seconds** — the
current 3 minutes on a single movement is 1.5–9× the sourced figure.

Dynamic volume is not simply "more is better": three sets of dynamic stretching
induced acute fatigue and impaired sprint performance within five minutes of the
warm-up. `[corroborated]` This is why the drill count stays at 3–4 and the reps
at 10–12 rather than scaling with available time.

### 2.2 Static before explosive work is harmful; dynamic is not

Static stretching impairs subsequent explosive performance, with one source
claiming a detriment lasting up to 24 hours. `[unverified]` on the 24-hour
figure specifically — it comes from a secondary summary. That static stretching
acutely impairs power output, and that dynamic stretching outperforms it as
pre-session preparation, is `[corroborated]` across several independent sources
including a repeated-sprint trial in elite footballers.

The practical consequence: **dynamic drills belong before the main work, static
stretches after it.** The app currently puts both after.

### 2.3 The warm-up ramp is a function of the load, not a fixed ladder

An earlier draft of this document prescribed a fixed three-set ladder for every
primary lift. That was wrong, and wrong in the same way as the slot counts in
§1.6 — a constant invented and then presented as a design. The sources are
explicit that the ramp scales.

**The number of warm-up sets scales with the working load.** "The heavier the
weight being lifted for a given exercise, the more warm up sets you'll typically
need. The opposite is true as well — the lighter the weight, the less warming up
you'll need." Typical range 2–5. `[corroborated]` A light day should get a short
ramp or none at all; a heavy single needs many small jumps.

**Reps per warm-up set are load-dependent, not fixed.** Any warm-up set above
75% should be a single or a double; at 90% and above the work is primarily
singles. `[corroborated]` A fixed 8/5/2 is therefore wrong at both ends.

**Traditions differ, and the difference is the movement, not the author.**
Olympic weightlifting warm-ups use more low-load technical repetition — 2–3 sets
of 3–5 reps at 25–50% of 1RM — because the binding constraint on a snatch is
technique, not tissue readiness. `[corroborated]` Powerlifting and general
strength ramps take fewer, larger jumps toward the working load; a worked
example for an 80% working set is bar → 30% → 50% → 65% → 75%. `[corroborated]`
Both are correct for their movements. A generator that applies one to the other
is doing the same thing that produced discrepancy 3.

**Do not stop light.** A controlled trial on squat and bench press found that
"warming-up with few repetitions and low loads is not enough to optimize squat
and bench press performances." `[verified]` For the squat a single
higher-intensity set at 80% of training load outperformed a light one; for bench
press a progressive two-set ramp performed best. A separate trial found no
volume-load advantage to elaborate potentiation protocols over an ordinary
progressive warm-up, and recommended the ordinary one as the practical choice.
`[verified]`

**Design reading:** the ramp is computed, not tabulated. Its inputs are the
working load, the movement's technical demand, and the exercise's own max — and
it must fall to zero on light work. §4.3 specifies the function.

### 2.4 There is no sourced exercise count for athletes

NSCA program design is needs-based and prioritised: core exercises are selected
first and ordered power → other core → assistance, with assistance work fitted
in as time and recovery allow. No total count is prescribed. `[corroborated]`

The widely-quoted **8–10 exercises per session** figure is general-population
health guidance — whole-body, 2–3 sets, aimed at untrained and older adults.
`[corroborated]` It does not transfer to a max-strength day for a returning
athlete. Applying it here would repeat discrepancy 3, where two traditions'
numbers were collapsed into one.

The ACSM 2026 position stand — their first revision in 17 years — declines to
name an exercise count and explicitly separates general adults from athletes
requiring sport-specific programming. `[verified]`

**But time is not the only constraint, and treating it as the only one was a
second mistake in the earlier draft.** The sourced quantity in resistance
training is not exercises per session — it is **volume per muscle group per
week**. The ACSM 2026 stand names ~10 sets per muscle group per week for
hypertrophy, and 2–3 sets per exercise at ≥80% 1RM for strength. `[verified]`
Muscle groups are trained "at least twice a week." `[verified]`

That reframes the question. A session's job is to pay down the outstanding
weekly volume for the muscle groups it targets. A day covering four movement
patterns needs more exercises than a day covering two, regardless of how long
either lasts — and a pattern already trained twice this week needs fewer.

**Design reading:** the count is bounded above by time and driven from below by
pattern coverage and outstanding weekly volume. Neither alone. This is the same
shape as the decision already made for venue: an output, not an input.

---

## 3. Discrepancies

Continuing the numbering in `programming-basis.md`, which ends at 3.

**Discrepancy 4 — the mobility block was time-dosed throughout.** Static
stretching is legitimately dosed by time; dynamic drills are dosed by
repetitions and are actively harmed by excess volume. Prescribing both by
duration meant the dynamic drills were wrong in unit, not merely in amount.
Resolved by splitting the modality (§4.1).

**Discrepancy 5 — the ~25 minute mobility budget has no source.** Every other
number in `programming-basis.md` carries a section reference and a provenance
tag. §9 is a bare bullet list. Re-derived from per-movement doses in §5 below,
which lands at 11–15 minutes. The 25-minute figure is withdrawn.

**Discrepancy 6 — dynamic preparation was scheduled after the work it was
meant to prepare for.** `SESSION_ORDER` places all mobility last. The
interference reasoning behind that ordering (basis §6) applies to static
stretching and conditioning, not to dynamic drills. Resolved by splitting the
block in two (§4.2).

---

## 4. Design

### 4.1 Split the mobility modality

`exercises.json` gains no new field. Instead the existing `modalities`
vocabulary is split:

- `mobility-dynamic` — drills that move through a range under control
- `mobility-static` — held positions

Chosen over a separate `dosing: "hold" | "reps"` field because templates already
filter on `modality`, `templates.js` already validates modality names at import
time, and one source of truth cannot contradict itself. Dosing follows from the
modality rather than being independently stated.

The 19 `pattern: "mobility"` entries are hand-tagged. Self-myofascial work
(`thoracic-foam-roll`) is tagged `mobility-static`: it is dosed by time and
carries the same pre-explosive caution.

**Migration note:** `mobility` as a modality value disappears. The import-time
sanity guard in `templates.js` will fail loudly if any template still names it,
which is the intended behaviour — a silent fallback would hide a half-done
migration.

### 4.2 Two blocks, not one

| Block | Position | Contents | Dose | Est. |
|---|---|---|---|---|
| **Prep** | before main work | 3–4 `mobility-dynamic` | 10–12 reps each | ~3 min |
| **Cool-down** | after main work | 3–4 `mobility-static` | 30 s hold × 2 reps | ~5 min |
| | | 2 core | 3 sets × 10–15 reps | ~7 min |

`SESSION_ORDER` gains a `prep` class at the front. `orderClass()` stops lumping
mobility, core and rotate together: `mobility-dynamic` maps to `prep`,
everything else in the old class stays at `mobility`.

Movements already carrying `unilateral: true` in the library (`couch-stretch`,
`kneeling-hip-flexor-stretch`) are dosed per side, doubling their cost. The
~5 min estimate assumes roughly half the selected stretches are unilateral.

Both blocks keep `optional: false`. The block is never randomised out — that
decision from spec §9 stands, and the prep block is now the more important half.

### 4.3 Warm-up ramps on loaded compounds — BUILT 2026-08-31, `sw.js` v15

`prescribe()` stops returning scalar `sets`/`reps`/`pct` and returns a per-set
array:

```js
// Back squat, prCoef 1.0, working load 0.80 of its own max, 3 x 5.
// The four warm-up steps were computed, not looked up -- see below.
block.setPlan = [
  { kind: 'warmup', reps: 8, pct: 0.30, displayMultiplier: 0.30 },
  { kind: 'warmup', reps: 8, pct: 0.43, displayMultiplier: 0.43 },
  { kind: 'warmup', reps: 5, pct: 0.55, displayMultiplier: 0.55 },
  { kind: 'warmup', reps: 3, pct: 0.68, displayMultiplier: 0.68 },
  { kind: 'work',   reps: 5, pct: 0.80, displayMultiplier: 0.80 },
  { kind: 'work',   reps: 5, pct: 0.80, displayMultiplier: 0.80 },
  { kind: 'work',   reps: 5, pct: 0.80, displayMultiplier: 0.80 }
]
```

The ramp is **generated by a function, not read from a table.** No fixed
percentage ladder appears anywhere in the code.

```js
// buildWarmup(workingPct, exercise) -> array of warm-up steps
//
// workingPct is a fraction of THIS movement's own max, already clamped by
// env.pctCeiling. Warm-ups are bridges from a light start up to that load.
```

**Step count falls out of the gap, so it scales with the load automatically.**
Steps climb from `WARMUP.START` (0.30 of the movement's max) to the working
load, with no jump larger than `WARMUP.MAX_JUMP` (0.15). The count is
`ceil((workingPct - WARMUP.START) / WARMUP.MAX_JUMP)`:

| Working load | Warm-up steps | Ramp |
|---|---|---|
| 0.90 | 4 | 0.30, 0.45, 0.60, 0.75 |
| 0.80 | 4 | 0.30, 0.43, 0.55, 0.68 |
| 0.65 | 3 | 0.30, 0.42, 0.53 |
| 0.55 | 2 | 0.30, 0.43 |
| below `WARMUP.FLOOR` (0.50) | 0 | none |

This table's own `0.90` row originally read `5 | 0.30, 0.42, 0.54, 0.66, 0.78`,
which disagrees with the formula this same section states —
`ceil((workingPct - WARMUP.START) / WARMUP.MAX_JUMP)` — and gives 4, not 5, at
0.90. The formula won; the row above is corrected. (The naive JS subtraction
`0.90 - 0.30` is `0.6000000000000001`, which would round the count up to 5 by
float slop alone if the implementation didn't guard for it — see the "as
built" note below.)

This reproduces the worked example in §2.3 (bar → 30 → 50 → 65 → 75 for an 80%
set) without encoding it, and it satisfies the scaling principle directly:
heavier working loads produce more sets because the gap to bridge is longer.
Light work gets nothing, which is what the sources say and what a rest day
should feel like.

**Reps per step are a function of that step's load**, per the 75% and 90%
thresholds in §2.3:

| Step load | Reps |
|---|---|
| ≥ 0.90 | 1 |
| 0.75 – 0.90 | 2 |
| 0.60 – 0.75 | 3 |
| 0.45 – 0.60 | 5 |
| < 0.45 | 8 |

**Technical demand adjusts the shape, not just the length.** The library already
carries `technical: 1 | 2 | 3` on every exercise — no new field is needed.
Movements at `technical: 3` (Olympic derivatives) gain one extra low-load
technique set at `WARMUP.START` and cap all warm-up reps at 3, following the
weightlifting tradition in §2.3: repetition at light load, never eight reps of a
snatch. Movements at `technical: 1` take the plain progression.

Ramps apply to any `mode: 'load'` exercise whose computed `workingPct` clears
`WARMUP.FLOOR`. **Tier is no longer consulted** — an accessory prescribed heavy
gets a ramp, and a primary lift prescribed light does not. `mode: 'reps'`,
`'contacts'` and `'time'` never receive one.

**Emergent property worth stating.** During the return ramp `env.pctCeiling` is
0.65, so no working load can exceed it, so no ramp exceeds **three steps — or
four for a `technical: 3` lift**, which gains one extra technique set at
`WARMUP.START` on top of the computed rungs. `ceil((0.65 - 0.30) / 0.15)` is 3;
the `unshift` in `buildWarmup()` makes it 4 for the Olympic derivatives.
(Corrected: this section originally said three and overlooked its own technical
rule. Verified against `buildWarmup()` over every working load from 0.30 to
0.65 — the maximum is 3 plain and 4 technical. `tests/ramp.test.mjs`'s "the
return ramp shortens the ladder on its own" caps at exactly that.) A returning
athlete automatically gets short ramps because his loads are light, and they
lengthen on their own as the ceiling rises. Nothing special-cases the ramp
weeks.

Rejected: making the working sets themselves climb. A 2023 review of 15 studies
found pyramid training produces results similar to straight sets — the
difference is structure, not effectiveness `[corroborated]` — and one
NSCA-attributed finding reports ascending pyramids underperforming reverse
pyramids because the lifter reaches the heaviest work already fatigued
`[unverified]`. The user's original description was an ascending pyramid. The
gap he correctly identified is the absence of a ramp *into* the work, not a
need for variation *within* it.

**Warm-up sets are not training volume.** They must be excluded from
`patternSets`, `cnsLoad` and `footContacts`. The neglect model and the CNS
account read those, and counting warm-ups would inflate both.

**Ramp ceiling interaction.** `env.pctCeiling` continues to clamp the working
load, and both clamps described in spec §10 item 4 stay exactly as they are.
Warm-ups are computed as a fraction of the already-clamped working load, so they
are bounded automatically and cannot exceed the ceiling. No new clamp is needed
and none should be added.

**Deviations from this section, found during the build (plan-05's "Four
decisions").**

1. **`block.sets`/`reps` keep meaning the WORKING sets.** This section said
   `prescribe()` stops returning scalar `sets`/`reps`/`pct`; taken literally
   that breaks `finalise`, `packToBudget`, `estimateMinutes`, `volumeLine` and
   four test files, and would start counting warm-ups as training volume,
   which this section itself forbids two paragraphs above. `setPlan` is
   additive instead.
2. **Warm-up `displayMultiplier` is scaled in DISPLAY space**, as
   `workingDisplay × (stepPct / workingPct)` — not recomputed as
   `stepPct × prCoef`. This section's "no clamp is needed" holds only at
   `prCoef` 1.00. `prescribe` clamps twice, and a recomputed warm-up can print
   heavier than a clamped working set (snatch pull, `prCoef` 1.15, ramp week
   1).
3. **This section's own 0.90 table row contradicted this section's own
   formula; the formula won.** See the correction above.
4. **`TIME.WARMUP_REST_SEC = 60` is `[unverified]`.** This section specifies
   the ladder but no rest for it, and no source was found. It is deliberately
   shorter than `DEFAULT_REST_SEC` (120) because a warm-up set is not taken
   near failure.

**As built, five things this section did not say.** (1) **The ramp does NOT
lengthen sessions — it displaces working sets, and only once the return ceiling
has lifted.** This section and the plan both assumed warm-ups would push
sessions longer and that the session ceiling would have to rise. Measured, they
do not: the observed maximum stays at 65 min either way, and `packToBudget`
pays for the warm-up minutes by shaving working sets instead. No test caught
this, because the 65-minute ceiling holds in both cases.

*Per day type, at full volume.* 3,000 seeds per day type across
`PHASE_1_DAY_TYPES`, `now: 1e12` and **no profile** — so `rampWeekFor` returns
the last ramp row and nothing is volume-limited. Total working sets are
`Σ Object.values(session.patternSets)`; "before" is the pre-ramp tree at
`a42edae`, "after" is this branch as shipped.

| day type | working sets before → after | Δ | avg session min |
|---|---|---|---|
| max-strength | 37,068 → 27,934 | **−24.6%** | 58.2 → 59.4 |
| power | 51,525 → 45,714 | −11.3% | 57.2 → 58.3 |
| hypertrophy | 44,679 → 39,701 | −11.1% | 55.9 → 57.8 |
| aerobic-steady, interval, sprint, plyometric | unchanged | 0% | unchanged |
| all seven | 213,998 → 194,075 | −9.3% | 51.8 → 52.4 |

The loss falls **entirely** on the three lifting day types — the four that
never attach a ramp lose nothing — and on the heaviest of them it is close to a
quarter of the working sets. The single 9.3% figure this note used to carry is
that concentrated loss averaged over seven day types, four of which are
untouched; it understates a max-strength day by a factor of about two and a
half, and it is not a number to make a decision from.

*By return-ramp week, lifting days only.* 1,500 seeds per day type on
max-strength, power and hypertrophy, `now: 1e12`, with a `profile.returnDate`
placed to land `rampWeekFor` on each week.

| ramp week | working sets before → after | Δ | avg session min |
|---|---|---|---|
| 1 | 41,809 → 41,803 | −0.01% | 44.0 → 49.8 |
| 2 | 49,081 → 48,619 | −0.9% | 48.4 → 53.8 |
| 3 | 53,556 → 51,093 | −4.6% | 50.5 → 55.9 |
| 5+ (steady state) | 66,629 → 56,559 | −15.1% | 57.1 → 58.5 |

**In the early return weeks the ramp is essentially free, exactly as this
section predicted.** `volumeMultiplier` has already cut the sets to 50/70/80%,
so the session sits well under `MAIN_WORK_MAX_MIN` and there is headroom for
the warm-up minutes to land in: week 1 adds about six minutes of ramp and
loses six working sets out of 41,809. The ramp is purely additive there. The
displacement
appears only as the return ceiling lifts and sessions fill the budget again —
4.6% by week 3, 15.1% at steady state. **That is where the athlete is now: in
the return weeks, paying nothing. The bill arrives at week 5.**

**This must be answered before §4.4 is BUILT, not merely before it ships.**
§4.4 derives the exercise count as a residual from `patternSets` coverage debt.
This branch biases that signal down by about a quarter on lifting days, so
§4.4 would read the deflated counts as unmet debt and push the exercise count
UP — spending more of a budget that is already being paid for by shaving sets,
which shaves more sets, which deepens the apparent debt. That is a feedback
loop, not a static offset, and it cannot be corrected afterwards by adjusting a
constant.

**Not decided here.** Making the ramp additive would mean raising
`MAIN_WORK_MAX_MIN`, or exempting warm-up time from the trim budget, or
deciding that the displacement is the right trade — trading the fifth working
set for a safer entry into the fourth is a defensible answer, not obviously a
wrong one. None of that was in plan-05's scope and none of it is settled here.
Open question for the athlete — see §8 item 9. (2) **The constant block is
`WARMUP`, not `RAMP`.** `js/rules.js` already exported `RAMP` — the
return-to-training week table — so this section's chosen name would have been a
duplicate export and a `SyntaxError`. The builder is `buildWarmup()` and its
local in `prescribe` is `ladder`, for the same reason one level down:
`generator.js` says `ramp` for the return-to-training row (`rampRow`,
`state.rampWeek`, `block.rampLimited`), and the warm-up ladder must not share
that word. (3) **The step count needs a float-slop guard.**
`ceil((0.90 - 0.30) / 0.15)` evaluates to 5, not 4, because `0.90 - 0.30` is
`0.6000000000000001` in IEEE-754 — which would have silently reproduced the
very table row corrected above. The code uses
`Math.ceil(gap / WARMUP.MAX_JUMP - 1e-9)`. (4) **`packToBudget` had to learn
about `setPlan` one task earlier than planned.** It shaves `block.sets` after
`prescribe` has already built the plan; without a matching splice the plan
overstated the working sets. Warm-up rungs are never shaved — only `'work'`
entries — because the ramp is the safety feature. That has a consequence the
plan did not anticipate: with the rungs untouchable, a ramped block under
budget pressure keeps losing working sets until it is all ramp and no work.
The shave loop's floor was one set, which produced 136 blocks over a
21,000-session sweep prescribing a single working set behind four to six
warm-ups (worst: max-strength/seed 34, `pause-squat` at 1 × 6 @ 0.71 behind
five rungs). **A ramped block now floors at two working sets** —
`b.sets > (b.setPlan ? 2 : 1)` — which is the point at which the ramp still
buys something. Re-swept: none left, and no session that fitted the budget
before goes over it now.

(5) **The card collapses a repeated rung** — found by the final review of this
branch. Consecutive rungs that would print identically become a set count:
`2 × 3 × 0.30` rather than `3 × 0.30  ·  3 × 0.30`. A
`technical: 3` lift's extra technique set sits *at* `WARMUP.START` alongside
rung 0, so its first two rungs are always identical: 46.2% of ramped cards
(24,355 measured) printed the same number twice and read as a typo, and the
worst-case line ran to 82 characters, which wraps mid-step on the phone. The
collapse is a value comparison, not a `technical === 3` special case; worst
case is now 73 characters.

### 4.4 The exercise count becomes a residual

`TEMPLATES` stays a list, but becomes **longer than will fit** and is consumed
in priority order — NSCA's power → other core → assistance. Two constraints
decide where the walk stops, and both must be consulted.

**Constraint 1 — coverage (drives the count up).** Each day type declares the
movement patterns it targets. The FILL step keeps taking slots until every
targeted pattern has been trained at least once and no targeted pattern is
still carrying weekly volume debt.

The debt data already exists. `generator.js` maintains rolling `patternSets`
counts for the neglect model, which spec §10 records as already built and
working. This design reads those same counts for a second purpose rather than
introducing a parallel tracker: a pattern well below its weekly share pulls an
extra slot in, a pattern already at its share does not.

So a day targeting squat, hinge, push and pull gets four slots minimum on
coverage grounds alone, before time is considered — and a day targeting two
patterns gets two, even with an hour spare. **This is the part that answers the
"only four moves" complaint properly.** The count now responds to what is being
trained, not just to the clock.

**Constraint 2 — time (bounds the count above).** Coverage proposes; the
main-work budget disposes. Where the two conflict, time wins and the session is
flagged, because a session that does not fit is not a session.

**When they conflict, drop by neglect, not by position.** `packToBudget()`
currently drops `optional` blocks last-first. It should instead drop the slot
whose pattern carries the *least* outstanding debt, so the work that survives is
the work most overdue. The existing `overBudget` warning stays.

Worked outcome: a max-strength day might list seven candidate slots, deliver
four at 60 minutes with two heavy ramps, five at 60 minutes when the ramps are
short because the return ceiling is still low, and six or seven at 80 minutes.
No number is written down anywhere.

The machinery is half-built: `packToBudget()` already trims to a budget and
already understands `optional`. The changes are that filling becomes
coverage-driven rather than fixed, and trimming becomes debt-ordered rather than
position-ordered.

### 4.5 More kinds of session

The user asked for the generator to suggest more types of workout. Four of the
nine day types in spec §5 exist: `max-strength`, `power`, `hypertrophy`,
`aerobic-steady`. The five that do not — `plyometric`, `sprint`, `isolation`,
`interval`, `mobility` — are filed under Phase 2 in spec §8.

Two observations move them up rather than leaving them where they are.

**The library already supports most of them.** `exercises.json` covers all 15
movement patterns, and the modality pools for plyometric, sprint and isolation
work already exist — they are what the current templates filter *past*. Spec §10
notes the thinnest pools are `rotate` 4, `throw` 5, `carry` 6, `pull-v` 7,
`lunge` 9, which is thin for a dedicated day but adequate for slots inside one.

**Variety is currently bottlenecked at the wrong layer.** Spec §4.3 says variety
comes from exercise choice within a slot rather than from many templates. With
four day types and a fixed slot count, a reroll changes *which* exercises appear
but rarely what kind of session it is — which is exactly the complaint that
opened this document. Adding day types attacks the cause; adding slots does not.

`ARCHITECTURES` in `templates.js` already declares which architectures each day
type permits (EMOM, cluster, complex, circuit, ladder). Those stay Phase 3 and
out of scope here: `prescribe()` only knows straight sets, spec §10 calls this
the deepest change in the project, and `setPlan` is deliberately not shaped for
it yet. **Day types first, architectures later** — day types reuse the existing
prescription machinery, architectures replace it.

Scope for this document: `isolation` and `plyometric`, the two whose pools are
deepest and which need no new prescription shape. `sprint` and `interval` want
distance and work/rest structures that `setPlan` does not currently express;
`mobility` as a standalone day becomes nearly free once §4.1 and §4.2 land, and
should follow immediately after.

### 4.6 Implementation order

The three changes are independent in code but coupled through the time budget,
so mobility goes first — it is what frees the minutes the ramps spend.

1. **Mobility split** (§4.1, §4.2) — **SHIPPED 2026-08-24.** Data tagging, then
   `buildPrep` and `buildCooldown` (the single `buildMobilityCore` named here
   split in two along with the block itself), then `SESSION_ORDER` and
   `orderClass`. Self-contained; ships and is testable on its own. Frees ~13 min.
2. **Warm-up ramps** (§4.3) — `buildWarmup()`, `prescribe()` returns `setPlan`,
   `ui.js` renders it, volume accounting excludes warm-ups. Spends a variable
   share of the freed minutes: nothing on light days, more as the return ceiling
   rises. Touches the widest surface — generator, UI, history model.
3. **Count from coverage and time** (§4.4) — the FILL and PACK changes, reading
   the existing `patternSets` counts. Third because it is worth nothing until 1
   and 2 have settled the budget it reads.
4. **New day types** (§4.5) — `isolation` and `plyometric` first, `mobility`
   after §4.1 lands. Last because each new day type must declare its targeted
   patterns for step 3's coverage rule, so step 3 must exist first.

**Status, 2026-08-31: steps 1 and 2 are shipped (2026-08-24, 2026-08-31 /
`sw.js` v15). Steps 3 and 4 are unstarted.**
Step 3 (count from coverage and time, §4.4) is the resume point, and it stays
blocked on **two** open questions. Question 6 — the pattern-level weekly volume
figure needs sourcing before §4.4 can ship at all. Question 9 — the ramp now
biases `patternSets` down ~25% on lifting days, which is the exact signal
§4.4's coverage rule reads, so it must be answered before §4.4 is *built*, not
merely before it ships.

Every step leaves the app shippable. Steps 1 and 2 change what a session
contains; step 3 changes how many exercises arrive; step 4 changes what kinds of
session can be proposed at all.

---

## 5. Time budget, re-derived

Replaces `programming-basis.md` §9 and `TIME` in `rules.js`.

Per-movement estimates use the existing `SECONDS_PER_REP: 3` and
`TRANSITION_SEC_PER_EXERCISE: 90`.

| Item | Old | New |
|---|---|---|
| Prep block | — | 3 min |
| Main work | 45 min | 45 min |
| Cool-down (static + core) | 25 min | 12 min |
| **Session total** | **70 min** | **60 min** |

The main-work budget is unchanged. The saving comes entirely from dosing the
mobility work correctly, which is what the user predicted.

### 5.1 What 45 minutes actually buys — read this before expecting more exercises

A max-strength exercise at 3 sets × 5 reps with 180 s rest costs
`3 × (5 × 3 s) + 3 × 180 s + 90 s transition` ≈ **11 min**. A three-set ramp adds
about **4 min**. A worked example at 45 minutes:

| Slot | Cost |
|---|---|
| A — heavy compound + ramp | 15 min |
| B — second compound + ramp | 15 min |
| C — accessory, 90 s rest | 6 min |
| D — accessory, 90 s rest | 6 min |
| **Total** | **42 min** |

**On the heaviest day, that is four exercises**, and no algorithm changes it:
180 s rests dominate the budget, rest periods are sourced, and they are not
available to be shortened. A max-strength session at 60 minutes holds about four
movements because that is what the physiology costs.

**But the heaviest day is no longer the only day.** Under §4.3 the ramp scales
with the load and vanishes below `WARMUP.FLOOR`, so the ~4 min per-lift ramp cost
in the table above is the worst case, not the standard one:

| Session | Ramp cost | Rests | Exercises at 60 min |
|---|---|---|---|
| Max-strength, ceiling lifted | ~8 min | 180 s | 4 |
| Max-strength, during return ramp (0.65 cap) | ~5 min | 180 s | 4–5 |
| Hypertrophy | 0–4 min | 90 s | 5–6 |
| Isolation / light day | 0 min | 60–90 s | 6–7 |

Two things produce that spread, and neither existed in the earlier draft: the
ramp is now load-dependent rather than fixed, and §4.4 lets pattern coverage
pull slots in rather than capping at a hardcoded four.

The honest summary: the complaint was that every session showed four movements.
After this work, the heaviest sessions still show about four — correctly, and
now with a warm-up — while lighter sessions show six or seven, and the number
changes because the training changed rather than because a constant was edited.
A longer session remains the only lever that raises the count on a heavy day.

---

## 6. What this does not change

- The ramp and its double clamp (spec §10 item 4, basis §3).
- No stored maxes; everything still displays as `× PR`.
- Venue as an output; no equipment checklist.
- No logging and no confirmation prompt — though the §6.1 "did you finish
  this?" item remains queued and is unaffected by this work.
- Zero dependencies, no build step, plain ES modules.
- Architecture variation (EMOM, cluster, ladder). `setPlan` is deliberately
  shaped only for straight sets with warm-ups. Extending it to other
  architectures stays last, per spec §10.

---

## 7. Testing

The headless sweep is necessary and insufficient — an 800-session sweep passed
clean while two real bugs sat in the code. Both layers are required.

**Headless, across day types × ramp weeks × seeds:**
- no warm-up step exceeds its working load, and steps increase monotonically
- no jump between consecutive steps exceeds `WARMUP.MAX_JUMP`
- warm-up step count is non-decreasing in working load — the scaling property
  from §2.3 asserted directly, not spot-checked
- working loads below `WARMUP.FLOOR` produce an empty ramp
- `technical: 3` movements never receive a warm-up step above 3 reps
- no working load exceeds `env.pctCeiling`, before or after `prCoef`
- warm-ups contribute nothing to `patternSets`, `cnsLoad` or `footContacts`
- every `mobility-dynamic` block sorts before every main-work block, and every
  `mobility-static` block after
- no session exceeds 60 minutes; no main-work block exceeds 45
- every pattern a day type targets appears at least once, unless the session was
  flagged over budget
- when trimming, the surviving slots carry more outstanding debt than the
  dropped ones

**In a real browser, on the live subpath, before believing any of it:**
- the ramp renders legibly and the working sets are visually distinct from
  warm-ups mid-set
- a rep-dosed mobility drill prints reps, not minutes
- `sw.js` `VERSION` bumped by hand — there is still no build step

---

## 8. Open questions

1. The 24-hour figure for static stretching impairing explosive performance is
   `[unverified]`. It does not change the design — dynamic before, static after
   is `[corroborated]` independently — but it should not be quoted as fact.
2. The reverse- vs ascending-pyramid finding is `[unverified]`, from a secondary
   summary of an NSCA article. It is used only to decline a change, not to
   justify one.
3. The CSCCa/NSCA transition paper behind basis §3 remains paywalled. Unchanged
   by this work, still worth reading if university library access appears.
4. Core dosing at 3 sets × 10–15 reps is `[unverified]` as a specific
   prescription. It is the least-sourced number in this document and the first
   thing to revisit.
5. `WARMUP.START` 0.30, `WARMUP.MAX_JUMP` 0.15 and `WARMUP.FLOOR` 0.50 (this
   document originally called the block `RAMP` before the build renamed it to
   `WARMUP` — see §4.3's "as built" note) are `[unverified]` as exact values.
   They are tuned to reproduce the worked example in §2.3 and to satisfy the
   scaling principle, which is a weaker claim than being read from a source.
   The *shape* — steps scale with load, reps fall as load rises, light work
   gets none — is `[corroborated]`. If any number in this document gets
   challenged next, it should be these three.
6. The weekly per-muscle-group volume figure (~10 sets) is `[verified]` for
   hypertrophy specifically. Its transfer to max-strength and power patterns is
   `[unverified]`, and the coverage rule in §4.4 leans on that transfer. A
   pattern-by-pattern weekly share needs sourcing before §4.4 ships.
7. Olympic-derivative warm-up practice (2–3 sets of 3–5 reps at 25–50% 1RM) is
   `[corroborated]` from practitioner sources, not from a trial. It informs the
   `technical: 3` branch in §4.3.
8. **The `mobility-static` pool is thin, and this is the next data job.**
   Seven entries, with `hip` in four of them. A single hurt hip leaves exactly
   three stretches — the sourced floor, with no margin at all — and two hurt
   joints (hip+thoracic, hip+ankle, hip+shoulder, hip+scapula) collapse it to
   one or two. The generator warns rather than shipping a short cool-down
   silently, so this is a thinness problem and not a correctness bug. Widening
   it needs sourced stretches, not invented ones. Deviation 4; measured at
   task 9, 2026-08-24. Note that ruling C1's six recovered warm-up drills are
   all *dynamic* and widen the prep pool instead — they do not help here.
9. **The ramp displaces working volume instead of extending the session, and
   this was never decided on purpose. ANSWER THIS BEFORE §4.4 IS BUILT.** §4.3
   and plan-05 both assumed the ramp would push sessions longer. Measured, it
   does not: `packToBudget` pays for the warm-up minutes by trimming working
   sets, and average session length moves less than a minute.

   *Where the volume goes* (3,000 seeds per day type, `PHASE_1_DAY_TYPES`,
   `now: 1e12`, no profile — full volume, the last ramp row; pre-ramp
   `a42edae` → this branch):
   **max-strength −24.6%** (37,068 → 27,934 working sets), power −11.3%,
   hypertrophy −11.1%, and **0% on aerobic-steady, interval, sprint and
   plyometric**, which never attach a ramp. The 9.3% this entry used to quote
   is those numbers averaged over seven day types, four of them untouched —
   it hides a quarter of the volume disappearing off the heaviest lifting day.

   *When it starts costing anything* (1,500 seeds per day type on the three
   lifting day types, `now: 1e12`, `profile.returnDate` set per week):
   week 1 **−0.01%** (six sets out of 41,809), week 2 −0.9%, week 3 −4.6%,
   week 5+ −15.1%. In the early return weeks `volumeMultiplier` has already
   cut the sets, so the session sits under `MAIN_WORK_MAX_MIN` with headroom
   and the ramp is purely additive — session length rises ~6 min and no
   working set is lost. The displacement only appears as the return ceiling
   lifts. **The athlete is in those weeks now; this costs him nothing yet.**

   *Why it has a deadline.* §4.4 derives the exercise count as a residual from
   `patternSets` coverage debt. This branch biases that signal down ~25% on
   lifting days, so §4.4 would read the deflated counts as unmet debt and push
   the exercise count UP — spending more of a budget already being paid for by
   shaving sets, which shaves more sets, which deepens the apparent debt. A
   feedback loop, not a static offset, and not correctable later by tuning a
   constant. It has to be answered before §4.4 is **built**, not merely before
   it ships.

   *The options, none of them chosen here.* Raise `MAIN_WORK_MAX_MIN`; exempt
   warm-up time from the trim budget; or accept the displacement as the right
   trade, since a safer entry into the fourth working set may be worth the
   fifth. This is the athlete's call, not a bug in what was built. See §4.3's
   "as built" note item (1) for the full tables.
