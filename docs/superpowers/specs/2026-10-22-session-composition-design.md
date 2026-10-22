# Sessions built from the work, not the clock — design

Date: 2026-10-22. Status: decided with the athlete in conversation; this
document awaits his approval. Target version: v80.

## 1. Intent

The athlete's rule: **a session is composed from the intensity of its
movements and how they combine. Time is never the thing that fills or trims
it.**

Today, on lifting days, minutes decide the session's size (`generate()`,
`js/generator.js` ~2190–2290): optional slots are admitted only while the
estimated minutes are under `rampedMinutes` (`MAIN_WORK_MAX_MIN × ramp
volume`), and `packToBudget` then drops optional blocks and shaves working sets
until main work fits `MAIN_WORK_MAX_MIN` (49). v79 had to add a temporary
"pricing hold" so a shorter warm-up would not buy extra work.

**Decided 2026-10-22, after seeing the measurements in §6:** on lifting days
there is **no time limit at all** — no minute gate, no trimming, no session
cap. Measured with the rules below, full-volume sessions average ~75–76 min
(p90 82–85, longest seen 95). The athlete accepted that explicitly: "don't
set a limit … I want to test the new method. Then we can see if the workouts
created are too much for me." The 70-min cap (`spec.md`, his earlier
requirement) is retired for lifting days by that decision. If sessions prove
too long in practice, the fix comes back as his feedback and is made with a
composition rule — never by reintroducing a clock.

## 2. Goals, non-goals, anti-goals

**Goals** (lifting day types: `max-strength`, `power`, `hypertrophy`)
- An optional slot is admitted by **weekly need, per-session dose and count**
  (§4) — nothing else.
- No minute budget is consulted when building or trimming a lifting session.
- The v79 pricing hold is removed.
- The return ramp still cuts: each ramp week delivers no more than its `RAMP`
  column's share of the new full-volume session (§4.4).

**Non-goals**
- Non-lifting day types (aerobic-steady, interval, sprint, plyometric,
  mobility): unchanged, including their `packToBudget` call. Follow-up: measure
  how often it trims them.
- Required slots and their prescriptions, zones, ladders, supersets,
  `rampToBudget`, the between-day CNS veto, the day-type rotation, exercise
  selection inside a slot (`fillSlot`).
- Prep and cool-down budgets (`TIME.PREP_MIN`, `TIME.COOLDOWN_MIN`) — those
  blocks are not training volume and are untouched.

**Anti-goals** — fails even if it works technically if:
- Any required working set is removed or shaved on a lifting day.
- A ramp week delivers more than its column promises.
- An unsourced constant is presented as evidence.

## 3. Evidence

- **Per-session dose.** Remmert, Pelland, Robinson, Hinson & Zourdos (2025),
  *Is There Too Much of a Good Thing? Meta-Regressions of the Effect of
  Per-Session Volume on Hypertrophy and Strength*, SportRxiv preprint, **not
  peer reviewed**, last modified March 2025. The point of undetectable outcome
  superiority (PUOS) — where more sets no longer have a >50% chance of a
  detectably larger gain — is **~2 direct sets per session for strength** and
  **~11 fractional sets for hypertrophy**, per measured muscle; "the PUOS should
  be interpreted cautiously." PUOS marks where detectable benefit stops, not
  harm. `[corroborated]` (preprint; same group as the Pelland et al. weekly
  figures already in `VOLUME.SETS_PER_PATTERN_PER_WEEK`).
- **Order.** Power → multi-joint → assistance (NSCA-style default, secondary
  sources), already implemented by `orderSession`. `[corroborated]`
- **What the evidence does not give:** a whole-session limit. Per-muscle doses
  bound how much one pattern gets, not how many patterns a session covers. With
  no source and no clock, a session's size is set by weekly need, dose and
  `MAX_MAIN_SLOTS` — and the athlete's own feedback (§1).

## 4. The admission rule (lifting days)

Templates are walked in order as today. Required slots are always taken. An
**optional** slot is taken only if all of 4.1–4.3 hold.

### 4.1 Weekly need — unchanged
Some pattern the slot can serve has `patternDebt(p, dayType, state) > 0`
(history only; the current session is §4.2's job).

### 4.2 Session dose — new
Among the patterns that pass 4.1, keep those still below their per-session
dose in this session:

`sessionSets(p) < SESSION_DOSE[goal(dayType)]`

- `sessionSets(p)`: direct working sets already in the session on `p`, over
  blocks passing `countsTowardVolume`, counted on the **pre-ramp** set counts
  the fill loop sees (`rampToBudget` runs later). Direct only (plan-07
  decision 1: the library has no indirect map).
- `goal`: max-strength → `strength`; power → `strength`; hypertrophy →
  `hypertrophy`.
- `SESSION_DOSE` in `js/rules.js` `VOLUME`: `strength: 2` (the PUOS);
  `hypertrophy: 10` (reuses `SETS_PER_PATTERN_PER_SESSION`, the stricter of 10
  and the PUOS's 11, already enforced by `capPatternSets`). *My call.*
- **Contacts-mode slots are exempt from 4.2** (power slot E, "second explosive
  expression"): they are dosed in ground contacts, not sets, and slot A already
  puts 3 sets on jump/throw, so a set-based dose of 2 would remove E always.
  They still need 4.1 and 4.3. *My call.*
- If no pattern survives, skip the slot. Otherwise narrow the slot's patterns
  to the survivors before `fillSlot` (the same narrowing the coverage path
  already does with `targets`).

### 4.3 Count — unchanged caps
`MAX_MAIN_SLOTS` (8) and `rampedSlots` (count × ramp volume, floored at the
template's non-coverage slots) stay; both are counts.

**Removed:** the `rampedMinutes` check. **Not added:** the "no second cnsCost-3
movement" rule from the first draft — measured as almost a no-op (6 of the 58
cost-3 entries are reachable by optional-slot tiers), so it is dropped rather
than credited with work it does not do. Intensity enters through the goal: a
strength day stops adding to a pattern after 2 sets, a hypertrophy day after 10.

### 4.4 The return ramp
The ramp's promise is relative to a full-volume session. With the new rules
the full-volume session is larger, so ramp weeks deliver more sets *in
absolute terms* than v79 (week 1: +22% to +45%) while the share may be
unchanged. Requirement, measured with `node tools/measure.mjs ramp`:
**for every lifting day type, each week's mean delivered working sets ≤ its
`RAMP` volume × that day type's week-5 mean under v80.** Builder's
pre-measurement (300 seeds) suggests week 1 lands at ~41% for max-strength
against a 50% column. If any week overshoots, stop and report — the fix is a
dose or count rule, not minutes.

## 5. Time

- Lifting days: `packToBudget` is **not called**; `rampedMinutes` is gone;
  `durationMin` is still computed and shown on the card, from real pricing.
- `tests/session.test.mjs`'s 70-min sweep: lifting day types are removed from
  it (their limit is retired by decision, §1); non-lifting day types keep it.
  A replacement test asserts the anti-goal instead: no required working set on
  a lifting day differs from what `prescribe` + `rampToBudget` +
  `applyArchitecture` produced (nothing downstream trims it).
- `finalise()`'s `overBudget` warning cannot fire on lifting days any more;
  fix its stale "45 min" text while there (constant is 49) for the days that
  still use it.
- Remove the v79 hold completely: `legacyWarmup` (generator.js ~714) and its
  export, `budgetWarmupReps` in `prescribe` (~955), `held` in
  `estimateMinutes`/`blockSeconds`/`pairSeconds`, the hold comments, the
  legacy-ladder tests in `tests/ramp.test.mjs` (it imports `legacyWarmup`),
  and `tests/work-held.test.mjs` + `tests/fixtures/work-v78.json` (their
  purpose — "v79 must not change work" — ends here by design; README entry in
  `tests/fixtures/README.md` updated to say so). `buildWarmup`'s own tests stay.
- `spec.md`'s requirements table: the "Gym session total ≤ 70 min" row is
  marked retired for lifting days, with the date and the athlete's words.

## 6. Measurement — already taken, and to repeat on the built code

Builder pre-measurement on a scratch copy of v79 with these rules (300 seeds,
whole-session minutes):

| Full volume (wk 5) | v79: min / exercises / sets | v80 rules: mean, p90, max min / exercises / sets |
|---|---|---|
| max-strength | 56 / 3.1 / 10.6 | 76, 85, 95 / 5.5 / 17.9 |
| power | 57 / 2.1 / 12.7 | 75, 82, 89 / 3.6 / 17.2 |
| hypertrophy | 58 / 5.2 / 15.5 | 75, 81, 87 / 8.0 / 22.4 |

Required slots alone already average 59 min on max-strength.

The built code is re-measured with a new `compose` sweep in `tools/measure.mjs`
(its existing style): per lifting day type, weeks 1–5, ≥ 300 seeds — exercises,
working sets, sets per pattern (mean, max), `durationMin` (mean, p90, max),
`cnsLoad`. The table goes into `docs/programming-basis.md` and the README, and
to the athlete before merge.

## 7. Docs and version

- `docs/programming-basis.md`: the admission rule, its sources, and the
  decision to have no time limit, quoted.
- `docs/design-architectures.md` §7: `rampedMinutes` removed and why.
- README: "how a session is built" in plain words; sessions now run ~75 min
  on lifting days by design; test count; v80 in `js/version.js` and `sw.js`.
- After merge and push: footer reads v80; one session per lifting day type.

## 8. Left to the builder

- Where `sessionSets` lives (beside `patternDebt` is natural).
- Seeds and output shape of the `compose` sweep.
- Whether `packToBudget` is bypassed by a day-type check in `generate()` or by
  passing no budget — whichever reads clearer.
