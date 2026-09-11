import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMinutes, countsTowardVolume } from '../js/generator.js';

const drill = (over = {}) => ({
  role: 'prep', mode: 'drill', sets: 1, reps: 10, restSec: 0, ...over
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
      // Against the dose that GOVERNS this drill, not one range over all of
      // them: an entry may carry its own (CARs do). Asserting one range on
      // every drill is what hid the CARs overdose. §12.
      //
      // The fallback READS MOBILITY_DOSE rather than repeating it. It was
      // written as a literal [10, 12] and went stale the first time the
      // athlete moved the range (10-12 -> 8-10, 2026-09-11), failing this
      // test for a dose that was correct.
      const e0 = LIB.find(x => x.id === b.exerciseId);
      const [lo, hi] = (e0.dose && e0.dose.reps) || MOBILITY_DOSE.DYNAMIC_REPS;
      assert.ok(b.reps >= lo && b.reps <= hi,
        `${b.name} got ${b.reps} reps, outside its ${lo}-${hi} dose`);
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
  // An outdoor day now draws the five-stage running prep rather than the two
  // or three generic drills it used to get. Stage sizes are ranges, so the
  // assertion is that all five stages are represented and in order, not a
  // block count. P3 is balance, split out of mobilise on 2026-09-07 --
  // design-running-programming.md §5.1, design-library-expansion.md §22.
  const stages = [...new Set(prep.map(b => b.slot))];
  assert.deepEqual(stages, ['P1', 'P2', 'P3', 'P4', 'P5']);
  assert.ok(!cool.some(b => b.role === 'core'));
});

// Named off the constant rather than the number: the budget moved 12 -> 14
// on 2026-09-05, and the test reads TIME.COOLDOWN_MIN either way.
test('packCooldown holds the cool-down budget without gutting the dose', () => {
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

// packCooldown lever 2, added v51. design-library-expansion.md 16.6.
//
// RE-SIZED 2026-09-05, when COOLDOWN_MIN went 12 -> 14 and core reps stopped
// being charged the barbell rep. The old fixture -- three stretches and two
// per-side rep-based core blocks -- now prices at exactly 14 min and FITS,
// which would have left this test asserting nothing at all. Re-sized rather
// than relaxed, and toward a draw the library actually produces: STATIC_
// STRETCHES tops out at FOUR, and four per-side stretches beside two per-side
// core blocks is 17 min against the 14 min budget.
//
// WHY THIS FIXTURE PROVES THE ORDERING and the old one only illustrated it.
// Both levers can reach this cool-down, so the end state says which ran first:
//
//   lever 2 first (correct) -- reps walk 15 -> 10 on both blocks, still over
//     at 15 min, THEN one stretch goes: ends at 3 stretches, 10 reps.
//   lever 3 first (wrong)   -- one stretch goes, 17 -> 14, already inside
//     budget, loop exits: ends at 3 stretches, 15 reps.
//
// Same stretch count either way. The reps are the discriminator, which is why
// the assertion below is on the exact floor value and not merely on "trimmed".
test('packCooldown trims the core dose inside its sourced range before dropping a stretch', () => {
  const stretch = () => ({
    role: 'mobility', mode: 'hold', sets: 2, holdSec: 30, reps: 1, perSide: true, restSec: 0
  });
  const coreBlock = () => ({
    role: 'core', mode: 'reps', sets: 2, reps: MOBILITY_DOSE.CORE_REPS[1],
    perSide: true, restSec: 45
  });
  const raw = [stretch(), stretch(), stretch(), stretch(), coreBlock(), coreBlock()];
  assert.ok(estimateMinutes(raw) > TIME.COOLDOWN_MIN,
    'fixture must actually overrun the budget');

  const packed = packCooldown(raw);

  assert.equal(packed.overBudget, false, 'the three levers must get it inside the budget');
  assert.equal(packed.blocks.filter(b => b.role === 'mobility').length, 3,
    'never trims the stretch count below the ACSM floor of 3');
  for (const b of packed.blocks.filter(b => b.role === 'core')) {
    assert.equal(b.reps, MOBILITY_DOSE.CORE_REPS[0],
      `ended at ${b.reps} reps -- lever 2 must exhaust the sourced range ` +
      `(down to ${MOBILITY_DOSE.CORE_REPS[0]}, never below) before a stretch goes`);
    assert.ok(b.sets >= 2, 'still never trims core below 2 sets');
  }
});

// The hold half of lever 2. Core is dosed by time or by reps depending on the
// movement, and holds are the more expensive mode -- a per-side side plank at
// CORE_HOLD_SEC's top costs more than a per-side Pallof press at CORE_REPS'.
// This fixture needs no stretch drop at all: lever 2 alone gets it home.
test('lever 2 trims a hold-dosed core block down its own sourced range', () => {
  const stretch = () => ({
    role: 'mobility', mode: 'hold', sets: 2, holdSec: 30, reps: 1, perSide: true, restSec: 0
  });
  const raw = [
    stretch(), stretch(), stretch(),
    { role: 'core', mode: 'hold', sets: 2, holdSec: MOBILITY_DOSE.CORE_HOLD_SEC[1],
      reps: 1, perSide: true, restSec: 45 },
    { role: 'core', mode: 'reps', sets: 2, reps: MOBILITY_DOSE.CORE_REPS[1],
      perSide: true, restSec: 45 }
  ];
  assert.ok(estimateMinutes(raw) > TIME.COOLDOWN_MIN,
    'fixture must actually overrun the budget');

  const packed = packCooldown(raw);
  const held = packed.blocks.find(b => b.role === 'core' && b.mode === 'hold');

  assert.equal(packed.overBudget, false);
  assert.equal(packed.blocks.filter(b => b.role === 'mobility').length, 3,
    'no stretch is dropped -- the hold dose alone covers the overrun');
  assert.ok(held.holdSec < MOBILITY_DOSE.CORE_HOLD_SEC[1], 'lever 2 never reached the hold');
  assert.ok(held.holdSec >= MOBILITY_DOSE.CORE_HOLD_SEC[0],
    `trimmed to ${held.holdSec} s, below the sourced floor of ${MOBILITY_DOSE.CORE_HOLD_SEC[0]}`);
  assert.equal(held.holdSec % 5, 0, 'holds are prescribed on a 5 s grid');
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
    assert.equal(b.reps, 10, 'never shortens the athlete-set 8-10 rep dose');
  }
});

// ---------------------------------------------------------------------------
// CARs are not swing drills -- design-mobility-and-warmup.md §12
// ---------------------------------------------------------------------------

// The four Controlled Articular Rotations entries. They share the
// `mobility-dynamic` modality with the swing and lunge drills and are dosed
// nothing like them: the sourced prescription is 3-5 slow reps per side at
// 10-30 s each, against the 8-10 reps at 2 s that range-of-motion drills get.
//
// DERIVED FROM THE LIBRARY, not listed here. The hand-written list was
// ['hip-cars', 'shoulder-cars', 'knee-cars', 'ankle-cars'] and the library had
// grown to SEVEN -- scapular, wrist and elbow CARs were added later and this
// test had never looked at one of them. A per-movement dose is exactly the kind
// of thing a fixed list stops seeing, so the set is now read off the data:
// any entry carrying its own `dose.reps` is checked against that dose.
const CARS_IDS = new Set(LIB.filter(e => e.dose && e.dose.reps).map(e => e.id));
const doseFor = id => LIB.find(e => e.id === id).dose.reps;

test('a CARs drill is dosed at its own sourced 3-5 reps, not the swing-drill 8-10', () => {
  let seen = 0;
  const drawn = new Set();
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 300; seed++) {
      for (const b of buildPrep(dayType, LIB, freshCtx(), makeRng(seed))) {
        if (!CARS_IDS.has(b.exerciseId)) continue;
        seen++;
        drawn.add(b.exerciseId);
        const [lo, hi] = doseFor(b.exerciseId);
        assert.ok(b.reps >= lo && b.reps <= hi,
          `${b.name} on ${dayType}/${seed} was prescribed ${b.reps} reps per side; its dose is ${lo}-${hi}`);
      }
    }
  }
  assert.ok(seen > 0, 'the sweep drew no CARs drill at all -- the assertion proved nothing');
  // The sweep must actually REACH every self-dosed entry. Without this the set
  // could go back to covering four of seven and the test would still pass.
  assert.deepEqual([...drawn].sort(), [...CARS_IDS].sort(),
    'the sweep never drew some self-dosed entries, so their dose is unchecked');
});

test('a CARs rep is priced at its own tempo, not the 2 s swing-drill rep', () => {
  const carsRep = drill({ reps: 4, perSide: true, secPerRep: 15 });
  const swingRep = drill({ reps: 4, perSide: true });
  assert.ok(estimateMinutes([carsRep]) > estimateMinutes([swingRep]),
    'a 15 s CARs rep must cost more than a 2 s swing rep at the same rep count');
});
