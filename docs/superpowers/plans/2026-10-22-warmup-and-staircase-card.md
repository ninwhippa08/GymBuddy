# Two Warm-up Sets and a Staircase Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap every loaded lift's warm-up at two sets, without changing any working set, and replace the loaded card's text lines with a bar "staircase" (v79).

**Architecture:** `buildWarmup` gets the two-rung rule; the old ladder survives as `legacyWarmup`, used ONLY to price warm-up time in the two budget checks, so every packing decision stays identical to v78 (a labelled stopgap). A fixture captured from v78 before any change pins the working output. The card gains a pure `staircase(block)` model and a DOM renderer; `warmupLine`/`workLine` become its accessible description.

**Tech Stack:** Plain ES modules, no dependencies, no build. Tests: `node --test tests/*.test.mjs` (DOM via `tests/dom-shim.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-22-warmup-and-staircase-card-design.md`

## Global Constraints

- Zero dependencies, no build step, no canvas, no SVG library; plain DOM + CSS using `style.css :root` tokens.
- Never display an absolute weight; the hero stays a multiplier of a PR.
- Working sets, reps, loads, exercise choice and count must equal v78 for every day type and ramp week (athlete's decision, spec §4).
- Warm-up: `< WARMUP.FLOOR` (0.50) → none; else rung 1 at `WARMUP.START` (0.30), rung 2 at `max(0.80 × working, working − maxJump)`; at most 2 rungs for every lift including `technical: 3`.
- Version v79 in `js/version.js` and `sw.js`; README kept current (graded assignment).
- Every new guard is watched failing (old code or deliberate mutation) before it is committed.
- Card must fit 320 px with 10 bars; labels never wrap.

## Review Focus

1. **A warm-up leaking into volume through a path the hold misses** (e.g. a third `estimateMinutes` budget caller, a swap) — expected: no working-set change anywhere. Pinned by Task 1's fixture across all day types × ramp weeks, plus Task 2 Step 6's swap check.
2. **Capped / prCoef ≠ 1 blocks** — a warm-up bar must never print heavier than the working bar it leads into. Task 2 property test.
3. **Ladder waves with dips and 10-bar blocks at 320 px** — bars follow the wave, labels don't wrap. Task 3 tests + browser check in Task 4.
4. **Superset cards** — rest sentence stays in the meta line, not the header. Task 3 test.
5. **Non-loaded cards unchanged** (interval, reps, contacts, hold) — Task 3 regression test on text content.

---

### Task 1: Pin v78's working output before anything changes

**Files:**
- Create: `tests/fixtures/work-v78.json`, `tests/work-held.test.mjs`
- Modify: `tests/fixtures/README.md` (new section)

**Interfaces:**
- Produces: fixture keyed `fixture[dayType][week][seed]` → `blocks.map(workPrint)` where
  `workPrint(b) = [b.slot, b.exerciseId, b.sets, b.reps, b.displayMultiplier ?? null, b.architecture ?? null, (b.setPlan||[]).filter(s=>s.kind==='work').map(s=>[s.reps, s.displayMultiplier])]`.
  `workPrint` lives in the test file and is used for both capture and assertion.

- [ ] **Step 1:** Write `tests/work-held.test.mjs`: imports `generate` (`js/generator.js`), `PHASE_1_DAY_TYPES` (`js/templates.js`), library from `data/exercises.json`; `NOW = 1e12` and `atWeek(w)` exactly as `tests/ramp-budget.test.mjs:118-122`. One test, `'working sets are what v78 built, every day type and ramp week'`: for each day type in `PHASE_1_DAY_TYPES`, weeks 1–5, seeds 1–20, `assert.deepEqual(s.blocks.map(workPrint), fixture[dayType][week][seed])`. Also export a `capture()` path behind `process.env.CAPTURE_WORK === '1'` that writes the fixture instead of asserting.
- [ ] **Step 2:** Capture on the current tree (it IS v78 behaviour; no behavioural commit has landed yet): `CAPTURE_WORK=1 node --test tests/work-held.test.mjs`. Confirm the file has 7 day types × 5 weeks × 20 seeds.
- [ ] **Step 3:** Run `node --test tests/work-held.test.mjs` → PASS.
- [ ] **Step 4: Watch it fail.** Temporarily set `WARMUP.MAX_JUMP` to `0.30` in `js/rules.js` (fewer legacy rungs → cheaper sessions → packing changes). Run → expect FAIL on some seed. Revert; run → PASS. Record which seed failed in the commit message.
- [ ] **Step 5:** Add a `work-v78.json` section to `tests/fixtures/README.md`: what it pins, captured from which commit, why it must not be regenerated from a tree carrying Task 2.
- [ ] **Step 6:** Full suite green. Commit: `Pin v78's working output before the warm-up changes`.

### Task 2: Two warm-up sets, budget priced as before

**Files:**
- Modify: `js/generator.js` (`buildWarmup` ~667, `prescribe` ~887, `blockSeconds` ~1126, `estimateMinutes` ~1192, `packToBudget` ~1554/1570, fill loop ~2209), `js/rules.js` (`WARMUP` comment block ~239: add `HEAVY_RUNG: 0.80` with the Ribeiro citation; mark `TECHNICAL_REP_CAP` comment that the extra technical set is gone)
- Test: `tests/ramp.test.mjs` (rewrite count/spacing tests), `tests/work-held.test.mjs` (unchanged, must stay green)

**Interfaces:**
- Produces: `buildWarmup(workingPct: number, exercise = {}) → Array<{kind:'warmup', reps, pct}>` (length 0, 1 or 2).
- Produces: `legacyWarmup(workingPct, exercise = {})` — the v78 function body, verbatim, renamed and exported; comment: TEMPORARY HOLD, pricing only, removed by the session-composition rebuild (spec §4).
- Produces: `block.budgetWarmupReps: number[]` set in `prescribe` whenever `setPlan` is set — `legacyWarmup(pct, exercise).map(s => s.reps)`.
- Produces: `estimateMinutes(blocks, { held = false } = {})`. With `held`, `blockSeconds` prices warm-ups from `b.budgetWarmupReps` (same per-rung formula: `reps × secPerRep × sides + TIME.WARMUP_REST_SEC`) when present, else from `setPlan`. Without `held` it prices the real `setPlan` (used for `durationMin`, ~2390).

- [ ] **Step 1: Write failing tests** in `tests/ramp.test.mjs` (replace the count, spacing, worked-example and technical-extra-set tests; keep floor and kind tests):
  - `'never more than two warm-up sets'`: for working in `[0.50..0.95 step 0.01]` × `{technical:1}`, `{technical:3}`, upper `{pattern:'push-h'}` → `length <= 2`, and `=== 2` for ≥ 0.50.
  - `'rung one is WARMUP.START, rung two is the heavy rung'`: `pcts(buildWarmup(0.80, plain))` deep-equals `[0.30, 0.65]`; `0.90 → [0.30, 0.75]`; `0.95 → [0.30, 0.80]`; `0.55 → [0.30, 0.44]`; upper 0.85 → `[0.30, 0.75]`.
  - `'the jump into the work stays inside the body-region band'`: for all workings above, `working − rung2 <= maxJump + 1e-9` (0.15 lower, 0.10 upper).
  - `'reps are unchanged rules'`: `buildWarmup(0.55, plain).map(s=>s.reps)` → `[8, 8]`; `0.80 → [8, 3]`; `0.90 → [8, 2]`; technical 3 at 0.80 → `[3, 3]`.
  - `'a technical lift gets no extra set'`: `buildWarmup(0.80,{technical:3}).length === 2`.
  - Move the old ladder tests to target `legacyWarmup` under a heading comment "pricing hold" (keep them; they pin what the hold prices).
- [ ] **Step 2:** Run `node --test tests/ramp.test.mjs` → FAIL (old ladder has 4–5 rungs).
- [ ] **Step 3:** Implement `buildWarmup` per Global Constraints. Round rung 2 to 2 decimals before `repsForStep` (upper 0.85 lands on the 0.75 threshold). If rung 2 ≤ rung 1, return rung 1 only.
- [ ] **Step 4:** Implement `legacyWarmup`, `budgetWarmupReps`, `estimateMinutes({held})`; pass `{ held: true }` at the `packToBudget` loops and the fill loop's `rampedMinutes` check. Grep every `estimateMinutes(` caller and record in the commit message which got `held` and why the rest did not.
- [ ] **Step 5:** Run `node --test tests/ramp.test.mjs tests/work-held.test.mjs` → PASS. If `work-held` fails, the hold is leaking: find the caller, do not touch the fixture.
- [ ] **Step 6: Swap check.** Add to `tests/work-held.test.mjs`: `'a swap is priced the same as before'` — for power and max-strength, seeds 1–20, week 1 and 5, swap slot `A` via the same call `tests/swap.test.mjs` uses and assert the swapped block carries `budgetWarmupReps` whenever it carries `setPlan`.
- [ ] **Step 7:** Property test in `tests/ramp.test.mjs`: across all `PHASE_1_DAY_TYPES` × weeks 1–5 × seeds 1–20, every `setPlan` has ≤ 2 `warmup` entries and every warm-up `displayMultiplier` < the first `work` entry's.
- [ ] **Step 8: Watch the hold fail.** Temporarily make `blockSeconds` ignore `held`. Run `work-held` → FAIL. Revert → PASS. Record in commit.
- [ ] **Step 9:** Full suite green (session-length sweep included). Commit: `Two warm-up sets; the budget still prices the old ladder (temporary hold)`.

### Task 3: The staircase card

**Files:**
- Modify: `js/ui.js` (`blockCard` ~248; new `staircase`, `stairEl`, `heroParts`), `style.css` (hero, header, `.stair*` rules after `.block-work` ~195)
- Test: `tests/ui.test.mjs` (pure model), `tests/card.test.mjs` (DOM)

**Interfaces:**
- Produces: `staircase(block) → Array<{kind:'warmup'|'work', reps:number, displayMultiplier:number}>` — `setPlan` in order when it exists; `[]` when the block is not `mode:'load'`, or has no warm-up rungs AND is not a ladder.
- Produces: `heroParts(block) → { value: '0.80×', ref: 'Power Clean PR' }` for `mode:'load'`, else `null`.
- Consumes: `warmupLine`, `workLine`, `formatRest`, `supersetRestLine` (unchanged).

- [ ] **Step 1: Failing tests, `tests/ui.test.mjs`:**
  - `staircase` on a block with 2 warm-ups + 3 work → 5 entries, kinds `['warmup','warmup','work','work','work']`, multipliers in setPlan order.
  - ladder wave `[.76,.78,.80,.77,.79,.81]`, no warm-ups → 6 work entries, order preserved (dips kept).
  - straight `mode:'load'` with no `setPlan` → `[]`; `mode:'reps'` → `[]`.
  - `heroParts({mode:'load', displayMultiplier:0.8, prRef:'power-clean'})` → `{ value:'0.80×', ref:'Power Clean PR' }`; interval → `null`.
- [ ] **Step 2: Failing tests, `tests/card.test.mjs`:**
  - Loaded block with setPlan: `.stair` exists with one `.stair-bar` per set; warm-up bars have class `is-warmup`; each bar shows its reps and a label like `.65` (leading zero dropped); no `.block-warmup` or `.block-work` element; `.stair` has `role="img"` and an `aria-label` containing `warmupLine(block)` text and, for ladders, `workLine(block)`.
  - Tallest bar has height `100%`; every bar's height ≥ the CSS minimum (assert on inline style ≥ 18%).
  - Header `.block-volume` reads `3 × 5 · rest 3 min` for a plain block; a superset block's header has no rest and its `.block-meta` still has the superset rest sentence.
  - Hero: `.block-load` text `0.72×` and `.block-load-ref` text `Back Squat PR`; capped block keeps `is-capped` on `.block-load` (existing test at ~320 stays green).
  - Regression: interval, reps, contacts and hold blocks — front-face `textContent` identical to before this task (capture strings first, assert equal).
  - 10-bar block renders 10 bars (layout width itself is checked in the browser, Task 4).
- [ ] **Step 3:** Run both test files → FAIL.
- [ ] **Step 4:** Implement `staircase`, `heroParts`, `stairEl(block)`, and wire into `blockCard`: for loaded blocks render hero as two nodes, rest in header when `!block.group`, staircase after the notes and superset line, drop the warm-up/work `<p>`s; leave every other mode's rendering untouched. Bar height = `max(18, round(100 × m / maxM))%`. CSS: bars flex with `gap`, `min-width: 0`, labels `font-size` small enough for 10 bars at 320 px, `white-space: nowrap`; warm-up bars `--surface-edge`/dim text, work bars `--accent`, capped block work bars `#6fd08c`.
- [ ] **Step 5:** Run → PASS. Full suite green.
- [ ] **Step 6: Watch a guard fail:** reverse the bar order in `staircase` → the order test fails; revert.
- [ ] **Step 7:** Commit: `The staircase card: one bar per set, the multiplier as the hero`.

### Task 4: Measure, document, ship v79

**Files:**
- Modify: `js/version.js`, `sw.js` (v79), `README.md`, `docs/design-mobility-and-warmup.md` (§2.3 evidence from spec §3; §4.3 new rule + the hold), `docs/programming-basis.md` only if it states a warm-up count
- Test: `tests/version.test.mjs` (existing)

- [ ] **Step 1: Measure.** Scratch script (not committed): for all `PHASE_1_DAY_TYPES`, weeks 1 and 5, seeds 1–300, mean `durationMin` and mean working sets on v78 (`git worktree` at `7bdbfdd`) vs this branch. Expected: working sets identical; `durationMin` lower. Put the table in the task report and in `design-mobility-and-warmup.md` §4.3.
- [ ] **Step 2:** Re-check `rules.js` comments that quote warm-up-driven numbers (~760-775, ~1000-1030). Pricing is held, so the packing numbers stand — say so in one line at each; any number about *displayed* duration is marked as pre-v79.
- [ ] **Step 3:** Docs + README: two-set warm-up with sources, the staircase card, the temporary pricing hold and that it ends with the session-composition rebuild. Update README test count.
- [ ] **Step 4:** Bump v79 in both files; `node --test tests/version.test.mjs` → PASS; full suite green; note the count.
- [ ] **Step 5:** Commit: `Two warm-up sets and a staircase card (v79)`.
- [ ] **Step 6 (after merge + push, not skippable):** On the deployed Pages site at phone width: hard-reload until the footer reads v79 (check for a stale service worker first), generate one session per lifting day type, inspect a power clean (technical), a squat (lower), a bench (upper), a laddered block and the widest block available. Screenshot for the athlete.
