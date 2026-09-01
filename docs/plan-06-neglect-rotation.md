# Day-Type Rotation (the neglect model's blind spot) — Implementation Plan

> **BUILT 2026-09-01.** All five tasks executed on `main`, `sw.js` v20, 298/298.
> Commits `33ef87e`, `f3b11b0`, `20df2e5`, `97c5b35`, `e83d0b8`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the generator silently withholding whole day types for a year at a time at the athlete's real 1–3×/week cadence.

**Architecture:** Two one-line defects in `buildState`/`proposeDayType` that mask each other. `hoursSince` is read off `recent`, which `buildState` has already truncated to `VOLUME.HISTORY_DAYS = 14`, so every day type not trained inside 14 days collapses to `Infinity` → `days = 99`; and `Math.min(days, 21)` then flattens everything older than three weeks to the same score anyway. Ties are broken by `reduce` keeping the first element, i.e. `PHASE_1_DAY_TYPES` array order — so the tail of that array starves. Fix is: read `hoursSince` from full history, and replace the bare `21` with a named, documented cap. Neither fix does anything alone; this is proven in "The evidence" below.

**Tech Stack:** Plain ES modules, no build step, no dependencies. Tests are `node:test` + `node:assert`, run with `node --test "tests/*.test.mjs"`.

**Spec:** No design doc covers the neglect model's *distribution* — `docs/design-running-programming.md` §7 covers the chronic term and the boost, not this. The evidence section below IS the spec for this change; Task 5 writes it into `docs/design-running-programming.md` as a new §7.5 so it stops being tribal knowledge. Read the evidence section before Task 1.

## Global Constraints

- **No dependencies, no build step, no npm.** Plain ES modules only.
- **Every number lives in `js/rules.js`** and carries a provenance tag: `[verified]`, `[corroborated]`, `[unverified]` or `[measured]`. A constant introduced without one is a defect.
- **Run the whole suite with the glob:** `node --test "tests/*.test.mjs"`. `node --test tests/` does NOT work on this machine (it fails with a single `test at tests:1:1` failure and runs nothing).
- **`sw.js` `VERSION` is bumped ONCE, in Task 5.** It is `'v19'` now; this deploy sets `'v20'`. Nothing reaches his phone until that happens, and it then needs a SECOND app launch to activate.
- **Verify a patch landed before believing a measurement.** Two measurements in the session that produced this plan reported "no difference" because the edit never applied — once from an in-process ESM cache (`generator.js` imports `rules.js` unversioned, so a second in-process sweep silently reuses the first constant), once from a failed string replace. Any sweep that patches a source file must assert the changed text is on disk, and must run each variant in a **separate node process**.
- **Commits use the GitHub noreply identity already configured;** check `git config user.email` before the first commit. It must be `99660645+ninwhippa08@users.noreply.github.com`.

---

## The evidence (read this first — it is the spec)

### What the athlete gets today

Simulated a full year against the real generator, committing each session the way `app.js` does (replace-by-date), counting day types actually proposed:

| cadence | max-str | power | hypertrophy | aerobic | interval | sprint | plyo |
|---|---|---|---|---|---|---|---|
| 1×/week (52 sessions) | 25 | 14 | **0** | 12 | 1 | **0** | **0** |
| 2×/week (104) | 26 | 26 | **1** | 26 | 25 | **0** | **0** |
| 3×/week (156) | 26 | 26 | 26 | 26 | 26 | 26 | **0** |

At 1×/week three of seven day types never appear in a **year**. The athlete trains 1–3×/week (`memory: user-training-background`), so this is his actual experience, not a corner case.

### Why

1. `js/generator.js:92` builds `hoursSince` from `recent`. `recent` is filtered to `VOLUME.HISTORY_DAYS = 14` days at `js/generator.js:75-77`. Anything older reads `Infinity`, which `proposeDayType` maps to `days = 99` (`js/generator.js:258`). **Every stale day type is therefore identical**, whether it was skipped for 15 days or 300.
2. `js/generator.js:259` scores `Math.min(days, 21) * chronicBoost(...)`. Even with distinct day counts, everything ≥ 21 days flattens to the same number.
3. `js/generator.js:274` picks with `reduce((a, b) => (b.score > a.score ? b : a))`, which keeps the FIRST on a tie — i.e. `PHASE_1_DAY_TYPES` order (`js/templates.js:72-75`): `max-strength, power, hypertrophy, aerobic-steady, interval, sprint, plyometric`. **`plyometric` is last, so it loses every tie it is ever in.**

Instrumented over a simulated year at 3×/week: `plyometric` was open, un-vetoed and **tied for the top score in 78 of 156 sessions**, losing to `max-strength` (26), `power` (26) and `sprint` (26) — all earlier in the array. It is never vetoed. It simply never wins.

`aerobic-steady` and `interval` escape this because `chronicBoost` lifts them above the cap (scores of 30–31 against the flat 21), which is why they appear at every cadence.

### The two fixes only work together

Measured as a 2×2, each variant in its own node process with the patch asserted on disk:

| | window fixed | cap removed | 1×/wk | 2×/wk | 3×/wk |
|---|---|---|---|---|---|
| A: as shipped | — | — | hyp 0, spr 0, ply 0 | hyp 1, spr 0, ply 0 | ply 0 |
| B: window only | ✓ | — | hyp 12, spr 0, ply **0** | spr 1, ply **0** | ply 19 |
| C: cap only | — | ✓ | **byte-identical to A** | **identical to A** | **identical to A** |
| D: both | ✓ | ✓ | **8/8/8/7/7/7/7** | 14/13/13/19/19/13/13 | 20/20/20/29/29/19/19 |

C is the trap: measured alone, the cap looks irrelevant, because the broken window means no day type ever holds a value between 14 and 21 days for the cap to bite on. **Do not let a reviewer talk you into shipping only one half.**

### What does NOT need re-calibrating (checked, not assumed)

- **The 70-minute session ceiling.** `tests/session.test.mjs`'s sweep calls `generate({ library, dayType, seed, now: 1e12 })` with the day type passed explicitly and no history, so it never consults `proposeDayType`. Session length is a property of a day type's template, not of how often that day type is proposed. Unaffected.
- **`CNS_VETO_THRESHOLD`, `FLOOR_OVERRUN_ALLOWANCE_MIN`, `GYM_SESSION_TOTAL_MIN`.** The whole suite (290 tests) passes unchanged under fix D — verified by patching both lines and running `node --test "tests/*.test.mjs"`.

That last fact cuts both ways and is the reason Task 4 exists: **290 tests are blind to day-type distribution.** Nothing in the suite would have caught this bug, and nothing would catch its return.

---

## File structure

| File | Responsibility for this change |
|---|---|
| `js/rules.js` | Gains `NEGLECT_CAP_DAYS`, the named replacement for the bare `21`. |
| `js/generator.js` | `buildState`'s `hoursSince` loop (line ~92); `proposeDayType`'s score line (line ~259). |
| `tests/rotation.test.mjs` | **New.** The distribution guarantee the suite currently lacks. |
| `docs/design-running-programming.md` | New §7.5 recording the defect, the evidence and the cap decision. |
| `sw.js` | `VERSION` `'v19'` → `'v20'`, once, in Task 5. |

---

### Task 1: `hoursSince` reads the full history, not the 14-day slice

**Files:**
- Create: `tests/rotation.test.mjs`
- Modify: `js/generator.js` (the `hoursSince` loop, currently line 92)
- Test: `tests/rotation.test.mjs`

**Interfaces:**
- Consumes: `buildState(profile, history, now)` and `proposeDayType(state, opts)`, both already exported from `js/generator.js`.
- Produces: nothing new. `state.hoursSince[dayType]` keeps its shape (hours as a number, `Infinity` for never) and only becomes accurate past 14 days.

- [x] **Step 1: Write the failing test**

Create `tests/rotation.test.mjs` with exactly this:

```javascript
// The neglect model's DISTRIBUTION. The suite had 290 tests and not one of
// them could see which day types get proposed, which is why a year-long
// starvation of three day types shipped unnoticed. plan-06.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildState } from '../js/generator.js';

const DAY = 86400e3;
const NOW = Date.parse('2026-09-01T12:00:00Z');
const iso = t => new Date(t).toISOString().slice(0, 10);
const PROFILE = { returnDate: '2026-01-01', banned: [], plyoLevel: 'beginner' };

test('a day type skipped for 40 days is more neglected than one skipped for 20', () => {
  // Both sit outside VOLUME.HISTORY_DAYS (14). Read off `recent`, both came
  // back Infinity -> 99 days -> indistinguishable, and the tie went to
  // whichever appears first in PHASE_1_DAY_TYPES. That is the whole bug.
  const history = [
    { date: iso(NOW - 20 * DAY), dayType: 'sprint', cnsLoad: 5, patternSets: {}, blocks: [] },
    { date: iso(NOW - 40 * DAY), dayType: 'plyometric', cnsLoad: 5, patternSets: {}, blocks: [] }
  ];
  const state = buildState(PROFILE, history, NOW);

  assert.ok(Number.isFinite(state.hoursSince.sprint),
    'a session 20 days ago must be visible, not Infinity');
  assert.ok(Number.isFinite(state.hoursSince.plyometric),
    'a session 40 days ago must be visible, not Infinity');
  assert.ok(state.hoursSince.plyometric > state.hoursSince.sprint,
    'the longer-neglected day type must read as longer-neglected');
});

test('a day type never trained still reads as never', () => {
  const state = buildState(PROFILE, [], NOW);
  assert.equal(state.hoursSince.plyometric, Infinity);
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/rotation.test.mjs`

Expected: the first test FAILS on `a session 20 days ago must be visible, not Infinity` (both values are `Infinity`). The second test PASSES already — that is correct and intentional; it pins behaviour the fix must not break.

- [x] **Step 3: Make it pass**

In `js/generator.js`, in `buildState`, change the `hoursSince` loop to read the full history. Replace:

```javascript
  // Hours since the most recent session of each day type. Infinity means never.
  const hoursSince = {};
  for (const dt of Object.keys(DAY_TYPES)) hoursSince[dt] = Infinity;
  for (const s of recent) {
```

with:

```javascript
  // Hours since the most recent session of each day type. Infinity means never.
  //
  // NOT `recent`: it is truncated to VOLUME.HISTORY_DAYS (14), so every day
  // type skipped for longer than a fortnight came back Infinity and scored
  // identically -- 15 days and 300 days were the same number. proposeDayType
  // breaks ties by PHASE_1_DAY_TYPES order, so the tail of that array
  // (plyometric last) lost every tie it was ever in and was never proposed at
  // all: 0 times in a simulated year at 1x, 2x and 3x per week. This is the
  // same mistake chronicFrom's comment below warns about, in a different
  // field. The neglect model is the one thing in this file that MUST see
  // further back than the volume window.
  const hoursSince = {};
  for (const dt of Object.keys(DAY_TYPES)) hoursSince[dt] = Infinity;
  for (const s of (history || [])) {
```

Leave the loop body unchanged. Leave the `recent`-based loops for `patternSets`, `cnsAccount`, `weekContacts`/`weekMeters` and `recentExerciseIds` exactly as they are — those windows are correct and deliberate.

- [x] **Step 4: Run the tests**

Run: `node --test tests/rotation.test.mjs` — expected: both PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **292 pass, 0 fail** (290 existing + 2 new).

If any pre-existing test fails here, STOP and report it rather than editing that test. The session that wrote this plan verified all 290 pass under this change; a failure means something else moved.

- [x] **Step 5: Commit**

```bash
git add js/generator.js tests/rotation.test.mjs
git commit -m "Read hoursSince from full history, not the 14-day volume window"
```

---

### Task 2: name the neglect cap and raise it

**Files:**
- Modify: `js/rules.js` (add `NEGLECT_CAP_DAYS` near the other neglect/volume constants)
- Modify: `js/generator.js` (score line, currently line 259; add the import)
- Test: `tests/rotation.test.mjs`

**Interfaces:**
- Consumes: `NEGLECT_CAP_DAYS` from `js/rules.js`.
- Produces: `export const NEGLECT_CAP_DAYS = 90;` — a number of days, used only by `proposeDayType`'s score.

**The decision this task makes, and why it is not a sourced number.** No training-science source sets a saturation point for "how neglected is too neglected" — the cap exists to stop one abandoned modality growing an unbeatable score forever, which is a product decision about the app's behaviour, not a physiological claim. It is therefore tagged `[unverified]` and its comment says plainly that it is a product decision. Do not invent a citation for it. 90 days is chosen because it is longer than any plausible gap the rotation should shrug off, and short enough that a modality abandoned for a season does not outrank everything for months after it returns. Removing the cap entirely was measured and behaves identically at 1–3×/week (the athlete's range); the cap is kept as a guard for the case the sweep cannot reach — a day type abandoned for years.

- [x] **Step 1: Write the failing test**

Append to `tests/rotation.test.mjs`:

```javascript
import { proposeDayType } from '../js/generator.js';
import { NEGLECT_CAP_DAYS } from '../js/rules.js';

// A state built by hand: every day type trained recently EXCEPT the two under
// test, so the winner is decided purely by which is more neglected.
function stateWith(daysAgoByType) {
  const hoursSince = {};
  for (const dt of ['max-strength', 'power', 'hypertrophy', 'aerobic-steady',
                    'interval', 'sprint', 'plyometric']) {
    hoursSince[dt] = 1;                       // trained an hour ago
  }
  for (const [dt, days] of Object.entries(daysAgoByType)) hoursSince[dt] = days * 24;
  return { hoursSince, cnsAccount: 0, rampWeek: 5, chronicLoad: 0, gymShare: 0,
           weeksSinceEasyWeek: 0, patternSets: {}, recent: [] };
}

test('the most neglected day type wins, even when both are past three weeks', () => {
  // 21 was a bare literal and flattened these two to the same score, so the
  // one earlier in PHASE_1_DAY_TYPES took it every time.
  const p = proposeDayType(stateWith({ sprint: 25, plyometric: 45 }), { soreness: {} });
  assert.equal(p.dayType, 'plyometric');
});

test('the cap stops an abandoned day type outranking everything forever', () => {
  const beyond = proposeDayType(
    stateWith({ sprint: NEGLECT_CAP_DAYS + 200, plyometric: NEGLECT_CAP_DAYS + 400 }),
    { soreness: {} }
  );
  const sprintScore = beyond.candidates.find(c => c.dayType === 'sprint').score;
  const plyoScore = beyond.candidates.find(c => c.dayType === 'plyometric').score;
  assert.equal(sprintScore, plyoScore, 'both are past the cap and should saturate together');
  assert.equal(sprintScore, NEGLECT_CAP_DAYS);
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/rotation.test.mjs`

Expected: FAILS at the import — `NEGLECT_CAP_DAYS` does not exist (`SyntaxError: The requested module './rules.js' does not provide an export named 'NEGLECT_CAP_DAYS'`). That is the right first failure. After Step 3 adds the constant but before the score line changes, the first test fails on `expected 'plyometric', got 'sprint'` — confirm you see that too, because it is the real bug being pinned.

- [x] **Step 3: Add the constant**

In `js/rules.js`, immediately above `export const CNS_VETO_THRESHOLD = 2;` (line 356), add:

```javascript
// Where the neglect score stops growing, in days. `[unverified]` and NOT a
// physiological claim -- no source sets a saturation point for neglect. This
// is a product decision: without a cap, a modality abandoned for two years
// scores 730 and outranks everything for months after it comes back; with the
// cap too low, distinct gaps flatten into ties that get broken by array order
// instead of by neglect, which is exactly how plyometric went unproposed for a
// simulated year (plan-06). Was a bare `21` inline in proposeDayType with no
// name and no comment. 90 days is longer than any gap the rotation should
// shrug off and short enough that a season away does not distort the next one.
// Removing the cap entirely measures identically across 1-3x/week, the
// athlete's actual range; it is kept for the case a sweep cannot reach.
export const NEGLECT_CAP_DAYS = 90;
```

- [x] **Step 4: Use it**

In `js/generator.js`, add `NEGLECT_CAP_DAYS` to the existing import block from `./rules.js` (the one starting `ZONES, PCT_JITTER, VOLUME, RAMP, WARMUP, CNS_DECAY, CNS_VETO_THRESHOLD,`), then change the score line:

```javascript
    let score = Math.min(days, 21) * chronicBoost(dt, state);
```

to:

```javascript
    let score = Math.min(days, NEGLECT_CAP_DAYS) * chronicBoost(dt, state);
```

- [x] **Step 5: Run the tests**

Run: `node --test tests/rotation.test.mjs` — expected: all 4 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **294 pass, 0 fail**.

- [x] **Step 6: Commit**

```bash
git add js/rules.js js/generator.js tests/rotation.test.mjs
git commit -m "Name the neglect cap and raise it to 90 days"
```

---

### Task 3: prove the tie-break is no longer load-bearing

**Files:**
- Test: `tests/rotation.test.mjs`

**Interfaces:**
- Consumes: `proposeDayType` and `PHASE_1_DAY_TYPES`.
- Produces: nothing.

Tasks 1 and 2 remove the *cause* of the ties. This task pins the property that matters, so a future change that reintroduces flattening fails loudly instead of silently starving a modality again.

- [x] **Step 1: Write the test**

Append to `tests/rotation.test.mjs`:

```javascript
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

test('array order does not decide the proposal when neglect differs', () => {
  // plyometric is LAST in PHASE_1_DAY_TYPES, so if order still decides, it
  // loses. Give it the most neglect and it must win from last position.
  const daysAgo = {};
  PHASE_1_DAY_TYPES.forEach((dt, i) => { daysAgo[dt] = 20 + i; });   // plyometric = most
  const p = proposeDayType(stateWith(daysAgo), { soreness: {} });
  assert.equal(p.dayType, 'plyometric', 'the most neglected day type must win from last position');

  // And the reverse: the FIRST entry wins when it is the most neglected, so
  // this is not simply an inverted order.
  const reversed = {};
  PHASE_1_DAY_TYPES.forEach((dt, i) => { reversed[dt] = 40 - i; });  // max-strength = most
  assert.equal(proposeDayType(stateWith(reversed), { soreness: {} }).dayType, 'max-strength');
});
```

- [x] **Step 2: Run it**

Run: `node --test tests/rotation.test.mjs` — expected: 5 PASS.
Run: `node --test "tests/*.test.mjs"` — expected: **295 pass, 0 fail**.

If this test FAILS, the cap in Task 2 is too low for the spread used here — do not widen the test; re-check `NEGLECT_CAP_DAYS`.

- [x] **Step 3: Verify it can fail**

Temporarily change `NEGLECT_CAP_DAYS` back to `21` in `js/rules.js`, run `node --test tests/rotation.test.mjs`, and confirm this test FAILS. Then restore `90` and confirm it passes again. A regression test nobody has watched fail is not a regression test — this is how the `.btn-done` CSS bug reached a commit in the session that wrote this plan.

- [x] **Step 4: Commit**

```bash
git add tests/rotation.test.mjs
git commit -m "Pin that neglect, not array order, decides the proposal"
```

---

### Task 4: the distribution guarantee the suite never had

**Files:**
- Test: `tests/rotation.test.mjs`

**Interfaces:**
- Consumes: `resolveSession` from `js/generator.js`, the exercise library from `data/exercises.json`.
- Produces: nothing.

The unit tests above pin the mechanism. This one pins the *outcome the athlete experiences*, which is what actually regressed: it walks a simulated year and asserts no day type is starved. It is the only test in the suite that can see day-type distribution.

- [x] **Step 1: Write the test**

Append to `tests/rotation.test.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { resolveSession } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

// Walk a year at a given cadence, committing each session the way app.js does
// (commitSession REPLACES by date), and count what was actually proposed.
function yearOfSessions(perWeek) {
  const start = Date.parse('2026-01-05T12:00:00Z');
  const profile = { returnDate: iso(start), banned: [], plyoLevel: 'beginner' };
  let history = [];
  const counts = {};
  for (let i = 0; i < 52 * perWeek; i++) {
    const t = start + Math.round(i * 7 / perWeek) * DAY;
    const r = resolveSession({
      library: LIB, profile, history, soreness: {},
      dayType: null, excludeEquipment: [], seed: t, now: t
    });
    if (!r.session) continue;
    const s = { ...r.session, date: iso(t), confirmed: true };
    history = [s, ...history.filter(h => h.date !== s.date)];
    counts[s.dayType] = (counts[s.dayType] || 0) + 1;
  }
  return counts;
}

// He trains 1-3x/week, irregularly. Every one of those cadences must reach
// every day type. Before plan-06: at 1x/week hypertrophy, sprint and
// plyometric were each proposed ZERO times in a full year.
for (const perWeek of [1, 2, 3]) {
  test(`every day type is proposed at least once a year at ${perWeek}x/week`, () => {
    const counts = yearOfSessions(perWeek);
    const missing = PHASE_1_DAY_TYPES.filter(dt => !counts[dt]);
    assert.deepEqual(missing, [],
      `never proposed in a year at ${perWeek}x/week: ${missing.join(', ')} ` +
      `(got ${JSON.stringify(counts)})`);
  });
}
```

- [x] **Step 2: Run it**

Run: `node --test tests/rotation.test.mjs`

Expected: all PASS. Note the runtime — this walks up to 156 real generations per cadence. If the three cadences together add more than ~5s to the suite, say so in the commit message; the suite is currently ~17s and `session.test.mjs`'s 70,000-session sweep already dominates it.

- [x] **Step 3: Verify it can fail**

Temporarily revert Task 1's change (`for (const s of (history || []))` back to `for (const s of recent)`), run `node --test tests/rotation.test.mjs`, and confirm the 1×/week case FAILS naming `hypertrophy, sprint, plyometric`. Restore the fix and confirm PASS.

- [x] **Step 4: Run the whole suite**

Run: `node --test "tests/*.test.mjs"` — expected: **298 pass, 0 fail**.

- [x] **Step 5: Commit**

```bash
git add tests/rotation.test.mjs
git commit -m "Assert every day type is reachable within a year at 1-3x/week"
```

---

### Task 5: document it, bump the worker, deploy

**Files:**
- Modify: `docs/design-running-programming.md` (new §7.5)
- Modify: `sw.js` (`VERSION` `'v19'` → `'v20'`)

**Interfaces:** none.

- [x] **Step 1: Write §7.5**

Add to `docs/design-running-programming.md`, after the existing §7.4, a section titled **§7.5 The rotation defect (found 2026-09-01, fixed in plan-06)** containing, in prose matching that document's voice:

- the year-long distribution table from "The evidence" above, both before and after;
- the three-part mechanism (14-day `hoursSince` window → everything stale reads 99 → `Math.min(days, 21)` flattens what is left → `reduce` breaks ties by `PHASE_1_DAY_TYPES` order, and `plyometric` is last);
- the 78-of-156 instrumentation result: open, un-vetoed, tied, and losing every time;
- the 2×2 measurement showing that fixing either half alone changes nothing at 1–2×/week, and that the cap measured alone is byte-identical to shipped — with the warning that this is what makes the pair easy to dismiss one at a time;
- the explicit note that `NEGLECT_CAP_DAYS` is a product decision, `[unverified]`, and must not be given a fabricated citation;
- the note that the 70-minute ceiling and the CNS constants were checked and do **not** move, because `session.test.mjs`'s sweep passes `dayType` explicitly and never consults `proposeDayType`.

- [x] **Step 2: Bump the service worker**

In `sw.js`, change `const VERSION = 'v19';` to `const VERSION = 'v20';`. This is the only version bump in this plan.

- [x] **Step 3: Full verification before any deploy claim**

Run: `node --test "tests/*.test.mjs"` and read the counts. Expected: **298 pass, 0 fail**. Do not proceed on a remembered result from an earlier step.

- [x] **Step 4: Commit and push**

```bash
git add docs/design-running-programming.md sw.js
git commit -m "Document the rotation defect and ship it as v20"
git push origin main
```

- [x] **Step 5: Verify the deploy, then tell the athlete**

GitHub Pages takes a few minutes. Poll until the deployed worker reports v20:

```bash
until curl -s "https://ninwhippa08.github.io/GymBuddy/sw.js?cb=$(date +%s)" \
  | grep -q "const VERSION = 'v20'"; do sleep 15; done; echo "v20 live"
```

Then confirm the deployed generator carries the fix, not just the version string:

```bash
curl -s "https://ninwhippa08.github.io/GymBuddy/js/generator.js?cb=$(date +%s)" \
  | grep -c "NEGLECT_CAP_DAYS"
```

Expected: `1` or more. **Tell him the app needs a SECOND launch** — swipe fully out of the app switcher and reopen — or the old service worker keeps serving the old JavaScript. In the session that wrote this plan, a stale worker served old code under an unchanged version name and cost three debugging cycles; when checking behaviour in a browser, always confirm the loaded source contains the change before believing what you see.

---

## Self-review

**Spec coverage.** Every claim in the evidence section maps to a task: the 14-day window → Task 1; the bare `21` → Task 2; tie-break by array order → Task 3; the year-long starvation the athlete actually experiences → Task 4; the undocumented mechanism and the undeployed fix → Task 5. The "does not need re-calibrating" findings are recorded in Task 5's §7.5 rather than implemented, which is correct — they are the reason no re-sweep task exists.

**Placeholders.** None. Every test is written out in full; the one prose deliverable (§7.5) is specified as a six-item content list rather than "document it".

**Type consistency.** `stateWith()` is defined once in Task 2 and reused by Task 3 — both are appended to the same file, so Task 3 must be applied after Task 2, as ordered. `iso()` and `DAY` are defined in Task 1's file header and reused in Task 4. `NEGLECT_CAP_DAYS` is a number of days everywhere it appears. `yearOfSessions` returns a plain count map, and only Task 4 consumes it.

**One risk the executor should know.** Task 4's assertion is "at least once a year", not a fairness ratio. That is deliberate: a ratio would need its own calibration and would fail on legitimate behaviour like the CNS veto spacing heavy days apart. If the athlete later wants an even spread rather than mere reachability, that is a new decision and a new plan.
