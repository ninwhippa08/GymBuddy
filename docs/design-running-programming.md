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

## 2. Scope

**In scope.** Four running day types with correct pools; a four-stage running
prep block; the pattern re-split that makes both possible; a chronic-load term
coupling lifting fatigue to running selection.

**Explicit non-goals.** No changes to load prescription, `ZONES`, PR
coefficients, the return-to-training ramp, or any existing cue. All 235 library
cues survive untouched.

**Deferred to a later phase.** Equipment-aware filtering — see §9.

## 3. Decisions taken

| Question | Answer |
|---|---|
| How many running session types | **Four**: easy run, intervals, sprint, plyometric |
| Tempo/threshold work | Folded into the interval day as an intensity variant, not its own day type |
| Equipment/terrain access | Assume full access; user reports gaps and the swap path handles them. Filtering deferred (§9) |
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
| B (optional) | `run` or `erg` | tempo finisher, 8-12 min |

Pool: run-interval, shuttle-run, stair-run, tempo-run, fartlek, plus ergs.
Threshold work lives here as a longer work interval at lower effort.

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

The 72-hour decaying CNS account (`js/generator.js:96-100`, `CNS_DECAY`) and
its veto at `CNS_VETO_THRESHOLD` 8 already prevent a hard day stacking on a
hard day. `HIGH_CNS_DAY_TYPES` already includes `sprint` and `plyometric`
(`js/rules.js:218`), so they correctly compete with max-strength and power for
the same budget rather than serving as recovery.

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

---

## 9. Deferred: equipment-aware filtering

`eligibleFor` filters venue, soreness, bans and measured ground, but **never
equipment**. The profile (spec §3.3) has no equipment field. A sled push or a
stair run can therefore be proposed regardless of access.

The user's decision: assume full access, and report gaps as they arise — the
swap path covers a missing hill or sled. Recorded here as an explicit later
phase, not an oversight. Implementation would add an `equipment` array to the
profile and one filter line in `eligibleFor`.

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
| `BUILDUP_PCT_INTERVAL` | ~80% effort | `[corroborated]` | Progressive-intensity sprint-prep literature (Simperingham et al., "Gradual vs. Maximal Acceleration: Their Influence on the Prescription of Maximal Speed Sprinting in Team Sport Athletes," *Sports* 2018, PMC6162480) uses staged sub-maximal efforts building through the 60-90% band before high-intensity running. 80% sits inside that band, below the near-maximal target reserved for sprint day. Prescribed as effort, not pace, per the terrain-agnostic constraint (design §5, spec 9.1). |
| `BUILDUP_PCT_SPRINT` | ~95% effort | `[corroborated]` | Same literature defines 90-95%+ as the conventional near-maximal band immediately preceding an all-out rep; 95% is its typical top edge. Also consistent with the ≥95% "true sprint" threshold reported in the same source. |
| `INTERVAL_WORK_SEC` | 60-90 s | `[corroborated]` | Multiple independent secondary sources on running-interval and HIIT prescription converge on 60-90 s as a standard hard-effort bout duration. No single named position stand pins this exact range, hence corroborated rather than verified. Seconds, not metres — required by the terrain-agnostic constraint (design §5). |
| `INTERVAL_REST_RATIO` | 1-2x work duration (work:rest 1:1 to 1:2) | `[corroborated]` | Same interval-training sources: 1:1 is the common baseline for aerobic-interval recovery, extending toward 1:2 for harder or longer reps. Mirrors the existing `SPRINT.WORK_REST_RATIO` house style (`js/rules.js:177`). |
| `CHRONIC_WINDOW_DAYS` | 28 | `[corroborated]` | The acute:chronic workload ratio literature (Gabbett 2016, *Br J Sports Med*, "The training-injury prevention paradox"; Hulin et al. 2016) standardizes on a rolling 7-day acute / 28-day chronic pairing. Read via secondary sources agreeing on this figure, not the primary papers directly, hence corroborated not verified. Borrowed as a *window length* only — this app's chronic term is a boost on session selection, not an injury-risk ratio, so only the window duration is imported, none of ACWR's risk thresholds. |
| `GYM_SHARE_TRIGGER` | 0.70 (70% of chronic load from gym day types) | `[unverified]` | No source sets a gym-share fraction for anything resembling this term — a modality split of workload does not appear in the ACWR literature, which totals load regardless of source. Chosen conservatively high so one heavy lifting week does not fire the boost; only a sustained lifting-dominated block does, appropriate given 1-3x/week irregular attendance where the share swings on its own week to week. |
| `WEEKS_TRIGGER` | 4 | `[corroborated]` | Resistance-training deload-frequency literature (coach-practice survey, PMC9811819, "You can't shoot another bullet until you've reloaded the gun," 2023; corroborating practical-guidance sources) converges on roughly 4-8 weeks between lighter weeks, with 4 at the cited low end. Borrowed by analogy only: that literature governs when a *lifter* should deload, not when running should be boosted — this app reuses the interval length, not the underlying claim, per the analogy-not-application distinction (design §7.2). |
| `CHRONIC_BOOST_MAX` | 1.5 (chronicBoost caps at 1.5x) | `[unverified]` | No source for a boost magnitude exists — the term itself is this app's invention (design §7.2), not a published construct. Capped modestly so the boost-never-veto rule (design §7.3.1) holds: even at the cap, `min(daysSince, 21)` from raw neglect can still dominate the score for a badly-neglected day type. |

The four-stage prep structure itself is standard practice (the RAMP protocol —
Raise, Activate/mobilise, Potentiate — Jeffreys) and needs no numeric
sourcing; only the counts and percentages above did.

## 11. Known limitations

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
