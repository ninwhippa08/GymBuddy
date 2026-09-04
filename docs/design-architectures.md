# Design — session architectures

`spec.md` §4.3 calls architecture "the variety engine" and "the dial that does
the most work". Until 2026-09-04 it was the only dial in that table that had
never moved. `chooseArchitecture` read:

```js
return phase1 ? PHASE_1_ARCHITECTURE : pick(rng, allowed);
```

and `phase1` defaulted to `true`. Every session the app generated in its first
year was straight sets, and the `architecture` field on every stored record
said so, truthfully and pointlessly.
`ARCHITECTURES` in `templates.js` declares seven architectures gated by day
type; none of them has a prescription shape, which `spec.md` §10 records as the
reason they were left last: *"`prescribe()` only knows straight sets, so EMOM,
cluster, complex, circuit and ladder each need a prescription shape. Deepest
change in the project."*

---

## 1. Scope, decided with the athlete 2026-09-04

**An architecture may change the structure around the work, not the work
itself.** Pairing, ordering, rest and the distribution of reps across sets are
in scope. Anything needing a clock or intra-set timing is out: no EMOM, no
cluster sets, no complexes. The athlete's reason was that he did not want to
learn a new way to execute a session at the gym — the card should still read as
a list of sets.

That decision has a consequence worth stating plainly, because it was nearly
invisible: `ARCHITECTURES` gives `max-strength` only `cluster` and `ladder`,
and `power` only `emom`, `complex` and `cluster`. Under the rule above, every
one of those is out except the ladder — so without the ladder, **the two
heaviest day types would keep straight sets forever** and the variety engine
would only ever touch hypertrophy. The ladder is therefore in scope, and it is
the first thing built.

Three architectures are in scope in total:

| Architecture | Day type | Introduces |
|---|---|---|
| `ladder` | `max-strength` | per-set variation — `setPlan` only, no new field |
| `antagonist-superset` | `hypertrophy` | `group` — two blocks that relate |
| `circuit` | `hypertrophy` | the same `group`, N blocks |

---

## 2. What the sources say

### 2.1 Structure is not effectiveness — and that is the point

A 2023 review of 15 studies found pyramid training produces results similar to
straight sets: **the difference is structure, not effectiveness**
`[corroborated]`. This finding is already in the repository, at
`design-mobility-and-warmup.md` §4.3, where it was used to *decline* making the
working sets climb.

It is not being reversed here. §4.3 declined an ascending pyramid as a fix for a
**different problem** — the athlete had described the absence of a warm-up ramp,
and a pyramid within the working sets was the wrong answer to it. That gap was
closed by `WARMUP` and stays closed. What the same finding says about the
present question is that restructuring the working sets costs nothing
measurable, which is precisely the licence a variety engine needs: **a ladder
buys a session that feels different at no measured cost in adaptation.**

The `[unverified]` NSCA-attributed claim in that section — that ascending
pyramids underperform reverse pyramids because the lifter reaches the heaviest
work already fatigued — is deliberately **not** used to shape this design.
§8 q2 of that document states the rule: it "is used only to decline a change,
not to justify one." Using it here to prefer one wave direction would break
that rule.

### 2.2 Wave loading, and where to start it

A ladder in the strength tradition is a **wave**: a run of sets with descending
reps and ascending load, repeated, the second wave heavier than the first.
Practitioner sources give 7-5-3, 6-4-2, 5-3-1, 3-2-1 and 2-2-1 as the common
schemes, with 2–3 min between sets. `[corroborated]`

The one controlled trial found:
[Wood, Goodwin & Cleather 2016, *Biology of Sport* 33(3):257–261](https://pubmed.ncbi.nlm.nih.gov/27601780/)
`[verified]`. 34 resistance-trained men, 20 weeks, twice weekly, bench press,
two progressive wave-loading programmes differing **only** in the initial load:
87.5%/80% 1RM against 82.5%/75% 1RM. Both groups improved significantly and
**there was no difference in the magnitude of improvement between them.**

The authors' conclusion is the design rule this takes: the results "support the
common practical recommendation to start with a lighter load when employing a
progressive wave loading strategy, as such a strategy yields similar
improvements in performance with a lower level of exertion in training."

**Design reading:** waves work, the scheme is a family rather than a number, and
where a choice exists the ladder starts at the **bottom** of the available band.
For a returning athlete that is the same direction the return ramp already
pushes, so nothing here fights `env.pctCeiling`.

---

## 3. Design

### 3.1 Architecture is applied after prescription, not inside it

`prescribe()` keeps one job: doses from the zone. A new pass runs after it and
before packing:

```js
// applyArchitecture(blocks, architecture, rng) -> blocks
```

Three reasons this is a separate pass rather than a branch inside `prescribe()`:

1. `spec.md` §10 warns that `setPlan` is "deliberately *not* shaped for these".
   A transform that reshapes a finished `setPlan` can be read and tested against
   the straight-set version it replaced; a `prescribe()` that grows a second
   mode cannot.
2. It is testable in isolation — feed it blocks, assert on blocks.
3. Every architecture in §1's table is a *rearrangement* of what `prescribe()`
   already produced. That is the definition of a transform.

The pass runs on **main-work blocks only**. Prep, mobility and core are never
restructured: their doses are sourced for a warm-up and a cool-down, and a
superset of stretches is not a thing anyone asked for.

### 3.2 The ladder's prescription shape

`setPlan` already models per-set variation — it exists for the warm-up ramp,
where each entry carries its own `reps` and `pct`. A ladder needs **no new
field**: it replaces the N identical `kind: 'work'` entries with N that differ.

**The set count is not the ladder's to choose.** `prescribe()` has already drawn
one — `max-strength` slot A draws 4–6, slot B draws 3–4 — and §3.3 forbids the
ladder from changing total volume. So the ladder *arranges* the sets it is
given:

- **Two waves.** Wave 1 takes `ceil(sets / 2)` rungs, wave 2 the rest, so an odd
  count puts the extra set in the first (lighter) wave. 6 sets → 3+3; 5 → 3+2;
  4 → 2+2.
- **Fewer than 4 sets stays straight.** A 2+1 split is not a wave. Slot B can
  draw 3, and when it does it gets straight sets and the architecture is
  recorded as `straight` for that block.

**The ladder is CENTRED on the working load `prescribe()` already computed** —
that load becomes the ladder's *mean*, not its top. It is zone-drawn, jittered
and `env.pctCeiling`-clamped, so centring on it means the ladder changes the
arrangement of the work and not its intensity, which is exactly the scope §1
agreed.

> **An earlier draft anchored it as the TOP rung, and that was wrong.** It
> looked correct at the middle of the zone and failed everywhere else, because
> `PCT_JITTER` (±0.025) can put `block.pct` *outside* the zone band — a draw of
> 0.83 against a floor of 0.85. The step then came out **negative** and the
> "ladder" ran downhill: 0.85, 0.84, 0.83. A single `rng` fixture of 0.5 hid it
> through eleven passing tests. `tests/architecture.test.mjs` now sweeps the
> draw across the whole range for exactly this reason.

Rungs sit at half-step offsets, wave 2 half a step above wave 1 — which is what
makes it a wave rather than two identical runs. The step is whatever fits the
room available on *both* sides, capped at 5%:

```
step = min( (pct − zone.pct[0]) / mid, (zone.pct[1] − pct) / mid, 0.05 )
```

where `mid` is half the rung span. For `maxStrength` with a drawn 0.90 and 3
rungs a side, `step` is **0.04** — inside the 2.5–5% practitioner range
`[corroborated]`:

| | reps | load |
|---|---|---|
| wave 1 | 4 | 0.85 |
| | 3 | 0.89 |
| | 2 | 0.93 |
| wave 2 | 4 | 0.87 |
| | 3 | 0.91 |
| | 2 | **0.95** |

Mean 0.900 — exactly the straight session's load. Every rung inside the band,
the first rung lighter than the straight session (Wood et al. applied rather
than quoted), the last rung heavier, and the total volume identical.

- **Below a 2.5% step the block stays straight and says so.** Practitioner
  waves step 2.5–5% per rung; tighter than that the rungs are indistinguishable
  at the bar and it is six sets of the same weight with the reps written
  differently. This is what makes a ladder conditional rather than guaranteed:
  measured over 3,000 max-strength sessions, **28.2% carry a ladder** and 34.5%
  of eligible blocks take one.
- **`env.pctCeiling` is inherited, not re-applied.** `prescribe()` clamped the
  centre before the ladder saw it, and the step can only shrink the spread. In
  the early return weeks the ceiling is 0.65, below the `maxStrength` band
  entirely, so there is no room for a 2.5% step and no ladder is built — by the
  same clamp that already shortens the warm-up ramp, with nothing special-casing
  it.
- **Reps descend by one per rung** from the count `prescribe()` drew, floored at
  the zone's rep minimum. Slot A draws 2–5, so a 3-rung wave from a drawn 4 is
  4-3-2. The scheme is therefore jittered per session exactly as every other
  dose is, rather than being picked from a table of named schemes.
- **The warm-up ramp bridges to the FIRST work set**, not the heaviest. It is
  computed from the load the athlete actually lifts first, which is what a ramp
  is for.

### 3.3 What the ladder must not break

- **`block.sets` stays the count of working sets** — six, above — so
  `patternSets`, `cnsLoad` and the neglect model are untouched. A ladder is not
  more volume, it is the same volume arranged differently.
- **`block.reps` and `block.pct` become the set the card leads with**, which is
  wave 1's first rung and the first set he actually lifts. They stop being true
  of every working set, so **the card had to change too**: `ui.workLine` prints
  every rung under the hero line, because without it a laddered card reads
  "6 × 4" over "0.85 × Squat PR" and instructs six sets at the lightest rung.
  `tests/ramp.test.mjs`'s "the work entries restate the working set exactly"
  still holds — it exercises a 3-set block, which stays straight.
- **`estimateMinutes` must read `setPlan`**, not `sets × reps`. A 3-2-1-3-2-1
  ladder is 12 reps where `block.reps` would price six sets of three as 18. The
  time budget is the one place this error would be invisible and expensive.
- **Ordering, packing and swap are untouched.** A ladder is one block; nothing
  about it relates to another block. This is exactly why it is built first.

### 3.4 Groups — sketched, for the slices after the ladder

The superset and the circuit both need two or more blocks to relate. The shape
will be an optional `group` id and a `groupRole` (`A1`, `A2`) on each block —
chosen over a session-level `groups: []` array because swap, trimming and
storage would each have to maintain the array or corrupt it, while a field on
the block travels with the block for free.

Not designed further here. The ladder ships first, and the group design is
written when the superset is built rather than guessed at now.

**Designed 2026-09-04 in §3.6, and the sketch held**: the field-on-the-block
shape survived contact with `packToBudget` and `swapBlock` unchanged. What the
sketch did not anticipate is `groupRounds` — see §3.6.2.

---

### 3.5 Choosing an architecture must not disturb the seed

`chooseArchitecture` draws from `ARCHITECTURES[dayType]` filtered by
`BUILT_ARCHITECTURES` — declaring an architecture is not building one, and the
intersection is what may actually be drawn.

**When only one option survives the filter it is returned without drawing.**
`pick()` consumes a number from the seeded stream, so drawing for a foregone
conclusion re-rolls every later choice in the session. That is not theoretical:
flipping the `phase1` default made `power` — which has no built architecture and
laddered nothing — produce a *different session*, and one of them ran to **71
min against the athlete's stated ≤70** (`spec.md` line 36). The suite caught it
on a 10,000-seed sweep. A day type with nothing built must be bit-for-bit what
it was.

---

### 3.6 The antagonist superset

#### 3.6.1 What the source supports, and what it does not

A 2025 systematic review and meta-analysis in *Sports Medicine* (Ferreira et
al., 26 studies) is the basis. Supersets cut session duration by roughly **37%**
while preserving training volume, and pooled chronic outcomes are
indistinguishable from traditional sets — maximal strength **SMD = 0.10,
p = 0.36**; hypertrophy **SMD = −0.05, p = 0.87**. `[corroborated]` The common
agonist-antagonist protocol is **no rest between the paired exercises**
("succession") and **2 min between rounds**.

- Ferreira et al. (2025). Superset Versus Traditional Resistance Training
  Prescriptions: A Systematic Review and Meta-analysis Exploring Acute and
  Chronic Effects on Mechanical, Metabolic, and Perceptual Variables.
  *Sports Medicine*. https://doi.org/10.1007/s40279-025-02176-8 — PMID 39903375

**The weakness is stated here rather than discovered later.** Of those studies
exactly **one** agonist-antagonist trial examined chronic adaptation (Fink et
al., n = 23). The 37% is pooled across superset types, not measured for
agonist-antagonist alone. So the claim this design rests on is the narrow one:
*restructuring the rest between two opposing lifts does not cost adaptation*.
It is tagged `[corroborated]` — inside the range that worked, on thin chronic
evidence — and it is the same licence §2.1 already established for the ladder,
not a new one.

Agonist-antagonist supersets also produce **higher blood lactate
(SMD = 1.52)** and higher RPE than traditional sets, with **similar perceived
recovery**. The CNS account is deliberately **not** changed for a supersetted
session — see §6 q6.

**2 min needs no new constant.** The hypertrophy slots already draw
`restSec` in the 45–180 s band, and the round rest this design uses (§3.6.3)
lands inside the protocol the source describes. A superset introduces no dose
the zones did not already produce, which is the rule open question 1 settled
for the ladder.

#### 3.6.2 The pairing rule, and its measured reach

> Two main-work blocks pair when their patterns are direct opposites in the
> same plane: **`push-h` with `pull-h`**, **`push-v` with `pull-v`**.

Cross-plane pairs and `squat`/`hinge` were considered and **declined**. The
effect the source describes comes from loading the true opposing muscle, and a
squat paired with a Romanian deadlift shares more than it opposes — pairing
them would have been an extrapolation presented as a finding. Measured over
10,000 hypertrophy seeds, the rules reach:

| rule | sessions with a pair |
|---|---|
| strict push/pull, equal sets only | 26.4% |
| **strict push/pull, any set counts (CHOSEN)** | **47.7%** |
| + cross-plane and squat/hinge, equal sets | 51.4% |
| + cross-plane and squat/hinge, any sets | 78.1% |

**Measured after building: the rule fires on 24.3% of sessions, not 47.7%,
and the gap is an error in the QUESTION rather than in either number.** 47.7%
is how often a hypertrophy session *contains* a pairable push/pull
combination. But `straight` is still in `ARCHITECTURES` for hypertrophy, so
`chooseArchitecture` draws between two options and the superset is selected
about half the time: 0.5 × 47.7% ≈ 24%. The table below measures how often a
pair is *possible*, which is not how often one *happens*, and nothing revealed
that until the architecture was live. Kept as it was measured, with the
correction beside it, because the mistake is the reusable part — the same trap
is waiting for the circuit in slice 3. The outcome puts the superset next to
the ladder's 28.2%, which is the band a variety feature should sit in.

**Set counts are not required to match — the athlete's call.** The equal-sets
variant was recommended because it makes the card a clean list of rounds, and
he took the wider rule instead. The cost is a ragged tail, and `groupRounds`
is what pays it:

> `groupRounds = min(setsA1, setsA2)`. Those rounds are paired; the longer
> block's remaining sets run straight, after the pair.

This is the field the §3.4 sketch did not anticipate. It is carried on both
blocks so neither can be read alone and come out wrong.

**"Main-work block" means exactly what `countsTowardVolume` already means** — a
block whose `mode` is one of `VOLUME_MODES` (`load`, `contacts`, `reps`) and
whose `role` is not `prep`, `mobility` or `core`. Reusing the existing predicate
rather than writing a second definition is the same rule §3.3 applied to the
ladder: two definitions of "the work" would drift, and the one that drifted
would be the one nobody was reading.

Pairing is greedy over those blocks **in template slot order**, which is the
order they are in when grouping runs — after `packToBudget`, before
`orderSession`. A block joins at most one pair. Two pairs in one session are
possible and rare (6.9% of sessions).

#### 3.6.3 Where it runs in the pipeline — after packing, not before

`applyArchitecture` shapes the ladder at step 7a, before `packToBudget`. **The
superset groups AFTER packing instead**, and the reason is §1's scope rule
rather than convenience.

A supersetted session is shorter. If pairing ran before packing, `packToBudget`
would measure the shortened session and therefore trim fewer optional blocks —
so a superset would silently **add work** to the session, which is exactly what
"structure around the work, not the work itself" forbids. Grouping after packing
keeps the work identical and spends the saving on the clock, which is the whole
point of the architecture.

It buys a second property for free: **a group can never be orphaned.**
`packToBudget` both drops optional blocks and shaves sets, and either would
leave a half-pair behind if the group already existed. After packing there is
nothing left to drop.

**Time model.** For a pair, with `R = groupRounds`:

```
paired   = R x (work(A1) + work(A2) + max(restA1, restA2))
leftover = (setsA1 - R) x (work(A1) + restA1)      // one of these is zero
         + (setsA2 - R) x (work(A2) + restA2)
```

The round rest is the **longer of the two drawn rests**: the more demanding
lift governs, and taking the shorter one would be inventing a recovery
saving the source does not describe. Transitions are charged per block exactly
as now — both stations are set up once, and the walk between them is not worth
a constant.

Sanity check against the source: a 3 x 3 pair at 90 s rest and ~30 s of work
per set prices at 450 s supersetted against 720 s straight, a **37.5%** saving.
The source measured 37%. The model was not fitted to that number.

#### 3.6.4 What the superset must not break

- **Volume, load and CNS cost are identical to the straight session.**
  `patternSets`, `cnsLoad`, `sets`, `reps` and every prescribed load are
  untouched. A superset moves rest and order, nothing else.
- **A supersetted session is never longer than the same seed's straight
  session.** Asserted, not assumed.
- **Swap needs no new machinery.** `swapBlock` narrows to
  `patterns: [entry.pattern]`, so a swapped movement keeps its pattern and the
  pair stays antagonist by construction. This matters because the athlete's
  answer to "you must hold two stations" was that he would swap the movement
  when the gym is busy — so that path has to keep working, and it does.
- **Ordering places A1 immediately before A2.** This is the first time an
  architecture touches `orderSession`; the ladder deliberately did not.
- **Every day type but `hypertrophy` is bit-for-bit unchanged.**

**One thing WILL change, unavoidably: every hypertrophy session.** Adding
`antagonist-superset` to `BUILT_ARCHITECTURES` gives hypertrophy two built
options, so `chooseArchitecture` now draws where it previously returned early —
and a draw consumes the seeded stream, re-rolling every later choice. That is
§3.5's finding, and it is not a bug here: it is the cost of building an
architecture, paid once, exactly as the ladder paid it for `max-strength`. It
requires a full duration re-sweep before the commit, against the one minute of
ceiling margin bought on 2026-09-04.

#### 3.6.5 `groupRestSec`, and the rest the card would otherwise have lied about

Found while building the card, not while designing it. `blockCard` prints
`formatRest(block.restSec)` on every card, and for a paired block that number
is **false**: the schedule is A1, straight into A2, then the round rest. Left
alone it would have stated a recovery he does not take, twice per round — the
"lying card" failure the time budget already exists to prevent, relocated into
the one place no duration test would ever look.

The card renders one block at a time and cannot look up a partner, so the
round rest is **denormalised onto both halves as `groupRestSec`** — the same
write-time move `finalise()` already makes for the counters. It is a second
copy of the `max(restA1, restA2)` that `pairSeconds` computes independently,
so a test asserts the two agree rather than trusting them; that is the rule
the coefficient register follows for exactly the same reason.

A1's card reads *"no rest between rounds — go straight into the next
movement"*; A2's carries the rest for the whole round.

**Deviation from §3.6.4, recorded rather than quietly taken:** that section
says the pair renders "under one Superset heading". It does not. Adjacency is
already guaranteed by `groupAdjacent`, so the two halves are joined by a
shared left border and each names its role and round count. A heading between
cards would cost vertical space on a phone held between sets, and would mean
restructuring `blockGroup`, which every other block type depends on.

---

## 4. Build order

Each step leaves a working app and gets its own version bump.

1. **`ladder` on `max-strength`.** BUILT 2026-09-04 (v32). No block
   relationships; `setPlan` only. It proves the whole path —
   `chooseArchitecture` actually choosing, the record carrying the choice,
   `estimateMinutes` pricing it, the card rendering it.
2. **`antagonist-superset` on `hypertrophy`.** BUILT 2026-09-04 (v35), §3.6.
   Introduced `group`, `groupRole`, `groupRounds` and — unplanned —
   `groupRestSec` (§3.6.5). `estimateMinutes`, `orderSession` and the card all
   changed. **Fires on 24.3% of hypertrophy sessions**, saving a mean of
   **3.43 min** and up to 13; 3.6% of sessions carry two pairs.
3. **`circuit` on `hypertrophy`.** The same machinery, N blocks instead of two.

---

## 5. Testing

- A ladder's working sets sum to the same `block.sets` as the straight version.
- Its loads ascend within a wave and never exceed `env.pctCeiling`.
- Its first rung is the bottom of the band (Wood et al.), not the top.
- Reps descend within a wave and stay inside the zone's rep range.
- `estimateMinutes` prices a ladder from `setPlan`, not `sets × reps`.
- `patternSets` and `cnsLoad` are identical to the straight-set version.
- No ladder is ever prescribed while `env.pctCeiling` sits below the band.
- Straight sets are unchanged: every existing assertion still holds.

For the superset (§3.6):

- A pair is always `push-h`/`pull-h` or `push-v`/`pull-v`, never anything else.
- Both members carry the same `group` and the same `groupRounds`, and
  `groupRounds === min(setsA1, setsA2)`.
- `patternSets` and `cnsLoad` are identical to the straight version of the same
  seed, and so are every block's `sets`, `reps` and load.
- A supersetted session is never longer than its straight counterpart.
- `estimateMinutes` prices a pair once, not twice: the round rest is charged
  per round, not per block.
- A1 sits immediately before A2 in the ordered session.
- A swapped member keeps its pattern, so the pair stays antagonist.
- No group survives with only one member.
- Every day type except `hypertrophy` is bit-for-bit unchanged; `hypertrophy`
  is re-swept against the 70 min limit for the reason in §3.6.4.

---

## 6. Open questions

1. **CLOSED during design.** An earlier draft of §3.2 had the app drawing from a
   table of named schemes (3-2-1, 6-4-2, 5-3-1). It does not: the rep count and
   the set count both come from what `prescribe()` already drew, and the wave
   descends from there. A table would have been a second source of doses
   competing with the zones, which is the mistake `spec.md` §4.3's own history
   records twice.
2. **Two waves, or a drawn number?** Two is the practitioner default and is what
   §3.2 specifies. Three waves would need at least six sets to avoid changing
   volume, which only slot A can draw; one wave is not a wave. Recorded so the
   choice is visible, not because it is in doubt.
6. **Should a supersetted session cost more on the CNS account?** The source
   reports significantly higher blood lactate (SMD = 1.52) and higher RPE for
   agonist-antagonist supersets, alongside **similar perceived recovery**.
   `cnsLoad` is deliberately left unchanged: the two findings point opposite
   ways, the app's account is a model of recovery draw rather than of lactate,
   and inventing a superset multiplier would be exactly the unsourced number
   this project keeps refusing to write. Recorded as open rather than settled,
   because "the evidence conflicts" is a reason to wait, not a reason to
   pretend the question was never asked.
7. **The 37% is pooled across superset types.** Agonist-antagonist alone was
   never separately quantified for time saving, and only one such study
   (n = 23) measured chronic adaptation at all. If a larger agonist-antagonist
   trial appears, the thing to re-check is not the time model — that is
   arithmetic — but whether "no cost to adaptation" still holds.
3. **Does a ladder belong on `power`?** `ARCHITECTURES` does not list it there
   and this design does not add it. Power's zone is 0.75–0.85 with 2–5 reps and
   its intent is speed, not grind; a descending-rep wave against a speed intent
   is a claim no source here supports. Left alone deliberately.
