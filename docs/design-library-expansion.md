# Design — library expansion (Project A)

Status: approved 2026-08-24, not yet implemented.
Predecessor: `design-mobility-and-warmup.md` step 1 (the mobility split), shipped.
Successor: Project B — day-type proposal and block logic.

## 1  Why

Two months of use surfaced the same complaint from two directions: the same
movements keep coming back, and a sore joint can empty a block. Both are the
same fact — the pools the generator draws from are too shallow to absorb either
repetition or a filter.

Measured baseline: **186 entries**, of which the working pools are far smaller
than that total suggests. `mobility-static` holds **6 entries at the outdoor
venue** against a block that draws up to 4. That is not a library, it is a
rotation of six.

## 2  What this project is not

It does not change the generator, the templates, the doses or the schema. It
adds rows to `data/exercises.json` and the tests that say how many rows are
enough. Any behaviour change found along the way is recorded for Project B, not
fixed here.

## 3  The rules

The original brief carried one rule — "no movement repeats inside ~16 sessions,
about two months at 2x/week". Applied to the whole library that rule is wrong in
two different ways, so it is split into three.

### 3.1 FLOOR — every pool that can have one

> A pool must still fill its block's **minimum** count when any one joint is hurt.

```
floor    = ceil(drawMin / survival)
survival = (pool size with the worst single joint hurt) / (pool size)
```

`survival` is **[measured]**, not assumed — it is computed against the real
library by the coverage test, because which joint hurts a pool worst is a fact
about the data and moves as the data moves.

A block that cannot fill is a session the athlete cannot do. This rule outranks
the other two.

**The one exception**, stated here so it is not a surprise in section 5: where
`survival` is 0 the formula has no answer, because every entry in the pool loads
the joint. Those four pools are exempt and listed in section 5. Exemption is not
a judgement call — it is `survival === 0`, measured, and the test names each
exempt pool so a fifth cannot appear silently.

### 3.2 VARIETY — main-work pools only

> A main-work pool holds at least `16 x drawMax` distinct movements.

**"Main-work pool"** means a pool drawn by a slot in `TEMPLATES` — the work
between the prep and the cool-down. Equivalently: every pool that is not
`mobility-static`, `mobility-dynamic`, or the `core` tier. The test derives the
distinction from where the slot came from, not from a list it keeps.

**16 sessions** is the athlete's own choice: about two months at his irregular
1–3x/week. It is a preference, not a finding, and is tagged as such.

The rule is restricted to main work because its premise is novelty. Varying the
stimulus is how strength, power and hypertrophy work keeps adapting. That
premise does not hold everywhere — see 3.3.

**Amended 2026-08-25: `aerobic-steady` is exempt from VARIETY.** It is the one
main-work pool where the rule's premise fails, and the exemption is recorded here
rather than applied quietly because it lowers a target.

The honest reason is the *absence* of a basis, not evidence of harm — and that
distinction matters, because it is weaker than the case made for stretching in
3.3. A 2026 systematic review and meta-analysis of cross-training between running
and cycling found **no statistically significant differences** in VO2max or
running performance between mode-matched and cross-trained groups, with cycling
substituted for 20–50% of running volume over 4–10 weeks. **[sourced]** Its
authors are careful that this is an *absence of detected decline* rather than
proof the modes are interchangeable, and note small, non-significant trends
favouring whichever modality matched the test, consistent with training
specificity.

- Menges, T., Dindorf, C., Dully, J., & Fröhlich, M. (2026). Cross-training
  between running and cycling: effects on VO2max and running performance — a
  systematic review and meta-analysis. *Frontiers in Sports and Active Living*,
  8, 1843803. https://doi.org/10.3389/fspor.2026.1843803

So, unlike static stretching, there is no finding that rotating aerobic
modalities would *defeat* the adaptation. What there is no finding for either is
that **novelty drives** it — and novelty is the whole premise of VARIETY.
Aerobic adaptation is driven by accumulated time at intensity, which a single
movement delivers as well as sixteen. Applying a novelty rule to this pool was
therefore an unexamined inheritance from the pools where the premise does hold.
**[unverified]** — a design judgement, revisable if a basis for aerobic movement
variety appears.

There is a second, practical confirmation: **the movements do not exist.** Ruled
honestly, outdoor steady-state locomotion offers about ten distinct movements,
not sixteen. Reaching sixteen would mean entering "Long Run", "Recovery Jog" and
"Progression Run" as separate rows — the same movement at three doses. That is
discrepancy 5's failure exactly, and a rule that can only be satisfied by
padding is a rule that has stopped meaning anything.

### 3.3 COVERAGE — mobility and core

> Every joint **in the pool's declared scope** carries at least 3 options.

Static stretching adapts by *repetition*, not novelty. Chronic range-of-motion
gains come from returning to the same position over weeks: the ACSM-conforming
trials hold the stretch dose and the positions constant across 12 weeks, and the
meta-analysis attributes chronic ROM gain to increased stretch tolerance built by
repeated exposure. **[sourced]**

- Systematic review / meta-analysis of acute vs chronic static stretching:
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12152101/
- 12-week ACSM-protocol hamstring flexibility trial:
  https://www.researchgate.net/publication/42390759

So rotating 64 stretches so that none repeats inside 16 sessions would defeat the
adaptation the cool-down exists to produce. What these pools need is not novelty
but **coverage**: whichever joint needs work has options, and a hurt joint
elsewhere does not take them away.

**Declared scope** — the coverage rule applies to the joints a pool is
responsible for, not to all nine. Demanding three wrist options from the core
pool is how a rule stops meaning anything.

| pool | scope (>= 3 each) | >= 1 each | rationale |
|---|---|---|---|
| `mobility-static` | hip, knee, ankle, lumbar, thoracic, shoulder, scapula | elbow, wrist | the seven that lifting and running actually restrict |
| `mobility-dynamic` | hip, knee, ankle, lumbar, thoracic, shoulder, scapula | elbow, wrist | same |
| `core` | lumbar, thoracic, hip | — | core work is trunk work |

`3` is the smallest number that survives one option being banned and one being
drawn earlier in the same session and still leaves a choice. Not sourced — a
design floor, tagged `[unverified]`, to be revisited if a better basis appears.

### 3.4 Precedence

`FLOOR` > `VARIETY` / `COVERAGE`. A pool's requirement is the maximum of the
rules that apply to it.

## 4  The measured shortfall

Derived from the templates and the current library on 2026-08-24. **These
numbers are an output, not a target** — see section 7.

### Main work (FLOOR + VARIETY)

| pool | draw | have | survival | floor | variety | need | add |
|---|---|---|---|---|---|---|---|
| `locomotion / aerobic-steady` | 1 | 6 | 0% | — | 16 | 16 | 10 |
| `primary / hypertrophy` | 1 | 7 | 29% | 4 | 16 | 16 | 9 |
| `sprint` | 1 | 7 | 0% | — | 16 | 16 | 9 |
| `primary / hinge+pull-h / power` | 1 | 9 | 0% | — | 16 | 16 | 7 |
| `squat+push / power` | 1 | 9 | 22% | 5 | 16 | 16 | 7 |
| `jump+throw / power` | 1 | 10 | 20% | 5 | 16 | 16 | 6 |
| `accessory lunge+carry+rotate` | 1 | 12 | 25% | 4 | 16 | 16 | 4 |
| `primary / max-strength` | 1 | 14 | 29% | 4 | 16 | 16 | 2 |
| five further pools | 1 | 26–63 | 41–62% | 2–3 | 16 | 16 | 0 |

**Main-work shortfall: 54.**

### Mobility and core (FLOOR + COVERAGE)

| pool | draw | have | floor | joint-slots short |
|---|---|---|---|---|
| `mobility-static` | 4 | 6 (outdoor) | 9 | knee 2, ankle 2, lumbar 1, thoracic 2, shoulder 2, scapula 1 |
| `mobility-dynamic` | 4 | 12 | 6 | knee 0, ankle 2, lumbar 1 |
| `core` | 2 | 16 | — | thoracic 2, scapula 1 |

**Mobility + core shortfall: ~22 entries.**

### Total

`186 + 54 + ~22 = ~262`.

The brief's "+300 to about 500" came from applying `16 x draw` to every pool,
including the two where the rule inverts. Withdrawn, and recorded here so the
withdrawal is not silent — the same treatment discrepancy 5 gave the 25-minute
mobility budget.

## 5  Finding for Project B — pools that reach zero

Four pools lose **every** entry to a single hurt joint. No amount of authoring
fixes them, because the joint is intrinsic to the movement class:

| pool | dies on | entries loading that joint |
|---|---|---|
| `core / core+rotate` | lumbar | 19 of 19 |
| `locomotion / aerobic-steady` | knee | 10 of 10 |
| `sprint` | ankle | 16 of 16 |
| `primary / hinge+pull-h / power` | hip | 9 of 9 |

An empty pool on a hurt joint is the **correct** answer. The defect is that the
generator can commit to a day type before discovering a slot it cannot fill.
That is day-type proposal logic — Project B. These four pools are exempt from
FLOOR and carry a permanent exemption note in the test.

Counts are as of each pool's closing commit; the *pools* are the finding, not
the numbers, and the test measures both fresh on every run. The `sprint` row
shows why that distinction is load-bearing — see §5.3.

### 5.1 Ruling C1's six drills cannot reach the mobility pools — found 2026-08-25

Ruling C1 (plan-01) recorded that `a-skip`, `b-skip`, `high-knees`,
`pogo-hop`, `wall-drill` and `cossack-squat` are genuine dynamic warm-up
drills and named them the obvious way to fill `mobility-dynamic`'s empty
`knee` scope. **Closing that pool showed they cannot be, and the reason is
structural rather than a matter of judgement.**

`eligibleFor` filters a prep slot on `tier` *and* `pattern` as well as
modality, and both fields are single-valued:

    if (!slot.tier.includes(e.tier)) return false;
    if (slot.patterns && !slot.patterns.includes(e.pattern)) return false;

`PREP_BLOCK` asks for `tier: ['mobility'], patterns: ['mobility']`. All six
drills are `tier: accessory` with pattern `sprint`, `plyometric` or
`hypertrophy`. Adding `mobility-dynamic` to their `modalities` therefore
does nothing — the tier check rejects them first. The three ways out are all
blocked here:

1. **Re-tier them to `mobility`.** They leave the sprint pool, which holds 7
   against a target of 16 and is already the second-shortest in the library.
   Fixing a covered joint by emptying a short pool is not a trade.
2. **Author duplicate entries** under near-identical names. Two rows for one
   movement, and the duplicate-name guard of §8 exists to prevent exactly that.
3. **Make `tier`/`pattern` multi-valued.** A schema and generator change,
   which §2 puts outside this project.

**Recorded, not fixed.** `mobility-dynamic`'s `knee` scope was closed with
three purpose-authored drills instead (Knee CARs, Squat to Stand, Walking Quad
Pull), so nothing is blocked. But the underlying question — whether one movement
may serve both as prep and as accessory work — is a Project B question, and it
is the same shape as the day-type problem in §5: the data model says a movement
has one role, and training reality says some movements have two.

### 5.2 The core slot's `rotate` branch is almost dead — found 2026-08-25

The same single-valued-`tier` fact has a second consequence, found while
closing the `core` pool. `COOLDOWN_BLOCK`'s core slot asks for
`tier: ['core'], patterns: ['core', 'rotate']`, but of the four `rotate`
entries in the library three are `tier: accessory` — `cable-woodchop`,
`landmine-rotation` and `half-kneeling-cable-chop`. Only `russian-twist`
is both. **Naming `rotate` in that slot therefore buys exactly one entry**,
and a reader of the template would reasonably assume it buys four.

Harmless today: pattern does not restrict inside the pool, since the slot admits
both patterns, so the drawn set is simply every `tier: core` entry. It matters
only if the slot is ever narrowed to `rotate` alone, or if someone counts the
rotate pool from the template rather than from the data. **Recorded for Project
B alongside §5.1** — both are the same question about whether a movement has one
role or several.

### 5.3 The `sprint` pool is the strides slot, and it changed joints — found 2026-08-25

Closing the pool corrected two things §5 had wrong.

**It is not a sprint day.** `PHASE_1_DAY_TYPES` holds four day types and `sprint`
is not among them — it arrives in Phase 2. The pool the matrix calls
`secondary+accessory :: sprint :: sprint` is fed by exactly one slot:
`AEROBIC_STEADY` slot B, `role: 'strides'`, `optional: true`. So the original
wording — "the generator proposed a sprint day and only then discovered it had
nothing to put in it" — described a day type that does not exist yet.

What happens today is benign. `fillSlot` returns nothing, the slot is recorded
in `unfilled` and skipped, and because it is optional the session is complete
without it. The Project B question survives the correction, because the same
shape returns the moment a real sprint day exists: a *required* slot on a day
the generator has already committed to. Restated, not withdrawn.

**The pool stopped dying on hip and started dying on ankle.** All 7 original
entries loaded hip, which is what earned the FLOOR exemption. Of the nine drills
authored to close it, `ankling` honestly loads only ankle and knee — it is a
foot-and-shin stiffness drill cycling under the hip, and a hurt hip is no reason
to skip it. That one honest joint list broke the hip collapse. The pool stayed
exempt anyway, because all 16 entries load the ankle.

Nobody decided this. Survival is measured against the real library on every run,
and `FLOOR_EXEMPT` is asserted for *exact* equality against what is measured, so
a pool changing its mind about which joint kills it is visible rather than
silent. §6's argument, demonstrated: a survival table written down on 2026-08-24
would be wrong today, and nothing would have said so.

## 6  How the rules are expressed

The coverage test **derives** its targets at run time from `TEMPLATES`,
`PREP_BLOCK` and `COOLDOWN_BLOCK`: it reads each slot's draw, measures survival
against the real library, and asserts

```
pool size >= max(floor, variety or coverage)
```

No per-pool number is written down anywhere. Change a template's `count` and the
target moves with it. Only two *policy* inputs are constants, and both carry
their provenance in the test file:

- `SESSIONS_BEFORE_REPEAT = 16` — the athlete's preference
- `OPTIONS_PER_JOINT = 3` — design floor, `[unverified]`

The rejected alternative was a committed `coverage-targets.json`. It reads well
and drifts silently from the templates, which is exactly the failure
discrepancy 5 exists to prevent.

The test writes the derived table to `docs/coverage-matrix.md` so the targets can
be read without running anything.

## 7  Targets are minimums

Every assertion is `>=`. Nothing caps a pool. Two consequences:

1. Overshooting a target never fails the suite.
2. A movement can be added at any time, on sight, without re-deriving anything —
   the athlete spotting something at the gym and asking for it is a supported
   path, not an interruption. It needs only to pass the schema guard and the
   sanity checks in section 8.

The library is built pool by pool *and* stays open.

## 8  Schema and quality

New entries use the existing schema unchanged. Rules for authoring:

- `venue: "either"` unless the movement genuinely needs a rack, a machine or
  measured ground.
- `joints` is never empty, and lists what the movement actually loads — it is the
  soreness filter's only input, so a lazy joint list is a safety defect.
- `loadable: true` requires a `prRef` into one of the six PR roots
  (`back-squat`, `deadlift`, `bench-press`, `overhead-press`, `power-clean`,
  `snatch`) and a `prCoef`. **A `prCoef` is a dose and carries a provenance tag.
  The movement itself does not** — an exercise is a name, not a claim.
  **Enforced since 2026-08-25** by `tests/coef-provenance.mjs` and
  `tests/coefficients.test.mjs`. Until that day this rule had never been
  applied and all 30 coefficient claims were unsourced — see basis
  discrepancy 8. New loadable movements must arrive with a sourced
  coefficient; the backlog is frozen by a budget that only falls.
- `requiresMeasuredGround` stays opt-in; it removes an entry from every pool.

Guards, as tests:

- no empty `joints`, no empty `modalities` (extends the existing checks)
- every `prRef` resolves to a PR root; every loadable entry has a `prCoef`
- no duplicate `id`, no duplicate `name`
- the coverage matrix of section 6

Human review: each pool's commit message carries the pool's new entries as a
table for the athlete to read. He is the one who has to perform them.

## 9  Build order

One commit per pool, each a safe stopping point.

1. `mobility-static` — thinnest pool, and the blocker for Project B
2. `mobility-dynamic`
3. `core`
4. `locomotion / aerobic-steady` and `sprint`
5. the three `power` pools
6. `primary / hypertrophy`, `accessory lunge+carry+rotate`,
   `primary / max-strength`

The coverage test lands **first**, red, before any authoring. It is the
executable form of this document.

## 10  Open questions

1. `OPTIONS_PER_JOINT = 3` is a design floor with no source. If a basis appears
   for a different number, the whole matrix moves with one constant.
2. `COOLDOWN_BLOCK.short`'s `count: [2, 3]` is still `[unverified]`, and
   `packCooldown` still refuses to trim statics below 3 while the shortfall
   warning now uses the block's own minimum of 2. Harmless while the short block
   never asks for more than 3; reconcile if that count is ever sourced.
3. Whether `elbow` and `wrist` deserve `>= 3` rather than `>= 1` once the athlete
   has been training long enough to have an opinion.
4. **`aerobic-steady` now has no numeric target at all, and that is a hole.**
   It is FLOOR-exempt (every entry loads the knee, §5), VARIETY-exempt (§3.2),
   and outside every COVERAGE scope, so all three rules pass it through and the
   matrix reads `need 0`. Nothing would flag the pool shrinking back to two
   entries. The rules as written have no clause for "a pool that adapts by
   repetition but has no joints to cover", and inventing a number for it is the
   one thing this document exists to prevent. **Left open deliberately.** The
   plausible shapes are a mode-coverage rule (≥1 option per locomotion mode the
   athlete can access) or simply a non-shrink ratchet; both need deciding, not
   guessing.
