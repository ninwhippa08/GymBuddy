# Reps, weight and pairing by what the exercise is — design

**Date:** 2026-09-16 · **Status:** approved in chat, awaiting review of this file
**Asked for by:** the athlete, after a trained hypertrophy session
**Ships as:** `sw.js` / `js/version.js` **v77**

---

## 1. The complaint, and what it turned out to be

> "Main work I think is too heavy. I don't know how and why deadlift and pause
> squat was given on the same day … who does 4x11 reps of pause squat with 59%
> of the PR. … Do not choose your rep count to fill the time slot. Choose it
> such that it makes sense medically."

> "We have to ground the rep and set count according to move difficulty and
> which ones [are] optimal for max health/muscle growth. If you are mapping the
> rep and set count such that the whole program should fit under 70 mins, you
> are wrong."

**Reps are not chosen to fill the clock.** `prescribe()` draws them uniformly
from the SLOT's `reps` range; `packToBudget` only ever removes work. His
instinct is still right about the outcome, because the draw is blind to the
exercise: a deadlift and a cable chop landing in the same slot get the same
range. Three defects, measured 2026-09-16 at `now = 1e12`, fully ramped
(`returnDate` 400 days back), 2,000 seeds per day type:

| defect | max-strength | hypertrophy |
|---|---|---|
| **A. Load heavier than the reps allow** — `pct` above the NSCA chart's value for the prescribed reps, i.e. more than a true N-rep max | **40.9%** of loaded blocks | **34.6%** |
| **B. Two heavy barbell squat/hinge lifts in one session** | **14.7%** of sessions | **6.5%** |
| **C. Most direct sets on one pattern in a session** | median 5, p95 8, max 13 | median 6, p95 9, max 13 |

**A** is the root. `prescribe()` draws `reps` from `slot.reps` and `pct` from
`zone.pct` independently (`js/generator.js`, the two `intBetween`/`between`
calls), so nothing couples the weight to the rep count. The pause squat is the
case in point: 11 reps at 0.70 of its own max (0.59 × back-squat PR through
`prCoef` 0.85) is roughly an 11–12RM — four sets of near-failure, paused,
after deadlifts.

**B** is slot B: role "second compound, opposing pattern", `patterns: null`.
Nothing enforces "opposing". Seen in the sweep: `snatch-grip-deadlift +
sumo-deadlift` — two deadlifts — on 11 of 2,000 hypertrophy days.

## 2. Sources

**IUSCA position stand, 2021** — Schoenfeld, Fisher, Grgic, Haun, Helms,
Phillips, Steele, Vigotsky, *Int J Strength Cond* 1(1). Read in full text.
`[verified]` for each quoted recommendation below:

- Hypertrophy is comparable "across a wide spectrum of loading zones"; moderate
  loads are preferred as "less taxing on the joints and neuromuscular system
  than very heavy loads."
- The arrangement this design implements, nearly verbatim: "pairing more
  technically complex, energetically demanding, free-weight multi-joint
  exercises with low to moderate repetition ranges, followed by moderate to
  high-repetition sets using single-joint or machine-based exercises to balance
  recovery, stress, and performance."
- "Confining the use of failure training primarily to single-joint movements
  and machine-based exercises may help to manage the stimulus-fatigue ratio."
  Compound free-weight lifts "are more technically demanding and engage more
  total muscle mass … which may negatively influence recovery."
- "Rest periods should last at least 2 minutes when performing multi-joint
  exercises. Shorter rest periods (60-90 secs) can be employed for single-joint
  and certain machine-based exercises."
- "Cap per-session volume at ~10 sets per muscle."

**Schoenfeld et al. 2021**, *Sports* 9(2):32 — hypertrophy similar across
roughly 5–30+ reps when sets are taken near failure. So the rep count is chosen
for fatigue and safety, not for growth. `[corroborated]` — read through
secondary summaries of the paper, not the paper itself.

**Robinson et al. 2024**, *Sports Med* 54(9) — hypertrophy rises as sets end
closer to failure; strength is largely insensitive to it. Supports taking light
work closer to failure than heavy work. `[corroborated]` — read through
secondary summaries, not the paper itself.

**Pareja-Blanco et al. 2019** — a moderate load with high velocity loss (many
reps near failure, 60% 1RM) left more fatigue and slower recovery at 24–48 h
than a heavier load with low velocity loss (80% 1RM). This is the pause-squat
prescription. `[verified]` (full text).

**The one-heavy-lower-lift rule has no trial.** It rests on the IUSCA recovery
reasoning above, Pareja-Blanco, and practitioner consensus on stacking two
spinally loaded lifts. `[corroborated]`, and the code says so.

## 3. Decisions (all made by the athlete in chat, 2026-09-16)

1. Approach **A** — group by what the exercise is, derived from existing
   fields — over hand-authoring 556 rep ranges (B) or narrowing slot ranges (C).
2. Groups and doses as in §4.1, heavy at 6–8.
3. Weight from reps, heavy lifts 2–3 reps in reserve.
4. The pairing rule applies to **max-strength and hypertrophy** days; power days
   are exempt (their squats are dynamic-effort speed work at 40–60%).

## 4. Design

### 4.1 Load groups — `LOAD_GROUPS` in `js/rules.js`

Derived from fields every entry already carries. **No entry is edited.**

| group | membership (first match wins) | reps* | reps in reserve | rest* |
|---|---|---|---|---|
| `light` | the slot's `modality` is `isolation`, **or** `cnsCost` 1 | 10–15 | 1–2 | 60–90 s |
| `heavy` | `loadable` **and** `cnsCost` 3 | 6–8 | 2–3 | 120–180 s |
| `compound` | everything else (`cnsCost` 2, or `cnsCost` 3 unpriced, e.g. weighted pull-up) | 8–12 | 2 | 120–180 s |

\* **Reps and rest from the group apply only on `hypertrophy`-zone slots.**
Everywhere else the slot keeps its own:

- `maxStrength` zone (max-strength A, B): strength reps 2–5 / 3–6 and rest
  180–240 / 150–210 are already sourced and already ≥ 2 min.
- `muscularEndurance` zone (hypertrophy E, the isolation finisher): 12–15 at
  45–60 s, unchanged.
- `powerMultiple`, `powerSingle`, `dynamicEffort` zones and the `contacts`,
  `time`, `interval` modes: **untouched by this design entirely.**

`isolation` is checked before `cnsCost` because the isolation finisher slot is
dosed as isolation whatever it draws (core-adjacent entries such as
`ab-wheel-rollout` carry `cnsCost` 2).

Samples, checked against the library: `single-arm-lat-pulldown` light,
`tall-kneeling-cable-chop` light, `leg-press` light, `dumbbell-bench-press`
compound, `romanian-deadlift` compound, `weighted-pull-up` compound,
`pause-squat` heavy, `deadlift` heavy, `bench-press` heavy.

A pure `loadGroupFor(exercise, slot)` in `js/generator.js` returns the key. It
is the only place membership is decided.

### 4.2 Weight from reps — `prescribe()`

For `load` mode on `maxStrength`, `hypertrophy` and `muscularEndurance` zones:

1. `reps` — from the group (hypertrophy zone) or the slot (the other two).
2. `rir` — drawn from the group's reps-in-reserve range.
3. `pct = repMax(reps + rir)`, then the existing `PCT_JITTER` applied **downward
   only** (a jitter that raises the load re-creates defect A).
4. The existing two-stage ceiling (own-max, then displayed multiplier) applies
   unchanged, as does `rampLimited` / `ceilingLimited`.

`repMax(n)` — the fraction of 1RM that is an n-rep max — reads `REP_TO_PCT`
where a row exists, interpolates linearly between rows (the chart skips 11),
and past the last row (12) uses Epley, `1 / (1 + n/30)`, which is continuous
enough there (Epley 12 = 0.714 against the chart's 0.70) that the function
stays monotone by taking `min(chart(12), epley(n))`. Epley is `[corroborated]`
as the standard estimation formula; it is used only past the chart.

`zone.pct` is **no longer drawn from** for these three zones. It stays in
`ZONES` as the documented band. The existing zone assertions in
`tests/rules.test.mjs` read the constant, not generated loads, so they are
expected to stand; any test that samples `pct` against `zone.pct` will not, and
the plan must find and re-point those rather than widen them.

`block.rir = [lo, hi]` is stored, and `block.effort` reads
`leave ${lo}-${hi} reps in reserve` (`leave 2 reps in reserve` when lo = hi) on
`load` **and** `reps` blocks. The card already prints `block.effort` in the
meta line of a load block, and as the headline of a reps block — no UI change.

Pause squat on a hypertrophy day, before → after:
`4 × 11 @ 0.59 × Back Squat PR` → `3–4 × 6–8`, 2–3 in reserve, e.g.
`8 reps + 2 RIR = 10RM = 0.75 of pause max = 0.64 × Back Squat PR`. Fewer reps,
further from failure, and a load that is honest about the rep count.

### 4.3 The ladder keeps the invariant — `ladderise()`

Max-strength may draw the `ladder` architecture, whose rungs change `reps` and
`pct` per set. A fourth bound joins `roomBelow`, `roomAbove`, `roomToCeiling`:
no rung may exceed `repMax(rungReps + block.rir[0])`. If that narrows the step
below `LADDER_STEP_MIN` the block goes straight, which is the existing honest
fallback. `roomBelow`/`roomAbove` are re-based on the rep-derived band rather
than `zone.pct`, so a ladder cannot be centred on a load the zone would allow
and the reps would not.

### 4.4 One heavy squat or hinge — generation and swap

**Heavy lower lift** := group `heavy` **and** pattern `squat` or `hinge`.

On `max-strength` and `hypertrophy` days, once a heavy lower lift is in the
session, `eligibleFor` excludes every other one (`ctx.heavyLowerTaken`, set in
`generate()`'s fill loop next to `excludeIds`). The tier-relaxed retry for a
required slot runs through the same filter, so it cannot reintroduce one.

`swapBlock` applies the same rule against the session's **other** blocks, so a
tap cannot put a second one on the card. If that empties the pattern, the swap
takes its existing "no other X movement" path.

Power, running and deload days are unaffected.

### 4.5 Ten direct sets per pattern — after packing

`capPatternSets(blocks, 10)` runs after `packToBudget` and before
`pairAntagonists`. While any pattern's `load`/`reps` sets exceed 10, remove one
working set from that pattern's block with the most sets, never below the
existing floors (two working sets on a ramped block, one otherwise), and drop
the matching `setPlan` work entry exactly as `packToBudget` does. If only floors
remain, stop. IUSCA's cap is per muscle; pattern is the closest unit this
library carries (every entry has exactly one), stated in the constant's comment
as the approximation it is. `SETS_PER_PATTERN_PER_SESSION: 10` in `VOLUME`.

## 5. What does not change

- Day-type selection, coverage, neglect, recency and the CNS account.
- Set ranges per slot (2–4), and the return ramp's volume multiplier on them.
- Power, sprint, plyometric, interval and aerobic prescriptions.
- Prep, core and cool-down.
- Saved sessions. Old records keep their stored numbers; nothing re-prices
  history.

## 6. Session length — measured before anything ships

Rest rises to 120–180 s on hypertrophy-zone compound slots (hypertrophy B had
90–150, max-strength C 90–120, power D/F 90–120), and falls to 60–90 s on
light ones. Heavy lifts lose reps. The net effect on the clock is unknown and
**will be measured, not argued**: mean and worst session per day type over the
standard sweep, before and after.

**If the worst session crosses 70 min** — his stated ceiling, `spec.md:36` —
nothing is re-derived or widened. The numbers go to the athlete with the
options, as every previous budget change did.

Also reported: working sets per session per day type (does packing now trim
more optional work?), and defects A–C re-measured, where A and B must be **0**.

## 7. Testing

Each guard is watched failing — against today's code where the defect exists,
by deliberate mutation where it does not — before it is trusted.

| test | proves | watched failing how |
|---|---|---|
| no working set's `pct` exceeds `repMax(reps + rir[0])`, over `generate()` sweeps of max-strength and hypertrophy, **every `setPlan` work rung included** | defect A gone, ladder included | today's code: fails at ~35–41% |
| no max-strength or hypertrophy session holds two heavy lower lifts | defect B gone | today's code: fails |
| a swap never adds a second heavy lower lift | the rule survives the swap path | mutation: drop the check in `swapBlock` |
| power days may still pair them | the exemption is real | mutation: apply the rule to every day |
| every hypertrophy-zone block's reps and rest sit inside its group's range | groups are delivered, not just declared | today's code: fails |
| `loadGroupFor` membership on the named sample entries | the table in §4.1 | mutation: swap two predicates |
| `repMax` matches `REP_TO_PCT` on every row, is monotone decreasing 1..20, interpolates 11 | the chart is read, not re-typed | mutation: off-by-one row |
| no pattern above 10 direct sets after packing | defect C capped | today's code: fails at max 13 |
| `muscularEndurance` and `maxStrength` slots keep their slot reps | scope of §4.1 | mutation: apply group reps everywhere |

Smoke tests run through `generate()`, never through `prescribe()` alone — the
project's standing rule after three builders that tested clean and delivered
nothing.

## 8. Documentation

- `README.md` — "How a session is generated" step 7 and "Design decisions":
  groups, reps in reserve, the pairing rule, and that reps are not clock-fitted.
- `docs/programming-basis.md` — the IUSCA and Pareja-Blanco citations beside the
  existing zone table.
- `docs/design-architectures.md` — the ladder's fourth bound.
- Code comments carry the sources inline, per house style.

## 9. Out of scope, recorded

- **Ramp week rounding** (§13.4 of the mobility doc): `round(3 × 0.80) = 2`.
  Unchanged and still his call.
- **Muscle-level volume.** Pattern stands in for muscle in §4.5; a muscle map
  would be the unsourced indirect-set table `patternDebt` already declines to
  invent.
- **Per-exercise authored ranges** (approach B), declined.
