# Implementation plan 1 — the mobility split

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task by
> task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single trailing mobility block into a rep-dosed dynamic prep
block before the main work and a time-dosed static + core cool-down after it, so
that every mobility movement is dosed in the unit its source uses and dynamic
preparation happens before the lifting it prepares for.

**Architecture:** The `modalities` vocabulary in `data/exercises.json` splits
`mobility` into `mobility-dynamic` and `mobility-static`; dosing then follows
from the tag rather than being stated separately. `templates.js` grows two block
definitions where it had one, `generator.js` grows two builders where it had
`buildMobilityCore`, and `SESSION_ORDER` grows a `prep` class at the front.
Nothing about the main work, the ramp, or the load display changes.

**Tech stack:** Plain ES modules, no build step, no dependencies. Tests run on
`node --test` using the built-in `node:test` and `node:assert/strict` — both
ship with Node (verified on v24.18.0), so this adds no package.json and no
`node_modules`.

**Spec:** `docs/design-mobility-and-warmup.md` §4.1, §4.2, §5, §7 — read it
alongside this plan. Background and sourcing are in §2.1–2.2 and §3
(discrepancies 4, 5, 6). This plan implements **step 1 of the four in §4.6**;
warm-up ramps (§4.3), coverage-driven exercise count (§4.4) and new day types
(§4.5) are out of scope and must not be started here.

## Global constraints

- **Zero dependencies, no build step, plain ES modules.** No package.json, no
  npm, no bundler. If a task seems to need one, stop and ask.
- **Never display an absolute weight.** Loads print as `0.75 × Squat PR`. This
  plan touches no load line, but do not regress one.
- **`sw.js` `VERSION` is bumped by hand on every deploy.** There is no build
  step to do it. Task 10 bumps it once, at the end.
- **Every constant carries a source and a provenance tag** (`[verified]` /
  `[corroborated]` / `[unverified]`) in a comment where it is defined, matching
  the existing style in `js/rules.js`. Inventing a number and presenting it as
  design is the recurring failure on this project — if a value has no source,
  tag it `[unverified]` and say so out loud.
- **Commit after every task.** Commits use the GitHub noreply identity already
  configured in this repo; do not change git config.
- **Headless tests are necessary and insufficient.** An 800-session sweep once
  passed clean while two real bugs sat in the code. Task 10 is a real-browser
  check and is not optional.

---

## Deviations from the design doc — read before starting

Five things turned up when the design was checked against the code. Each is
handled by a task below; none changes the design's intent.

1. **`templates.js` does not validate modality names at import time.** Design
   §4.1 relies on this to "fail loudly" during the migration. The existing
   import-time guard checks *zones* only. Task 4 adds the modality guard, which
   is what makes the migration note true.

2. **26 entries carry the `mobility` modality, not 19.** The 19
   `pattern: "mobility"` entries the design names, plus seven core/rotate
   entries that carry `mobility` as a *secondary* modality: `plank`,
   `side-plank`, `dead-bug`, `bird-dog`, `pallof-press`, `bear-crawl`,
   `half-kneeling-cable-chop`. Those seven are selected by tier and pattern,
   never by the mobility modality, so the tag is inert today. Task 1 **removes**
   it from them rather than mapping it to a split value: a plank tagged
   `mobility-static` would be a false statement in the data, and §4.1's whole
   argument is that one source of truth cannot contradict itself. Every one of
   the seven keeps at least one other modality, so none is left with an empty
   array.

3. **Core dosing needs a new data field.** §4.2 doses core at 3 sets × 10–15
   reps, but six core entries are isometric holds (`plank`, `side-plank`,
   `copenhagen-plank`, `hollow-hold`, `l-sit`, `suitcase-hold`), and §2.1 doses
   isometric holds by time. Modality cannot carry this, because core slots
   filter on tier and pattern with `modality: null`. Task 2 adds an `isometric`
   boolean. §4.1's "no new field" applies to the mobility split specifically;
   this is core.

4. **The static pool is thin, and one sore joint makes it thinner.** Seven
   entries qualify as `mobility-static`, six of them outdoor-eligible
   (`thoracic-foam-roll` is `venue: gym`). A hurt hip excludes four of the
   seven, leaving three at the gym and two outdoors against a slot that wants
   3–4. Task 7 makes the shortfall a warning rather than a silent short block,
   and Task 9 asserts the floor. **Widening the static library is a follow-up,
   not part of this plan.**

5. **The 60-minute total needs a cool-down pack step.** §5 budgets 45 + 3 + 12 =
   60. `packToBudget` trims main work to ≤45, but the cool-down as dosed
   estimates 12–14 min, so a full-length main work plus a long cool-down can
   land at 61. Task 6 adds `packCooldown`, which shaves core sets to a floor of
   2 and then drops a static stretch to a floor of 3 — never shortening a hold
   below the ACSM dose, never touching prep.

---

## File structure

| File | Change | Responsibility after this plan |
|---|---|---|
| `data/exercises.json` | modify | 19 mobility entries tagged `mobility-dynamic` / `mobility-static`; 7 secondary `mobility` tags removed; 6 core entries gain `isometric: true` |
| `js/rules.js` | modify | `MODALITIES` vocabulary, `MOBILITY_DOSE` constants, `SESSION_ORDER` gains `prep`, `TIME` re-derived per §5 |
| `js/templates.js` | modify | `MOBILITY_CORE_BLOCK` → `PREP_BLOCK` + `COOLDOWN_BLOCK`; import-time modality guard |
| `js/generator.js` | modify | `buildMobilityCore` → `buildPrep` + `buildCooldown`; `packCooldown`; `estimateMinutes` and volume accounting learn the new modes; `orderClass` stops lumping |
| `js/ui.js` | modify | three groups (Prep / Main work / Cool-down); `loadLine` and `volumeLine` render drills and holds |
| `sw.js` | modify | `VERSION` bump, once, at the end |
| `tests/library.test.mjs` | create | data invariants: vocabulary, tagging completeness, pool sizes |
| `tests/rules.test.mjs` | create | vocabulary, ordering and time-budget constants |
| `tests/templates.test.mjs` | create | block shapes and the import-time guard's premise |
| `tests/mobility.test.mjs` | create | builder behaviour: dose units, per-side, exclusions, pack |
| `tests/ui.test.mjs` | create | dose lines render in the right unit |
| `tests/session.test.mjs` | create | whole-session invariants from design §7 across day types × ramp weeks × seeds |
| `docs/spec.md` | modify | §10 resume point |
| `docs/programming-basis.md` | modify | §9 replaced; discrepancies 4–6 folded in |
| `docs/design-mobility-and-warmup.md` | modify | status: step 1 shipped |

---

## Task 1: Split the mobility modality in the library

**Files:**
- Modify: `data/exercises.json` (19 mobility entries + 7 secondary tags)
- Create: `tests/library.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the modality strings `'mobility-dynamic'` and `'mobility-static'`,
  used by every later task. The string `'mobility'` no longer appears in any
  `modalities` array.

**The tagging.** Dynamic = moves through a range under control, dosed in reps.
Static = a held position, dosed in seconds. Self-myofascial work counts as
static: it is dosed by time and carries the same pre-explosive caution
(design §4.1).

| id | tag | why |
|---|---|---|
| `ninety-ninety-hip-switch` | dynamic | switching between positions, rep-counted |
| `worlds-greatest-stretch` | dynamic | standard dynamic warm-up movement, performed as a flow |
| `cat-cow` | dynamic | alternates through spinal flexion/extension |
| `thread-the-needle` | dynamic | repeated reach-through, not a terminal hold |
| `banded-shoulder-dislocate` | dynamic | rep-counted by definition |
| `scapular-wall-slide` | dynamic | rep-counted slide |
| `shoulder-cars` | dynamic | CARs are controlled *articular rotations* — reps |
| `hip-cars` | dynamic | as above |
| `ankle-dorsiflexion-rock` | dynamic | rocking, rep-counted |
| `adductor-rock` | dynamic | rocking, rep-counted |
| `leg-swing` | dynamic | rep-counted swing |
| `glute-bridge` | dynamic | rep-counted; an activation drill, not a stretch |
| `couch-stretch` | static | held position |
| `kneeling-hip-flexor-stretch` | static | held position |
| `thoracic-foam-roll` | static | SMR — time-dosed, design §4.1 names it explicitly |
| `deep-squat-hold` | static | the name is the dose |
| `childs-pose` | static | held position |
| `dead-hang` | static | held position |
| `calf-stretch` | static | held position |

`thread-the-needle` is the one genuinely arguable call — it is performed both
ways. It is tagged dynamic because the prep block needs a thoracic option and
the cool-down already has `childs-pose` and `dead-hang` covering that region.
Flag it if it reads wrong in the gym; it is a one-line change.

- [ ] **Step 1: Write the failing test**

Create `tests/library.test.mjs`:

```js
// tests/library.test.mjs -- data invariants for data/exercises.json.
//
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lib = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
);
const EX = lib.exercises;

test('the bare "mobility" modality no longer exists anywhere', () => {
  const stragglers = EX.filter(e => e.modalities.includes('mobility'));
  assert.deepEqual(stragglers.map(e => e.id), [],
    'these entries still carry the pre-split modality');
});

test('every mobility-pattern entry carries exactly one split tag', () => {
  const mob = EX.filter(e => e.pattern === 'mobility');
  assert.equal(mob.length, 19, 'the mobility pattern should hold 19 entries');
  for (const e of mob) {
    const tags = e.modalities.filter(
      m => m === 'mobility-dynamic' || m === 'mobility-static'
    );
    assert.equal(tags.length, 1,
      `${e.id} should carry exactly one of dynamic/static, has ${tags.length}`);
  }
});

test('no entry is left with an empty modalities array', () => {
  for (const e of EX) {
    assert.ok(e.modalities.length > 0, `${e.id} has no modalities left`);
  }
});

test('both pools are deep enough for a 3-4 pick at either venue', () => {
  const pool = (tag, venue) => EX.filter(e =>
    e.pattern === 'mobility' &&
    e.modalities.includes(tag) &&
    (e.venue === 'either' || e.venue === venue)
  );
  for (const venue of ['gym', 'outdoor']) {
    assert.ok(pool('mobility-dynamic', venue).length >= 4,
      `dynamic pool too thin at ${venue}`);
    assert.ok(pool('mobility-static', venue).length >= 4,
      `static pool too thin at ${venue}`);
  }
});

// Deviation 4: one hurt joint must not empty the static pool. Three is the
// floor packCooldown is allowed to trim to, so three is what must survive.
test('a single hurt joint leaves at least 3 static stretches at the gym', () => {
  const statics = EX.filter(e =>
    e.pattern === 'mobility' && e.modalities.includes('mobility-static')
  );
  const joints = [...new Set(statics.flatMap(e => e.joints || []))];
  for (const hurt of joints) {
    const left = statics.filter(e => !(e.joints || []).includes(hurt));
    assert.ok(left.length >= 3,
      `a hurt ${hurt} leaves only ${left.length} static stretches`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/
```

Expected: the first two tests fail — every mobility entry still carries the bare
`mobility` tag and none carries a split tag.

- [ ] **Step 3: Retag the library**

Edit `data/exercises.json` by hand. For each of the 19 `pattern: "mobility"`
entries, replace `"mobility"` inside `modalities` with `"mobility-dynamic"` or
`"mobility-static"` per the table above. Then remove the string `"mobility"`
from the `modalities` array of these seven, leaving their other modalities
untouched:

```
plank                     ["mobility","isolation"]        -> ["isolation"]
side-plank                ["mobility","isolation"]        -> ["isolation"]
dead-bug                  ["mobility","isolation"]        -> ["isolation"]
bird-dog                  ["mobility","isolation"]        -> ["isolation"]
pallof-press              ["isolation","mobility"]        -> ["isolation"]
bear-crawl                ["mobility","interval"]         -> ["interval"]
half-kneeling-cable-chop  ["isolation","mobility"]        -> ["isolation"]
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/
```

Expected: 5 passing. If the hurt-joint test fails, do not weaken it — that is
deviation 4 biting, and it means the static library needs widening before this
ships. Stop and report.

- [ ] **Step 5: Commit**

```bash
git add data/exercises.json tests/library.test.mjs
git commit -m "Split the mobility modality into dynamic and static -- design 4.1"
```

---

## Task 2: Mark isometric core holds in the library

**Files:**
- Modify: `data/exercises.json` (6 core entries)
- Modify: `tests/library.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `exercise.isometric === true` on core entries dosed by time.
  Absent means false; `prescribeMobility` in Task 6 branches on it.

- [ ] **Step 1: Write the failing test**

Append to `tests/library.test.mjs`:

```js
// A plank dosed as "3 x 12 reps" is a wrong instruction, not a vague one --
// the same failure class as the old "bodyweight" load line. Core holds are
// dosed by time. design 2.1.
test('isometric core holds are marked, and only they are', () => {
  const HOLDS = [
    'plank', 'side-plank', 'copenhagen-plank',
    'hollow-hold', 'l-sit', 'suitcase-hold'
  ];
  const marked = EX.filter(e => e.isometric === true).map(e => e.id).sort();
  assert.deepEqual(marked, [...HOLDS].sort());
  for (const id of HOLDS) {
    const e = EX.find(x => x.id === id);
    assert.ok(e, `${id} missing from the library`);
    assert.equal(e.pattern, 'core', `${id} should be a core-pattern entry`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/library.test.mjs
```

Expected: FAIL — `marked` is empty.

- [ ] **Step 3: Add the field**

Add `"isometric": true` to exactly these six entries in `data/exercises.json`,
placed after `"unilateral"` to match the existing field order: `plank`,
`side-plank`, `copenhagen-plank`, `hollow-hold`, `l-sit`, `suitcase-hold`.

Do not add `"isometric": false` anywhere. Absent is false, and 180 entries do
not need a field that says nothing.

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add data/exercises.json tests/library.test.mjs
git commit -m "Mark isometric core holds -- they are dosed by time, not reps"
```

---

## Task 3: Rules — vocabulary, doses, ordering, time budget

**Files:**
- Modify: `js/rules.js`
- Create: `tests/rules.test.mjs`

**Interfaces:**
- Consumes: the modality strings from Task 1.
- Produces:
  - `MODALITIES: readonly string[]` — the full vocabulary, used by the
    import-time guard in Task 4.
  - `MOBILITY_DOSE: { DYNAMIC_DRILLS, DYNAMIC_REPS, STATIC_STRETCHES,
    STATIC_HOLD_SEC, STATIC_HOLD_SETS, CORE_EXERCISES, CORE_SETS, CORE_REPS,
    CORE_HOLD_SEC, CORE_REST_SEC }` — every value an inclusive `[lo, hi]` pair,
    consumed by `templates.js`.
  - `SESSION_ORDER` with `'prep'` first.
  - `TIME.PREP_MIN`, `TIME.COOLDOWN_MIN`, `TIME.MOBILITY_TRANSITION_SEC`;
    `TIME.MOBILITY_CORE_MIN` is gone and `GYM_SESSION_TOTAL_MIN` is 60.

- [ ] **Step 1: Write the failing test**

Create `tests/rules.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODALITIES, MOBILITY_DOSE, SESSION_ORDER, TIME } from '../js/rules.js';

test('the modality vocabulary is split and complete', () => {
  assert.ok(MODALITIES.includes('mobility-dynamic'));
  assert.ok(MODALITIES.includes('mobility-static'));
  assert.ok(!MODALITIES.includes('mobility'),
    'the pre-split value must not survive in the vocabulary');
});

test('prep leads the session order and static mobility still closes it', () => {
  assert.equal(SESSION_ORDER[0], 'prep');
  assert.equal(SESSION_ORDER[SESSION_ORDER.length - 1], 'mobility');
  assert.ok(SESSION_ORDER.indexOf('prep') < SESSION_ORDER.indexOf('max-strength'),
    'dynamic prep must precede the work it prepares for -- discrepancy 6');
});

test('the time budget matches design 5', () => {
  assert.equal(TIME.GYM_SESSION_TOTAL_MIN, 60);
  assert.equal(TIME.MAIN_WORK_MAX_MIN, 45);
  assert.equal(TIME.PREP_MIN, 3);
  assert.equal(TIME.COOLDOWN_MIN, 12);
  assert.equal(TIME.PREP_MIN + TIME.MAIN_WORK_MAX_MIN + TIME.COOLDOWN_MIN,
    TIME.GYM_SESSION_TOTAL_MIN, 'the three budgets must sum to the total');
  assert.equal(TIME.MOBILITY_CORE_MIN, undefined,
    'the withdrawn 25 min figure must be gone -- discrepancy 5');
});

test('every dose is an inclusive [lo, hi] pair inside its sourced range', () => {
  for (const [k, v] of Object.entries(MOBILITY_DOSE)) {
    assert.ok(Array.isArray(v) && v.length === 2, `${k} is not a pair`);
    assert.ok(v[0] <= v[1], `${k} is inverted`);
  }
  // ACSM: 10-30 s per hold, 2-4 repetitions per muscle group.
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SEC[0] >= 10);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SEC[1] <= 30);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SETS[0] >= 2);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SETS[1] <= 4);
  // design 2.1: dynamic volume does not scale with available time.
  assert.deepEqual([...MOBILITY_DOSE.DYNAMIC_REPS], [10, 12]);
  assert.deepEqual([...MOBILITY_DOSE.DYNAMIC_DRILLS], [3, 4]);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/rules.test.mjs
```

Expected: FAIL — `MODALITIES` and `MOBILITY_DOSE` are not exported.

- [ ] **Step 3: Edit `js/rules.js`**

Add the vocabulary near the top of the file, next to the other §-tagged blocks:

```js
// --------------------------------------------------------------------------
// Vocabulary
// --------------------------------------------------------------------------

// The closed set of modality values. `templates.js` checks every slot against
// this at import time, so a typo or a half-done migration is an immediate
// error rather than a silently empty pool at the gym door.
//
// `mobility` split into two on 2026-08-23: dosing follows from the modality,
// so one value could not carry two dosing units. design 4.1, discrepancy 4.
export const MODALITIES = Object.freeze([
  'max-strength', 'power', 'hypertrophy', 'isolation',
  'plyometric', 'sprint', 'interval', 'aerobic-steady',
  'mobility-dynamic', 'mobility-static'
]);
```

Add the doses under the §9 heading:

```js
// --------------------------------------------------------------------------
// §9  Mobility and core doses
// --------------------------------------------------------------------------

// Inclusive [lo, hi] ranges the generator jitters within. design 2.1, 4.2.
export const MOBILITY_DOSE = Object.freeze({
  // 3-4 drills at 10-12 reps. Deliberately does NOT scale with available time:
  // three sets of dynamic stretching induced acute fatigue and impaired sprint
  // performance within five minutes. [corroborated]
  DYNAMIC_DRILLS: Object.freeze([3, 4]),
  DYNAMIC_REPS: Object.freeze([10, 12]),

  // ACSM: 10-30 s per hold, 2-4 repetitions per muscle group. [corroborated]
  // The old block spent ~3 min on a single stretch -- 1.5-9x the source.
  STATIC_STRETCHES: Object.freeze([3, 4]),
  STATIC_HOLD_SEC: Object.freeze([20, 30]),
  STATIC_HOLD_SETS: Object.freeze([2, 2]),

  // Core. 3 sets x 10-15 reps is [unverified] as a specific prescription and is
  // the least-sourced number in the design -- design 8, open question 4. It is
  // also the first thing packCooldown trims, which is deliberate.
  CORE_EXERCISES: Object.freeze([2, 2]),
  CORE_SETS: Object.freeze([3, 3]),
  CORE_REPS: Object.freeze([10, 15]),
  CORE_HOLD_SEC: Object.freeze([30, 45]),
  CORE_REST_SEC: Object.freeze([30, 45])
});
```

Change `SESSION_ORDER` to lead with `prep`:

```js
export const SESSION_ORDER = Object.freeze([
  // Dynamic preparation first. It used to run last, after the lifting it was
  // meant to prepare for -- the finding with real injury relevance.
  // design 4.2, discrepancy 6.
  'prep',
  'sprint',
  'plyometric',
  'power',
  'max-strength',
  'hypertrophy',
  'isolation',
  'conditioning',
  // Static stretching and core close the session: static work impairs
  // subsequent explosive performance. [corroborated] design 2.2.
  'mobility'
]);
```

Replace the `TIME` block:

```js
export const TIME = Object.freeze({
  // 70 -> 60. The whole saving comes from dosing mobility correctly; main work
  // is untouched. design 5.
  GYM_SESSION_TOTAL_MIN: 60,
  MAIN_WORK_MAX_MIN: 45,
  // Mandatory, never randomised out. Prep is capped by the drill dose rather
  // than by this figure; it is here so the three budgets can be seen to sum.
  PREP_MIN: 3,
  COOLDOWN_MIN: 12,
  // The withdrawn MOBILITY_CORE_MIN: 25 lived here. It had no source -- every
  // other number in this file carries one. design discrepancy 5.
  CONDITIONING_MAX_MIN: null,
  SECONDS_PER_REP: 3,
  DEFAULT_REST_SEC: 120,
  TRANSITION_SEC_PER_EXERCISE: 90,
  // Mobility work has no plates to change. Using the 90 s barbell figure put
  // the 3 min prep block at 8 min. [unverified] as an exact value.
  MOBILITY_TRANSITION_SEC: 15
});
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/
```

Expected: 10 passing. `js/templates.js` still names `TIME.MOBILITY_CORE_MIN` in
a comment — that is fine for now; Task 4 rewrites that comment.

- [ ] **Step 5: Commit**

```bash
git add js/rules.js tests/rules.test.mjs
git commit -m "Add the split modality vocabulary, mobility doses and the re-derived time budget"
```

---

## Task 4: Templates — two blocks, and a guard that fails loudly

**Files:**
- Modify: `js/templates.js:205-247`
- Create: `tests/templates.test.mjs`

**Interfaces:**
- Consumes: `MODALITIES`, `MOBILITY_DOSE` from Task 3.
- Produces:
  - `PREP_BLOCK: { full: SlotGroup[], short: SlotGroup[] }`
  - `COOLDOWN_BLOCK: { full: SlotGroup[], short: SlotGroup[] }`
  - `MOBILITY_CORE_BLOCK` is **deleted**. Task 6 removes its last consumer.
  - A slot group is the existing shape plus `count: [lo, hi]` and a `mode` of
    `'drill' | 'hold' | 'core'`. `'core'` is a slot-level marker: the builder
    resolves it per exercise to `'hold'` or `'reps'`.

**`short` variants.** `DAY_TYPES['aerobic-steady']` asks for `mobilityCore:
'short'`. The design does not discuss the short block, so it keeps its existing
intent — a park session still ends with the hips and ankles that just did the
work — now split the same way: 2–3 drills before, 2–3 stretches after, no core.

- [ ] **Step 1: Write the failing test**

Create `tests/templates.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREP_BLOCK, COOLDOWN_BLOCK, TEMPLATES } from '../js/templates.js';
import { MODALITIES } from '../js/rules.js';

const groups = [
  ...Object.values(PREP_BLOCK).flat(),
  ...Object.values(COOLDOWN_BLOCK).flat()
];

test('prep draws dynamic, cool-down draws static', () => {
  for (const g of Object.values(PREP_BLOCK).flat()) {
    assert.equal(g.modality, 'mobility-dynamic');
    assert.equal(g.role, 'prep');
    assert.equal(g.mode, 'drill');
  }
  const stretch = COOLDOWN_BLOCK.full.find(g => g.role === 'mobility');
  assert.equal(stretch.modality, 'mobility-static');
  assert.equal(stretch.mode, 'hold');
});

test('the full cool-down carries core, the short one does not', () => {
  assert.ok(COOLDOWN_BLOCK.full.some(g => g.role === 'core'));
  assert.ok(!COOLDOWN_BLOCK.short.some(g => g.role === 'core'));
});

test('no block is optional -- it is never randomised out', () => {
  for (const g of groups) assert.equal(g.optional, false);
});

test('every modality named anywhere is in the vocabulary', () => {
  const all = [...Object.values(TEMPLATES).flat(), ...groups];
  for (const g of all) {
    if (g.modality == null) continue;
    assert.ok(MODALITIES.includes(g.modality),
      `slot ${g.slot} names unknown modality "${g.modality}"`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/templates.test.mjs
```

Expected: FAIL — `PREP_BLOCK` is not exported.

- [ ] **Step 3: Replace the block definitions**

In `js/templates.js`, change the import to pull the new constants:

```js
import { ZONES, MODALITIES, MOBILITY_DOSE } from './rules.js';
```

Delete the whole `MOBILITY_CORE_BLOCK` export and its comment block, and put
this in its place:

```js
// --------------------------------------------------------------------------
// Prep and cool-down -- appended to every session, never randomised out
// --------------------------------------------------------------------------

// One block became two, because one block could not be in two places. Dynamic
// drills prepare the work and belong before it; static stretching impairs
// explosive performance and belongs after it. design 4.2, discrepancy 6.
//
// `count` is how many movements the block holds; the dose per movement comes
// from MOBILITY_DOSE and is stated in the unit the source uses -- reps for
// drills, seconds for holds.
export const PREP_BLOCK = Object.freeze({
  full: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      count: MOBILITY_DOSE.DYNAMIC_DRILLS, reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    })
  ]),
  short: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      count: Object.freeze([2, 3]), reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    })
  ])
});

export const COOLDOWN_BLOCK = Object.freeze({
  full: Object.freeze([
    Object.freeze({
      slot: 'M1', role: 'mobility', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-static', zone: null, mode: 'hold',
      count: MOBILITY_DOSE.STATIC_STRETCHES,
      holdSec: MOBILITY_DOSE.STATIC_HOLD_SEC,
      sets: MOBILITY_DOSE.STATIC_HOLD_SETS,
      effort: 'ease in -- no bouncing, no forcing', optional: false
    }),
    Object.freeze({
      // modality is null on purpose: core is selected by tier and pattern.
      // `mode: 'core'` tells the builder to resolve the dose per exercise --
      // a plank by time, an ab wheel by reps.
      slot: 'M2', role: 'core', tier: ['core'], patterns: ['core', 'rotate'],
      modality: null, zone: null, mode: 'core',
      count: MOBILITY_DOSE.CORE_EXERCISES,
      sets: MOBILITY_DOSE.CORE_SETS,
      reps: MOBILITY_DOSE.CORE_REPS,
      holdSec: MOBILITY_DOSE.CORE_HOLD_SEC,
      restSec: MOBILITY_DOSE.CORE_REST_SEC,
      optional: false
    })
  ]),
  short: Object.freeze([
    Object.freeze({
      slot: 'M1', role: 'mobility', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-static', zone: null, mode: 'hold',
      count: Object.freeze([2, 3]),
      holdSec: MOBILITY_DOSE.STATIC_HOLD_SEC,
      sets: MOBILITY_DOSE.STATIC_HOLD_SETS,
      effort: 'ease in -- no bouncing, no forcing', optional: false
    })
  ])
});
```

Then replace the sanity guard at the bottom of the file so it covers modalities
and the new blocks:

```js
// --------------------------------------------------------------------------
// Sanity guard
// --------------------------------------------------------------------------

// Every zone and every modality a slot names must exist in rules.js. Cheap to
// check at import time, and it turns a typo into an immediate error rather
// than a silently undefined prescription at the gym door.
//
// The modality half is what makes the 4.1 migration safe: if any slot still
// names the pre-split `mobility`, the app refuses to start instead of quietly
// filling the block from an empty pool.
const ALL_SLOT_GROUPS = [
  ...Object.entries(TEMPLATES).flatMap(([k, slots]) => slots.map(s => [k, s])),
  ...Object.entries(PREP_BLOCK).flatMap(([k, slots]) => slots.map(s => [`prep.${k}`, s])),
  ...Object.entries(COOLDOWN_BLOCK).flatMap(([k, slots]) => slots.map(s => [`cooldown.${k}`, s]))
];

for (const [where, slot] of ALL_SLOT_GROUPS) {
  if (slot.zone != null && !(slot.zone in ZONES)) {
    throw new Error(
      `templates.js: ${where} slot ${slot.slot} names unknown zone "${slot.zone}"`
    );
  }
  if (slot.modality != null && !MODALITIES.includes(slot.modality)) {
    throw new Error(
      `templates.js: ${where} slot ${slot.slot} names unknown modality "${slot.modality}"`
    );
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/
```

Expected: 14 passing. `js/generator.js` still imports `MOBILITY_CORE_BLOCK` and
will now throw on import — that is expected and Task 6 fixes it. Until
`tests/session.test.mjs` exists, nothing imports the generator, so the suite
stays green.

- [ ] **Step 5: Prove the guard's premise**

```
node --input-type=module -e "
import { MODALITIES } from './js/rules.js';
console.log('mobility still in vocabulary:', MODALITIES.includes('mobility'));
"
```

Expected: `false`. That is the property the guard rests on.

- [ ] **Step 6: Commit**

```bash
git add js/templates.js tests/templates.test.mjs
git commit -m "Split the mobility block into prep and cool-down -- design 4.2"
```

---

## Task 5: Generator — estimate the new dose units

**Files:**
- Modify: `js/generator.js:368-377` (`estimateMinutes`)
- Create: `tests/mobility.test.mjs`

**Interfaces:**
- Consumes: `TIME.MOBILITY_TRANSITION_SEC` from Task 3.
- Produces:
  - `estimateMinutes(blocks)` — unchanged signature, now understands
    `mode: 'drill'` (`sets × reps × SECONDS_PER_REP`, doubled when `perSide`)
    and `mode: 'hold'` (`sets × holdSec`, doubled when `perSide`, plus rests).
  - `countsTowardVolume(block): boolean` — exported, used by `finalise`.

- [ ] **Step 1: Write the failing test**

Create `tests/mobility.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMinutes, countsTowardVolume } from '../js/generator.js';

const drill = (over = {}) => ({
  role: 'prep', mode: 'drill', sets: 1, reps: 12, restSec: 0, ...over
});
const hold = (over = {}) => ({
  role: 'mobility', mode: 'hold', sets: 2, holdSec: 30, reps: 1, restSec: 0, ...over
});

test('a prep block of four drills lands near the 3 min budget', () => {
  const blocks = [drill(), drill(), drill(), drill()];
  const mins = estimateMinutes(blocks);
  assert.ok(mins >= 2 && mins <= 4, `prep estimated at ${mins} min, expected 2-4`);
});

test('unilateral work costs double -- it is done per side', () => {
  assert.ok(
    estimateMinutes([hold({ perSide: true })]) > estimateMinutes([hold()]),
    'a per-side hold must cost more than a bilateral one'
  );
});

test('a hold is priced in seconds held, not in reps', () => {
  const short = estimateMinutes([hold({ holdSec: 20 }), hold({ holdSec: 20 }),
                                 hold({ holdSec: 20 }), hold({ holdSec: 20 })]);
  const long = estimateMinutes([hold({ holdSec: 30 }), hold({ holdSec: 30 }),
                                hold({ holdSec: 30 }), hold({ holdSec: 30 })]);
  assert.ok(long > short, 'a longer hold must cost more');
});

test('mobility work does not pay the 90 s barbell transition', () => {
  // Four drills at the barbell transition would be over 8 min. That is the bug
  // this branch exists to prevent.
  assert.ok(estimateMinutes([drill(), drill(), drill(), drill()]) < 6);
});

test('prep, static and core contribute nothing to volume accounting', () => {
  assert.equal(countsTowardVolume(drill()), false);
  assert.equal(countsTowardVolume(hold()), false);
  assert.equal(countsTowardVolume({ role: 'core', mode: 'reps', sets: 3 }), false);
  assert.equal(countsTowardVolume({ role: 'primary', mode: 'load', sets: 3 }), true);
  assert.equal(countsTowardVolume({ role: 'primary', mode: 'reps', sets: 3 }), true);
  assert.equal(countsTowardVolume({ role: 'primary', mode: 'contacts', sets: 3 }), true);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/mobility.test.mjs
```

Expected: FAIL — `countsTowardVolume` is not exported, and the drill estimates
are wrong because every non-`time` block currently pays the 90 s transition.

- [ ] **Step 3: Rewrite `estimateMinutes` and add `countsTowardVolume`**

Replace `estimateMinutes` in `js/generator.js` with:

```js
// Mobility work has no plates to change and no bar to load. Charging it the
// barbell transition put the 3 min prep block at 8 min.
const LIGHT_TRANSITION_ROLES = new Set(['prep', 'mobility', 'core']);
const transitionSec = b =>
  LIGHT_TRANSITION_ROLES.has(b.role)
    ? TIME.MOBILITY_TRANSITION_SEC
    : TIME.TRANSITION_SEC_PER_EXERCISE;

export function estimateMinutes(blocks) {
  let sec = 0;
  for (const b of blocks) {
    if (b.mode === 'time') { sec += (b.durationMin || 0) * 60; continue; }

    const sides = b.perSide ? 2 : 1;

    if (b.mode === 'drill') {
      sec += b.sets * b.reps * TIME.SECONDS_PER_REP * sides;
      sec += transitionSec(b);
      continue;
    }
    if (b.mode === 'hold') {
      sec += b.sets * b.holdSec * sides;
      sec += b.sets * (b.restSec || 0);
      sec += transitionSec(b);
      continue;
    }

    sec += b.sets * b.reps * TIME.SECONDS_PER_REP * sides;
    sec += b.sets * (b.restSec || TIME.DEFAULT_REST_SEC);
    sec += transitionSec(b);
  }
  return Math.round(sec / 60);
}

// Which blocks count as training volume. Mobility and core were excluded
// before the split too -- they were all mode 'time', which scored zero sets.
// Keeping them out is parity, not a new decision: the neglect model and the
// rolling pattern counts read these numbers, and design 4.4 is about to make
// the exercise count read them as well.
const VOLUME_MODES = new Set(['load', 'contacts', 'reps']);
export function countsTowardVolume(block) {
  if (!VOLUME_MODES.has(block.mode)) return false;
  return block.role !== 'core';
}
```

`sides` now also applies to ordinary `load` blocks. That is a bug fix in the
same direction as the rest of this work — a unilateral accessory really does
take twice as long — and it can only make the pack step more conservative.

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/mobility.test.mjs
```

Expected: 5 passing. If the generator import throws because
`MOBILITY_CORE_BLOCK` is already gone from `templates.js`, complete Task 6 and
re-run.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/mobility.test.mjs
git commit -m "Teach estimateMinutes the drill and hold dose units"
```

---

## Task 6: Generator — build prep and cool-down

**Files:**
- Modify: `js/generator.js:404-441` (`buildMobilityCore` and its imports)
- Modify: `tests/mobility.test.mjs`

**Interfaces:**
- Consumes: `PREP_BLOCK`, `COOLDOWN_BLOCK` (Task 4); `estimateMinutes`,
  `countsTowardVolume` (Task 5); the existing `fillSlot`, `intBetween`,
  `between`.
- Produces:
  - `buildPrep(dayType, library, ctx, rng): Block[]` — role `'prep'`,
    mode `'drill'`.
  - `buildCooldown(dayType, library, ctx, rng): Block[]` — roles `'mobility'`
    and `'core'`, modes `'hold'` and `'reps'`.
  - `packCooldown(blocks, budgetMin?): { blocks, overBudget }`.
  - `buildMobilityCore` is **deleted**.
  - Every emitted block carries `perSide: boolean`.

**Exclusions change deliberately.** `buildMobilityCore` used a fresh
`excludeIds` set, so a mobility pick could in principle repeat a main-work
exercise. These builders mutate the shared `ctx.excludeIds`, which makes "no
repeated exercise inside a session" structural rather than lucky.

- [ ] **Step 1: Write the failing test**

Append to `tests/mobility.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { buildPrep, buildCooldown, packCooldown, makeRng } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const freshCtx = () => ({
  soreness: {}, banned: [], venue: 'gym', state: null, excludeIds: new Set()
});

test('prep is 3-4 dynamic drills, dosed in reps', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const blocks = buildPrep('max-strength', LIB, freshCtx(), makeRng(seed));
    assert.ok(blocks.length >= 3 && blocks.length <= 4, `got ${blocks.length}`);
    for (const b of blocks) {
      assert.equal(b.mode, 'drill');
      assert.equal(b.role, 'prep');
      assert.ok(b.reps >= 10 && b.reps <= 12, `${b.name} got ${b.reps} reps`);
      assert.equal(b.optional, false);
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(e.modalities.includes('mobility-dynamic'),
        `${b.name} is not a dynamic drill`);
    }
  }
});

test('the cool-down is static stretches plus core, and no drill', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const blocks = buildCooldown('max-strength', LIB, freshCtx(), makeRng(seed));
    const statics = blocks.filter(b => b.role === 'mobility');
    const core = blocks.filter(b => b.role === 'core');
    assert.ok(statics.length >= 3 && statics.length <= 4);
    assert.equal(core.length, 2);
    for (const b of statics) {
      assert.equal(b.mode, 'hold');
      assert.ok(b.holdSec >= 20 && b.holdSec <= 30, `held ${b.holdSec}s`);
      assert.ok(b.sets >= 2 && b.sets <= 4);
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(e.modalities.includes('mobility-static'));
    }
    assert.ok(!blocks.some(b => b.mode === 'drill'),
      'no dynamic drill may appear in the cool-down');
  }
});

test('isometric core is dosed by time, everything else by reps', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const core = buildCooldown('hypertrophy', LIB, freshCtx(), makeRng(seed))
      .filter(b => b.role === 'core');
    for (const b of core) {
      const e = LIB.find(x => x.id === b.exerciseId);
      if (e.isometric) {
        assert.equal(b.mode, 'hold', `${b.name} is a hold, dosed as ${b.mode}`);
        assert.ok(b.holdSec >= 30 && b.holdSec <= 45);
      } else {
        assert.equal(b.mode, 'reps', `${b.name} is rep work, dosed as ${b.mode}`);
        assert.ok(b.reps >= 10 && b.reps <= 15);
      }
    }
  }
});

test('unilateral movements are flagged per side', () => {
  const ctx = freshCtx();
  const blocks = [
    ...buildPrep('max-strength', LIB, ctx, makeRng(7)),
    ...buildCooldown('max-strength', LIB, ctx, makeRng(7))
  ];
  for (const b of blocks) {
    const e = LIB.find(x => x.id === b.exerciseId);
    assert.equal(b.perSide, !!e.unilateral, `${b.name} per-side flag is wrong`);
  }
});

test('nothing repeats within a session', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ctx = freshCtx();
    const rng = makeRng(seed);
    const ids = [
      ...buildPrep('max-strength', LIB, ctx, rng),
      ...buildCooldown('max-strength', LIB, ctx, rng)
    ].map(b => b.exerciseId);
    assert.equal(new Set(ids).size, ids.length, 'a movement was repeated');
  }
});

test('an outdoor day gets prep and stretches but no core', () => {
  const ctx = { ...freshCtx(), venue: 'outdoor' };
  const rng = makeRng(3);
  const prep = buildPrep('aerobic-steady', LIB, ctx, rng);
  const cool = buildCooldown('aerobic-steady', LIB, ctx, rng);
  assert.ok(prep.length >= 2 && prep.length <= 3);
  assert.ok(!cool.some(b => b.role === 'core'));
});

test('packCooldown holds the 12 min budget without gutting the dose', () => {
  const ctx = freshCtx();
  const raw = buildCooldown('max-strength', LIB, ctx, makeRng(11));
  const packed = packCooldown(raw);
  assert.ok(packed.blocks.filter(b => b.role === 'mobility').length >= 3,
    'never trims below 3 stretches');
  for (const b of packed.blocks.filter(b => b.role === 'mobility')) {
    assert.ok(b.sets >= 2, 'never drops a hold below the ACSM 2-rep floor');
    assert.ok(b.holdSec >= 20, 'never shortens a hold below the ACSM floor');
  }
  for (const b of packed.blocks.filter(b => b.role === 'core')) {
    assert.ok(b.sets >= 2, 'never trims core below 2 sets');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/mobility.test.mjs
```

Expected: FAIL — `buildPrep` is not exported.

- [ ] **Step 3: Replace `buildMobilityCore`**

Change the `templates.js` import at the top of `js/generator.js` from
`MOBILITY_CORE_BLOCK` to `PREP_BLOCK, COOLDOWN_BLOCK`, then replace the whole
step-9 section:

```js
// --------------------------------------------------------------------------
// 9  PREP and COOL-DOWN -- never randomised out
// --------------------------------------------------------------------------

// One block became two, because one block could not be in two places. Dynamic
// drills prepare the work and run before it; static stretching impairs
// explosive output and runs after. design 4.2, discrepancy 6.

export function buildPrep(dayType, library, ctx, rng) {
  return buildBlockGroups(groupsFor(PREP_BLOCK, dayType), library, ctx, rng);
}

export function buildCooldown(dayType, library, ctx, rng) {
  return buildBlockGroups(groupsFor(COOLDOWN_BLOCK, dayType), library, ctx, rng);
}

function groupsFor(block, dayType) {
  const kind = DAY_TYPES[dayType] ? DAY_TYPES[dayType].mobilityCore : 'full';
  return block[kind] || block.full;
}

// Mutates ctx.excludeIds on purpose: prep, main work and cool-down draw from
// one library, and a movement should appear once in a session.
function buildBlockGroups(groups, library, ctx, rng) {
  const out = [];
  for (const group of groups) {
    const n = intBetween(rng, group.count);
    for (let i = 0; i < n; i++) {
      const e = fillSlot(group, library, ctx, rng);
      if (!e) break;                       // pool exhausted -- short block
      ctx.excludeIds.add(e.id);
      out.push(prescribeMobility(group, e, rng));
    }
  }
  return out;
}

const roundTo5 = v => Math.round(v / 5) * 5;

// Dosing follows from the tag, which is the point of the 4.1 split. Nothing
// here divides a budget by a movement count -- that arithmetic was the bug.
function prescribeMobility(group, e, rng) {
  const base = {
    slot: group.slot,
    role: group.role,
    exerciseId: e.id,
    name: e.name,
    pattern: e.pattern,
    perSide: !!e.unilateral,
    cnsCost: e.cnsCost,
    optional: false
  };

  if (group.mode === 'drill') {
    return {
      ...base, mode: 'drill',
      sets: 1, reps: intBetween(rng, group.reps),
      restSec: 0, effort: group.effort
    };
  }

  if (group.mode === 'hold') {
    return {
      ...base, mode: 'hold',
      sets: intBetween(rng, group.sets),
      holdSec: roundTo5(between(rng, group.holdSec)),
      reps: 1, restSec: 0, effort: group.effort
    };
  }

  // group.mode === 'core' -- resolved per exercise: a plank by time, an ab
  // wheel by reps. design 2.1.
  if (e.isometric) {
    return {
      ...base, mode: 'hold',
      sets: intBetween(rng, group.sets),
      holdSec: roundTo5(between(rng, group.holdSec)),
      reps: 1,
      restSec: intBetween(rng, group.restSec),
      effort: 'brace hard -- keep breathing'
    };
  }
  return {
    ...base, mode: 'reps',
    sets: intBetween(rng, group.sets),
    reps: intBetween(rng, group.reps),
    restSec: intBetween(rng, group.restSec),
    effort: 'leave 2-3 reps in reserve'
  };
}

// Hold the cool-down to its budget so the 60 min session total is a fact
// rather than an aspiration. Trims in order of how well sourced the number is:
// core sets are [unverified] (design 8, q4) so they go first; the ACSM hold
// dose is never shortened, and the stretch count never falls below three.
export function packCooldown(blocks, budgetMin = TIME.COOLDOWN_MIN) {
  const out = blocks.slice();
  let guard = 0;

  while (estimateMinutes(out) > budgetMin && guard++ < 20) {
    const core = out
      .filter(b => b.role === 'core' && b.sets > 2)
      .sort((a, b) => b.sets - a.sets)[0];
    if (core) { core.sets -= 1; continue; }

    const statics = out.filter(b => b.role === 'mobility');
    if (statics.length > 3) {
      out.splice(out.indexOf(statics[statics.length - 1]), 1);
      continue;
    }
    break;                                  // nothing left that may be trimmed
  }

  return { blocks: out, overBudget: estimateMinutes(out) > budgetMin };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/
```

Expected: all green except anything that still calls `buildMobilityCore` —
`generate()` does, and Task 7 fixes it.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/mobility.test.mjs
git commit -m "Replace buildMobilityCore with buildPrep and buildCooldown"
```

---

## Task 7: Generator — order the session and wire the pipeline

**Files:**
- Modify: `js/generator.js:443-467` (`orderClass`), `:505-520` (`generate`),
  `:522-560` (`finalise`)
- Create: `tests/session.test.mjs`

**Interfaces:**
- Consumes: `buildPrep`, `buildCooldown`, `packCooldown`,
  `countsTowardVolume`; `SESSION_ORDER` with `prep` first.
- Produces: `generate()` returns a session whose `blocks` open with every
  `role: 'prep'` block and close with the cool-down, and whose `warnings`
  may include a cool-down-over-budget line and a short-cool-down line.

- [ ] **Step 1: Write the failing test**

Create `tests/session.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
import { TIME, SESSION_ORDER } from '../js/rules.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const COOLDOWN_ROLES = ['mobility', 'core'];
const isMain = b => b.role !== 'prep' && !COOLDOWN_ROLES.includes(b.role);

// Ramp week N is derived from returnDate; walk it across the whole ramp.
const sessions = [];
for (const dayType of PHASE_1_DAY_TYPES) {
  for (let week = 1; week <= 5; week++) {
    for (let seed = 1; seed <= 40; seed++) {
      const now = Date.now();
      sessions.push(generate({
        library: LIB,
        profile: {
          returnDate: new Date(now - (week - 1) * 7 * DAY)
            .toISOString().slice(0, 10)
        },
        history: [], soreness: {}, dayType, seed, now
      }));
    }
  }
}

test('the sweep produced sessions for every day type and ramp week', () => {
  assert.equal(sessions.length, PHASE_1_DAY_TYPES.length * 5 * 40);
});

// design 7 -- the ordering assertion, and the reason this work exists.
test('every dynamic drill sorts before every main-work block', () => {
  for (const s of sessions) {
    const lastPrep = s.blocks.map(b => b.role).lastIndexOf('prep');
    const firstMain = s.blocks.findIndex(isMain);
    if (lastPrep === -1 || firstMain === -1) continue;
    assert.ok(lastPrep < firstMain,
      `${s.dayType}/${s.seed}: prep ran after the main work`);
  }
});

test('every static stretch and core block sorts after the main work', () => {
  for (const s of sessions) {
    const lastMain = s.blocks.map(isMain).lastIndexOf(true);
    const firstCool = s.blocks.findIndex(b => COOLDOWN_ROLES.includes(b.role));
    if (lastMain === -1 || firstCool === -1) continue;
    assert.ok(firstCool > lastMain,
      `${s.dayType}/${s.seed}: cool-down ran before the main work ended`);
  }
});

test('no drill is ever dosed in minutes and no stretch in reps', () => {
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (b.role === 'prep') assert.equal(b.mode, 'drill');
      if (b.role === 'mobility') assert.equal(b.mode, 'hold');
      assert.notEqual(b.mode, 'time',
        'no block should still be dosed by raw minutes');
    }
  }
});

test('no session exceeds the 60 minute total', () => {
  for (const s of sessions) {
    assert.ok(s.durationMin <= TIME.GYM_SESSION_TOTAL_MIN,
      `${s.dayType}/${s.seed} ran ${s.durationMin} min`);
  }
});

test('every session carries a prep block and a cool-down', () => {
  for (const s of sessions) {
    assert.ok(s.blocks.some(b => b.role === 'prep'),
      `${s.dayType}/${s.seed} has no prep`);
    assert.ok(s.blocks.some(b => b.role === 'mobility'),
      `${s.dayType}/${s.seed} has no cool-down`);
  }
});

test('mobility and core contribute nothing to pattern volume', () => {
  for (const s of sessions) {
    assert.equal(s.patternSets.mobility, undefined,
      'mobility work must not be counted as training volume');
  }
});

test('no movement is repeated inside a session', () => {
  for (const s of sessions) {
    const ids = s.blocks.map(b => b.exerciseId);
    assert.equal(new Set(ids).size, ids.length,
      `${s.dayType}/${s.seed} repeated a movement`);
  }
});

test('the same seed reproduces the same session', () => {
  const a = generate({ library: LIB, dayType: 'power', seed: 99, now: 1e12 });
  const b = generate({ library: LIB, dayType: 'power', seed: 99, now: 1e12 });
  assert.deepEqual(a.blocks.map(x => x.exerciseId), b.blocks.map(x => x.exerciseId));
});

test('prep leads SESSION_ORDER', () => {
  assert.equal(SESSION_ORDER[0], 'prep');
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/session.test.mjs
```

Expected: FAIL — `generate` still calls `buildMobilityCore`.

- [ ] **Step 3: Rewrite `orderClass` and the pipeline tail**

Replace `orderClass`:

```js
// Map a block to its position in the fixed sequence. Dynamic prep opens,
// lifting precedes conditioning, static mobility and core close.
// basis 6, 8; design 4.2.
function orderClass(block, slotZone) {
  // Role first: a prep drill and a cool-down stretch share pattern 'mobility'
  // and are told apart by role alone. Lumping them was discrepancy 6.
  if (block.role === 'prep') return 'prep';
  if (block.role === 'mobility' || block.role === 'core') return 'mobility';
  // A rotate or core movement that landed in a main-work accessory slot still
  // closes the session.
  if (block.pattern === 'core' || block.pattern === 'rotate') return 'mobility';
  if (block.pattern === 'sprint') return 'sprint';
  if (block.pattern === 'jump' || block.pattern === 'throw') return 'plyometric';
  if (block.pattern === 'locomotion') return 'conditioning';
  if (slotZone === 'powerSingle' || slotZone === 'powerMultiple' || slotZone === 'dynamicEffort') return 'power';
  if (slotZone === 'maxStrength') return 'max-strength';
  if (slotZone === 'muscularEndurance') return 'isolation';
  return 'hypertrophy';
}
```

In `generate()`, replace the step 9–10 lines:

```js
  const packed = packToBudget(blocks);                                   // 8
  const prep = buildPrep(chosen, library, ctx, rng);                     // 9a
  const cooled = packCooldown(
    buildCooldown(chosen, library, ctx, rng)                             // 9b
  );
  const ordered = orderSession(
    prep.concat(packed.blocks, cooled.blocks), zoneBySlot                // 10
  );

  return finalise({
    chosen, env, architecture, proposal, ordered, packed, cooled,
    unfilled, state, seed, now
  });
```

In `finalise`, take `cooled` in the destructured parameter, swap the volume
test, and add the two warnings:

```js
function finalise({ chosen, env, architecture, proposal, ordered, packed, cooled, unfilled, state, seed, now }) {
  const patternSets = {};
  let footContacts = 0, sprintMeters = 0, cnsLoad = 0;
  for (const b of ordered) {
    if (countsTowardVolume(b)) {
      patternSets[b.pattern] = (patternSets[b.pattern] || 0) + b.sets;
    }
    footContacts += b.footContacts || 0;
    sprintMeters += b.sprintMeters || 0;
    cnsLoad += b.cnsCost || 0;
  }

  const warnings = [];
  if (packed.overBudget) warnings.push('over the 45 min main-work budget after trimming');
  if (cooled && cooled.overBudget) warnings.push('cool-down over its 12 min budget');
  if (unfilled.length) warnings.push(`no eligible exercise for slot ${unfilled.join(', ')}`);
  // Deviation 4: the static pool is thin, and a sore joint thins it further.
  // A short cool-down is acceptable; a silent one is not.
  const statics = ordered.filter(b => b.role === 'mobility').length;
  if (statics > 0 && statics < 3) {
    warnings.push(`only ${statics} static stretches available today`);
  }
```

The rest of `finalise` is unchanged.

- [ ] **Step 4: Run the whole suite and watch it pass**

```
node --test tests/
```

Expected: all green. If "no session exceeds the 60 minute total" fails, do not
raise the constant — read the failing session's block list and find which dose
overran. That constant is the design's central claim.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/session.test.mjs
git commit -m "Order prep before the main work and the cool-down after it -- discrepancy 6"
```

---

## Task 8: UI — three groups, and doses printed in the right unit

**Files:**
- Modify: `js/ui.js:56-80` (`loadLine`), `:82-87` (`volumeLine`),
  `:134-160` (`renderSession`)
- Create: `tests/ui.test.mjs`

**Interfaces:**
- Consumes: blocks carrying `mode: 'drill' | 'hold'` and `perSide`.
- Produces: `loadLine` renders `12 reps` / `12 reps per side` /
  `30s hold` / `30s hold per side`; `renderSession` emits three groups titled
  `Prep`, `Main work`, `Cool-down`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLine, volumeLine } from '../js/ui.js';

test('a drill prints reps, never minutes', () => {
  assert.equal(loadLine({ mode: 'drill', reps: 12, sets: 1 }), '12 reps');
  assert.equal(
    loadLine({ mode: 'drill', reps: 10, sets: 1, perSide: true }),
    '10 reps per side'
  );
});

test('a hold prints seconds', () => {
  assert.equal(loadLine({ mode: 'hold', holdSec: 30, sets: 2 }), '30s hold');
  assert.equal(
    loadLine({ mode: 'hold', holdSec: 25, sets: 2, perSide: true }),
    '25s hold per side'
  );
});

test('the volume chip suits the dose', () => {
  assert.equal(volumeLine({ mode: 'drill', sets: 1, reps: 12 }), '');
  assert.equal(volumeLine({ mode: 'hold', sets: 2, holdSec: 30 }), '× 2');
  assert.equal(volumeLine({ mode: 'reps', sets: 3, reps: 12 }), '3 × 12');
});
```

`renderSession` needs a DOM and is checked in the browser in Task 10, not here.

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/ui.test.mjs
```

Expected: FAIL — `loadLine` falls through to the load branch and throws on the
missing `displayMultiplier`.

- [ ] **Step 3: Edit `js/ui.js`**

Add two branches at the top of `loadLine`, right after the `time` branch:

```js
  // Dosed in reps because that is the unit the source uses. Printing "3 min"
  // over a leg swing was the wrong unit, not merely the wrong amount.
  // design 2.1, discrepancy 4.
  if (block.mode === 'drill') {
    return block.perSide ? `${block.reps} reps per side` : `${block.reps} reps`;
  }
  if (block.mode === 'hold') {
    return block.perSide
      ? `${block.holdSec}s hold per side`
      : `${block.holdSec}s hold`;
  }
```

Replace `volumeLine`:

```js
export function volumeLine(block) {
  if (block.mode === 'time') return '';
  // A drill is one set by definition; "1 × 12" is noise next to "12 reps".
  if (block.mode === 'drill') return '';
  // For a hold the hero line already carries the seconds, so the chip carries
  // how many of them.
  if (block.mode === 'hold') return `× ${block.sets}`;
  return `${block.sets} × ${block.reps}`;
}
```

Replace the group split in `renderSession`:

```js
  const COOLDOWN_ROLES = ['mobility', 'core'];
  const prep = session.blocks.filter(b => b.role === 'prep');
  const cooldown = session.blocks.filter(b => COOLDOWN_ROLES.includes(b.role));
  const main = session.blocks.filter(
    b => b.role !== 'prep' && !COOLDOWN_ROLES.includes(b.role)
  );
```

and the three group calls, in session order:

```js
    blockGroup('Prep', prep),
    blockGroup('Main work', main),
    blockGroup('Cool-down', cooldown),
```

- [ ] **Step 4: Run the whole suite and watch it pass**

```
node --test tests/
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js tests/ui.test.mjs
git commit -m "Render prep and cool-down as separate groups with their own dose units"
```

---

## Task 9: Sweep the whole thing and check the pools hold up

**Files:**
- Modify: `tests/session.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: no source change — this task either passes or sends you back.

- [ ] **Step 1: Add the adversarial cases**

Append to `tests/session.test.mjs`:

```js
// Deviation 4 under load: a hurt joint bans every exercise touching it.
test('a hurt hip still yields a usable cool-down', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({
      library: LIB, dayType: 'hypertrophy', seed, now: 1e12,
      soreness: { hip: 'hurt' }
    });
    const statics = s.blocks.filter(b => b.role === 'mobility');
    assert.ok(statics.length >= 2,
      `seed ${seed}: a hurt hip left ${statics.length} stretches`);
    if (statics.length < 3) {
      assert.ok(s.warnings.some(w => w.includes('static stretches')),
        'a short cool-down must be announced, not silent');
    }
    for (const b of s.blocks) {
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(!(e.joints || []).includes('hip'),
        `${b.name} loads a hurt hip`);
    }
  }
});

test('the outdoor day still gets a split block', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({ library: LIB, dayType: 'aerobic-steady', seed, now: 1e12 });
    assert.ok(s.blocks.some(b => b.role === 'prep'));
    assert.ok(s.blocks.some(b => b.role === 'mobility'));
    for (const b of s.blocks) {
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(e.venue === 'either' || e.venue === 'outdoor',
        `${b.name} is gym-only on an outdoor day`);
    }
  }
});

test('the session never quietly loses its prep block to a ban list', () => {
  // Ban four dynamic drills and check the block still fills.
  const banned = LIB
    .filter(e => e.modalities.includes('mobility-dynamic'))
    .slice(0, 4).map(e => e.id);
  const s = generate({
    library: LIB, dayType: 'power', seed: 5, now: 1e12, profile: { banned }
  });
  assert.ok(s.blocks.filter(b => b.role === 'prep').length >= 3);
});
```

- [ ] **Step 2: Run the full suite**

```
node --test tests/
```

Expected: all green. A failure here is a real finding — report it rather than
loosening the assertion.

- [ ] **Step 3: Eyeball one session per day type**

```
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { generate } from './js/generator.js';
import { PHASE_1_DAY_TYPES } from './js/templates.js';
const LIB = JSON.parse(readFileSync('./data/exercises.json','utf8')).exercises;
for (const d of PHASE_1_DAY_TYPES) {
  const s = generate({ library: LIB, dayType: d, seed: 42, now: 1e12 });
  console.log('\n== ' + d + ' -- ' + s.durationMin + ' min ==');
  for (const b of s.blocks) {
    const dose = b.mode === 'drill' ? b.reps + ' reps'
      : b.mode === 'hold' ? b.holdSec + 's x ' + b.sets
      : b.sets + ' x ' + b.reps;
    console.log(' ', b.role.padEnd(9), b.name.padEnd(34), dose,
      b.perSide ? '(per side)' : '');
  }
  if (s.warnings.length) console.log('  warnings:', s.warnings.join('; '));
}
"
```

Read the output. Prep must be at the top, stretches and core at the bottom, no
drill dosed in minutes, no plank dosed in reps. This is the check the gym
session would have caught in ten seconds.

- [ ] **Step 4: Commit**

```bash
git add tests/session.test.mjs
git commit -m "Sweep prep and cool-down against sore joints, venues and ban lists"
```

---

## Task 10: Documentation, cache version, and a real browser

**Files:**
- Modify: `sw.js:18`
- Modify: `docs/programming-basis.md` (§9)
- Modify: `docs/design-mobility-and-warmup.md` (§4.6, §8)
- Modify: `docs/spec.md` (§10)

- [ ] **Step 1: Fold the discrepancies into the basis**

In `docs/programming-basis.md`, replace §9's bare bullet list with the
re-derived budget from design §5 — prep 3 / main 45 / cool-down 12 / total 60 —
and add discrepancies 4, 5 and 6 to the discrepancy list, continuing the
existing numbering and matching its format. The text is in design §3; the point
of moving it is that the basis is the file that holds the training science, and
the design doc is a working document.

- [ ] **Step 2: Mark step 1 shipped in the design doc**

Under §4.6 in `docs/design-mobility-and-warmup.md`, mark step 1 done with the
date, and note that steps 2–4 are unstarted. Add a line to §8 recording that the
static pool is thin (deviation 4) and that widening it is the next data job.

- [ ] **Step 3: Update the resume point**

In `docs/spec.md` §10, move the mobility split from "next" to done, describing
what it changed the way the other items are described, and name step 2
(warm-up ramps, design §4.3) as the new resume point. Note the two live
findings: the thin static pool, and that design §4.4 still needs the
pattern-level weekly volume figure sourced before it can ship.

- [ ] **Step 4: Bump the service worker**

In `sw.js`, change `const VERSION = 'v3';` to `'v4'`. Every js file and
`exercises.json` changed; without this bump, installed phones serve the old
cache forever.

- [ ] **Step 5: Commit**

```bash
git add docs/ sw.js
git commit -m "Record the mobility split in the docs and bump the cache to v4"
```

- [ ] **Step 6: Verify in a real browser, on the real subpath**

Headless passed clean once while two real bugs sat in the code. Serve the repo
from a parent directory so the app sits at `/GymBuddy/`, exactly as Pages does:

```bash
cd .. && python -m http.server 8080
```

Open `http://localhost:8080/GymBuddy/` and check, by eye:

- three groups appear, in order: **Prep**, **Main work**, **Cool-down**
- a drill reads `12 reps`, never `3 min`
- a stretch reads `30s hold`, with `× 2` in the corner
- a unilateral movement says `per side`
- a plank reads as a hold, an ab wheel as reps
- reroll several times and watch the order hold
- the header duration reads ≤ 60 min
- DevTools → Application → Service Workers: `gymbuddy-v4` is the active cache

- [ ] **Step 7: Report before pushing**

Do not push. Report what the browser showed and list any warning strings that
appeared. `7a22cbe` is still unpushed too, and the identity check on the public
repo happens before anything leaves the machine.
