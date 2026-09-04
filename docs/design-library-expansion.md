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
reporting `short 3` every run, which is the honest state. The three plausible
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
5. **`primary :: hinge/pull-h :: power` stopped at 13 of 16 and stays open.**
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
