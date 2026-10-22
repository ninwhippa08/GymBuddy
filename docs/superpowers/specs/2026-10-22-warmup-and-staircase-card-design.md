# Two warm-up sets, and a staircase card — design

Date: 2026-10-22. Status: discussed with the athlete; awaiting his approval of this document.
Target version: v79.

## 1. Intent

The athlete opened the Power Clean card mid-session and was looking for one
thing: **the load for his working sets**. The card gave him five lines of
similar-looking dim text — `4 × 3` top right, `0.80 × Power Clean PR`, a `sets`
line for the ladder, a `warm-up` line with up to five rungs, a `rest` line —
and the number he wanted did not stand out. His words: crowded, not
straightforward. He wants it cleaner and more aesthetic.

He also said more than two warm-up sets is unnecessary, and asked for that to
be checked against the literature before it is changed. It was (§3), and it
holds.

Two changes, one version:

1. **Warm-up ladder: at most two sets** (§3, §4).
2. **Loaded cards get the "staircase" layout** he picked from three mockups
   (§5).

## 2. Goals, non-goals, anti-goals

**Goals**
- The working multiplier is the single most visible thing on a loaded card.
- Every set he will do — warm-up and working — is visible at a glance, in
  order, without reading a sentence of `·`-separated numbers.
- No loaded lift prescribes more than two warm-up sets.

**Non-goals**
- **Absolute weights.** Asked directly on 2026-10-22: keep multipliers. The
  spec rule "never display an absolute weight; the app stores no maxes"
  (`docs/spec.md` §Decisions) stands untouched.
- Redesigning non-loaded cards (`reps`, `contacts`, `interval`, `time`,
  `drill`, `hold`). They keep their current content. They may pick up shared
  header/spacing CSS where it falls out naturally, nothing more.
- The cue face (back of the flip card), the swap button, superset grouping.
- Any change to working sets, working loads, rest, or the return ramp.

**Anti-goals** — it fails even if it technically works if:
- The card gets *taller* or busier than today's for a typical lift.
- The working multiplier is harder to find than today.
- A warm-up rung ever prints heavier than the working set it leads into
  (the plan-05 decision 2 invariant, see `generator.js` ~line 880).
- The 70-minute session cap is broken by the time the shorter warm-up frees
  (it cannot be — fewer sets only shortens — but the sweep must say so).

## 3. What the evidence says about warm-up set count

Researched 2026-10-22. The current ladder count (2–5, scaling with load) rests
on practitioner sources `[corroborated]` in `design-mobility-and-warmup.md`
§2.3; no controlled trial behind it.

- **Ribeiro et al. 2020** (IJERPH 17:6882, n = 40 trained men, crossover) —
  already the app's anchor for `WARMUP.START`. Its *effective progressive*
  warm-up was **two sets**: 6 reps at 40% then 6 reps at 80% of the training
  load. For squat a single 80% set did as well; for bench the two-set
  progression did best. Conclusion: few light reps is not enough — the
  **heavy** warm-up set is what matters. `[verified]`
- **sportRxiv preprint 559** (n = 29 trained, crossover): 0 vs 1 vs 2 specific
  warm-up sets before 4 × 10RM to failure — "negligible to small" differences;
  more sets did not beat fewer. `[corroborated]` (preprint; ~10RM loads, not
  heavy strength work.)
- **Stronger by Science, "heavier warm-ups"** (2024, summarising a Brazilian
  crossover): one heavy warm-up set (80% of 10RM × 5) beat lighter ones; advice
  "stick to 1–2 sets, prioritizing the heavier warm-ups." `[corroborated]`

No trial found that tests more than two sets against two before heavy work.
Reading: **two sets — one light, one heavy — is the evidence-backed dose**;
the 2–5 range was practitioner convention. The athlete's request holds.

Gap worth recording: none of these test near-maximal (≥ 90%) work, where the
practitioner sources want more, smaller jumps. The app's standing ceiling is
0.95, so this matters at the top. §4 keeps the sourced jump limit for exactly
that case rather than ignoring it.

## 4. The warm-up rule (replaces `buildWarmup`'s rung count)

Inputs unchanged: `workingPct` (fraction of the movement's own max, already
ramp- and ceiling-clamped) and `exercise` (`pattern`, `technical`).

- `workingPct < WARMUP.FLOOR` (0.50): **no warm-up**, as today.
- Otherwise **exactly two rungs**:
  - **Rung 1 (light):** `WARMUP.START` (0.30) — unchanged, and it is Ribeiro's
    40%-of-training-load rung already (0.4 × 0.8 = 0.32).
  - **Rung 2 (heavy):** `max(0.80 × workingPct, workingPct − maxJump)`, where
    `maxJump` is the existing body-region jump (`MAX_JUMP` 0.15 lower /
    `MAX_JUMP_UPPER` 0.10 upper). 0.80 is Ribeiro's heavy rung; the `max()`
    keeps the last jump into the work inside the sourced increment band, which
    only binds above ~0.75 (lower) / ~0.50 (upper).
  - If rung 2 would be ≤ rung 1 (cannot happen for working ≥ 0.50 with the
    numbers above, but guard it), emit rung 1 only.
- **Reps** per rung: unchanged, `repsForStep(pct)` off `WARMUP.REPS_BY_PCT`,
  capped at `TECHNICAL_REP_CAP` (3) for `technical: 3` lifts.
- **The extra technical set goes.** Today a `technical: 3` lift (power clean,
  snatch derivatives…) gets an additional set at `START`, which is why the
  power clean showed five. It conflicts with "at most two", and the light
  technical repetition it bought is what the session's prep block already
  provides. *Builder's call recorded as mine, not the athlete's.*
- The jump between rung 1 and rung 2 is allowed to exceed `maxJump`: those are
  light loads, and Ribeiro's own protocol jumps 40% → 80% of working.
- Worked examples (lower body, technical 1):
  - working 0.55 → 0.30 × 8, 0.44 × 8 (0.44 is under the 0.45 reps threshold;
    the reps rule is deliberately unchanged)
  - working 0.80 → 0.30 × 8, 0.65 × 3
  - working 0.90 → 0.30 × 8, 0.75 × 2
  - working 0.95 → 0.30 × 8, 0.80 × 2
  - upper body, working 0.85 → 0.30 × 8, 0.75 × 2 (0.85 − 0.10 lands exactly
    on the 0.75 reps threshold — round the rung to 2 decimals before
    `repsForStep`, as `setPlan` already rounds `pct`)

**Consequences to measure, not assume** (house rule: instrument, don't reason):
- `estimateMinutes`/`packToBudget` price warm-up sets. Fewer of them frees
  main-work minutes, so `packToBudget` may now keep sets it used to shave.
  Run the existing session-length sweep and the ramp sweep
  (`tools/measure.mjs`) before and after; report what moved. The 70-min test
  must still pass.
- **Decided by the athlete, 2026-10-22: the freed time does NOT buy work.**
  Working sets and exercise count per day type and ramp week must match v78
  (same seeds, same sweep); the only visible effect is a shorter session. His
  reason is a standing rule: a session is built from the moves' intensity and
  how they combine, never by filling the clock; time is a ceiling. Today's
  generator does fill the clock (the optional-slot loop stops at
  `rampedMinutes`, and `packToBudget` trims to `MAIN_WORK_MAX_MIN`), so a
  warm-up saving would leak into volume through both.
  **Preferred mechanism (stopgap):** the two budget checks keep pricing a
  loaded block's warm-up at the v78 ladder's cost, while the card and
  `setPlan` carry the new two rungs — so every packing decision is unchanged
  by construction. Name it plainly in code as a temporary hold. The builder
  may choose another mechanism only if the sweep shows identical working sets.
  This hold is removed by the next project: rebuilding session composition
  around intensity and combinations, with time as a final check only.
  **Built (v79):** the held callers are packToBudget's trimming loops, its
  `overBudget` flag, and the fill loop's `rampedMinutes` check; `durationMin`
  prices the real two rungs. So the card's "over the main-work budget"
  warning (ui.js ~714), which is driven by the held `overBudget` flag, fires on
  exactly the sessions v78 warned on, even though `durationMin` is now shorter.
- `rules.js` comments that cite warm-up time in derivations (e.g. around the
  re-derived allowance, ~line 1000) must be re-checked; numbers in them that
  the change falsifies get re-measured or marked stale.
- Ladder architecture (`applyArchitecture`, ~line 937) keeps the warm-up
  entries of `setPlan` as-is; only their count changes.

## 5. The staircase card (loaded blocks)

Applies to blocks whose hero is a multiplier: `mode === 'load'` (the
`loadLine` fallthrough). Mockup the athlete picked: "C · Staircase",
`.superpowers/brainstorm/790-1792684209/content/card-layout.html`.

Front face, top to bottom:

1. **Header row** — exercise name left; right side `sets × reps · rest m:ss`
   (e.g. `4 × 3 · rest 3:00`). Rest joins the header only when it is a plain
   rest (`formatRest`); a superset's rest sentence stays where it is today in
   the meta line. *Format of the time (`3:00` vs `3 min`) is the builder's
   call; reuse `formatRest`/`spanText`.*
2. **Hero** — the working multiplier, large, accent colour: `0.80×`. Directly
   under it, small and dim: `Power Clean PR`. Green when capped (`is-capped`),
   as today. Content is what `loadLine` prints today, split in two.
   **Ladder blocks** (a wave, e.g. .76 .78 .80 .77 .79 .81): the hero stays the
   FIRST working set, as `loadLine` prints today — it is the set he lifts
   first, the reasoning in design-architectures §3.3 — and the staircase shows
   every rung, so no number is hidden. The bars follow the wave as it is,
   including its dips; no smoothing. *My call — the mockup he picked showed the
   middle rung large over a steady climb, which a real wave is not.*
3. **Notes** — the existing `block-note` lines (ramp, ceiling, tierRelaxed,
   rampTierWidened, rampUncapped) and the superset line, unchanged in wording,
   in their current order, between hero and staircase.
4. **The staircase** — one bar per set in `setPlan` order: warm-ups first,
   then working sets.
   - Bar height ∝ that set's `displayMultiplier` (scaled to the tallest bar in
     the block; a minimum height so a 0.30 bar is still visibly a bar).
   - Warm-up bars muted grey; working bars accent (green if capped).
   - Inside/atop each bar: its reps. Under each bar: its multiplier, two
     decimals, leading zero dropped (`.65`) to fit.
   - **No staircase when there is nothing to climb**: a block with no warm-up
     rungs and a straight (non-ladder) architecture gets no bars — a row of
     identical bars only repeats the header's `sets × reps` and makes the card
     taller (anti-goal). Typical case: dynamic-effort work at 0.40–0.60.
     *My call.*
   - Ladder blocks: the bars show the rungs, which is exactly what the `sets`
     line used to say in words.
   - Must fit a 320 px wide card for the worst case: 2 warm-up + the most
     working sets any template can produce. The dynamic-effort slot allows 8
     (`templates.js` ~225), so budget for **10 bars** (~26 px each); confirm the
     true max from the templates. Bars shrink; labels never wrap.
5. **Meta line** — whatever remains (effort cue, `optional`, superset rest),
   as today.

**Removed from loaded cards:** the `sets` text line (`workLine`) and the
`warm-up` text line (`warmupLine`) — the staircase replaces both. The two
functions stay: their text becomes the staircase's accessible description
(`role="img"` + `aria-label`, or visually-hidden text), so screen readers keep
the full prescription. Their existing tests keep passing.

**Implementation constraints:** plain DOM + CSS (flex bars with inline height
styles), no canvas, no SVG library, no dependency — consistent with the
zero-dependency rule. Uses the existing tokens in `style.css :root`.
`prefers-reduced-motion`: no animation needed; if any is added, it honours it.

## 6. Tests and verification

- `buildWarmup`: rung count ≤ 2 for every working pct and technical rating;
  0 below FLOOR; rung 2 < working; last jump ≤ `maxJump` per body region;
  examples in §4 pinned. Existing `tests/ramp.test.mjs` count/spacing tests
  are rewritten to the new rule. **Each new guard is watched failing first**
  against the old code or a deliberate mutation before it is committed.
- Whole-generator property: across a seed sweep, no `setPlan` carries more than
  two `warmup` entries; no warm-up `displayMultiplier` exceeds its working one.
- Session length: existing 70-min sweep test passes; before/after numbers
  recorded in the plan's report.
- UI: `blockCard` on a loaded block renders the staircase with one bar per set
  in order, warm-up bars marked as such, no `block-warmup`/`block-work` text
  lines, accessible label containing the old text; non-loaded blocks render
  exactly as before (snapshot of their text content).
- Version bump to v79 in `js/version.js` and `sw.js`; README updated (the
  graded-assignment rule); `design-mobility-and-warmup.md` §2.3/§4.3 updated
  with §3's evidence and the new rule.
- **Real-browser check, not skippable:** hard-reload the deployed site, footer
  reads v79, generate one session per lifting day type, look at a power clean
  or other technical lift and a squat at phone width. Stale service worker has
  hidden edits twice.

## 7. Left to the builder

- Exact bar sizes, spacing, label font sizes, minimum bar height.
- Whether rest renders `3:00` or `3 min` in the header.
- How the accessible description is attached.
- Whether non-loaded cards share the new header CSS (only if it costs nothing
  and changes no content).
