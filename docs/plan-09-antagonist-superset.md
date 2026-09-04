# Antagonist Superset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `antagonist-superset` on `hypertrophy` — slice 2 of the variety engine — so two opposing lifts are paired into rounds that cost less clock time and identical training work.

**Architecture:** Blocks gain three optional fields (`group`, `groupRole`, `groupRounds`). Pairing runs as its own pipeline stage *after* `packToBudget` and *before* `orderSession`, so it can never change how much work survives a trim and can never orphan half a pair. `estimateMinutes` prices a pair once by substituting the paired rest schedule for the two straight ones; every other second it charges is unchanged. Ordering pulls `A2` to sit immediately behind `A1`.

**Tech Stack:** Vanilla ES modules, no dependencies. `node --test` with `node:assert/strict`. Data in `data/exercises.json`.

**Spec:** `docs/design-architectures.md` §3.6 (and §1 for the scope rule, §3.5 for the seeded-draw trap)

## Global Constraints

- **Zero dependencies.** No npm, no bundler, no new files in `node_modules`. `docs/README.md` states the deployed app is byte-for-byte the source.
- **A superset changes structure, never work.** `patternSets`, `cnsLoad`, every block's `sets`, `reps` and prescribed load must be identical to the straight session for the same seed. §1.
- **`sw.js` `VERSION` must be bumped on any change to a cached asset** (`js/*.js`, `style.css`, `data/*.json`, `index.html`). Currently `v33`.
- **No session may exceed 70 minutes** (`docs/spec.md` line 36). The committed sweep is 10,000 seeds × the 7 `PHASE_1_DAY_TYPES`, `now: 1e12`. Current worst is 69.
- **Preserve each file's existing line endings.** `data/exercises.json`, `js/rules.js` and `js/generator.js` are LF on disk; `core.autocrlf` is `true` and rewriting a file wholesale turns a small insert into a whole-file diff.
- **No new dose constants.** Rest, sets and reps all come from what `prescribe()` already drew. §3.6.1.
- **Every architecture rule is mutation-checked.** A guard that passes proves nothing until each rule is shown to bite, and each mutant runs in a separate `node` process.

---

### Task 1: `pairAntagonists` — the pairing rule

**Files:**
- Modify: `js/generator.js` (add `ANTAGONIST_OF` and `pairAntagonists` next to `applyArchitecture`, around line 771)
- Test: `tests/superset.test.mjs` (create)

**Interfaces:**
- Consumes: `countsTowardVolume(block)` — already exported from `js/generator.js:1043`, returns `false` for `prep`, `mobility` and `core` roles and for any mode outside `load`/`contacts`/`reps`.
- Produces: `pairAntagonists(blocks, architecture) -> Block[]`. Returns the input array unchanged (same reference) when `architecture !== 'antagonist-superset'`. Otherwise returns a NEW array of NEW block objects; paired blocks carry `group: 'S1' | 'S2' | …`, `groupRole: 'A1' | 'A2'`, and `groupRounds: number`.

- [ ] **Step 1: Write the failing tests**

Create `tests/superset.test.mjs`:

```js
// The antagonist superset. design-architectures.md §3.6.
//
// Pairing is checked against blocks built to exercise the rule rather than
// against generated sessions alone: a rule that only ever sees the pairs the
// generator happens to produce is a rule nobody has tested the edges of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairAntagonists } from '../js/generator.js';

const blk = (over = {}) => ({
  slot: 'A', role: 'primary compound', mode: 'reps',
  pattern: 'push-h', exerciseId: 'x', sets: 3, reps: 10, restSec: 90, ...over
});

test('a non-superset architecture is left exactly alone', () => {
  const blocks = [blk(), blk({ slot: 'B', pattern: 'pull-h' })];
  assert.equal(pairAntagonists(blocks, 'straight'), blocks);
  assert.equal(pairAntagonists(blocks, 'ladder'), blocks);
});

test('push-h pairs with pull-h, and push-v with pull-v', () => {
  const out = pairAntagonists(
    [blk({ pattern: 'push-h' }), blk({ slot: 'B', pattern: 'pull-h' })],
    'antagonist-superset');
  assert.equal(out[0].group, 'S1');
  assert.equal(out[0].groupRole, 'A1');
  assert.equal(out[1].group, 'S1');
  assert.equal(out[1].groupRole, 'A2');

  const vert = pairAntagonists(
    [blk({ pattern: 'push-v' }), blk({ slot: 'B', pattern: 'pull-v' })],
    'antagonist-superset');
  assert.equal(vert[0].group, 'S1');
});

test('cross-plane and squat/hinge do NOT pair -- §3.6.2 declined them', () => {
  for (const [a, b] of [['push-h', 'pull-v'], ['push-v', 'pull-h'],
                        ['squat', 'hinge'], ['push-h', 'push-h'],
                        ['lunge', 'carry']]) {
    const out = pairAntagonists(
      [blk({ pattern: a }), blk({ slot: 'B', pattern: b })],
      'antagonist-superset');
    assert.equal(out[0].group, undefined, `${a} must not pair with ${b}`);
    assert.equal(out[1].group, undefined, `${b} must not pair with ${a}`);
  }
});

test('groupRounds is the SMALLER set count, carried on both members', () => {
  const out = pairAntagonists(
    [blk({ sets: 4 }), blk({ slot: 'B', pattern: 'pull-h', sets: 2 })],
    'antagonist-superset');
  assert.equal(out[0].groupRounds, 2);
  assert.equal(out[1].groupRounds, 2);
});

test('only main work pairs -- core and mobility never do', () => {
  const out = pairAntagonists([
    blk({ role: 'core', mode: 'reps', pattern: 'push-h' }),
    blk({ slot: 'B', role: 'core', mode: 'reps', pattern: 'pull-h' })
  ], 'antagonist-superset');
  assert.equal(out[0].group, undefined);
});

test('a block joins at most one pair', () => {
  const out = pairAntagonists([
    blk({ slot: 'A', pattern: 'push-h' }),
    blk({ slot: 'B', pattern: 'pull-h' }),
    blk({ slot: 'C', pattern: 'pull-h' })
  ], 'antagonist-superset');
  assert.equal(out[0].group, 'S1');
  assert.equal(out[1].group, 'S1');
  assert.equal(out[2].group, undefined, 'C had no partner left');
});

test('two independent pairs get two group ids', () => {
  const out = pairAntagonists([
    blk({ slot: 'A', pattern: 'push-h' }),
    blk({ slot: 'B', pattern: 'pull-h' }),
    blk({ slot: 'C', pattern: 'push-v' }),
    blk({ slot: 'D', pattern: 'pull-v' })
  ], 'antagonist-superset');
  assert.deepEqual(out.map(b => b.group), ['S1', 'S1', 'S2', 'S2']);
});

test('the input blocks are not mutated', () => {
  const blocks = [blk({ pattern: 'push-h' }), blk({ slot: 'B', pattern: 'pull-h' })];
  pairAntagonists(blocks, 'antagonist-superset');
  assert.equal(blocks[0].group, undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/superset.test.mjs`
Expected: FAIL — `SyntaxError: The requested module '../js/generator.js' does not provide an export named 'pairAntagonists'`

- [ ] **Step 3: Write the implementation**

In `js/generator.js`, directly below `applyArchitecture` (after the `ladderise` helper block, around line 780):

```js
// Direct opposites in the same plane, and nothing else. Cross-plane pairs and
// squat/hinge were measured -- they would have reached 51.4% and 78.1% of
// hypertrophy sessions against this rule's 47.7% -- and DECLINED: the effect
// the source describes comes from loading the true opposing muscle, and a
// squat paired with an RDL shares more than it opposes. Widening this table is
// a training claim, not a tuning knob. design-architectures.md §3.6.2.
const ANTAGONIST_OF = Object.freeze({
  'push-h': 'pull-h', 'pull-h': 'push-h',
  'push-v': 'pull-v', 'pull-v': 'push-v'
});

// Pair opposing main-work blocks into supersets. Runs AFTER packToBudget on
// purpose: a supersetted session is shorter, so pairing first would let the
// packer keep optional blocks it would otherwise trim, and the architecture
// would silently ADD WORK -- which §1's scope rule forbids. Running after the
// packer also makes an orphaned half-pair impossible, because there is nothing
// left to drop. design-architectures.md §3.6.3.
export function pairAntagonists(blocks, architecture) {
  if (architecture !== 'antagonist-superset') return blocks;

  const out = blocks.map(b => ({ ...b }));
  // "Main work" is countsTowardVolume's line, reused rather than restated. Two
  // definitions of "the work" would drift, and the one that drifted would be
  // the one nobody was reading. §3.6.2.
  const main = out.map((b, i) => ({ b, i })).filter(({ b }) => countsTowardVolume(b));

  const taken = new Set();
  let n = 0;
  for (let a = 0; a < main.length; a++) {
    if (taken.has(main[a].i)) continue;
    for (let z = a + 1; z < main.length; z++) {
      if (taken.has(main[z].i)) continue;
      const A1 = main[a].b, A2 = main[z].b;
      if (ANTAGONIST_OF[A1.pattern] !== A2.pattern) continue;

      // The shorter block sets the round count; the longer one's remaining
      // sets run straight, after the pair. The athlete took the pairing rule
      // WITHOUT an equal-sets requirement, and this field is what pays for it.
      const group = `S${++n}`;
      const rounds = Math.min(A1.sets, A2.sets);
      A1.group = group; A1.groupRole = 'A1'; A1.groupRounds = rounds;
      A2.group = group; A2.groupRole = 'A2'; A2.groupRounds = rounds;
      taken.add(main[a].i);
      taken.add(main[z].i);
      break;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/superset.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Mutation-check the pairing rule**

Each mutant runs in its own `node` process. From the repo root:

```bash
G=js/generator.js; cp $G /tmp/g.bak
mut () { cp /tmp/g.bak $G; sed -i "$1" $G; echo -n "MUTANT: $2 -> "; node --test tests/superset.test.mjs 2>&1 | grep -E "^ℹ fail"; cp /tmp/g.bak $G; }
mut "s/'push-v': 'pull-v', 'pull-v': 'push-v'/'push-v': 'pull-v', 'pull-v': 'push-v', squat: 'hinge', hinge: 'squat'/" "squat/hinge allowed to pair"
mut "s/Math.min(A1.sets, A2.sets)/Math.max(A1.sets, A2.sets)/" "groupRounds takes the LONGER block"
mut "s/.filter((\{ b \}) => countsTowardVolume(b))/.filter(() => true)/" "core and mobility allowed to pair"
mut "s/taken.add(main\[z\].i);/;/" "a block may join two pairs"
cp /tmp/g.bak $G
```
Expected: every mutant reports `fail` ≥ 1. If any reports `fail 0`, the test for that rule is not doing its job — fix the test before continuing.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js tests/superset.test.mjs
git commit -m "Pair opposing lifts: the superset rule, not yet wired in"
```

---

### Task 2: `estimateMinutes` prices a pair once

**Files:**
- Modify: `js/generator.js:851` — extract the per-block body of `estimateMinutes` into `blockSeconds`, then add the pair branch
- Test: `tests/superset.test.mjs` (append)

**Interfaces:**
- Consumes: `pairAntagonists` from Task 1 (for the fields `group`, `groupRounds`).
- Produces: `estimateMinutes(blocks) -> number` — same signature as today. New internal helpers `blockSeconds(block) -> number` (seconds) and `pairSeconds(a, b) -> number` (seconds), neither exported.

**Why the arithmetic is a substitution, not a rewrite:** a superset changes *only* the rest schedule. Every working rep, every warm-up rung and both transitions are performed exactly as in the straight session. So the pair's cost is both blocks' straight cost, minus the rest they would each have taken, plus the rest the paired schedule actually takes. Pricing it any other way would risk changing what the time model thinks the *work* costs.

- [ ] **Step 1: Write the failing tests**

Append to `tests/superset.test.mjs`:

```js
import { estimateMinutes } from '../js/generator.js';

// Same two blocks, paired and unpaired. Everything except rest is identical,
// so the difference must be exactly the rest arithmetic in §3.6.3.
const A1 = { slot: 'A', role: 'primary compound', mode: 'reps', pattern: 'push-h',
             exerciseId: 'a', sets: 3, reps: 10, restSec: 90 };
const A2 = { slot: 'B', role: 'accessory', mode: 'reps', pattern: 'pull-h',
             exerciseId: 'b', sets: 3, reps: 10, restSec: 60 };

test('pairing removes one rest per round and keeps every second of work', () => {
  const straight = estimateMinutes([A1, A2]);
  const paired = estimateMinutes([
    { ...A1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...A2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  // straight rest: 3x90 + 3x60 = 450 s. paired rest: 3 x max(90,60) = 270 s.
  // Difference is exactly 180 s = 3 min.
  assert.equal(straight - paired, 3);
});

test('the round rest is the LONGER of the two, never the shorter', () => {
  const paired = estimateMinutes([
    { ...A1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...A2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  const ifShorter = estimateMinutes([
    { ...A1, restSec: 60, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...A2, restSec: 60, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  assert.ok(paired > ifShorter,
    'taking the shorter rest would invent a recovery saving the source does not describe');
});

test('unequal sets: only the common rounds are paired, the tail runs straight', () => {
  const four = { ...A1, sets: 4 };
  const two = { ...A2, sets: 2 };
  const straight = estimateMinutes([four, two]);
  const paired = estimateMinutes([
    { ...four, group: 'S1', groupRole: 'A1', groupRounds: 2 },
    { ...two, group: 'S1', groupRole: 'A2', groupRounds: 2 }
  ]);
  // straight rest: 4x90 + 2x60 = 480. paired: 2x90 (rounds) + 2x90 (A1 tail)
  // + 0 (A2 has no tail) = 360. Difference 120 s = 2 min.
  assert.equal(straight - paired, 2);
});

test('a pair is priced once, not once per member', () => {
  // Two blocks sharing a group id must not each charge a full pair.
  const paired = estimateMinutes([
    { ...A1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...A2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  const single = estimateMinutes([A1]);
  assert.ok(paired < single * 2 + 5, `pair priced at ${paired} min looks doubled`);
});

test('an unpaired block is priced exactly as it was before', () => {
  assert.equal(estimateMinutes([A1]), estimateMinutes([{ ...A1, group: undefined }]));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/superset.test.mjs`
Expected: FAIL — the first test reports a difference of `0`, because `estimateMinutes` still charges both blocks their own rest and ignores `group`.

- [ ] **Step 3: Refactor `estimateMinutes` and add the pair branch**

Replace the whole of `export function estimateMinutes(blocks) { … }` at `js/generator.js:851` with:

```js
// The rest a block takes between its own sets. Only main-work modes pair, and
// those are the modes that fall through to the DEFAULT_REST_SEC branch below,
// so this matches what blockSeconds would otherwise have charged.
const restOf = b => (b.restSec || TIME.DEFAULT_REST_SEC);

// One block's cost in seconds. This is the body estimateMinutes always had --
// extracted unchanged so a pair can be priced against it rather than beside it.
function blockSeconds(b) {
  let sec = 0;
  if (b.mode === 'time') return (b.durationMin || 0) * 60;
  // An interval's work is its work seconds, not reps x SECONDS_PER_REP.
  // Falling through to the generic branch below priced eight 90 s efforts
  // at 24 seconds, so packToBudget never saw a session it should trim.
  if (b.mode === 'interval') {
    return b.sets * (b.workSec + (b.restSec || 0)) + transitionSec(b);
  }

  const sides = b.perSide ? 2 : 1;

  if (b.mode === 'drill') {
    return b.sets * b.reps * TIME.SECONDS_PER_REP * sides + transitionSec(b);
  }
  if (b.mode === 'hold') {
    return b.sets * b.holdSec * sides
      + b.sets * (b.restSec || 0)
      + transitionSec(b);
  }

  // A ladder's working sets are not identical, so sets x reps overstates it:
  // 4-3-2 / 4-3-2 is 18 reps where six sets of four would be 24. Price the
  // work from the plan whenever there is one. design-architectures 3.3.
  const planned = (b.setPlan || []).filter(s => s.kind === 'work');
  const workReps = planned.length
    ? planned.reduce((a, s) => a + s.reps, 0)
    : b.sets * b.reps;
  sec += workReps * TIME.SECONDS_PER_REP * sides;
  sec += b.sets * restOf(b);
  // The ramp is real time on the clock. Its sets are short and its rests
  // shorter, but four warm-up sets before a heavy squat is minutes, and the
  // budget has to see them or packToBudget trims the wrong thing.
  for (const s of (b.setPlan || [])) {
    if (s.kind !== 'warmup') continue;
    sec += s.reps * TIME.SECONDS_PER_REP * sides;
    sec += TIME.WARMUP_REST_SEC;
  }
  sec += transitionSec(b);
  return sec;
}

// A superset changes ONLY the rest schedule: every working rep, every warm-up
// rung and both transitions happen exactly as they would straight. So the pair
// costs what the two blocks cost, minus the rest they would each have taken,
// plus the rest the paired schedule actually takes. Pricing it as a fresh sum
// would put the WORK estimate at risk for no gain. design-architectures 3.6.3.
function pairSeconds(a, b) {
  const R = a.groupRounds;
  const straightRest = a.sets * restOf(a) + b.sets * restOf(b);
  const pairedRest = R * Math.max(restOf(a), restOf(b))
    + (a.sets - R) * restOf(a)
    + (b.sets - R) * restOf(b);
  return blockSeconds(a) + blockSeconds(b) - straightRest + pairedRest;
}

export function estimateMinutes(blocks) {
  let sec = 0;
  const priced = new Set();
  for (const b of blocks) {
    if (b.group) {
      if (priced.has(b.group)) continue;           // its partner already paid
      const partner = blocks.find(x => x !== b && x.group === b.group);
      if (partner) {
        priced.add(b.group);
        sec += pairSeconds(b, partner);
        continue;
      }
      // A group with one member is a bug elsewhere, not a reason to misprice
      // it here: fall through and charge it as the straight block it is.
    }
    sec += blockSeconds(b);
  }
  return Math.round(sec / 60);
}
```

- [ ] **Step 4: Run the full suite**

Run: `node --test tests/*.test.mjs`
Expected: PASS. The refactor must not move a single existing number — `estimateMinutes` is what `packToBudget` and `packCooldown` trim against, so any drift here shows up as changed session durations across the whole suite. If any duration test fails, the extraction was not faithful; diff `blockSeconds` against the original body before changing anything else.

- [ ] **Step 5: Mutation-check the pricing rule**

```bash
G=js/generator.js; cp $G /tmp/g.bak
mut () { cp /tmp/g.bak $G; sed -i "$1" $G; echo -n "MUTANT: $2 -> "; node --test tests/superset.test.mjs 2>&1 | grep -E "^ℹ fail"; cp /tmp/g.bak $G; }
mut "s/R \* Math.max(restOf(a), restOf(b))/R * Math.min(restOf(a), restOf(b))/" "round rest takes the shorter"
mut "s/if (priced.has(b.group)) continue;/if (false) continue;/" "pair priced twice"
mut "s/+ (a.sets - R) \* restOf(a)/+ 0/" "unequal-set tail charged no rest"
cp /tmp/g.bak $G
```
Expected: every mutant reports `fail` ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js tests/superset.test.mjs
git commit -m "Price a superset once: rest substituted, work untouched"
```

---

### Task 3: Ordering puts A1 immediately before A2

**Files:**
- Modify: `js/generator.js` — add `groupAdjacent` beside `orderSession` (around line 800)
- Test: `tests/superset.test.mjs` (append)

**Interfaces:**
- Consumes: blocks carrying `group` / `groupRole` from Task 1.
- Produces: `groupAdjacent(blocks) -> Block[]` — exported. A stable reordering that moves each `A2` to sit directly after its `A1`. Blocks without a `group` keep their relative order.

- [ ] **Step 1: Write the failing tests**

Append to `tests/superset.test.mjs`:

```js
import { groupAdjacent } from '../js/generator.js';

const g = (slot, role) => ({ slot, exerciseId: slot, group: role ? 'S1' : undefined, groupRole: role });

test('A2 is pulled up to sit immediately after A1', () => {
  const out = groupAdjacent([g('A', 'A1'), g('B'), g('C', 'A2'), g('D')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'C', 'B', 'D']);
});

test('A1 leads even when A2 came first in the ordering', () => {
  const out = groupAdjacent([g('C', 'A2'), g('B'), g('A', 'A1')]);
  assert.deepEqual(out.map(b => b.slot), ['B', 'A', 'C']);
});

test('ungrouped blocks keep their order', () => {
  const out = groupAdjacent([g('A'), g('B'), g('C')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'B', 'C']);
});

test('every block survives, exactly once', () => {
  const input = [g('A', 'A1'), g('B'), g('C', 'A2'), g('D')];
  const out = groupAdjacent(input);
  assert.equal(out.length, input.length);
  assert.equal(new Set(out).size, input.length);
});

test('a half-pair is passed through rather than dropped', () => {
  const out = groupAdjacent([g('A', 'A1'), g('B')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'B']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/superset.test.mjs`
Expected: FAIL — `does not provide an export named 'groupAdjacent'`

- [ ] **Step 3: Write the implementation**

Add directly below `orderSession` in `js/generator.js`:

```js
// A superset is two blocks the athlete alternates between, so they have to be
// next to each other on the card -- reading "bench, lunge, row" and being told
// bench and row are one unit is worse than not pairing them at all. Applied
// AFTER orderSession rather than inside it: orderSession sorts by session
// zone, which is a statement about where work belongs in a session, and
// adjacency is a statement about one pair. Folding the second into the first
// would make every future ordering change reason about groups.
// design-architectures.md §3.6.4.
export function groupAdjacent(blocks) {
  const out = [];
  const placed = new Set();
  for (const b of blocks) {
    if (placed.has(b)) continue;
    // Leave an A2 where it is until its A1 has been placed -- A1 pulls it.
    if (b.group && b.groupRole === 'A2') {
      const lead = blocks.find(x => x.group === b.group && x.groupRole === 'A1');
      if (lead && !placed.has(lead)) continue;
    }
    out.push(b);
    placed.add(b);
    if (b.group && b.groupRole === 'A1') {
      const partner = blocks.find(x => x.group === b.group && x.groupRole === 'A2');
      if (partner && !placed.has(partner)) {
        out.push(partner);
        placed.add(partner);
      }
    }
  }
  // Anything skipped above whose lead never arrived. Unreachable while pairs
  // are well formed; a dropped block would be a silent lost exercise, so this
  // catches it rather than trusting the loop.
  for (const b of blocks) if (!placed.has(b)) out.push(b);
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/superset.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/superset.test.mjs
git commit -m "Put a superset's two halves next to each other on the card"
```

---

### Task 4: Wire the stage into `generate()` and turn the architecture on

**Files:**
- Modify: `js/templates.js:129` — add `'antagonist-superset'` to `BUILT_ARCHITECTURES`
- Modify: `js/generator.js:1472-1480` — insert the pairing stage and wrap `orderSession`
- Modify: `sw.js:18` — bump `VERSION` to `v34`
- Test: `tests/superset.test.mjs` (append)

**Interfaces:**
- Consumes: `pairAntagonists` (Task 1), `groupAdjacent` (Task 3).
- Produces: sessions whose `dayType === 'hypertrophy'` may carry `architecture: 'antagonist-superset'` and grouped blocks.

**Expect this task to change every hypertrophy session.** With two built architectures, `chooseArchitecture` now calls `pick()` for hypertrophy where it previously returned early, and that draw re-rolls every later choice in the session. This is §3.5's finding and it is the unavoidable price of building an architecture. It is why Task 5 exists.

- [ ] **Step 1: Write the failing tests**

Append to `tests/superset.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const hyper = seed => generate({ library: LIB, dayType: 'hypertrophy', seed, now: 1e12 });

test('supersets actually reach real sessions', () => {
  let supersetted = 0;
  for (let seed = 1; seed <= 500; seed++) {
    if (hyper(seed).blocks.some(b => b.group)) supersetted++;
  }
  assert.ok(supersetted > 0, 'no session in 500 carried a superset');
});

test('every pair in a real session is a legal antagonist pair', () => {
  const OK = { 'push-h': 'pull-h', 'pull-h': 'push-h', 'push-v': 'pull-v', 'pull-v': 'push-v' };
  for (let seed = 1; seed <= 500; seed++) {
    const blocks = hyper(seed).blocks.filter(b => b.group);
    const byGroup = {};
    for (const b of blocks) (byGroup[b.group] = byGroup[b.group] || []).push(b);
    for (const [id, pair] of Object.entries(byGroup)) {
      assert.equal(pair.length, 2, `seed ${seed} group ${id} has ${pair.length} members`);
      const [a, b] = pair;
      assert.equal(OK[a.pattern], b.pattern, `seed ${seed}: ${a.pattern} + ${b.pattern}`);
      assert.equal(a.groupRounds, b.groupRounds, `seed ${seed}: rounds disagree`);
      assert.equal(a.groupRounds, Math.min(a.sets, b.sets), `seed ${seed}: wrong rounds`);
    }
  }
});

test('A1 sits immediately before A2 in the ordered session', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const blocks = hyper(seed).blocks;
    blocks.forEach((b, i) => {
      if (b.groupRole !== 'A1') return;
      const next = blocks[i + 1];
      assert.ok(next && next.group === b.group && next.groupRole === 'A2',
        `seed ${seed}: ${b.slot} is not followed by its partner`);
    });
  }
});

test('no day type other than hypertrophy is ever supersetted', () => {
  for (const dayType of PHASE_1_DAY_TYPES) {
    if (dayType === 'hypertrophy') continue;
    for (let seed = 1; seed <= 200; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      assert.ok(!s.blocks.some(b => b.group), `${dayType}/${seed} carried a group`);
    }
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/superset.test.mjs`
Expected: FAIL on "supersets actually reach real sessions" — `antagonist-superset` is not in `BUILT_ARCHITECTURES`, so no session can carry one.

- [ ] **Step 3: Turn the architecture on and wire the stage**

In `js/templates.js`, replace line 129:

```js
export const BUILT_ARCHITECTURES = Object.freeze(['straight', 'ladder', 'antagonist-superset']);
```

In `js/generator.js`, replace the pipeline lines at 1472-1480:

```js
  const shaped = applyArchitecture(blocks, architecture, zoneBySlot);   // 7a
  const packed = packToBudget(shaped, TIME.MAIN_WORK_MAX_MIN,           // 8
                              { dayType: chosen, state });
  // 8b. AFTER the packer, never before -- see design-architectures.md §3.6.3.
  // Pairing first would shorten the estimate the packer trims against, so a
  // superset would quietly buy back optional blocks and change the work.
  const paired = pairAntagonists(packed.blocks, architecture);
  const prep = buildPrep(chosen, library, ctx, rng, env);               // 9a
  const cooled = packCooldown(
    buildCooldown(chosen, library, ctx, rng, env)                        // 9b
  );
  const ordered = groupAdjacent(orderSession(                            // 10
    prep.concat(paired, cooled.blocks), zoneBySlot
  ));
```

In `sw.js`, line 18: `const VERSION = 'v34';`

- [ ] **Step 4: Run the full suite**

Run: `node --test tests/*.test.mjs`
Expected: the four new tests PASS. **Existing hypertrophy assertions may now fail** because every hypertrophy session was re-rolled. Read each failure before touching it: a failure that says "this hypertrophy session is now different" is expected and the test should be re-pinned to the new value with a comment saying why; a failure that says a duration, a volume total or a pattern count moved is NOT expected and means a real defect. Do not re-pin a duration failure — that is Task 5's job.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js js/templates.js sw.js tests/superset.test.mjs
git commit -m "Turn the superset on for hypertrophy (v34)"
```

---

### Task 5: Prove the work did not change, and re-sweep the ceiling

**Files:**
- Test: `tests/superset.test.mjs` (append)
- Modify: `js/rules.js` — ONLY if the sweep demands it (see Step 4)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: no new exports. This task is the evidence that §3.6.4's guarantees hold.

**This is the task the whole design rests on.** Everything before it makes supersets happen; this one proves they changed the clock and nothing else.

- [ ] **Step 1: Write the equivalence tests**

Append to `tests/superset.test.mjs`:

```js
import { countsTowardVolume } from '../js/generator.js';

// The straight counterpart of a supersetted session: the same blocks with the
// grouping stripped. If the architecture changed anything but rest and order,
// it shows up here.
const unpaired = blocks =>
  blocks.map(({ group, groupRole, groupRounds, ...rest }) => rest);

test('a superset changes rest and order -- never sets, reps or load', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;
    for (const b of s.blocks.filter(x => x.group)) {
      assert.ok(b.sets > 0 && b.groupRounds <= b.sets,
        `seed ${seed}: ${b.slot} rounds ${b.groupRounds} exceed sets ${b.sets}`);
    }
  }
});

test('a supersetted session is never LONGER than the same blocks unpaired', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;
    assert.ok(estimateMinutes(s.blocks) <= estimateMinutes(unpaired(s.blocks)),
      `seed ${seed}: pairing made the session longer`);
  }
});

test('patternSets counts a paired block exactly as it counts a straight one', () => {
  // The claim in §3.6.4 is that finalise() cannot see the pairing. The way to
  // check it is to recompute patternSets from the blocks WITHOUT the group
  // fields and require the same answer -- if finalise ever started reading
  // `group`, these two would part company.
  for (let seed = 1; seed <= 300; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;

    const recomputed = {};
    for (const b of unpaired(s.blocks)) {
      if (!countsTowardVolume(b)) continue;
      recomputed[b.pattern] = (recomputed[b.pattern] || 0) + b.sets;
    }
    assert.deepEqual(s.patternSets, recomputed,
      `seed ${seed}: patternSets disagrees with the unpaired blocks`);
  }
});

test('a paired block still counts toward volume at all', () => {
  // The cheap way to break the test above is for grouped blocks to stop
  // counting on BOTH sides, which would leave it comparing zero to zero.
  let checked = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const b of hyper(seed).blocks.filter(x => x.group)) {
      assert.ok(countsTowardVolume(b), `a grouped block stopped counting`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no grouped block was ever checked');
});
```

- [ ] **Step 1b: Write the swap test**

The design leans on swap working untouched, because the athlete's answer to
"a superset means holding two stations" was that he would swap the movement
when the gym is busy. That path has to be asserted, not assumed. Append:

```js
import { swapBlock } from '../js/generator.js';
import { makeRng } from '../js/generator.js';

test('swapping half a superset keeps the pair antagonist', () => {
  const OK = { 'push-h': 'pull-h', 'pull-h': 'push-h', 'push-v': 'pull-v', 'pull-v': 'push-v' };
  let checked = 0;
  for (let seed = 1; seed <= 300 && checked < 20; seed++) {
    const s = hyper(seed);
    const a1 = s.blocks.find(b => b.groupRole === 'A1');
    if (!a1) continue;
    const a2 = s.blocks.find(b => b.group === a1.group && b.groupRole === 'A2');

    const { block } = swapBlock(s, a1.slot, LIB, {}, makeRng(seed));
    if (!block) continue;                       // pool exhausted; not this test
    assert.equal(block.pattern, a1.pattern,
      `seed ${seed}: swap changed the pattern, so the pair is no longer antagonist`);
    assert.equal(OK[block.pattern], a2.pattern,
      `seed ${seed}: the pair stopped being antagonist after a swap`);
    checked++;
  }
  assert.ok(checked > 0, 'no superset was ever swapped');
});
```

- [ ] **Step 2: Run them**

Run: `node --test tests/superset.test.mjs`
Expected: PASS. A failure on "never LONGER" means `pairSeconds` is wrong — check the sign of the rest substitution before anything else. A failure on the swap test is more serious: it would mean `swapBlock`'s pattern narrowing does not hold, and the design's claim that swap needs no new machinery is wrong. Stop and report rather than widening the test.

- [ ] **Step 3: Run the committed duration sweep**

Run: `node --test tests/session.test.mjs`
Expected: both `duration sweep (10000 seeds x day type)` and `no generated session exceeds the athlete's stated 70-minute session limit` PASS.

- [ ] **Step 4: If — and only if — the sweep fails**

The re-roll in Task 4 reshuffles which seeds land in the duration tail, exactly as growing the core pool did on 2026-09-04. If the worst session now exceeds 69:

1. Record the new worst: day type, seed, and the prep/main/cool-down split.
2. **Do not widen `FLOOR_OVERRUN_ALLOWANCE_MIN`.** Its comment says why: it may only move to match a measurement, never to make room for one.
3. Supersets only ever shorten sessions, so a hypertrophy overrun would be surprising and is worth understanding before it is fixed. An overrun on a NON-hypertrophy day type would mean the change leaked past its day type — that is a defect in Task 4, not a budget question.
4. Report the numbers and stop. Lowering `MAIN_WORK_MAX_MIN` again is the athlete's call and costs him working sets; it is not a decision to take inside a task.

- [ ] **Step 5: Commit**

```bash
git add tests/superset.test.mjs
git commit -m "Prove the superset moved the clock and nothing else"
```

---

### Task 6: The card says it is a superset

**Files:**
- Modify: `js/ui.js` — add `supersetLine` next to `workLine` (around line 184), and call it in `blockCard` (line 218)
- Modify: `style.css` — a `.superset` rule
- Modify: `sw.js` — `VERSION` to `v35`
- Test: `tests/ui.test.mjs` (append)

**Interfaces:**
- Consumes: `group`, `groupRole`, `groupRounds` on blocks.
- Produces: `supersetLine(block) -> string` — exported from `js/ui.js`. Returns `''` for an ungrouped block.

**Deviation from the design worth noting:** §3.6.4 says the pair renders "adjacent under one Superset heading". Adjacency is already guaranteed by Task 3, and a per-card label carries the round count without restructuring `blockGroup`'s section/list DOM — which every other block type depends on. If the label reads badly on the real device, the heading version is the follow-up, not a rewrite.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui.test.mjs`:

```js
import { supersetLine } from '../js/ui.js';

test('an ungrouped block says nothing about supersets', () => {
  assert.equal(supersetLine({ slot: 'A', sets: 3 }), '');
});

test('the first half names the pairing and the round count', () => {
  const line = supersetLine({ group: 'S1', groupRole: 'A1', groupRounds: 3, sets: 3 });
  assert.match(line, /superset/i);
  assert.match(line, /3/);
});

test('a block with sets left over says so, because the card must not lie', () => {
  const line = supersetLine({ group: 'S1', groupRole: 'A1', groupRounds: 2, sets: 4 });
  assert.match(line, /2/);
  // 4 sets, 2 of them paired -- the remaining 2 are performed alone and the
  // card has to say that or he will superset all four.
  assert.match(line, /then|alone|remaining/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/ui.test.mjs`
Expected: FAIL — `does not provide an export named 'supersetLine'`

- [ ] **Step 3: Implement**

In `js/ui.js`, below `workLine`:

```js
// A paired block has to say so, and has to say how many of its sets are
// actually paired -- a block with 4 sets in a 2-round pair performs 2 of them
// alongside its partner and 2 alone. Printing only "superset" would instruct
// four rounds of a pair whose other half has two sets. design-architectures
// §3.6.2.
export function supersetLine(block) {
  if (!block.group) return '';
  const label = block.groupRole === 'A1' ? 'superset A1' : 'superset A2';
  const left = block.sets - block.groupRounds;
  return left > 0
    ? `${label} · ${block.groupRounds} rounds paired, then ${left} alone`
    : `${label} · ${block.groupRounds} rounds`;
}
```

In `blockCard`, add the call beside the other line builders at the top of the
function (they sit together around line 219):

```js
  const superset = supersetLine(block);
```

Then add the element to the front face, immediately ABOVE the `work` line --
which pairing a block with is the first thing he needs to know, before which
sets carry which load:

```js
    superset
      ? el('p', { class: 'block-meta block-superset', text: superset })
      : null,
    // Above the warm-up line, because it is what he does after it.
    work
      ? el('p', { class: 'block-meta block-work', text: work })
      : null,
```

And mark the card itself, so the CSS can join the pair visually. The returned
element at the end of `blockCard` is currently:

```js
  return el('li', { class: 'block has-cues' }, [btn, swap]);
```

Change it to:

```js
  return el('li', { class: block.group ? 'block has-cues superset' : 'block has-cues' },
    [btn, swap]);
```

In `style.css`, add:

```css
/* The two halves of a superset read as one unit: a shared left edge is enough
   to group them without a heading that would break the block list's rhythm. */
.block.superset { border-left: 3px solid var(--accent); }
```

Bump `sw.js` `VERSION` to `v35`.

- [ ] **Step 4: Run the full suite**

Run: `node --test tests/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js style.css sw.js tests/ui.test.mjs
git commit -m "Say it on the card: which sets are paired, and which are not (v35)"
```

---

### Task 7: Close the documentation

**Files:**
- Modify: `docs/design-architectures.md` — §4 build order, mark slice 2 BUILT
- Modify: `README.md` — the variety-engine paragraph
- Test: none (documentation)

- [ ] **Step 1: Update the build order**

In `docs/design-architectures.md` §4, change item 2 from `DESIGNED 2026-09-04, §3.6.` to `BUILT <date> (v35), §3.6.` and record the measured firing rate — run this to get it:

```bash
node -e "
import('./js/generator.js').then(async ({generate})=>{
  const fs=await import('node:fs');
  const LIB=JSON.parse(fs.readFileSync('./data/exercises.json','utf8')).exercises;
  let n=0; for(let s=1;s<=10000;s++) if(generate({library:LIB,dayType:'hypertrophy',seed:s,now:1e12}).blocks.some(b=>b.group)) n++;
  console.log('supersetted:', (n/100).toFixed(1)+'%');
});"
```

Record the real number, not the 47.7% the design predicted — the predicted figure was measured before the architecture existed and before the re-roll, and the difference between prediction and outcome is worth keeping.

- [ ] **Step 2: Update the README**

In `README.md`, in the section added on 2026-09-04 about the variety engine, add one paragraph: what a superset is, that it changes rest and order only, the measured firing rate, and the `[corroborated]` source with its one-study weakness.

- [ ] **Step 3: Run the full suite one last time**

Run: `node --test tests/*.test.mjs`
Expected: PASS, all tests.

- [ ] **Step 4: Commit and push**

```bash
git add docs/design-architectures.md README.md
git commit -m "Record what the superset actually does, measured"
git push origin main
```

---

## Notes for whoever executes this

- **`git status` must be clean between tasks.** The athlete ends sessions abruptly; every task boundary is a place the work might be picked up by someone with no memory of it.
- **A mutation that does not build proves nothing.** If a mutant reports `fail 0`, check the fixture reaches the branch under test before concluding the rule is untested — that exact mistake has now been made twice in this repository.
- **Never re-pin a duration assertion to make it pass.** Durations are the one number in this project tied to something the athlete said out loud.
