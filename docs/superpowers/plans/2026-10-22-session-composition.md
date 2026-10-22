# Sessions Built From the Work, Not the Clock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On lifting days, admit optional exercises by weekly need, per-session dose and count only; remove every minute-based gate and trim, and the v79 pricing hold (v80).

**Architecture:** A pure helper decides which of an optional slot's patterns still qualify (weekly debt + session dose, contacts slots exempt from dose); the fill loop narrows the slot to those patterns or skips it. Lifting days stop calling `packToBudget` and lose the `rampedMinutes` check; the hold machinery from v79 is deleted. A `compose` sweep measures the result and gates the ramp.

**Tech Stack:** Plain ES modules, zero dependencies, no build. Tests: `node --test tests/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-22-session-composition-design.md`

## Global Constraints

- Lifting day types = those whose `DAY_TYPES[dayType].targets` is non-empty (`max-strength`, `power`, `hypertrophy`). Every other day type's behaviour is unchanged, including `packToBudget`.
- `VOLUME.SESSION_DOSE = { strength: 2, hypertrophy: 10 }`; goal map: `max-strength`→strength, `power`→strength, `hypertrophy`→hypertrophy.
- Session dose counts direct working sets on blocks passing `countsTowardVolume`, using the pre-ramp set counts the fill loop holds.
- Contacts-mode optional slots are exempt from the session dose (still need weekly debt and count).
- `MAX_MAIN_SLOTS` (8) and `rampedSlots` stay. `rampedMinutes` is removed. No minute budget is consulted when building or trimming a lifting session. No time limit on lifting days (athlete's decision, spec §1).
- `capPatternSets` stays (a sourced dose rule, not a clock rule) and runs on lifting days as before.
- Ramp requirement: for each lifting day type and ramp week 1–4, mean delivered working sets ≤ `RAMP[w].volume ×` that day type's week-5 mean, measured on v80.
- Zero dependencies. Every new guard is watched failing before commit. Comments explain why and cite the spec.
- v80 in `js/version.js` and `sw.js`; README current.

## Review Focus

1. **An optional slot drawing a pattern that did not qualify** (e.g. `patterns: null` slots, the coverage narrowing path, the tier-widening retry) — expected: the drawn exercise's pattern is always one of the qualifying patterns. Task 1 sweep test.
2. **A required working set removed on a lifting day by anything other than `capPatternSets`/`rampToBudget`** — expected: none. Task 2 test.
3. **Ramp week overshoot once the minute gate is gone** — expected: within column. Task 3 gate.
4. **Superset pairing and ladders on larger sessions** (`pairAntagonists` now sees more blocks; ladders unaffected) — expected: no orphaned pair, every pair still adjacent. Task 2 sweep assertion.
5. **Non-lifting day types silently changed** — expected: identical output. Task 2 test against a fixture captured before Task 1.

---

### Task 1: The session-dose admission rule

**Files:**
- Modify: `js/rules.js` (`VOLUME`: add `SESSION_DOSE`, comment citing Remmert et al. 2025 preprint per spec §3), `js/generator.js` (new helpers beside `patternDebt` ~623; fill loop ~2259–2280)
- Create: `tests/compose.test.mjs`, `tests/fixtures/nonlifting-v79.json`

**Interfaces:**
- Produces: `sessionGoal(dayType) → 'strength' | 'hypertrophy' | null`.
- Produces: `sessionSets(pattern, blocks) → number` — sum of `sets` over `blocks` with `countsTowardVolume(b) && b.pattern === pattern`.
- Produces: `qualifyingPatterns(slot, dayType, state, blocks) → string[]` — candidates = `slot.patterns ?? targets`, intersected with `targets`; keep `p` with `patternDebt(p, dayType, state) > 0`; then, unless `slot.mode === 'contacts'`, keep `p` with `sessionSets(p, blocks) < VOLUME.SESSION_DOSE[sessionGoal(dayType)]`.

- [ ] **Step 1: Capture the non-lifting fixture first** (before any code change): for `aerobic-steady, interval, sprint, plyometric, mobility` (every `PHASE_1_DAY_TYPES` entry without targets) × weeks 1 and 5 (`atWeek` as in `tests/ramp-budget.test.mjs:118-122`) × seeds 1–20, store `s.blocks.map(b => [b.slot, b.exerciseId, b.sets, b.reps ?? null, b.durationMin ?? null])` and `s.durationMin`. Capture path behind `CAPTURE_NONLIFTING=1` in `tests/compose.test.mjs`; document in `tests/fixtures/README.md`.
- [ ] **Step 2: Failing unit tests** in `tests/compose.test.mjs`:
  - `sessionGoal`: `max-strength`→`'strength'`, `power`→`'strength'`, `hypertrophy`→`'hypertrophy'`, `interval`→`null`.
  - `sessionSets('squat', [{mode:'load',role:'main lift',pattern:'squat',sets:4},{mode:'load',role:'accessory',pattern:'hinge',sets:3},{mode:'drill',role:'prep',pattern:'squat',sets:2}])` → `4`.
  - `qualifyingPatterns`: max-strength, empty state (all debt), blocks with 4 squat sets, slot `{patterns:['squat','pull-h'], mode:'load'}` → `['pull-h']`; same with slot `patterns:null` → every max-strength target except `'squat'`; hypertrophy with 9 squat sets → `'squat'` still qualifies, with 10 → not; power, slot `{patterns:['jump','throw'], mode:'contacts'}` with 3 jump sets in blocks → both qualify (exempt); a pattern with `patternDebt` 0 (state with `patternSets[p]` ≥ weekly target) never qualifies.
- [ ] **Step 3:** Run `node --test tests/compose.test.mjs` → FAIL (not defined).
- [ ] **Step 4:** Implement the three helpers and `VOLUME.SESSION_DOSE`.
- [ ] **Step 5:** Wire into the fill loop: for an optional slot on a lifting day, `const ok = qualifyingPatterns(slot, chosen, state, blocks)`; `if (!ok.length) continue;` then draw with the slot's patterns narrowed to `ok` (copy the slot; same pattern the coverage path uses to narrow). Replace the existing `serves.some(patternDebt > 0)` check. Leave `MAX_MAIN_SLOTS`, `rampedSlots`, `rampedMinutes` and `packToBudget` as they are in this task.
- [ ] **Step 6: Sweep test** `'an optional block is always on a qualifying pattern'`: lifting day types × weeks 1–5 × seeds 1–100; replay the fill by recomputing, for each optional block in `s.blocks` order of admission, that its pattern was in `qualifyingPatterns` given the blocks before it. (If replay is impractical, record `block.admittedPatterns` in the fill loop and assert `admittedPatterns.includes(block.pattern)` — say which.)
- [ ] **Step 7:** Test `'non-lifting day types are unchanged'` against the Step 1 fixture → PASS.
- [ ] **Step 8: Watch both guards fail:** narrow-skip removed (draw with the unnarrowed slot) → Step 6 fails; `SESSION_DOSE.strength = 99` → a Step 2 assertion fails. Revert.
- [ ] **Step 9:** Full suite. Tests that fail because they encoded the old admission (expected session counts, coverage counts) are updated **only** where the new value follows from spec §4; list each changed assertion with old → new and why in the report. Commit: `Optional slots admitted by weekly need and session dose`.

### Task 2: Take the clock out of lifting days and remove the v79 hold

**Files:**
- Modify: `js/generator.js` (fill loop `rampedMinutes` ~2276; `packToBudget` call ~2313; `finalise` warning text ~2386; `legacyWarmup` ~714 and export; `budgetWarmupReps` in `prescribe` ~955; `held` in `blockSeconds`/`pairSeconds`/`estimateMinutes` ~1180–1270 and their comments), `js/rules.js` (comments that describe the hold), `tests/ramp.test.mjs` (remove `legacyWarmup` import and the pricing-hold tests), `tests/session.test.mjs` (exclude lifting day types from both duration sweeps; comments cite spec §1), `docs/spec.md` (requirements row "Gym session total ≤ 70 min": retired for lifting days 2026-10-22, quote the athlete), `tests/fixtures/README.md`
- Delete: `tests/work-held.test.mjs`, `tests/fixtures/work-v78.json`
- Test: `tests/compose.test.mjs`

**Interfaces:**
- Consumes: Task 1's helpers and fixture test.
- Produces: `estimateMinutes(blocks) → number` (no options). `session.trimmedSlots` stays `[]` and `overBudget` `false` on lifting days.

- [ ] **Step 1: Failing tests** in `tests/compose.test.mjs`:
  - `'nothing trims a lifting session'`: lifting × weeks 1–5 × seeds 1–100 → `s.trimmedSlots.length === 0`, `s.overBudget !== true`.
  - `'required working sets survive to the card'`: for each lifting session, every required-slot block's `sets` equals what remains after `rampToBudget` and `capPatternSets` (use `session.rampSets` / recompute via exported functions on the pre-pack blocks — record the method); i.e. no set is removed by any other step.
  - `'every superset is adjacent and complete'`: each `group` has exactly two blocks, adjacent in `s.blocks`.
  - `'the v79 hold is gone'`: `generator.js` exports no `legacyWarmup`; no block carries `budgetWarmupReps`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Remove `rampedMinutes`; skip `packToBudget` for lifting day types (pass blocks through with `trimmedSlots: []`, `overBudget: false`); delete the hold; fix the "45 min" text to read the constant; update `session.test.mjs`, `ramp.test.mjs`, `spec.md`, fixtures README; delete the work-held test and fixture.
- [ ] **Step 4:** Run `node --test tests/compose.test.mjs tests/session.test.mjs tests/ramp.test.mjs` → PASS, and Task 1's non-lifting fixture test still PASS.
- [ ] **Step 5: Watch it fail:** re-insert the `packToBudget` call for lifting days → `'nothing trims a lifting session'` fails. Revert.
- [ ] **Step 6:** Full suite; same rule as Task 1 Step 9 for tests that encoded the clock (list each). Commit: `Lifting days: no minute gate, no trim, no pricing hold`.

### Task 3: Measure, and the ramp gate

**Files:**
- Modify: `tools/measure.mjs` (new `compose [seeds]` command in the existing style; update the `ramp` command's closing notes that mention `rampedMinutes`)

- [ ] **Step 1:** `compose`: per lifting day type, weeks 1–5, default 300 seeds — mean exercises (blocks passing `countsTowardVolume` with mode load/reps/contacts), mean working sets, mean and max sets per pattern, `durationMin` mean/p90/max, mean `cnsLoad`; plus the ramp check: week w mean sets ÷ week-5 mean sets vs `RAMP[w-1].volume`, marked PASS/OVER.
- [ ] **Step 2:** Run `node tools/measure.mjs compose` on v80 and on v79 (temporary worktree at `aec98ca` outside the repo, removed after). Put both tables in the report.
- [ ] **Step 3: Gate.** If any ramp week is OVER, stop: report status BLOCKED with the table. Do not add a time rule.
- [ ] **Step 4:** Commit: `measure.mjs compose: what a lifting session is made of, by week`.

### Task 4: Docs, README, v80

**Files:**
- Modify: `docs/programming-basis.md` (the admission rule, sources, the no-time-limit decision quoted, Task 3's table), `docs/design-architectures.md` §7 (`rampedMinutes` removed, why), `js/rules.js` comments on `TIME.MAIN_WORK_MAX_MIN` / `MAX_MAIN_SLOTS` (what still reads them), `README.md` ("how a session is built", ~75-min lifting sessions by design, test count), `js/version.js`, `sw.js` (v80)
- Test: `tests/version.test.mjs`

- [ ] **Step 1:** Write the docs; every number from Task 3's report, tagged measured with seed count.
- [ ] **Step 2:** Bump v80; `node --test tests/version.test.mjs` → PASS; full suite green; README count matches.
- [ ] **Step 3:** Commit: `Sessions built from the work, not the clock (v80)`.
- [ ] **Step 4 (controller, after the athlete sees Task 3's table and approves merge + push):** deployed site footer reads v80; one session per lifting day type.
