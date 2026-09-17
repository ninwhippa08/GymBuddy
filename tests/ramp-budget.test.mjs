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

test('the largest remainder wins even when it is not the first slot', () => {
  // The fixture above cannot tell largest-remainder from slot order, because
  // there slot A had both. Here it does not: 3 and 4 sets at 0.70 are exact
  // 2.1 and 2.8, both floor to 2, and budget round(4.9) = 5 leaves ONE set to
  // hand out. It goes to B, on 0.8 against 0.1. A rule that walked the slots
  // in order would give it to A and this test would catch it.
  const bs = [block('A', 3), block('B', 4)];
  rampToBudget(bs, 0.70);
  assert.deepEqual(setsOf(bs), [2, 3]);
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
