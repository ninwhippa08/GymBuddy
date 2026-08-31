# Per-Set Load Prescription (the warm-up ramp) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A loaded lift stops printing one number for every set and prints a computed warm-up ladder into its working sets.

**Architecture:** `prescribe()` gains `block.setPlan`, an array of `{ kind, reps, pct, displayMultiplier }`. `block.sets` / `block.reps` / `block.displayMultiplier` stay exactly as they are and continue to describe the WORKING sets — so the volume accounting, the neglect model and the CNS account need no change at all. The ladder is computed by `buildRamp()` from the working load and the movement's `technical` rating; no percentage table exists anywhere in the code.

**Tech Stack:** Plain ES modules, no build step, no dependencies. Tests are `node:test` + `node:assert`, run with `node --test tests/*.test.mjs`.

**Spec:** `docs/design-mobility-and-warmup.md` §2.3 (the sources) and §4.3 (the design). Read §4.3 before Task 1 — this plan argues from it and deviates from it in four recorded places.

## Global Constraints

- **No dependencies, no build step, no npm.** Plain ES modules only.
- **Every number lives in `js/rules.js`** and carries a provenance tag: `[verified]`, `[corroborated]`, `[unverified]` or `[measured]`. A constant introduced without one is a defect — plan-01's Task 4 shipped two untagged constants and review caught it.
- **Run the whole suite with the glob:** `node --test tests/*.test.mjs`. `node --test tests/` does NOT work on this machine (MODULE_NOT_FOUND). Naming files individually has gone stale twice.
- **`sw.js` `VERSION` is bumped ONCE, in Task 7.** It is `'v14'` now; the deploy sets `'v15'`. Nothing reaches his phone until that happens.
- **Warm-up sets are not training volume.** They must never reach `patternSets`, `cnsLoad` or `footContacts`.
- **The ramp is generated, never tabulated.** If a literal percentage ladder appears in `js/`, the task is wrong.
- Commits use the GitHub noreply identity already configured; check `git config user.email` before the first commit.

---

## Four decisions this plan makes that the design doc does not

Record these in the design doc's Deviations section during Task 7. Each is a place where following §4.3 literally would produce a defect or leave a gap.

**1. `block.sets` and `block.reps` keep their present meaning: the WORKING sets.**
§4.3 says `prescribe()` "stops returning scalar `sets`/`reps`/`pct`". Taken literally that breaks `finalise` (`patternSets[b.pattern] += b.sets`), `packToBudget` (`target.sets -= 1`), `estimateMinutes`, `volumeLine` and four test files — and it would silently start counting warm-ups as training volume, which §4.3 itself forbids two paragraphs later. Keeping the scalars as the working-set summary and ADDING `setPlan` satisfies every stated requirement and touches far less.

**2. Warm-up `displayMultiplier` is scaled in DISPLAY space, not recomputed from `pct`.**
§4.3 says warm-ups "are bounded automatically and cannot exceed the ceiling. No new clamp is needed and none should be added." That reasoning holds only when `prCoef` is 1.00. `prescribe` clamps TWICE (see the block comment at `js/generator.js:487`), and the second clamp bounds the DISPLAYED multiplier. A snatch pull (`prCoef` 1.15) in ramp week 1 has its working display pinned to the ceiling 0.65 while its own `pct` is 0.65 — a warm-up at `pct` 0.55 would print `0.55 × 1.15 = 0.63`, nearly the working set, and at `pct` 0.60 it would print 0.69, **above** it. A warm-up that prints heavier than the work it warms up for is the worst failure this feature can have. So each step's display is `workingDisplay × (stepPct / workingPct)`, monotonic and bounded by construction. Task 2 sweeps every loadable entry to prove it.

**3. The `0.90` row of §4.3's table is arithmetically inconsistent with §4.3's own formula. The formula wins.**
The doc states the count is `ceil((workingPct - RAMP_START) / MAX_JUMP)`. For 0.90 that is `ceil(0.60 / 0.15)` = **4** steps (0.30, 0.45, 0.60, 0.75) — every jump exactly 0.15, none larger. The table's row says 5 steps at 0.12 spacing. The other four rows match the formula exactly. Implement the formula; fix the table row in Task 7.

**4. Warm-up rest needs a number and §4.3 gives none.**
`TIME.WARMUP_REST_SEC = 60`, tagged `[unverified]`, introduced in Task 4 where the time estimate first needs it. It is deliberately shorter than `DEFAULT_REST_SEC` (120): a warm-up set is not taken near failure. **Flag it to the athlete as unsourced** rather than letting it pass as a measured figure.

---

## File structure

| File | Responsibility after this plan |
|---|---|
| `js/rules.js` | Gains the `RAMP` block (`START`, `MAX_JUMP`, `FLOOR`, `REPS_BY_PCT`, `TECHNICAL_REP_CAP`) and `TIME.WARMUP_REST_SEC`. Still the only place constants live. |
| `js/generator.js` | Gains `buildRamp()` and `repsForStep()`; `prescribe()` attaches `setPlan`; `estimateMinutes()` prices warm-ups; `packToBudget()` keeps `setPlan` in step with `sets`. |
| `js/ui.js` | Gains `warmupLine(block)`; `blockCard` renders it under the load line. |
| `tests/ramp.test.mjs` | New. Tasks 1–4. |
| `tests/session.test.mjs` | Extended in Task 6 (the re-derived sweep). |
| `tests/ui.test.mjs` | Extended in Task 5. |
| `docs/design-mobility-and-warmup.md`, `docs/spec.md`, `sw.js` | Task 7. |

---

### Task 1: `buildRamp` — the ladder itself

**Files:**
- Modify: `js/rules.js` (immediately after `export const PCT_JITTER = 0.025;`, ~line 153)
- Modify: `js/generator.js` (add `buildRamp` and `repsForStep` directly above `prescribe`, ~line 413)
- Test: `tests/ramp.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `RAMP: { START: 0.30, MAX_JUMP: 0.15, FLOOR: 0.50, REPS_BY_PCT: ReadonlyArray<[number, number]>, TECHNICAL_REP_CAP: 3 }` from `js/rules.js`. `buildRamp(workingPct: number, exercise: {technical?: number}) -> Array<{kind: 'warmup', reps: number, pct: number}>` from `js/generator.js`. Steps carry NO `displayMultiplier` yet — Task 2 adds it, because only `prescribe` knows the working display.

- [ ] **Step 1: Write the failing test**

Create `tests/ramp.test.mjs`:

```js
// The warm-up ladder. design-mobility-and-warmup.md §4.3.
//
// Computed, never tabulated: the step COUNT falls out of the gap between the
// ramp's start and the working load, so a heavier working set gets more steps
// without anything special-casing it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRamp } from '../js/generator.js';
import { RAMP } from '../js/rules.js';

const pcts = ramp => ramp.map(s => Math.round(s.pct * 100) / 100);
const plain = { technical: 1 };

test('a working load under the floor gets no ramp at all', () => {
  // "Light work gets nothing, which is what the sources say and what a rest
  // day should feel like." §4.3
  assert.deepEqual(buildRamp(0.49, plain), []);
  assert.deepEqual(buildRamp(0.30, plain), []);
});

test('the step count falls out of the gap, so heavier means longer', () => {
  assert.equal(buildRamp(0.55, plain).length, 2);
  assert.equal(buildRamp(0.65, plain).length, 3);
  assert.equal(buildRamp(0.80, plain).length, 4);
  // ceil(0.60 / 0.15) = 4. §4.3's table says 5 for this row and is wrong --
  // see decision 3 in plan-05. Every jump here is exactly 0.15, none larger.
  assert.equal(buildRamp(0.90, plain).length, 4);
});

test('the ladder starts at RAMP.START and never reaches the working load', () => {
  const ramp = buildRamp(0.80, plain);
  assert.equal(ramp[0].pct, RAMP.START);
  assert.ok(ramp[ramp.length - 1].pct < 0.80);
});

test('no jump between steps, or into the work, exceeds MAX_JUMP', () => {
  // The one invariant that makes this a ramp rather than a list of numbers.
  for (const working of [0.52, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const stops = [...buildRamp(working, plain).map(s => s.pct), working];
    for (let i = 1; i < stops.length; i++) {
      const jump = stops[i] - stops[i - 1];
      assert.ok(jump <= RAMP.MAX_JUMP + 1e-9,
        `working ${working}: jump of ${jump.toFixed(3)} from ${stops[i - 1]}`);
    }
  }
});

test('the 0.80 ladder is the worked example from §2.3', () => {
  assert.deepEqual(pcts(buildRamp(0.80, plain)), [0.3, 0.43, 0.55, 0.68]);
});

test('reps fall as the step gets heavier', () => {
  const ramp = buildRamp(0.90, plain);
  const reps = ramp.map(s => s.reps);
  for (let i = 1; i < reps.length; i++) {
    assert.ok(reps[i] <= reps[i - 1], `reps went up: ${JSON.stringify(reps)}`);
  }
  assert.equal(ramp[0].reps, 8, 'a 0.30 step is eight reps');
});

test('an Olympic lift gets an extra technique set and never eights', () => {
  // "repetition at light load, never eight reps of a snatch" §4.3
  const oly = buildRamp(0.80, { technical: 3 });
  const bar = buildRamp(0.80, { technical: 1 });
  assert.equal(oly.length, bar.length + 1);
  assert.equal(oly[0].pct, RAMP.START);
  assert.equal(oly[1].pct, RAMP.START, 'the extra set is a second one at the start');
  for (const s of oly) {
    assert.ok(s.reps <= RAMP.TECHNICAL_REP_CAP, `${s.reps} reps of a technical lift`);
  }
});

test('a missing technical rating is treated as the plain progression', () => {
  assert.deepEqual(buildRamp(0.80, {}), buildRamp(0.80, { technical: 1 }));
});

test('every step is marked as a warm-up', () => {
  for (const s of buildRamp(0.85, plain)) assert.equal(s.kind, 'warmup');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ramp.test.mjs`
Expected: the file fails to load — `SyntaxError: The requested module '../js/rules.js' does not provide an export named 'RAMP'`. That is a link error, not a test failure; Step 3 turns it into real assertions.

- [ ] **Step 3: Add the constants**

In `js/rules.js`, immediately after `export const PCT_JITTER = 0.025;`:

```js
// The warm-up ramp. design-mobility-and-warmup.md §4.3.
//
// A ladder is COMPUTED from these, never tabulated: the step count is
// ceil((workingPct - START) / MAX_JUMP), so a heavier working set gets more
// steps because the gap to bridge is longer, and nothing special-cases it.
export const RAMP = Object.freeze({
  // Where every ladder starts, as a fraction of the movement's own max -- the
  // empty bar, for most lifters. [corroborated] design §2.3.
  START: 0.30,
  // No step, and no jump into the working set, may exceed this.
  // [corroborated] from the worked ladders in design §2.3.
  MAX_JUMP: 0.15,
  // Below this working load there is no ramp at all -- there is nothing to
  // bridge. [corroborated] design §2.3: "the lighter the weight, the less
  // warming up you'll need".
  FLOOR: 0.50,
  // Reps for a step, by that step's own load. Descending; first match wins.
  // [corroborated] from the 75% and 90% thresholds in design §2.3.
  REPS_BY_PCT: Object.freeze([
    Object.freeze([0.90, 1]),
    Object.freeze([0.75, 2]),
    Object.freeze([0.60, 3]),
    Object.freeze([0.45, 5]),
    Object.freeze([0.00, 8])
  ]),
  // An Olympic derivative warms up with light repetition, not with eights.
  // [corroborated] design §2.3.
  TECHNICAL_REP_CAP: 3
});
```

- [ ] **Step 4: Implement `buildRamp`**

Add `RAMP` to the existing `import { ... } from './rules.js';` block at the top of `js/generator.js` (it currently ends `ALL_TIERS, NON_NEGOTIABLE_EQUIPMENT, EQUIPMENT_IMPLIES`). Then, directly above `export function prescribe`:

```js
// Reps for one warm-up step, from that step's own load. design §4.3.
function repsForStep(pct) {
  for (const [floor, reps] of RAMP.REPS_BY_PCT) if (pct >= floor) return reps;
  return RAMP.REPS_BY_PCT[RAMP.REPS_BY_PCT.length - 1][1];
}

// The ladder into a working set. Steps only -- no displayMultiplier, because
// only prescribe() knows what the working set actually prints, and every step
// is scaled against that. plan-05 decision 2.
//
// `workingPct` is a fraction of THIS movement's own max, already clamped by
// env.pctCeiling, so the ladder inherits the return ramp for free.
export function buildRamp(workingPct, exercise = {}) {
  if (workingPct < RAMP.FLOOR) return [];
  const gap = workingPct - RAMP.START;
  if (gap <= 0) return [];

  const count = Math.ceil(gap / RAMP.MAX_JUMP);
  const spacing = gap / count;
  const technical = exercise.technical || 1;
  const cap = technical === 3 ? RAMP.TECHNICAL_REP_CAP : Infinity;

  const steps = [];
  for (let i = 0; i < count; i++) {
    const pct = RAMP.START + spacing * i;
    steps.push({ kind: 'warmup', reps: Math.min(repsForStep(pct), cap), pct });
  }

  // An extra set AT the start, not an extra rung -- adding to `count` would
  // respace the whole ladder. Technical work wants more repetition at light
  // load, not a different shape. design §4.3.
  if (technical === 3) {
    steps.unshift({
      kind: 'warmup',
      reps: Math.min(repsForStep(RAMP.START), cap),
      pct: RAMP.START
    });
  }
  return steps;
}
```

- [ ] **Step 5: Run the file, then the whole suite**

Run: `node --test tests/ramp.test.mjs` → all pass.
Run: `node --test tests/*.test.mjs` → still all pass; nothing else reads `buildRamp` yet.

- [ ] **Step 6: Mutation-verify the two invariants that matter**

These tests are worthless if they cannot fail. Break each, confirm RED, restore.

1. Change `Math.ceil` to `Math.floor` → "no jump between steps, or into the work, exceeds MAX_JUMP" must fail.
2. Delete the `technical === 3` `unshift` block → "an Olympic lift gets an extra technique set" must fail.

Restore both, then re-run `node --test tests/*.test.mjs`.

- [ ] **Step 7: Commit**

```bash
git add js/rules.js js/generator.js tests/ramp.test.mjs
git commit -m "Compute the warm-up ladder from the gap to the working load"
```

---

### Task 2: `prescribe` attaches the set plan

**Files:**
- Modify: `js/generator.js` (`prescribe`, the `mode === 'load'` branch, ~lines 472–512)
- Test: `tests/ramp.test.mjs` (extend)

**Interfaces:**
- Consumes: `buildRamp(workingPct, exercise)` from Task 1.
- Produces: `block.setPlan: Array<{kind: 'warmup'|'work', reps: number, pct: number, displayMultiplier: number}>` on loadable `mode: 'load'` blocks whose working load clears `RAMP.FLOOR`; absent otherwise. `block.sets`, `block.reps`, `block.pct` and `block.displayMultiplier` are UNCHANGED and still describe the working sets.

- [ ] **Step 1: Write the failing test**

Append to `tests/ramp.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { prescribe, generate } from '../js/generator.js';
import { ZONES } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const LOADABLE = LIB.filter(e => e.loadable);
const SLOT = { slot: 'A', role: 'main', mode: 'load', zone: 'maxStrength',
               sets: [3, 3], reps: [5, 5], restSec: [180, 180] };
const ENV = { pctCeiling: 1, volumeMultiplier: 1 };
const rng = () => 0.5;

test('a heavy loaded lift arrives with a plan, not one number', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  assert.ok(Array.isArray(block.setPlan), 'no setPlan on a heavy squat');
  assert.ok(block.setPlan.some(s => s.kind === 'warmup'));
  assert.equal(block.setPlan.filter(s => s.kind === 'work').length, block.sets);
});

test('the work entries restate the working set exactly', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  for (const s of block.setPlan.filter(s => s.kind === 'work')) {
    assert.equal(s.reps, block.reps);
    assert.equal(s.displayMultiplier, block.displayMultiplier);
  }
});

test('a movement with no reference max gets no plan', () => {
  // mode drops to 'reps' -- there is no percentage to ramp toward.
  const bodyweight = LIB.find(e => !e.loadable);
  const block = prescribe(SLOT, bodyweight, ENV, rng, {});
  assert.equal(block.mode, 'reps');
  assert.equal(block.setPlan, undefined);
});

test('a light working load gets no plan', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, { pctCeiling: 0.45, volumeMultiplier: 1 }, rng, {});
  assert.equal(block.setPlan, undefined,
    'a working load under the floor has nothing to ramp into');
});

test('NO WARM-UP EVER PRINTS ABOVE ITS WORKING SET', () => {
  // plan-05 decision 2, and the worst failure this feature could have. prCoef
  // above 1.00 plus the ramp ceiling is where a naive pct * prCoef breaks: the
  // working display is clamped and an unclamped warm-up sails straight over it.
  for (const ex of LOADABLE) {
    for (const zone of Object.keys(ZONES)) {
      for (const ceiling of [0.65, 0.75, 0.85, 1]) {
        const block = prescribe({ ...SLOT, zone }, ex,
          { pctCeiling: ceiling, volumeMultiplier: 1 }, rng, {});
        if (!block.setPlan) continue;
        for (const s of block.setPlan) {
          assert.ok(s.displayMultiplier <= block.displayMultiplier + 1e-9,
            `${ex.id} ${zone} ceiling ${ceiling}: warm-up ${s.displayMultiplier} > work ${block.displayMultiplier}`);
          assert.ok(s.displayMultiplier <= ceiling + 1e-9,
            `${ex.id} ${zone} ceiling ${ceiling}: warm-up ${s.displayMultiplier} over the ceiling`);
        }
      }
    }
  }
});

test('the ladder climbs -- every step is heavier than the one before', () => {
  for (const ex of LOADABLE) {
    const block = prescribe(SLOT, ex, ENV, rng, {});
    if (!block.setPlan) continue;
    const d = block.setPlan.map(s => s.displayMultiplier);
    for (let i = 1; i < d.length; i++) {
      assert.ok(d[i] >= d[i - 1] - 1e-9, `${ex.id}: ${JSON.stringify(d)} dips`);
    }
  }
});

test('tier is not consulted -- the load decides, not how central the lift is', () => {
  // §4.3: "an accessory prescribed heavy gets a ramp, and a primary lift
  // prescribed light does not."
  const heavyAccessory = LOADABLE.find(e => e.tier === 'accessory');
  const lightPrimary = LOADABLE.find(e => e.tier === 'primary');
  assert.ok(heavyAccessory && lightPrimary, 'this test needs one of each tier');

  const heavy = prescribe({ ...SLOT, zone: 'maxStrength' }, heavyAccessory, ENV, rng, {});
  assert.ok(heavy.setPlan, 'a heavy accessory was denied a ramp on tier alone');

  const light = prescribe(SLOT, lightPrimary,
    { pctCeiling: 0.45, volumeMultiplier: 1 }, rng, {});
  assert.equal(light.setPlan, undefined, 'a light primary was given a ramp on tier alone');
});

test('only loaded work gets a ramp -- never a drill, hold, interval or contact', () => {
  // §4.3: "mode: 'reps', 'contacts' and 'time' never receive one."
  const modes = [
    { mode: 'time', durationMin: [10, 20] },
    { mode: 'drill', sets: [1, 1], reps: [10, 10] },
    { mode: 'contacts', sets: [3, 3], reps: [5, 5], restSec: [90, 90] },
    { mode: 'interval', sets: [6, 6], workSec: [60, 60], restRatio: [1, 1] }
  ];
  const anyEx = LOADABLE[0];
  for (const m of modes) {
    const block = prescribe({ ...SLOT, ...m }, anyEx, ENV, rng, {});
    assert.equal(block.setPlan, undefined, `${m.mode} was given a set plan`);
  }
});

test('the return ramp shortens the ladder on its own', () => {
  // §4.3's emergent property: during the return ramp env.pctCeiling is 0.65,
  // so no working load can exceed it and no ladder can be long. Nothing
  // special-cases the ramp weeks -- if this ever needs a special case, the
  // clamp has stopped doing its job.
  for (const ex of LOADABLE) {
    for (const zone of Object.keys(ZONES)) {
      const block = prescribe({ ...SLOT, zone }, ex,
        { pctCeiling: 0.65, volumeMultiplier: 1 }, rng, {});
      if (!block.setPlan) continue;
      const warmups = block.setPlan.filter(s => s.kind === 'warmup').length;
      // ceil((0.65 - 0.30) / 0.15) = 3 rungs, PLUS the extra technique set an
      // Olympic derivative gets. §4.3 says "no ramp exceeds three steps" and
      // overlooked its own technical rule; four is correct for those lifts.
      const cap = ex.technical === 3 ? 4 : 3;
      assert.ok(warmups <= cap,
        `${ex.id} (technical ${ex.technical}) ${zone}: ${warmups} warm-up sets under a 0.65 ceiling`);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ramp.test.mjs`
Expected: FAIL — "no setPlan on a heavy squat".

- [ ] **Step 3: Implement**

In `js/generator.js`, in the `mode === 'load'` branch, replace the final two lines (`block.displayMultiplier = ...` and `return block;`) with:

```js
  // What the user actually reads: one multiplication against a PR he knows.
  // Folding prCoef in here is the whole point -- he should never do two.
  block.displayMultiplier = Math.round(display * 100) / 100;

  // The ladder into the work. Steps are scaled in DISPLAY space rather than
  // recomputed as stepPct * prCoef: the working display has already been
  // clamped twice, and a warm-up recomputed from its own pct can sail straight
  // over a clamped working set. For prCoef 1.15 in ramp week 1 that is not
  // hypothetical -- it prints a warm-up heavier than the work. plan-05
  // decision 2; design §4.3 assumed prCoef 1.00 and says no clamp is needed.
  const ramp = buildRamp(pct, exercise);
  if (ramp.length) {
    block.setPlan = [
      ...ramp.map(s => ({
        kind: s.kind,
        reps: s.reps,
        pct: Math.round(s.pct * 100) / 100,
        displayMultiplier:
          Math.round(block.displayMultiplier * (s.pct / pct) * 100) / 100
      })),
      ...Array.from({ length: sets }, () => ({
        kind: 'work',
        reps,
        pct: block.pct,
        displayMultiplier: block.displayMultiplier
      }))
    ];
  }
  return block;
}
```

- [ ] **Step 4: Run the file, then the whole suite**

Run: `node --test tests/ramp.test.mjs` → all pass.
Run: `node --test tests/*.test.mjs` → all pass. `tests/coefficients.test.mjs` asserts on `displayMultiplier`, which is untouched by design; if it fails, decision 1 has been violated somewhere.

- [ ] **Step 5: Mutation-verify the clamp**

Replace the display scaling with the naive `s.pct * exercise.prCoef` and confirm "NO WARM-UP EVER PRINTS ABOVE ITS WORKING SET" goes RED. Restore.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js tests/ramp.test.mjs
git commit -m "Give a loaded lift a per-set plan instead of one number"
```

---

### Task 3: Warm-ups are not training volume

**Files:**
- Test: `tests/ramp.test.mjs` (extend)
- Modify: `js/generator.js` only if the test fails

**Interfaces:**
- Consumes: `generate(opts)` and `block.setPlan` from Task 2.
- Produces: nothing new. This task is a guard: it proves decision 1 actually holds end to end.

- [ ] **Step 1: Write the test**

Append to `tests/ramp.test.mjs`:

```js
test('the work entries and block.sets never disagree', () => {
  // §4.3: "Warm-up sets are not training volume. They must be excluded from
  // patternSets, cnsLoad and footContacts." Keeping block.sets as the WORKING
  // count is what buys that for free (plan-05 decision 1); this test is what
  // stops a later edit from summing setPlan into the volume instead.
  const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 60; seed++) {
      const s = generate({ library: LIB, profile, history: [], soreness: {}, dayType, seed });
      for (const b of s.blocks) {
        if (!b.setPlan) continue;
        assert.equal(b.setPlan.filter(x => x.kind === 'work').length, b.sets,
          `${dayType} seed ${seed} ${b.exerciseId}: work sets and b.sets disagree`);
      }
    }
  }
});

test('a ramp does not inflate patternSets', () => {
  // The same session, generated twice, differing only in whether the ramp is
  // attached. The pattern counts must be identical.
  const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({ library: LIB, profile, history: [], soreness: {},
                         dayType: 'max-strength', seed });
    const fromBlocks = s.blocks
      .filter(b => b.mode === 'load' || b.mode === 'reps' || b.mode === 'contacts')
      .filter(b => b.role !== 'core' && b.role !== 'prep')
      .reduce((n, b) => n + b.sets, 0);
    const counted = Object.values(s.patternSets).reduce((a, b) => a + b, 0);
    assert.equal(counted, fromBlocks,
      `seed ${seed}: patternSets ${counted} does not match working sets ${fromBlocks}`);
  }
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/ramp.test.mjs`
Expected: **PASS on the first run.** This is the one place in the plan where that is correct — these tests characterise a property decision 1 was chosen to preserve. If either FAILS, `prescribe` or `finalise` has started counting warm-ups, and that is the bug to fix before going further.

- [ ] **Step 3: Mutation-verify they can fail**

In `finalise`, temporarily change `patternSets[b.pattern] = (patternSets[b.pattern] || 0) + b.sets;` to use `(b.setPlan ? b.setPlan.length : b.sets)` and confirm "a ramp does not inflate patternSets" goes RED. Restore, re-run the whole suite.

- [ ] **Step 4: Commit**

```bash
git add tests/ramp.test.mjs
git commit -m "Lock warm-up sets out of the volume accounting"
```

---

### Task 4: Time — the ramp costs minutes, and trimming must keep up

**Files:**
- Modify: `js/rules.js` (`TIME` block, ~line 383)
- Modify: `js/generator.js` (`estimateMinutes` ~line 529, `packToBudget` ~line 707)
- Test: `tests/ramp.test.mjs` (extend)

**Interfaces:**
- Consumes: `block.setPlan` from Task 2.
- Produces: `TIME.WARMUP_REST_SEC: number`. `estimateMinutes` counts warm-up work and rest. `packToBudget` keeps `setPlan`'s work entries equal to `block.sets` after shaving.

- [ ] **Step 1: Write the failing test**

Append to `tests/ramp.test.mjs`:

```js
import { estimateMinutes, packToBudget } from '../js/generator.js';

test('a ramped lift is priced above the same lift without one', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const withRamp = prescribe(SLOT, squat, ENV, rng, {});
  assert.ok(withRamp.setPlan, 'this test needs a ramped block');
  const without = { ...withRamp };
  delete without.setPlan;
  assert.ok(estimateMinutes([withRamp]) > estimateMinutes([without]),
    'the warm-up sets cost nothing in the time estimate');
});

test('shaving a set shaves the plan with it', () => {
  // packToBudget drops sets to fit the budget. A setPlan left at its old
  // length would print more working sets than the block claims to have.
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  const { blocks } = packToBudget([block], 1);   // an impossible budget forces shaving
  const out = blocks[0];
  assert.equal(out.setPlan.filter(s => s.kind === 'work').length, out.sets);
});

test('trimming never removes a warm-up', () => {
  // The ramp is the safety feature. Cutting IT to save a minute is the wrong
  // end of the session to cut. basis §3.
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  const before = block.setPlan.filter(s => s.kind === 'warmup').length;
  const { blocks } = packToBudget([block], 1);
  assert.equal(blocks[0].setPlan.filter(s => s.kind === 'warmup').length, before);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ramp.test.mjs`
Expected: FAIL — "the warm-up sets cost nothing in the time estimate".

- [ ] **Step 3: Add the constant**

In `js/rules.js`, inside the `TIME` block immediately after `DEFAULT_REST_SEC: 120,`:

```js
  // Rest between warm-up sets. Deliberately shorter than DEFAULT_REST_SEC: a
  // warm-up set is not taken near failure and does not need a working rest.
  // [unverified] -- design §4.3 specifies the ladder but no rest for it, and
  // no source was found. plan-05 decision 4. Tell the athlete it is a guess.
  WARMUP_REST_SEC: 60,
```

- [ ] **Step 4: Price the warm-ups**

In `estimateMinutes`, in the final generic branch, insert the warm-up loop between the working-set lines and `transitionSec`:

```js
    sec += b.sets * b.reps * TIME.SECONDS_PER_REP * sides;
    sec += b.sets * (b.restSec || TIME.DEFAULT_REST_SEC);
    // The ramp is real time on the clock. Its sets are short and its rests
    // shorter, but four warm-up sets before a heavy squat is minutes, and the
    // budget has to see them or packToBudget trims the wrong thing.
    for (const s of (b.setPlan || [])) {
      if (s.kind !== 'warmup') continue;
      sec += s.reps * TIME.SECONDS_PER_REP * sides;
      sec += TIME.WARMUP_REST_SEC;
    }
    sec += transitionSec(b);
```

- [ ] **Step 5: Keep the plan in step when trimming**

In `packToBudget`, replace `target.sets -= 1;` with:

```js
    target.sets -= 1;
    // The plan is part of the block, so shaving a set has to shave it too --
    // and only ever a WORKING set. The ramp is the safety feature; trimming it
    // to save a minute cuts the wrong end of the session.
    if (target.setPlan) {
      const i = target.setPlan.map(s => s.kind).lastIndexOf('work');
      if (i >= 0) target.setPlan.splice(i, 1);
    }
```

- [ ] **Step 6: Run the file, then the whole suite**

Run: `node --test tests/ramp.test.mjs` → all pass.
Run: `node --test tests/*.test.mjs` → **expect the session-length sweep in `tests/session.test.mjs` to FAIL here.** That is correct: the ramp genuinely lengthens sessions and Task 6 exists to re-measure the ceiling. **Do not touch the allowance in this task**, and do not skip ahead to make the suite green.

- [ ] **Step 7: Commit**

```bash
git add js/rules.js js/generator.js tests/ramp.test.mjs
git commit -m "Price the ramp into the session budget"
```

---

### Task 5: The card shows the ladder

**Files:**
- Modify: `js/ui.js` (add `warmupLine` directly after `loadLine`, ~line 115; render it in `blockCard`)
- Modify: `style.css`
- Test: `tests/ui.test.mjs` (extend)

**Interfaces:**
- Consumes: `block.setPlan` from Task 2.
- Produces: `warmupLine(block: object) -> string` from `js/ui.js`. Returns `''` when there is no plan.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui.test.mjs`. Add `warmupLine` to the destructured `await import('../js/ui.js')` list at the top of the file rather than importing twice:

```js
const RAMPED = {
  mode: 'load', sets: 3, reps: 5, displayMultiplier: 0.8, prRef: 'back-squat',
  setPlan: [
    { kind: 'warmup', reps: 8, pct: 0.3,  displayMultiplier: 0.3 },
    { kind: 'warmup', reps: 5, pct: 0.55, displayMultiplier: 0.55 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 }
  ]
};

test('the warm-up line lists every step as reps by multiplier', () => {
  const line = warmupLine(RAMPED);
  assert.match(line, /8 × 0\.30/);
  assert.match(line, /5 × 0\.55/);
});

test('the warm-up line names itself, so its numbers are not read as work', () => {
  assert.match(warmupLine(RAMPED), /warm-up/i);
});

test('the warm-up line never lists a working set', () => {
  // The hero line already carries the working load. Repeating it here would
  // read as a fourth warm-up.
  assert.equal((warmupLine(RAMPED).match(/0\.80/g) || []).length, 0);
});

test('a block with no plan has no warm-up line', () => {
  assert.equal(warmupLine({ mode: 'load', displayMultiplier: 0.4 }), '');
  assert.equal(warmupLine({ mode: 'reps' }), '');
});

test('the hero line still prints the WORKING load, unchanged', () => {
  // Regression: the number read mid-set must not become the first warm-up.
  assert.equal(loadLine(RAMPED), '0.80 × Back Squat PR');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.test.mjs`
Expected: fails to load — no export named `warmupLine`.

- [ ] **Step 3: Implement**

In `js/ui.js`, directly after `loadLine`:

```js
// The ladder, under the hero line. The hero keeps the WORKING load -- that is
// the number read mid-set and it must not move -- so this line carries only
// the steps up to it. design-mobility-and-warmup.md §4.3.
export function warmupLine(block) {
  const steps = (block.setPlan || []).filter(s => s.kind === 'warmup');
  if (!steps.length) return '';
  return 'warm-up  ' +
    steps.map(s => `${s.reps} × ${s.displayMultiplier.toFixed(2)}`).join('  ·  ');
}
```

In `blockCard`, on the FRONT face, add the line immediately after the existing load line and before the meta/rest line, in the same style as the other `.block-meta` paragraphs:

```js
    warmupLine(block)
      ? el('p', { class: 'block-meta block-warmup', text: warmupLine(block) })
      : null,
```

- [ ] **Step 4: Style it**

In `style.css`, after the `.block-note` rule:

```css
/* The ladder. Dimmer than the working load on purpose -- it is the way in,
   not the number being read between sets. Tabular figures so the steps line
   up under each other. */
.block-warmup {
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}
```

- [ ] **Step 5: Run the file, then the whole suite**

Run: `node --test tests/ui.test.mjs` → all pass.
Run: `node --test tests/*.test.mjs` → all pass except the session-length sweep from Task 4, still awaiting Task 6.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js style.css tests/ui.test.mjs
git commit -m "Print the ladder under the working load"
```

---

### Task 6: Re-derive the session ceiling by sweep

**Files:**
- Modify: `js/rules.js` (`TIME.FLOOR_OVERRUN_ALLOWANCE_MIN`)
- Modify: `tests/session.test.mjs` (the committed sweep)

**Interfaces:**
- Consumes: everything above.
- Produces: a re-measured `FLOOR_OVERRUN_ALLOWANCE_MIN`, still tagged `[measured]`.

**Why this is its own task:** the project's standing rule is that this number is measured, never padded in advance, and that the committed sweep's seed count must stay at or above the count the allowance was derived from. A previous sweep sat green against a stale allowance for exactly this reason — at 1,000 seeds per day type it never reached the seed that broke it.

- [ ] **Step 1: Measure, do not guess**

Write a throwaway sweep — in the scratchpad, NOT committed — running 10,000 seeds per gym day type:

```js
import { readFileSync } from 'node:fs';
import { generate, estimateMinutes } from '../js/generator.js';
const LIB = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')).exercises;
const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
const tail = {};
let worst = 0, worstAt = null;
for (const dayType of ['max-strength', 'power', 'hypertrophy', 'isolation']) {
  for (let seed = 1; seed <= 10000; seed++) {
    const s = generate({ library: LIB, profile, history: [], soreness: {}, dayType, seed });
    const total = estimateMinutes(s.blocks);
    tail[total] = (tail[total] || 0) + 1;
    if (total > worst) { worst = total; worstAt = `${dayType} seed ${seed}`; }
  }
}
console.log('worst', worst, worstAt);
console.log(Object.entries(tail).sort((a, b) => a[0] - b[0]).slice(-6));
```

Record the worst total, the day type and seed that produced it, and the tail counts. They go in the commit message.

- [ ] **Step 2: Set the allowance to exactly what was measured**

In `js/rules.js`, set `FLOOR_OVERRUN_ALLOWANCE_MIN` to `worst - TIME.GYM_SESSION_TOTAL_MIN`, **with no rounding up**. Rewrite its comment to state the new figure, the day type and seed that produced it, and that the ramp is now included. Keep the `[measured]` tag.

- [ ] **Step 3: Make sure the committed sweep can reach the worst case**

In `tests/session.test.mjs`, confirm the committed sweep runs at least 10,000 seeds per day type — the same count the allowance was derived from. Raise it if it is lower. The suite currently takes ~9 s, most of it this sweep; a longer run is acceptable, a stale allowance is not.

- [ ] **Step 4: Run the whole suite**

Run: `node --test tests/*.test.mjs` → all pass, including the sweep that failed at the end of Task 4.

- [ ] **Step 5: Mutation-verify the sweep still bites**

Lower `FLOOR_OVERRUN_ALLOWANCE_MIN` by 1 and confirm the sweep goes RED. Restore.

- [ ] **Step 6: Commit**

```bash
git add js/rules.js tests/session.test.mjs
git commit -m "Re-derive the session ceiling with the ramp in it"
```

---

### Task 7: Docs, deploy, and the athlete's check

**Files:**
- Modify: `sw.js` (`VERSION`)
- Modify: `docs/design-mobility-and-warmup.md` (§4.3 status, the 0.90 table row, a Deviations section)
- Modify: `docs/spec.md` (§4 — a loaded lift no longer prescribes one number)

- [ ] **Step 1: Bump the worker** — `sw.js`: `const VERSION = 'v15';`

- [ ] **Step 2: Correct §4.3's table row.** The `0.90` row reads `5 | 0.30, 0.42, 0.54, 0.66, 0.78`. Change it to `4 | 0.30, 0.45, 0.60, 0.75` and add a line recording that the row disagreed with the section's own formula and that the formula won.

- [ ] **Step 3: Mark §4.3 built** and record all four deviations from the head of this plan, each with its reason.

- [ ] **Step 4: Update `docs/spec.md` §4** to say a loaded lift prescribes a per-set plan, that warm-ups are excluded from the volume accounting, and that `TIME.WARMUP_REST_SEC` is `[unverified]`.

- [ ] **Step 5: Full suite green**, then commit and push to `main`.

- [ ] **Step 6: Verify live** — `curl` the deployed `sw.js` for `v15` and `js/generator.js` for `buildRamp`. Pages takes about a minute.

- [ ] **Step 7: The athlete's check.** Open the app, swipe fully out of the app switcher, reopen so v15 activates on the second launch. On a max-strength or power day confirm: the heavy lift shows a warm-up line under its working load; the warm-up numbers climb and never reach or exceed the working number; a dumbbell or machine movement shows no warm-up line at all; and the session still fits the time it claims.

- [ ] **Step 8: Tell him `WARMUP_REST_SEC` is a guess.** It is the only unsourced number this plan introduces, and he has consistently wanted to know which figures are invented.
