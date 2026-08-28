# Equipment constraints and per-block swap — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the athlete say what equipment he does not have today and get the same day type back refilled from what he can actually use, and let him replace a single block with another that hits the same area.

**Architecture:** One filter line in `eligibleFor` carries the constraint, so equipment sits beside venue, soreness and bans rather than in a second place. A required slot that empties is retried across all tiers before the day type is abandoned. Buildability is read off the real fill (`unfilled`) rather than predicted by a parallel check. The swap reuses `fillSlot` + `prescribe`, narrowed to the replaced block's pattern.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. `node:test` + `node:assert/strict`.

**Spec:** `docs/design-equipment-and-swap.md`

## Global Constraints

- **No dependencies, no build step.** Plain ES modules the athlete can read. There is no `package.json` and nothing may introduce one.
- **Run the suite as `node --test tests/*.mjs`** from `C:\Users\Yunus\Desktop\GymBuddy`. Not `node --test tests/` — the directory form collapses to a single failing test on this machine.
- **Every task ends green.** The suite is **131 tests** at the start of this plan and must never be left red between tasks.
- **`js/ui.js` is pure rendering.** Every function takes data and returns a detached DOM node. Nothing there reads `localStorage` or generates a session; `js/app.js` does the wiring.
- **Build DOM with `createElement`/`textContent`, never `innerHTML`.** Use the local `el()` helper.
- **Comments explain why, not what.** Comments in this codebase carry decisions and cite design sections. Match that; do not narrate the code.
- **Write `--`, not an em dash, inside JavaScript string literals** — every existing effort cue and card note does.
- **`sw.js` `VERSION` is bumped once**, in Task 11, not per task. It is `'v8'` now; the deploy sets `'v9'`.

---

## File structure

| File | Responsibility after this plan |
|---|---|
| `js/rules.js` | Gains `NON_NEGOTIABLE_EQUIPMENT` and `ALL_TIERS`. Still the only place constants live. |
| `js/generator.js` | Gains the equipment filter, tier relaxation, `requiredUnfilled`, `offerableEquipment`, `resolveSession`, `swapBlock`. |
| `js/storage.js` | Unchanged — `commitSession` already replaces by date, which is exactly what a constrained regenerate needs. |
| `js/ui.js` | Gains the `tierRelaxed` note, the equipment control, the swap control, the nothing-buildable screen. |
| `js/app.js` | Wires both controls to `resolveSession` and `swapBlock`. |
| `tests/equipment.test.mjs` | New. Tasks 1–6. |
| `tests/swap.test.mjs` | New. Task 9. |
| `tests/ui.test.mjs`, `tests/card.test.mjs` | Extended for the card note and the two controls. |

---

### Task 1: The equipment filter

**Files:**
- Modify: `js/rules.js` (immediately after the `MODALITIES` block)
- Modify: `js/generator.js` (`eligibleFor`, currently at line 320)
- Test: `tests/equipment.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `NON_NEGOTIABLE_EQUIPMENT: readonly string[]`. `eligibleFor(slot, library, ctx)` now reads `ctx.excludeEquipment: string[]`, defaulting to `[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/equipment.test.mjs`:

```js
// Equipment constraints. design-equipment-and-swap.md §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligibleFor } from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { NON_NEGOTIABLE_EQUIPMENT } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const MAIN_LIFT = TEMPLATES['max-strength'][0];
const ids = (slot, excludeEquipment = []) =>
  eligibleFor(slot, LIB, { venue: 'gym', excludeEquipment }).map(e => e.id);

test('an empty constraint changes nothing', () => {
  assert.deepEqual(ids(MAIN_LIFT, []), ids(MAIN_LIFT));
});

test('excluding the barbell removes the back squat', () => {
  assert.ok(ids(MAIN_LIFT).includes('back-squat'));
  assert.ok(!ids(MAIN_LIFT, ['barbell']).includes('back-squat'));
});

test('equipment is a conjunction -- losing any one item rules an entry out', () => {
  // back-squat lists ["barbell","rack","plates"]. It needs all three, so
  // excluding only the plates must still remove it.
  for (const gear of ['barbell', 'rack', 'plates']) {
    assert.ok(!ids(MAIN_LIFT, [gear]).includes('back-squat'),
      `excluding ${gear} left the back squat in`);
  }
});

test('excluding one item does not remove entries that never needed it', () => {
  assert.ok(ids(MAIN_LIFT, ['kettlebell']).includes('back-squat'));
});

test('the non-negotiables are the three that cannot be absent', () => {
  assert.deepEqual([...NON_NEGOTIABLE_EQUIPMENT].sort(),
    ['bodyweight', 'open-space', 'wall']);
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/equipment.test.mjs`
Expected: FAIL. `NON_NEGOTIABLE_EQUIPMENT` is not exported yet, so the import throws. Add the constant (Step 3) and re-run to see the real failure: `excluding the barbell removes the back squat`, because `eligibleFor` ignores the field.

- [ ] **Step 3: Add the constant to `js/rules.js`**

Immediately after the `MODALITIES` block:

```js
// Equipment you cannot turn up without. Offering these in the "what's missing
// today" control would be offering a way to have no session at all. `wall` is
// here by the athlete's decision, 2026-08-27: it appears only on cool-down
// stretches, so excluding it costs nothing and saves a checkbox.
// design-equipment-and-swap.md §3.2.
export const NON_NEGOTIABLE_EQUIPMENT = Object.freeze([
  'bodyweight', 'open-space', 'wall'
]);
```

- [ ] **Step 4: Add the filter line to `eligibleFor`**

Extend the destructure:

```js
  const { soreness = {}, banned = [], venue, excludeIds = new Set(),
          excludeEquipment = [] } = ctx;
```

and add this immediately after the `banned.includes` line, before the tier check:

```js
    // An entry's `equipment` array is a conjunction: a back squat lists
    // barbell AND rack AND plates because it needs all three, so losing any
    // one of them rules it out. Hence `.some`, not `.every`.
    // design-equipment-and-swap.md §3.1.
    if (excludeEquipment.length &&
        (e.equipment || []).some(q => excludeEquipment.includes(q))) return false;
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node --test tests/equipment.test.mjs` — expect 5 pass.
Then `node --test tests/*.mjs` — expect **136 pass, 0 fail**. The filter is inert with an empty constraint, so nothing existing moves.

- [ ] **Step 6: Commit**

```bash
git add js/rules.js js/generator.js tests/equipment.test.mjs
git commit -m "Filter eligible exercises by absent equipment"
```

---

### Task 2: `generate()` carries the constraint

**Files:**
- Modify: `js/generator.js` (`generate`, currently at line 769; and `finalise`)
- Test: `tests/equipment.test.mjs`

**Interfaces:**
- Consumes: Task 1's `ctx.excludeEquipment`.
- Produces: `generate({ ..., excludeEquipment })`; the returned session carries `excludeEquipment: string[]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/equipment.test.mjs`, and add `generate` to the existing `../js/generator.js` import:

```js
const gen = (excludeEquipment, dayType = 'max-strength', seed = 42) =>
  generate({ library: LIB, dayType, seed, excludeEquipment,
             profile: { venue: 'gym' } });

test('a constrained session contains none of the excluded equipment', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell']).blocks) {
    const gear = byId.get(b.exerciseId).equipment || [];
    assert.ok(!gear.includes('barbell'),
      `${b.exerciseId} needs a barbell and should not be here`);
  }
});

test('the session records the constraint it was built under', () => {
  assert.deepEqual(gen(['barbell', 'rack']).excludeEquipment, ['barbell', 'rack']);
  assert.deepEqual(gen([]).excludeEquipment, []);
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/equipment.test.mjs`
Expected: FAIL — the constrained session still names a barbell lift, because `generate` never puts `excludeEquipment` into `ctx`.

- [ ] **Step 3: Thread it through `generate`**

Add the option:

```js
export function generate({
  library,
  profile = {},
  history = [],
  soreness = {},
  dayType = null,
  excludeEquipment = [],
  seed = Date.now(),
  now = Date.now()
} = {}) {
```

add it to `ctx`:

```js
  const ctx = {
    soreness,
    banned: profile.banned || [],
    venue: env.venue,
    state,
    excludeIds: new Set(),
    excludeEquipment
  };
```

pass it into `finalise`:

```js
  return finalise({
    chosen, env, architecture, proposal, ordered, packed, cooled,
    unfilled, state, seed, now, excludeEquipment
  });
```

accept it in `finalise`'s destructured parameter, and add one line to the returned object directly after `soreness: []`:

```js
    excludeEquipment,
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/*.mjs` — expect **138 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/equipment.test.mjs
git commit -m "Thread the equipment constraint through generate"
```

---

### Task 3: `unfilled` says whether the slot was required

**Files:**
- Modify: `js/generator.js` (the fill loop in `generate`; the warning and return object in `finalise`)
- Test: `tests/equipment.test.mjs`

**Interfaces:**
- Produces: session `unfilled: Array<{ slot: string, optional: boolean }>`; `requiredUnfilled(session): Array<{ slot, optional }>`.

Today `unfilled` holds bare slot letters (`['A']`) and never leaves `finalise`. Task 6's fallback has to tell "the optional strides slot was skipped, as it is on every gym day" from "the main lift could not be built", so optionality must survive and the array must be returned.

- [ ] **Step 1: Write the failing test**

Append to `tests/equipment.test.mjs`, adding `requiredUnfilled` to the generator import:

```js
test('a buildable day reports no required slot unfilled', () => {
  assert.deepEqual(requiredUnfilled(gen(['barbell'])), []);
});

test('unfilled records optionality, not just the letter', () => {
  for (const u of gen(['barbell', 'rack', 'plates']).unfilled) {
    assert.equal(typeof u.slot, 'string');
    assert.equal(typeof u.optional, 'boolean');
  }
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/equipment.test.mjs`
Expected: FAIL on the import — `requiredUnfilled` is not exported.

- [ ] **Step 3: Record optionality, return the array, add the helper**

In `generate`'s fill loop, change the skip:

```js
    if (!exercise) {
      unfilled.push({ slot: slot.slot, optional: !!slot.optional });
      continue;
    }
```

In `finalise`, the warning now maps:

```js
  if (unfilled.length) {
    warnings.push(`no eligible exercise for slot ${unfilled.map(u => u.slot).join(', ')}`);
  }
```

Add `unfilled,` to `finalise`'s returned object, directly after `warnings,`.

Then, next to `estimateMinutes`:

```js
// Which slots the session NEEDED and could not fill. An optional slot coming
// back empty is routine -- the easy-day strides slot is empty on every gym
// day. A required one means this day type cannot be built as asked, which is
// what the fallback reads. design-equipment-and-swap.md §4.1.
export function requiredUnfilled(session) {
  return (session.unfilled || []).filter(u => !u.optional);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/*.mjs` — expect **140 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/equipment.test.mjs
git commit -m "Record whether an unfilled slot was required"
```

---

### Task 4: Tier relaxation

**Files:**
- Modify: `js/rules.js` (below `NON_NEGOTIABLE_EQUIPMENT`)
- Modify: `js/generator.js` (the fill loop in `generate`)
- Test: `tests/equipment.test.mjs`

**Interfaces:**
- Consumes: Task 3's `unfilled` shape.
- Produces: `ALL_TIERS: readonly string[]`; blocks may carry `tierRelaxed: true`.

Design §4.2, and it exists because the athlete rejected the premise of open question 4. `power` slot B is `tier: ['primary']`, and the only non-barbell primary hinge is `trap-bar-deadlift` — but `kettlebell-swing`, `dumbbell-snatch` and `kettlebell-clean` sit one tier down and are exactly the movements he expected.

- [ ] **Step 1: Write the failing test**

```js
test('a barbell-free power day finds the movements tier was hiding', () => {
  const olympic = gen(['barbell'], 'power', 7).blocks
    .find(b => b.role === 'Olympic derivative');
  assert.ok(olympic, 'the Olympic derivative slot was dropped, not relaxed');
  assert.ok(
    ['trap-bar-deadlift', 'kettlebell-swing', 'dumbbell-snatch', 'kettlebell-clean']
      .includes(olympic.exerciseId),
    `unexpected fill: ${olympic.exerciseId}`);
});

test('relaxation widens tier and nothing else', () => {
  // A relaxed max-strength slot must not start returning mobility drills.
  // Only `tier` widens; patterns, modality and zone are what a slot is FOR.
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell', 'rack', 'plates'], 'max-strength', 3).blocks
                    .filter(x => x.tierRelaxed)) {
    const mods = byId.get(b.exerciseId).modalities || [];
    assert.ok(mods.includes('max-strength') || mods.includes('hypertrophy'),
      `${b.exerciseId} is not strength work`);
  }
});

test('a relaxed block is flagged, so the card can say so', () => {
  assert.ok(gen(['barbell', 'rack', 'plates'], 'max-strength', 3)
    .blocks.some(b => b.tierRelaxed),
    'nothing was flagged, so the substitution would be silent');
});

test('an unconstrained session relaxes nothing', () => {
  assert.ok(!gen([]).blocks.some(b => b.tierRelaxed));
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/equipment.test.mjs`
Expected: FAIL on `a barbell-free power day...` — the slot is currently dropped, not relaxed, so `olympic` is `undefined`.

- [ ] **Step 3: Add `ALL_TIERS` to `js/rules.js`**

Directly below `NON_NEGOTIABLE_EQUIPMENT`:

```js
// The three main-work tiers. Used only to widen a slot that came back EMPTY
// under an equipment constraint -- never to widen one that filled. `tier`
// ranks how central a movement is; it is not a safety rule, which is why
// widening it is an acceptable answer to "there is no barbell here".
// design-equipment-and-swap.md §4.2.
export const ALL_TIERS = Object.freeze(['primary', 'secondary', 'accessory']);
```

- [ ] **Step 4: Relax in the fill loop**

Add `ALL_TIERS` to the existing `./rules.js` import in `js/generator.js`, then replace the template loop body in `generate`:

```js
  for (const slot of template) {                                         // 6-7
    let exercise = fillSlot(slot, library, ctx, rng);

    // A REQUIRED slot that comes back empty is retried across every tier
    // before the day type is abandoned. Only `tier` widens: patterns,
    // modality and zone are what the slot is for. Optional slots are left to
    // be skipped as they always were. design-equipment-and-swap.md §4.2.
    let tierRelaxed = false;
    if (!exercise && !slot.optional) {
      exercise = fillSlot({ ...slot, tier: ALL_TIERS }, library, ctx, rng);
      tierRelaxed = Boolean(exercise);
    }

    if (!exercise) {
      unfilled.push({ slot: slot.slot, optional: !!slot.optional });
      continue;
    }
    ctx.excludeIds.add(exercise.id);
    zoneBySlot[slot.slot] = slot.zone;
    const block = prescribe(slot, exercise, env, rng, state);
    // Flagged, never silent: the athlete's standing rule is that the app says
    // when it changed something. design §1.2.
    if (tierRelaxed) block.tierRelaxed = true;
    blocks.push(block);
  }
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node --test tests/*.mjs` — expect **144 pass, 0 fail**.

- [ ] **Step 6: Commit**

```bash
git add js/rules.js js/generator.js tests/equipment.test.mjs
git commit -m "Widen tier before abandoning a day type"
```

---

### Task 5: `offerableEquipment()`

**Files:**
- Modify: `js/generator.js` (beside `requiredUnfilled`)
- Test: `tests/equipment.test.mjs`

**Interfaces:**
- Produces: `offerableEquipment(blocks, library): string[]` — sorted, deduplicated, non-negotiables removed.

- [ ] **Step 1: Write the failing test**

```js
test('the control lists only what this session asks for', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  const s = gen([]);
  const used = new Set(s.blocks.flatMap(b => byId.get(b.exerciseId).equipment || []));
  for (const q of offerableEquipment(s.blocks, LIB)) {
    assert.ok(used.has(q), `${q} is not in this session`);
  }
});

test('the control never offers the non-negotiables', () => {
  const offered = offerableEquipment(gen([]).blocks, LIB);
  for (const q of NON_NEGOTIABLE_EQUIPMENT) {
    assert.ok(!offered.includes(q), `${q} must never be offerable`);
  }
});

test('the control stays short enough to read on a phone', () => {
  // Measured across nine sessions while designing: 4 to 8. design §3.2.
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 5; seed++) {
      const n = offerableEquipment(gen([], dt, seed * 1009).blocks, LIB).length;
      assert.ok(n >= 1 && n <= 10, `${dt}/${seed} offered ${n} items`);
    }
  }
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/equipment.test.mjs` — FAIL on the missing export.

- [ ] **Step 3: Implement**

Add `NON_NEGOTIABLE_EQUIPMENT` to the `./rules.js` import, then below `requiredUnfilled`:

```js
// What the "what's missing today?" control offers: the equipment THIS session
// asks for, never a catalogue of all 29 values in the library. Derived from
// the session in front of the athlete, so it cannot list something
// irrelevant. design-equipment-and-swap.md §3.2.
export function offerableEquipment(blocks, library) {
  const byId = new Map(library.map(e => [e.id, e]));
  const seen = new Set();
  for (const b of blocks) {
    for (const q of (byId.get(b.exerciseId)?.equipment || [])) {
      if (!NON_NEGOTIABLE_EQUIPMENT.includes(q)) seen.add(q);
    }
  }
  return [...seen].sort();
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `node --test tests/*.mjs` — expect **147 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/equipment.test.mjs
git commit -m "Derive the equipment control from the session in hand"
```

---

### Task 6: `resolveSession()` — the day-type fallback

**Files:**
- Modify: `js/generator.js` (new export, after `generate`)
- Test: `tests/equipment.test.mjs`

**Interfaces:**
- Consumes: `requiredUnfilled`, `generate`.
- Produces: `resolveSession(opts): { session, offer }`. `opts` is `generate`'s options plus a required `dayType`. `offer` is `null` when the requested day type built, otherwise `{ blocked: string }`. `session` is `null` when nothing can be built (design §6.1).

- [ ] **Step 1: Write the failing test**

```js
const resolve = (excludeEquipment, dayType = 'max-strength', seed = 11) =>
  resolveSession({ library: LIB, dayType, seed, excludeEquipment,
                   profile: { venue: 'gym' } });

test('a buildable day type comes back unchanged and unannounced', () => {
  const { session, offer } = resolve(['barbell']);
  assert.equal(offer, null);
  assert.equal(session.dayType, 'max-strength');
});

test('an unbuildable day type is never silently substituted', () => {
  // Everything this session asks for, removed at once.
  const all = offerableEquipment(gen([]).blocks, LIB);
  const { session, offer } = resolve(all);
  if (session) {
    assert.ok(offer, 'the day type changed with no offer -- a silent substitution');
    assert.equal(offer.blocked, 'max-strength');
    assert.notEqual(session.dayType, 'max-strength');
    assert.deepEqual(requiredUnfilled(session), []);
  } else {
    assert.equal(offer, null, 'no session and no offer is the §6.1 case');
  }
});

test('the fallback never offers a vetoed day type', () => {
  const { session } = resolve(offerableEquipment(gen([]).blocks, LIB));
  if (!session) return;
  const vetoed = (session.candidates || []).filter(c => c.vetoed).map(c => c.dayType);
  assert.ok(!vetoed.includes(session.dayType),
    `${session.dayType} was vetoed and offered anyway`);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/equipment.test.mjs` — FAIL on the missing export.

- [ ] **Step 3: Implement**

After `generate`:

```js
// The athlete asked for THIS day type under THIS constraint. Give it to him if
// it can be built; otherwise say so and offer the next one that can.
//
// Buildability is read off a real generation rather than predicted by a
// separate check, because a predicate walking the slots in isolation cannot
// see `excludeIds` accumulating and would eventually disagree with the fill it
// is meant to describe. One discarded generation costs microseconds and no
// I/O. design-equipment-and-swap.md §4.1, §4.3.
export function resolveSession(opts) {
  const wanted = generate(opts);
  if (requiredUnfilled(wanted).length === 0) return { session: wanted, offer: null };

  // proposeDayType's candidates arrive scored and veto-flagged, so the
  // fallback inherits the neglect model instead of inventing an order.
  for (const c of wanted.candidates || []) {
    if (c.vetoed || c.dayType === opts.dayType) continue;
    const alt = generate({ ...opts, dayType: c.dayType });
    if (requiredUnfilled(alt).length === 0) {
      return { session: alt, offer: { blocked: opts.dayType } };
    }
  }
  return { session: null, offer: null };   // §6.1 -- nothing can be built
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `node --test tests/*.mjs` — expect **150 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/equipment.test.mjs
git commit -m "Offer the next buildable day type rather than substituting"
```

---

### Task 7: The card says when a movement was substituted

**Files:**
- Modify: `js/ui.js` (`blockCard`, beside the `rampLimited` note)
- Test: `tests/card.test.mjs`

**Interfaces:**
- Consumes: Task 4's `block.tierRelaxed`.

- [ ] **Step 1: Write the failing test**

Append to `tests/card.test.mjs`:

```js
const RELAXED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'chin-up', name: 'Chin-Up',
  mode: 'reps', sets: 4, reps: 5, restSec: 180, tierRelaxed: true,
  effort: 'leave 2-3 reps in reserve'
};

test('a substituted movement says so on the front of the card', () => {
  const notes = blockCard(RELAXED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(notes.some(t => t.includes('closest movement available')),
    `no substitution note, got ${JSON.stringify(notes)}`);
});

test('an ordinary block carries no substitution note', () => {
  const notes = blockCard(BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(!notes.some(t => t.includes('closest movement available')));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/card.test.mjs`
Expected: FAIL — `no substitution note, got []`.

- [ ] **Step 3: Implement**

In `blockCard`'s front face, directly after the `rampLimited` note:

```js
    // Same shape and same reason as the ramp note above: the athlete is owed
    // the fact that the app changed something. This fires when a required
    // slot could only be filled by widening tier under an equipment
    // constraint. design-equipment-and-swap.md §4.2.
    block.tierRelaxed
      ? el('p', {
          class: 'block-note',
          text: 'no barbell here -- this is the closest movement available'
        })
      : null,
```

- [ ] **Step 4: Run and watch it pass**

Run: `node --test tests/*.mjs` — expect **152 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js tests/card.test.mjs
git commit -m "Say on the card when tier relaxation substituted a movement"
```

---

### Task 8: The equipment control, wired

**Files:**
- Modify: `js/ui.js` (`el`, `renderSession`, new `equipmentControl` and `renderNothingBuildable`)
- Modify: `js/app.js` (`showSession`)
- Test: `tests/ui.test.mjs`

**Interfaces:**
- Consumes: `offerableEquipment`, `resolveSession`.
- Produces: `equipmentControl(items, selected, onChange)`; `renderNothingBuildable()`; `renderSession(session, { onReroll, cuesFor, offer, equipment })`.

`tests/ui.test.mjs` currently has no DOM. Add `installDom()` and the dynamic `await import('../js/ui.js')` at its top, exactly as `tests/card.test.mjs` does.

- [ ] **Step 1: Write the failing test**

```js
test('the control renders one checkbox per offerable item, all ticked', () => {
  const boxes = equipmentControl(['barbell', 'bench', 'rack'], [], () => {})
    .querySelectorAll('input');
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every(b => b.checked));
});

test('an item already excluded comes back unticked', () => {
  const boxes = equipmentControl(['barbell', 'bench'], ['barbell'], () => {})
    .querySelectorAll('input');
  assert.equal(boxes[0].checked, false);
  assert.equal(boxes[1].checked, true);
});

test('toggling an item names it to the caller', () => {
  let seen = null;
  const node = equipmentControl(['barbell', 'bench'], [], q => { seen = q; });
  node.querySelectorAll('input')[1].onchange();
  assert.equal(seen, 'bench');
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/ui.test.mjs` — FAIL on the missing `equipmentControl` export.

- [ ] **Step 3: Teach `el()` about `checked`, then build the control**

`el()` sets unknown attributes via `setAttribute`, which leaves the shim's `.checked` property unset. Add one case beside `class` and `text` rather than working around it per call site:

```js
    else if (k === 'checked') node.checked = Boolean(v);
```

Then:

```js
// "What's missing today?" -- the equipment THIS session asks for, every item
// ticked because the default is that he has everything. Unticking regenerates.
// The caller supplies the items; this function never reads the library.
// design-equipment-and-swap.md §7.
export function equipmentControl(items, selected = [], onChange = () => {}) {
  return el('fieldset', { class: 'equip' }, [
    el('legend', { text: "What's missing today?" }),
    ...items.map(item => el('label', { class: 'equip-item' }, [
      el('input', {
        type: 'checkbox',
        checked: !selected.includes(item),
        onchange: () => onChange(item)
      }),
      el('span', { text: item })
    ]))
  ]);
}

// design §6.1. Deliberately NOT renderError: that screen is for a broken app,
// and this is the app working correctly on a hard input.
export function renderNothingBuildable() {
  return el('section', { class: 'empty' }, [
    el('h2', { text: 'Nothing to build' }),
    el('p', { text: "With what you've got there's no session here worth calling a session. Untick less, or take a rest day." })
  ]);
}
```

Then render both inside `renderSession`. It currently takes
`(session, { onReroll, cuesFor })`; extend the options and insert these two
nodes above the block list, each omitted when its option is absent:

```js
    offer
      ? el('p', { class: 'offer' }, [
          el('span', { text: `A ${offer.blocked} day needs equipment you said isn't here.` }),
          el('span', { text: session.reason })
        ])
      : null,
    equipment
      ? equipmentControl(equipment.items, equipment.selected, equipment.onToggle)
      : null,
```

Note the mapping: `app.js` passes `onToggle`, `equipmentControl` names the
parameter `onChange`. Keep both names — the caller describes what the athlete
did, the control describes what it emits.

- [ ] **Step 4: Wire `js/app.js`**

Import `resolveSession` and `offerableEquipment`. `showSession` gains the constraint:

```js
function showSession({ reroll = false, excludeEquipment = null } = {}) {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const saved = reroll ? null : sessionFor(today());
  // The constraint lives on the record, so it survives a reroll and is gone
  // tomorrow -- which is what "this session only" means. design §3.3.
  const constraint = excludeEquipment ?? (saved && saved.excludeEquipment) ?? [];

  let session = saved;
  let offer = null;

  if (!session || excludeEquipment) {
    try {
      const result = resolveSession({
        library, profile, history: loadHistory(), soreness: {},
        dayType: session ? session.dayType : null,
        excludeEquipment: constraint,
        seed: Date.now()
      });
      if (!result.session) return mount(root, renderNothingBuildable());
      session = result.session;
      offer = result.offer;
    } catch (err) {
      return mount(root, renderError(err.message));
    }
    commitSession(session);
  }
  // ... existing cuesFor ...
  mount(root, renderSession(session, {
    onReroll: () => showSession({ reroll: true }),
    cuesFor,
    offer,
    equipment: {
      items: offerableEquipment(session.blocks, library),
      selected: constraint,
      onToggle: item => showSession({
        excludeEquipment: constraint.includes(item)
          ? constraint.filter(q => q !== item)
          : [...constraint, item]
      })
    }
  }));
}
```

`resolveSession` requires a `dayType`. When there is no saved session, `dayType` is `null` and `generate` proposes one — so `resolveSession`'s first generation also does the proposing, and `opts.dayType === null` simply never matches a candidate in the fallback loop. That is correct: a freshly proposed day type that cannot be built falls through to the next candidate.

- [ ] **Step 5: Run and watch it pass**

Run: `node --test tests/*.mjs` — expect **155 pass, 0 fail**.

- [ ] **Step 6: Verify in a real browser**

`app.js` is not covered by the suite. Serve the repo (`python -m http.server 8000`), open `http://localhost:8000`, untick an item, and confirm the session regenerates and the item stays unticked across a reroll.

- [ ] **Step 7: Commit**

```bash
git add js/ui.js js/app.js tests/ui.test.mjs
git commit -m "Add the what's-missing control and wire it to regeneration"
```

---

### Task 9: `swapBlock()`

**Files:**
- Modify: `js/generator.js` (new export, after `resolveSession`)
- Test: `tests/swap.test.mjs` (create)

**Interfaces:**
- Consumes: `fillSlot`, `prescribe`, `buildState`, `envelopeFor`, `TEMPLATES`.
- Produces: `swapBlock(session, slotId, library, ctx, rng): { block, reason }`. `block` is `null` and `reason` a sentence when the pool is exhausted.

- [ ] **Step 1: Write the failing test**

Create `tests/swap.test.mjs`:

```js
// The per-block swap. design-equipment-and-swap.md §5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, swapBlock, makeRng } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = new Map(LIB.map(e => [e.id, e]));

const session = generate({ library: LIB, dayType: 'hypertrophy', seed: 5,
                           profile: { venue: 'gym' } });
const ctx = { venue: 'gym', soreness: {}, banned: [], excludeEquipment: [] };
const target = session.blocks.find(b => b.mode === 'load');

test('a swap holds the pattern of the block it replaces', () => {
  // The athlete's expectation: "another move like one with dumbbell that hits
  // the same area." Six slots carry patterns: null and slot C alone spans ten
  // patterns, so same-slot is not enough. design §5.1.
  for (const t of session.blocks.filter(b => b.slot && b.mode === 'load')) {
    const { block } = swapBlock(session, t.slot, LIB, ctx, makeRng(1));
    if (!block) continue;
    assert.equal(byId.get(block.exerciseId).pattern,
                 byId.get(t.exerciseId).pattern,
                 `${t.exerciseId} -> ${block.exerciseId} changed pattern`);
  }
});

test('a swap never returns the exercise it replaced', () => {
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(session, target.slot, LIB, ctx, makeRng(s));
    if (block) assert.notEqual(block.exerciseId, target.exerciseId);
  }
});

test('a swap never returns something already in the session', () => {
  const present = new Set(session.blocks.map(b => b.exerciseId));
  present.delete(target.exerciseId);
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(session, target.slot, LIB, ctx, makeRng(s));
    if (block) assert.ok(!present.has(block.exerciseId));
  }
});

test('a swap reprices against the new exercise', () => {
  // displayMultiplier folds the new entry's own prCoef, so a replacement with
  // a different coefficient must not inherit the old number. This is why a
  // swap runs through prescribe rather than relabelling the card. design §5.2.
  const loaded = session.blocks.find(b => b.mode === 'load' && b.displayMultiplier);
  if (!loaded) return;
  const { block } = swapBlock(session, loaded.slot, LIB, ctx, makeRng(2));
  if (!block || !block.displayMultiplier) return;
  const a = byId.get(loaded.exerciseId), b = byId.get(block.exerciseId);
  if (a.prCoef !== b.prCoef && a.prRef === b.prRef) {
    assert.notEqual(block.displayMultiplier, loaded.displayMultiplier);
  }
});

test('an exhausted pool reports rather than throws', () => {
  // Ban everything sharing the target's pattern: the swap must come back
  // empty-handed with a sentence, not an exception. design §5.3.
  const pattern = byId.get(target.exerciseId).pattern;
  const banned = LIB.filter(e => e.pattern === pattern).map(e => e.id);
  const { block, reason } = swapBlock(session, target.slot, LIB,
                                      { ...ctx, banned }, makeRng(1));
  assert.equal(block, null);
  assert.ok(typeof reason === 'string' && reason.length > 0);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/swap.test.mjs` — FAIL on the `swapBlock` import.

- [ ] **Step 3: Implement**

After `resolveSession`:

```js
// Replace ONE block and leave the rest of the session alone. The equipment
// constraint is a fact about the room and refills everything; this is a fact
// about one exercise -- a broken machine, an occupied rack.
//
// Narrowed to the PATTERN of the block being replaced, not merely to its slot.
// Six slots carry `patterns: null` and span ten patterns, so slot alone would
// answer "this machine is broken" with a farmers carry. The athlete's words:
// "another move like one with dumbbell that hits the same area."
// design-equipment-and-swap.md §5.1.
export function swapBlock(session, slotId, library, ctx, rng) {
  const template = TEMPLATES[session.dayType];
  const slot = template && template.find(s => s.slot === slotId);
  const current = session.blocks.find(b => b.slot === slotId);
  if (!slot || !current) return { block: null, reason: 'no such slot in this session' };

  const entry = library.find(e => e.id === current.exerciseId);
  if (!entry) return { block: null, reason: 'this movement is no longer in the library' };

  // Everything already in the session, so a swap cannot hand back a movement
  // he is doing three cards further down.
  const excludeIds = new Set(session.blocks.map(b => b.exerciseId));
  const narrowed = { ...slot, patterns: [entry.pattern] };
  const exercise = fillSlot(narrowed, library, { ...ctx, excludeIds }, rng);
  if (!exercise) {
    return { block: null, reason: `no other ${entry.pattern} movement is available` };
  }

  // Rebuilt rather than read off the record: env and state derive from the
  // same inputs every time, so recomputing cannot go stale.
  const state = buildState(ctx.profile || {}, ctx.history || [], Date.now());
  const env = envelopeFor(session.dayType, state);
  return { block: prescribe(slot, exercise, env, rng, state), reason: null };
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `node --test tests/*.mjs` — expect **160 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
git add js/generator.js tests/swap.test.mjs
git commit -m "Swap one block for another hitting the same pattern"
```

---

### Task 10: The swap control, wired

**Files:**
- Modify: `js/ui.js` (`blockCard`), `js/app.js`
- Test: `tests/card.test.mjs`, possibly `tests/dom-shim.mjs`

**Interfaces:**
- Consumes: `swapBlock`.
- Produces: `blockCard(block, cuesFor, onSwap)` — when `onSwap` is given, the front face carries a swap control.

The card already flips on tap (`design-card-flip.md` §5). The swap must not steal that gesture: it is a small control on the front face, and its handler calls `stopPropagation` so tapping it does not also flip the card.

- [ ] **Step 1: Write the failing test**

```js
test('a swap control appears only when a handler is supplied', () => {
  assert.equal(blockCard(BLOCK, () => CUES).querySelector('.block-swap'), null);
  assert.ok(blockCard(BLOCK, () => CUES, () => {}).querySelector('.block-swap'));
});

test('the swap names its slot to the caller', () => {
  let seen = null;
  blockCard(BLOCK, () => CUES, slot => { seen = slot; })
    .querySelector('.block-swap').onclick({ stopPropagation() {} });
  assert.equal(seen, BLOCK.slot);
});
```

If `tests/dom-shim.mjs` does not synthesise a click event object, call the handler directly as above rather than extending the shim — the shim exists to keep these tests honest, not to grow into a browser.

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/card.test.mjs` — FAIL, no `.block-swap`.

- [ ] **Step 3: Add the control to `blockCard`**

`blockCard` gains a third parameter. Insert this as the last child of the front
face, after the meta line:

```js
    // A real button, not a tap target on the card body: the body already
    // belongs to the flip (design-card-flip.md §5). stopPropagation keeps the
    // two gestures apart. design-equipment-and-swap.md §7.
    typeof onSwap === 'function'
      ? el('button', {
          class: 'block-swap', type: 'button',
          onclick: ev => { ev.stopPropagation(); onSwap(block.slot); }
        }, 'swap')
      : null,
```

`blockCard` is called from `renderSession`, which must thread `onSwap` through
to each card.

- [ ] **Step 3b: Wire it in `js/app.js`**

```js
    onSwap: slotId => {
      const { block, reason } = swapBlock(session, slotId, library, {
        venue: session.venue, soreness: {}, banned: profile.banned || [],
        excludeEquipment: constraint, profile, history: loadHistory()
      }, makeRng(Date.now()));
      // A dead control that silently does nothing is the failure mode this
      // design exists to avoid. design §5.3.
      if (!block) return mount(root, renderSession(session, { ...opts, swapNote: reason }));
      const i = session.blocks.findIndex(b => b.slot === slotId);
      session.blocks[i] = block;
      commitSession(session);
      showSession();
    }
```

Import `swapBlock` and `makeRng` from `./generator.js`. `renderSession` renders
`swapNote` as a single line above the blocks when present.

- [ ] **Step 4: Run the suite, then check the gesture in a real browser at phone width**

Run: `node --test tests/*.mjs` — expect **162 pass, 0 fail**. Then confirm in the browser that tapping swap replaces the movement and does *not* flip the card.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/app.js tests/card.test.mjs tests/dom-shim.mjs
git commit -m "Add the per-block swap control"
```

---

### Task 11: Deploy and phone check

- [ ] **Step 1: Bump the worker** — `js/../sw.js`: `const VERSION = 'v9';`
- [ ] **Step 2: Update the docs** — `design-equipment-and-swap.md` status line to built; `design-running-programming.md` §9 no longer deferred; `spec.md` §8 swap no longer deferred.
- [ ] **Step 3: Full suite green**, then commit and push to `main`.
- [ ] **Step 4: Verify live** — `curl` the deployed `sw.js` for `v9` and `js/generator.js` for `swapBlock`. Pages takes about a minute.
- [ ] **Step 5: The athlete's check.** Open the app, swipe fully out of the app switcher, reopen so v9 activates on the second launch — `sw.js` has no `skipWaiting` by design. Untick the barbell on a strength day and confirm: the day type is preserved where it can be, any substituted movement says so on its card, and the swap control replaces one movement with another hitting the same area without flipping the card.
