# Design — library expansion (Project A)

**Status:** built. Approved 2026-08-24; the coverage matrix and the pool
targets shipped with it, and §11's derivation method was added and piloted on
`core` on 2026-09-04. Open questions 4 and 5 are deliberately unresolved and
say why.
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

**Amended 2026-08-25: for the two dynamic-effort pools, VARIETY's premise is
sourced rather than assumed.** Working the `power` pools turned up the opposite
of the aerobic-steady case. The dynamic effort method — submaximal load moved at
maximal velocity, to train rate of force development — is *built* on rotating the
variation: a three-week wave, after which the bar type, band tension or
percentage changes to supply a new stimulus, and upper-body work rotates grip
within the session. **[sourced]** So for `squat/push-h/push-v :: power` and
`hinge/pull-h :: power`, novelty is not an inherited assumption; it is the
method. `16 x drawMax` stands with no exemption argument to answer.

- Westside Barbell, *The WSBB Guide to Dynamic Effort Training*.
  https://www.westside-barbell.com/blogs/the-blog/the-wsbb-guide-to-dynamic-effort-training
- GymAware, *The complete guide to Dynamic Effort Method*.
  https://gymaware.com/the-complete-guide-to-dynamic-effort-method/

The same source closed part of the gap without authoring anything. Bar-type and
grip rotation are named variations, and the library already held both:
`safety-bar-squat` and `close-grip-bench-press` were tagged `max-strength` and
`hypertrophy` only. Tagged `power` on 2026-08-25 — the pool was short on tagging,
not moves, the same finding as `8ce9c70`. `floor-press` and `incline-bench-press`
were considered and **not** tagged: they are range-of-motion variants, which is
not one of the three rotations the source names.

**Amended 2026-09-06: the exemption is keyed on the pool, not the modality, and
six more pools joined it.** `VARIETY_EXEMPT_MODALITIES` — a set holding the one
string `'aerobic-steady'` — became `VARIETY_EXEMPT_POOLS`, a set of pool keys,
which is the form `FLOOR_EXEMPT` and `CLOSED_POOLS` already use. The reason is
the one `FLOOR_EXEMPT`'s own comment gives: entries are named individually so a
fifteenth cannot appear silently. A modality key silently covers every pool that
ever acquires that modality, which is how a rule governing thirty-two pools gets
widened by a line that reads as though it names one. It also could not express
the jump pools at all, which carry `modality: null`.

The six that joined, on the athlete's decision of 2026-09-06: the `interval` and
`tempo` halves of the `run/erg` pool, split out of `aerobic-steady` on
2026-08-27 and carrying the same argument at a different work interval; the three
sprint pools, where variety comes from distance, rest and effort rather than from
a sixteenth way to sprint; and the low-intensity plyometric finisher, where the
ten missing entries would be pogo-hop and line-hop variants. The reasoning — and
the measurement error that kept two jump pools *out* of the exemption — is in
`design-running-programming.md` §11.0.

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

### 5.4 A pool where VARIETY is right and still cannot be met — found 2026-08-25

`primary :: hinge/pull-h :: power` is the one pool this project did not close.
It reached **13 of 16** and stopped there deliberately.

Everything honest was already spent on it. `sumo-deadlift` was tagged `power`
to agree with `deadlift`, which was already tagged. `clean-high-pull` was
re-tiered to primary to agree with `clean-pull`, which is the same pull
continued higher. `snatch-grip-deadlift` and `squat-clean` were authored. That
is 9 → 13, and the remaining three have no honest source:

- **A fourth clean height or a third snatch height.** The library already holds
  power, hang-power and high-hang cleans. Adding hang-snatch, high-hang-snatch
  and block-clean is one movement at several bar positions — the exact failure
  §3.2 refused when it declined to enter "Long Run", "Recovery Jog" and
  "Progression Run".
- **Re-tiering assistance lifts into primary.** `muscle-snatch` is a technique
  drill, `pendlay-row` is an assistance lift, `dumbbell-snatch` and
  `kettlebell-swing` are secondary by the same convention that puts
  `dumbbell-bench-press` there. Moving them up to make a count is the tier
  becoming a knob instead of a claim.

**This is a new shape, and it is not the aerobic-steady case.** There the rule
was wrong for the pool: novelty does not drive aerobic adaptation, so VARIETY
was exempted. Here the rule is *right* and sourced — the dynamic effort method
is built on rotating the variation (§3.2) — and the inventory is simply finite.
A correct rule that cannot be satisfied is a different problem from an
incorrect one, and it must not be solved by quietly exempting the pool.

Measured, so Project B has a number rather than an impression: widening the
slot from `tier: ['primary']` to `['primary', 'secondary']` — which slot C of
the same day already is — would take the pool to **about 15**, still short.
So widening helps and does not finish the job.

**Left open, and the pool is NOT in `CLOSED_POOLS`.** The matrix keeps
reporting `short 3` every run, which is the honest state.

> **UPDATED 2026-09-07: 13 became 14, and the wall got a second brick.**
> `squat-snatch` was the one honest addition left — catch depth, not bar
> position, on the precedent `squat-clean` already set — and it arrived with a
> sourced coefficient. The other two are now blocked twice over: by §3.2 as
> before, and by the coefficient ratchet, which the two movements with the best
> training case behind them (jump shrug, mid-thigh pull) cannot satisfy because
> a pulling derivative has no 1RM of its own to take a ratio of. §19.3. The three plausible
resolutions each need deciding rather than guessing: widen the slot's tier (a
template change, which §2 puts outside this project); accept a lower repeat
horizon for this one pool; or accept 13 and record why. See open question 5.

### 5.5 `power-snatch` at 1.00 × `snatch` — RESOLVED 2026-08-25

**The athlete's answer: the `snatch` root is his power snatch.** Parity is
therefore definitional, the coefficient stands unchanged, and the ~14% overload
described below never existed. Tagged `verified` in the register — for "what
does his PR refer to", the primary source is him — which retires the first
entry from the backlog and lowers `UNVERIFIED_BUDGET` from 30 to 29.

It also makes the neighbours more coherent rather than less. `snatch-pull` at
1.15 and `overhead-squat` at 1.10 of a *power* snatch land near 101% and 97% of
a full snatch, which is where coaching guidance puts them. They stay
`unverified` — coherence is not a source — but they no longer look odd, and
that is mild corroboration that the root always meant a power snatch.

One consequence left open: `ui.js` renders the card as `× Snatch PR`, which is
now known to mean a power snatch. There is no PR-entry field in the app today,
so nothing can be mis-entered, but the label should say `Power Snatch` if one
is ever added. Recorded rather than changed — the root name is user-facing
text and renaming it is not this project's business.

The original finding follows, kept because the reasoning is what produced the
question.

#### Original finding

Found while sourcing coefficients, and it is a **dose** finding rather than a
pool one, so it is flagged rather than fixed.

The register prices `power-snatch` at parity with the `snatch` root. Peer-
reviewed modelling of record scores across snatch variations puts the power
snatch at about **0.88** of the snatch, and coaching sources say the same to
one decimal. **[sourced]**

- Modelling record scores in the snatch and its variations in the long-term
  training of young weightlifters. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6890263/

Both cannot be right, and which is wrong depends on a fact this document does
not have: **what the athlete's `snatch` PR refers to.** If it is a full squat
snatch, the app prescribes roughly 14% more than intended on every power snatch
— an overload, which §8 calls the highest-priority class of coefficient error.
If the PR is itself a power snatch, the 1.00 is right and the root is merely
misnamed. The same question applies to `power-clean`, which is a root in its
own right and so is unaffected, but the asymmetry between the two is itself a
signal.

**Not changed unilaterally**, because changing it moves weight on the bar. It
needs one answer from the athlete, and `programming-basis.md` should record
what each PR root means once it is given.

### 5.6 The overhead-press ladder was high on all three rungs — sourced 2026-08-25

The first coefficients paid off the discrepancy 8 backlog by **research** rather
than by a definition, and unlike `power-snatch` they did not survive it.

| movement | was | now | change |
|---|---|---|---|
| `split-jerk` | 1.55 | **1.38** | −11% |
| `push-jerk` | 1.45 | **1.24** | −14% |
| `push-press` | 1.30 | **1.10** | −15% |

The root is a **strict** press, and the library says so itself: `overhead-press`
lists joints `shoulder / elbow / lumbar / scapula` with **no knee or hip**, so
there is no leg drive in it. Every rung is a ratio against a strict standing
press.

Two independent derivations agree to within 2% on all three rungs:

- **A coach's worked ladder.** Jim Schmitz, three-time US Olympic weightlifting
  team coach: *"If you MP 80 kg, then you should PP about 90 kg and PJ 100 kg
  and split jerk 110 kg"* — 1.125 / 1.25 / 1.375.
  https://ironmind.com/articles/jim-schmitz-on-the-lifts/Push-Press-Push-Jerk-aka-Power-Jerk/
- **Measured data at the top rung, then walk down.** WODconnect's means over
  90,000 users put the male press at 61.1 kg and the split jerk at 84.14 kg — a
  ratio of **1.38**. The push press is programmed at ~80% of jerk max
  (0.80 × 1.38 = 1.10) and the push jerk gives way to the split jerk at ~85–90%
  of it (0.90 × 1.38 = 1.24).
  https://www.wodconnect.com/blog/posts/the-correlation-between-overhead-press-and-jerk
  https://www.performancemenu.com/article/1205/Maximizing-the-Push-Press-for-the-Jerk/

Where the two bands differ, the **lower** value is taken, on §8's asymmetry: a
low coefficient wastes a set, a high one puts weight overhead that cannot be
stabilised. Tagged `corroborated`, not `verified` — a coach's prescription and a
commercial user database agree, but neither is a peer-reviewed study.

**A third source disagrees and is rejected, on the record.** Strength Level's
per-lift means — press 57 kg, push press 82 kg, push jerk 89 kg — imply 1.44 and
1.56. Both are far higher, and its **push jerk figure alone exceeds the split
jerk figure the other two sources give**. A push jerk cannot beat a split jerk;
the split exists precisely to get more weight overhead. The tell is that those
averages are *unpaired* — the population logging strict presses is not the
population logging push jerks — so they cannot yield a within-athlete ratio. It
is rejected for failing an ordering the movements themselves impose, which is a
reason, not a preference. **Lesson worth carrying: a large-N average is not
evidence of a ratio unless the N is the same people.**

#### Amended later the same day — a fourth source disagrees, and why the low camp still wins

Found *after* the change was committed, while sourcing the Olympic lifts. A set
of ratios anchored on the split jerk circulates widely — push jerk ≈ 95% of it,
push press ≈ 80%, **strict press ≈ 60%** — which inverts to a split jerk of
**1.67** × strict press and a push jerk of 1.58. That is far above the 1.38 and
1.24 committed above, and close to the Strength Level figures rejected in this
section. **Recorded because it was found, not because it is convincing:** it
surfaced in aggregated search results and could not be confirmed on the page it
was attributed to, so it is unattributed and is not a citation.

Its *structure* is worth keeping even so, because it explains the whole dispute.
Its two internal rungs — push jerk 95% of the split jerk, push press 80% —
**agree with the walk-down used above** (0.90 and 0.80). Every source agrees on
the shape of the ladder. **The entire disagreement is the strict-press anchor**,
and that is the one rung that is population-dependent: a weightlifter almost
never trains a strict press and so has a huge jerk relative to it, while an
athlete who presses regularly does not. Hence 1.67 for one population and 1.38
for another, from ratios that are otherwise identical.

**Which population is he in?** Not the weightlifter's. He is a retired college
football athlete returning after years off — a background that presses and does
not specialise in the jerk, with jerk technique that has decayed while pressing
strength has not. His jerk is limited by technique, not by his press. That is
the low camp, and the closest population match in the evidence is WODconnect's,
whose users perform both lifts. **The 1.38 / 1.24 / 1.10 ladder stands, and the
reason it stands is a fact about him rather than a fact about the sources.**

**RESOLVED 2026-08-25 by the athlete: his `overhead-press` PR is a STRICT
standing press.** The library's reading was right, the ladder needs no further
adjustment, and the compounding risk described below is retired. Recorded like
the snatch root in §5.5 — for "what does his PR refer to", the primary source is
him.

Worth noting what the question cost and what it bought. `programming-basis.md`
already called five of the six roots "unambiguous", `overhead-press` among them,
and that was an *assumption* dressed as an observation — the same assumption
that had gone unexamined about `snatch` until it turned out to be wrong. Asking
was cheap; being right by luck is not a method. **The answer confirms the low
camp twice over:** a lifter whose held PR is a strict press is a lifter who
presses, which is exactly the population whose jerk-to-press ratio is 1.38
rather than 1.67.

The original open question follows, kept because it is the reasoning that
produced the answer.

**Open, and it scales all three: what does his `overhead-press` PR refer to?**
This is §5.5's question one lift over. If the number he holds is a push press,
or a football-era "max overhead" taken with leg drive, then the root is not
strict and every rung here is inflated on top of an inflated root — the same
compounding error, in the same direction. **Asked, not assumed.** Unlike the
snatch, the coefficients were still corrected: they are wrong against a strict
root and *less* wrong against a loose one, so the change is an improvement
either way and does not depend on the answer.

### 5.7 `trap-bar-deadlift` survived; `rack-pull` cannot be priced yet — 2026-08-25

Two claims priced off the `deadlift` root, and they ended differently.

**`trap-bar-deadlift` 1.05 — sourced, unchanged.** Three peer-reviewed 1RM
comparisons of the hexagonal against the straight bar:

| study | straight | hex | difference |
|---|---|---|---|
| Swinton et al. 2011 (n=19 powerlifters) | 245 kg | 265 kg | +8% |
| Lake et al. 2017 (n=11) | 183 ± 22 kg | 194 ± 20 kg | +6%, p = 0.003 |
| Camara et al. 2016 | 181 ± 27 kg | 181 ± 28 kg | none |

https://pmc.ncbi.nlm.nih.gov/articles/PMC5969032/ — Lake et al., which reports
its own result and cites the other two.

The literature spans 0–8% and **1.05 sits in the middle of that spread**, so the
inherited value needed no correction. This is the first coefficient to survive
being sourced, and it matters that it did: it shows the exercise is a test the
numbers can pass, not a ritual that always ends in a change. Had the spread
bracketed 1.15, the number would have moved.

Tagged `corroborated` rather than `verified` **despite** all three sources being
primary studies, because they *disagree*. 1.05 is a central estimate across a
spread, not a measurement of one. **A tag describes the strength of the claim,
not the prestige of the citation** — worth stating, because the temptation with
a peer-reviewed citation in hand is to reach for `verified`.

**`rack-pull` 1.15 — investigated and deliberately left `unverified`.** Not
skipped. Stopped, and the reason is the finding.

A rack pull's load is set almost entirely by **pin height**, and this entry does
not say where the pins go. Its joints — `hip` and `lumbar`, with **no knee** —
encode an above-knee pull, and for that the evidence puts the load at
**1.20–1.40**: competitive powerlifters produce roughly 21% more force with the
bar just above the kneecap than from the floor. So 1.15 is probably *low*.

**It is not raised anyway, and that is the point.** The joints field is not
user-facing. The card says "Rack Pull" and nothing more, so the pins go wherever
he puts them — and a coefficient sourced for an above-knee pull is an
**overload** on a below-knee one. The library knows something the athlete is
never told, and a coefficient may not depend on knowledge the user does not
have.

**The fix is an authoring change, not a research one:** say where the pins go,
in the name or the cue, and then price it. Cue backfill for main work is already
a scoped task, so this rides along with it rather than becoming its own project.
Until then the number stays unsourced and in the budget, which is the honest
place for it.

**Generalise this before pricing the rest.** Ask of every remaining coefficient:
*does this number assume a version of the movement the athlete has no way of
knowing about?* `snatch-pull` and `clean-pull` are the immediate suspects —
pull height is exactly as unstated as pin height.

### 5.8 The Olympic pulls hold; `overhead-squat` is the wrong instrument — 2026-08-25

**`clean-pull` and `snatch-pull`, both 1.15 — sourced, unchanged.** They stand
or fall together. Greg Everett: *"typically pulls are done with 80–105% of the
lifter's best snatch or clean."*
https://www.catalystathletics.com/article/1728/

1.15 looks *outside* that band until the roots are accounted for, and that is
the whole point: **both roots are power variants.**

| pull | × root | root as fraction of the full lift | effective % of full lift |
|---|---|---|---|
| `clean-pull` | 1.15 × power clean | 0.80–0.90 (Everett) | ~98% |
| `snatch-pull` | 1.15 × power snatch | ~0.88 (PMC6890263, §5.5) | ~101% |

Both land inside the sourced band, near its top — which is the right end for
*him*. Everett's caveat is that 80–105% is "far too light" for lifters with a
surplus of strength relative to technical ability, and that is a precise
description of a retired college football athlete whose Olympic technique is
years stale. The band is sourced; placing him at the top of it is reasoning from
his case, so both are `corroborated`, not `verified`.

**Note what did and did not count as evidence here.** §5.5 already observed that
these two "no longer look odd" once the snatch root was resolved, and explicitly
refused to treat that as a source — *coherence is not a source*. It still isn't.
What changed is that a sourced **band** now exists to check the coherent value
against, and the value falls inside it. Coherence pointed at the answer; the
band is what made it evidence.

**`overhead-squat` 1.10 — investigated, left unsourced, and for a different
reason than `rack-pull`'s.** There is no strength ratio to find. Asked directly
what the snatch-to-overhead-squat ratio should be, Everett declines to give one
and treats the gap as a mobility and stability problem: *"you don't necessarily
need to overhead squat more than you snatch."*
https://www.catalystathletics.com/article/2130/

**A coefficient is the wrong instrument for this movement.** It predicts a load
from a PR, and the binding constraint here is shoulder, thoracic and ankle
mobility — which, for an athlete returning after years off, is exactly the
quality most likely to have decayed while strength did not. The number is
neither defensible nor obviously wrong: 1.10 of a *power* snatch is ~97% of a
full snatch, satisfying Everett's "not necessarily more". That is coherence
again, and it is not a source.

**Flagged rather than guessed at.** Quietly lowering it would be this project's
signature failure wearing a safety costume — an invented constant is not made
**DECIDED 2026-08-25 by the athlete: leave it at 1.10, tagged as standing
debt.** Not deferred — decided, and it should not be reopened without new
information. The reasoning he was given and accepted: the value is honest about
its own weakness, §5.9 shows the ramp clamp pins the movement's displayed load
throughout the return weeks anyway, and a mobility gate is a Project B feature
rather than a data change. `overhead-squat` therefore stays in
`UNVERIFIED_BUDGET`, which is the correct place for a number nobody can source.

sound by pointing in the cautious direction. The real options are his: drop the
movement from loaded prescription, gate it behind a mobility check (Project B),
or accept a tagged standing debt.

### 5.9 Measured: the display clamp had already absorbed the overload — 2026-08-25

**This section tempers the three above it.** Having corrected the ladder, the
obvious question was how much weight actually came off the bar. The answer is:
almost none, and the reason is a feature that was already there.

`generator.js` clamps **twice** — once on the fraction of the movement's own max,
and again on the number the athlete reads:

```js
let display = pct * exercise.prCoef;
if (display > env.pctCeiling) { display = env.pctCeiling; ... }
```

For any `prCoef` above 1.00 that second clamp binds almost everywhere. Sweeping
every ramp ceiling against every zone the lifts can draw:

| lift | wk 1 (.65) | wk 2 (.70) | wk 3 (.78) | wk 4 (.85) | wk 5+ (.95) |
|---|---|---|---|---|---|
| `split-jerk` | pinned | pinned | pinned | pinned | 3 values |
| `push-jerk` | pinned | pinned | pinned | 3 values | 11 values |
| `push-press` | pinned | pinned | 5 values | 11 values | 20 values |
| `snatch-pull` / `clean-pull` / `rack-pull` | pinned | pinned | 2 values | 8 values | 17 values |

"Pinned" means the displayed multiplier is **exactly the ramp ceiling**,
whatever the zone, the reps or the coefficient. Through the first two weeks back
— and for the split jerk through week four — every one of these lifts prints the
ceiling and nothing else.

**So what did the correction actually change?** Only `push-press`, and only at
the higher ceilings: 11 of 11 sampled power-zone prescriptions at week 5+, the
largest drop **0.12 × PR**. `split-jerk`'s displayed multiplier does not change
in any zone at any week. The coefficient that was 12% too high was **inert**.

**Three things follow, and the third is the useful one.**

1. **The correction was still right, and its value is smaller than §5.6 implies.**
   The numbers should be true whether or not a clamp hides them, and they bite
   at week 5+, which is where he ends up. But §5.6's framing — three overloads
   averted — describes the *coefficients*, not the prescriptions. The bar was
   never loaded 11–15% heavy, because the clamp caught it first. **Recorded
   because the earlier claim was stronger than the measurement supports.**
2. **This is how the debt survived unnoticed.** basis §8 asks why thirty
   plausible numbers were never questioned. For the dangerous ones, part of the
   answer is that they were barely observable: a wrong coefficient above 1.00
   mostly could not move the printed figure, so it could not produce the
   surprising session that would have prompted the question.
3. **The clamp is doing more than basis §3 claims for it.** §3 calls the second
   clamp "slightly stricter than the literature requires". For every lift above
   1.00 it is not slightly stricter — during the ramp it is *the entire
   prescription*, and the training zone has no effect on the displayed load at
   all. A max-strength split jerk and a power split jerk print the same number
   in week 3. That may well be acceptable for a returning athlete, and it is
   certainly safe, but **it is not what §3 describes and it was not measured
   before now.**

**Open for him, not decided here:** whether a lift whose printed load is pinned
to the ceiling for four weeks should be prescribed at all in those weeks, or
whether the pinning is the correct conservative answer and only the
documentation is wrong. This is a *ramp* question, so it is outside Project A —
it belongs with basis §3.

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
5. **`primary :: hinge/pull-h :: power` reached 14 of 16 on 2026-09-07 and
   stays open.** (§19.3 has the working; the paragraph below is as written at
   13 and its argument is unchanged by the extra entry.)
   §5.4 has the working. Unlike question 4 this is not a missing rule — the rule
   is right and sourced, and the movements do not exist at primary tier. Three
   resolutions, all needing a decision: widen the slot to `['primary',
   'secondary']` (a template change, §2 excludes it from this project, and it
   reaches only ~15 anyway); accept a shorter repeat horizon for this one pool;
   or accept 13 and say so. **Doing nothing is a valid choice here** — the
   matrix will keep printing `short 3` until someone decides, which is the
   correct behaviour for an open question.
6. ~~What do the `snatch` and `power-clean` PR roots actually refer to?~~
   **ANSWERED 2026-08-25: the `snatch` root is his power snatch.** §5.5. The
   coefficient stands, the overload risk never existed, and the register lost
   its first backlog entry. Left in the list rather than deleted, because a
   question that got a real answer is worth as much as one still open.

Also noted 2026-08-25: **question 4 and everything else on the running side is
deferred at the athlete's request** — he has not yet analysed how the running
programs are set, and would rather decide than be asked to guess. That covers
`aerobic-steady`'s missing numeric target (question 4), the strides slot in
§5.3, and the `locomotion` pools generally. Nothing is blocked by the wait; the
lifting side is complete except question 5.

## 11  Growth by parent-derived variants — added 2026-09-04

Status: method agreed 2026-09-04. Guard built; `core` is the pilot pool.

### 11.1 What the cost of an entry actually is

The library is 237 entries. Asked for a way to grow it substantially, the first
thing to establish was what an entry costs, because the obvious answer — names —
is wrong.

- **Cues are the bottleneck.** 790 hand-written lines, **3.33 per entry**, each
  capped at 90 characters by `cue-guard.mjs`, each of which has to be true about
  a movement the athlete will perform unsupervised. `core` is one of the seven
  `CUED_POOLS`, so an entry added there cannot arrive blank.
- **Only 36 of 237 are loadable**, and `tests/coefficients.test.mjs` is an
  explicit ratchet — the unverified debt may shrink, never grow. The barbell
  half of the library cannot grow without sourcing a coefficient per entry.
  That is the rule working, not an obstacle, and §11.3 does not route around it.
- **The 111-entry shortfall in §4 is the wrong target.** It is concentrated in
  `sprint`, `run` and `jump`, where the README's conclusion stands: inventing a
  sixteenth way to sprint is worse than repeating the right one. The pools where
  growth buys the athlete something are the **87 non-loadable entries across the
  nine lifting patterns**, plus **18 `core`** and **38 `mobility`**.

### 11.2 The method

> A **derived variant** takes a reviewed parent and moves **exactly one axis** —
> implement, stance, or angle. Never a cross-product.

It inherits from the parent, unchanged: `pattern`, `tier`, `joints`,
`cnsCost`, `technical`, `unilateral`, `modalities`, `isometric`. It carries a
new optional field **`derivedFrom: "<parent-id>"`** naming where it came from.

The inherited list is the definition, not a convenience. Each field on it is an
input to something that would break silently if the variant drifted:

- `joints` is the soreness filter's only input. **If a variant would load
  different joints, it is not a derived variant** — it is a new movement, and it
  is authored fresh under §8 with its own review.
- `cnsCost` and `technical` price the session; `tier` and `pattern` decide which
  pool and which slot it can ever reach.
- `isometric` was **added to the list during the core pilot, before any entry
  was authored**. The agreed list did not carry it; `generator.js:1214` shows it
  is the switch that decides whether the card prescribes a **hold in seconds or
  reps**, which makes it dose-shaping in exactly the way `cnsCost` is. A variant
  that flips it has not moved one axis, it has changed what the movement is —
  so `plank` cannot derive `plank-with-shoulder-tap`, and that entry is authored
  fresh under §8 instead. The field is absent on rep-based entries, and absent
  inherits as absent.

`loadable` is **`false` unless a coefficient is sourced for the variant itself**.
A parent's `prCoef` is a dose measured on the parent, and derivation never
inherits a measurement — that is exactly the fabrication the register exists to
stop.

**Cues are derived, and say so.** Inherit the parent's lines, rewrite only the
line the moved axis actually changes, keep the rest. A variant whose cues are
byte-identical to its parent's has not moved an axis worth an entry.

**`venue` came off the inherited list during the pilot, on a measurement.** The
agreed list carried it. In this library venue is a *function of the implement* —
`barbell`, `cable`, `machine`, `plates`, `landmine` and `bench` are `gym` in
every one of their entries; `bodyweight`, `kettlebell`, `bands` and `wall` are
`either` in all but one. Inheriting venue across a moved implement is therefore
the same axis under another name, and it forbids exactly the variants worth
having: a band Pallof press is `either` precisely *because* it is the one he can
do away from the gym, and the rule would have rejected it for saying so.

The rule that replaces it is narrower and catches the same drift:

> **VENUE_FOLLOWS_IMPLEMENT** — a variant that did not move the implement may
> not move the venue. One that did move the implement declares its own, and it
> must be a venue the library uses.

So a stance or angle variant is available exactly where its parent is, and the
only way to change venue is to change the kit, which is a visible edit a
reviewer can see.

Depth is one. **A parent may not itself be derived**, so every variant is one
edit away from a line a human reviewed. Chains would let three small drifts add
up to an entry nobody has ever checked.

### 11.3 The guard, and the failure it exists to prevent

Derivation rots in one specific way: the parent changes — a joint is added, a
`cnsCost` is repriced — and the children keep the old values. Nothing in the
suite would notice, and the divergence is invisible because both entries still
look well-formed on their own.

`tests/derivation-guard.mjs` therefore asserts, for every entry carrying
`derivedFrom`, that **the parent exists**, that **every inherited field still
equals the parent's**, and that venue moved only if the implement did. It is test-side rather than app-side for the same reason
as the cue guard and `coef-provenance.mjs`: the library is authored in this repo
and gated by this suite, so a malformed entry can never reach a user, and §2's
"no schema change" holds.

The guard makes the parent link load-bearing. Repricing a parent now fails the
suite until its children are repriced with it — which is the intended cost, and
the reason a variant is cheap to add and honest to keep.

### 11.4 Why `core` is the pilot

Picked to produce a real yield number instead of an estimate, on the pool with
the fewest confounds: 18 entries, **no coefficients owed** (not one is
loadable), and a live consumer — it is the pool the mobility deload day and
89.9% of hypertrophy sessions draw their finisher from. Its implement axis is
also the narrowest in the library: bodyweight 9, cable 2, pull-up-bar 2, and one
each of bench, ab-wheel, dip-bar, open-space, dumbbell.

What the pilot has to answer, before the method is applied to the eight lifting
pools: how many variants a reviewed parent actually yields before the one-axis
rule stops being satisfiable, and whether derived cues read as well as written
ones when the athlete meets them on a card at the gym.

---

## 12  The variety target was in sessions; the mechanism was in days — BUILT 2026-09-04, `sw.js` v39

### 12.1 The question that was asked, and the question that mattered

He asked to grow the library — "there are hundred thousands of moves out there,
I want to be able to add them" — and gave the reason: **"I don't want to do the
same squat for weeks."**

The reason is testable, and it was tested before anything was designed. It is
not a library-size problem.

`fillSlot` downweights a movement used recently (`w *= 0.25`,
`js/generator.js`). The set it consults, `state.recentExerciseIds`, was built
from `buildState`'s `recent` — which is truncated to `VOLUME.HISTORY_DAYS`
(14). Simulating 200 athletes × 30 sessions at his real cadence (1–3×/week,
irregular), committing each session the way the app does:

```
gap between consecutive sessions of the SAME day type (n = 4,600)
  median 21 days,  p25 18,  p75 24
  share of those gaps LONGER than the 14-day window:   100.0%
  main work repeated from the previous session of that day type:  32.9%
```

**100.0%.** Not "most". With seven day types at 1–3 sessions a week, a day type
comes round about every three weeks, so the recency penalty had never once
applied to the comparison he actually notices — this squat day against the last
squat day. About a third of a day type's main work repeated from its previous
outing, by construction.

Overall variety was never the problem and this section does not claim it was:
across the first 10 sessions he sees ~30 distinct movements in ~32 filled
slots. The repetition is concentrated *within* a day type, which is exactly
where it would feel like "the same squat again".

**The target had been stated in the right unit for months.** `SESSIONS_BEFORE_
REPEAT = 16` — the athlete's own preference — is what `tests/coverage.test.mjs`
uses to size every pool in §3.2, and what §4's shortfall is measured against.
The target was in sessions; the enforcement was in days. His cadence is the gap
between the two.

### 12.2 The third instance of one bug

`buildState` already carried two comments opening with the same words:

> "**NOT `recent`**: it is truncated to `VOLUME.HISTORY_DAYS` (14)…"

— on `hoursSince` (plan-06: every day type skipped for longer than a fortnight
read `Infinity`, tied, and lost the tie-break, so `plyometric` was proposed
**0 times in a simulated year**) and on `chronicFrom` (a 28-day window that was
silently a 14-day one).

`recentExerciseIds` was the third, and the one that went longest unnoticed —
because unlike the other two it produces no wrong number and no missing
session. It produces a session that is merely *duller than intended*, which no
assertion was looking for.

**The generalisation, worth stating once:** anything in `buildState` reasoning
about training **history** has to escape the volume window; only things
reasoning about training **volume** may live inside it.

### 12.3 `VARIETY.RECENT_SESSIONS = 8`, swept not chosen

The window is now the last N sessions by date, however long ago. N was swept on
one harness — 80 runs × 24 sessions, post-ramp, committing each session:

| N | same-day-type repeat | distinct movements / 24 sessions | unfilled required slots |
|---|---|---|---|
| 14 days *(before)* | 25.0% | 50.7 | 0 |
| 4 | 25.0% | 50.7 | 0 |
| 6 | 20.7% | 51.7 | 0 |
| **8** | **14.1%** | 53.3 | 0 |
| 12 | 15.2% | 54.1 | 0 |
| 16 | 16.5% | 55.6 | 0 |
| 24 | 17.3% | 56.1 | 0 |

Two things in that table are worth more than the chosen value.

**N = 4 reproduces the old behaviour exactly** (25.0%, 50.7). At this harness's
3-day spacing, four sessions *is* about fourteen days. That is the cross-check
that the sweep is measuring what it claims to.

**Bigger is not better, and the curve turns at 8.** Past that, repeats climb
again. The penalty is a multiplier applied to a pool: once nearly every
movement in a pool has been used inside the window, all of them are multiplied
by 0.25, the weighting flattens, and a uniform penalty is the same thing as no
penalty at all. **A window wide enough to cover the pool stops discriminating.**
Total variety keeps rising (50.7 → 56.1) because the flattened draw reaches
rarer movements, but the thing he complained about gets worse. 8 is the
measured minimum of the quantity he named.

*Two harnesses, two honest numbers.* The 32.9% headline above is measured
during the **return ramp**, where volume is clamped and sessions carry fewer
main movements; the sweep table is **post-ramp** steady state. Against the fix,
the ramp harness reads **32.9% → 20.0%** and the steady-state harness **25.0% →
14.1%**. Both are real; they measure different periods, and neither number is
quoted as the other.

### 12.4 What did not move

Only `recentExerciseIds`. `patternSets` stays a 7-day rolling count, the CNS
account stays hour-decayed, and `recent` itself is untouched — all three are
sourced against `VOLUME`, and widening them would be a different and much worse
change. `tests/recency.test.mjs` asserts this directly: a session 90 days ago
is visible to recency, contributes **zero** weekly volume and **zero** CNS
load.

The penalty is still a downweight, never a ban, so a thin pool degrades instead
of failing — asserted across 800 committed sessions with **0** unfilled
required slots.

### 12.5 What this means for growing the library

The library question stands, and §11's derivation method is still the way in.
But the order matters, and it is now measured rather than assumed: **a third of
the repetition he could feel was a windowing defect, not a shortage of
movements.** Adding entries into a saturating penalty would have diluted their
own benefit — the N = 16 and N = 24 rows are what that looks like.

`docs/coverage-matrix.md` remains the map of where growth actually pays. On the
gym side that is about **11 entries across five accessory/secondary pools**;
the remaining ~100 of §4's shortfall is `sprint`, `run` and `jump`, where §11.1's
conclusion is unchanged — a sixteenth way to sprint is worse than repeating the
right one.

*Updated 2026-09-06:* that ~100 is now 5. Seven of those pools were exempted
from VARIETY (§3.2's amendment), and correcting a venue bug in the coverage
test showed the jump pools were larger than the matrix had been reporting. The
gym side is untouched by both: the ~11 entries across five accessory/secondary
pools is still where growth pays, and `primary :: hinge/pull-h :: power`
(short 3) is the largest single item left.

---

## 13  Growing the library: the tool, and the first batch — BUILT 2026-09-05, `sw.js` v40

### 13.1 The validation script that was not built

The ask was "a way to add movements to all categories", and the obvious
deliverable was a script that validates a proposed entry before it lands.

**It was not built, because the suite already is one.** What gates a new entry
today, without any new code:

| guard | what it refuses |
|---|---|
| `cue-guard.mjs` | >90 chars, >4 lines, and a blank entry in a `CUED_POOLS` pool |
| `derivation-guard.mjs` | a variant that drifted from its parent, a chain two deep, an inherited coefficient, a venue that moved without the implement |
| `coef-provenance.mjs` | a `prCoef` with no provenance record |
| `coefficients.test.mjs` | any *growth* in unsourced-coefficient debt |
| `taxonomy.test.mjs` | an entry in the wrong movement family |
| `library.test.mjs` | a duplicate id, an empty `modalities`, a pool too thin to survive a hurt joint |
| `coverage.test.mjs` | regenerates `coverage-matrix.md`, so a pool's depth is never a claim |
| `prep-specificity.test.mjs` | a mobility entry with no `targets` |

Adding an entry and running `node --test tests/*.test.mjs` **is** the
validation. A second gate would duplicate every rule above and then drift from
it — two definitions of a valid entry, disagreeing silently, which is the exact
failure `derivation-guard.mjs` exists to prevent one level down.

### 13.2 `targets` joined the inherited set first

v38 added `targets` to the 38 mobility entries and did not add it to
`derivation-guard.mjs`'s `INHERITED`. `targets` decides which **day** an entry
is drawn for, exactly as `pattern` decides which **slot**, so a derived drill
was free to re-aim itself silently — a lateral leg swing filed under
`squat`/`lunge` would simply stop appearing on the days its parent appears on,
and nothing would say so.

Closed before the first derived mobility entry exists: 15 derived entries at
the time, none of them tier `mobility`, zero mismatches. That is the only
moment a guard like this is free, and it is why it went first rather than last.

### 13.3 `tools/derive.mjs` — the mechanical part only

Of ~15 fields on an entry, a derived variant copies nine off its parent and
forces three to a fixed value. **Four need a human**: the id, the name, the
equipment, and the cue line the moved axis actually changed.

```
node tools/derive.mjs --parent split-squat --id front-foot-elevated-split-squat \
                      --name "Front-Foot-Elevated Split Squat" \
                      --equipment dumbbell,plates --venue gym
```

**The contract is that the draft is wrong in exactly one way.** Every
mechanical field is correct; the cues are the parent's *verbatim*, which
`derivation-guard.mjs` rejects as "has not moved an axis". So a draft that is
pasted in and forgotten **fails the suite** rather than shipping, and the
failure names the one thing only a human can do. That is deliberate, and
`tests/derive-tool.test.mjs` asserts it: `derivationProblems` on a fresh draft
returns exactly one problem, and it is the cue one.

It refuses an unknown parent, a parent that is itself derived, a duplicate id,
a non-slug id, and a venue that moved without the implement. It prints; it does
**not** write to `exercises.json`, because that file is hand-formatted one
aligned block per entry and a script that reflowed it would produce a diff
nobody can read.

*It earned its keep on first use.* Asked to scaffold a rear-foot-elevated split
squat, it refused: the entry already exists — at tier `secondary` with
`max-strength`, which is why it had not shown up in the `accessory ::
lunge/rotate :: hypertrophy` pool being counted.

### 13.4 The batch: six entries, eight shortfall points

| entry | parent | axis moved | closes |
|---|---|---|---|
| `forward-lunge` | `reverse-lunge` | direction | lunge/rotate, lunge/carry |
| `lateral-step-up` | `step-up` | stance | lunge/rotate, lunge/carry |
| `front-foot-elevated-split-squat` | `split-squat` | angle (+ implement) | lunge/rotate, lunge/carry |
| `meadows-row` | `dumbbell-row` | implement (landmine) | pull-v/pull-h |
| `seated-leg-curl` | `lying-leg-curl` | angle | squat/hinge |
| `single-arm-lat-pulldown` | — *(fresh, §8)* | — | pull-v/pull-h |

**Six entries closed eight shortfall points**, because the pools overlap — a
lunge accessory entry sits in both `lunge/rotate` and `lunge/carry`. Raw
shortfall 111 → 103; library 252 → 258.

`single-arm-lat-pulldown` is authored fresh rather than derived, and the reason
is the rule working: a single-arm pulldown moves `unilateral`, which is on the
inherited list, so it is a **new movement** and not a variant of the two-arm
version. §11.2's line — "if a variant would load different joints, it is not a
derived variant" — generalises to every inherited field.

Four of the five short gym pools are now at target. What is left:

### 13.5 `primary :: hinge/pull-h :: power` stays 3 short, and that is correct

This pool is the Olympic-lift and deadlift pool: thirteen loadable barbell
lifts. Adding to it means adding loadable barbell lifts, and **every one needs
a sourced `prCoef`.**

`coefficients.test.mjs` holds `UNVERIFIED_BUDGET` as a one-way ratchet — the
unsourced-coefficient debt may shrink, never grow — so three new entries cannot
simply arrive tagged `unverified`. And the reason that ratchet exists is
recorded in `coef-provenance.mjs`: when four coefficients were finally sourced
properly, **three of the four were wrong**, two of them 9% high. On lifts
prescribed as a percentage of a college-era PR, to someone returning after
years off, a 9% error is an overload rather than a wasted set.

So this shortfall is **not closed by authoring**. It is closed by sourcing
three coefficients, which is reading work with a different shape and pace, and
it is left open rather than filled with plausible numbers. Plausible is exactly
what made the original thirty dangerous.

### 13.6 Open: two entries are under-tagged, not missing

`face-pull` and `straight-arm-pulldown` are **already in the library**, tagged
`modalities: ["isolation"]` only. That is why they did not count toward
`secondary+accessory :: pull-v/pull-h :: hypertrophy` and why that pool read as
short. `incline-curl`, `preacher-curl` and `wrist-curl` sit the same way, while
`barbell-curl`, `dumbbell-curl` and `hammer-curl` all carry
`["isolation","hypertrophy"]`.

A face pull is a rear-delt hypertrophy movement by any ordinary reading, so the
tagging looks accidental rather than considered. It was **not** changed in the
batch above: retagging an entry changes which *days* it can be selected on, for
movements already in circulation — a different kind of change from adding a new
entry, and one that should be decided on its own rather than swept in behind a
batch that was about something else.

### 13.7 The retag, and what it turned out to be worth — 2026-09-05, `sw.js` v41

Decided by the athlete, on the record above. `face-pull` and
`straight-arm-pulldown` gained `hypertrophy`; the tag was **added**, not
swapped, so both remain isolation work. The other four sit unchanged and
deliberately unasserted in `tests/library.test.mjs`, so a later reading can
still move them: `band-pull-apart`, `incline-curl`, `preacher-curl`,
`wrist-curl`. He named two; two moved.

**The count was the least of it.** `secondary+accessory :: pull-v/pull-h ::
hypertrophy` went 16 → 18, which was the visible effect. The real one is in the
survival column:

| | before | after |
|---|---|---|
| worst hurt joint | 6% (elbow) | 17% (scapula) |
| FLOOR required | 16 | 6 |

Because a face pull and a straight-arm pulldown load `["shoulder","scapula"]`
and **no elbow at all**, they are the movements that stay legal when the elbow
is the sore joint. Before the retag, a hurt elbow left that entire pool holding
exactly **one** entry — `shrug`. It now holds three. The binding constraint
moved off the elbow entirely.

That is the §3.1 FLOOR rule doing what it exists to do, and it is worth stating
plainly: **two of the six entries authored in §13.4 were bought by a tagging
error.** Had the retag come first, `meadows-row` and `single-arm-lat-pulldown`
would not have been needed to close that pool. They are good movements and they
stay — the pool is better at 18 than at 16, and the hurt-elbow case above is
better served by three than by one — but the sequence is a lesson: **audit what
a pool already contains before concluding it is short.** A pool can read short
because a movement is missing, or because a movement present in it is wearing
the wrong label, and only one of those is fixed by authoring.

### 13.8 The remaining four, and the number that nearly stopped it — 2026-09-05, `sw.js` v42

`band-pull-apart`, `incline-curl`, `preacher-curl` and `wrist-curl` gained
`hypertrophy` on his instruction, once §13.7 had shown what the first two were
worth. Tag added, not swapped; all six remain isolation work.

**This one was checked before it shipped, and the first measurement looked
bad.** All four are `pattern: 'pull-h'`, `tier: 'accessory'` — the same pool as
every row. Over 4,000 hypertrophy sessions:

| accessory `pull-h` slot draws | before | after |
|---|---|---|
| rows | 64.6% | **46.3%** |
| arm isolation | 28.4% | 37.6% |
| rear delt | 7.0% | 16.1% |

Rows stop being the majority of that slot. Taken alone that reads as trading
back work for curls, which is not what "more variety" was meant to buy.

**Taken alone is the error.** That slot is not where the back work lives. Rows
and pull-ups also occupy `primary` and `secondary` tiers — `pendlay-row`,
`t-bar-row`, `pull-up`, `chin-up` — and none of the retagged entries can reach
those, because all four are `accessory`. Measured over the same 4,000 sessions,
counting every `pull-h` and `pull-v` set in the main work:

| per hypertrophy session | before | after |
|---|---|---|
| back sets (row / pulldown / pull-up) | 3.40 | **3.26** |
| arm sets (curl / wrist) | 0.76 | 1.03 |

Back volume falls **4%**, not a third. The accessory slot changed character;
the session did not. Shipped on that basis.

**Why the first number was so much worse than the second, and it is worth
knowing.** `pull-h` is one pattern covering both a barbell row and a wrist
curl, so `patternDebt` credits a curl as horizontal-pull volume — doing curls
tells the model you have done back work. That was already true of
`barbell-curl`, `dumbbell-curl` and `hammer-curl`; this change doubles the
number of entries it is true of. The effect is bounded here because the
accessory slot is a small share of pull volume, but it is the same coarseness
`js/generator.js`'s `patternDebt` comment already flags from the other
direction, where it notes debt is *overstated* for patterns getting indirect
work.

**Not fixed, and deliberately not.** Splitting elbow flexion out of `pull-h`
would touch the pattern taxonomy, the volume accounting, the neglect model and
every template slot that names a pull — a large change to correct a 4%
mis-attribution. A selection heuristic preferring compounds in accessory slots
would be a new unsourced weight, of exactly the kind §12 has just finished
removing from the recency model. Recorded here so the next person to widen a
pool that shares a pattern with isolation work measures the session, not the
slot.


## 14  Mining a coach's playlist: 258 → 405 — BUILT 2026-09-05, `sw.js` v43–v46

The athlete asked, for the fourth time, to grow the library from YouTube
channels that post one movement per video. §13's warning still holds — every
gym pool is already at target, so this is *because he wants it*, not because
the matrix demands it — and it was not repeated to him a fourth time. He gave a
259-video sports-performance playlist and chose "everything genuinely new".

### 14.1  Reading a playlist is cheap; watching it is not

`yt-dlp --flat-playlist --print "%(title)s"` prints every title without
downloading a byte of video. That is the whole discovery step, and it is what
made a 259-item diff affordable. §13's note that `/watch` is the wrong tool for
discovery stands, and is now specific: `/watch` is for the movements a *name*
cannot classify, and there were about fifteen of those.

The clips carry no captions — they are silent demonstrations, so the transcript
path gives nothing. What works instead: download at the lowest resolution, then
`ffmpeg -vf "fps=…,scale=320:-1,tile=3x2"` to put six frames in ONE image. One
picture per movement, and enough to settle `joints`, `unilateral`, `pattern`
and `technical`. It resolved, among others:

- **Power Skip (Distance)** is genuinely distinct from `power-skip`, whose own
  cue reads "skip for height rather than distance". Both are now in.
- **Linear March** IS `a-march`. **Toe Touch Squat** IS `squat-to-stand`.
  Neither was added.
- **"Ab."** in "3 Way Ab." is *abduction*, not abdominals — and six frames
  still were not enough to tell the three positions apart, so it was declined
  rather than guessed at. A drill nobody can describe accurately does not get
  invented cues.

### 14.2  What a playlist actually contains

Of 259 titles: 5 exact duplicates, then **33 that are not movements at all** —
7 tempo labels ("Front Squat 5-0-0 Tempo"), 6 distances ("10 Yd Sprint"), 13
second camera angles (a trailing "2"), 7 chained combos ("Split Squat Hold into
Lateral Bound"), and one titled "NA". A tempo and a distance are *prescriptions*
this app already makes; a combo is two entries the generator would have to draw
separately. None of them are library rows.

That left 221 candidates, of which about 15 were already here under our own
names and **147 were authored**. The rest were declined, and §14.4 says why.

### 14.3  The mobility half is the dangerous half

122 of the 221 were prep and mobility work. That is the shape of a
sports-performance library: a coach films seven variations of a quadruped hip
extension because a coach *chooses* between them for the athlete in front of
them. A generator drawing at random from seven near-identical drills has no
such judgement, and the athlete was told so before he chose. He chose all of
it.

The consequence was not variety. It was **time**, and it is recorded at
`FLOOR_OVERRUN_ALLOWANCE_MIN` in `js/rules.js`: the worst session over 70,000
went 68 → 69 min, and that allowance had never risen before.

**The method that mattered: simulate the batch before writing it.** With the
eleven soft-tissue rolls in and the ceiling test failing, 110 *synthetic*
mobility entries — weighted unilateral the way the playlist is — were pushed
through the same sweep. Worst case came back **68**, below the 69. More variety
DILUTES an unlucky expensive combination rather than compounding it; a small
pool makes a bad draw reachable within 10,000 seeds, a large one buries it.
That said the batch was safe to write, and it was written.

Measured on the finished library the number is 69 again (405 entries), so the
allowance is 9. Had it been derived per batch it would have gone 9, then 8,
then 9 — three edits recording a library that never shipped. **Derive a
measured constant once, from the finished state.**

### 14.4  Three declines that were the library's decision, not taste

Worth keeping because each one is a rule catching an author, which is what the
rules are for.

1. **The arm actions.** "Seated Arm Action" and "Tall Kneeling Arm Action" are
   sprint drills loading `shoulder` and `scapula` only — correctly, since you
   do them sitting or kneeling. But every other entry in `accessory ::
   sprint-drill/agility` is on its feet, which is *why* that pool sits in
   `FLOOR_EXEMPT`: it is meant to vanish when an ankle is hurt. Two upper-body
   drills break the property, and a hurt ankle would then draw the same two arm
   drills as its agility work every session forever. The joints could not be
   corrected — shoulder-only is the truth — so the entries came out. **A pool
   can have an invariant that no single entry violates and a pair does.**

2. **The isometric holds.** "Split Squat Hold" and "Elevated Push Up Hold" are
   holds, and `isometric` is read only on `core` entries — the generator's
   seconds-versus-reps branch. Outside `core` the flag is a claim nothing
   honours; by reps they merely duplicate `split-squat` and `push-up`. They
   stay out until holds are dosable outside the core tier.

3. **"Foam Roll: Low Back".** Declined on internal consistency, which is a
   ground the other two are not. `thoracic-foam-roll`'s own cue says "never
   roll the lower back". Shipping an entry that contradicts advice the app
   already gives him is worse than shipping neither, and if the entry is right
   then the existing cue must change first.

### 14.5  What the guards caught while authoring

- `butt-kicks` and `mini-band-lateral-walk` went in without `ankle`. Every
  other entry in that pool carries it, so the two became the sole survivors of
  a hurt ankle, the pool left `FLOOR_EXEMPT`, and its floor jumped to 62. **The
  data was wrong, not the test** — butt kicks are performed on the balls of the
  feet. §13.8's "audit what a pool CONTAINS" has a mirror image: audit what
  your own new entry claims to load.
- `single-arm-incline-dumbbell-press` was drafted as a derivation. `unilateral`
  is INHERITED, so a single-arm variant has by definition not moved one axis.
  Authored fresh. This is the second time that exact rule has caught a
  single-arm entry — `single-arm-lat-pulldown` in §13 was the first — which is
  enough repetition to name it: **single-arm is never a derivation.**

### 14.6  What this did not cost

No new load coefficients, and `UNVERIFIED_BUDGET` does not move. The worry was
misplaced and is recorded here so it is not raised again: `loadable` does not
mean "weight can be added", it means the generator computes load from a PR
coefficient, and it is true of 36 entries, all barbell. Dumbbell rows,
kettlebell swings, split squats and `weighted-dip` are already
`loadable: false`. Everything in this expansion is accessory work of that kind.

New equipment: `mini-band` (implies `bands`, on the trap-bar/barbell reading),
`suspension`, `slideboard`, `lacrosse-ball` (none imply anything).


## 15  The second playlist: filling holes rather than padding pools — BUILT 2026-09-05, `sw.js` v47

A second 263-video playlist from the same source, and a different animal from
§14's. That one was a warm-up library and mostly padded pools already at
target. This one is gym work, and it fills gaps the library genuinely had:

- **No rotator cuff work at all**, in 405 entries. `cable-external-rotation`,
  `ninety-ninety-external-rotation`, `mini-band-external-rotation`, the W and X
  pulldowns and the two wall slides close it. For a returning college athlete
  with a football shoulder that is not a nice-to-have.
- **`rotate` held five entries, every one a chop or a twist** — the *lift*, the
  low-to-high direction, did not exist, and neither did the push-pull. Six
  entries added across the stances the library already distinguishes.
- **No get-up progressions**, no dynamic plank work (plank row, body saw,
  compass plank), no goblet or bottoms-up carry.

53 authored, library 405 → 458.

### 15.1  The method-on-a-lift category is bigger here

45 of 262 unique titles are a *method* written onto a lift: `Tempo Push Up`,
`Eccentric Chin Up`, `Isometric Goblet Squat`, `1 and a Half Bench`, and the
landing progressions `with Stick` / `with mini bounce` / `Continuous` on every
bound and hop. Same category as §14.2's tempo labels and distances, and the
same answer: this app prescribes tempo and dose separately, so a method is not
a library row. That the same facility films 5 methods x 9 lifts is a fact about
teaching, not about movement.

A further ~30 are implement-position variants — `Goblet Split Squat` against
`2 DB Split Squat`, `1 KB Rack Pos Squat` against `2 KB` — where the library
already carries the movement and the hold position is the only difference.
Declined on the §14.2 rule.

### 15.2  Stance IS an axis here, and the library said so first

The chop entries were not declined as position variants, and the reason is
precedent rather than preference: `cable-woodchop` (standing) and
`half-kneeling-cable-chop` already existed as separate entries. The library had
already ruled that stance changes a chop enough to be its own row, so the tall-
kneeling and lift variants follow that ruling rather than re-opening it. **Check
what the library already distinguishes before deciding a variant is noise.**

### 15.3  A new held movement, and the list that is supposed to grow

`tall-kneeling-pallof-hold` is the first entry added to `REVIEWED_HOLDS` since
that list replaced the old enumeration. It is there rather than derived because
no existing hold is its parent — `pallof-press` is the same set-up dosed by
reps, and a hold is not a variant of a press. The list's own comment says it
"grows only when a genuinely new held movement is authored, which is exactly
the moment a human should be looking at the flag", so this is that moment
working as designed rather than a list being bumped to get green.

### 15.4  THE RAMP HOLE, found by accident and left open on purpose

The most valuable thing this batch produced is not an entry.

`tests/swap.test.mjs` asserted that a swap during the return ramp comes back
capped. It went red. The cause is not the test: `rampLimited` is set only
inside the load-pricing path (`generator.js:726`), because that is the only
place a percentage exists to cap. **A swap that returns a `reps`-mode movement
therefore carries no ramp cap and no "held down by the return ramp" note** —
which is precisely what basis §3 says a swap must never be, an exit from the
ramp.

The hole is not new. It was simply unreachable from that fixture: at 435
entries the week-1 swap of `bench-press` returned `incline-bench-press` (load
mode, capped); at 458 the extra push-h entries changed which candidate wins and
it returns `weighted-dip` — primary push-h, dosed by reps, silently uncapped.
Growing the library did not create the hole. It exposed one that had been
sitting behind a fixture.

**FIXED 2026-09-05 (`sw.js` v48), after the athlete chose the first option:
the swap now prefers a loaded replacement during the ramp.** Full write-up in
`design-equipment-and-swap.md` §12 — including the measurement that made the
scale clear (one week-1 swap in four came back silently uncapped) and the
finding that the preference must widen tier to be any use, because the other
loadable primary of the pattern is usually already on the card.

### 15.5  The allowance came back down, and now the rule is legible

`FLOOR_OVERRUN_ALLOWANCE_MIN` went 9 → 8 on this batch, restoring the two-minute
margin §14.3 had spent. Worst 68 min at 458 entries, against 69 at 405.

Observed twice now, so it is worth stating as a rule: **this number tracks the
MOBILITY POOL'S COMPOSITION, not the library's size.** §14 grew the prep and
cool-down pools by 89 and the worst case rose; §15 grew the library by 53 with
only three mobility entries and it fell, because every non-mobility addition
dilutes a draw it cannot join. Growing the gym half is close to free in session
time. Growing the prep half is what costs, and is what to sweep before shipping.

### 15.6  One readability bound moved

`tests/equipment.test.mjs`'s "short enough to read on a phone" cap went 10 → 12.
Worst measured is 11 — a session drawing soft-tissue work that needs both a
roller and a ball. `lacrosse-ball` cannot be folded into `foam-roller`: its
entries are point-pressure releases a roller cannot perform. Unlike the
allowance above this is a READABILITY bound and not a measurement, so it keeps
headroom rather than tracking the worst case. At 12 the answer is to group the
control, not to raise it again.

## 16  The channel's remaining playlists: a teaching shelf, not a catalogue — BUILT 2026-09-05, `sw.js` v51

§14 and §15 mined two playlists from the same coach. The channel has nine. The
other seven — Anti-Core, Pull, Push, Knee Dominant, Hip Dominant, Power, Speed
— are 107 titles, and running `tools/playlist-diff.mjs` over them surfaced a
difference the first two never showed.

**The first two playlists were a movement catalogue. These seven are a teaching
shelf.** They are organised by pattern for a coach explaining the pattern, so a
large fraction of each is a lesson *about* a lift rather than the lift itself.
That is a decline category the tool had no rule for, because playlists 1 and 2
contained none of it.

Buckets, after the rules in 16.1–16.3 were added:

| | count | share |
|---|---|---|
| not a movement | 28 | 27.7% |
| already in the library | 30 | 29.7% |
| candidates | 43 | 42.6% |

Of the 43 candidates, 16 were duplicates caught by eye, 27 were authored.
Library 458 → 485.

### 16.1  Coaching content

Roughly a fifth of the 107 titles teach rather than prescribe:

- `Progressing the Push Up`, `Progressing the Chin Up`, `Progressing the Front Plank` — a walk through regressions.
- `Bad Push Up` — a demonstration of the error, on purpose.
- `Chop Series`, `Lift Series`, `Turkish Get Up Series`, `Carry Options` — an overview of entries already listed individually.
- `Implements: Squat`, `Load Positioning: Split Squat` — a topic label with a colon.
- `Hang Clean Progression`, `Jump Progression`, `Side Toss Progression` — the same, in the power family.
- `Sample Power Circuit` — a piece of programming, not a movement.
- `Sprinting Patterning`, `Upright Running Patterning` — a mechanics lesson.

The `COACHING` regex matches these shapes. `Bad Push Up` is the one worth
keeping in mind: a title that names a real movement, matches the library
strongly, and must still be declined — which is why the rules run *after* the
library gets first refusal and can still reject what it recognised.

### 16.2  Athlete highlights, and the half a regex cannot reach

A named lifter hitting a number is a record of a set. The movement is already
in the list under its plain name.

The mechanical tells are matched — `Johnny 455 lb Farmer Carry` (a weight),
`Matt Cleans 245 for 5` (a `for N`), `Ben doing Ball Drops` (a `doing`),
`Copy of 2 DB SLDL` (an explicit copy).

**A bare first name is not reachable and an attempt was reverted.** A heuristic
flagging a capitalised non-library word at either end of a title was written,
run, and deleted the same hour: on these seven playlists it fired five times
and was right once (`Dave Shuffle Side Toss`), wrong on `Valslide Hip Flexion`,
`Sideways Sled Push`, `Lean Fall Run` and `Wall Drills for Sprint Mechanics`.
Four false marks to catch one name is worse than no marks, because a reader who
learns to ignore the flag also ignores the true one. The report now prints a
standing one-line reminder instead, and `Kasey TrapBar Deadlift` and
`RFE Split Squat Kyle` are caught the way they always were — by eye.

### 16.3  Two matcher bugs the new playlists exposed

**A hyphen was not a separator.** `X-Pulldown` stayed a single token, matched
nothing in `x-pulldown`, and was reported as a candidate at **0.00** — the most
confident possible way of being wrong, on an entry the library already held.
The same bug hid `TrapBar Deadlift` behind `snatch-grip-deadlift`. Splitting on
`-` fixes it; `t-spine` is expanded before the split, being the one key that
needed the hyphen to survive.

That fix broke two things on the way, both caught by re-running the diff rather
than by reading the patch:

- Short tokens were dropped wholesale (`w.length > 2`), which was harmless only
  while a hyphen glued them to a neighbour. Once split, `X-Pulldown` lost its
  `x` and matched `w-pulldown` — the wrong entry, reported confidently. And
  `5-10-5`, previously matched to `pro-agility-shuttle`, became three tokens of
  length ≤ 2, scored 0.00, and reappeared as a candidate. Replaced by a
  stoplist: the letter *is* the movement in `x-pulldown`, `w-pulldown`,
  `t-bar-row` and `a-march`.
- Light plural stemming was added so `Sled Crossovers` reaches `crossover-run`,
  guarded so `press` does not become `pres`.

`trapbar` was added to `ABBREV` as one word. **`valslide` was considered and
rejected**: a slide disc is not a slideboard, and mapping one to the other
would manufacture exactly the false "already have it" the matcher's own comment
calls the worse of the two errors.

### 16.4  Two declined, and why

- **`Ball Drop`.** A contact sheet settled it: a coach stands holding a ball,
  drops it, and the athlete reacts and sprints to catch it. It needs a second
  person, and none of the other 485 entries do. A solo generator prescribing a
  partner drill is a card the athlete cannot use.
- **`Ladder`.** The title says nothing and the clip will not download. §14.1's
  rule applies unchanged: a movement nobody can describe accurately does not get
  invented cues. The two ladder drills that *could* be seen were authored —
  `ladder-quick-through` and `ladder-quick-stick`, both read off contact sheets,
  the clips being silent as always.

The full **Turkish get-up** went the other way. `Turkish Get Up Series` is
coaching content and was declined as such, but the movement it teaches was a
real hole: the library held `get-up-to-elbow`, `get-up-to-hand` and
`get-up-to-hip-lift` and stopped there, so the sequence had three rungs and no
top. `1/4 Get Up` and `1/2 Get Up` are those existing rungs under other names.

### 16.5  The allowance FELL, after first rising — and §15.5's rule was wrong

`FLOOR_OVERRUN_ALLOWANCE_MIN` went **7 → 6**. Worst 66 min on max-strength/seed
775 over the usual 70,000-session sweep, so 66 − 60 = 6. The margin against the
athlete's stated ≤ 70 min (`spec.md:36`) is **four minutes, the widest it has
ever been.**

It did not start there. The 27 new entries alone took the worst case to **68**
(power/seed 5522), which by the standing rule would have made this **8** and
left two minutes of his margin. That number was derived, written down, and then
not shipped: §14.3 had already named the remedy — "packing the cool-down the way
`packPrep` packs the prep" — and the athlete chose it over spending the margin.
§16.6 is that work. It is worth 2 min on the worst case, which more than pays
for the batch.

**§15.5's rule does not hold.** It concluded that this number *tracks the
mobility pool's composition, not the library's size*. This batch added **zero**
mobility-pattern entries and moved it anyway. Ablation against the pre-fix 68,
run before the conclusion was written rather than reasoned about:

- Remove the four new prep-pool entries (P3 draws `sprint-drill` + `agility` at
  accessory: `lean-fall-run`, `band-resisted-lateral-shuffle`, and the two
  ladder drills) → still 68, same seed. Not the prep half.
- Remove the two expensive new core entries (`turkish-get-up`,
  `resisted-bear-crawl`) → still 68, on power/seed 6581 instead. Not those.

No single entry was responsible: drop any one and the worst case relocated to
another seed at the same 68. The honest rule is weaker than §15.5's and is what
replaces it: **a bigger library costs session time wherever it grows, and the
only way to know the number is the sweep.** §15.5 had two observations and drew
a mechanism from them; the third observation contradicted it.

### 16.6  packCooldown gains a third lever

`packCooldown` had two levers and, on the draw that produces the worst case,
**both bottomed out well above the budget**. A cool-down at its own floor —
three static stretches, two core blocks — prices at **16 min against
`COOLDOWN_MIN`'s 12** whenever the core draw is per-side and rep-based, because
2 sets × 15 reps × 2 sides is 60 reps charged at the barbell `SECONDS_PER_REP`.

That is not a tight budget. It is a budget its own floors cannot reach, and it
had been sitting there being reported as an overrun nothing could fix.

The third lever is **the core dose inside its own sourced range**, applied
before any movement is dropped:

| order | lever | floor | why that floor |
|---|---|---|---|
| 1 | third core set | `CORE_SETS` → 2 | modal dose of the 31 pooled trials |
| 2 | **core reps / hold seconds** | `CORE_REPS[0]` = 10, `CORE_HOLD_SEC[0]` = 30 | **new** — the bottom of the project's own sourced range |
| 3 | stretch count | 3 | ACSM floor |

**This widens nothing.** `CORE_REPS` is `[10, 15]` and `CORE_HOLD_SEC` is
`[30, 45]`; both ends already sit inside the dose envelope of the 31 trials
pooled in Saeterbakken 2022 (10–25 reps, 20–60 s holds), and `rules.js` states
plainly that no trial in that pool moderates on reps — so there is no optimum
being given up. Trimming from the top of the project's range to the bottom of it
lands on a dose the project already calls sourced. It cannot go below the floor,
and a cool-down already inside its budget is not touched at all.

**Ordering it before the stretch drop changes what an over-budget session
loses.** Previously it lost a whole movement while two core blocks sat at the
top of their range. Now it does fewer reps of everything prescribed. That is the
better trade here specifically because M1 is `matchWork`: the stretch that would
have gone is one chosen for what the day actually trained.

The `guard` went 20 → 60, because lever 2 moves one rep or five seconds per
iteration and two core blocks walking 15 down to 10 is ten iterations on its
own. A guard that stopped short would have left the block over budget while
reporting it packed.

Two tests were added in `tests/mobility.test.mjs`: one that the fixture which
bottoms out both original levers now trims reps rather than a stretch and never
goes below `CORE_REPS[0]`, and one that a cool-down already inside its budget
keeps its full dose.

---

## 17  A different channel, and the first playlist that mostly wasn't there — BUILT 2026-09-05, `sw.js` v53

*Depth Training, "Exercise Videos" — 170 titles, 8 entries. The lowest yield of
any playlist mined so far, and the section is worth keeping mainly for why.*

### 17.1  The gap analysis came first, and it should have changed the target

Before the playlist was diffed, the library was measured for where it actually
feels thin — not pool size, but how often a movement comes back. 150 independent
36-session blocks (12 weeks at 3x/week), each session's history fed forward the
way the app does it:

| pattern | pool | draws / block | mean repeats | worst |
|---|---|---|---|---|
| **run** | 8 | 38.4 | **4.80** | `warmup-jog` 21 of 36 sessions |
| **sprint** | 11 (7 ever drawn) | 18.1 | **2.59** | `build-up-run` ×5.7 |
| mobility | 134 | 218.9 | 1.63 | `straight-knee-ankle-mobilization` ×3.3 |
| jump | 28 | 15.0 | 0.63 | |
| core | 52 | 29.4 | 0.57 | |
| *everything else* | | | **≤ 0.36** | |

**The gym half of this library is finished.** Squat, hinge, push, pull and lunge
all sit between 0.16 and 0.36 mean repeats — a movement essentially never comes
back inside a training block. Adding to those pools cannot be felt. The run and
sprint pools are where repetition lives, and `warmup-jog` is not template-pinned
— it is drawn from the 8-entry `run` pool, so entries there would dilute it.

**This playlist contains no running and no sprint work at all.** It was mined
anyway, with that stated up front, because the athlete chose it knowing the
yield would land in pools that are already saturated.

### 17.2  The buckets: 170 titles, 8 entries

| bucket | count |
|---|---|
| already in the library — 19 the matcher caught, **57 it did not** | 76 |
| DECLINE: implement / position / grip variant | 41 |
| DECLINE: chained combo | 33 |
| DECLINE: method on a lift | 6 |
| identified by contact sheet, then resolved | 5 |
| **authored** | **8** |

A 4.7% yield, against 25% for the coach's second playlist and 25% for the seven
pattern playlists. The declines are the standing categories, not fresh
judgments: `Clean Grip Barbell Front Squat` and `Arms Crossed Barbell Front
Squat` are one grip apart from `front-squat`; `Hex Bar Deadlift 1.5 Bottom Peak
Double Contraction` is a 1-and-a-half rep; `Push Up Plank + T-Rotation +
Shoulder Tap` is three movements in a title.

**The 57 the matcher missed is the number worth remembering.** Its fuzzy score
is built for renamings of the same words, and this channel renames the *thing*:
`Foam Rolling Hip Flexor` → `hip-flexor-roll`, `Hex Bar Deadlift` →
`trap-bar-deadlift`, `Bretzel Stretch` → `brettzel`, `Row Machine` → `rower`,
`Cat and Camel Stretch` → `cat-cow`. Nearest-name scoring cannot see any of
those. **The tool sorts; it does not decide.** Every candidate still has to be
read against the library by hand, and 38% of this playlist's "candidates" were
already sitting in the library under a different word.

### 17.3  The five that needed watching

The clips are silent, so `contact-sheet.mjs` (six frames, one image) is the only
way. Two were real:

- **3-Point Straight Leg Sit-Up** — supine, legs straight and wide, full sit-up.
  Authored. The library had four crunch variants and **no sit-up at all**.
- **Alternating Cross-Behind Toe Touch** — leg crosses behind, hinge to the
  opposite toe. Authored, `mobility-dynamic`.

Three were not:

- **Diagonal Sprinkler Stretch** — quadruped, hand behind head, elbow driving
  down then opening to the ceiling. That is `quadruped-thoracic-rotation`.
- **Iron Cross Squat** — bodyweight squat, arms sweeping to a T. Declined:
  `mini-band-reaching-squat`, `rotational-squat` and `squat-to-stand` already
  cover squat-plus-an-arm-action three ways.
- **Elbow to Knees Bodyweight Squats** — deep squat, elbows inside the knees.
  Declined as a position variant of `deep-squat-hold` / `squat-to-stand`.

### 17.4  A duplicate caught by the pre-flight, not by the author

`Foam Rolling Hamstring` was classified NEW on the strength of a listing of the
roll pool that had been **truncated in the terminal** — `hamstring-roll` was
already there, off the top of the output. The authoring script's own duplicate
check caught it before a line was written.

The lesson is not "be careful". It is that **the pre-flight check belongs in the
script that writes, not in the eye that reads**: a batch author should re-derive
the id set from the file it is about to modify and refuse on collision, because
by then the reasoning is hours old and the listing that informed it has scrolled
away. 9 planned → 8 authored.

### 17.5  The eight, and what they cost

| id | pattern | why it is not a variant |
|---|---|---|
| `fire-hydrant` | mobility-dynamic | quadruped hip **abduction**; the pool had extension and adduction, not this plane |
| `band-assisted-hamstring-stretch` | mobility-static | supine and band-held, not `seated-hamstring-stretch` |
| `side-lying-quad-stretch` | mobility-static | a fifth quad position; the pool already distinguishes four |
| `cross-behind-toe-touch` | mobility-dynamic | crossed-leg dynamic hamstring/ITB, nothing equivalent |
| `kneeling-side-plank` | core | short-lever `side-plank`, derived — the same axis as `long-lever-plank` and `short-lever-copenhagen-plank` |
| `straight-leg-sit-up` | core | the library had no sit-up |
| `kettlebell-windmill` | rotate | no windmill existed |
| `prone-wti-raise` | pull-h | prone scap raise, distinct from `face-pull` and `rear-delt-fly` |

Library 485 → **493**. Suite 570/570, green on the first run — no guard fired,
which is itself unusual and is recorded rather than assumed to be normal.

**The batch was free.** Four of the eight are per-side mobility entries, the
half that costs session time, so the constant was re-derived rather than
trusted: the same 70,000-session canonical sweep puts the worst case at **67 min
(max-strength/seed 4)**, unchanged, so `FLOOR_OVERRUN_ALLOWANCE_MIN` stays at 7
and the cool-down warning stays at 0.000%. The worst seed moved (39 → 4) and the
count of 67-min sessions fell 234 → 204, which is §16.5's rule doing exactly what
it says: a bigger pool re-rolls which seeds land in the tail.

**All eight are reachable**, checked rather than assumed — 5,400 simulated
sessions draw every one of them, from `band-assisted-hamstring-stretch` at 2.21
per block down to `kettlebell-windmill` at 0.18. That check exists because 22
entries in the library are drawn by **nothing** (§17.6).

### 17.6  Open, found while measuring: 22 entries that are never drawn

Across 5,400 simulated sessions, 22 of 485 never appeared. Most are explained —
the sweep declares no equipment, so `ruck-march`, `incline-walk`, `sled-march`,
the two ergs and the measured-ground sprints cannot be selected. But
`dumbbell-snatch`, `kettlebell-clean`, `single-leg-forward-pogo-hop`,
`falling-start`, `half-kneeling-start` and `backward-walk` are bodyweight or
common kit and still never surface.

**Not chased, and deliberately not fixed here.** It is recorded because it bears
directly on library growth: there is no point authoring into a pool that cannot
be reached, and the reachability check in §17.5 exists only because this was
found first.

---

## 18  Alternate names, and a channel that was mostly already here — BUILT 2026-09-06, `sw.js` v54–v59

Four code comments have cited this section since `22b31b8` and it did not exist.
It does now, and it covers one story in two halves: the matcher was rebuilt to
catch movements filmed under another name, and Movement As Medicine is where
that got proven.

### 18.1 `aka` — the alternate name lives on the ENTRY

A channel calls `trap-bar-deadlift` a "Hex Bar Deadlift" and `rower` a "Row
Machine", and the old scorer reported both as new. The fix is an optional
`aka` array of the other names a movement is filmed under.

It belongs on the entry for the same reason the cues do: **it is a fact about
the movement**, and the next channel that renames it should find the answer
already written down rather than in a lookup table inside the tool. The tool
must not accumulate exercise facts.

`derive.mjs` builds variants from an explicit field list, so `aka` is **not**
inherited — checked and correct: "hex bar deadlift" must not propagate to a
deficit variant. If anyone adds it to `INHERITED`, the collision guard fires.

**The guard that matters is collision.** An alias must be lower case, non-empty,
not the entry's own name, not ANOTHER entry's real name, and not claimed by two
entries. Two entries claiming one alias would make the matcher point
confidently at the WRONG movement — worse than the miss it was added to fix.

### 18.2 The measured hit rate

Against the 107-title Movement As Medicine fixture at library 524, with the
`aka` values stripped and then restored — the same scorer, the same titles, the
only variable being the aliases:

| | matched | candidates |
|---|---|---|
| without `aka` | 48 (44.9%) | 54 (50.5%) |
| **with `aka`** | **62 (57.9%)** | **40 (37.4%)** |

**23 aliases on 19 entries move 14 titles and buy 13 points of hit rate.** Each
of those 14 was a confident duplicate waiting to be authored under a new id.

### 18.3 The channel: 218 videos, 107 movements, 31 entries

The athlete's brief was that the playlists are polluted. Two layers, and only
the first is visible from playlist names — the pull, the filtering and the
duration evidence are recorded in `tests/fixtures/README.md`.

Of the 83 candidates the diff produced, **31 became entries and 16 became
aliases**. The rest were declined, and the declines are the project's own rules
working:

- **§3.2, one movement at several doses.** Five reverse slider lunges at
  different loads collapse to one slider variant. This is the same refusal §3.2
  made of "Long Run", "Recovery Jog" and "Progression Run".
- **Methods on a lift.** "Front Squat With ISO Hold", "Dumbbell Bench with ISO
  Hold" — the diff tool already has a bucket for these.
- **Already present under another name**, which is what §18.1 exists to catch.

Yield by batch, and the shape is worth noting: **core 12 of 30, gym lifts 12 of
31, mobility 7 of 24.** Mobility was lowest because the library was already
finished there — it holds thirteen foam roll entries covering every region, and
six foam-rolling candidates collapsed onto four of them.

### 18.4 Two movements the library cannot express — the most useful finding here

Both were real additions, both were written, and both were removed because a
guard was right:

- **Single-leg calf raise.** `taxonomy.test.mjs` requires `pattern: squat` to be
  bilateral and `pattern: lunge` to be unilateral. There is no unilateral ankle
  pattern, and filing a calf raise under `lunge` would let a lunge slot draw it.
- **Wall sit.** The `isometric` flag is only read for `pattern: core`
  (`generator.js` resolves `mode: 'core'` per exercise), so a squat-pattern hold
  has no way to be dosed in seconds. A wall sit prescribed as "3 x 12" is the
  same wrongness as "3 x 12" for a plank.

A third, smaller: the PVC shoulder external-rotation stretch needs a dowel, and
the equipment vocabulary has neither dowel nor PVC. Adding one for a single
entry is a vocabulary change, not an authoring one.

**These are library limits, not authoring gaps**, and they are worth more than
the entries that did land: they name exactly what would have to change before
those movements could exist. Nothing here is a reason to change it yet.

### 18.5 The cost, re-derived rather than assumed

The mobility batch grew the prep and cool-down pools, so the allowance was
re-derived on the canonical sweep — 70,000 sessions, 7 day types x 10,000
seeds, no `returnDate`. Worst session **67 min** on `max-strength`/seed 10,
**zero** sessions over 67, re-derived allowance `worst - 60` = **7,
unchanged**. The seven mobility entries cost nothing and the margin against the
athlete's stated 70 min stays at three minutes.

## 19  Closing the last two pools — 2026-09-07

The brief was the one §11.0 of `design-running-programming.md` left: raw
shortfall 5, in two pools, "closeable by authoring or by tagging, which is
exactly why neither is exempt." **One closed. One moved by one and stopped, and
the reason it stopped is worth more than the entry that landed.**

| pool | was | now | need |
|---|---|---|---|
| `primary :: jump :: (any)` | 14 | **16** | 16 |
| `primary :: hinge/pull-h :: power` | 13 | **14** | 16 |

### 19.1  The jump pool: two gaps in the movement, not in the counter

The rule this project keeps is §3.2's: an entry has to be a movement, not a
dose. So the question was never "which two jumps would make sixteen", it was
"what can this athlete's legs be asked to do that the library has no way to
ask". Two answers, both found by tabulating the 14 by direction and takeoff
rather than by reading the names:

1. **No unilateral vertical jump existed.** The library held four one-legged
   jumps and every one of them travelled — `single-leg-bound` and
   `single-leg-forward-pogo-hop` forward, `lateral-bound` and
   `single-leg-lateral-hurdle-hop` sideways. Nothing asked for a vertical
   takeoff from one leg, which is how a footballer actually leaves the ground
   most of the time. `single-leg-box-jump` is the version that lands ON the
   box, so the eccentric cost stays where a returning athlete can afford it.
   The transfer argument is sourced rather than assumed: a 2025 meta-analysis
   finds unilateral plyometric work improves single-leg jump, acceleration and
   change-of-direction while **bilateral work does not transfer to unilateral
   tasks** — the two are not substitutes, which is precisely the claim needed
   to justify an entry rather than a repetition.
   https://link.springer.com/article/10.1186/s13102-025-01113-6

2. **No jump began from an approach.** All 14 started from standing. The
   approach jump converts horizontal speed into vertical, which is a different
   skill from a countermovement jump and is measured as a different quantity —
   an athlete can be good at one and poor at the other, and the run-up version
   is the one that resembles the sport.
   https://www.sportsmith.co/articles/using-the-approach-vertical-jump-for-athlete-monitoring-and-training/

Both are `plyoIntensity: high`, both `tier: primary`, neither is loadable, so
neither owes the coefficient register anything. `primary :: jump :: (any)` is
now in `CLOSED_POOLS`.

**A third candidate was declined and is recorded so it is not re-proposed.**
The canonical low-to-high progression ends "squat jump, double-leg tuck jump,
alternate-leg bound, single-leg hop" and the library holds all four already —
`tuck-jump` at `secondary`. Re-tiering it to `primary` would have closed the
pool in one line, and it is exactly the move §5.4 refused: the tier becoming a
knob instead of a claim.

### 19.2  The smoke test that caught the app, not the data

Written to check the two entries could actually be drawn, which took four
lines. It drew one of them 167 times in 1,500 plyometric sessions and the
other **zero**. The pool the matrix had just declared closed was not the pool
the app drew from: `venue: 'either'` was being read as a requirement, so on the
two day types that declare it the app saw 9 primary jumps where the matrix saw
16, and `box-jump` and `depth-jump` could not be prescribed at all.

Full account, measurements and the one-clause fix in
`design-running-programming.md` §11.2. It is recorded there because it corrects
that document's own September finding, but the lesson belongs here too: **an
entry that passes the coverage test has been counted, not delivered.** Every
authoring batch from here checks the movement comes out of the generator, not
just out of the matrix.

### 19.3  The power pool: one entry, and why the last two are not there

`squat-snatch` was authored, and it is the entry §5.4 missed rather than one
§5.4 refused. §5.4 declined "a fourth clean height or a third snatch height" —
hang-snatch, high-hang-snatch, block-clean — because bar position is a dose.
Catch depth is not: the library already carries `squat-clean` on exactly that
argument, and the full snatch is the same move on the snatch side. It arrived
with its coefficient sourced, which is what the ratchet demands of a new
loadable movement, and the source is one this register was already citing.

**The remaining two cannot be authored honestly, and there are now two
independent reasons rather than one.**

- **§3.2, unchanged.** What is left in the catalogue is bar position — hang
  high pull, mid-thigh pull, block work. Same movement, different start.
- **The coefficient ratchet, which did not exist when §5.4 was written.** The
  best training case for this pool is Suchomel, Comfort and Stone's five
  weightlifting pulling derivatives, of which this library lacks two: the
  **jump shrug** and the **mid-thigh pull**. Both are recommended specifically
  for athletes who are not competitive weightlifters, which is this athlete
  exactly. https://doi.org/10.1007/s40279-015-0314-y

  Neither can be entered. A pulling derivative has no 1RM of its own — nobody
  tests a jump shrug to failure — and the literature prescribes it as a
  percentage of the 1RM *hang clean*: about 30% for the jump shrug, about 45%
  for the high pull. `prCoef` cannot express that. It claims a ratio between
  two maxes, and picking a value that happens to land the zone on the right
  percentage would make the number the athlete reads correct and the claim
  behind it false. Entering them `loadable: false` is worse — `prescribe()`
  drops to reps and prints "leave 2-3 reps in reserve" on a movement whose
  entire point is the load and the intent.

  **This is the same class of finding as §18.4's wall sit**: the movement is
  real, it is sourced, it is wanted, and the model has no way to say it. What
  would have to change is a per-exercise dose reference — a percentage of a
  DIFFERENT lift's max — which is a schema question, not an authoring one.

So `primary :: hinge/pull-h :: power` stands at **14 of 16**, still outside
`CLOSED_POOLS`, and the matrix will keep printing `short 2`. Open question 5
was written for exactly this state and its three resolutions still stand,
better informed: widen the slot's tier, accept a shorter repeat horizon for
this one pool, or accept 14 and record why. **Doing nothing remains a valid
choice**, and it is a smaller one than when the number was 13.

### 19.4  A source already in the register held an answer nobody had asked it

`hang-power-snatch` sat at 0.90 `[unverified]` since August. The paper the
register cites for `snatch-pull` — PLoS One 2019, 16 weightlifters, seven tests
over two years — reports **three** ratios in one sentence, and the register was
using the first: PS/S 0.88, HS/S 0.95, HPS/S **0.79**. Both of this library's
snatch coefficients hang off the same root, so 0.79 / 0.88 = 0.898. The
inherited 0.90 is inside one standard deviation of that and does not move.
https://pmc.ncbi.nlm.nih.gov/articles/PMC6890263/

`UNVERIFIED_BUDGET` falls **19 to 18** for a number that gained a source
without changing, the third time that has happened here after
`trap-bar-deadlift` and `safety-bar-squat`. It cost no reading at all. Before
hunting a new source, re-read the ones already cited: they were mined for one
number and asked nothing else.

## 20  E3 Rehab: 2196 titles, four entries — 2026-09-07, `sw.js` v61

*The largest pull the project has made and the smallest batch it has authored.
§17.1 said the gap analysis should have changed the target and did not. This
time it did, and the section is worth keeping for that rather than for the four
entries.*

The channel, the pull and the assessment exclusion are in
`tests/fixtures/README.md`. The short version: 80 playlists, 2224 unique videos,
all of them short silent clips with no podcast half to strip, and a playlist
index organised by joint and action rather than by plane and laterality. 2196
titles reached the diff. 480 were already in the library, 59 fell to the tool's
standing decline rules, and **1657 came out as candidates — the largest
candidate list by a factor of twenty, against four authored entries.**

### 20.1  The measurement ran first, and it removed most of the channel

Before diffing anything, the library was measured the way §17.1 measures it —
150 independent 36-session blocks, history fed forward — and the answer had not
moved since 2026-09-05 despite 34 entries arriving in between:

| pattern | pool | mean repeats / entry |
|---|---|---|
| `run` | 8 | 3.75 |
| `sprint` | 11 (7 ever drawn) | 1.72 |
| `mobility` | 145 | 0.69 |
| everything gym-side | | **≤ 0.09** |

Squat, hinge, push, pull, lunge and core are all at or under 0.09 repeats: a
movement essentially never comes back inside a twelve-week block. **This channel
is overwhelmingly gym-side.** Squat Variations alone contributed 131 candidates,
Band Exercises · Upper Body 134, Horizontal Pull 64, Deadlift Variations 51. All
of it would have been real, correctly-authored, unnoticeable work.

That is the §17.1 lesson applied instead of merely recorded. The Depth Training
playlist was mined anyway after the same finding; this one mostly was not.

### 20.2  The joint table, which is where the four came from

Pool size is not pressure. Splitting the 145-entry mobility pool by joint —
options against how often each joint is actually drawn — gives the number that
decided this batch:

| joint | options | static | dynamic | draws / block | draws per option |
|---|---|---|---|---|---|
| hip | 91 | 39 | 52 | 138.4 | 1.52 |
| ankle | 27 | 11 | 16 | 55.0 | **2.04** |
| knee | 33 | 15 | 18 | 55.9 | 1.69 |
| shoulder | 42 | 14 | 28 | 52.8 | 1.26 |
| lumbar | 26 | 11 | 15 | 37.4 | 1.44 |
| **elbow** | **2** | 2 | **0** | 3.5 | 1.74 |
| **wrist** | **1** | 1 | **0** | 2.0 | 1.96 |

**The zero is the finding, not the small number.** The prep block draws
`mobility-dynamic` and the cool-down draws `mobility-static`. With no dynamic
option at either joint, the wrist and the elbow could be *stretched* after a
session and could never be *prepared* before one — on a library that prescribes
front squats, cleans, snatches and carries, all of which land on the wrist.
`quadruped-forearm-mobilization` was the only wrist entry in the library and was
drawn **317 times across 5,400 sessions** carrying that joint alone.

The channel has a Controlled Articular Rotations playlist with Wrist CARs and
Elbow CARs in it, and the library already holds five CARs entries with a sourced
dose (§12 of `design-mobility-and-warmup.md`: 3 reps per side at 10 s). So the
two entries that close a zero arrive in a shape the library already knows.

Authored, all four `pattern: mobility`, `tier: mobility`, bodyweight, `either`:

- **`wrist-cars`**, **`elbow-cars`** — `mobility-dynamic`, dosed like the other
  five CARs. These are the two that close the zero.
- **`wrist-flexor-stretch`**, **`wrist-extensor-stretch`** — `mobility-static`,
  the two directions. The library covered neither as a free-standing movement:
  `quadruped-forearm-mobilization` reaches the flexors, but only from hands and
  knees with bodyweight through the hands, which is a position rather than a
  movement and is not available to a wrist that objects to being loaded.

Wrist goes 1 option to 4 (3 static, 1 dynamic), elbow 2 to 3 (2 static, 1
dynamic). Draws per option fall 1.96 → 1.60 at the wrist and 1.74 → 1.39 at the
elbow, and `quadruped-forearm-mobilization` sheds 317 draws to 245.

### 20.3  Thirty-one titles, five movements, zero entries

The Wrist & Elbow Strength playlist is 31 titles and looks like the obvious
answer to a two-option elbow. It is a cross-product: **{Band, Weighted} × {wrist
extension, wrist flexion, radial deviation, pronation, supination} × {plain,
Eccentric, Isometric}**. §3.2 collapses the method axis and the implement axis is
one axis, so 31 titles are five movements.

**They were still not authored, and the reason is the measurement rather than
the rules.** Forearm strength work is `tier: accessory`, `modalities:
["isolation", ...]` — that is where `wrist-curl` already sits. The pool is
`accessory :: (any) :: isolation`: **58 entries, `short 0`**, in a pattern
measuring 0.01 mean repeats. Five more entries there would be correct, cheap,
and impossible to notice. The same argument declines the 40 Calves | Strength
and 50 Hamstrings | Strength candidates.

`eccentric` and `isometric` as *trailing* words are also not caught by the
tool's METHOD rule, which anchors at the start of the title. Not fixed here: the
regex is shared with six other playlists where a leading anchor is what stops
`isometric-split-squat`-style entries being wrongly declined, and this batch did
not need the tool to be right to reach the right answer.

### 20.4  What could not be expressed, and one thing that could not be judged

- **Grip and finger work.** "Ball Squeeze" and "Rubber Band Finger Extensions"
  have nowhere to go: the joint vocabulary is hip, knee, ankle, lumbar,
  thoracic, shoulder, scapula, elbow, wrist, neck. There is no hand or finger.
  Adding one for two entries is a vocabulary change, not an authoring one —
  the same finding as §18.4's dowel, and it is recorded rather than acted on.
- **"Wrist Extension Mobilization"** was left unauthored and is *not* declined
  on a rule. It may be `quadruped-forearm-mobilization` under another name, in
  which case it is an `aka`, or a distinct self-mobilisation, in which case it
  is an entry. Fourteen silent seconds is what separates the two and the clip
  was not watched. An `aka` guessed wrong points the matcher confidently at the
  wrong movement, which `library.test.mjs` says is worse than the miss `aka`
  exists to fix — so it stays open rather than becoming a coin flip.

### 20.5  Counted, then delivered

§19.2's rule was applied before the commit rather than after: an entry that
passes the coverage test has been counted, not delivered. 5,400 sessions,
150 blocks of 36:

| entry | draws | prep | cool-down |
|---|---|---|---|
| `wrist-cars` | 256 | 256 | 0 |
| `elbow-cars` | 181 | 181 | 0 |
| `wrist-flexor-stretch` | 240 | 0 | 240 |
| `wrist-extensor-stretch` | 241 | 0 | 241 |

Every one is drawn, at rates matching the entries they sit beside
(`shoulder-cars` 189, `overhead-triceps-stretch` 212), and each lands only in
the block its modality belongs to. No repeat of the venue filter.

**Open question 3 is now a question that can be answered.** It asks whether
`elbow` and `wrist` deserve `>= 3` coverage rather than `>= 1`. Until today the
answer was forced: with one wrist option and no dynamic option at either joint,
`>= 3` was unreachable and the question was academic. The wrist now holds 3
static and 1 dynamic, the elbow 2 static and 1 dynamic, so `>= 3` is reachable
for the wrist and one entry away at the elbow. Both joints are still marked
`·` — outside the coverage scope — in the matrix, and putting them inside it is
still his call.

## 21  The ankle and knee: nothing to author, six aliases, one thing that cannot exist — 2026-09-07, `sw.js` v62

*The batch that was asked for and did not happen. §20 measured the ankle at 2.04
draws per option and the knee at 1.69, the two most pressured joints in the
library, and the obvious next move was to author into them. They turned out to
be fully stocked already, and the diff had been lying about it in a way §17.2
predicted exactly.*

### 21.1  Pressure is not the same as a gap, and the 16 does not apply here

Two numbers were checked before authoring, because §20's own lesson was that the
measurement decides the batch.

**The distribution is flat.** Across 5,400 sessions the 27 ankle options take
8,134 draws and the top five hold 29% of them, against 18.5% for a perfectly
even split; the bottom five hold 11%. Every one of the 27 is drawn between 105
and 487 times. Nothing is starved, and there is no repeat of the venue filter
hiding half a pool.

**The 16-session target does not govern this pool.** `coverage.test.mjs` sets
`variety = null` wherever `byRepetition` is true, and its comment says why: "the
prep and cool-down pools adapt by repetition". Mobility is sized by COVERAGE —
`OPTIONS_PER_JOINT = 3` — and the ankle passes that at 27 and the knee at 33.
`mobility-dynamic :: hip/knee/ankle` is already in `CLOSED_POOLS`.

Measured gaps between repeats of the same entry put the pressure in proportion:

| joint | repeats observed | median gap |
|---|---|---|
| ankle | 4448 | 11 sessions |
| knee | 3914 | 11 |
| hip | 9051 | 12 |
| shoulder | 2910 | 13 |
| wrist (after §20) | 454 | 14 |

The ankle and knee come back one to three sessions sooner than other joints.
That is tighter, not broken, and it is nothing like the wrist's state before
§20 — which was not a thin pool but a **zero**, a joint the prep block could
never reach. **A zero is a defect. Eleven against twelve is a distribution.**

### 21.2  The whole knee-to-wall family was already here

Every one of the nine Ankle Dorsiflexion videos and all three Ankle Plantar
Flexion videos is already in the library. The diff reported eight of the twelve
as candidates, because this channel names a drill by the **wall** while the
library names it by the **joint action** — §17.2's finding on a different
channel, reproduced exactly:

| E3 title | library entry | the matching cue |
|---|---|---|
| Half Kneeling Knee to Wall | `ankle-dorsiflexion-rock` | "half-kneeling, drive the knee forward over the toes" |
| …(3 Way) | `three-way-ankle-mobilization` | "over the toes, the inside edge, the outside edge" |
| …(Overpressure) | `half-kneeling-ankle-pnf` | "press the toes down hard for five seconds" |
| …(Weighted) | `ankle-dorsiflexion-rock` | a load on a mobilisation is a dose, §3.2 |
| Standing Knee to Wall | `standing-ankle-mobilization` | "stand with one foot ahead and rock that knee forward" |
| Standing Calf Stretch (Knee Straight) | `calf-stretch` | "back leg straight" |
| Standing Calf Stretch (Knee Bent) | `soleus-stretch` | "set up like a calf stretch, then bend the back knee" |
| Rock Back (Plantar Flexion Focus) ×3 stances | `anterior-ankle-stretch` | "top of one foot flat behind you, sit back" |

The knee is the same story: `couch-stretch`, `standing-quad-stretch`,
`side-lying-quad-stretch`, `half-kneeling-quad-pnf`, `seated-hamstring-stretch`
and `knee-cars` cover the ROM playlist, and `nordic-curl`, `glute-ham-raise`,
`slideboard-leg-curl`, `lying-leg-curl` and `seated-leg-curl` cover the curls.

**Six `aka` entries were added rather than six exercises**, and this is the
first time the field has been used on a duplicate found by reading rather than
by watching. The confidence bar §20.4 refused to clear for "Wrist Extension
Mobilization" is cleared here: each alias is confirmed against the existing
entry's own cues, which describe the same mechanics in different words.

Measured after: already-in-the-library **480 → 489**, candidates **1657 →
1648**. Nine titles resolved by six aliases, and the next channel that calls it
a knee-to-wall will not generate a phantom candidate.

### 21.3  Two declines, and the one real finding

- **Heel Slide and Assisted Heel Slide** are genuinely absent and are declined
  on **population**, which is a new reason for this project. They restore knee
  flexion range to someone who has lost it. This athlete has not; for him a
  supine heel slide is a lunge with the load removed and the range already
  available. The library serves a training athlete, and a rehab channel will
  keep offering movements whose indication is an injury he does not have.
- **Plantar Fascia Stretch** and **Toe Yoga** hit §20.4's wall again: there is
  no `foot` or `toe` in the joint vocabulary, and `toe-sitting` already reaches
  the plantar surface. Recorded, not built.

**Balance and proprioception cannot be expressed at all, and this is the entry
worth keeping from the batch.** The Single Leg Balance playlist is 16 videos.
Twelve are one movement at different reach counts — anterior, medial,
posteromedial, posterolateral and combinations — which §3.2 collapses, and three
are `single-leg-rdl`, which the library holds four ways. What is left is
**single-leg balance with a reach**, the Star Excursion / Y-Balance family, and
it has no home:

- It is not `mobility-static`. That modality is stretching, and this is a hold
  against a base of support.
- It is not `mobility-dynamic`. That is range-of-motion work, and the reach is
  not seeking range.
- It is not strength at any tier. There is no load, and `prescribe()` would
  print sets and reps for a task measured in reach distance and control.

The eleven modalities in the library — `max-strength`, `power`, `hypertrophy`,
`isolation`, `plyometric`, `interval`, `aerobic-steady`, `tempo`, `sprint`,
`mobility-static`, `mobility-dynamic` — have no slot for a proprioceptive task,
and the `joints` field has no way to say "the whole limb, under control".

This is the same class as §18.4's wall sit and §20.4's grip work: **the movement
is real, it is wanted, and the model has no way to say it.** It is a larger
version of that finding than either, because balance and reach work is not a
nice-to-have for a returning field-sport athlete — it is the one thing a rehab
library is *for*, and a twelfth modality is a schema change, not an authoring
one. Nothing here is a reason to make that change today. It is a reason to know
what it would cost before the next channel is mined.

## 22  The balance modality, and the warm-up stages nobody was getting — 2026-09-07, `sw.js` v63

*§21.3 said balance work could not be expressed, and that a twelfth modality was
a schema change rather than an authoring one. The athlete asked for the schema
change. It cost four files, three entries and one re-derived constant — and it
found a bug worth more than the feature.*

### 22.1  The bug the feature found

The first thing built was the smoke test §19.2 demands, and it read **0.0% on
every day type**: the balance stage was never drawn. The suite was green, the
coverage matrix counted the pool, and nothing was being delivered.

`packPrep` was the cause, and it was not new. It trimmed with `out.pop()`
against a floor of three BLOCKS, which is the right shape for the gym prep — a
single group of interchangeable drills, where popping means *one drill fewer*.
The running prep is five ORDERED STAGES, so popping meant *delete the
potentiation stage, then the drills stage, then balance*.

Measured on `HEAD`, before any of this work:

| day type | buildPrep produced | packPrep shipped |
|---|---|---|
| aerobic-steady | 9 blocks — P1, P2×4, **P3×3, P4** | 5 — P1, P2×4 |
| sprint | 9 blocks — same | 5 — P1, P2×4 |
| plyometric | 10 blocks — P1, P2×4, **P3×3, P4×2** | 5 — P1, P2×4 |

**Stage 3 (a-skip, carioca, high knees) and stage 4 (build-up runs, low plyos)
had never once reached a generated session**, against
`design-running-programming.md` §5's "every running session runs all four
stages" — which the template builds and which `mobility.test.mjs`,
`running.test.mjs` and `templates.test.mjs` all assert. Every one of those tests
calls `buildPrep` or reads `PREP_BLOCK` directly. None asked what `generate()`
returns, which is the same gap §19.2 found in the coverage test.

This is the third member of one family, and the code comment two lines above the
bug already names it: "a budget compared against content it was never written to
cover" (the jog, 2026-09-05). `PREP_MIN` is the **drill** dose budget — the
constant says so — and it was being charged against an entire five-stage
warm-up. The fix applies it to what it describes: trim drills, never below the
sourced `DYNAMIC_DRILLS` floor of 3, never remove a block that is not a drill.

**The fix is free.** On the canonical sweep with the balance entries removed,
the worst outdoor session is 67 — exactly the old allowance. Three stages that
had never been delivered cost nothing to deliver.

### 22.2  What `balance` is, and why it could not be one of the eleven

A balance task is dosed in **seconds of stance per leg**. It is not
`mobility-static`, which is stretching; not `mobility-dynamic`, which is seeking
range; and not strength at any tier, because there is no load and `prescribe()`
would print sets and reps for a task measured in control. §21.3 established
that; this section only acts on it.

The mechanism turned out to be small, which argues for the split rather than
against it: `eligibleFor` filters one line on `slot.modality`, and
`mode: 'hold'` already prices `sets × holdSec × sides`, with `sides` taken from
`unilateral`. The FIFA dose is expressible with no new prescription shape.

A new **pattern** was needed as well as a new modality. `library.test.mjs`
requires every `pattern: mobility` entry to carry exactly one of dynamic/static,
and forbids anything outside that pattern from carrying one — so balance work
had to become its own family, the way `erg`, `march`, `agility` and
`sprint-drill` already are.

Three entries, `pattern: balance`, `tier: mobility`, bodyweight, `either`:
`single-leg-balance`, `single-leg-balance-reach` (the Star Excursion / Y-Balance
family) and `single-leg-balance-eyes-closed`. All three are
`joints: ['ankle','knee','hip']`, so the pool empties on a hurt ankle. It is
`FLOOR_EXEMPT` for the most literal version of the reason the other fourteen
are: standing on one leg is the last thing a sore ankle should be asked to do.

### 22.3  The evidence, and the dose that does not exist

**The effect is the well-sourced half.** Proprioceptive training reduces ankle
sprain incidence: RR 0.65 (95% CI 0.55–0.77) across seven moderate-to-high
quality RCTs and 3,726 participants, NNT 17. For primary prevention — no prior
sprain, which is this athlete — RR 0.57 (0.34–0.97), NNT 33, on an interval wide
enough to say so. `[verified]`
https://pmc.ncbi.nlm.nih.gov/articles/PMC5737043/

**The dose is the core-dose wall again: the quantity is untested, not unread.**
That review states the programmes "lacked standardization" — 5–30 min, 1–5× a
week, four weeks to a season. The 2024 dosage meta-analysis (20 studies, 682
participants) lands on 20–30 min, 3× weekly for 4–6 weeks, but it studies
**chronic ankle instability rehabilitation**, not prevention in a healthy
athlete, and it explicitly did not identify set numbers, hold durations or
repetition counts. Wrong population, and no per-exercise number in it either.
https://doi.org/10.1186/s12891-024-07800-8

So the dose comes from the only per-exercise prescription that exists anywhere:
the **FIFA 11+ single-leg stance, 2 sets of ~30 s per leg, one balance exercise
per warm-up**. `[corroborated]` — several independent secondary sources state it
identically, and the primary manual is a PDF this project could not open (403,
and the text streams would not extract). It is **not** `[verified]` and must not
be quoted as an optimum. It is the dose a deployed, trial-backed warm-up
programme actually uses.

### 22.4  Where it goes: RAMP's A, put back

`design-running-programming.md` §10 records the four-stage prep as the RAMP
protocol — "Raise, **Activate**/mobilise, Potentiate" (Jeffreys) — so this
project has had RAMP's Activate merged into mobilise since it was built. Balance
work is what that stage is. Splitting it back out at **P3** is the cited
structure rather than a departure from it, and the stages renumber accordingly:
integrate P3 → P4, potentiate P4 → P5.

**Outdoor day types only, and the exclusion is on the CLOCK, not the evidence.**
The gym days have three minutes of headroom against the ceiling; the outdoor
days had seven to twenty-eight. Recorded plainly so nobody later reads it as a
claim that a lifter's ankle does not need this.

### 22.5  Counted, then delivered — and the minutes that were spent

Delivered on **100% of sessions across all four outdoor day types**, at
`2 × 30 s per side` exactly, with the three entries drawn evenly (about 500 each
per 1,500 sessions per day type).

The canonical sweep, 10,000 seeds × 7 day types, `now: 1e12`, no `returnDate`:

| day type | mean | worst | over 67 |
|---|---|---|---|
| max-strength | 63.6 | 67 | 0 |
| power | 61.7 | 67 | 0 |
| hypertrophy | 61.6 | 67 | 0 |
| aerobic-steady | 54.0 | 68 | 13 |
| interval | 53.2 | **70** | 30 |
| sprint | 51.5 | 68 | 1 |
| plyometric | 41.0 | 51 | 0 |

`FLOOR_OVERRUN_ALLOWANCE_MIN` is re-derived 7 → 10 by the same rule as every
value above it: worst 70 on interval/seed 2047, so 70 − 60 = 10.

**This one was spent, not bought.** §18.5 and v49 both left three minutes of
margin against the athlete's stated ≤ 70; there is now none. The athlete was
shown the measured trade — balance on the two highest-risk days for a worst of
67 with no constant touched, against all four days for 70 — and chose all four
on 2026-09-07. The limit is met and never exceeded. It has no room left in it,
so the next change that adds session time has to buy its minutes before it
spends them, the way `CORE_SECONDS_PER_REP` bought §18's.

---

## 23  The slot that printed no weight — 2026-09-09, `sw.js` v64

`design-architectures.md` §7.5 has carried this since the architectures work:

> **Slot B can draw a movement it cannot price.** `snatch-grip-deadlift` is
> `loadable: false, prRef: null`, and slot B exists to prescribe 75–85% of the
> lift's own max. He got 4×2 with no load guidance and asked whether the
> movement was invented. Not addressed here.

It is addressed here. The athlete found this one himself, which makes it the
only item in this document that arrived as a bug report rather than as a
measurement.

### 23.1  The measurement, and how often it fired

Slot B's pool is `primary :: hinge/pull-h :: power`, fourteen entries.
Thirteen are priced. Over 5,000 power sessions the draw is flat, so the one
that is not priced took **383 of them — 7.7%**.

What those sessions printed, seed 13:

```
Snatch-Grip Deadlift
5 × 2      leave 2-3 reps in reserve
```

`prescribe()` is doing exactly what it was written to do. `mode: 'load'` meets
`!exercise.loadable`, falls through to the reps path, and prescribes by effort
instead. That path is right for a weighted dip. On an Olympic derivative it is
close to meaningless: **five doubles at 2–3 reps in reserve** is a rep target
and an effort target that do not describe the same set, on a slot whose entire
stated role is *75–85% of that lift's own max*.

### 23.2  The ratchet decided how this was allowed to be fixed

`coefficients.test.mjs` says a new loadable movement "must arrive with a
sourced coefficient rather than joining the backlog". So the cheap fix — ship
a plausible number tagged `unverified` — is not available, and that is the
ratchet working as designed. This arrived `corroborated` or not at all.

### 23.3  Two bands, and the intersection

Both are coaching sources and both are stated as a percentage of the **full
snatch**:

| source | band | reps |
|---|---|---|
| Catalyst Athletics (Everett) | 80–120% | 2–6 |
| Big Bend Strength | 100–130% | 1–5 |

Intersection **100–120%**, midpoint **110%**. §5.5 established that the
`snatch` root is his *power* snatch, ~0.88 of the full lift (PMC6890263), so
the coefficient is `1.10 / 0.88 = ` **1.25**.

**The ordering is what makes this evidence rather than arithmetic.** Big Bend
ranks the three snatch pulls by load with a mechanical reason — snatch high
pull < snatch pull < snatch deadlift, each dropping a technical demand — and
1.25 sits above `snatch-pull`'s 1.15, which is the order that predicts. The
conversion checks from the other side too: `squat-snatch` is 1.14, and
`1.14 × 0.88 = 1.00`, the full snatch itself, which is what a squat snatch
*is*.

`corroborated`, not `verified`, for rack-pull's reason: **a coaching
working-load band is not a 1RM ratio.** Two things keep this above that bar
rather than below it. The sources are independent and their bands overlap,
which is trap-bar's standard. And nobody maxes a snatch deadlift, so unlike a
rack pull there is no testable 1RM the band is failing to be — the top of the
training band is the closest thing that exists.

**The doubt is recorded with its direction.** 1.25 is the intersection
midpoint. The register already places him at the *top* of these bands for a
sourced reason — Everett calls the band "far too light" for a lifter with a
surplus of strength relative to technical ability — and that argument is
stronger here than for the pulls, because a snatch deadlift has the least
technique of the three. Top-end placement by `snatch-pull`'s own precedent
gives ~1.33. It was not taken, because the two sources disagree and the
intersection is already the strong claim. **If this number moves it should
move up.**

### 23.4  The card was fixed with the number, not months later

This is rack-pull's lesson applied at authoring time. Everett is explicit that
a snatch deadlift is *"not simply a standard deadlift with a wider grip — the
positions, posture and balance match that of a snatch, rather than allowing
higher hips, balance toward the heels."* Those are two different movements and
only one of them is what the band was measured on.

The entry was named **"Snatch-Grip Deadlift"**, which is the powerlifting name
for the *other* one, and its last cue read *"Expect a lot less weight than a
normal deadlift — that is the point"*, anchoring the athlete to a lift this
coefficient does not price. Renamed **"Snatch Deadlift"**, `id` unchanged so
history survives, old name kept as `aka` so the playlist matcher still finds
it. The cues now describe the snatch start position the band belongs to.

### 23.5  Delivered — and the ceiling that eats most of it

Slot B now prescribes a load on **100% of 5,000 power sessions**, against 92.3%
before. Seed 13 prints `0.95 × Snatch PR` with a warm-up ladder where it
printed nothing.

**And 91% of those draws come out of the clamp rather than the zone**, which
is a finding about the app and not about this entry. `prescribe()` bounds the
displayed multiplier at `env.pctCeiling`, and `rampRow()` clamps every week
past the table to the last row — so the week-5 ceiling of 0.95 applies
**forever**, to an athlete the app's own `stillRamping` test
(`generator.js:1163`, and again at `:425`, both `rampWeek < RAMP.length`)
says is not ramping.

Measured at full volume, no `returnDate`, on the library **before** today's
change, so this is not something this entry introduced:

| day type | load blocks | printing "held down by the return ramp" |
|---|---|---|
| max-strength | 4534 | **38.3%** |
| power | 4380 | 5.3% |
| hypertrophy | 2930 | 0.0% |

Two consequences, and the second is the serious one. Any coefficient above
~1.12 is inert at full volume — the sourced 1.25 reaches the card on 9% of
draws and the other 91% print 0.95 whatever the register says. And the card
makes **a false statement to the athlete on 38% of max-strength blocks**: he
is not being held down by the return ramp, he is meeting a permanent policy
ceiling that no document describes as permanent.

This is the third member of the family §22.1 named — the venue filter, the
prep budget, and now the ramp ceiling: **a budget compared against content it
was never written to cover.** It is left open here rather than fixed, because
removing a load ceiling is a training decision and not a bug fix, and it is
his. Recorded at `design-architectures.md` §7.5.

---

## 24  The ceiling that never lifted — 2026-09-09, `sw.js` v65

§23.5 found it while pricing the snatch deadlift and left it open, because
removing a load ceiling is a training decision. The athlete made that decision
the same day: **keep the cap, fix the sentence.** This is that work, and it
turned out to have a third part nobody had asked for.

### 24.1  What was actually wrong

`rampWeekFor` returns the **last** ramp row for two different situations — "you
are in week 5" and "you never declared a return date" — and `rampRow` clamps
every week past the table to that row. So week 5's `pctCeiling` of 0.95 applied
forever. The app knows this: its test for whether the ramp is running is
`rampWeek < RAMP.length`, used at `reasonFor` (which is why no session banner
mentions a ramp at full volume) and again in `swapBlock`.

`prescribe` did not have that line. It set one flag, `rampLimited`, whenever
either clamp bound, and the card renders that flag as *"held down by the return
ramp"*. Measured at full volume with no `returnDate`:

| day type | load blocks | said "held down by the return ramp" |
|---|---|---|
| max-strength | 4534 | **38.3%** |
| power | 4380 | 5.3% |
| hypertrophy | 2930 | 0.0% |

**The cap was right and the sentence was false.** That is worth separating,
because it decides the fix: nothing about the load needed to change.

### 24.2  The cap is now a policy with a name

`STANDING_PCT_CEILING = 0.95` in `js/rules.js`, and it carries its own
reasoning rather than inheriting it from a table row it was never meant to
share. **It supersedes a stated design intent**, which is why it is written
down instead of left implicit: the comment above `RAMP` says the column was
"chosen to approach an **open** ceiling gradually". The ramp was meant to end
with no cap at all. It never did, and now it deliberately does not.

The case for keeping it: his PRs are college numbers he holds in his own head,
the app cannot drive progressive overload and so never learns they have moved,
and he trains alone. Prescribing above 95% of a number the app cannot verify is
the one error it should not make.

`prescribe` now sets `rampLimited` or `ceilingLimited`, never both, and the
card has a second sentence — *"at the app's standing 95% cap"* — worded as a
standing limit rather than an event, because it is not going to stop happening.

### 24.3  The part nobody asked for: the ladder went through the ceiling

The test written to check the flags failed on a block that was flagged capped
and printed 0.91. Chasing that found the ladder.

`ladderise` spreads a block's working sets into a wave **centred** on the load
`prescribe` drew, and bounds the step by the **zone** — `roomBelow`,
`roomAbove`. Neither of those is the ceiling, and once `prCoef` is above 1.00
they are different numbers. Measured before the fix:

| week | ceiling | load blocks | printing a set over it | worst printed |
|---|---|---|---|---|
| full volume | 0.95 | 1533 | **4.0%** | **1.00 × PR** (push jerk) |
| ramp 1–4 | 0.65–0.85 | ~1530 each | 0.0% | — |

**The ramp was never breached, and the reason is worth keeping.** During the
ramp `block.pct` is clamped far *below* the zone floor, so `roomBelow` goes
negative, the step goes with it, and the block falls through to straight. The
hole only opened where the ceiling sits *inside* the zone rather than under it —
which is exactly the situation the standing cap creates and the ramp does not.

Fixed by adding a third bound on the step, in display space, rather than by
clipping the top rung. Clipping would flatten the wave's top and pull the mean
rung below the straight load, which is the intensity change §3.2 says the
ladder is not allowed to make. Narrowing keeps it centred, and when it narrows
past `LADDER_STEP_MIN` the block goes straight and says so — the behaviour the
function already had for a band too narrow to wave in. **0.0% over the ceiling
in every week afterwards.**

### 24.4  The cost, and it is the number he should see

Enforcing the cap costs ladders, because a wave centred on a load that is
already at the cap puts half its rungs through it and cannot be built:

| | ladder | straight | ladder share |
|---|---|---|---|
| before | 504 | 674 | 42.8% |
| after | 277 | 901 | **23.5%** |

**Nearly half the ladders became straight sets, and that is a consequence of
keeping the cap rather than of fixing the label.** It was not known when the
choice was made — the ladder hole had not been found yet. It is recorded here
at full size because it is the strongest argument for the option that was not
taken: lifting the ceiling after the ramp would restore the ladders *and* let
the sourced coefficients above ~1.12 reach the card. The decision stands as
made; the price of it is now measured rather than assumed.

Six tests in `tests/ceiling.test.mjs` and four in `tests/card.test.mjs`. 597/597.

---

## 25  Three movements the app owned and could never prescribe — 2026-09-09, `sw.js` v66

Performance Course was picked because the measurement pointed at running and
sprinting. The pre-flight §17.5 requires — *is the pool reachable before you
author into it* — found the answer before a single title was judged, and it was
not about the channel at all.

### 25.1  The measurement, first, as §20.1 requires

150 blocks × 36 sessions, history fed forward, mean repeats per drawn entry:

| pool | entries | mean repeats per block |
|---|---|---|
| balance | 3 | **5.98** |
| run | 8 | 3.90 |
| sprint | 11 | 3.27 |
| mobility | 149 | 0.82 |
| everything gym-side | — | ≤ 0.25 |

`balance` is new pressure that §22 created yesterday: three entries delivered on
every outdoor session. The gym half has not moved.

### 25.2  The reachability check, and what it found

A static sweep of every slot in every template against every entry, asking only
whether the slot's `tier`, `patterns`, `modality`, `effortClass` and
`plyoIntensity` admit it. **Thirteen entries of 534 are admitted by nothing.**

Three of them are sprint starts: `falling-start`, `half-kneeling-start`,
`lateral-half-kneeling-start`. They are `accessory` tier and `maximal` effort,
and no slot anywhere accepted that pair:

| slot | takes |
|---|---|
| sprint A (was) | `primary`, maximal |
| sprint B (was) | `secondary`, maximal |
| aerobic-steady strides | `secondary`+`accessory`, **submaximal** |

The channel settles that these are real: Performance Course films *Falling
Start*, *Half Kneeling Start* and *Lateral Half Kneeling Start* under those
exact names, and the diff matched all three as already-in-the-library. The
library was right about the movements and could not prescribe them, in the pool
measuring third for felt repetition.

### 25.3  The minutes came from a slot running against its own design

§6.3 of `design-running-programming.md` says slot C's pool is `flying-run` and
that it is *"unreachable by default"*. It was neither.

The gate lived on the **entry** — `eligibleFor` drops `requiresMeasuredGround`
unconditionally and `flying-run` is the only entry carrying it — so the slot did
not empty. It filled with an ordinary primary maximal sprint on **100% of 5,000
sprint sessions**, handing out a second helping of `acceleration-sprint`,
`hill-sprint` or `sled-push`. Never the same movement as slot A, because
`excludeIds` forbids that; simply a third maximal sprint block on a day designed
for two.

**Fourth instance of the family §22.1 named**, after the venue filter, the prep
budget and the ramp ceiling: a gate checked against content it was never
written to cover. The flag now sits on the slot, where the opt-in it waits for
will sit, and `generate()` skips it outright.

### 25.4  Counted, then delivered — and it was free

The start slot is `tier: ['accessory']`, which expresses "a start" exactly the
way the slot below it expresses "hill or resisted", and for the same reason:
the library carries no field for it. Dose 3–4 reps at 15–20 m; coaching sources
converge on 3–6 reps of 10–20 m with 1–2 min rest per 10 m, which brackets the
day's existing 96–160 s, so **no new rest constant was invented**.
`optional: false`, because an optional slot is how §22.1's warm-up stages went
undelivered for months.

10,000 seeds, sprint day:

| | before | after |
|---|---|---|
| worst session | 68 min | **68 min** |
| mean | 51.5 | 53.7 |
| start slot filled | — | **100%** |
| opt-in slot filled | 100% | **0%** |
| sprint metres, worst | 560 | 550 (budget 800) |

The three starts draw evenly, 1646 / 1674 / 1680 across 5,000 sessions. **No
constant moved.** §22.5 said the next change that adds session time has to buy
its minutes first; these were not bought from the athlete, they were recovered
from a defect.

### 25.5  Two tests were asserting things that were not true

**`running.test.mjs` indexed the template by position.** `TEMPLATES.sprint[0]`
was the maximal-sprint slot and is now the start slot. Both are found by role
now, which is the fixture-dependence `design-equipment-and-swap.md` §12.2
already warned about.

**`cns-account.test.mjs` asserted 48-hour spacing on one day type at one seed.**
It passed for a reason that was itself the bug: the sprint day's `cnsLoad` was
**pinned at exactly 9 for every seed**, because the phantom slot always added a
`cnsCost: 3` primary. Seed 3 could not vary. Swept across 60 seeds and all four
high-CNS day types, on HEAD, before any change today:

| day type | load | 1h | 24h | 48h | 72h |
|---|---|---|---|---|---|
| sprint | 9–9 | 100% | 100% | **100%** | 0% |
| power | 7–12 | 100% | 100% | 40% | 0% |
| plyometric | 5–7 | 100% | 100% | **0%** | 0% |
| max-strength | 5–8 | 100% | 100% | **0%** | 0% |

**The 48-hour claim held for one day type of four, and only because a defect
had frozen its load.** Removing the phantom block let sprint vary honestly,
8–9, and 48h reads 75% — still the strictest of the four, with the real gap at
plyometric and max-strength untouched and pre-existing.

The test now sweeps and asserts what is true everywhere (acute veto at 1h and
24h, cleared by 72h), and the 48-hour rates are pinned by a **ratchet** on the
coefficient register's model: recorded, visible, may rise and never fall.
Deleting the claim would have hidden a real gap.

### 25.6  What this opens

`accessory :: sprint :: sprint :: maximal` is a new pool of 3 against a variety
target of 16, so the matrix's raw shortfall goes 2 → 15. That is not a
regression: the pool did not exist yesterday because nothing could draw from
it. Unlike the sprint pools exempted on 2026-09-06, **more starts genuinely
exist** — the channel offers a 2-point start, a rolling start, a wicket start,
a push-up start and a lateral crossover start among others — so this one is
left short rather than exempted, and it is where the pull should land.

Library unchanged at 534. Orphaned entries 13 → 10. 597 → 602 tests.
