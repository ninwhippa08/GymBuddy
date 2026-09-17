# Reps, Weight and Pairing by Exercise Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prescribe reps, rest and load from what the exercise is, never a load heavier than its reps allow, at most one heavy squat/hinge per max-strength or hypertrophy session, and at most 10 direct sets per pattern per session.

**Architecture:** Three pure additions (`repMax`, `loadGroupFor`, `isHeavyLower`) and constants in `js/rules.js`; `prescribe()` draws reps → reps-in-reserve → load; `ladderise()` gains a per-rung rep-derived bound; `eligibleFor` reads a `heavyLowerTaken` flag set by `generate()` and `swapBlock()`; `capPatternSets()` runs after `packToBudget`.

**Tech Stack:** Plain ES modules, `node --test`, no dependencies. Run the suite with `node --test tests/*.test.mjs` (~75 s).

**Spec:** `docs/superpowers/specs/2026-09-16-rep-method-design.md`

## Global Constraints

- Zero dependencies. No npm, no build step.
- House style: every constant carries its source and a `[verified]` / `[corroborated]` / `[unverified]` tag inline.
- Groups: `light` = slot modality `isolation` or `cnsCost` 1 → reps 10–15, RIR 1–2, rest 60–90 s. `heavy` = `loadable` and `cnsCost` 3 → reps 6–8, RIR 2–3, rest 120–180 s. `compound` = everything else → reps 8–12, RIR 2, rest 120–180 s. First match wins in that order.
- Group reps and rest apply only on `hypertrophy`-zone slots. RIR and weight-from-reps apply on `maxStrength`, `hypertrophy`, `muscularEndurance`. Power zones, `contacts`, `time`, `interval`: untouched.
- Pair rule on day types `max-strength` and `hypertrophy` only.
- Cap: 10 direct `load`/`reps` sets per pattern per session, floors two working sets on a ramped block, one otherwise.
- A guard is trusted only after it has been watched failing (against today's code, or by deliberate mutation). Record which in the commit message.
- Smoke tests go through `generate()`, not only through `prescribe()`.
- Never widen a budget or allowance to make a test pass. If session length crosses 70 min, STOP and report to the athlete (Task 6).
- Commits use the GitHub noreply identity already configured. End each message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. **Do not push** until Task 7 and the athlete's OK.

---

### Task 1: `repMax`, load groups and heavy-lower classification

**Files:**
- Modify: `js/rules.js` (after `PCT_JITTER`, ~line 166; `VOLUME` ~line 220)
- Modify: `js/generator.js` (import block lines 23-30; new exports after `clamp`, ~line 59)
- Create: `tests/load-groups.test.mjs`

**Interfaces:**
- Produces: `LOAD_GROUPS`, `RIR_ZONES`, `GROUP_DOSED_ZONES`, `ONE_HEAVY_LOWER_DAY_TYPES`, `HEAVY_LOWER_PATTERNS`, `VOLUME.SETS_PER_PATTERN_PER_SESSION` from `rules.js`; `repMax(n: number): number`, `loadGroupFor(exercise, slot = null): 'light'|'heavy'|'compound'`, `isHeavyLower(exercise): boolean` from `generator.js`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/load-groups.test.mjs
// Reps, weight and pairing by what the exercise is.
// docs/superpowers/specs/2026-09-16-rep-method-design.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repMax, loadGroupFor, isHeavyLower } from '../js/generator.js';
import { REP_TO_PCT, LOAD_GROUPS, VOLUME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = id => {
  const e = LIB.find(x => x.id === id);
  assert.ok(e, `${id} is not in the library`);
  return e;
};

test('repMax reads the chart on every row it has', () => {
  for (const [n, pct] of Object.entries(REP_TO_PCT)) {
    assert.equal(repMax(Number(n)), pct, `row ${n}`);
  }
});

test('repMax interpolates the row the chart skips', () => {
  assert.ok(Math.abs(repMax(11) - 0.725) < 1e-9, `got ${repMax(11)}`);
});

test('repMax falls as reps rise, all the way past the chart', () => {
  for (let n = 2; n <= 20; n++) {
    assert.ok(repMax(n) < repMax(n - 1), `repMax(${n}) ${repMax(n)} >= repMax(${n - 1})`);
  }
});

test('the groups carry the doses the athlete approved', () => {
  assert.deepEqual([...LOAD_GROUPS.heavy.reps], [6, 8]);
  assert.deepEqual([...LOAD_GROUPS.heavy.rir], [2, 3]);
  assert.deepEqual([...LOAD_GROUPS.compound.reps], [8, 12]);
  assert.deepEqual([...LOAD_GROUPS.compound.rir], [2, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.reps], [10, 15]);
  assert.deepEqual([...LOAD_GROUPS.light.rir], [1, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.restSec], [60, 90]);
  assert.deepEqual([...LOAD_GROUPS.heavy.restSec], [120, 180]);
  assert.deepEqual([...LOAD_GROUPS.compound.restSec], [120, 180]);
  assert.equal(VOLUME.SETS_PER_PATTERN_PER_SESSION, 10);
});

test('group membership on the spec\'s named samples', () => {
  const want = {
    'single-arm-lat-pulldown': 'light', 'tall-kneeling-cable-chop': 'light',
    'leg-press': 'light', 'dumbbell-bench-press': 'compound',
    'romanian-deadlift': 'compound', 'weighted-pull-up': 'compound',
    'pause-squat': 'heavy', deadlift: 'heavy', 'bench-press': 'heavy'
  };
  for (const [id, group] of Object.entries(want)) {
    assert.equal(loadGroupFor(byId(id)), group, id);
  }
});

test('an isolation slot doses whatever it draws as light', () => {
  assert.equal(loadGroupFor(byId('ab-wheel-rollout'), { modality: 'isolation' }), 'light');
  assert.equal(loadGroupFor(byId('ab-wheel-rollout')), 'compound');
});

test('heavy lower means a heavy squat or hinge, nothing else', () => {
  assert.equal(isHeavyLower(byId('deadlift')), true);
  assert.equal(isHeavyLower(byId('pause-squat')), true);
  assert.equal(isHeavyLower(byId('bench-press')), false, 'heavy, but not lower');
  assert.equal(isHeavyLower(byId('romanian-deadlift')), false, 'lower, but compound');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/load-groups.test.mjs`
Expected: FAIL — `repMax` / `LOAD_GROUPS` not exported (SyntaxError on import).

- [ ] **Step 3: Implement**

In `js/rules.js`, directly after `export const PCT_JITTER = 0.025;`:

```js
// --------------------------------------------------------------------------
// Load groups -- reps, reps in reserve and rest by WHAT THE EXERCISE IS
// --------------------------------------------------------------------------

// Asked for by the athlete 2026-09-16 after a hypertrophy day of deadlift 4x6
// then pause squat 4x11: "ground the rep and set count according to move
// difficulty". Until now reps were drawn from the SLOT's range, blind to the
// exercise, and load was drawn from the zone independently of the reps --
// 34.6% of hypertrophy and 40.9% of max-strength loaded blocks asked for more
// than a true N-rep max. docs/superpowers/specs/2026-09-16-rep-method-design.md.
//
// The arrangement is the IUSCA position stand's (Schoenfeld et al. 2021, Int J
// Strength Cond 1(1)) nearly verbatim: "pairing more technically complex,
// energetically demanding, free-weight multi-joint exercises with low to
// moderate repetition ranges, followed by moderate to high-repetition sets
// using single-joint or machine-based exercises"; failure training confined
// "primarily to single-joint movements and machine-based exercises"; rest "at
// least 2 minutes" for multi-joint work and "60-90 secs" for single-joint and
// machine work. [verified] -- read in full text.
//
// Membership is DERIVED, in generator.js loadGroupFor(), from fields every
// entry already carries. No entry is edited. The exact rep bands are the
// athlete's choice inside that sourced shape. [corroborated]
export const LOAD_GROUPS = Object.freeze({
  heavy: Object.freeze({
    reps: Object.freeze([6, 8]), rir: Object.freeze([2, 3]),
    restSec: Object.freeze([120, 180])
  }),
  compound: Object.freeze({
    reps: Object.freeze([8, 12]), rir: Object.freeze([2, 2]),
    restSec: Object.freeze([120, 180])
  }),
  light: Object.freeze({
    reps: Object.freeze([10, 15]), rir: Object.freeze([1, 2]),
    restSec: Object.freeze([60, 90])
  })
});

// Where load is derived from reps plus reps in reserve. Power zones are about
// bar speed, not proximity to failure, and keep their own bands.
export const RIR_ZONES = Object.freeze(['maxStrength', 'hypertrophy', 'muscularEndurance']);

// Where the GROUP also sets reps and rest. maxStrength keeps its sourced
// strength reps and >= 2 min rests; muscularEndurance is the isolation
// finisher's 12-15 and keeps them.
export const GROUP_DOSED_ZONES = Object.freeze(['hypertrophy']);

// One heavy squat or hinge per session on these day types. [corroborated] --
// no trial compares it. IUSCA's recovery reasoning for heavy free-weight
// compounds, Pareja-Blanco et al. 2019 (moderate load taken near failure
// recovers slowest), and practitioner consensus on stacking two spinally
// loaded lifts. Power days are exempt by the athlete's decision: their squat
// is dynamic-effort speed work at 40-60%.
export const ONE_HEAVY_LOWER_DAY_TYPES = Object.freeze(['max-strength', 'hypertrophy']);
export const HEAVY_LOWER_PATTERNS = Object.freeze(['squat', 'hinge']);
```

In `VOLUME`, after `ISOLATION_PROPOSAL_PENALTY: 0.25`:

```js
,
  // IUSCA 2021: "cap per-session volume at ~10 sets per muscle". [verified]
  // PATTERN stands in for muscle because it is the one grouping every entry
  // carries exactly once -- an approximation, and stated as one. Measured
  // before the cap: median 5-6, p95 8-9, max 13 direct sets on one pattern.
  SETS_PER_PATTERN_PER_SESSION: 10
```

(Move the closing `});` so `SETS_PER_PATTERN_PER_SESSION` is inside `VOLUME`.)

In `js/generator.js`, add to the `rules.js` import list: `REP_TO_PCT, LOAD_GROUPS, RIR_ZONES, GROUP_DOSED_ZONES, ONE_HEAVY_LOWER_DAY_TYPES, HEAVY_LOWER_PATTERNS`. Then after `const clamp = ...`:

```js
// The fraction of 1RM that is an n-rep max. The NSCA chart where it has a row,
// linear between rows (it skips 11), and Epley's 1 / (1 + n/30) past its last
// row, taken as a min so the curve never steps back up where the two meet
// (Epley at 12 is 0.714 against the chart's 0.70). Epley is [corroborated] as
// the standard estimator and is used only past the chart.
export function repMax(n) {
  const rows = Object.keys(REP_TO_PCT).map(Number).sort((a, b) => a - b);
  const first = rows[0], last = rows[rows.length - 1];
  if (n <= first) return REP_TO_PCT[first];
  if (n > last) return Math.min(REP_TO_PCT[last], 1 / (1 + n / 30));
  if (REP_TO_PCT[n] != null) return REP_TO_PCT[n];
  const lo = rows.filter(r => r < n).pop();
  const hi = rows.find(r => r > n);
  return REP_TO_PCT[lo] + (REP_TO_PCT[hi] - REP_TO_PCT[lo]) * (n - lo) / (hi - lo);
}

// The only place group membership is decided. rules.js LOAD_GROUPS has why.
export function loadGroupFor(exercise, slot = null) {
  if ((slot && slot.modality === 'isolation') || exercise.cnsCost === 1) return 'light';
  if (exercise.loadable && exercise.cnsCost === 3) return 'heavy';
  return 'compound';
}

export function isHeavyLower(exercise) {
  return loadGroupFor(exercise) === 'heavy' && HEAVY_LOWER_PATTERNS.includes(exercise.pattern);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/load-groups.test.mjs tests/rules.test.mjs`
Expected: PASS, 0 fail.

- [ ] **Step 5: Mutation check, then commit**

In `loadGroupFor`, change `exercise.cnsCost === 3` to `exercise.cnsCost >= 2`; run the file; the membership test must FAIL on `romanian-deadlift` (loadable, `cnsCost` 2, now wrongly heavy). Restore; rerun green.

```bash
git add js/rules.js js/generator.js tests/load-groups.test.mjs
git commit -m "Load groups, repMax and the heavy-lower test (no behaviour change yet)"
```

---

### Task 2: `prescribe()` draws reps, then reps in reserve, then load

**Files:**
- Modify: `js/generator.js` `prescribe()` (~lines 691-740)
- Test: `tests/load-groups.test.mjs` (append)
- Possibly modify: `tests/ramp.test.mjs`, `tests/architecture.test.mjs` — only where a test asserts the OLD independent draw; see Step 5.

**Interfaces:**
- Consumes: `repMax`, `loadGroupFor`, `LOAD_GROUPS`, `RIR_ZONES`, `GROUP_DOSED_ZONES` (Task 1).
- Produces: load/reps blocks in RIR zones carry `block.rir: [lo, hi]` and `block.effort: 'leave N reps in reserve' | 'leave lo-hi reps in reserve'`. Task 3 reads `block.rir[0]`.

- [ ] **Step 1: Write the failing tests** (append to `tests/load-groups.test.mjs`)

```js
import { generate } from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { ZONES } from '../js/rules.js';

const DAY = 86400e3;
const NOW = 1e12;
const TRAINED = { returnDate: new Date(NOW - 400 * DAY).toISOString().slice(0, 10) };
const COOL = ['prep', 'mobility', 'core'];
const sweep = (dayType, n = 400) => Array.from({ length: n }, (_, i) =>
  generate({ library: LIB, profile: TRAINED, history: [], now: NOW, seed: i + 1, dayType }));
const mainOf = s => s.blocks.filter(b => !COOL.includes(b.role));
const slotOf = (dayType, b) => TEMPLATES[dayType].find(s => s.slot === b.slot);
const RIR_ZONE_KEYS = ['maxStrength', 'hypertrophy', 'muscularEndurance'];
// Loads print to the hundredth, so a load may round up by at most 0.005.
const PRINT = 0.005;

const SESSIONS = {
  'max-strength': sweep('max-strength'),
  hypertrophy: sweep('hypertrophy'),
  power: sweep('power')
};

test('no working set is heavier than its reps allow (defect A)', () => {
  let checked = 0;
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || b.mode !== 'load' || !RIR_ZONE_KEYS.includes(slot.zone)) continue;
        assert.ok(Array.isArray(b.rir), `${dayType} ${b.name} carries no rir`);
        const sets = b.setPlan ? b.setPlan.filter(x => x.kind === 'work') : [b];
        for (const w of sets) {
          checked++;
          const limit = repMax(w.reps + b.rir[0]);
          assert.ok(w.pct <= limit + PRINT,
            `${dayType} ${b.name}: ${w.reps} reps at ${w.pct} > ${limit.toFixed(3)} (rir ${b.rir[0]})`);
        }
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} working sets checked -- the sweep is not reaching load blocks`);
});

test('hypertrophy-zone blocks take reps and rest from their group', () => {
  let checked = 0;
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || slot.zone !== 'hypertrophy' || !['load', 'reps'].includes(b.mode)) continue;
        const g = LOAD_GROUPS[loadGroupFor(LIB.find(e => e.id === b.exerciseId), slot)];
        checked++;
        assert.ok(b.reps >= g.reps[0] && b.reps <= g.reps[1],
          `${dayType} ${b.name}: ${b.reps} reps outside ${g.reps}`);
        if (!b.group) {   // a superset's card rest is its round rest
          assert.ok(b.restSec >= g.restSec[0] && b.restSec <= g.restSec[1],
            `${dayType} ${b.name}: rest ${b.restSec} outside ${g.restSec}`);
        }
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} blocks checked`);
});

test('maxStrength and muscularEndurance slots keep their own reps', () => {
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || !['maxStrength', 'muscularEndurance'].includes(slot.zone)) continue;
        if (b.architecture === 'ladder') continue;   // rungs change reps by design
        assert.ok(b.reps >= slot.reps[0] && b.reps <= slot.reps[1] + 1,
          `${dayType} ${slot.slot} ${b.name}: ${b.reps} outside slot ${slot.reps}`);
      }
    }
  }
});

test('the pause squat that started this is no longer an 11-rep near-failure set', () => {
  const pause = LIB.find(e => e.id === 'pause-squat');
  const slot = TEMPLATES.hypertrophy.find(s => s.slot === 'B');
  for (let seed = 1; seed <= 200; seed++) {
    let x = seed;
    const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
    const b = prescribe(slot, pause, { pctCeiling: 1, volumeMultiplier: 1 }, rng, {});
    assert.ok(b.reps >= 6 && b.reps <= 8, `pause squat at ${b.reps} reps`);
    assert.ok(b.pct <= repMax(b.reps + 2) + PRINT, `pause squat ${b.reps} @ ${b.pct}`);
    assert.match(b.effort, /reps in reserve/);
  }
});
```

Also add `prescribe` to the generator import at the top of the file.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/load-groups.test.mjs`
Expected: FAIL — "carries no rir" on the first test; reps outside group on the second; pause squat at 9-12 reps.

- [ ] **Step 3: Implement**

In `prescribe()`, replace from `let sets = intBetween(rng, slot.sets);` through the end of the `pct` clamp line (`pct = clamp(pct, zone.pct[0] - PCT_JITTER, zone.pct[1] + PCT_JITTER);`) with the code below. Keep the interval and contacts branches exactly as they are, in the same positions.

```js
  // Reps, rest and reps in reserve by WHAT THE EXERCISE IS, on load slots in
  // the zones where proximity to failure is the prescription. rules.js
  // LOAD_GROUPS has the source; spec 2026-09-16-rep-method-design.md §4.
  const zoneKey = slot.zone in ZONES ? slot.zone : 'hypertrophy';
  const group = slot.mode === 'load' && RIR_ZONES.includes(zoneKey)
    ? LOAD_GROUPS[loadGroupFor(exercise, slot)]
    : null;
  const groupDosed = group && GROUP_DOSED_ZONES.includes(zoneKey);

  let sets = intBetween(rng, slot.sets);
  const reps = intBetween(rng, groupDosed ? group.reps : slot.reps);

  // Ramp trims volume before anything else touches it. basis §3.
  sets = Math.max(1, Math.round(sets * env.volumeMultiplier));

  block.sets = sets;
  block.reps = reps;

  // (interval branch unchanged here)

  block.restSec = Math.round(between(rng, groupDosed ? group.restSec : slot.restSec) / 15) * 15;

  // (contacts branch unchanged here)

  // mode === 'load'
  let rir = null;
  if (group) {
    rir = intBetween(rng, group.rir);
    block.rir = [...group.rir];
    block.effort = group.rir[0] === group.rir[1]
      ? `leave ${group.rir[0]} reps in reserve`
      : `leave ${group.rir[0]}-${group.rir[1]} reps in reserve`;
  }

  if (!exercise.loadable) {
    // No percentage is meaningful here -- bodyweight, machine, or dumbbell work
    // the app has no reference max for. Prescribe by reps and effort instead.
    block.mode = 'reps';
    block.effort = block.effort || 'leave 2-3 reps in reserve';
    return block;
  }

  const zone = ZONES[zoneKey];
  let pct;
  if (group) {
    // THE WEIGHT COMES FROM THE REPS. It used to be drawn from the zone
    // independently of them, which is how 11 reps met a load that is an 8RM.
    // Jitter only DOWNWARD: a jitter that raises the load re-creates the bug.
    pct = repMax(reps + rir) - rng() * PCT_JITTER;
  } else {
    pct = between(rng, zone.pct);
    pct += (rng() - 0.5) * 2 * PCT_JITTER;
    pct = clamp(pct, zone.pct[0] - PCT_JITTER, zone.pct[1] + PCT_JITTER);
  }
```

Everything after (the two-stage ceiling, `rampLimited`, `displayMultiplier`, `setPlan`) stays as it is.

- [ ] **Step 4: Run the new tests**

Run: `node --test tests/load-groups.test.mjs`
Expected: PASS except possibly the defect-A test on ladder rungs (max-strength ladders are Task 3). If the only failures name ladder rungs, proceed; if a straight block fails, fix before moving on.

- [ ] **Step 5: Run the full suite and triage**

Run: `node --test tests/*.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)|^✖"`

For each failure, decide which of these it is, and write the answer in the commit message:
1. **The test asserts the old independent draw** (e.g. `architecture.test.mjs` "every rung stays inside the zone band"). Leave it for Task 3 if it is about ladders; otherwise re-point it to the new invariant — never delete the protection it gave.
2. **A seed-sensitive sweep moved** (`session.test.mjs` duration/allowance, `cns-account.test.mjs` ratchets). Do NOT edit. Note the numbers; Task 6 measures and decides.
3. **A real regression.** Fix the code.

- [ ] **Step 6: Mutation check, then commit**

Change `repMax(reps + rir)` to `repMax(reps)`; run `tests/load-groups.test.mjs`; the defect-A test must FAIL. Restore.

```bash
git add js/generator.js tests/load-groups.test.mjs
git commit -m "Weight from reps: reps, rest and RIR by load group"
```

---

### Task 3: The ladder keeps every rung inside its rep-derived limit

**Files:**
- Modify: `js/generator.js` `ladderise()` (~lines 840-927)
- Modify: `tests/architecture.test.mjs:97-103` (re-point the zone-band test)

**Interfaces:**
- Consumes: `block.rir` (Task 2), `repMax` (Task 1), `WARMUP.FLOOR`.

- [ ] **Step 1: Re-point the band test to the new invariant (failing)**

Replace `test('every rung stays inside the zone band', ...)` in `tests/architecture.test.mjs` with:

```js
// RE-POINTED 2026-09-16. It used to hold rungs inside ZONES.maxStrength.pct,
// which was the only bound when load was drawn from the zone. Load now comes
// from reps plus reps in reserve (spec 2026-09-16-rep-method-design.md §4.2),
// so the protection that matters is per rung: no rung heavier than ITS reps
// allow, and none so light it is a warm-up rather than a working set.
test('every rung sits under its own rep-derived limit and above the warm-up floor', () => {
  for (const draw of [0, 0.05, 0.3, 0.5, 0.7, 0.95]) {
    const block = prescribe(SIX, SQUAT, ENV, () => draw, {});
    const out = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
    for (const s of work(out)) {
      assert.ok(s.pct <= repMax(s.reps + block.rir[0]) + 0.005,
        `draw ${draw}: ${s.reps} reps at ${s.pct} > ${repMax(s.reps + block.rir[0])}`);
      assert.ok(s.pct >= WARMUP.FLOOR, `draw ${draw}: rung at ${s.pct} is a warm-up load`);
    }
  }
});

test('a ladder still gets built -- the new bound must not retire the architecture', () => {
  const built = [0.3, 0.5, 0.7].filter(draw =>
    applyArchitecture([prescribe(SIX, SQUAT, ENV, () => draw, {})], 'ladder', ZONE_BY_SLOT)[0]
      .architecture === 'ladder');
  assert.ok(built.length >= 2, `only ${built.length} of 3 draws built a ladder`);
});
```

Update the imports at the top: `import { prescribe, applyArchitecture, generate, estimateMinutes, repMax } from '../js/generator.js';` and `import { ZONES, WARMUP } from '../js/rules.js';`.

- [ ] **Step 2: Run to verify**

Run: `node --test tests/architecture.test.mjs`
Expected: the rep-limit test FAILS (today's `ladderise` bounds rungs by `zone.pct[1]` 0.95, above the 2-rep rung's limit at the new lower loads) and/or "a ladder still gets built" FAILS (`roomBelow` against `zone.pct[0]` 0.85 is negative once load is rep-derived, so every block goes straight). Record which.

- [ ] **Step 3: Implement**

In `ladderise()`, replace the `roomBelow` / `roomAbove` lines and the `step` line, and move the rung-reps calculation above them:

```js
  const repFloor = zone.reps[0];
  const rungReps = positions.map((_, i) =>
    Math.max(repFloor, block.reps - (i < rungs1 ? i : i - rungs1)));

  // TWO REGIMES. A block with `rir` had its load derived from its reps
  // (spec 2026-09-16-rep-method-design.md §4.3), so the zone band no longer
  // describes it -- its load usually sits BELOW the maxStrength floor, and
  // bounding by that floor would retire every ladder. Such a block is bounded
  // per rung: no rung heavier than repMax(its reps + the group's least reps in
  // reserve), and the wave may not dip into warm-up loads. A block without
  // `rir` keeps the zone band exactly as before.
  let roomBelow, aboveBound;
  if (block.rir) {
    roomBelow = block.pct - WARMUP.FLOOR;
    aboveBound = Infinity;
    positions.forEach((pos, i) => {
      if (pos <= mid) return;
      const limit = repMax(rungReps[i] + block.rir[0]);
      aboveBound = Math.min(aboveBound, (limit - block.pct) / (pos - mid));
    });
  } else {
    roomBelow = block.pct - zone.pct[0];
    aboveBound = (zone.pct[1] - block.pct) / mid;
  }
```

Keep the existing `roomToCeiling` block unchanged, then:

```js
  const step = Math.min(roomBelow / mid, aboveBound, roomToCeiling / mid,
                        LADDER_STEP_MAX);
```

And in the `rungs` map, use the precomputed reps: `reps: rungReps[i],` (delete the old `const repFloor = zone.reps[0];` line further down and the inline `Math.max(repFloor, block.reps - wavePos)`; `wavePos` is then unused — remove it).

- [ ] **Step 4: Run**

Run: `node --test tests/architecture.test.mjs tests/load-groups.test.mjs`
Expected: PASS, including the defect-A test from Task 2 on ladder rungs.

- [ ] **Step 5: Mutation check, then commit**

Change `block.rir[0]` to `block.rir[0] - 2` inside the `forEach`; rerun `tests/architecture.test.mjs`; the rep-limit test must FAIL. Restore.

```bash
git add js/generator.js tests/architecture.test.mjs
git commit -m "Bound every ladder rung by its own reps, not the zone band"
```

---

### Task 4: One heavy squat or hinge per max-strength or hypertrophy session

**Files:**
- Modify: `js/generator.js` — `eligibleFor` (~line 491), `generate()` fill loop (~lines 1843-1961), `swapBlock` (~lines 1165-1235)
- Test: `tests/load-groups.test.mjs` (append)

**Interfaces:**
- Consumes: `isHeavyLower`, `ONE_HEAVY_LOWER_DAY_TYPES` (Task 1).
- Produces: `ctx.heavyLowerTaken: boolean` read by `eligibleFor`.

- [ ] **Step 1: Write the failing tests**

```js
import { swapBlock, makeRng } from '../js/generator.js';

const heavyLowerIn = s => mainOf(s).filter(b => isHeavyLower(LIB.find(e => e.id === b.exerciseId)));

test('no max-strength or hypertrophy session holds two heavy squats or hinges (defect B)', () => {
  for (const dayType of ['max-strength', 'hypertrophy']) {
    const pairs = SESSIONS[dayType].filter(s => heavyLowerIn(s).length > 1);
    assert.equal(pairs.length, 0,
      `${dayType}: ${pairs.length} sessions, e.g. ${pairs[0] && heavyLowerIn(pairs[0]).map(b => b.exerciseId)}`);
  }
});

test('power days are exempt -- their squat is speed work', () => {
  assert.ok(SESSIONS.power.some(s => heavyLowerIn(s).length > 1),
    'the rule reached power days, which the athlete exempted');
});

test('a swap never puts a second heavy squat or hinge on the card', () => {
  let tried = 0;
  for (const s of SESSIONS.hypertrophy) {
    const heavy = heavyLowerIn(s);
    if (heavy.length !== 1) continue;
    // Swap every OTHER lower-body main block, many times.
    for (const b of mainOf(s)) {
      if (b === heavy[0] || !['squat', 'hinge'].includes(b.pattern)) continue;
      for (let seed = 1; seed <= 20; seed++) {
        const { block } = swapBlock(s, b.slot, LIB, { profile: TRAINED, history: [] },
                                    makeRng(seed), b.exerciseId);
        if (!block) continue;
        tried++;
        assert.ok(!isHeavyLower(LIB.find(e => e.id === block.exerciseId)),
          `swapping ${b.exerciseId} handed back ${block.exerciseId} beside ${heavy[0].exerciseId}`);
      }
    }
  }
  assert.ok(tried > 50, `only ${tried} swaps exercised`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/load-groups.test.mjs`
Expected: defect-B test FAILS (≈6.5% hypertrophy, ≈14.7% max-strength of the sweep); swap test FAILS; power test PASSES (not yet a guard — Step 5 mutation proves it).

- [ ] **Step 3: Implement**

`eligibleFor`: add `heavyLowerTaken = false` to the destructured `ctx`, and after the `excludeIds` line:

```js
    // One heavy squat or hinge per max-strength or hypertrophy session.
    // generate() and swapBlock() set the flag; nothing else does, so a caller
    // that does not know the rule gets the old behaviour. rules.js
    // ONE_HEAVY_LOWER_DAY_TYPES has the source and its standing.
    if (heavyLowerTaken && isHeavyLower(e)) return false;
```

`generate()`: in the `ctx` literal add `heavyLowerTaken: false,`. Before the `for (const slot of template)` loop add `const oneHeavyLower = ONE_HEAVY_LOWER_DAY_TYPES.includes(chosen);`. After `ctx.excludeIds.add(exercise.id);` add:

```js
    if (oneHeavyLower && isHeavyLower(exercise)) ctx.heavyLowerTaken = true;
```

`swapBlock`: after `const excludeIds = new Set(...)` add:

```js
  // The pairing rule survives a swap: counted against the session's OTHER
  // blocks, so the heavy lift itself may still be swapped for another one.
  const heavyLowerTaken = ONE_HEAVY_LOWER_DAY_TYPES.includes(session.dayType) &&
    session.blocks.some(b => {
      if (b === current) return false;
      const e = library.find(x => x.id === b.exerciseId);
      return Boolean(e) && isHeavyLower(e);
    });
  const swapCtx = { ...ctx, state, excludeIds, heavyLowerTaken };
```

Then replace each of the four `{ ...ctx, state, excludeIds }` arguments in `swapBlock` with `swapCtx`.

- [ ] **Step 4: Run**

Run: `node --test tests/load-groups.test.mjs tests/swap.test.mjs tests/equipment.test.mjs`
Expected: PASS.

- [ ] **Step 5: Mutation checks, then commit**

(a) Change `ONE_HEAVY_LOWER_DAY_TYPES.includes(chosen)` to `true` in `generate()`: the power test must FAIL. Restore.
(b) Set `heavyLowerTaken` to `false` in `swapCtx`: the swap test must FAIL. Restore.

```bash
git add js/generator.js tests/load-groups.test.mjs
git commit -m "One heavy squat or hinge per max-strength or hypertrophy session"
```

---

### Task 5: At most ten direct sets per pattern per session

**Files:**
- Modify: `js/generator.js` — new export `capPatternSets` near `packToBudget` (~line 1407); call in `generate()` between `packToBudget` and `pairAntagonists` (~line 1966-1973)
- Test: `tests/load-groups.test.mjs` (append)

**Interfaces:**
- Consumes: `VOLUME.SETS_PER_PATTERN_PER_SESSION` (Task 1).
- Produces: `capPatternSets(blocks: Block[], cap?: number): Block[]` (mutates `sets`/`setPlan` on the block objects, like `packToBudget`).

- [ ] **Step 1: Write the failing tests**

```js
import { capPatternSets } from '../js/generator.js';

const directSets = s => {
  const by = {};
  for (const b of mainOf(s)) if (['load', 'reps'].includes(b.mode)) by[b.pattern] = (by[b.pattern] || 0) + b.sets;
  return by;
};

test('no pattern carries more than ten direct sets in a session (defect C)', () => {
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const [p, n] of Object.entries(directSets(s))) {
        assert.ok(n <= VOLUME.SETS_PER_PATTERN_PER_SESSION, `${dayType} seed ${s.seed}: ${n} sets of ${p}`);
      }
    }
  }
});

test('the cap takes sets from the biggest block and respects the floors', () => {
  const work = n => Array.from({ length: n }, () => ({ kind: 'work', reps: 8 }));
  const blocks = [
    { slot: 'A', pattern: 'squat', mode: 'load', sets: 4, setPlan: [{ kind: 'warmup' }, ...work(4)] },
    { slot: 'B', pattern: 'squat', mode: 'reps', sets: 4 },
    { slot: 'C', pattern: 'squat', mode: 'reps', sets: 4 },
    { slot: 'D', pattern: 'pull-v', mode: 'reps', sets: 3 }
  ];
  const out = capPatternSets(blocks, 10);
  const squat = out.filter(b => b.pattern === 'squat').reduce((a, b) => a + b.sets, 0);
  assert.equal(squat, 10);
  assert.equal(out.find(b => b.slot === 'D').sets, 3, 'another pattern was touched');
  const a = out.find(b => b.slot === 'A');
  assert.equal(a.setPlan.filter(s => s.kind === 'work').length, a.sets, 'setPlan drifted from sets');

  const floors = capPatternSets([
    { slot: 'A', pattern: 'hinge', mode: 'load', sets: 2, setPlan: [...work(2)] },
    { slot: 'B', pattern: 'hinge', mode: 'reps', sets: 1 }
  ], 1);
  assert.equal(floors[0].sets, 2, 'a ramped block went under two working sets');
  assert.equal(floors[1].sets, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/load-groups.test.mjs`
Expected: FAIL — `capPatternSets` not exported. (After adding a stub that returns `blocks`, the sweep test must still FAIL on a real session over 10; check that it does before implementing.)

- [ ] **Step 3: Implement**

After `packToBudget` in `js/generator.js`:

```js
// IUSCA 2021 caps per-session volume at ~10 sets per muscle; pattern stands in
// for muscle (rules.js VOLUME). Runs AFTER packToBudget, so it only ever removes
// what the clock already allowed. Same lever and floors as the packer: one
// working set at a time from the pattern's biggest block, never below two on a
// ramped block, and the matching setPlan work entry goes with it.
export function capPatternSets(blocks, cap = VOLUME.SETS_PER_PATTERN_PER_SESSION) {
  const out = blocks.slice();
  const direct = b => b.mode === 'load' || b.mode === 'reps';
  const setsOf = p => out.filter(b => direct(b) && b.pattern === p)
                         .reduce((a, b) => a + b.sets, 0);
  for (const pattern of new Set(out.filter(direct).map(b => b.pattern))) {
    let guard = 0;
    while (setsOf(pattern) > cap && guard++ < 100) {
      const target = out
        .filter(b => direct(b) && b.pattern === pattern && b.sets > (b.setPlan ? 2 : 1))
        .sort((a, b) => b.sets - a.sets)[0];
      if (!target) break;
      target.sets -= 1;
      if (target.setPlan) {
        const idx = target.setPlan.map(s => s.kind).lastIndexOf('work');
        if (idx !== -1) target.setPlan.splice(idx, 1);
      }
    }
  }
  return out;
}
```

In `generate()`:

```js
  const capped = capPatternSets(packed.blocks);
  const paired = pairAntagonists(capped, architecture);
```

- [ ] **Step 4: Run**

Run: `node --test tests/load-groups.test.mjs`
Expected: PASS.

- [ ] **Step 5: Mutation check, then commit**

Change `b.sets > (b.setPlan ? 2 : 1)` to `b.sets > 0`; the floors assertion must FAIL. Restore.

```bash
git add js/generator.js tests/load-groups.test.mjs
git commit -m "Cap direct sets per pattern per session at ten"
```

---

### Task 6: Full suite, and measure before anything ships

**Files:** none changed unless a check fails; measurement script in the scratchpad, not the repo.

- [ ] **Step 1: Full suite**

Run: `node --test tests/*.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)|^✖"`
Expected: all pass. Any failure left from Task 2 Step 5 category 2 is handled in Step 3 below — never by editing a constant to fit.

- [ ] **Step 2: Measure** — before (`git stash` or check out `38379b9` into a temp worktree) and after, 3,000 seeds per day type for `max-strength`, `power`, `hypertrophy`, fully ramped (`returnDate` 400 days back, `now = 1e12`), plus the canonical 10,000-seed duration sweep `session.test.mjs` uses:
  - mean and worst `durationMin` per day type;
  - mean working sets per session (`countsTowardVolume`);
  - share of sessions dropping an optional slot (`trimmedSlots.length > 0`);
  - defects A, B, C as in the spec's table (A and B must read 0).

- [ ] **Step 3: Gate**

- Worst session ≤ 70 min and suite green → continue to Task 7.
- Worst session > 70 min, or a duration/allowance/CNS ratchet test red → **STOP**. Report the before/after table to the athlete in plain words with options (e.g. keep rests and accept fewer optional exercises; shorten compound rest to the IUSCA floor of 120 s flat; re-derive the allowance with his OK). Do not change `TIME.*`, `FLOOR_OVERRUN_ALLOWANCE_MIN` or a ratchet without his decision. For a CNS ratchet, run `node tools/measure.mjs veto` first — bisect before believing.

---

### Task 7: Documentation, version, ship

**Files:**
- Modify: `README.md` ("How a session is generated" row 7 PRESCRIBE; "Design decisions worth knowing")
- Modify: `docs/programming-basis.md` (IUSCA 2021 and Pareja-Blanco 2019 beside the zone table)
- Modify: `docs/design-architectures.md` (ladder's per-rung bound, appended section)
- Modify: `docs/superpowers/specs/2026-09-16-rep-method-design.md` (Status → built, with Task 6's measured table)
- Modify: `sw.js` `VERSION` and `js/version.js` `APP_VERSION` → `'v77'`

- [ ] **Step 1: Write the docs.** README in plain words: reps come from what the exercise is (heavy barbell 6–8, other compounds 8–12, machines/cables/single-joint 10–15), the weight comes from the reps so every set leaves 1–3 reps in reserve, one heavy squat or deadlift-type lift per strength or hypertrophy session, at most 10 sets per movement pattern — and that reps have never been fitted to the clock, which only removes work. Include Task 6's measured before/after numbers.

- [ ] **Step 2: Bump both versions, run `node --test tests/version.test.mjs`** → PASS.

- [ ] **Step 3: Full suite** → all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Reps, weight and pairing by what the exercise is (v77)"
```

- [ ] **Step 5: Ask the athlete before pushing.** On his OK: `git push origin main`, then `git status -sb` (a push has failed silently before — retry once on a connection reset), then poll `curl -s "https://ninwhippa08.github.io/GymBuddy/sw.js?cb=$RANDOM" | grep VERSION` until it reads `v77`.

- [ ] **Step 6: Update memory** (`gymbuddy-project.md` RESUME block and `MEMORY.md` pointer) with the new head, version, test count and Task 6 numbers.
