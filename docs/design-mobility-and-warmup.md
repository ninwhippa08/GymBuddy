# Design — mobility dosing, warm-up ramps, and where the exercise count comes from

**Date:** 2026-08-21
**Status:** built. The mobility split (`mobility-static` / `mobility-dynamic`)
and the warm-up ramp (`rules.js` `WARMUP`) are both live; §8 q2's
`[unverified]` pyramid claim is still used only to decline changes, never to
justify one.
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
| Core | 2–4 sets, 10–25 reps, 20–60 s holds | `[corroborated]` — §8 q4 |

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

**Do not stop light.** A controlled trial on squat and bench press
([Ribeiro et al. 2020](https://doi.org/10.3390/ijerph17186882), n = 40,
crossover — see §8 q5, which reads the protocol's loads back out) found that
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
load, with no jump larger than the movement's own band — `WARMUP.MAX_JUMP`
(0.15) for lower-body and unclassified lifts, `WARMUP.MAX_JUMP_UPPER` (0.10)
for `push-h`, `push-v`, `pull-h` and `pull-v`, per §8 q5. The count is
`ceil((workingPct - WARMUP.START) / band)`. The table below is the lower-body
band; an upper-body lift at the same load takes the same shape with more rungs
(0.85 gives 4 rungs lower, 5 upper):

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
0.65, so no working load can exceed it, so no ramp exceeds **three steps on
the lower-body band, four on the upper-body one, plus one more for a
`technical: 3` lift**, which gains an extra technique set at `WARMUP.START` on
top of the computed rungs. `ceil((0.65 - 0.30) / 0.15)` is 3 and
`ceil((0.65 - 0.30) / 0.10)` is 4; the `unshift` in `buildWarmup()` adds the
technique set for the Olympic derivatives.
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

**As built, five things this section did not say.** (1) **The ramp did NOT
lengthen sessions at first — it displaced working sets instead, and only once
the return ceiling had lifted. DECIDED 2026-08-31: the athlete raised
`MAIN_WORK_MAX_MIN` from 45 to 50 to buy most of that volume back, capped at a
session length he had already agreed to.** This section and the plan both
assumed warm-ups would push sessions longer and that the session ceiling
would have to rise. As first measured, they did not: the observed maximum
stayed at 65 min either way, and `packToBudget` paid for the warm-up minutes
by shaving working sets instead. No test caught this, because the 65-minute
ceiling held in both cases. The tables below are the historical record of
that discovery — read the decision and the re-measured numbers that follow
them, not these, as the current state of the app.

*Per day type, at full volume.* 3,000 seeds per day type across
`PHASE_1_DAY_TYPES`, `now: 1e12` and **no profile** — so `rampWeekFor` returns
the last ramp row and nothing is volume-limited. Total working sets are
`Σ Object.values(session.patternSets)`; "before" is the pre-ramp tree at
`a42edae`, "after" is the ramp as it originally shipped (`MAIN_WORK_MAX_MIN`
still 45).

| day type | working sets before → after | Δ | avg session min |
|---|---|---|---|
| max-strength | 37,068 → 27,934 | **−24.6%** | 58.2 → 59.4 |
| power | 51,525 → 45,714 | −11.3% | 57.2 → 58.3 |
| hypertrophy | 44,679 → 39,701 | −11.1% | 55.9 → 57.8 |
| aerobic-steady, interval, sprint, plyometric | unchanged | 0% | unchanged |
| all seven | 213,998 → 194,075 | −9.3% | 51.8 → 52.4 |

The loss fell **entirely** on the three lifting day types — the four that
never attach a ramp lost nothing — and on the heaviest of them it was close to
a quarter of the working sets. The single 9.3% figure this note used to carry
is that concentrated loss averaged over seven day types, four of which are
untouched; it understates a max-strength day by a factor of about two and a
half, and was never a number to make a decision from.

*By return-ramp week, lifting days only.* 1,500 seeds per day type on
max-strength, power and hypertrophy, `now: 1e12`, with a `profile.returnDate`
placed to land `rampWeekFor` on each week.

| ramp week | working sets before → after | Δ | avg session min |
|---|---|---|---|
| 1 | 41,809 → 41,803 | −0.01% | 44.0 → 49.8 |
| 2 | 49,081 → 48,619 | −0.9% | 48.4 → 53.8 |
| 3 | 53,556 → 51,093 | −4.6% | 50.5 → 55.9 |
| 5+ (steady state) | 66,629 → 56,559 | −15.1% | 57.1 → 58.5 |

In the early return weeks the ramp was essentially free, exactly as this
section originally predicted: `volumeMultiplier` had already cut the sets to
50/70/80%, so the session sat well under `MAIN_WORK_MAX_MIN` with headroom for
the warm-up minutes to land in — week 1 added about six minutes of ramp and
lost six working sets out of 41,809, purely additive. The displacement only
appeared as the return ceiling lifted and sessions filled the budget again —
4.6% by week 3, 15.1% at steady state. That was the state the athlete was
training under when he made the call below.

**Decision, 2026-08-31.** Two candidate fixes were tried and rejected before
this one. A full trim-budget exemption for warm-up time (`packToBudget`
ignoring warm-up minutes entirely) was built, measured, and discarded: it
recovered 100% of the pre-ramp working sets but pushed the observed maximum
session to **81 min** — 31% of max-strength sessions over a 10,000-seed sweep
exceeded his stated **≤70 min** requirement (`spec.md` line 36). Raising
`MAIN_WORK_MAX_MIN` to 52 was priced too: 93% of the working sets back, but a
1-in-21,000 session at 71 min, one minute over his limit. The athlete was
shown all four measured options on the same 3,000-seed × 7-day-type sweep and
chose the one that never breaches his limit:

| approach | max-strength working sets | max session (10k-seed sweep) | sessions over 70 min |
|---|---|---|---|
| `MAIN_WORK_MAX_MIN` 45 (as shipped) | 27,934 (75%) | 65 min | 0 |
| **`MAIN_WORK_MAX_MIN` 50 (CHOSEN)** | **32,600 (88%)** | **70 min** | **0** |
| `MAIN_WORK_MAX_MIN` 52 | 34,458 (93%) | 71 min | 1 in 21,000 |
| warm-up trim exemption (tried, rejected) | 37,068 (100%) | 81 min | 31% of heavy days |

**Attribution.** The cap 45, cap 50 and exemption rows were measured directly
against this repository. The cap 52 row is carried from the controller's own
comparison sweep and was not independently re-run here — flagged because
this project's rule is that every number carries provenance, and blending a
first-hand row with a second-hand one under a single unlabelled table
overstates the second-hand figure.

`MAIN_WORK_MAX_MIN` moved 45 → 50 in `js/rules.js`. `GYM_SESSION_TOTAL_MIN`
did not move. `TIME.FLOOR_OVERRUN_ALLOWANCE_MIN` was re-derived from 5 to 10
against the same 70,000-session committed-sweep population, worst case
**exactly 70 min** (max-strength/seed 3466, tied by power, hypertrophy and
interval) — the tightest this allowance has ever sat against a stated
constraint, with zero margin: 70 satisfies "≤70" exactly and no more. **Do
not raise `MAIN_WORK_MAX_MIN` past 50 without re-clearing it against
`spec.md` line 36** — the cap 52 and full-exemption rows above are recorded
here specifically so nobody re-tries them without knowing they were already
measured and rejected.

**CLOSED 2026-09-01, no change: the constant stays shared.** It was recorded
as open because it is shared with day types that carry no ramp at all. The
mechanism was real; the dose it produces is below the sourced norm, so there
is nothing to fix. The trace is kept because it is the evidence.
`MAIN_WORK_MAX_MIN` has exactly one use site — `packToBudget`'s default
budget (`js/generator.js:784`), read at `packToBudget`'s only call site
(`js/generator.js:1095`) for every day type, with no per-day-type override.
Raising it to recover ramped working sets also gave `packToBudget` more room
before it drops or shaves optional blocks on day types that never attach a
ramp. Traced against the templates: `aerobic-steady`'s only
`VOLUME_MODES`-countable block is slot B, "strides" (`js/templates.js:
212-218`, `mode: 'contacts'`, `sets: [4, 6]`, `optional: true`); its primary
steady-run block is `mode: 'time'` and never reaches `patternSets`, so
strides is the only place the extra room could land. Measured on the same
sweep: `aerobic-steady` counted sets rose **10,284 → 13,431 (+30.6%)**. That
is an easy day picking up more anaerobic strides work, more often — a
separate programming question from the displacement decision above.

*How it was closed.* Re-measured 2026-09-01 in two separate node processes
(one process cannot do it: `generator.js` imports `rules.js` unversioned, so a
second in-process sweep silently reuses the first cap — the identical totals
are the tell). Cap 45 → 50, 3,000 seeds, `aerobic-steady`: at full volume
**10,284 → 13,431** stride sets (+30.6%) and **69.2% → 90.3%** of easy runs
carrying strides; at ramp week 4 **12,401 → 13,968** (+12.6%) and **89% →
100%**. Easy-run length was **29.3 min on both sides** — the run itself never
changed. So the raise moved FREQUENCY, not the session: every easy day now
carries strides where about one in ten did not.

What settles it is his cadence, not the sweep. Walking the neglect model
forward 16 weeks and committing each session the way the app does, he gets
**0.25 stride sessions per week at 1×/week** (1.1 reps) and **0.50 at 2–3×
per week** (2.2–2.4 reps), because `aerobic-steady` only comes up every few
weeks at that frequency. The sourced norm is **4–8 strides, 1–3 times per
week**, 50–150 m per rep at 85–95%, recovery 2–3× the rep — `[corroborated]`
from practitioner sources (Runners Connect, Coach Saltmarsh, COROS), with the
polarized-training frame from Seiler (Fast Talk Labs) and Stöggl & Sperlich
2014. Strides are a neuromuscular stimulus taken at full recovery, not a
metabolic load, which is why they are standard *on* easy days rather than a
violation of one.

He is therefore at **0.25–0.50 stride sessions per week against a floor of
one**: the raise moved him toward the recommended range and nowhere near
through it. The block's own dose already matches the source — 4–6 reps
(norm 4–8), 75 s rest (norm 2–3× a ~25–30 s rep), "about 90%, never a maximal
effort" (norm 85–95%). Splitting a second budget constant for non-ramped day
types would buy nothing and would need its own calibration. **Reopen only if
his cadence rises far enough that `aerobic-steady` lands weekly.**

The investigation did find a real defect, fixed the same day: the strides
block carries `sprintMeters` (6 × 50 m = 300) with `footContacts: 0`, and
`loadLine`'s contacts branch read only `footContacts` — so it fell through to
the effort cue and **the card never said how far a stride was**, while the
number sat on the block unprinted. Since the sourced prescription is a
distance, the distance is the prescription. The card now reads
`× 6` / `50 m` / `rest 1:15 · build to about 90%, never a maximal effort`.

§4.4 derives the exercise count as a residual from `patternSets` coverage
debt; with `patternSets` now at 88% of its pre-ramp figure rather than 75%,
§4.4 has less deflated a signal to read, though the bias is not fully zeroed
the way the (rejected) exemption would have zeroed it. (2) **The constant block is
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

**AS BUILT 2026-09-01, `sw.js` v23 (plan-07).** Shipped: `DAY_TYPES` gain a
declared `targets` array; `patternDebt()` reads the per-goal weekly targets
sourced the same day; the FILL loop takes an optional slot only while a
targeted pattern still owes volume; `packToBudget` drops the least overdue
work instead of the last slot; and `TIME.MAX_MAIN_SLOTS` caps the count at a
measured 8. Templates grew from 4/4/5 slots to 7/6/8, every addition optional
and carrying its own template's existing accessory dose.

*Three decisions this section did not make.*

**1. Debt is DIRECT-only.** The sourced convention is fractional — an indirect
set counts 0.5 (§8 question 6) — but `data/exercises.json` gives every one of
its 236 entries exactly one `pattern` and records nothing about what a movement
trains indirectly. Inventing that map would be the same class of unsourced
number this project keeps removing, so it is §8's new open question instead.
Debt is therefore slightly overstated for patterns getting indirect work, which
biases coverage toward proposing more exercises — bounded by the cap.

**2. `targets` are declared, not computed** from the template's slot patterns.
Computing them would make coverage circular: it could only ever ask for a
pattern the template already offers, never for a missing one.

**3. `patterns: null` means every target, not none.** Found on contact with the
real templates — `MAX_STRENGTH` B/C, `POWER` D and `HYPERTROPHY` B/C/E all use
it to mean "any pattern this tier allows". Reading it as serving no pattern
would have silently dropped the isolation finisher and both null-pattern
accessories from every session.

**THE RAMP CAPS COVERAGE, and this was not foreseen.** basis §3 calls the
return ramp "the governing constraint": it cuts sets per exercise to hold total
load down. That frees minutes inside the same budget, and coverage spent them
on more exercises. Measured against the pre-plan-07 code, return week 1 went
from **4.00 exercises and 8.2 working sets to 5.95 and 11.1 (+35%)** on
max-strength, and from 9.0 to 13.3 sets (+48%) on hypertrophy, with `cnsLoad`
reaching **12.2 — above the 5–11 hard-day range `CNS_VETO_THRESHOLD` was
calibrated against**. Every session still fitted inside 70 minutes, so no test
saw it. The athlete decided on 2026-09-01 that the ramp wins. Scaling the time
budget was tried first and overshot, cutting week 1 *below* its old baseline
(4.00 → 3.02 exercises); capping the COUNT, floored at the slots a template
carried before coverage existed, restores week 1 exactly. Measured after:

| | before plan-07 | after |
|---|---|---|
| wk 1 max-strength | 4.00 ex, 8.2 sets, cns 7.9 | **identical** |
| wk 1 hypertrophy | 5.00 ex, 9.0 sets, cns 8.5 | **identical** |
| wk 3 max-strength | 3.99 ex, 9.7 sets, cns 7.9 | 5.36 ex, 11.7 sets, cns 9.7 |
| full volume | 3.13 / 4.82 ex | 3.14 / 5.20 ex |

The mid-ramp lift is deliberate: the ramp is lifting there too. Peak `cnsLoad`
is back inside the calibrated range.

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

**Status, 2026-08-31 (late): steps 1 and 2 are shipped (2026-08-24, 2026-08-31 /
`sw.js` v16). Steps 3 and 4 are unstarted.**
Step 3 (count from coverage and time, §4.4) is the resume point, and as of
**2026-09-01 it is no longer blocked**. Question 6 — the pattern-level weekly
volume figure — was sourced that day, and the answer changed the design: the
target is per goal (~10 hypertrophy, ~4 max-strength, power at or below
strength), not the single shared number §4.4 was written against. §8 question 6
carries the evidence.
Question 9 is **answered**: the athlete raised `MAIN_WORK_MAX_MIN` to 50 on
2026-08-31, so the ramp's bias on `patternSets` — the exact signal §4.4's
coverage rule reads — fell from ~25% to ~12% on lifting days (max-strength
working sets 88% of the pre-ramp figure, up from 75%). §4.4 no longer risks
reading a badly deflated count as unmet coverage debt, so it is free to be
*built* once question 6 is sourced.

Every step leaves the app shippable. Steps 1 and 2 change what a session
contains; step 3 changes how many exercises arrive; step 4 changes what kinds of
session can be proposed at all.

**Side effect found and fixed 2026-08-31, `sw.js` v17: step 1 silently doubled
`cnsLoad` and starved the CNS account's own veto.** `finalise()` in
`js/generator.js` summed `cnsCost` over every block, prep and cool-down
mobility included. Splitting one timed mobility block into ~9 individual
drill/stretch blocks (step 1, this doc) meant ~9 blocks at `cnsCost: 1` each
now counted toward `cnsLoad` where one `mode: 'time'` block used to count
zero — a hard day's `cnsLoad` went from ~16–18 to ~5–11 once the accumulation
was moved inside the `countsTowardVolume` guard it should always have used
(`programming-basis.md` §7). Left at the old `CNS_VETO_THRESHOLD` of 8, that
inflated account pinned every high-CNS day type vetoed permanently from three
days of use onward — the reported symptom was "only ever offered
aerobic-steady and interval." The threshold is re-derived to 2; see
`programming-basis.md` §7 for the arithmetic.

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
4. **CLOSED 2026-09-03. The number is inside the sourced envelope, and it is
   not payable further by reading.** Core dosing at 3 sets × 10–15 reps was
   this document's least-sourced number. Four things came back.

   **No trial isolates sets or reps.**
   [Saeterbakken et al. 2022, *Sports Medicine* 52(7):1599–1622](https://pmc.ncbi.nlm.nih.gov/articles/PMC9213339/)
   pools 31 trials and 693 athletes aged 11–37 and moderates on **frequency,
   total sessions, session duration and training period** — never on sets or
   reps. `[verified]` The 2025 core-training meta-analyses repeat the omission.
   This is the same wall the coefficient register hit: the quantity is not
   unread, it is *untested*, and re-running the search will not change that.

   **What is sourced is the envelope.** The doses that produced effects across
   those 31 trials — "6 exercises, 2 sets of 20–60-s hold time or 2 sets 10–25
   reps", "10–16 dynamic exercise, 4 sets, 10 reps", "5-s hold, 2–5 reps".
   `[verified]` Our 3 × 10–15 reps and 30–45 s holds both sit inside it. The
   tag moves `[unverified]` → `[corroborated]`, meaning *inside the range that
   worked* — never an optimum, and it must not be quoted as one.

   **There is no newer prescription to move the reps to.** ACSM 2009 put local
   muscular endurance at >15 reps with <90 s rest, which would have made 10–15
   marginally low. The ACSM 2026 stand — §2.4, already `[verified]` here —
   declines to carry a local-muscular-endurance prescription forward at all.
   There is nothing to move to, so the reps stay.

   **The holds are right, and McGill's 10 s scheme is the wrong context.**
   [Kellis et al. 2025, *J Sport Rehabil* 34(6):625–632](https://doi.org/10.1123/jsr.2024-0054)
   ran 10 × 5 s, 5 × 10 s and 2 × 25 s floor trunk extensions at equal total
   time (n = 20, acute): the longer holds with fewer repetitions produced the
   greater multifidus thickness change and the higher RPE. `[verified]` as one
   small acute study, and it argues for keeping 30–45 s rather than adopting a
   short-hold pyramid. McGill's descending 6-4-2 at 10 s per hold is low-back-
   pain *rehabilitation* guidance and is reachable only through secondary
   sources — `[corroborated]`, wrong population, not adopted.

   **What the athlete actually receives is not the constant.** Measured
   2026-09-03 over 1,500 seeds × 7 day types, `now: 1e12`, no profile:
   **2 sets 77.9 % of the time** and 3 sets 22.1 %, because `packCooldown`
   trims core sets before anything else. The block costs **6.9 min** and
   appears on max-strength, power and hypertrophy at **100 %** and on the four
   conditioning day types at **0 %**. Two consequences.

   (a) The trim lands on 2 sets, which is the *modal* dose across the included
   trials — the right answer for the wrong reason, since `packCooldown` chose
   core first precisely because the number was unsourced. That comment in
   `js/generator.js` has been rewritten; the `sets > 2` guard now has a source
   behind it instead of an accident.

   (b) **The frequency gap.** At 1–3 irregular sessions per week, with core on
   lifting days only, the trunk is often trained **once a week or less** —
   against 2–5 sessions/week (mean 3.1 ± 0.8) in every included trial, against
   **> 18 total sessions** as the threshold where the power and linear-sprint
   effects appear (SMD 0.45–0.84, p ≤ 0.003) `[verified]`, and against §2.4's
   own ACSM 2026 rule that a muscle group is trained at least twice a week.

   **DECIDED 2026-09-03 by the athlete: document the gap, change nothing.**
   Closing it was costed and offered — a core slot on the `short` cool-down
   would put trunk work on every gym session, taking conditioning days from
   ~50–53 min to ~57–60 min (plyometric 39 → 46) with lifting days untouched
   and his ≤ 70 min limit intact. He declined the session time. Nothing in the
   app changed; the gap is recorded here so that it is a **known limitation
   rather than an oversight**, and so nobody re-derives it from scratch.
5. **CLOSED 2026-09-04. Two of the three are now anchored; the floor is not,
   and one plausible-looking source for it turned out not to exist.**
   `WARMUP.START` 0.30, `WARMUP.MAX_JUMP` 0.15 and `WARMUP.FLOOR` 0.50 (this
   document originally called the block `RAMP` before the build renamed it to
   `WARMUP` — see §4.3's "as built" note) were all `[unverified]`, tuned to
   reproduce the worked example in §2.3 rather than read from a source.

   **`START` 0.30 — `[corroborated]`, and its stated reason was wrong.**
   [Ribeiro et al. 2020, *Int J Environ Res Public Health* 17(18):6882](https://doi.org/10.3390/ijerph17186882)
   — the crossover trial this document already cites at §2.3 for "do not stop
   light", n = 40 resistance-trained males — ran its effective progressive
   warm-up at **40% and 80% of the training load**, and the training load was
   80% of 1RM. In units of the movement's own max that is a first rung at
   **0.32**, two points from our 0.30. `[verified]` for the trial's protocol,
   `[corroborated]` for the transfer.

   The constant's *justification* was the part that was wrong. It read "the
   empty bar, for most lifters", which is arithmetic that only works if the
   movement's max is about 67 kg — a 20 kg bar is 30% of 67 kg. For this
   athlete's squat the empty bar is nowhere near 30% of max, so the comment
   was describing a lifter he is not. The number survives; the reason for it
   has been replaced in `js/rules.js`.

   **`MAX_JUMP` 0.15 — `[corroborated]`, and it was one number doing two
   jobs.** The increment band repeated consistently across 1RM-testing
   protocols is **5–10% for upper-body lifts and 10–20% for lower-body ones**.
   `[corroborated]` — it is stated the same way by several independent
   secondary sources, but every one of them presents it as general practice
   rather than citing a trial, so it does not reach `[verified]`. Ribeiro's
   own final jump, 0.64 → 0.80 of 1RM, is 0.16 and agrees with the lower band.

   0.15 is the midpoint of the lower-body band and sits **above the upper-body
   band entirely**. §2.3 already says traditions differ and "the difference is
   the movement, not the author"; the app was applying one tradition to both.
   **BUILT 2026-09-04**, `WARMUP.MAX_JUMP_UPPER` 0.10 for `push-h`, `push-v`,
   `pull-h` and `pull-v`, with 0.15 kept as the default so a movement the
   taxonomy has not classified is never over-ramped.

   **What it cost, measured over 3,000 seeds per day type at `now: 1e12`:**
   working sets **−4.1% on max-strength** (32,716 → 31,360), −1.8% on
   hypertrophy, −0.3% on power, for **+15.5%** more warm-up sets on
   max-strength. Session length barely moved — mean 64.01 → 64.13 min, and the
   observed maximum held at 69 min — because `packToBudget` paid for the extra
   rungs out of working sets rather than the clock, which is the same feedback
   shape §4.3's "as built" note warned about. It is an order of magnitude
   smaller than the −24.6% the ramp itself cost when first shipped (see q9),
   and the athlete accepted it with the displacement stated in advance.

   **`FLOOR` 0.50 — still `[unverified]`, and here is the dead end so nobody
   walks into it twice.** A search returns, confidently and more than once, a
   *"2017 NSCA position stand on resistance training warm-ups"* said to
   establish that an ascending ramp beats no ramp "for any compound lift over
   approximately 60% of 1RM" — which is exactly the threshold a sourced
   `FLOOR` would need. **It does not exist.** The NSCA's position statements
   are youth resistance training, long-term athletic development, resistance
   training for older adults, weightlifting for sports performance and a few
   others; none concerns warm-ups. The underlying paper is
   [Fradkin et al. 2010, *J Strength Cond Res* 24(1):140–148](https://doi.org/10.1519/JSC.0b013e3181c643a0),
   a systematic review with meta-analysis — not a position stand, not 2017,
   and it reports that warm-up improved performance in 79% of criteria
   examined without naming a load threshold at all. The only chain of custody
   for the "60%" figure was a commercial warm-up-calculator page.

   Ribeiro tested a single 80% working load, so it says nothing about where a
   ramp stops being worth doing. **No source found gives a floor.** 0.50
   stays, `[unverified]`, on the same footing as before: it satisfies "the
   lighter the weight, the less warming up you'll need" `[corroborated]` and
   nothing sharper. Do not re-run this search expecting the position stand to
   turn up.
6. **CLOSED 2026-09-01. The transfer was invalid, and §4.4 is unblocked.**
   The ~10-set figure is `[verified]` for hypertrophy only, and this was right
   to distrust: a meta-regression over 67 studies / 2,058 participants
   ([Pelland et al. 2025, *Sports Medicine*](https://pubmed.ncbi.nlm.nih.gov/41343037/),
   `[verified]`) models the two dose-responses separately and they do not have
   the same shape. Strength's minimum effective dose is **1** weekly set per
   muscle group, its efficient band ends at **4**, and beyond 5 more sets do
   not consistently add detectable strength — against hypertrophy's efficient
   band of 5–10 continuing to pay past 20. Median study volume was 6 sets/week
   for strength against 10.5 for hypertrophy. Applying the hypertrophy number
   to a max-strength day asks for roughly **2.5× the volume that buys
   anything**. Targets are now per goal (basis §2, rule 5), and the shared
   constant was split on the same day. Two further findings came with it:
   **frequency** raises strength (100% posterior) but not hypertrophy, which
   matters at his 1–3 sessions/week; and the paper's central methodological
   result — that an **indirect set counts 0.5** — is the sourced way to handle
   this app counting per *movement pattern* where the literature counts per
   *muscle group*. **Power** still has no dose-response literature: 3–6 sets of
   2–5 reps, 2–3×/week, quality over volume, `[corroborated]` from NSCA
   practitioner guidance, bounded at or below strength and never to be
   presented as measured.
10. **Fractional coverage needs an indirect-pattern map.** The sourced way to
   count sets is fractional — an indirect set counts 0.5 (question 6, Pelland
   et al. 2025) — but §4.4's coverage counts direct sets only, because
   `data/exercises.json` gives every entry exactly one `pattern` and records
   nothing about what a movement trains indirectly. A squat set and a lunge
   set both load the quadriceps and the app cannot see it. Adding that map is
   a data job and must be sourced, not invented. Until then debt is slightly
   overstated for patterns receiving indirect work, biasing coverage toward
   more exercises — bounded by `TIME.MAX_MAIN_SLOTS`.
7. Olympic-derivative warm-up practice (2–3 sets of 3–5 reps at 25–50% 1RM) is
   `[corroborated]` from practitioner sources, not from a trial. It informs the
   `technical: 3` branch in §4.3.
8. **CLOSED 2026-08-24. The `mobility-static` pool was thin; it was widened and
   this is no longer the next data job.**
   As measured at task 9 on 2026-08-24 it held seven entries with `hip` in four
   of them, so a single hurt hip left exactly three stretches — the sourced
   floor, with no margin — and two hurt joints (hip+thoracic, hip+ankle,
   hip+shoulder, hip+scapula) collapsed it to one or two. The pool now holds
   **19 entries, 8 of them loading the hip** (counted from `data/exercises.json`,
   2026-08-31), so a hurt hip leaves 11 and no two-joint pair reaches the floor.
   The widening used sourced stretches, not invented ones. Deviation 4.
   Note that ruling C1's six recovered warm-up drills are all *dynamic* and
   widened the prep pool instead — they never helped here.
9. **DECIDED 2026-08-31 by the athlete: `MAIN_WORK_MAX_MIN` raised 45 → 50.**
   The ramp originally displaced working volume instead of extending the
   session, and that was never decided on purpose. §4.3 and plan-05 both
   assumed the ramp would push sessions longer; as first measured, it did
   not — `packToBudget` paid for the warm-up minutes by trimming working
   sets, and average session length moved less than a minute. The historical
   record of that measurement:

   *Where the volume went* (3,000 seeds per day type, `PHASE_1_DAY_TYPES`,
   `now: 1e12`, no profile — full volume, the last ramp row; pre-ramp
   `a42edae` → the ramp as first shipped, `MAIN_WORK_MAX_MIN` still 45):
   **max-strength −24.6%** (37,068 → 27,934 working sets), power −11.3%,
   hypertrophy −11.1%, and **0% on aerobic-steady, interval, sprint and
   plyometric**, which never attach a ramp. The 9.3% this entry used to quote
   is those numbers averaged over seven day types, four of them untouched —
   it hid a quarter of the volume disappearing off the heaviest lifting day.

   *When it started costing anything* (1,500 seeds per day type on the three
   lifting day types, `now: 1e12`, `profile.returnDate` set per week):
   week 1 −0.01% (six sets out of 41,809), week 2 −0.9%, week 3 −4.6%,
   week 5+ −15.1%. In the early return weeks `volumeMultiplier` had already
   cut the sets, so the session sat under `MAIN_WORK_MAX_MIN` with headroom
   and the ramp was purely additive there. The displacement appeared only as
   the return ceiling lifted.

   **What was chosen, and what it cost.** Two other fixes were tried first
   and rejected. A full trim-budget exemption for warm-up time recovered
   100% of the working sets but pushed the observed maximum session to
   81 min — 31% of a 10,000-seed max-strength sweep exceeded his stated
   **≤70 min** requirement (`spec.md` line 36). `MAIN_WORK_MAX_MIN` 52 got
   93% of the sets back but still broke the limit once in 21,000 sessions
   (71 min). The athlete chose `MAIN_WORK_MAX_MIN` **50**: 88% of the
   pre-ramp working sets (27,934 → 32,600), and the 10,000-seed committed
   sweep's observed maximum lands at **exactly 70 min** — inside his limit
   with no margin at all. `TIME.FLOOR_OVERRUN_ALLOWANCE_MIN` moved from 5 to
   10 to match. `GYM_SESSION_TOTAL_MIN` did not move — see `js/rules.js`'s
   `MAIN_WORK_MAX_MIN` and `FLOOR_OVERRUN_ALLOWANCE_MIN` comments for the
   full option table and the per-day-type worst cases.

   **The open question this decision surfaced is now CLOSED (2026-09-01), no
   change:** `MAIN_WORK_MAX_MIN` is shared across every day type, not just the
   three that carry a ramp, so raising it also recovered working sets on
   `aerobic-steady`'s optional strides slot (+30.6%, 10,284 → 13,431) — a day
   type with no ramp at all. The effect is real but lands **below** the sourced
   dose: at his cadence it is 0.25–0.50 stride sessions per week against a
   norm of 1–3. See §4.3's "Decision" block above for the measurements, the
   sources and the card defect the investigation uncovered.

   *Why the deadline is lifted, not the bias.* §4.4 derives the exercise
   count as a residual from `patternSets` coverage debt. This decision does
   not zero that bias the way the rejected exemption would have —
   `patternSets` is now at 88% of its pre-ramp figure on max-strength, up
   from 75%, but still not 100%, and the same feedback shape §4.3's "as
   built" note warned about (deflated debt → §4.4 pushes the count up →
   `packToBudget` shaves more to fit the larger count into the same budget →
   debt reads even lower) is mechanically still possible at 88%, just with
   more headroom to absorb it before it bites. This item no longer blocks
   *starting* §4.4 — the athlete has made his call and does not need to
   re-decide it before that work begins — but whoever builds §4.4 should
   re-check its behavior against the real (88%, not 100%) counts once it
   exists, rather than assuming this is fully closed.

---

## 9. Prep and cool-down match the day's work — BUILT 2026-09-04, `sw.js` v38

### 9.1 What was wrong

Reported by the athlete after a max-strength session. Main work was Romanian
deadlift, close-grip bench press and cable woodchop. The prep block gave him
inchworm, walking quad pull and squat to stand.

> "I am going to work on the romanian deadlift, I want to warm up my
> hamstrings. I have bench press, I want to warm up my shoulders and chest.
> I want the prep work to make sense so that it warms up for the main work."

`PREP_BLOCK.full` named no selection criteria beyond `modality:
'mobility-dynamic'`, so it drew any 3–4 of the 19 dynamic drills. The
cool-down's `M1` group had the same shape and the same defect. Neither block
knew what the session contained, even though both are built at step 9, *after*
the main work is chosen and packed.

### 9.2 Why joint matching is not the answer

The obvious fix was the mechanism `eligibleFor` already runs for the running
prep: `slot.joints`, added in `design-running-programming.md` §5.3 to keep a
shoulder dislocate out of a running warm-up.

The athlete rejected it, correctly, with one counter-example:

> "lets say I have a deadlift day but I have quad pulls as a move. They both
> are hitting the knee, but actually I don't want to warm up the quad, but the
> hamstring."

Checked against the library, the collision is exact:

| entry | joints |
|---|---|
| `deadlift` | `hip`, `knee`, `lumbar` |
| `walking-quad-pull` | `knee`, `hip` |

A **perfect** joint overlap, and still the wrong drill — lengthening the quad
does not prepare a hinge. The same collision exists on the cool-down side
between `seated-hamstring-stretch` (`hip`, `knee`) and `standing-quad-stretch`
(`knee`, `hip`): identical joints, opposite tissue.

The library carries no muscle tagging — audited across all 252 entries, the
anatomy vocabulary is `joints` and nothing else. So joint matching cannot be
repaired by refinement; it is measuring the wrong thing.

### 9.3 What was built

**A `targets` field on the 38 mobility entries**, naming the movement patterns
each drill or stretch serves. This is a *classification*, in the same
epistemic class as the `pattern` and `joints` fields those entries already
carry — "a bodyweight hip hinge rehearses a hinge" is a description of the
movement, not a finding that needs a citation. What is sourced is the
principle it serves: §2.2's dynamic-before-explosive split already places
these drills *for* the work that follows them.

Joints are **kept, not replaced**. They are what the running prep filters on,
and they are what soreness reads.

**`sessionTargets(blocks)`** reads the day's patterns off the main work using
`countsTowardVolume` — the same rule the volume accounting uses, so the answer
cannot drift from what the session counts as work. That exclusion also keeps
the prep and cool-down out of their own input: every mobility entry is pattern
`mobility`, so including them would put `mobility` on the target list and match
the entire pool, restoring the exact behaviour this section removes.

**Filtering alone was not enough.** A hinge-and-press day that filtered and
then drew freely could still take three hinge drills and prepare nothing for
the press. So the draw is coverage-ordered: `buildBlockGroups` tracks which of
the day's patterns it has covered and aims each next pick at one it has not,
via a three-rung fallback — an uncovered pattern, then any of the day's, then
the open pool.

**The last rung is not a fallback to be optimised away.** `MOBILITY_DOSE`'s
3–4 movements is a sourced dose. A `carry` day has no dynamic drill filed
against it at all, and must still get a full warm-up. **Matching decides which
movements, never how many.**

Applied to `PREP_BLOCK.full` and to `COOLDOWN_BLOCK`'s `M1` groups (`full` and
`short`) via `matchWork: true`. The `M2` core group is deliberately excluded:
it is training, not tissue care, and matching it to the day's patterns would
silently narrow the core pool to whatever is tagged `rotate`.

*Measured, `max-strength`, main work RDL / close-grip bench / woodchop:*

| seed | before | after |
|---|---|---|
| 1 prep | 90/90 hip switch, bodyweight hip hinge, scapular wall slide, ankle CARs | 90/90 hip switch, bodyweight hip hinge, banded shoulder dislocate, glute bridge |
| 3 cool | couch stretch, soleus stretch, deep squat hold, dead hang | thoracic foam roll, cross-body shoulder, child's pose, seated hamstring |

Seed 3's old cool-down stretched calves and quads after a deadlift session.

### 9.4 `packPrep` had never been called

Found while measuring this branch against the §7 duration sweep, which failed
at 70 min on `power`/seed 5522 — a session whose prep drew **four per-side
drills**, priced at roughly double by the `sides` multiplier.

That is `packPrep`'s own test fixture. `packPrep` was written for ruling A2 —
"a session that draws several per-side drills can run well past that
estimate" — shipped with a passing unit test in `tests/mobility.test.mjs`, and
**was never called from `generateSession`**. The cool-down was packed; the prep
was not. The only block with no packer was the one whose own comment says it
overruns.

The gap was invisible because nothing measured it. `js/rules.js`'s
`MOBILITY_TRANSITION_SEC` comment derives its worst case from "3 min prep at
packPrep's 3-drill floor and under its own budget" — describing a floor nothing
was enforcing. This branch surfaced it only because matching narrows the pool
and made the four-unilateral draw more reachable.

Wired at step 9a. Two properties make it safe alongside matching:

1. `buildBlockGroups` appends in coverage order, so the tail is the drill that
   added least, and `packPrep`'s `pop()` costs coverage **last**.
2. Coverage is bounded by drill count, and drill count by `TIME.PREP_MIN`. A
   four-pattern day that only fits three drills must leave one pattern
   unprepped — `max-strength`/seed 8 is exactly that. It is now **announced**
   (`prep over its 3 min budget at the 3-drill floor`) rather than silent,
   per §1.2's standing rule. The cool-down's overrun always warned; the
   prep's did not, because nothing was measuring it.

**`FLOOR_OVERRUN_ALLOWANCE_MIN` re-derived 9 → 8.** Same rule as every prior
move: exactly `worst − GYM_SESSION_TOTAL_MIN`, measured and not rounded up.
Re-swept the same 70,000-session population (`PHASE_1_DAY_TYPES` × 10,000
seeds, no `returnDate`, `now: 1e12`): worst case **68 min** on `power`/seed
2149, five sessions at 68, 43 at 67. The margin against `spec.md` line 36
widens from one minute to two — which is what fixing an unbounded block is
supposed to do.

### 9.5 Not changed

- **The doses.** 3–4 drills, 10–12 reps, 3–4 stretches, 20–30 s holds. All
  sourced in §2.1, none touched.
- **The running prep.** Its four stages select on `joints` and `effortClass`;
  a running day's main work is pattern `run`, which no drill targets, so a
  `targets` filter alone would let a shoulder drill back into the warm-up.
  `design-running-programming.md` §5.3's guard is asserted directly in
  `tests/prep-specificity.test.mjs`.
- **Warm-up ramps.** §4.3 is untouched. The loaded ramp is the specific
  warm-up; these drills are the general one. They are different mechanisms and
  both run.

### 9.6 Open

**Unilateral drills cost double, and coverage pays for it.** `max-strength`
seed 8 has four day patterns, fits three drills, and drops `push-h` because
two of the three it kept are per-side. Preferring bilateral drills among
equally-matching candidates would fit a fourth and close the gap — but it
would also bias the draw against seven of the 19 drills every session, which
is a variety cost against a coverage gain. **Not built, deliberately.** Raised
here so the trade is on the record rather than rediscovered.

## 10  A mobility rep is not a barbell rep — FIXED 2026-09-05, `sw.js` v49

The athlete asked for the 70-minute session limit to be given a tolerance,
because the time budget kept getting in the way. His reason was one sentence:
*"the mobility work does not take long anyway."*

He was right, and that made the tolerance the wrong fix. The app was
over-charging mobility, and loosening his own stated limit would have buried a
measurement error underneath it.

### 10.1  The error

`TIME.SECONDS_PER_REP` is 3. That is a **barbell** rep — an eccentric, a
concentric, and a moment under load. It was applied to prep drills too, so 12
side-lying thoracic rotations per side were billed at 72 seconds, and a 3-drill
prep came out at 4.4 minutes against a 3-minute budget. The sourced floor could
therefore *never* fit its own budget, and "prep over its 3 min budget" fired on
**71% of sessions**.

**This exact error had already been found and fixed once in this file, one line
above, for transitions:**

> "Mobility work has no plates to change. Using the 90 s barbell figure put the
> 3 min prep block at 8 min." — `MOBILITY_TRANSITION_SEC`

Transitions were given a mobility-specific constant. Reps were not. `TIME` now
carries `MOBILITY_SECONDS_PER_REP: 2`, applied only to `mode: 'drill'`, which
`templates.js` sets on mobility-dynamic slots and nothing else. Lifting keeps
its 3 s. It is `[unverified]` as an exact value, for the same reason the
transition figure is: nobody has held a stopwatch to it.

### 10.2  A second, unrelated bug the first one uncovered

With gym days fixed, the prep warning still fired on **100% of interval
sessions** — every one, since the block was built. The interval template puts a
**four-minute warm-up jog** in the prep. `PREP_MIN` budgets the DRILL dose —
rules.js says exactly that at the constant — so a deliberate jog was being
charged against a budget for how many drills fit, and the overrun was
guaranteed by construction.

`packPrep` now measures only non-`time` blocks against the budget. The jog
still costs its four minutes in the session duration; it is exempt from *this*
budget, not from the clock. Trimming mobility drills to make room for a jog
would have been the wrong answer to the wrong question.

### 10.3  Result

| | before | after |
|---|---|---|
| prep over budget | 71% of sessions | **0%** |
| cool-down over budget | 16.7% | 16.7% (unchanged) |
| worst session | 68 min | **67 min** |
| margin against spec.md:36 | 2 min | **3 min** |

`FLOOR_OVERRUN_ALLOWANCE_MIN` falls 8 → 7. The minute was not bought by
trimming work: it is a minute the sessions never actually cost him.

The cool-down is deliberately unchanged. Its cost is *holds* — a 30-second
stretch takes 30 seconds, per side if it is per side — and those estimates are
honest. Its 16.7% is a real trade-off from a 131-entry mobility pool with many
per-side stretches, not a mispricing, and it is left for a decision rather than
silently tuned away.

### 10.4  The lesson worth keeping

**When the athlete's experience disagrees with a number, check the number
before widening the limit around it.** He is the only instrument this project
has for how long a session takes him, and the figure he was arguing with turned
out never to have been about mobility at all.
