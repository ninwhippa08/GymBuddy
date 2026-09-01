# The Exercise Count Becomes a Residual (design §4.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The number of exercises in a session stops being a hardcoded 4 or 5 and becomes what coverage debt asks for, bounded by the time budget.

**Architecture:** `TEMPLATES` gain candidate slots beyond what will fit, ordered by priority. Each day type declares the movement patterns it targets. The FILL loop walks the template while any targeted pattern still carries weekly volume debt — debt measured against the per-goal targets sourced on 2026-09-01 (`VOLUME.SETS_PER_PATTERN_PER_WEEK`) — and stops when the time budget would break. `packToBudget` then drops by *least outstanding debt* rather than by position, so the work that survives a trim is the work most overdue.

**Tech Stack:** Plain ES modules, no build step, no dependencies. Tests are `node:test` + `node:assert`, run with `node --test "tests/*.test.mjs"`.

**Spec:** `docs/design-mobility-and-warmup.md` §4.4 is the design. Read it before Task 1 — this plan implements it and deviates from it in two recorded places (see "Two decisions this plan makes"). The volume numbers it reads come from `docs/programming-basis.md` §2, "The dose-response differs by goal".

## Global Constraints

- **No dependencies, no build step, no npm.** Plain ES modules only.
- **Every number lives in `js/rules.js`** with a provenance tag: `[verified]`, `[corroborated]`, `[unverified]` or `[measured]`. A constant introduced without one is a defect.
- **Run the whole suite with the glob:** `node --test "tests/*.test.mjs"`. `node --test tests/` does NOT work on this machine — it runs nothing and reports one failure.
- **THE 70-MINUTE LIMIT IS A HARD GATE AND IT HAS NO MARGIN LEFT.** Measured 2026-09-01: the worst session across 4,000 seeds × 3 lifting day types is **exactly 70 min** (max-strength, seed 3466), and main work already saturates `TIME.MAIN_WORK_MAX_MIN` (50) on all three. `tests/session.test.mjs` asserts the literal 70 from `docs/spec.md:36` — the athlete's own stated requirement, which he has already reversed a decision to protect. **This plan adds slots, so it WILL push on that number.** Task 6 exists to measure it. If it breaches, the count gets capped — never the limit widened.
- **`sw.js` `VERSION` is bumped ONCE, in Task 7.** It is `'v22'` now; this deploy sets `'v23'`. His phone then needs a SECOND launch.
- **Verify a patch landed before believing a measurement.** Sweeps that patch a source file must assert the changed text is on disk and run each variant in a **separate node process** — `generator.js` imports `rules.js` unversioned, so a second in-process sweep silently reuses the first constant. This has produced false "no difference" readings twice.
- **Commits use the GitHub noreply identity;** check `git config user.email` is `99660645+ninwhippa08@users.noreply.github.com` before the first commit.

---

## What is wrong today

`docs/spec.md` §10 item 4 states it plainly: the exercise count was "invented and then cited to §4.3 of this file — this document citing itself." Concretely, from `js/templates.js`:

| day type | slots | required | optional |
|---|---|---|---|
| `max-strength` | 4 (A–D) | A, B, C | D |
| `power` | 4 (A–D) | A, B, C | D |
| `hypertrophy` | 5 (A–E) | A, B, C | D, E |

The count never responds to what has actually been trained. A day covering four movement patterns and a day covering two get the same number of slots, and a pattern already at its weekly volume pulls exactly as hard as one untouched for three weeks.

The debt data to fix this already exists: `buildState` maintains rolling 7-day `patternSets` counts (`js/generator.js:100-108`) for the neglect model. §4.4 reads those same counts for a second purpose.

## Two decisions this plan makes that the design does not

Record both in the design doc during Task 7.

**1. Debt is counted DIRECT-only. Fractional counting is deferred, with a reason.**
The volume research closed on 2026-09-01 (`design-mobility-and-warmup.md` §8 question 6) found that the best-supported way to count sets is **fractional**: a set that trains a muscle indirectly counts 0.5. That matters here because this app counts per movement *pattern* while the literature counts per *muscle group* — a squat set and a lunge set both load the quadriceps. Implementing it properly needs data the library does not have: every entry carries exactly one `pattern` (confirmed across all 236 entries), and there is no map of which patterns an exercise trains *indirectly*. Inventing that map would be exactly the kind of unsourced number this project keeps having to remove. **So debt is direct-only for now, and "fractional coverage needs an indirect-pattern map in `data/exercises.json`" becomes a new open question in §8.** The consequence to state out loud: coverage will slightly *overestimate* debt for patterns that get indirect work, so it errs toward proposing more exercises, which Task 6's time gate then bounds.

**2. Targeted patterns are DECLARED per day type, not computed from the slots.**
§4.4 says "each day type declares the movement patterns it targets" without saying where. Computing the union of a template's slot patterns would make the declaration circular — the coverage rule would only ever ask for patterns the template already offers, so it could never pull in a slot for a pattern that is missing. An explicit `targets` array on `DAY_TYPES` lets coverage be a statement about the *day type* rather than about the current template.

---

## File structure

| File | Responsibility for this change |
|---|---|
| `js/templates.js` | `DAY_TYPES` gain `targets`; the three lifting templates gain priority-ordered candidate slots. |
| `js/rules.js` | Gains `MAX_MAIN_SLOTS`, the hard cap Task 6 sets from measurement. |
| `js/generator.js` | `patternDebt()` (new, exported); the FILL loop becomes coverage-driven; `packToBudget` drops by debt. |
| `tests/coverage-count.test.mjs` | **New.** Debt arithmetic, coverage-driven count, debt-ordered trimming. |
| `tests/session.test.mjs` | Unchanged assertions — it is the 70-minute gate and must keep passing untouched. |
| `docs/design-mobility-and-warmup.md` | §4.4 "as built" note, the two decisions above, the new open question. |
| `sw.js` | `VERSION` `'v22'` → `'v23'`, once, in Task 7. |

---

### Task 1: day types declare the patterns they target

**Files:**
- Modify: `js/templates.js` (the `DAY_TYPES` map)
- Create: `tests/coverage-count.test.mjs`

**Interfaces:**
- Produces: `DAY_TYPES[dayType].targets` — an array of pattern strings, e.g. `['squat', 'hinge', 'push-h', 'push-v', 'pull-h', 'pull-v']`. Every string must be a pattern that exists in `data/exercises.json`.

- [ ] **Step 1: Write the failing test**

Create `tests/coverage-count.test.mjs`:

```javascript
// design §4.4: the exercise count is a residual of coverage debt and time,
// not the hardcoded 4 or 5 that spec.md §10 item 4 calls "this document
// citing itself". plan-07.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_TYPES, PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const LIBRARY_PATTERNS = new Set(LIB.map(e => e.pattern));

test('every lifting day type declares the patterns it targets', () => {
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    const targets = DAY_TYPES[dt].targets;
    assert.ok(Array.isArray(targets) && targets.length > 0,
      `${dt} declares no targets, so coverage has nothing to count against`);
  }
});

test('a declared target is a pattern the library can actually fill', () => {
  // A target naming a pattern with no exercises would be permanent debt: the
  // coverage rule would ask for a slot that can never be satisfied.
  for (const dt of PHASE_1_DAY_TYPES) {
    for (const p of DAY_TYPES[dt].targets || []) {
      assert.ok(LIBRARY_PATTERNS.has(p),
        `${dt} targets "${p}", which no exercise in the library has`);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: the first test FAILS with `max-strength declares no targets`. The second passes vacuously (no targets to check) — that is fine, it becomes meaningful in Step 3.

- [ ] **Step 3: Declare the targets**

In `js/templates.js`, add a `targets` array to each of the three lifting entries in `DAY_TYPES`. Use exactly these, which are the patterns each day's existing slots already reach plus the ones its slots imply:

```javascript
// The movement patterns this day type is FOR. Declared, not computed from the
// template's slots: computing it would make coverage circular, able to ask
// only for patterns the template already offers and never for a missing one.
// design §4.4, plan-07 decision 2.
targets: ['squat', 'hinge', 'push-h', 'push-v', 'pull-h', 'pull-v'],   // max-strength
targets: ['jump', 'throw', 'hinge', 'squat', 'push-h', 'pull-h'],      // power
targets: ['squat', 'hinge', 'push-h', 'push-v', 'pull-h', 'pull-v', 'lunge'], // hypertrophy
```

Leave the four non-lifting day types (`aerobic-steady`, `interval`, `sprint`, `plyometric`) without a `targets` key. Their volume is dosed in minutes, metres and contacts, not in pattern sets, and giving them pattern coverage would be a claim no source supports.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/coverage-count.test.mjs` — expected: 2 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **314 pass, 0 fail** (312 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add js/templates.js tests/coverage-count.test.mjs
git commit -m "Declare the movement patterns each lifting day targets"
```

---

### Task 2: pattern debt, measured against the per-goal target

**Files:**
- Modify: `js/generator.js` (add `patternDebt`, near `weeklySetTarget`)
- Test: `tests/coverage-count.test.mjs`

**Interfaces:**
- Consumes: `weeklySetTarget(dayType)` (already exported), `state.patternSets`.
- Produces: `patternDebt(pattern, dayType, state)` → a number ≥ 0: how many sets of that pattern are still owed this week. Zero once the target is met.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-count.test.mjs`:

```javascript
import { patternDebt, weeklySetTarget } from '../js/generator.js';

const stateWith = patternSets => ({ patternSets, recentExerciseIds: new Set() });

test('an untrained pattern owes the whole weekly target', () => {
  assert.equal(patternDebt('squat', 'max-strength', stateWith({})),
    weeklySetTarget('max-strength'));
});

test('debt falls by the sets already done', () => {
  // max-strength targets 4 sets/week (Pelland et al. 2025 -- strength's
  // efficient band ends at 4, where hypertrophy's runs to 10).
  assert.equal(patternDebt('squat', 'max-strength', stateWith({ squat: 3 })), 1);
});

test('debt never goes negative', () => {
  // Over-trained is not credit toward another pattern.
  assert.equal(patternDebt('squat', 'max-strength', stateWith({ squat: 99 })), 0);
});

test('the same history leaves more debt on a hypertrophy day than a strength day', () => {
  // The whole point of the per-goal split: 4 sets of squatting is a full
  // max-strength week and not even half a hypertrophy one.
  const done = stateWith({ squat: 4 });
  assert.equal(patternDebt('squat', 'max-strength', done), 0);
  assert.ok(patternDebt('squat', 'hypertrophy', done) > 0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: FAILS at import — `does not provide an export named 'patternDebt'`.

- [ ] **Step 3: Implement**

In `js/generator.js`, directly below `weeklySetTarget`:

```javascript
// How many sets of a pattern this week's target still owes. The counts come
// from the same rolling patternSets the neglect model reads -- one tracker,
// two purposes, as design §4.4 requires.
//
// DIRECT counting only. The sourced convention is fractional -- an indirect
// set counts 0.5 -- but the library gives every entry exactly one `pattern`
// and no map of what it trains indirectly, and inventing that map would be
// precisely the unsourced number this project keeps removing. The effect is
// that debt is slightly OVERSTATED for patterns getting indirect work, so
// coverage errs toward proposing more work and the time budget bounds it.
// plan-07 decision 1; §8's new open question.
export function patternDebt(pattern, dayType, state) {
  const done = (state && state.patternSets && state.patternSets[pattern]) || 0;
  return Math.max(0, weeklySetTarget(dayType) - done);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/coverage-count.test.mjs` — expected: 6 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **318 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/coverage-count.test.mjs
git commit -m "Measure pattern debt against the per-goal weekly target"
```

---

### Task 3: templates offer more than will fit

**Files:**
- Modify: `js/templates.js` (`MAX_STRENGTH`, `POWER`, `HYPERTROPHY`)
- Test: `tests/coverage-count.test.mjs`

**Interfaces:**
- Produces: longer templates. Every slot added is `optional: true`, so with coverage switched off the sessions built are exactly today's.

**Ordering rule, from §4.4:** NSCA priority — power/explosive first, then other multi-joint core lifts, then assistance. The existing slots keep their positions and their `optional` flags; new slots are appended in priority order.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-count.test.mjs`:

```javascript
import { TEMPLATES } from '../js/templates.js';

test('a lifting template offers more slots than a session will use', () => {
  // §4.4: "TEMPLATES stays a list, but becomes longer than will fit and is
  // consumed in priority order". Before plan-07 these were 4, 4 and 5 -- the
  // exact counts spec.md calls invented.
  assert.ok(TEMPLATES['max-strength'].length > 4);
  assert.ok(TEMPLATES.power.length > 4);
  assert.ok(TEMPLATES.hypertrophy.length > 5);
});

test('every slot beyond the original ones is optional', () => {
  // The required core of each day is unchanged, so coverage can only ADD.
  for (const [dt, originallyRequired] of [['max-strength', 3], ['power', 3], ['hypertrophy', 3]]) {
    const required = TEMPLATES[dt].filter(s => !s.optional).length;
    assert.equal(required, originallyRequired,
      `${dt} changed its required slot count, which changes what a session must contain`);
  }
});

test('every added slot can be filled from the library', () => {
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    for (const slot of TEMPLATES[dt]) {
      const pool = LIB.filter(e => (slot.patterns || []).includes(e.pattern));
      assert.ok(pool.length > 0,
        `${dt} slot ${slot.slot} names patterns no exercise has: ${JSON.stringify(slot.patterns)}`);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: the first test FAILS — `max-strength` is still 4 slots.

- [ ] **Step 3: Append the candidate slots**

In `js/templates.js`, append to each template. Copy the shape of the existing slots in that same template (they carry `tier`, `patterns`, `zone`, `mode`, `sets`, `reps`, `restSec`, `optional`) — do not invent new slot fields. Add:

- **`MAX_STRENGTH`** (currently A–D) gains **E, F, G**, all `optional: true`:
  - `E`: `patterns: ['pull-v', 'pull-h']` — the pull side is one slot in a four-slot day and is the first thing coverage will ask for.
  - `F`: `patterns: ['push-v', 'push-h']`
  - `G`: `patterns: ['lunge', 'carry']` — assistance, last by priority.
- **`POWER`** (currently A–D) gains **E, F**, both `optional: true`:
  - `E`: `patterns: ['jump', 'throw']` — a second explosive expression, highest priority for this day type.
  - `F`: `patterns: ['squat', 'hinge']`
- **`HYPERTROPHY`** (currently A–E) gains **F, G, H**, all `optional: true`:
  - `F`: `patterns: ['pull-v', 'pull-h']`
  - `G`: `patterns: ['push-v', 'push-h']`
  - `H`: `patterns: ['rotate', 'core']` — assistance.

Use the same `zone` as the nearest existing slot of comparable priority in that template, and the same `mode`. For sets/reps/rest, copy the corresponding accessory slot already in that template rather than choosing new numbers — a new dose would need its own source.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/coverage-count.test.mjs` — expected: 9 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **321 pass, 0 fail**.

**If `tests/session.test.mjs`'s duration tests fail here, STOP.** They should not: the FILL loop still stops at the same place until Task 4, and `packToBudget` already drops optional slots first. A failure here means the added slots are reaching sessions before coverage is wired, which is a different bug — report it rather than trimming the templates back.

- [ ] **Step 5: Commit**

```bash
git add js/templates.js tests/coverage-count.test.mjs
git commit -m "Offer more candidate slots than a session will use"
```

---

### Task 4: the FILL loop becomes coverage-driven

**Files:**
- Modify: `js/generator.js` (the FILL loop, currently at line ~1163)
- Test: `tests/coverage-count.test.mjs`

**Interfaces:**
- Consumes: `patternDebt`, `DAY_TYPES[dayType].targets`.
- Produces: no new export. `generate` returns the same session shape; only the number of main blocks changes.

**The rule, from §4.4:** walk the template in order. A **required** slot is always filled. An **optional** slot is filled only if some targeted pattern it could serve still carries debt. Stop early when the projected main-work time would exceed `TIME.MAIN_WORK_MAX_MIN` — coverage proposes, time disposes.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-count.test.mjs`:

```javascript
import { generate } from '../js/generator.js';

const mainBlocks = s =>
  s.blocks.filter(b => b.role !== 'prep' && b.role !== 'mobility' && b.role !== 'core');

function countMain(dayType, patternSets, seed = 11) {
  const history = Object.keys(patternSets).length
    ? [{ date: '2026-08-30', dayType: 'hypertrophy', cnsLoad: 0, patternSets, blocks: [] }]
    : [];
  const s = generate({
    library: LIB, profile: { banned: [], plyoLevel: 'beginner' },
    history, soreness: {}, dayType, excludeEquipment: [], seed,
    now: Date.parse('2026-09-01T12:00:00Z')
  });
  return mainBlocks(s).length;
}

test('a week with nothing trained pulls in more exercises than a week already covered', () => {
  // The complaint §4.4 answers: the count never responded to what was trained.
  const fresh = countMain('max-strength', {});
  const covered = countMain('max-strength', {
    squat: 9, hinge: 9, 'push-h': 9, 'push-v': 9, 'pull-h': 9, 'pull-v': 9
  });
  assert.ok(fresh > covered,
    `coverage is not driving the count: ${fresh} exercises on a fresh week ` +
    `vs ${covered} on a fully covered one`);
});

test('the required core of a day is always delivered', () => {
  // Even with every pattern at its target, a session is still a session.
  const covered = countMain('max-strength', {
    squat: 99, hinge: 99, 'push-h': 99, 'push-v': 99, 'pull-h': 99, 'pull-v': 99
  });
  assert.ok(covered >= 3, `only ${covered} main blocks -- the required slots must survive`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: the first test FAILS — the counts are equal, because the loop fills every slot regardless of debt.

- [ ] **Step 3: Implement**

In `js/generator.js`, replace the FILL loop's opening with a coverage gate. The loop currently begins:

```javascript
  for (const slot of template) {                                         // 6-7
    let exercise = fillSlot(slot, library, ctx, rng);
```

Change it to:

```javascript
  // §4.4: coverage drives the count up, time bounds it above. A required slot
  // is always taken. An optional slot is taken only while some pattern it
  // could serve still owes volume this week, and only while the main work
  // still fits -- a session that does not fit is not a session.
  const targets = (DAY_TYPES[chosen] && DAY_TYPES[chosen].targets) || [];
  for (const slot of template) {                                         // 6-7
    if (slot.optional) {
      const serves = (slot.patterns || []).filter(p => targets.includes(p));
      const owed = serves.some(p => patternDebt(p, chosen, state) > 0);
      if (!owed) continue;
      if (estimateMinutes(blocks) >= TIME.MAIN_WORK_MAX_MIN) break;
    }
    let exercise = fillSlot(slot, library, ctx, rng);
```

`DAY_TYPES` is already imported in this file; `TIME` and `estimateMinutes` are already in scope.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/coverage-count.test.mjs` — expected: 11 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **323 pass, 0 fail**.

**The duration tests in `tests/session.test.mjs` are the gate. If they fail here, do NOT edit them** — they encode the athlete's stated 70-minute limit and a decision he has already reversed once to protect. Go to Task 6, which exists to set the cap that keeps them passing.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/coverage-count.test.mjs
git commit -m "Fill by coverage debt instead of a fixed slot count"
```

---

### Task 5: trimming drops the least overdue work

**Files:**
- Modify: `js/generator.js` (`packToBudget`, line ~856)
- Test: `tests/coverage-count.test.mjs`

**Interfaces:**
- `packToBudget(blocks, budgetMin, opts)` gains an optional third argument `{ dayType, state }`. Called without it, behaviour is exactly as today — that keeps its existing callers and tests valid.

- [ ] **Step 1: Write the failing test**

Append to `tests/coverage-count.test.mjs`:

```javascript
import { packToBudget } from '../js/generator.js';

test('when something must go, the least overdue work goes first', () => {
  // §4.4: "drop the slot whose pattern carries the least outstanding debt, so
  // the work that survives is the work most overdue." It used to drop the
  // LAST optional slot, which is a statement about template order, not about
  // what the athlete needs.
  const blocks = [
    { slot: 'A', pattern: 'squat',  optional: false, mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'B', pattern: 'hinge',  optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'C', pattern: 'pull-h', optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 }
  ];
  // hinge is fully covered this week; pull-h has not been touched. Slot B is
  // earlier, so position-ordered trimming would keep it and drop C.
  const state = { patternSets: { hinge: 99, 'pull-h': 0 }, recentExerciseIds: new Set() };
  const out = packToBudget(blocks, 1, { dayType: 'max-strength', state });
  const kept = out.blocks.map(b => b.slot);

  assert.ok(!kept.includes('B'), `dropped by position, not debt: kept ${kept.join(',')}`);
  assert.ok(kept.includes('A'), 'a required slot must never be dropped');
});

test('called without a day type it trims exactly as it always did', () => {
  const blocks = [
    { slot: 'A', pattern: 'squat', optional: false, mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'B', pattern: 'hinge', optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 }
  ];
  const out = packToBudget(blocks, 1);
  assert.deepEqual(out.trimmedSlots, ['B']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: the first test FAILS — `dropped by position, not debt: kept A,B`.

- [ ] **Step 3: Implement**

In `js/generator.js`, change `packToBudget`'s signature and its optional-dropping loop:

```javascript
export function packToBudget(blocks, budgetMin = TIME.MAIN_WORK_MAX_MIN, opts = {}) {
  let out = blocks.slice();
  let trimmed = [];

  // Drop optional work by LEAST outstanding debt, so what survives a trim is
  // what is most overdue -- design §4.4. Position order (the old rule) is a
  // statement about the template, not about what the athlete needs this week.
  // Without a dayType there is no debt to read and the old last-first order
  // stands, which is what every existing caller and test relies on.
  const { dayType, state } = opts;
  while (estimateMinutes(out) > budgetMin) {
    const optionalIdx = out
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.optional);
    if (optionalIdx.length === 0) break;

    let victim;
    if (dayType && state) {
      victim = optionalIdx
        .sort((x, y) =>
          patternDebt(x.b.pattern, dayType, state) - patternDebt(y.b.pattern, dayType, state))[0];
    } else {
      victim = optionalIdx[optionalIdx.length - 1];
    }
    trimmed.push(victim.b.slot);
    out.splice(victim.i, 1);
  }
```

Leave the set-shaving `while` loop below it exactly as it is. Then update the call site in `generate` (line ~1189):

```javascript
  const packed = packToBudget(blocks, TIME.MAIN_WORK_MAX_MIN, { dayType: chosen, state });
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/coverage-count.test.mjs` — expected: 13 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **325 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/coverage-count.test.mjs
git commit -m "Trim by outstanding debt rather than template position"
```

---

### Task 6: the 70-minute gate, measured and enforced

**Files:**
- Modify: `js/rules.js` (add `MAX_MAIN_SLOTS`)
- Modify: `js/generator.js` (enforce it in the FILL loop)
- Test: `tests/coverage-count.test.mjs`

**Interfaces:**
- Produces: `TIME.MAX_MAIN_SLOTS` — an integer, `[measured]`, set from the sweep in Step 1.

**Why this task is not optional.** Before plan-07 the worst session across 4,000 seeds × 3 lifting day types was **exactly 70 minutes** — `docs/spec.md:36`'s stated limit, with zero margin — and main work already saturated `MAIN_WORK_MAX_MIN` on all three. Coverage can now propose more slots than the *floors* of those slots can fit in the budget, and floors are irreducible: `packToBudget` cannot shave a ramped block below two working sets. So a coverage-driven count can push total session time past 70 in a way trimming cannot rescue.

- [ ] **Step 1: Measure before choosing the number**

Write this throwaway script as `tests/_probe_slots.mjs`, run it, then delete it:

```javascript
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
const LIB = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')).exercises;
// An empty history is maximum debt, which is maximum coverage pressure.
let worst = { d: -1 };
const dist = {};
for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
  for (let seed = 1; seed <= 4000; seed++) {
    const s = generate({ library: LIB, dayType, seed, now: 1e12 });
    const n = s.blocks.filter(b => b.role !== 'prep' && b.role !== 'mobility' && b.role !== 'core').length;
    dist[n] = (dist[n] || 0) + 1;
    if (s.durationMin > worst.d) worst = { d: s.durationMin, dayType, seed, n };
  }
}
console.log('main-block count distribution:', JSON.stringify(dist));
console.log('worst session:', JSON.stringify(worst));
```

Run: `node tests/_probe_slots.mjs`

Read the output. **If `worst.d` is ≤ 70**, set `MAX_MAIN_SLOTS` to the highest count in the distribution and record in the constant's comment that the cap is not currently binding. **If `worst.d` is > 70**, lower the cap one slot at a time, re-running the probe, until the worst session is ≤ 70. Record the measured worst at the chosen cap. Delete the probe file when done.

- [ ] **Step 2: Write the failing test**

Append to `tests/coverage-count.test.mjs`:

```javascript
import { TIME } from '../js/rules.js';

test('coverage never proposes more main work than the measured cap', () => {
  // The floors of a long template are irreducible -- packToBudget cannot shave
  // a ramped block below two working sets -- so an uncapped coverage count can
  // push a session past the athlete's stated 70 minutes in a way trimming
  // cannot rescue. tests/session.test.mjs is the gate; this is the guard rail.
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 300; seed++) {
      const s = generate({
        library: LIB, profile: { banned: [], plyoLevel: 'beginner' },
        history: [], soreness: {}, dayType, excludeEquipment: [], seed, now: 1e12
      });
      const n = mainBlocks(s).length;
      assert.ok(n <= TIME.MAX_MAIN_SLOTS,
        `${dayType}/seed ${seed} built ${n} main blocks, over the cap of ${TIME.MAX_MAIN_SLOTS}`);
    }
  }
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node --test tests/coverage-count.test.mjs`
Expected: FAILS at the import or on `TIME.MAX_MAIN_SLOTS` being `undefined` (every comparison against `undefined` is false, so the assertion fires).

- [ ] **Step 4: Add the constant and enforce it**

In `js/rules.js`, inside the `TIME` object, add — filling in the two figures from Step 1's measurement:

```javascript
  // The most main-work exercises a coverage-driven session may propose.
  // [measured] -- from a 4,000-seed x 3-lifting-day-type sweep at maximum
  // coverage pressure (empty history = maximum debt), plan-07 Task 6. Coverage
  // asks for as much work as is owed; the floors of those slots are
  // irreducible, so without a cap it can push a session past the athlete's
  // stated 70 min (spec.md:36) in a way packToBudget cannot rescue. Worst
  // observed session at this cap: <FILL IN> min.
  MAX_MAIN_SLOTS: <FILL IN>,
```

In `js/generator.js`, extend the FILL loop's optional gate:

```javascript
    if (slot.optional) {
      const serves = (slot.patterns || []).filter(p => targets.includes(p));
      const owed = serves.some(p => patternDebt(p, chosen, state) > 0);
      if (!owed) continue;
      if (blocks.length >= TIME.MAX_MAIN_SLOTS) break;
      if (estimateMinutes(blocks) >= TIME.MAIN_WORK_MAX_MIN) break;
    }
```

- [ ] **Step 5: Run everything, and read the duration tests specifically**

Run: `node --test "tests/*.test.mjs"` — expected: **326 pass, 0 fail**.

Then confirm by name that both gates passed, rather than trusting the total:

```bash
node --test "tests/*.test.mjs" 2>&1 | grep -E "70-minute|duration sweep"
```

Expected: both lines start with `✔`. **If either fails, the cap is still too high — return to Step 1 and lower it.** Never widen `GYM_SESSION_TOTAL_MIN`, `FLOOR_OVERRUN_ALLOWANCE_MIN`, or the literal 70 in the test.

- [ ] **Step 6: Commit**

```bash
git add js/rules.js js/generator.js tests/coverage-count.test.mjs
git commit -m "Cap the coverage-driven count at the measured 70-minute limit"
```

---

### Task 7: document it, bump the worker, deploy

**Files:**
- Modify: `docs/design-mobility-and-warmup.md` (§4.4 "as built"; §8 gains the fractional-counting open question)
- Modify: `docs/spec.md` (§10 item 4 becomes done)
- Modify: `sw.js` (`VERSION` `'v22'` → `'v23'`)

- [ ] **Step 1: Write the §4.4 "as built" note**

Add to `docs/design-mobility-and-warmup.md` §4.4, in that document's voice:

- what shipped: declared `targets`, `patternDebt`, coverage-driven FILL, debt-ordered trimming, and the measured `MAX_MAIN_SLOTS`;
- **decision 1** — debt is direct-only, why fractional counting was deferred (the library has one `pattern` per entry and no indirect map across all 236 entries), and that this overstates debt slightly and therefore errs toward more work;
- **decision 2** — `targets` are declared rather than computed from slot patterns, because computing them makes coverage circular;
- the before/after main-block distribution from Task 6's probe, and the worst observed session in minutes;
- the note that non-lifting day types deliberately declare no targets, because their volume is dosed in minutes, metres and contacts.

- [ ] **Step 2: Add the new open question to §8**

Append to `docs/design-mobility-and-warmup.md` §8:

> **Fractional coverage needs an indirect-pattern map.** The sourced convention for counting sets is fractional — an indirect set counts 0.5 (design §8 question 6, Pelland et al. 2025) — but coverage in §4.4 counts direct sets only, because `data/exercises.json` gives every entry exactly one `pattern` and records nothing about what a movement trains indirectly. A squat set and a lunge set both load the quadriceps and the app cannot currently see it. Adding that map is a data job and it must be sourced, not invented. Until then, debt is slightly overstated for patterns receiving indirect work, which biases coverage toward proposing more exercises — bounded by `TIME.MAX_MAIN_SLOTS`.

- [ ] **Step 3: Close spec.md §10 item 4**

Change item 4 from "**UNBLOCKED 2026-09-01** … **This is the resume point and it is now buildable.**" to a done entry in the style of items 1–3 above it, naming `sw.js` v23, the coverage rule, and the measured cap.

- [ ] **Step 4: Bump the service worker**

In `sw.js`, change `const VERSION = 'v22';` to `const VERSION = 'v23';`.

- [ ] **Step 5: Full verification before any deploy claim**

Run: `node --test "tests/*.test.mjs"` and read the counts. Expected: **326 pass, 0 fail**. Do not proceed on a remembered result.

- [ ] **Step 6: Look at it in a browser before shipping**

The DOM shim renders no CSS and has already let a real layout bug through. A session with seven main blocks is longer than any this app has produced; confirm on a 390px-wide column that the card still reads, and that the count visibly responds — generate with an empty history (high debt) and again with a full week of `patternSets` (low debt) and compare the number of exercise cards.

Serve with `python -m http.server 8765`, and **clear the service worker and caches before trusting anything you see** — a stale worker serving old JavaScript under an unchanged version name has cost three debugging cycles on this project:

```javascript
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k);
```

Then reload and confirm the loaded source actually contains the change before drawing any conclusion from behaviour.

- [ ] **Step 7: Commit, push, verify the deploy**

```bash
git add docs/design-mobility-and-warmup.md docs/spec.md sw.js
git commit -m "Document the coverage-driven exercise count and ship it as v23"
git push origin main
```

Then poll until Pages serves it, and check the deployed file carries the change rather than just the version string:

```bash
until curl -s "https://ninwhippa08.github.io/GymBuddy/sw.js?cb=$(date +%s)" \
  | grep -q "const VERSION = 'v23'"; do sleep 15; done; echo "v23 live"
curl -s "https://ninwhippa08.github.io/GymBuddy/js/generator.js?cb=$(date +%s)" | grep -c "patternDebt"
```

Tell the athlete the app needs a **second launch** to activate.

---

## Self-review

**Spec coverage.** §4.4's two constraints both land: constraint 1 (coverage drives the count up) is Tasks 1, 2 and 4; constraint 2 (time bounds it above) is Tasks 4 and 6. Its explicit instruction to "drop by neglect, not by position" is Task 5. Its "TEMPLATES becomes longer than will fit, consumed in priority order" is Task 3. The `overBudget` warning it says to keep is untouched — no task modifies it.

**Placeholders.** Two deliberate `<FILL IN>` markers exist in Task 6 Step 4, and only there. They are not vagueness: the plan cannot know the measured cap before Task 6 Step 1 runs the sweep, and inventing a number is exactly the failure this feature exists to correct. The step says how to derive both.

**Type consistency.** `patternDebt(pattern, dayType, state)` has the same signature in Tasks 2, 4 and 5. `state` is always the `buildState` shape with `patternSets`. `TEMPLATES[dayType]` is an array of slot objects throughout. `packToBudget`'s third parameter is `{ dayType, state }` in both its definition and its `generate` call site. `mainBlocks` is defined once in Task 4 and reused in Task 6 — Task 6 must therefore be applied after Task 4, as ordered.

**One risk the executor should know.** Task 3 adds slots but Task 4 is what lets them reach a session. Between those two commits the repo is in a state where the templates are longer and nothing consumes them — harmless, since every added slot is `optional` and `packToBudget` drops optional work first, but it means Task 3's commit alone should not be deployed. Nothing in this plan deploys before Task 7.
