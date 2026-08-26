# Running Programming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `aerobic-steady` running template with four correctly-pooled running day types — easy run, intervals, sprint, plyometric — each opening with a four-stage prep block, and make the app propose them from accumulated lifting load.

**Architecture:** The `sprint` and `locomotion` pattern buckets each hold several unrelated movement families, which is why a slot filtering on them can select a backward walk as a steady run. Task 2 splits them into six honest buckets and adds an `effortClass` discriminator. Tasks 3-7 build the prep block and the four templates on the corrected pools. Task 8 adds a chronic 28-day load term that boosts low- and moderate-CNS running days as lifting accumulates, extending the existing 72-hour CNS account rather than replacing it.

**Tech Stack:** Vanilla ES modules, no build step, no npm, no dependencies. `node --test` for tests. All data in `data/exercises.json`.

**Spec:** `docs/design-running-programming.md`

## Global Constraints

- **Zero dependencies.** No npm, no build step, no new runtime imports beyond `node:` builtins in tests. Any task adding a package is wrong.
- **Test command is `node --test "tests/*.test.mjs"`.** The bare `node --test tests/` form fails on this repo. Baseline at plan time: **91 passing, 0 failing.** Every task ends green.
- **Units are kg**, display-only; loads stay percentages of a PR the user holds in his head.
- **Terrain-agnostic prescriptions** (spec 9.1): running is prescribed as time, effort, or interval structure — never pace, and never distance except the 20-40 m accelerations that are pace-able by eye.
- **Every number carries a provenance tag** in a code comment: `[verified]`, `[corroborated]`, or `[unverified]`. A number with no tag is a defect. Follow the style already in `js/rules.js`.
- **No cue or coefficient changes.** All 235 existing cues and every `prCoef` survive this plan untouched. A task that edits one is wrong.
- **Commit style:** imperative subject describing the behaviour change, body explaining why. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Branch:** `mobility-split`. Do not push unless the user asks.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `data/exercises.json` | 35 `pattern` edits, 8 `effortClass` additions, 3 `modalities` cleanups, 1 new entry | 2, 4 |
| `js/rules.js` | New chronic-load constants; provenance comments | 1, 8 |
| `js/templates.js` | `PREP_BLOCK.running`, four running templates | 5, 6, 7 |
| `js/generator.js` | `joints` filter, `mode: 'interval'`, metreage check, `orderClass`, `chronicBoost`, 3 state fields | 2, 3, 6, 8 |
| `js/ui.js` | `interval` branches in `loadLine` and `volumeLine` | 6 |
| `tests/taxonomy.test.mjs` | **New.** Asserts no pattern bucket mixes movement families | 2, 4 |
| `tests/running.test.mjs` | **New.** Asserts the four templates and the prep block behave | 5, 7 |
| `tests/load-coupling.test.mjs` | **New.** Asserts `chronicBoost` properties | 8 |
| `tests/coverage.test.mjs` | Pool keys renamed; `poolKey` extended | 2, 5, 9 |
| `tests/cue-guard.mjs` | Hardcoded pattern list extended | 2 |

---

## Task 1: Source the unverified numbers

The spec's §10 lists numbers that are not yet read off a source. Project convention is that every number in `js/rules.js` carries provenance, and this task supplies it **before** any of them is written into code. Tasks 5, 6, 7 and 8 are blocked on its output.

This task writes documentation only — no code, no tests.

**Files:**
- Modify: `docs/design-running-programming.md` (§10)

**Interfaces:**
- Consumes: nothing.
- Produces: a decided value and a provenance tag for each of: `PREP_INTEGRATE_COUNT`, `PREP_POTENTIATE_COUNT`, `BUILDUP_PCT_INTERVAL`, `BUILDUP_PCT_SPRINT`, `INTERVAL_WORK_SEC`, `INTERVAL_REST_RATIO`, `CHRONIC_WINDOW_DAYS`, `GYM_SHARE_TRIGGER`, `WEEKS_TRIGGER`, `CHRONIC_BOOST_MAX`. Tasks 5-8 copy these values verbatim.

- [ ] **Step 1: Research each open number**

For each of the ten constants above, find a source. Acceptable evidence, in descending order of strength:
- A named position stand or textbook guideline (NSCA, ACSM) → tag `[verified]`
- Two or more independent secondary sources agreeing → tag `[corroborated]`
- No source found → tag `[unverified]` and record *why* it is still the chosen value

Do not invent a citation. `[unverified]` with an honest rationale is a correct outcome and is used elsewhere in this codebase (`js/rules.js:267`).

- [ ] **Step 2: Record the results in the design doc**

Rewrite §10's second list as a table with columns: constant, value, tag, source. Every one of the ten constants appears exactly once.

- [ ] **Step 3: Commit**

```bash
git add docs/design-running-programming.md
git commit -m "Source the running programming constants

Every number in rules.js carries provenance. These ten did not yet.
Each now has a decided value and a tag; the ones that stayed
[unverified] say why they are still the right choice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Split the pattern buckets

This is one atomic task. Splitting it leaves the suite red: changing `data/exercises.json` without changing the template that filters on it starves the `aerobic-steady` slot, and `generate` warns `no eligible exercise for slot A`.

**Files:**
- Create: `tests/taxonomy.test.mjs`
- Modify: `data/exercises.json` (35 `pattern` values, 8 `effortClass` additions, 3 `modalities` cleanups)
- Modify: `js/generator.js:587-602` (`orderClass`)
- Modify: `js/templates.js:174-192` (`AEROBIC_STEADY` slot patterns, so the app still runs)
- Modify: `tests/cue-guard.mjs:18` (hardcoded pattern list)
- Modify: `tests/coverage.test.mjs:52-72` (`FLOOR_EXEMPT` and `CLOSED_POOLS` keys)

**Interfaces:**
- Consumes: nothing.
- Produces: patterns `sprint`, `sprint-drill`, `agility`, `run`, `erg`, `march`; field `effortClass` with values `'submaximal' | 'maximal'` on the 8 `sprint`-pattern entries. Tasks 5 and 7 filter on these exact strings.

- [ ] **Step 1: Write the failing test**

Create `tests/taxonomy.test.mjs`:

```javascript
// The taxonomy guard. A pattern is a movement family; a bucket holding two
// families is how a backward walk became a 20-minute steady run.
// design-running-programming.md §4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const byId = Object.fromEntries(LIB.map(e => [e.id, e]));
const idsWithPattern = p => LIB.filter(e => e.pattern === p).map(e => e.id).sort();

test('the sprint bucket holds only maximal-effort running', () => {
  assert.deepEqual(idsWithPattern('sprint'), [
    'acceleration-sprint', 'build-up-run', 'falling-start', 'flying-run',
    'hill-sprint', 'resisted-sprint', 'sled-push', 'three-point-start'
  ]);
});

test('technique drills are their own family', () => {
  assert.deepEqual(idsWithPattern('sprint-drill'), [
    'a-march', 'a-skip', 'ankling', 'b-skip', 'fast-leg-drill',
    'high-knees', 'power-skip', 'straight-leg-bound', 'wall-drill'
  ]);
});

test('multidirectional prep is its own family', () => {
  assert.deepEqual(idsWithPattern('agility'),
    ['backpedal', 'carioca', 'lateral-shuffle']);
});

test('the run bucket holds only unloaded running on feet', () => {
  assert.deepEqual(idsWithPattern('run'), [
    'easy-run', 'fartlek', 'run-interval', 'shuttle-run', 'stair-run',
    'tempo-run', 'trail-run'
  ]);
});

test('ergometers and marches are not runs', () => {
  assert.deepEqual(idsWithPattern('erg'), ['assault-bike', 'rower']);
  assert.deepEqual(idsWithPattern('march'), [
    'backward-walk', 'incline-walk', 'ruck-march', 'sled-drag', 'sled-march'
  ]);
});

test('jump-rope is a jump, not a run', () => {
  assert.equal(byId['jump-rope'].pattern, 'jump');
});

test('every sprint entry declares an effort class', () => {
  for (const e of LIB.filter(x => x.pattern === 'sprint')) {
    assert.ok(['submaximal', 'maximal'].includes(e.effortClass),
      `${e.id} has effortClass ${JSON.stringify(e.effortClass)}`);
  }
});

test('build-up run is the only submaximal sprint', () => {
  const sub = LIB.filter(e => e.effortClass === 'submaximal').map(e => e.id);
  assert.deepEqual(sub, ['build-up-run']);
});

test('interval work no longer claims to be steady-state', () => {
  // A prescribed easy run coming back as a fartlek was the second instance
  // of the bucket-conflation bug. design §4.5.
  for (const id of ['tempo-run', 'fartlek', 'stair-run']) {
    assert.ok(!byId[id].modalities.includes('aerobic-steady'),
      `${id} still carries aerobic-steady`);
  }
});

test('no exercise is left in a retired bucket', () => {
  const retired = LIB.filter(e => e.pattern === 'locomotion');
  assert.deepEqual(retired, [], 'locomotion was split and must be empty');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/taxonomy.test.mjs"`
Expected: FAIL — the first assertion reports the current 20-member `sprint` bucket.

- [ ] **Step 3: Migrate the library**

In `data/exercises.json`, set `"pattern"` per the tables in design §4.1-4.2. Then add `"effortClass": "maximal"` to the seven maximal sprint entries and `"effortClass": "submaximal"` to `build-up-run`. Then remove `"aerobic-steady"` from the `modalities` array of `tempo-run`, `fartlek` and `stair-run`.

Verify the counts before moving on:

```bash
node -e '
const a=JSON.parse(require("fs").readFileSync("data/exercises.json","utf8")).exercises;
const c={};for(const e of a)c[e.pattern]=(c[e.pattern]||0)+1;
console.log(c.sprint,c["sprint-drill"],c.agility,c.run,c.erg,c.march,c.jump);
console.log("expect      8 9 3 7 2 5 17");'
```

- [ ] **Step 4: Update `orderClass`**

In `js/generator.js`, replace the two pattern branches at lines 596-598:

```javascript
  if (block.pattern === 'sprint') return 'sprint';
  if (block.pattern === 'jump' || block.pattern === 'throw') return 'plyometric';
  // run, erg and march are all conditioning: they close the main work.
  // sprint-drill and agility never reach here -- the role === 'prep' branch
  // above catches them. design-running-programming.md §6.5.
  if (block.pattern === 'run' || block.pattern === 'erg' ||
      block.pattern === 'march') return 'conditioning';
```

Without this, a `run` block falls through to the `hypertrophy` default and gets ordered as accessory lifting.

- [ ] **Step 5: Keep the app running**

In `js/templates.js`, `AEROBIC_STEADY` slot A: change `patterns: ['locomotion']` to `patterns: ['run', 'erg']`. Slot B: change `patterns: ['sprint']` to `patterns: ['sprint'], effortClass: 'submaximal'`.

Task 7 replaces this template wholesale. This step exists only so the suite is green at this commit.

- [ ] **Step 6: Update the two hardcoded test lists**

`tests/cue-guard.mjs:18` — add `'sprint-drill'`, `'agility'`, `'run'`, `'erg'`, `'march'` to the pattern list alongside the existing `'sprint'`.

`tests/coverage.test.mjs` — rename the keys, do not delete them. In `FLOOR_EXEMPT`, `'primary+secondary+accessory :: locomotion :: aerobic-steady'` becomes `'primary+secondary+accessory :: run/erg :: aerobic-steady'`. In both `FLOOR_EXEMPT` and `CLOSED_POOLS`, `'secondary+accessory :: sprint :: sprint'` needs the `effortClass` suffix once Task 5 extends `poolKey` — leave it as-is for now and Task 5 Step 1 will correct it.

- [ ] **Step 7: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 101 tests (91 baseline + 10 new).

- [ ] **Step 8: Commit**

```bash
git add data/exercises.json js/generator.js js/templates.js tests/
git commit -m "Split the sprint and locomotion buckets into six honest families

A pattern is meant to be a movement family. 'sprint' held maximal
efforts, technique drills and agility prep together; 'locomotion' held
runs, ergometers, loaded marches and backward walking together. Slot
eligibility is tier + pattern + modality, so any slot filtering those
buckets eventually pulled the absurd option -- a 90% backpedal as a
stride, a 20-minute backward walk as a steady run.

sprint now means maximal running only, with effortClass separating the
one submaximal member. Drills and agility move to their own families,
where prep can reach them and a hard-effort slot cannot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Add a `joints` filter to slot eligibility

Without this, the prep block can prescribe `thread-the-needle` and `banded-shoulder-dislocate` before a sprint session — it filters on pattern only, and every dynamic drill shares `pattern: mobility`.

**Files:**
- Modify: `js/generator.js:236-249` (`eligibleFor`)
- Modify: `tests/rules.test.mjs` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `eligibleFor` honours an optional `slot.joints` array — an exercise is eligible only if at least one of its `joints` appears in it. Task 5 uses `joints: ['hip', 'knee', 'ankle']`.

- [ ] **Step 1: Write the failing test**

Append to `tests/rules.test.mjs`:

```javascript
test('a slot can require the joints it means to prepare', () => {
  const lib = [
    { id: 'hip-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['hip'], modalities: ['mobility-dynamic'], venue: 'either' },
    { id: 'shoulder-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['shoulder'], modalities: ['mobility-dynamic'], venue: 'either' }
  ];
  const slot = {
    tier: ['mobility'], patterns: ['mobility'], modality: 'mobility-dynamic',
    joints: ['hip', 'knee', 'ankle']
  };
  const got = eligibleFor(slot, lib, {}).map(e => e.id);
  assert.deepEqual(got, ['hip-drill']);
});

test('a slot with no joints filter still sees everything', () => {
  const lib = [
    { id: 'shoulder-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['shoulder'], modalities: ['mobility-dynamic'], venue: 'either' }
  ];
  const slot = {
    tier: ['mobility'], patterns: ['mobility'], modality: 'mobility-dynamic'
  };
  assert.equal(eligibleFor(slot, lib, {}).length, 1);
});
```

Confirm `eligibleFor` is imported at the top of that file; add it to the existing `import { ... } from '../js/generator.js'` if not.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/rules.test.mjs"`
Expected: FAIL — `['hip-drill', 'shoulder-drill']` does not equal `['hip-drill']`.

- [ ] **Step 3: Implement the filter**

In `js/generator.js`, inside the `library.filter` callback in `eligibleFor`, immediately after the `slot.modality` line:

```javascript
    // A prep slot names the joints it prepares. Every dynamic drill shares
    // pattern 'mobility', so pattern alone cannot keep a shoulder dislocate
    // out of a running warm-up. design-running-programming.md §5.3.
    if (slot.joints && !(e.joints || []).some(j => slot.joints.includes(j))) {
      return false;
    }
```

- [ ] **Step 4: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 103 tests.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/rules.test.mjs
git commit -m "Let a slot require the joints it means to prepare

Every dynamic drill shares pattern 'mobility', so a running warm-up
filtering on pattern alone could prescribe a banded shoulder dislocate
and a thread-the-needle before a sprint session.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Add the warm-up jog

Stage 1 of the prep raises tissue temperature. `easy-run` cannot serve — it is prescribed at 20-45 minutes.

**Files:**
- Modify: `data/exercises.json` (one new entry)
- Modify: `tests/taxonomy.test.mjs` (append, and amend the `run` bucket assertion)

**Interfaces:**
- Consumes: pattern `run` from Task 2.
- Produces: exercise id `warmup-jog`, `pattern: 'run'`, `tier: 'accessory'`, `modalities: ['aerobic-steady']`, `durationMin: [3, 5]`. Task 5's prep stage 1 draws it.

- [ ] **Step 1: Write the failing test**

Append to `tests/taxonomy.test.mjs`:

```javascript
test('the warm-up jog exists and is cued like everything else', () => {
  const e = byId['warmup-jog'];
  assert.ok(e, 'warmup-jog is missing');
  assert.equal(e.pattern, 'run');
  assert.equal(e.tier, 'accessory');
  assert.ok(e.cues.length >= 3, 'needs at least three cues like the other 235');
});
```

Then amend the existing `run` bucket assertion in the same file — `warmup-jog` sorts last alphabetically, so its expected array becomes:

```javascript
    'easy-run', 'fartlek', 'run-interval', 'shuttle-run', 'stair-run',
    'tempo-run', 'trail-run', 'warmup-jog'
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/taxonomy.test.mjs"`
Expected: FAIL — `warmup-jog is missing`.

- [ ] **Step 3: Add the entry**

In `data/exercises.json`, beside the other `run` entries:

```json
    { "id": "warmup-jog", "name": "Warm-Up Jog", "pattern": "run", "tier": "accessory",
      "loadable": false, "prRef": null, "prCoef": null,
      "joints": ["ankle","knee","hip"], "equipment": ["open-space"], "venue": "either",
      "cnsCost": 1, "technical": 1, "unilateral": false, "durationMin": [3, 5],
      "cues": ["Slow enough to hold a conversation the whole way -- this is not the session.","Let the arms hang loose and shake the shoulders out as you go.","Finish warm and slightly out of breath, never tired."],
      "modalities": ["aerobic-steady"] },
```

- [ ] **Step 4: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 104 tests. The cue guard covers the new entry automatically.

- [ ] **Step 5: Commit**

```bash
git add data/exercises.json tests/taxonomy.test.mjs
git commit -m "Add the warm-up jog

Stage 1 of the running prep raises tissue temperature. easy-run cannot
serve: it is prescribed at 20-45 minutes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Build the four-stage running prep block

**Blocked on Task 1** for `PREP_INTEGRATE_COUNT`, `PREP_POTENTIATE_COUNT` and `BUILDUP_PCT_SPRINT`. Copy those values verbatim from the design doc's §10 table.

**Files:**
- Create: `tests/running.test.mjs`
- Modify: `js/templates.js` (add `PREP_BLOCK.running`)
- Modify: `tests/coverage.test.mjs:82` (`poolKey`) and its `FLOOR_EXEMPT`/`CLOSED_POOLS` keys

**Interfaces:**
- Consumes: `eligibleFor`'s `joints` filter (Task 3); patterns `sprint-drill`, `agility`, `sprint` + `effortClass` (Task 2); `warmup-jog` (Task 4).
- Produces: `PREP_BLOCK.running`, an array of four slot objects with `slot` values `'P1'`, `'P2'`, `'P3'`, `'P4'`, emitted in that order.

- [ ] **Step 1: Extend `poolKey` first**

`poolKey` (`tests/coverage.test.mjs:82`) builds its key from tier, patterns and modality only. Two slots differing solely by `effortClass` or `joints` collide on one key and their pools silently merge. Change it to:

```javascript
function poolKey(slot) {
  return [
    slot.tier.join('+'),
    (slot.patterns || []).join('/') || '(any)',
    slot.modality || '(any)',
    // Without these, a submaximal-strides slot and a maximal-sprint slot
    // share one key and the coverage numbers describe neither.
    slot.effortClass || null,
    slot.joints ? slot.joints.join('/') : null
  ].filter(Boolean).join(' :: ');
}
```

Run `node --test "tests/coverage.test.mjs"`. The `secondary+accessory :: sprint :: sprint` key in `FLOOR_EXEMPT` and `CLOSED_POOLS` now needs its `:: submaximal` suffix, because Task 2 Step 5 added `effortClass` to that slot. Update both lists to whatever key the failure names, then re-run to green.

- [ ] **Step 2: Write the failing test**

Create `tests/running.test.mjs`:

```javascript
// The running prep block and the four running templates.
// design-running-programming.md §5-6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREP_BLOCK, TEMPLATES } from '../js/templates.js';
import { eligibleFor } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const pool = slot => eligibleFor(slot, LIB, { venue: 'outdoor' }).map(e => e.id);

test('the running prep has four stages in order', () => {
  const stages = PREP_BLOCK.running.map(s => s.slot);
  assert.deepEqual(stages, ['P1', 'P2', 'P3', 'P4']);
});

test('stage 2 reaches only hip, knee and ankle drills', () => {
  const ids = pool(PREP_BLOCK.running[1]);
  assert.ok(ids.length >= 10, `only ${ids.length} drills available`);
  for (const id of ['thread-the-needle', 'banded-shoulder-dislocate',
                    'shoulder-cars', 'scapular-wall-slide']) {
    assert.ok(!ids.includes(id), `${id} must not appear in a running warm-up`);
  }
});

test('stage 3 draws drills and agility, never a maximal sprint', () => {
  const ids = pool(PREP_BLOCK.running[2]);
  assert.ok(ids.includes('a-skip'));
  assert.ok(ids.includes('carioca'));
  assert.ok(!ids.includes('acceleration-sprint'),
    'a maximal sprint is not warm-up work');
});

test('stage 4 potentiates submaximally only', () => {
  const ids = pool(PREP_BLOCK.running[3]);
  assert.deepEqual(ids, ['build-up-run'],
    'only the build-up run is submaximal');
});

test('every prep stage declares a count, as buildPools requires', () => {
  for (const s of PREP_BLOCK.running) {
    assert.ok(Array.isArray(s.count) && s.count.length === 2,
      `stage ${s.slot} has no [min,max] count`);
  }
});

test('the dynamic drill dose is unchanged from the sourced value', () => {
  // js/rules.js:255 -- dynamic stretching volume must not scale with
  // available time. [corroborated]
  assert.deepEqual(PREP_BLOCK.running[1].count, [3, 4]);
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node --test "tests/running.test.mjs"`
Expected: FAIL — `Cannot read properties of undefined (reading 'map')`, because `PREP_BLOCK.running` does not exist.

- [ ] **Step 4: Implement the block**

In `js/templates.js`, add to `PREP_BLOCK`. Replace each `<from Task 1>` with the sourced value and its tag:

```javascript
  // Raise -> mobilise -> integrate -> potentiate. Every running session runs
  // all four; only stage 4's endpoint differs. design-running-programming.md
  // §5. Stage order is preserved by orderSession's stable sort, which breaks
  // SESSION_ORDER ties by emission index -- so these must stay in order.
  running: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['accessory'], patterns: ['run'],
      modality: 'aerobic-steady', zone: null, mode: 'time',
      count: Object.freeze([1, 1]), durationMin: Object.freeze([3, 5]),
      effort: 'easy -- finish warm, never tired', optional: false
    }),
    Object.freeze({
      slot: 'P2', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      // The running warm-up prepares the hips, knees and ankles. Pattern
      // alone cannot express that -- every drill is pattern 'mobility'.
      joints: Object.freeze(['hip', 'knee', 'ankle']),
      count: MOBILITY_DOSE.DYNAMIC_DRILLS, reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    }),
    Object.freeze({
      slot: 'P3', role: 'prep', tier: ['accessory'],
      patterns: ['sprint-drill', 'agility'],
      modality: null, zone: null, mode: 'contacts',
      count: <from Task 1: PREP_INTEGRATE_COUNT>,
      sets: Object.freeze([1, 1]), reps: Object.freeze([1, 1]),
      restSec: Object.freeze([30, 45]),
      effort: 'rhythm before speed -- these rehearse the mechanics', optional: false
    }),
    Object.freeze({
      slot: 'P4', role: 'prep', tier: ['secondary'], patterns: ['sprint'],
      // The one field standing between a warm-up and a maximal effort.
      effortClass: 'submaximal',
      modality: 'sprint', zone: null, mode: 'contacts',
      count: <from Task 1: PREP_POTENTIATE_COUNT>,
      sets: Object.freeze([1, 1]), reps: Object.freeze([1, 1]),
      restSec: Object.freeze([60, 90]),
      effort: '<from Task 1: BUILDUP_PCT_SPRINT phrasing>', optional: true
    })
  ]),
```

`modality: null` on P3 is deliberate: the drills carry `sprint` in their modalities and the agility movements do not, so filtering by modality would drop carioca. Pattern and tier are the discriminators there.

- [ ] **Step 5: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 110 tests.

- [ ] **Step 6: Commit**

```bash
git add js/templates.js tests/running.test.mjs tests/coverage.test.mjs
git commit -m "Build the four-stage running prep block

Outdoor sessions opened with two or three generic mobility drills that
could reach a shoulder dislocate before a sprint. The running prep now
raises, mobilises the hips knees and ankles, integrates the movement
patterns, then potentiates -- and stage 4 can only select the one
submaximal sprint, never a maximal one.

Volume comes from stages 3 and 4 rather than more stage 2, because
rules.js:255 records that dynamic stretching volume must not scale with
available time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Add the interval prescription mode

`loadLine` (`js/ui.js:57`) ends in an unguarded fallthrough to `block.displayMultiplier.toFixed(2)`. An interval block has no `displayMultiplier`, so without this task the session screen throws a `TypeError` and renders nothing.

**Blocked on Task 1** for `INTERVAL_WORK_SEC` and `INTERVAL_REST_RATIO`.

**Files:**
- Modify: `js/generator.js` (`prescribe`)
- Modify: `js/ui.js:57` (`loadLine`), `js/ui.js:94` (`volumeLine`)
- Modify: `tests/ui.test.mjs` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: blocks with `mode: 'interval'` carrying `workSec` (number), `restSec` (number), `sets` (number). Task 7's interval template emits them.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui.test.mjs`:

```javascript
test('an interval prints work and rest, never a multiplier', () => {
  const block = {
    name: 'Running Intervals', mode: 'interval',
    workSec: 90, restSec: 90, sets: 8
  };
  assert.equal(loadLine(block), '8 × 90 s');
  assert.equal(volumeLine(block), '90 s rest');
});

test('an interval block never reaches the multiplier fallthrough', () => {
  // Regression: loadLine's final line is block.displayMultiplier.toFixed(2).
  // An interval block has no displayMultiplier, so a missing branch here is
  // a TypeError that kills the whole render.
  assert.doesNotThrow(() => loadLine({
    name: 'Fartlek', mode: 'interval', workSec: 60, restSec: 120, sets: 6
  }));
});
```

Confirm `loadLine` and `volumeLine` are both imported at the top of that file.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/ui.test.mjs"`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'toFixed')`.

- [ ] **Step 3: Add the UI branches**

In `js/ui.js`, in `loadLine`, before the final `return`:

```javascript
  // Work and rest in seconds. There is no load reference for an interval, so
  // the fallthrough below would read displayMultiplier off an object that has
  // none. design-running-programming.md §8.
  if (block.mode === 'interval') {
    return `${block.sets} × ${block.workSec} s`;
  }
```

In `volumeLine`, before the final `return`:

```javascript
  // The hero line carries the work; the chip carries the rest.
  if (block.mode === 'interval') return `${block.restSec} s rest`;
```

- [ ] **Step 4: Add the prescription**

In `js/generator.js`, in `prescribe`, add an `interval` branch alongside the existing `time` and `contacts` branches. Use the Task 1 values:

```javascript
  if (slot.mode === 'interval') {
    const workSec = jitter(rng, slot.workSec);
    return {
      ...base,
      mode: 'interval',
      sets: jitter(rng, slot.sets),
      workSec,
      // Work:rest, not a fixed rest. A 90 s effort and a 30 s effort do not
      // recover in the same time. <tag from Task 1>
      restSec: Math.round(workSec * jitter(rng, slot.restRatio)),
      effort: slot.effort
    };
  }
```

Read the neighbouring branches first and match their actual helper names and `base` object shape rather than assuming the names above are right.

- [ ] **Step 5: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 112 tests.

- [ ] **Step 6: Commit**

```bash
git add js/generator.js js/ui.js tests/ui.test.mjs
git commit -m "Prescribe intervals as work and rest

loadLine ended in an unguarded fallthrough to displayMultiplier.toFixed,
so any block without a load reference threw a TypeError and killed the
render. Intervals now print work on the hero line and rest on the chip,
and rest derives from the work duration rather than being fixed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Build the four running templates

**Blocked on Task 1** for the interval and build-up values.

**Files:**
- Modify: `js/templates.js` (`DAY_TYPES`, `TEMPLATES`, `ARCHITECTURES`, `PHASE_1_DAY_TYPES`)
- Modify: `js/generator.js` (prep-variant selection; sprint metreage budget check in the pack step)
- Modify: `tests/running.test.mjs` (append)

**Interfaces:**
- Consumes: everything from Tasks 2-6.
- Produces: `TEMPLATES.interval`, `TEMPLATES.sprint`, `TEMPLATES.plyometric`, and a rewritten `TEMPLATES['aerobic-steady']`. `DAY_TYPES` gains three keys, each with `prep: 'running'`.

- [ ] **Step 1: Write the failing test**

Append to `tests/running.test.mjs`:

```javascript
test('all four running day types exist', () => {
  for (const dt of ['aerobic-steady', 'interval', 'sprint', 'plyometric']) {
    assert.ok(TEMPLATES[dt], `${dt} has no template`);
  }
});

test('an easy run cannot come back as a fartlek or a backward walk', () => {
  const ids = pool(TEMPLATES['aerobic-steady'][0]);
  for (const bad of ['fartlek', 'tempo-run', 'stair-run',
                     'backward-walk', 'ruck-march', 'sled-drag']) {
    assert.ok(!ids.includes(bad), `${bad} is not an easy run`);
  }
  assert.ok(ids.includes('easy-run') && ids.includes('trail-run'));
});

test('easy-day strides are submaximal only', () => {
  const strides = TEMPLATES['aerobic-steady'][1];
  assert.equal(strides.effortClass, 'submaximal');
  assert.deepEqual(pool(strides), ['build-up-run']);
});

test('the sprint day draws maximal efforts only', () => {
  const ids = pool(TEMPLATES.sprint[0]);
  assert.ok(ids.includes('acceleration-sprint'));
  assert.ok(!ids.includes('build-up-run'), 'a build-up is not the hard work');
  assert.ok(!ids.includes('flying-run'),
    'flying runs need measured ground and stay opt-in');
});

test('the interval day never draws a maximal sprint', () => {
  const ids = pool(TEMPLATES.interval[0]);
  assert.ok(ids.includes('run-interval'));
  assert.ok(!ids.includes('acceleration-sprint'));
});

test('the plyometric day draws jumps', () => {
  const ids = pool(TEMPLATES.plyometric[0]);
  assert.ok(ids.length >= 5, `only ${ids.length} jumps available`);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/running.test.mjs"`
Expected: FAIL — `interval has no template`.

- [ ] **Step 3: Add the day types**

In `js/templates.js`, extend `DAY_TYPES`:

```javascript
  interval: Object.freeze({
    venue: 'outdoor', cnsClass: 'moderate', volumeUnit: 'minutes',
    mobilityCore: 'short', prep: 'running'
  }),
  sprint: Object.freeze({
    venue: 'outdoor', cnsClass: 'high', volumeUnit: 'meters',
    mobilityCore: 'short', prep: 'running'
  }),
  plyometric: Object.freeze({
    venue: 'either', cnsClass: 'high', volumeUnit: 'contacts',
    mobilityCore: 'short', prep: 'running'
  })
```

Add `prep: 'running'` to the existing `aerobic-steady` entry too, and add the three names to `PHASE_1_DAY_TYPES` and to `ARCHITECTURES` (each mapping to `Object.freeze(['straight'])`). Then find where the generator selects a prep variant and make it prefer `DAY_TYPES[dayType].prep` when set, falling back to the existing `mobilityCore`-derived choice otherwise.

- [ ] **Step 4: Write the four templates**

Following the tables in design §6.1-6.4 and the existing `AEROBIC_STEADY` shape. Replace `<from Task 1>` placeholders with sourced values. The four are `AEROBIC_STEADY` (rewritten), `INTERVAL`, `SPRINT_DAY` and `PLYOMETRIC`, all registered in the `TEMPLATES` export.

Slot C of the sprint day names `flying-run` and stays unreachable, because `eligibleFor` excludes `requiresMeasuredGround` unconditionally at `js/generator.js:245`. Keep the slot with a comment saying so; it becomes reachable when the opt-in lands.

- [ ] **Step 5: Add the sprint metreage budget**

In `js/generator.js`, in the pack step beside the plyo contact check at line 702:

```javascript
  // Sprint metreage is an internal budget, never shown as a target (spec 9.1).
  // Overshooting weekly volume degrades the FIRST rep of the following
  // session, and that degraded rep is the injury window. js/rules.js:179
  if (dayType === 'sprint') {
    const meters = ordered
      .filter(b => b.pattern === 'sprint' && b.role !== 'prep')
      .reduce((sum, b) => sum + (b.sets || 0) * (b.nominalMeters || 0), 0);
    if (meters > SPRINT.METERS_PER_SESSION[1]) {
      warnings.push(
        `sprint metreage ${meters} m exceeds the ${SPRINT.METERS_PER_SESSION[1]} m session cap`
      );
    }
  }
```

Read the plyo check first: if it trims optional slots rather than only warning, do the same here so the two behave alike.

- [ ] **Step 6: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 118 tests.

- [ ] **Step 7: Generate one of each and read them**

```bash
node -e '
import("./js/generator.js").then(async g => {
  const fs = await import("node:fs");
  const lib = JSON.parse(fs.readFileSync("data/exercises.json","utf8")).exercises;
  for (const dt of ["aerobic-steady","interval","sprint","plyometric"]) {
    const s = g.generate({ library: lib, dayType: dt, seed: 7,
                           profile: { returnDate: "2026-01-01" } });
    console.log("\n=== " + dt + " ===");
    for (const b of s.blocks) console.log("  " + b.slot + "  " + b.name);
    if (s.warnings.length) console.log("  WARNINGS: " + s.warnings.join("; "));
  }
});'
```

Read all four. No backward walks, no 90% backpedals, no shoulder drills in a running warm-up, no empty slots. If any appear, the filters are wrong — fix before committing.

- [ ] **Step 8: Commit**

```bash
git add js/templates.js js/generator.js tests/running.test.mjs
git commit -m "Build the four running templates

Easy run, intervals, sprint and plyometric, each on the corrected pools
and each opening with the four-stage running prep. The easy run can no
longer return a fartlek, a ruck march or a backward walk; the sprint day
draws maximal efforts only and stays inside the 200-800 m session budget.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Couple chronic lifting load to running selection

**Blocked on Task 1** for all four thresholds.

**Files:**
- Create: `tests/load-coupling.test.mjs`
- Modify: `js/rules.js` (new constants)
- Modify: `js/generator.js` (`buildState`, `proposeDayType`)

**Interfaces:**
- Consumes: the four running day types (Task 7).
- Produces: state fields `chronicLoad` (number), `gymShare` (number 0-1), `weeksSinceEasyWeek` (integer); exported function `chronicBoost(dayType, state)` returning a number ≥ 1.

- [ ] **Step 1: Write the failing test**

Create `tests/load-coupling.test.mjs`:

```javascript
// Running is programmed from accumulated lifting load, not requested.
// design-running-programming.md §7.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chronicBoost } from '../js/generator.js';

const state = over => ({
  chronicLoad: 0, gymShare: 0, weeksSinceEasyWeek: 0, ...over
});

test('a lifting-dominated month boosts the easy and interval days', () => {
  const s = state({ chronicLoad: 120, gymShare: 0.9 });
  assert.ok(chronicBoost('aerobic-steady', s) > 1);
  assert.ok(chronicBoost('interval', s) > 1);
});

test('it never boosts the high-CNS days', () => {
  // Prescribing sprints as the answer to accumulated fatigue is backwards.
  const s = state({ chronicLoad: 120, gymShare: 0.9, weeksSinceEasyWeek: 6 });
  assert.equal(chronicBoost('sprint', s), 1);
  assert.equal(chronicBoost('plyometric', s), 1);
  assert.equal(chronicBoost('max-strength', s), 1);
});

test('a balanced month changes nothing', () => {
  assert.equal(chronicBoost('aerobic-steady', state({ gymShare: 0.4 })), 1);
});

test('four weeks without a lighter week boosts harder than gym share alone', () => {
  const shareOnly = chronicBoost('aerobic-steady',
    state({ chronicLoad: 120, gymShare: 0.9 }));
  const andWeeks = chronicBoost('aerobic-steady',
    state({ chronicLoad: 120, gymShare: 0.9, weeksSinceEasyWeek: 4 }));
  assert.ok(andWeeks > shareOnly);
});

test('an empty history boosts nothing', () => {
  // A two-week gap lowers chronic load, which correctly makes lifting more
  // attractive rather than less. §7.3.
  assert.equal(chronicBoost('aerobic-steady', state()), 1);
});

test('the boost is capped', () => {
  const extreme = state({ chronicLoad: 9999, gymShare: 1, weeksSinceEasyWeek: 52 });
  assert.ok(chronicBoost('aerobic-steady', extreme) <= 3,
    'an unbounded boost would make running the only proposal forever');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "tests/load-coupling.test.mjs"`
Expected: FAIL — `chronicBoost is not a function`.

- [ ] **Step 3: Add the constants**

In `js/rules.js`, beside the CNS block, using the Task 1 values and tags:

```javascript
// The acute account above is a 72 h horizon and cannot see a month. This is
// the chronic one: as lifting accumulates, the low- and moderate-CNS running
// days get more attractive. A BOOST, never a veto -- if he is fresh and has
// not lifted in a week, lifting still wins on neglect.
// design-running-programming.md §7.
export const CHRONIC = Object.freeze({
  WINDOW_DAYS: <from Task 1>,
  GYM_SHARE_TRIGGER: <from Task 1>,
  WEEKS_TRIGGER: <from Task 1>,
  BOOST_MAX: <from Task 1>
});

// Day types the chronic term may boost. Deliberately excludes sprint and
// plyometric: they are HIGH_CNS_DAY_TYPES and cannot serve as recovery.
export const CHRONIC_BOOSTABLE = Object.freeze(['aerobic-steady', 'interval']);
```

- [ ] **Step 4: Compute the three state fields**

In `js/generator.js`, in `buildState`, alongside the existing `cnsAccount` loop. Both `s.dayType` and `s.cnsLoad` are already recorded on every history entry, so no storage migration is needed. Read the `hoursSince` and `cnsAccount` loops above and follow their shape.

- [ ] **Step 5: Implement and wire `chronicBoost`**

Export it from `js/generator.js`, then apply it in `proposeDayType` where `score` is computed:

```javascript
    let score = Math.min(days, 21) * chronicBoost(dt, state);
```

- [ ] **Step 6: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 124 tests.

- [ ] **Step 7: Verify the two scenarios by hand**

Build a synthetic history of three gym sessions per week for four weeks, call `proposeDayType`, and confirm a running day is proposed. Then build a history with a running day every week and confirm lifting still wins. Print both reason strings and check they read sensibly — the user sees these.

Note that `reasonFor` (`js/generator.js:196`) has a label map covering only the four original day types and falls back to the raw key. Add readable labels for `interval`, `sprint` and `plyometric` while you are here.

- [ ] **Step 8: Commit**

```bash
git add js/rules.js js/generator.js tests/load-coupling.test.mjs
git commit -m "Program running from accumulated lifting load

The CNS account is a 72-hour horizon: it stops a hard day stacking on a
hard day, but it cannot see that the last month was all lifting. A
chronic term now boosts the easy and interval days as gym share climbs
and as the weeks pass without a lighter one.

It boosts and never vetoes, so lifting still wins when he is fresh. It
does not boost sprint or plyometric -- both are high-CNS and cannot
serve as recovery.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Regenerate the coverage matrix and close the pools

**Files:**
- Modify: `docs/coverage-matrix.md` (regenerated)
- Modify: `tests/coverage.test.mjs` (`CLOSED_POOLS`)

**Interfaces:**
- Consumes: every pool the four templates and the running prep draw.
- Produces: nothing downstream.

- [ ] **Step 1: Regenerate the matrix**

`tests/coverage.test.mjs` writes `docs/coverage-matrix.md` via `writeFileSync`. Run the suite and inspect the diff:

```bash
node --test "tests/coverage.test.mjs" && git diff docs/coverage-matrix.md
```

- [ ] **Step 2: Read every new row**

Each new pool has a measured size, a survival fraction and a floor. Any pool below its floor means a running slot can be starved by one hurt joint. If a floor fails, either the pool needs more library entries or the slot needs widening — decide which, record it in the design doc, and do that before proceeding.

- [ ] **Step 3: Close the pools that meet their targets**

Add each satisfied new pool key to `CLOSED_POOLS`. The file's own comment explains why: *"Adding a line here is how an authoring commit becomes permanent."* A pool left out can silently regress.

- [ ] **Step 4: Run the full suite**

Run: `node --test "tests/*.test.mjs"`
Expected: PASS, 124 tests.

- [ ] **Step 5: Commit**

```bash
git add docs/coverage-matrix.md tests/coverage.test.mjs
git commit -m "Close the running pools in the coverage matrix

Every pool the four running templates draw is now measured and locked,
so a later authoring commit cannot silently starve one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Verify on the phone

The app is a PWA the user installs. Nothing here is done until a running session reads correctly on a phone screen.

**Files:** none.

- [ ] **Step 1: Serve locally**

```bash
python -m http.server 8000
```

- [ ] **Step 2: Generate one of each running day**

At a 390 × 844 viewport, generate all four running sessions. For each, confirm: the prep reads as four ordered stages; no shoulder or trunk drill appears in a running warm-up; the interval card shows work and rest rather than a blank or a crash; every card flips to its cues.

- [ ] **Step 3: Confirm the bug that started this is gone**

Generate easy runs repeatedly with different seeds. A backward walk must never appear as the steady run, and no stride may be prescribed above submaximal.

- [ ] **Step 4: Report to the user**

Show him the four sessions and ask whether they read like real programming. He is the athlete; this is the only test that matters. Do not mark the plan complete until he says so.

---

## Self-Review

**Spec coverage.** §4.1-4.3 → Task 2. §4.4 `effortClass` → Task 2. §4.5 modality cleanup → Task 2. §5 prep block → Tasks 3, 4, 5. §6.1-6.4 templates → Task 7. §6.5 machinery: `mode: 'interval'` → Task 6, metreage check → Task 7, `orderClass` → Task 2. §7 coupling → Task 8. §8 card rendering → Task 6. §9 equipment filtering → deferred by decision, no task, correct. §10 sourcing → Task 1. §11 limitations → documentation only. §12 migration table → distributed across Tasks 2, 4, 6, 7, 9.

Three gaps found and closed while reviewing: the `poolKey` collision (Task 5 Step 1), the prep-stage `count` requirement in `buildPools` (a Task 5 test), and `reasonFor`'s label map covering only the four original day types (Task 8 Step 7).

**Placeholder scan.** The `<from Task 1>` markers in Tasks 5-8 are deliberate and are the single reason Task 1 exists and blocks them. Every other step carries its actual content. Task 7 Step 4 and Task 8 Steps 4-5 direct the implementer to follow neighbouring code shape rather than quoting full bodies — the surrounding helpers are local and must be matched, not reinvented.

**Type consistency.** `effortClass` is `'submaximal' | 'maximal'` in Tasks 2, 5 and 7. `joints` is a string array in Tasks 3 and 5. `chronicBoost(dayType, state)` returns a number ≥ 1 in Task 8's tests, constants and wiring. Interval blocks carry `workSec`/`restSec`/`sets` in Tasks 6 and 7 alike. Prep stages are `P1`-`P4` in Task 5's test and implementation.

## Test count ledger

| After task | Expected passing |
|---|---|
| baseline | 91 |
| 2 | 101 |
| 3 | 103 |
| 4 | 104 |
| 5 | 110 |
| 6 | 112 |
| 7 | 118 |
| 8 | 124 |
| 9 | 124 |

A task landing on a different number means a test was lost or duplicated — investigate before committing.
