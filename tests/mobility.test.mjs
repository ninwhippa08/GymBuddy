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

import { readFileSync } from 'node:fs';
import { buildPrep, buildCooldown, packCooldown, packPrep, makeRng } from '../js/generator.js';
import { MOBILITY_DOSE, TIME } from '../js/rules.js';

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
  // An outdoor day now draws the four-stage running prep rather than the two
  // or three generic drills it used to get. Stage sizes are ranges, so the
  // assertion is that all four stages are represented and in order, not a
  // block count. design-running-programming.md §5.1.
  const stages = [...new Set(prep.map(b => b.slot))];
  assert.deepEqual(stages, ['P1', 'P2', 'P3', 'P4']);
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

// packCooldown lever 2, added v51. design-library-expansion.md §16.6.
//
// The fixture is the shape that made the budget unreachable: two per-side
// rep-based core blocks at the TOP of CORE_REPS, which is 2 x 15 x 2 sides =
// 60 reps of barbell-priced work, plus the three-stretch floor. Both of the
// original levers bottom out on it -- core is already at 2 sets, statics
// already at 3 -- so before lever 2 this returned overBudget with nothing left
// to trim.
test('packCooldown trims the core dose inside its sourced range before dropping a stretch', () => {
  const stretch = () => ({
    role: 'mobility', mode: 'hold', sets: 2, holdSec: 30, reps: 1, perSide: true, restSec: 0
  });
  const coreBlock = () => ({
    role: 'core', mode: 'reps', sets: 2, reps: MOBILITY_DOSE.CORE_REPS[1],
    perSide: true, restSec: 45
  });
  const raw = [stretch(), stretch(), stretch(), coreBlock(), coreBlock()];
  assert.ok(estimateMinutes(raw) > TIME.COOLDOWN_MIN,
    'fixture must actually overrun the budget');

  const packed = packCooldown(raw);

  assert.equal(packed.blocks.filter(b => b.role === 'mobility').length, 3,
    'reps come off before a stretch does');
  for (const b of packed.blocks.filter(b => b.role === 'core')) {
    assert.ok(b.reps >= MOBILITY_DOSE.CORE_REPS[0],
      `trimmed to ${b.reps} reps, below the sourced floor of ${MOBILITY_DOSE.CORE_REPS[0]}`);
    assert.ok(b.sets >= 2, 'still never trims core below 2 sets');
  }
  assert.ok(packed.blocks.some(b => b.role === 'core' && b.reps < MOBILITY_DOSE.CORE_REPS[1]),
    'lever 2 did not fire at all');
});

test('packCooldown leaves a cool-down that already fits completely alone', () => {
  const raw = [
    { role: 'mobility', mode: 'hold', sets: 2, holdSec: 20, reps: 1, perSide: false, restSec: 0 },
    { role: 'mobility', mode: 'hold', sets: 2, holdSec: 20, reps: 1, perSide: false, restSec: 0 },
    { role: 'mobility', mode: 'hold', sets: 2, holdSec: 20, reps: 1, perSide: false, restSec: 0 },
    { role: 'core', mode: 'reps', sets: 2, reps: MOBILITY_DOSE.CORE_REPS[1], perSide: false, restSec: 30 }
  ];
  assert.ok(estimateMinutes(raw) <= TIME.COOLDOWN_MIN, 'fixture must fit');
  const packed = packCooldown(raw);
  assert.equal(packed.overBudget, false);
  assert.equal(packed.blocks.find(b => b.role === 'core').reps, MOBILITY_DOSE.CORE_REPS[1],
    'a session inside its budget keeps the full dose');
});

test('packPrep holds the 3 min budget without gutting the dose', () => {
  // Four per-side drills price at roughly double a bilateral one (the `sides`
  // multiplier), which reliably overruns TIME.PREP_MIN -- the exact scenario
  // ruling A2 describes.
  const raw = [
    drill({ perSide: true }), drill({ perSide: true }),
    drill({ perSide: true }), drill({ perSide: true })
  ];
  assert.ok(estimateMinutes(raw) > 3, 'fixture must actually overrun the budget');

  const packed = packPrep(raw);
  assert.ok(packed.blocks.length >= 3, 'never trims below the sourced floor of 3 drills');
  for (const b of packed.blocks) {
    assert.equal(b.reps, 12, 'never shortens the sourced 10-12 rep dose');
  }
});
