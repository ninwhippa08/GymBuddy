# Design — session architectures

`spec.md` §4.3 calls architecture "the variety engine" and "the dial that does
the most work". It is also the only dial in that table that has never moved.
`chooseArchitecture` reads:

```js
return phase1 ? PHASE_1_ARCHITECTURE : pick(rng, allowed);
```

`phase1` defaults to `true`. Every session the app has ever generated has been
straight sets, and the `architecture` field on every stored record has said so.
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

**Loads step down from the working load `prescribe()` already computed.** That
load is zone-drawn, jittered and `env.pctCeiling`-clamped, so anchoring the
ladder's **top** rung to it inherits every existing clamp and adds none. The
step comes from the zone's own band rather than a number invented here:

```
step = (zone.pct[1] - zone.pct[0]) / (rungs1 * 2 - 1)
```

For `maxStrength` (0.85–0.95, band 0.10) with 3 rungs, `step` is **0.04** — 4%
per rung, inside the 2.5–5% practitioner range `[corroborated]` and derived from
the app's own zone rather than asserted. Wave 2 is offset half a step above wave
1, which is what makes it a wave rather than two identical runs:

| | reps | load | worked, top = 0.95 |
|---|---|---|---|
| wave 1 | 3 | top − 2 steps | 0.87 |
| | 2 | top − 1 step | 0.91 |
| | 1 | top − ½ step… | 0.93 |
| wave 2 | 3 | top − 1½ steps | 0.89 |
| | 2 | top − ½ step | 0.93 |
| | 1 | **top** | 0.95 |

Every rung lands inside the zone, the heaviest single set equals what the
straight session would have prescribed for every set, and the mean load is
**lower** — which is Wood et al.'s finding applied rather than quoted.

- **The top is `env.pctCeiling`-clamped** because `prescribe()` clamped it
  before the ladder saw it. During the return ramp the ceiling is 0.65, below
  the `maxStrength` band entirely, so no ladder is prescribed in the early
  return weeks — by the same clamp that already shortens the warm-up ramp, with
  nothing special-casing it.
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
  wave 1's first rung. They stop being true of every working set, and that is a
  real change: `tests/ramp.test.mjs`'s "the work entries restate the working set
  exactly" asserts the old invariant and must become architecture-aware rather
  than be deleted. It still holds for straight sets, which is every session
  today.
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

---

## 4. Build order

Each step leaves a working app and gets its own version bump.

1. **`ladder` on `max-strength`.** No block relationships; `setPlan` only. It
   proves the whole path — `chooseArchitecture` actually choosing, the record
   carrying the choice, `estimateMinutes` pricing it, the card rendering it.
2. **`antagonist-superset` on `hypertrophy`.** Introduces `group`. This is where
   `ui.blockGroup` and `estimateMinutes` change again.
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
3. **Does a ladder belong on `power`?** `ARCHITECTURES` does not list it there
   and this design does not add it. Power's zone is 0.75–0.85 with 2–5 reps and
   its intent is speed, not grind; a descending-rep wave against a speed intent
   is a claim no source here supports. Left alone deliberately.
