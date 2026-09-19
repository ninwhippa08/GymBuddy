# Ramp set budget — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The return ramp's percentage becomes a budget on the session's working sets, so the weekly column lands as stated instead of being destroyed by `round()` on a dose of 3.

**Architecture:** `prescribe()` stops scaling sets for blocks the budget covers; a new `rampToBudget()` runs once per session between the fill loop and `applyArchitecture()`, setting `budget = round(drawn × volume)` and distributing by largest fractional remainder with the more specific slot winning ties. Blocks outside `countsTowardVolume` — intervals, timed work, core, prep — keep the per-block multiplier they have today.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. `node --test tests/*.test.mjs`. Node 18+, developed on Node 24.

**Spec:** `docs/superpowers/specs/2026-09-17-ramp-set-budget-design.md`

## Global Constraints

- **No dependencies, no build step.** Everything is plain ES modules served as files.
- **Every number in source carries a source tag** — `[verified]`, `[corroborated]`, `[unverified]` or `[measured]` — in a comment at the constant. No new untagged constant ships.
- **Watch every guard fail before committing it.** A test that has never been red proves nothing. Guards that pass on their first run get mutation-tested with `node tests/mutate.mjs`.
- **Smoke tests run through `generate()`**, never through `prescribe()` alone.
- **`RAMP`'s own values do not change.** Not one number in the table moves.
- **Full volume must stay byte-for-byte identical** for generated sessions at the same seed. Swaps are the deliberate exception (Task 4).
- **Ships as `sw.js` / `js/version.js` v78**, bumped together or `tests/version.test.mjs` fails.
- The suite is at **641/641** before this plan starts. Every task ends green.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/generator.js` | modify | `setFloor()` and `dropWorkingSet()` helpers (Task 1); `rampToBudget()` (Task 2); the `prescribe()` gate and the `generate()` call site (Task 3); `swapBlock()` set inheritance (Task 4) |
| `tests/ramp-budget.test.mjs` | create | Every guard for the budget: arithmetic, distribution, floors, the flat spot, week 4, full-volume identity |
| `tests/swap.test.mjs` | modify | A swapped block keeps its set count (Task 4) |
| `tools/measure.mjs` | modify | The `ramp` sweep — delivered sets by week, day type and slot (Task 5) |
| `docs/programming-basis.md` | modify | Discrepancy 10 (Task 6) |
| `docs/design-mobility-and-warmup.md` | modify | §13.4 from "Not changed here" to the fix (Task 6) |
| `docs/design-architectures.md` | modify | §7.4, what happened to the damper (Task 6) |
| `README.md` | modify | Design decisions: the budget and the swap consequence (Task 6) |
| `js/version.js`, `sw.js` | modify | v77 → v78 (Task 6) |

---

### Task 1: One way to remove a working set

`packToBudget` and `capPatternSets` each carry their own copy of "decrement `sets`, and splice the last `work` entry off `setPlan` so the plan does not overstate `block.sets`". `rampToBudget` would be the third. Extract it first, so the new code has one obvious thing to call.

This task changes no behaviour. **The existing suite is the guard** — that is the point of doing it as its own commit, before anything behavioural lands.

**Files:**
- Modify: `js/generator.js` — `packToBudget` (~line 1486), `capPatternSets` (~line 1509)

**Interfaces:**
- Consumes: nothing
- Produces: `setFloor(block) → number` and `dropWorkingSet(block) → block`, both exported from `js/generator.js`

- [ ] **Step 1: Record the starting count**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: 641 pass, 0 fail. Write the number down; it must not move in this task.

- [ ] **Step 2: Add the two helpers**

In `js/generator.js`, immediately above `packToBudget`:

```js
// A ramped block floors at TWO working sets, not one. Warm-ups cannot be
// trimmed -- they are the safety feature -- so a block that keeps shrinking
// ends up all ramp and no work: five warm-up sets to perform one working set
// is not a prescription anyone would write by hand.
export const setFloor = block => (block.setPlan ? 2 : 1);

// Remove ONE working set and keep `setPlan` honest. The ramp was built against
// the pre-trim count, so a shaved working set has to come out of the plan too
// or it overstates `block.sets` -- the exact drift 'the work entries and
// block.sets never disagree' (tests/ramp.test.mjs) exists to catch. Drop a
// WORK entry, never a warm-up rung: the ramp still has to reach the same load.
//
// Three callers: packToBudget (the clock), capPatternSets (ten sets per
// pattern) and rampToBudget (the return ramp). It was copied twice before it
// was extracted.
export function dropWorkingSet(block) {
  block.sets -= 1;
  if (block.setPlan) {
    const idx = block.setPlan.map(s => s.kind).lastIndexOf('work');
    if (idx !== -1) block.setPlan.splice(idx, 1);
  }
  return block;
}
```

- [ ] **Step 3: Point `packToBudget` at them**

Replace the body of its trim loop:

```js
    const target = out
      .filter(b => b.mode !== 'time' && b.sets > setFloor(b))
      .sort((a, b) => b.sets * b.reps - a.sets * a.reps)[0];
    if (!target) break;
    dropWorkingSet(target);
```

Keep the comment that is already above it; move the parts about the floor and about `setPlan` to the helpers rather than duplicating them.

- [ ] **Step 4: Point `capPatternSets` at them**

```js
      const target = out
        .filter(b => direct(b) && b.pattern === pattern && b.sets > setFloor(b))
        .sort((a, b) => b.sets - a.sets)[0];
      if (!target) break;
      dropWorkingSet(target);
```

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: the same 641 pass, 0 fail as Step 1. A refactor that moves the count has changed behaviour and must be undone, not argued with.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js
git commit -m "One way to remove a working set, before there are three

packToBudget and capPatternSets each carried a copy of 'decrement sets and
splice the last work entry off setPlan'. rampToBudget would be the third.
setFloor and dropWorkingSet, no behaviour change, 641/641 unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `rampToBudget()`, tested on its own

The function, with no call site yet. Tested directly on hand-built block arrays so the arithmetic is pinned before the session pipeline can hide it.

**Files:**
- Modify: `js/generator.js` — new function after `capPatternSets`
- Create: `tests/ramp-budget.test.mjs`

**Interfaces:**
- Consumes: `setFloor`, `dropWorkingSet` (Task 1); `countsTowardVolume` (existing, `js/generator.js:1417`)
- Produces: `rampToBudget(blocks, volume) → blocks` — mutates covered blocks in place and returns the same array

- [ ] **Step 1: Write the failing tests**

Create `tests/ramp-budget.test.mjs`:

```js
// The return ramp's percentage, as a budget on the session's working sets.
// docs/superpowers/specs/2026-09-17-ramp-set-budget-design.md §4.1-4.3.
//
// The defect these pin: `round(sets x volume)` per block cannot express the
// RAMP column at a dose of 3. It needs 0.834 before it returns 3, so weeks 1,
// 2 and 3 (0.50/0.70/0.80) all returned 2 and week 4 (0.90) cut nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rampToBudget } from '../js/generator.js';

// A main-work block as the fill loop leaves it: countsTowardVolume needs a
// mode in load/contacts/reps and a role that is not core or prep.
const block = (slot, sets, extra = {}) => ({
  slot, sets, reps: 5, mode: 'load', role: 'main lift', ...extra
});
const setsOf = bs => bs.map(b => b.sets);
const total = bs => bs.reduce((a, b) => a + b.sets, 0);

test('the budget is the session total, not each block on its own', () => {
  // Three blocks at 3 sets, 9 drawn, 70% of 9 is 6.3 -> 6. Per-block rounding
  // gave 2+2+2 = 6 here too; what differs is that the budget is stated once.
  const bs = [block('A', 3), block('B', 3), block('C', 3)];
  rampToBudget(bs, 0.70);
  assert.equal(total(bs), 6);
});

test('weeks 1, 2 and 3 no longer deliver the same session', () => {
  // THE FLAT SPOT, at the dose where it lived. 4 blocks of 3 = 12 drawn.
  const at = v => { const bs = [1, 2, 3, 4].map(i => block(String(i), 3)); rampToBudget(bs, v); return total(bs); };
  assert.equal(at(0.50), 6);
  assert.equal(at(0.70), 8);
  assert.equal(at(0.80), 10);
  assert.equal(at(0.90), 11);
  assert.equal(at(1.00), 12);
});

test('the leftover goes by largest remainder, ties to the earlier slot', () => {
  // 4 and 3 sets at 0.70: exact 2.8 and 2.1, floors to 2 and 2, budget
  // round(4.9) = 5, one set left over, and 0.8 beats 0.1.
  const bs = [block('A', 4), block('B', 3)];
  rampToBudget(bs, 0.70);
  assert.deepEqual(setsOf(bs), [3, 2]);

  // Equal remainders: both 0.5, so the earlier slot -- the more specific one --
  // takes it. 3 and 3 at 0.50 is exact 1.5 twice, budget round(3) = 3.
  const tie = [block('A', 3), block('B', 3)];
  rampToBudget(tie, 0.50);
  assert.deepEqual(setsOf(tie), [2, 1]);
});

test('no block is handed back more sets than it drew', () => {
  const bs = [block('A', 2), block('B', 6)];
  rampToBudget(bs, 0.90);
  assert.ok(bs[0].sets <= 2 && bs[1].sets <= 6);
});

test('a block with a warm-up ladder floors at two working sets', () => {
  // setFloor is 2 with a setPlan, and the spliced work entry goes with it.
  const bs = [block('A', 4, {
    setPlan: [{ kind: 'warmup' }, { kind: 'work' }, { kind: 'work' },
              { kind: 'work' }, { kind: 'work' }]
  })];
  rampToBudget(bs, 0.25);
  assert.equal(bs[0].sets, 2);
  assert.equal(bs[0].setPlan.filter(s => s.kind === 'work').length, 2);
});

test('floors that exceed the budget overshoot it, visibly', () => {
  // Two laddered blocks cannot go below 2 each. 4+4 drawn, budget round(2.4)
  // = 2, floors total 4. The session delivers 4 and says nothing clever.
  const plan = () => ({ setPlan: [{ kind: 'work' }, { kind: 'work' }, { kind: 'work' }, { kind: 'work' }] });
  const bs = [block('A', 4, plan()), block('B', 4, plan())];
  rampToBudget(bs, 0.30);
  assert.equal(total(bs), 4);
});

test('core, prep, timed and interval blocks are not in the budget', () => {
  const bs = [
    block('A', 4),
    { slot: 'M2', sets: 3, reps: 10, mode: 'reps', role: 'core' },
    { slot: 'P1', sets: 3, reps: 10, mode: 'contacts', role: 'prep' },
    { slot: 'B', sets: 6, reps: 1, mode: 'interval', role: 'intervals' }
  ];
  rampToBudget(bs, 0.50);
  assert.equal(bs[0].sets, 2, 'the main block is budgeted');
  assert.deepEqual([bs[1].sets, bs[2].sets, bs[3].sets], [3, 3, 6],
    'everything outside countsTowardVolume is left for prescribe to scale');
});

test('full volume is a no-op', () => {
  const bs = [block('A', 4), block('B', 3), block('C', 3)];
  rampToBudget(bs, 1);
  assert.deepEqual(setsOf(bs), [4, 3, 3]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ramp-budget.test.mjs 2>&1 | tail -20`
Expected: every test fails with `rampToBudget is not a function` (the import resolves to `undefined`). If any test passes at this point, the test is not testing what it says.

- [ ] **Step 3: Write `rampToBudget`**

In `js/generator.js`, after `capPatternSets`:

```js
// --------------------------------------------------------------------------
// 7b  THE RAMP'S PERCENTAGE, AS A BUDGET ON THE SESSION'S WORKING SETS
// --------------------------------------------------------------------------

// The 50/30/20/10 rule is a schedule of reductions in WORKLOAD [verified], and
// workload is a session total. Applying its column to each block on its own was
// an interpretation made in this project, and `round()` on a small integer
// cannot carry it: at a dose of 3 the multiplier must reach 0.834 before it
// returns 3, so 0.50, 0.70 and 0.80 all returned 2 and 0.90 cut nothing at all.
// Measured at v77: hypertrophy slot C held 2.00 sets for three weeks running,
// and week 4 delivered 101% of full volume. design-mobility-and-warmup.md 13.4.
//
// So the percentage is applied ONCE, to the session. What the budget covers is
// countsTowardVolume -- the same line patternSets and cnsLoad ride on -- so the
// ramp's arithmetic cannot drift from what the app calls training volume.
// Everything else (timed work, intervals, core, prep) keeps the per-block
// multiplier in prescribe(); removing that too would silently RAISE interval
// and core work during the ramp.
//
// Runs BEFORE applyArchitecture, because the architecture builds ladders and
// waves out of the set count and a set removed afterwards leaves a rung
// dangling.
export function rampToBudget(blocks, volume) {
  // At full volume the budget equals the drawn total and every step below is a
  // no-op. Returning early makes that a guarantee rather than an outcome: a
  // fully recovered athlete's session must be identical to the one the app
  // built before this function existed.
  if (!(volume < 1)) return blocks;

  const covered = blocks.filter(countsTowardVolume);
  if (!covered.length) return blocks;

  const drawn = covered.reduce((a, b) => a + b.sets, 0);
  const budget = Math.max(1, Math.round(drawn * volume));

  // `order` is template order -- the fill loop pushes in it, and design 4.4
  // calls the template a priority order in those words. It breaks ties below.
  const plan = covered.map((b, order) => {
    const floor = setFloor(b);
    const exact = Math.max(floor, b.sets * volume);
    return {
      b, order,
      base: Math.min(b.sets, Math.max(floor, Math.floor(exact))),
      frac: exact - Math.floor(exact)
    };
  });

  // Largest remainder. One pass is provably enough: budget <= sum(exact) <
  // sum(floor(exact)) + n <= sum(base) + n, so at most one set per block is
  // ever owed. A tie goes to the earlier slot, which is the more specific one --
  // the only place the deload-ordering source is used, and it is [unverified].
  let total = plan.reduce((a, p) => a + p.base, 0);
  for (const p of [...plan].sort((x, y) => (y.frac - x.frac) || (x.order - y.order))) {
    if (total >= budget) break;
    if (p.base < p.b.sets) { p.base += 1; total += 1; }
  }

  // The floors can hold the total ABOVE the budget, and when they do the
  // session delivers more than the ramp asked for. Left visible -- a test
  // asserts it -- rather than forced down by a mechanism invented to hide it.
  for (const p of plan) {
    while (p.b.sets > p.base) dropWorkingSet(p.b);
  }
  return blocks;
}
```

- [ ] **Step 4: Run the new tests and watch them pass**

Run: `node --test tests/ramp-budget.test.mjs 2>&1 | tail -20`
Expected: 8 pass, 0 fail.

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: 649 pass, 0 fail. Nothing calls `rampToBudget` yet, so the pre-existing 641 must be untouched.

- [ ] **Step 6: Mutation-test the two guards that could pass for the wrong reason**

The tie-break and the floor are the ones a wrong rule agrees with on these fixtures.

```bash
node tests/mutate.mjs js/generator.js tests/ramp-budget.test.mjs \
  "(x.order - y.order)" "(y.order - x.order)" "tie goes to the later slot"
node tests/mutate.mjs js/generator.js tests/ramp-budget.test.mjs \
  "block.setPlan ? 2 : 1" "1" "no ladder floor"
```

Expected: both mutants DIE. A survivor means the fixture cannot tell the rule from its opposite — fix the test, not the mutant.

- [ ] **Step 7: Commit**

```bash
git add js/generator.js tests/ramp-budget.test.mjs
git commit -m "rampToBudget: the ramp's percentage as a session set budget

Not wired in yet -- the function and its guards only. The budget covers
countsTowardVolume, the leftover whole sets go by largest remainder, and a tie
goes to the earlier slot. Floors can hold the total above the budget and that
overshoot is asserted rather than hidden.

Tie-break and ladder floor mutation-tested; both mutants died. 649/649.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire it in

The behaviour change. `prescribe()` stops scaling covered blocks, `generate()` calls the budget.

**Files:**
- Modify: `js/generator.js` — `prescribe()` (~line 739), `generate()` (~line 2088)
- Modify: `tests/ramp-budget.test.mjs` — the session-level guards

**Interfaces:**
- Consumes: `rampToBudget` (Task 2)
- Produces: no new exports; `generate()` sessions now honour the budget

- [ ] **Step 1: Write the failing session-level tests**

Append to `tests/ramp-budget.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { generate, countsTowardVolume } from '../js/generator.js';
import { RAMP } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const NOW = 1e12;
const DAY = 86400e3;
const LIFTING = ['max-strength', 'power', 'hypertrophy'];
// Mid-week, so a rounding error in rampWeekFor cannot land this on a boundary.
const atWeek = w => ({ returnDate: new Date(NOW - ((w - 1) * 7 + 3) * DAY).toISOString().slice(0, 10) });

function meanSets(dayType, week, seeds = 120) {
  let sets = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
                         dayType, seed, now: NOW });
    sets += s.blocks.filter(countsTowardVolume).reduce((a, b) => a + b.sets, 0);
  }
  return sets / seeds;
}

test('every ramp week delivers more work than the one before it', () => {
  // THE FLAT SPOT AT SESSION LEVEL. Before this change, hypertrophy slot C sat
  // at 2.00 sets for weeks 1, 2 and 3, and week 4 delivered 101% of full volume.
  for (const dayType of LIFTING) {
    const by = [1, 2, 3, 4, 5].map(w => meanSets(dayType, w));
    for (let i = 1; i < by.length; i++) {
      assert.ok(by[i] > by[i - 1],
        `${dayType}: week ${i + 1} delivered ${by[i].toFixed(2)} against week ${i}'s ${by[i - 1].toFixed(2)}`);
    }
  }
});

test('week 4 is not a free week', () => {
  // round(3 x 0.9) = 3, so at a dose of 3 the old rule cut nothing here.
  for (const dayType of LIFTING) {
    const four = meanSets(dayType, 4), five = meanSets(dayType, 5);
    assert.ok(four < five * 0.97,
      `${dayType}: week 4 delivered ${four.toFixed(2)} against full volume ${five.toFixed(2)}`);
  }
});

test('a ramp week delivers the share of full volume it prints', () => {
  // THE CLAIM THE WHOLE CHANGE MAKES. Measured at v77 this failed on every
  // lifting day type: max-strength week 1 delivered 63% of full volume against
  // a column that says 50%, and week 4 delivered 100% against 90%.
  //
  // A tolerance of 5 points, not 0: packToBudget and capPatternSets run after
  // the budget and only ever remove, and the floors can hold a session above
  // it. Both push the delivered share around by a little, in opposite
  // directions, and neither is this function's business.
  for (const dayType of LIFTING) {
    const full = meanSets(dayType, 5);
    for (const week of [1, 2, 3, 4]) {
      const share = meanSets(dayType, week) / full;
      const intended = RAMP[week - 1].volume;
      assert.ok(Math.abs(share - intended) <= 0.05,
        `${dayType} wk${week}: delivered ${(share * 100).toFixed(0)}% against ${(intended * 100).toFixed(0)}%`);
    }
  }
});

test('no session is emptied, and none is left at every floor by accident', () => {
  for (const dayType of LIFTING) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = generate({ library: LIB, profile: atWeek(1), history: [], soreness: {},
                           dayType, seed, now: NOW });
      const work = s.blocks.filter(countsTowardVolume);
      assert.ok(work.length >= 1, `${dayType} seed ${seed}: week 1 has no working blocks`);
      for (const b of work) {
        assert.ok(b.sets >= (b.setPlan ? 2 : 1),
          `${dayType} seed ${seed} slot ${b.slot}: ${b.sets} sets is under its floor`);
        if (b.setPlan) {
          assert.equal(b.setPlan.filter(x => x.kind === 'work').length, b.sets,
            `${dayType} seed ${seed} slot ${b.slot}: setPlan disagrees with block.sets`);
        }
      }
    }
  }
});

test('full volume is unchanged, block for block', () => {
  // The ramp is the only thing this touches. A fully recovered athlete's
  // session must be what v77 built -- so it is asserted against v77 OUTPUT,
  // captured from the tree before any source edit (Tasks 1 and 2 change no
  // behaviour, so the tree still built v77 sessions at that point).
  //
  // AN EARLIER DRAFT OF THIS TEST COMPARED TWO LIVE PROFILES and was wrong
  // twice over. It compared the new code against itself, so a change that
  // moved both sides equally was invisible; and its second profile,
  // `{ returnDate: '2020-01-01' }`, is not a recovered athlete at all. `now`
  // is 1e12, which is 2001-09-09, so that date is in the FUTURE relative to
  // it, `rampWeekFor` takes its `days < 0` branch and returns week ONE. It
  // was comparing week 5 against week 1. The profile for "no ramp" is `{}`,
  // which `rampWeekFor` answers with RAMP.length by its own early return.
  const v77 = JSON.parse(
    readFileSync(new URL('./fixtures/full-volume-v77.json', import.meta.url), 'utf8')
  );
  for (const dayType of LIFTING) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = generate({ library: LIB, profile: atWeek(5), history: [], soreness: {},
                           dayType, seed, now: NOW });
      assert.deepEqual(s.blocks.map(x => [x.slot, x.sets, x.reps]),
                       v77[dayType][String(seed)],
                       `${dayType} seed ${seed} differs from v77`);
    }
  }
});

test('core and intervals are still ramped, by prescribe', () => {
  // The hole this would otherwise open: pulling the multiplier out of
  // prescribe() wholesale RAISES the work the budget does not cover.
  const core = w => {
    let n = 0, sets = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const s = generate({ library: LIB, profile: atWeek(w), history: [], soreness: {},
                           dayType: 'hypertrophy', seed, now: NOW });
      for (const b of s.blocks.filter(x => x.role === 'core')) { n++; sets += b.sets; }
    }
    return n ? sets / n : 0;
  };
  assert.ok(core(1) < core(5), `core at week 1 ${core(1)} against full ${core(5)}`);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ramp-budget.test.mjs 2>&1 | tail -30`
Expected: three failures — **'every ramp week delivers more work than the one before it'**, **'week 4 is not a free week'**, and **'a ramp week delivers the share of full volume it prints'** (max-strength week 1 measured 63% against 50% at v77). The other three should pass already — they describe behaviour that must survive the change, not behaviour being added. If 'full volume is unchanged' fails now, stop: something else is wrong.

- [ ] **Step 3: Gate the multiplier in `prescribe()`**

Replace, at `js/generator.js` ~line 738:

```js
  // Ramp trims volume before anything else touches it. basis §3.
  sets = Math.max(1, Math.round(sets * env.volumeMultiplier));
```

with:

```js
  // The ramp trims volume, but no longer one block at a time: rampToBudget
  // applies the column ONCE, to the session's working sets, because the
  // 50/30/20/10 rule is a statement about workload and `round()` on a dose of
  // 3 cannot express the column at all. basis §3, discrepancy 10.
  //
  // What the budget does not cover still scales here -- intervals, timed work,
  // core and prep. Removing this line outright would quietly RAISE that work
  // during the ramp, which is the opposite of what the table is for.
  if (!countsTowardVolume({ mode: slot.mode, role: slot.role })) {
    sets = Math.max(1, Math.round(sets * env.volumeMultiplier));
  }
```

- [ ] **Step 4: Call the budget in `generate()`**

At `js/generator.js` ~line 2088, replace:

```js
  const shaped = applyArchitecture(blocks, architecture, zoneBySlot,        // 7a
                                   env.pctCeiling);
```

with:

```js
  // 7b. BEFORE the architecture, never after -- a ladder is built out of the
  // set count, and a set removed afterwards leaves a rung dangling.
  const budgeted = rampToBudget(blocks, env.volumeMultiplier);
  const shaped = applyArchitecture(budgeted, architecture, zoneBySlot,      // 7a
                                   env.pctCeiling);
```

- [ ] **Step 5: Run the new tests and watch them pass**

Run: `node --test tests/ramp-budget.test.mjs 2>&1 | tail -20`
Expected: 14 pass, 0 fail.

- [ ] **Step 6: Run the whole suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -30`
Expected: green. **Some existing ramp-related tests may go red, and that is information, not an obstacle.** Any red test is triaged in writing before it is touched: name the test, say whether it pinned the old per-block rule (re-point it at the session-level invariant, the way the ladder test was re-pointed in v77) or whether it caught a real regression (fix the code). Never relax a test to make it pass.

- [ ] **Step 7: Commit**

```bash
git add js/generator.js tests/ramp-budget.test.mjs
git commit -m "The ramp's column lands on the session, not on each exercise

prescribe() no longer scales sets for blocks the budget covers; rampToBudget
runs between the fill loop and the architecture. Blocks outside
countsTowardVolume keep the per-block multiplier, so intervals and core do not
quietly gain work during the ramp.

Watched fail first: weeks 1-3 delivered the same session, and week 4 delivered
full volume.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: A swap stops re-rolling the set count

With the ramp out of `prescribe()`, a swapped block would come back at full dose — the same class of hole `js/generator.js:1270` already documents, where a swap in `reps` mode escaped the load ceiling entirely.

**Files:**
- Modify: `js/generator.js` — `swapBlock()` (~line 1338)
- Modify: `tests/swap.test.mjs`

**Interfaces:**
- Consumes: `countsTowardVolume` (existing)
- Produces: no new exports

- [ ] **Step 1: Write the failing test**

Append to `tests/swap.test.mjs`:

```js
test('a swap keeps the set count of the block it replaces', () => {
  // The ramp lives in the SESSION budget now, so a block rebuilt on its own
  // has no ramp in it. Inheriting the count is what keeps a swap from being an
  // exit from the ramp -- the same rule as the load ceiling at generator.js
  // :1270 -- and it also means swapping a movement can no longer change how
  // much work the session holds. Spec §4.4.
  const LIBRARY = JSON.parse(
    readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
  ).exercises;
  const NOW = 1e12;
  const profile = { returnDate: new Date(NOW - 3 * 86400e3).toISOString().slice(0, 10) };
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const session = generate({ library: LIBRARY, profile, history: [], soreness: {},
                               dayType: 'hypertrophy', seed, now: NOW });
    for (const current of session.blocks.filter(b => b.slot === 'A' || b.slot === 'B')) {
      const { block } = swapBlock(session, current.slot, LIBRARY,
                                  { profile, history: [] }, makeRng(seed + 7));
      if (!block) continue;
      assert.equal(block.sets, current.sets,
        `seed ${seed} slot ${current.slot}: ${current.sets} became ${block.sets}`);
      checked++;
    }
  }
  assert.ok(checked > 20, `only ${checked} swaps were exercised`);
});
```

If `readFileSync`, `generate`, `swapBlock` or `makeRng` are not already imported at the top of `tests/swap.test.mjs`, add them to the existing import lines rather than re-importing inside the test.

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/swap.test.mjs 2>&1 | tail -20`
Expected: FAIL — a swapped block re-rolls `intBetween(rng, slot.sets)` and differs from the block it replaced.

- [ ] **Step 3: Inherit the count**

In `swapBlock()`, after the block is built (~line 1338):

```js
  const block = isCore
    ? prescribeMobility(slot, exercise, rng)
    : prescribe(slot, exercise, env, rng, state);

  // THE SESSION'S BUDGET MUST SURVIVE A SWAP. rampToBudget applies the ramp to
  // the session once, so a block rebuilt on its own carries no ramp at all --
  // the same hole the load ceiling had before 2026-09-05, one field over. The
  // replacement inherits the count, which also means swapping a movement can
  // no longer change how much work the session holds. Spec §4.4.
  if (!isCore && countsTowardVolume(block) && countsTowardVolume(current)) {
    while (block.sets > current.sets) dropWorkingSet(block);
    if (block.sets < current.sets) block.sets = current.sets;
  }
```

`dropWorkingSet` on the way down keeps `setPlan` coherent. On the way up the plan is rebuilt by the next architecture pass and the card reads `block.sets`; a raised count with a short plan is the drift `tests/ramp.test.mjs` already guards, so if that guard goes red here, rebuild the plan rather than papering over it.

- [ ] **Step 4: Run the test and watch it pass**

Run: `node --test tests/swap.test.mjs 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js tests/swap.test.mjs
git commit -m "A swap inherits its set count, so the budget survives it

With the ramp in the session budget, a block rebuilt on its own carries no ramp
-- the same hole the load ceiling had one field over. It also ends a behaviour
nobody asked for: swapping an exercise could hand back 4 sets where there were
3, at any volume.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The measurement gate

Nothing ships on the design's probe figures. This task produces the numbers the athlete decides on, including the §4.5 question about the `rampedMinutes` damper.

**Files:**
- Modify: `tools/measure.mjs` — a seventh sweep

**Interfaces:**
- Consumes: `generate`, `countsTowardVolume`
- Produces: `node tools/measure.mjs ramp`

- [ ] **Step 1: Add the sweep**

In `tools/measure.mjs`, add to the usage block at the top:

```
//   node tools/measure.mjs ramp               what each ramp week delivers
```

and the function, beside the other six:

```js
// ramp -- spec 2026-09-17 §7. The seventh, and the one that would have caught
// the flat spot years earlier: per-BLOCK rounding made weeks 1-3 identical at a
// dose of 3, and no test looked at what a week delivered against what it
// promised.
function ramp(seeds = 3000) {
  const DAYS = ['max-strength', 'power', 'hypertrophy'];
  for (const dayType of DAYS) {
    // Every week is collected BEFORE anything is printed, because week 5 is the
    // denominator of the "vs full" column and computing it last would divide by
    // an empty cell.
    const rows = [1, 2, 3, 4, 5].map(week => {
      const profile = { returnDate: iso(Date.now() - ((week - 1) * 7 + 3) * DAY) };
      let sets = 0, ex = 0, min = 0, worst = 0, atFloor = 0;
      const bySlot = {}, nSlot = {};
      for (let seed = 1; seed <= seeds; seed++) {
        const s = generate({ library: LIB, profile, history: [], soreness: {},
                             dayType, seed, now: Date.now() });
        const work = s.blocks.filter(countsTowardVolume);
        const delivered = work.reduce((a, b) => a + b.sets, 0);
        // The signature of a floor-bound session: every covered block is at its
        // own floor, so the budget could not be reached from above. It is the
        // overshoot spec §4.3 leaves visible.
        const floors = work.reduce((a, b) => a + (b.setPlan ? 2 : 1), 0);
        if (work.length && delivered === floors) atFloor++;
        sets += delivered; ex += work.length; min += s.durationMin;
        worst = Math.max(worst, s.durationMin);
        for (const b of work) {
          bySlot[b.slot] = (bySlot[b.slot] || 0) + b.sets;
          nSlot[b.slot] = (nSlot[b.slot] || 0) + 1;
        }
      }
      const slots = Object.keys(bySlot).sort()
        .map(k => `${k}:${(bySlot[k] / nSlot[k]).toFixed(1)}`).join(' ');
      return { week, sets, ex, min, worst, atFloor, slots };
    });

    const full = rows[4].sets;
    console.log(`\n=== ${dayType} (n=${seeds} per week) ===`);
    console.log('wk  intends  sets   vs full  exercises  mean min  worst  all at floor  sets by slot');
    for (const r of rows) {
      console.log(
        `${r.week}   ${(RAMP[r.week - 1].volume * 100).toFixed(0).padStart(5)}%  ` +
        `${(r.sets / seeds).toFixed(2).padStart(5)}  ${(100 * r.sets / full).toFixed(0).padStart(6)}%  ` +
        `${(r.ex / seeds).toFixed(2).padStart(9)}  ${(r.min / seeds).toFixed(1).padStart(8)}  ` +
        `${String(r.worst).padStart(5)}  ${(100 * r.atFloor / seeds).toFixed(1).padStart(11)}%  ${r.slots}`);
    }
  }
  console.log('\nThe "vs full" column is against week 5 of the SAME sweep, so the');
  console.log('library and the templates are held constant across the comparison.');
}
```

Import `countsTowardVolume` and `RAMP` at the top of the file alongside the existing imports, and register `ramp` in the command dispatch at the bottom the same way the other six are.

Verify the "vs full" column reads exactly 100% on week 5 before trusting any other cell in the table.

- [ ] **Step 2: Run it**

Run: `node tools/measure.mjs ramp 2>&1 | tee /tmp/ramp-with-damper.txt`
Expected: five rows per day type, week 5 at 100%, and the delivered column tracking `RAMP`'s own percentages within a point or two.

- [ ] **Step 3: Measure again with the §7.4 damper removed**

In `js/generator.js`, comment out the two lines in the optional-slot branch:

```js
      // const rampedMinutes = TIME.MAIN_WORK_MAX_MIN * rampRow(state.rampWeek).volume;
      // if (estimateMinutes(blocks) >= rampedMinutes) break;
```

Run: `node tools/measure.mjs ramp 2>&1 | tee /tmp/ramp-no-damper.txt`
Then **restore the two lines** — `git checkout js/generator.js` if nothing else is uncommitted — and confirm with `git diff --stat` that nothing is left edited.

- [ ] **Step 4: Run the suite once more**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: green, with the damper restored.

- [ ] **Step 5: Put both tables to the athlete**

Report, in this order, and stop for his answer:

1. delivered sets by week and day type against `RAMP`'s column, with the damper in place
2. the same with it removed
3. mean and worst session length for both, per day type
4. exercise count per session by week, for both
5. the floor-bound overshoot rate
6. mean sets per slot, so it is visible where the cut landed

The question is exactly one: does `rampedMinutes` stay? It was decided with him on 2026-09-06 to damp a loop this change removes, so it is his to keep or drop — and the recommendation must say plainly whether the numbers support removal rather than arguing from the mechanism.

- [ ] **Step 6: Commit the sweep**

```bash
git add tools/measure.mjs
git commit -m "Keep the sweep: the ramp's delivered volume, by week

node tools/measure.mjs ramp. The seventh sweep, and the one that would have
caught the flat spot: nothing measured what a ramp week delivered against what
its own column promised.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Documentation, and the version

Only after Task 5's decision. The docs record what shipped, including the damper answer.

**Files:**
- Modify: `docs/programming-basis.md`, `docs/design-mobility-and-warmup.md`, `docs/design-architectures.md`, `README.md`, `docs/superpowers/specs/2026-09-17-ramp-set-budget-design.md`, `js/version.js`, `sw.js`

- [ ] **Step 1: `programming-basis.md` — discrepancy 10**

After discrepancy 9 (§1), in the same format: the claim, the source, the measurement, the fix. The claim is that the 50/30/20/10 rule governs workload `[verified]` and the app applied it per exercise; the measurement is the v77 table from spec §1 and the as-built table from Task 5; the fix is `rampToBudget`. Name the arithmetic explicitly — 0.834 at a dose of 3 — because that is the part a reader will not re-derive.

- [ ] **Step 2: `design-mobility-and-warmup.md` §13.4**

Change "**Not changed here**" to the fix, keeping the measured table that is already there. State which of the three options he chose (a session set budget, not a re-floored ramp and not a re-tabled one) and that the choice was his, dated 2026-09-17.

- [ ] **Step 3: `design-architectures.md` §7.4 and §7.5**

§7.4: the loop this damped no longer exists, because the fill loop now sees full-dose blocks. Record what Task 5 measured and what he decided about `rampedMinutes`. If it stays, say why the numbers justified keeping it; if it goes, say so and note that §7.4's week-4 exclusion ("the test excludes week 4 by name") is now obsolete and the test should include week 4.

§7.5: nothing here closes the "same pattern twice in one session" or "slot E is rare while ramping" items. Leave them open; if the measurement moved either number, update the number and say it moved.

- [ ] **Step 4: `README.md`**

Under "Design decisions worth knowing": the budget, in his terms — the ramp's percentage is what the session delivers, every week differs, week 4 is no longer free — plus the before/after table and the swap consequence. Under "How a session is generated", add step 7b.

- [ ] **Step 5: Fill spec §10, As built**

The measured table, the damper decision, and anything the build changed about the design. If the shipped behaviour differs from the spec in any way, §10 is where that is said plainly.

- [ ] **Step 6: Bump the version**

```bash
# js/version.js: APP_VERSION = 'v78'
# sw.js:         VERSION     = ... v78
node --test tests/version.test.mjs 2>&1 | tail -3
```
Expected: PASS. It fails the moment the two disagree.

- [ ] **Step 7: Run everything one last time**

Run: `node --test tests/*.test.mjs 2>&1 | tail -5`
Expected: green, and the count recorded in the commit message.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "The ramp delivers the column it prints (v78)

Task 6 of docs/superpowers/plans/2026-09-17-ramp-set-budget.md.

programming-basis.md discrepancy 10: the 50/30/20/10 rule governs workload and
the app applied it per exercise, where round() on a dose of 3 needs 0.834
before it returns 3. design-mobility-and-warmup.md 13.4 closed.
design-architectures.md 7.4 records what happened to the damper. README: the
budget, the before/after, and the swap consequence.

sw.js and js/version.js v77 -> v78.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Verify in a real browser, on the real subpath**

The service worker is cache-first, so a stale worker hides every edit — this has cost two sessions. Hard-reload, confirm the footer reads **v78**, generate a session on each lifting day type, and check the set counts against what the sweep predicted before telling him it is live.

---

## Self-review

**Spec coverage.** §4.1 budget → Task 2 and Task 3; §4.2 distribution → Task 2; §4.3 floors and the shared helper → Tasks 1 and 2; §4.4 swap → Task 4; §4.5 damper → Task 5; §5 what does not change → Task 3's full-volume guard and the global constraint on `RAMP`; §6 testing → Tasks 2–4, with mutation testing in Task 2 step 6; §7 gate → Task 5; §8 documentation → Task 6.

**Gap found and closed:** spec §6 test 7 ("nothing outside the budget lost its multiplier") had no session-level guard in the first draft of Task 3; it is now the fifth test in Task 3 step 1.

**Naming.** `setFloor`, `dropWorkingSet`, `rampToBudget`, `countsTowardVolume` are used identically in every task.
