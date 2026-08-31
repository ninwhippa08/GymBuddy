// The warm-up ladder. design-mobility-and-warmup.md §4.3.
//
// Computed, never tabulated: the step COUNT falls out of the gap between the
// ramp's start and the working load, so a heavier working set gets more steps
// without anything special-casing it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRamp } from '../js/generator.js';
import { WARMUP } from '../js/rules.js';

const pcts = ramp => ramp.map(s => Math.round(s.pct * 100) / 100);
const plain = { technical: 1 };

test('a working load under the floor gets no ramp at all', () => {
  // "Light work gets nothing, which is what the sources say and what a rest
  // day should feel like." §4.3
  assert.deepEqual(buildRamp(0.49, plain), []);
  assert.deepEqual(buildRamp(0.30, plain), []);
});

test('the step count falls out of the gap, so heavier means longer', () => {
  assert.equal(buildRamp(0.55, plain).length, 2);
  assert.equal(buildRamp(0.65, plain).length, 3);
  assert.equal(buildRamp(0.80, plain).length, 4);
  // ceil(0.60 / 0.15) = 4. §4.3's table says 5 for this row and is wrong --
  // see decision 3 in plan-05. Every jump here is exactly 0.15, none larger.
  assert.equal(buildRamp(0.90, plain).length, 4);
});

test('the ladder starts at WARMUP.START and never reaches the working load', () => {
  const ramp = buildRamp(0.80, plain);
  assert.equal(ramp[0].pct, WARMUP.START);
  assert.ok(ramp[ramp.length - 1].pct < 0.80);
});

test('no jump between steps, or into the work, exceeds MAX_JUMP', () => {
  // The one invariant that makes this a ramp rather than a list of numbers.
  for (const working of [0.52, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const stops = [...buildRamp(working, plain).map(s => s.pct), working];
    for (let i = 1; i < stops.length; i++) {
      const jump = stops[i] - stops[i - 1];
      assert.ok(jump <= WARMUP.MAX_JUMP + 1e-9,
        `working ${working}: jump of ${jump.toFixed(3)} from ${stops[i - 1]}`);
    }
  }
});

test('the 0.80 ladder is the worked example from §2.3', () => {
  assert.deepEqual(pcts(buildRamp(0.80, plain)), [0.3, 0.43, 0.55, 0.68]);
});

test('reps fall as the step gets heavier', () => {
  const ramp = buildRamp(0.90, plain);
  const reps = ramp.map(s => s.reps);
  for (let i = 1; i < reps.length; i++) {
    assert.ok(reps[i] <= reps[i - 1], `reps went up: ${JSON.stringify(reps)}`);
  }
  assert.equal(ramp[0].reps, 8, 'a 0.30 step is eight reps');
});

test('an Olympic lift gets an extra technique set and never eights', () => {
  // "repetition at light load, never eight reps of a snatch" §4.3
  const oly = buildRamp(0.80, { technical: 3 });
  const bar = buildRamp(0.80, { technical: 1 });
  assert.equal(oly.length, bar.length + 1);
  assert.equal(oly[0].pct, WARMUP.START);
  assert.equal(oly[1].pct, WARMUP.START, 'the extra set is a second one at the start');
  for (const s of oly) {
    assert.ok(s.reps <= WARMUP.TECHNICAL_REP_CAP, `${s.reps} reps of a technical lift`);
  }
});

test('a missing technical rating is treated as the plain progression', () => {
  assert.deepEqual(buildRamp(0.80, {}), buildRamp(0.80, { technical: 1 }));
});

test('every step is marked as a warm-up', () => {
  for (const s of buildRamp(0.85, plain)) assert.equal(s.kind, 'warmup');
});
