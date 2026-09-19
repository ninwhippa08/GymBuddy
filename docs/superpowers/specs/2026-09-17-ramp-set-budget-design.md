# The ramp's percentage becomes a session set budget — design

**Date:** 2026-09-17 · **Status:** BUILT 2026-09-19 on branch `ramp-set-budget` — see §10
**Asked for by:** the athlete, from `design-mobility-and-warmup.md` §13.4
**Ships as:** `sw.js` / `js/version.js` **v78**

---

## 1. The complaint, and what it turned out to be

> "I am doing 2 sets of moves in the main work. Is that normal, I usually do at
> the minimum 3. What are the 2 sets based on?" — 2026-09-11

Answered at the time (§13.4): they are the ramp. `prescribe()` applies
`sets = max(1, round(sets × env.volumeMultiplier))` to each block on its own,
and at a template dose of 3 the multiplier must reach **0.834** before
`round()` returns 3. The `RAMP` volume column is 0.50 / 0.70 / 0.80 / 0.90 /
1.00, so weeks 1, 2 and 3 all return 2 and weeks 4 and 5 both return 3. The
finding was recorded and not acted on.

Re-measured 2026-09-17 at v77, `now = 1e12`, day type forced, ramp week derived
from `returnDate` rather than assumed, 400 seeds per cell:

| delivered working sets, share of full volume | wk 1 | wk 2 | wk 3 | wk 4 | wk 5 |
|---|---|---|---|---|---|
| **the ramp intends** | 50% | 70% | 80% | 90% | 100% |
| max-strength | 63% | 82% | 91% | 100% | 100% |
| power | 53% | 82% | 92% | 99% | 100% |
| hypertrophy | 48% | 69% | 81% | 101% | 100% |
| **hypertrophy slot C, mean sets** | **2.00** | **2.00** | **2.00** | 3.00 | 3.00 |

Two defects, one line of code.

**A. The flat spot.** Slot C holds exactly 2.00 sets for three consecutive
weeks. This is the card he was reading.

**B. Week 4 is a no-op, and nobody had complained about it.** It promises a 10%
cut and delivers none: 100%, 99%, 101%. At a dose of 3, `round(3 × 0.9) = 3`.
He spends a week believing he is held back when he is not. `design-architectures.md`
§7.4 already recorded that week 4 measured 103% and called it "a statement about
the `RAMP` table, not a tolerance" — this is the same finding, and it is one the
session-level fix below settles rather than excludes by name.

**What is NOT broken: the session total.** Hypertrophy delivers 48 → 69 → 81%
across weeks 1–3, close to what the table promises. The progression is real; it
arrives through exercise count and through the slots whose dose is not 3. It is
the exercise in front of him that is frozen.

## 2. Sources

**The 50/30/20/10 rule governs WORKLOAD, not each exercise.** Already cited
`[verified]` at `RAMP` in `js/rules.js`: week 1 at 50% is a statement about the
total training load, not an instruction to scale every exercise by half.
Applying the multiplier per block was an interpretation made in this project,
and it is the interpretation that produced the flat spot. Making the session
total land on the percentage is the more faithful reading of a source the app
already holds. This is the load-bearing source for §4.1.

**Where volume comes off, in practice.** Deload surveys report that strength
athletes cut volume in non-specific accessory work while preserving the main
lifts, that physique athletes spread the reduction across sets and reps, and
that training frequency and exercise selection are generally preserved.
`[unverified]`, and deliberately so: the two surveys are the same research
group's coach and athlete studies — the repo already downgraded them for
`CHRONIC.WEEKS_TRIGGER` for exactly this reason (`design-running-programming.md`,
the `WEEKS_TRIGGER` row) — and they describe **trained athletes taking a planned
easy week**, not an athlete returning from a long layoff. Borrowing the ordering
wholesale was tried in design and rejected on measurement (§3, decision 3). It
survives only as the tiebreak in §4.2, where its evidentiary weight is small
enough to match its tag.

**Largest-remainder apportionment** (§4.2) is arithmetic, not a training claim,
and carries no tag.

## 3. Decisions (all made by the athlete in chat, 2026-09-17)

1. **Fix both defects with one change**, rather than the flat spot alone or the
   week-4 no-op alone. "The ramp's percentages should be what actually lands."
2. **A session set budget**, not carry-rounding and not a retuned volume column.
   Retuning the column was declined in design: it fits the most important safety
   constant in the app to an artifact of `Math.round`, and it would only work for
   exercises dosed at 3.
3. **Shared distribution, not strict backwards.** Both were measured (§6). Strict
   protects the main lift and pins accessories at a single set until week 4;
   shown that it would hand him ~5 sets of a heavy power lift in his first week
   back where today he gets 3, he chose shared. The recommendation in chat was
   strict and was withdrawn before he answered: the source behind it is about
   trained athletes in a planned easy week, and borrowing it for a returning
   athlete was a stretch.

## 4. Design

### 4.1 The budget — `rampToBudget()` in `js/generator.js`

`prescribe()` stops scaling sets for any block the budget covers. The line

```js
sets = Math.max(1, Math.round(sets * env.volumeMultiplier));
```

no longer applies to them; each block is drawn at its full template dose.

A new step runs **after the fill loop and before `applyArchitecture`**. Before,
not after, because the architecture builds ladders and waves out of the set
count and removing a set afterwards would leave a rung dangling — the same
ordering rule `capPatternSets` already obeys at step 8a for a different reason.

```
fill loop → rampToBudget → applyArchitecture (7a) → packToBudget (8)
          → capPatternSets (8a) → pairAntagonists (8b)
```

It counts the session's working sets, takes `budget = max(1, round(total ×
volume))`, and distributes by §4.2.

**What the budget covers is `countsTowardVolume`** — modes `load`, `contacts`
and `reps`, excluding roles `core` and `prep`. That is the line the app already
draws for `patternSets` and `cnsLoad`, and using it means the ramp's arithmetic
cannot drift from the app's own definition of training volume.

**Everything the budget does not cover keeps `env.volumeMultiplier` exactly as
today.** That is modes `time` and `interval`, plus core and prep. This is
written down because removing the multiplier wholesale would silently *raise*
interval and core work during the ramp — the class of hole this repo keeps
finding. Those blocks keep their own rounding coarseness; at interval
doses of `[4, 6]` and `[6, 10]` it is finer than at 3, and it is not what he
asked about.

### 4.2 The distribution — shared, with the leftover by largest remainder

For each covered block: `exact = sets × volume`, and the block starts at
`max(floor, ⌊exact⌋)`. The sets that the flooring left unspent — `budget` minus
the sum of those starts — are handed out one at a time in descending order of
fractional remainder. That quantity can be **negative**, when the floors alone
already exceed the budget; nothing is handed out and nothing is removed, and
§4.3 is what that means. **A tie goes to the earlier slot**, which is the more
specific one, because the template is already a priority order and §4.4 of the
mobility design says so in those words. No block is ever handed back more sets
than it drew.

This is the only place the deload-ordering source is used, and it is used as a
tiebreak rather than as the rule.

### 4.3 Floors, and an overshoot that is reported rather than hidden

Floors are `capPatternSets`'s, reused rather than reinvented: never below 1 set,
never below 2 for a block carrying a `setPlan`, and a removed set splices the
last `work` entry off `setPlan`. Both functions now need "remove one working set
and keep `setPlan` coherent", so that becomes one small shared helper rather
than two copies.

Floors can hold the delivered total **above** the budget. Measured in design at
7.3% of max-strength week-1 sessions under strict; it will differ under shared
and is re-measured at the gate. When it happens the session delivers more than
the ramp asked for. That is left visible and asserted in a test rather than
forced down by a mechanism invented for the purpose.

### 4.4 A swap keeps its set count

`swapBlock()` calls `prescribe()`, so with the ramp out of `prescribe()` a
swapped block would come back at full dose — the same hole the code already
documents at `js/generator.js:1270`, where a swap in `reps` mode escaped the
load ceiling entirely. **A swapped block inherits the set count of the block it
replaces.**

This is a behaviour change beyond the ramp and is named as one: today, swapping
an exercise re-rolls `intBetween(rng, slot.sets)` and can hand back 4 sets where
there were 3. After this it cannot, at any volume. Swapping a movement is not a
way to change how much work the session holds.

### 4.5 The §7.4 damper is measured, not reasoned about

`design-architectures.md` §7.3 traced a feedback loop: the ramp cuts sets, so
every block costs fewer minutes, so the fixed coverage time guard stops binding
exactly when the ramp works hardest, so coverage spends the freed minutes on
more movements. §7.4 damped it by scaling that guard — `rampedMinutes` — inside
the optional-slot branch.

**This design removes the loop's root cause.** The fill loop now draws blocks at
full dose, so `estimateMinutes(blocks)` sees full-size blocks and the guard
binds exactly as it does at full volume. `rampedMinutes` would then be cutting a
second time for a reason that no longer exists.

It is **not deleted on that reasoning.** Reasoning about this exact mechanism is
what got it wrong twice — once when `weeklySetTarget` was made ramp-aware and
changed nothing because the guard reads a boolean, and once when the time budget
was scaled globally and `packToBudget` trimmed required work with it. The build
keeps it, measures, then measures with it removed, and both tables go to the
athlete. He decides at the gate, as he did with the 120-second rest.

`rampedSlots` stays either way. It is a deliberate "fewer movements while
ramping" rule decided on 2026-09-01, not loop compensation, and §7.3 already
records that it is inert from ramp week 2 onward.

## 5. What does not change

- `RAMP` itself. Not one number in the table moves. The column is a safety
  constant and this change is about what the app does with it.
- `STANDING_PCT_CEILING`, `pctCeiling`, and every load bound. This is volume
  only; nothing here touches what is on the bar.
- `packToBudget`, `capPatternSets` and the ten-sets-per-pattern cap. They run
  after the budget and still bind. The budget does not replace the clock.
- Reps, rest and reps in reserve — v77's `LOAD_GROUPS` path is untouched.
- Full volume. At week 5 the multiplier is 1.00, the budget equals the drawn
  total, and every GENERATED session is identical to today's for the same seed.
  **This is a test.** A swap is the exception and is meant to differ: §4.4
  changes it at every volume, including full.

## 6. Testing

Every guard is watched failing before the code exists, and the ones that pass on
the first run are mutation-tested — a green guard proves nothing.

1. **The flat spot.** Delivered working sets increase strictly from week 1 to
   week 5 on every lifting day type. Fails today: hypertrophy slot C is 2.00
   three weeks running.
2. **Week 4 cuts.** Week 4 delivers strictly less than week 5. Fails today at
   100%, 99% and 101%.
3. **The budget is met.** Delivered equals `round(unramped × volume)` except
   where floors bind; the overshoot is asserted to be floor-caused and bounded.
4. **Full volume is unchanged.** Week 5 sessions are identical to v77 for the
   same seed.
5. **A swap keeps its sets.** Fails today.
6. **Ladders are still built** after the budget runs, and `capPatternSets` and
   `packToBudget` still bind after it.
7. **Nothing outside the budget lost its multiplier** — an interval and a core
   block are still ramped.

Smoke tests run through `generate()`, never through `prescribe()` alone.

## 7. Measurement gate

Before anything ships, at 3,000 seeds per day type, `now = 1e12`:

- delivered sets by week and day type, against the ramp's own column
- mean sets per slot by week, to show where the cut landed
- session length, worst and mean, per day type
- exercise count per session by week
- the floor-bound overshoot rate
- all of the above with `rampedMinutes` in place and with it removed (§4.5)

The design figures come from a throwaway probe over full-volume compositions and
**counted only modes `load` and `reps`** — power's slot A is a `contacts` block,
so the power figures will move. Nothing from the probe is quoted as a result.

## 8. Documentation

- `docs/programming-basis.md` — discrepancy 10: the ramp's percentage was
  applied per exercise, and `round()` on a dose of 3 cannot express it.
- `docs/design-mobility-and-warmup.md` §13.4 — from "Not changed here" to the
  fix, with the decision and the measured before/after.
- `docs/design-architectures.md` §7.4 — what happened to the damper.
- `README.md` — design decisions: the budget, and the swap consequence.
- `sw.js` and `js/version.js` → v78.

## 9. Out of scope, recorded

- **The `RAMP` column's values.** Unchanged, deliberately (§5).
- **Coverage bounded on delivered sets rather than minutes.** §7.4 named this as
  what "breaking the loop" would mean. This design removes the loop's cause but
  leaves the coverage guard reading minutes; §4.5's measurement may make the
  case for the larger change, and it would be its own spec.
- **Core and interval rounding.** Named in §4.1, not fixed.
- **A floor of 2 sets for every working exercise.** Offered and declined in
  favour of shared distribution, which does not pin anything at 1.

## 10. As built

Shipped 2026-09-19, `sw.js` / `js/version.js` v78. `prescribe()` no longer
scales sets for blocks the budget covers. `rampToBudget()` runs once per
session between the fill loop and `applyArchitecture()`, taking `budget =
round(drawn × volume)` over `countsTowardVolume` blocks and distributing the
leftover whole sets by largest fractional remainder, ties to the earlier
(more specific) slot. Floors are 1 set, or 2 for a block carrying a warm-up
ladder. `finalise()` records `session.rampSets = { drawn, budget, delivered
}`. A swapped block inherits its set count via an optional forced draw
threaded into `prescribe()`. Suite 641 → 660.

Five things this spec got wrong or could not know, each measured rather than
argued:

**1. §4.5's damper prediction was overturned.** §4.5 expected `rampedMinutes`
to be damping a loop this change removes, and planned to measure it for
removal. Measured instead (Task 3 report, three-configuration sweep, 300
seeds/cell, `now = 1e12`): removing either fill-loop cap (`rampedSlots` or
`rampedMinutes`) makes **every** lifting day type overshoot full volume at
**every** ramp week — max-strength week 4 reaches **102%**, above what a
fully recovered athlete gets. Both caps stay, untouched. Neither was edited
in the shipped code.

**2. §4.1's "core and prep keep `env.volumeMultiplier` exactly as today" was
true in effect, wrong about the mechanism.** Core and prep never reach
`prescribe()` at all: `buildBlockGroups()` routes `MOBILITY_BLOCK_MODES`
(`drill`, `hold`, `core`) to `prescribeMobility()`, which takes no `env` and
has never applied a ramp multiplier, before this change or after it. Core
work has never been ramped in this app. **Open question for the athlete,
not decided by this build: should core be ramped at all?**

**3. §6 test 3 ("delivered equals `round(unramped × volume)`") was written
against a metric that cannot express it.** `packToBudget`'s clock ceiling is
fixed and never ramped, and it trims week 5 in 109–244 of 300 sessions while
week 4 escapes it in all but 1–7 (Task 3 report) — so "share of full volume"
divides by a denominator the clock has already cut, which flatters week 4 and
buries week 1. The guards in `tests/ramp-budget.test.mjs` assert against
`rampSets` instead. The consequence is plain: at full volume the clock
discards **13–17%** of the sets a session drew — `delivered/drawn` at week 5
is 83.0% max-strength, 86.6% power, 87.1% hypertrophy (Task 5 report, 3,000
seeds/cell).

**4. A regression this change introduced, and a guard caught.** `footContacts`
and `sprintMeters` are denormalised in `prescribe()` from the set count as
drawn, and `dropWorkingSet` did not update them, so a ramped session
OVERSTATED both: a power day reported 6.97 against 4.65 actual at weeks 1–2,
and reported a FLAT 7.0 across weeks 1–4 (Task 3 report, fix round) — the same
flat spot this change removed from sets, surviving inside the counter. Fixed
by storing per-set rates (`contactsPerSet`, `metersPerSet`) on the block and
deriving both counters at every set removal. This is the third structurally
blind counter found in this project, and nothing had guarded it before the
fix round's new test.

**5. The athlete's decision at the measurement gate, 2026-09-19.** Week-1
hypertrophy delivers ~34% of a recovered session where the table prints 50%,
because the fill-loop caps cut the exercise count from 5.17 to 3.02 and the
budget then cuts the sets inside those three — two cuts of one fraction each
(Task 5 report). Shown the tables, he accepted it and chose to record it
rather than engineer it away. He declined two alternatives: raising the
early-week exercise floor, and changing what the card prints.

### Final tables (Task 5 report, 3,000 seeds/cell, shipped configuration)

**max-strength**

| wk | RAMP | budget/drawn | delivered/drawn | vs full(wk5) |
|----|------|-------------:|-----------------:|--------------:|
| 1 | 50% | 52.3% | 52.3% | 56.7% |
| 2 | 70% | 69.7% | 69.6% | 75.6% |
| 3 | 80% | 81.1% | 80.3% | 87.8% |
| 4 | 90% | 91.6% | 86.9% | 98.5% |
| 5 | 100% | 100.0% | 83.0% | 100.0% |

**power**

| wk | RAMP | budget/drawn | delivered/drawn | vs full(wk5) |
|----|------|-------------:|-----------------:|--------------:|
| 1 | 50% | 51.6% | 51.6% | 49.0% |
| 2 | 70% | 71.0% | 71.0% | 67.4% |
| 3 | 80% | 80.7% | 80.7% | 78.4% |
| 4 | 90% | 89.2% | 88.9% | 94.8% |
| 5 | 100% | 100.0% | 86.6% | 100.0% |

**hypertrophy**

| wk | RAMP | budget/drawn | delivered/drawn | vs full(wk5) |
|----|------|-------------:|-----------------:|--------------:|
| 1 | 50% | 52.5% | 52.6% | **34.2%** |
| 2 | 70% | 69.7% | 69.7% | 55.2% |
| 3 | 80% | 79.6% | 79.6% | 71.9% |
| 4 | 90% | 89.7% | 89.7% | 93.6% |
| 5 | 100% | 100.0% | 87.1% | 100.0% |

Full method, per-slot mean sets, floor-forced rates and the three-configuration
damper sweep are in `.superpowers/sdd/2026-09-17-ramp-set-budget/task-5-report.md`
and `task-3-report.md`.
