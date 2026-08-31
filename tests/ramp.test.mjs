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

import { readFileSync } from 'node:fs';
import { prescribe, generate } from '../js/generator.js';
import { ZONES } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const LOADABLE = LIB.filter(e => e.loadable);
const SLOT = { slot: 'A', role: 'main', mode: 'load', zone: 'maxStrength',
               sets: [3, 3], reps: [5, 5], restSec: [180, 180] };
const ENV = { pctCeiling: 1, volumeMultiplier: 1 };
const rng = () => 0.5;

test('a heavy loaded lift arrives with a plan, not one number', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  assert.ok(Array.isArray(block.setPlan), 'no setPlan on a heavy squat');
  assert.ok(block.setPlan.some(s => s.kind === 'warmup'));
  assert.equal(block.setPlan.filter(s => s.kind === 'work').length, block.sets);
});

test('the work entries restate the working set exactly', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  for (const s of block.setPlan.filter(s => s.kind === 'work')) {
    assert.equal(s.reps, block.reps);
    assert.equal(s.displayMultiplier, block.displayMultiplier);
  }
});

test('a movement with no reference max gets no plan', () => {
  // mode drops to 'reps' -- there is no percentage to ramp toward.
  const bodyweight = LIB.find(e => !e.loadable);
  const block = prescribe(SLOT, bodyweight, ENV, rng, {});
  assert.equal(block.mode, 'reps');
  assert.equal(block.setPlan, undefined);
});

test('a light working load gets no plan', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, { pctCeiling: 0.45, volumeMultiplier: 1 }, rng, {});
  assert.equal(block.setPlan, undefined,
    'a working load under the floor has nothing to ramp into');
});

test('NO WARM-UP EVER PRINTS ABOVE ITS WORKING SET', () => {
  // plan-05 decision 2, and the worst failure this feature could have. prCoef
  // above 1.00 plus the ramp ceiling is where a naive pct * prCoef breaks: the
  // working display is clamped and an unclamped warm-up sails straight over it.
  for (const ex of LOADABLE) {
    for (const zone of Object.keys(ZONES)) {
      for (const ceiling of [0.65, 0.75, 0.85, 1]) {
        const block = prescribe({ ...SLOT, zone }, ex,
          { pctCeiling: ceiling, volumeMultiplier: 1 }, rng, {});
        if (!block.setPlan) continue;
        for (const s of block.setPlan) {
          assert.ok(s.displayMultiplier <= block.displayMultiplier + 1e-9,
            `${ex.id} ${zone} ceiling ${ceiling}: warm-up ${s.displayMultiplier} > work ${block.displayMultiplier}`);
          assert.ok(s.displayMultiplier <= ceiling + 1e-9,
            `${ex.id} ${zone} ceiling ${ceiling}: warm-up ${s.displayMultiplier} over the ceiling`);
        }
      }
    }
  }
});

test('the ladder climbs -- every step is heavier than the one before', () => {
  for (const ex of LOADABLE) {
    const block = prescribe(SLOT, ex, ENV, rng, {});
    if (!block.setPlan) continue;
    const d = block.setPlan.map(s => s.displayMultiplier);
    for (let i = 1; i < d.length; i++) {
      assert.ok(d[i] >= d[i - 1] - 1e-9, `${ex.id}: ${JSON.stringify(d)} dips`);
    }
  }
});

test('tier is not consulted -- the load decides, not how central the lift is', () => {
  // §4.3: "an accessory prescribed heavy gets a ramp, and a primary lift
  // prescribed light does not."
  // Ruling 2 (plan-05 task-2 brief correction): the library has no loadable
  // 'accessory' tier -- only 'primary' and 'secondary'. A heavy secondary
  // against a light primary preserves the same claim: tier never decides.
  const heavySecondary = LOADABLE.find(e => e.tier === 'secondary');
  const lightPrimary = LOADABLE.find(e => e.tier === 'primary');
  assert.ok(heavySecondary && lightPrimary, 'this test needs one of each tier');

  const heavy = prescribe({ ...SLOT, zone: 'maxStrength' }, heavySecondary, ENV, rng, {});
  assert.ok(heavy.setPlan, 'a heavy secondary was denied a ramp on tier alone');

  const light = prescribe(SLOT, lightPrimary,
    { pctCeiling: 0.45, volumeMultiplier: 1 }, rng, {});
  assert.equal(light.setPlan, undefined, 'a light primary was given a ramp on tier alone');
});

test('only loaded work gets a ramp -- never a drill, hold, interval or contact', () => {
  // §4.3: "mode: 'reps', 'contacts' and 'time' never receive one."
  const modes = [
    { mode: 'time', durationMin: [10, 20] },
    { mode: 'drill', sets: [1, 1], reps: [10, 10] },
    { mode: 'contacts', sets: [3, 3], reps: [5, 5], restSec: [90, 90] },
    { mode: 'interval', sets: [6, 6], workSec: [60, 60], restRatio: [1, 1] }
  ];
  const anyEx = LOADABLE[0];
  for (const m of modes) {
    const block = prescribe({ ...SLOT, ...m }, anyEx, ENV, rng, {});
    assert.equal(block.setPlan, undefined, `${m.mode} was given a set plan`);
  }
});

test('the return ramp shortens the ladder on its own', () => {
  // §4.3's emergent property: during the return ramp env.pctCeiling is 0.65,
  // so no working load can exceed it and no ladder can be long. Nothing
  // special-cases the ramp weeks -- if this ever needs a special case, the
  // clamp has stopped doing its job.
  for (const ex of LOADABLE) {
    for (const zone of Object.keys(ZONES)) {
      const block = prescribe({ ...SLOT, zone }, ex,
        { pctCeiling: 0.65, volumeMultiplier: 1 }, rng, {});
      if (!block.setPlan) continue;
      const warmups = block.setPlan.filter(s => s.kind === 'warmup').length;
      // ceil((0.65 - 0.30) / 0.15) = 3 rungs, PLUS the extra technique set an
      // Olympic derivative gets. §4.3 says "no ramp exceeds three steps" and
      // overlooked its own technical rule; four is correct for those lifts.
      const cap = ex.technical === 3 ? 4 : 3;
      assert.ok(warmups <= cap,
        `${ex.id} (technical ${ex.technical}) ${zone}: ${warmups} warm-up sets under a 0.65 ceiling`);
    }
  }
});
