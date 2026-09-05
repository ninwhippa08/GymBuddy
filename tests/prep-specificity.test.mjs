// Prep drills and cool-down stretches must match the day's work.
//
// The complaint that produced this file, 2026-09-04, after a max-strength
// session: Romanian deadlift, close-grip bench press, cable woodchop, prepped
// by inchworm, walking quad pull and squat to stand. Three drills, none of
// which prepared a hinge or a press.
//
// The first fix tried was joint matching -- the mechanism `eligibleFor`
// already runs for the running prep. The athlete broke it in one sentence:
// `deadlift` is [hip, knee, lumbar] and `walking-quad-pull` is [knee, hip], a
// perfect joint overlap, and a quad pull is still the wrong drill before a
// deadlift. Same shape on the cool-down: `seated-hamstring-stretch` is
// [hip, knee] and `standing-quad-stretch` is [knee, hip] -- identical joints,
// opposite tissue.
//
// So matching is by movement pattern, via a `targets` field naming the
// patterns a drill or stretch serves. Joints stay: they are what the running
// prep filters on, and they still carry soreness.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPrep, buildCooldown, makeRng, sessionTargets, generate, packPrep,
  estimateMinutes
} from '../js/generator.js';
import { TIME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const byId = id => LIB.find(e => e.id === id);
const freshCtx = () => ({
  soreness: {}, banned: [], venue: 'gym', state: null, excludeIds: new Set()
});

// The athlete's actual session. Roles and modes match what prescribe()
// emits, because sessionTargets reads main work the way finalise() does.
const HIS_SESSION = [
  { role: 'primary',   pattern: 'hinge',  mode: 'load', sets: 4,
    exerciseId: 'romanian-deadlift' },
  { role: 'secondary', pattern: 'push-h', mode: 'load', sets: 4,
    exerciseId: 'close-grip-bench-press' },
  { role: 'accessory', pattern: 'rotate', mode: 'reps', sets: 3,
    exerciseId: 'cable-woodchop' }
];

const ids = blocks => blocks.map(b => b.exerciseId);

// --------------------------------------------------------------------------
// The data the matching reads
// --------------------------------------------------------------------------

test('every dynamic drill and static stretch names the patterns it targets', () => {
  const mobility = LIB.filter(e =>
    (e.modalities || []).some(m => m === 'mobility-dynamic' || m === 'mobility-static'));
  assert.ok(mobility.length >= 38, `expected the mobility pool, got ${mobility.length}`);
  for (const e of mobility) {
    assert.ok(Array.isArray(e.targets) && e.targets.length > 0,
      `${e.id} has no targets -- it can never be matched to a day's work`);
  }
});

test('a targets value is always a real movement pattern', () => {
  const real = new Set(LIB.map(e => e.pattern));
  for (const e of LIB) {
    for (const t of e.targets || []) {
      assert.ok(real.has(t), `${e.id} targets '${t}', which is not a pattern`);
    }
  }
});

test('the quad pull and the hamstring stretch are not filed under hinge', () => {
  // The two entries the athlete named. If either one ever gains 'hinge' the
  // whole complaint comes back, so they are asserted by name.
  assert.ok(!byId('walking-quad-pull').targets.includes('hinge'),
    'a walking quad pull lengthens the quad; it does not prepare a hinge');
  assert.ok(!byId('standing-quad-stretch').targets.includes('hinge'),
    'a standing quad stretch does not belong after a deadlift');
  assert.ok(byId('seated-hamstring-stretch').targets.includes('hinge'),
    'the hamstring stretch is the one that does belong after a hinge');
  assert.ok(byId('bodyweight-hip-hinge').targets.includes('hinge'),
    'a bodyweight hip hinge prepares a hinge');
});

// --------------------------------------------------------------------------
// Reading the day's work
// --------------------------------------------------------------------------

test('the day\'s targets are the patterns of its main work', () => {
  assert.deepEqual(new Set(sessionTargets(HIS_SESSION)),
                   new Set(['hinge', 'push-h', 'rotate']));
});

test('prep, core and cool-down blocks are not themselves the work', () => {
  // Otherwise the prep would target 'mobility' and match everything, which is
  // the behaviour this file exists to remove.
  const noise = [
    { role: 'prep', pattern: 'mobility', mode: 'drill', sets: 1 },
    { role: 'mobility', pattern: 'mobility', mode: 'hold', sets: 2 },
    { role: 'core', pattern: 'core', mode: 'core', sets: 3 }
  ];
  assert.deepEqual(sessionTargets(noise), []);
  assert.deepEqual(new Set(sessionTargets(HIS_SESSION.concat(noise))),
                   new Set(['hinge', 'push-h', 'rotate']));
});

// --------------------------------------------------------------------------
// The prep
// --------------------------------------------------------------------------

test('no drill that only serves squats and lunges reaches a hinge-and-press day', () => {
  const dayTargets = ['hinge', 'push-h', 'rotate'];
  for (let seed = 1; seed <= 60; seed++) {
    const prep = buildPrep('max-strength', LIB, freshCtx(), makeRng(seed),
                           undefined, HIS_SESSION);
    for (const id of ids(prep)) {
      const drill = byId(id);
      assert.ok(drill.targets.some(t => dayTargets.includes(t)),
        `seed ${seed}: ${id} targets ${JSON.stringify(drill.targets)}, ` +
        `none of which is on a ${dayTargets.join('/')} day`);
    }
  }
});

test('the prep covers every pattern of the day it can', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const prep = buildPrep('max-strength', LIB, freshCtx(), makeRng(seed),
                           undefined, HIS_SESSION);
    const covered = new Set(prep.flatMap(b => byId(b.exerciseId).targets));
    for (const want of ['hinge', 'push-h', 'rotate']) {
      assert.ok(covered.has(want),
        `seed ${seed}: nothing in [${ids(prep).join(', ')}] prepares ${want}`);
    }
  }
});

test('a pattern no drill serves does not empty the prep', () => {
  // 'carry' has no dynamic drill filed against it. The block must still fill,
  // because MOBILITY_DOSE's 3-4 drills is a sourced dose, not a maximum to
  // fall short of when the match comes up thin.
  const carryDay = [{ role: 'primary', pattern: 'carry', mode: 'load', sets: 3,
                      exerciseId: 'farmers-carry' }];
  for (let seed = 1; seed <= 30; seed++) {
    const prep = buildPrep('max-strength', LIB, freshCtx(), makeRng(seed),
                           undefined, carryDay);
    assert.ok(prep.length >= 3,
      `seed ${seed}: a carry day got ${prep.length} drills, expected at least 3`);
  }
});

test('the prep still fills when no main work is known', () => {
  // buildPrep's old five-argument form is still how the running days call it.
  for (let seed = 1; seed <= 30; seed++) {
    const prep = buildPrep('max-strength', LIB, freshCtx(), makeRng(seed));
    assert.ok(prep.length >= 3, `seed ${seed}: got ${prep.length} drills`);
  }
});

// --------------------------------------------------------------------------
// The cool-down
// --------------------------------------------------------------------------

test('a hinge day is not stretched with a quad stretch', () => {
  const dayTargets = ['hinge', 'push-h', 'rotate'];
  for (let seed = 1; seed <= 60; seed++) {
    const cool = buildCooldown('max-strength', LIB, freshCtx(), makeRng(seed),
                               undefined, HIS_SESSION);
    for (const b of cool.filter(b => b.role === 'mobility')) {
      const stretch = byId(b.exerciseId);
      assert.ok(stretch.targets.some(t => dayTargets.includes(t)),
        `seed ${seed}: ${b.exerciseId} targets ` +
        `${JSON.stringify(stretch.targets)} after a ${dayTargets.join('/')} day`);
    }
  }
});

test('the cool-down stretches what the day trained', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const cool = buildCooldown('max-strength', LIB, freshCtx(), makeRng(seed),
                               undefined, HIS_SESSION);
    const covered = new Set(cool.filter(b => b.role === 'mobility')
                                .flatMap(b => byId(b.exerciseId).targets));
    for (const want of ['hinge', 'push-h', 'rotate']) {
      assert.ok(covered.has(want), `seed ${seed}: nothing stretches ${want}`);
    }
  }
});

test('the core slot is not filtered by the day\'s patterns', () => {
  // M2 is training, not tissue care. Matching it to the day's patterns would
  // silently narrow the core pool to whatever is tagged 'rotate'.
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const cool = buildCooldown('max-strength', LIB, freshCtx(), makeRng(seed),
                               undefined, HIS_SESSION);
    for (const b of cool.filter(b => b.role === 'core')) seen.add(b.exerciseId);
  }
  assert.ok(seen.size >= 8,
    `the core pool collapsed to ${seen.size} movements across 60 seeds`);
});

// --------------------------------------------------------------------------
// What must not have changed
// --------------------------------------------------------------------------

test('the running prep still selects on joints, not on the day\'s patterns', () => {
  // design-running-programming.md §5.3's shoulder-dislocate guard. A running
  // day's main work is pattern 'run', which no drill targets, so a targets
  // filter alone would let a shoulder drill back into the warm-up.
  const runDay = [{ role: 'primary', pattern: 'run', mode: 'time', sets: 1,
                    exerciseId: 'easy-run' }];
  for (let seed = 1; seed <= 40; seed++) {
    const prep = buildPrep('aerobic-steady', LIB, freshCtx(), makeRng(seed),
                           undefined, runDay);
    for (const b of prep.filter(b => b.role === 'prep' && b.mode === 'drill')) {
      const joints = byId(b.exerciseId).joints || [];
      assert.ok(joints.some(j => ['hip', 'knee', 'ankle'].includes(j)),
        `seed ${seed}: ${b.exerciseId} is not a hip/knee/ankle drill`);
    }
  }
});

// --------------------------------------------------------------------------
// The budget the prep was always supposed to be held to
// --------------------------------------------------------------------------

// Found 2026-09-04 while measuring this branch against the duration sweep.
// `packPrep` was written for ruling A2 -- "a session that draws several
// per-side drills can run well past that estimate" -- shipped with a passing
// unit test, and was never called by generateSession. The cool-down got
// packCooldown; the prep got nothing. js/rules.js:683 describes the measured
// worst case as "3 min prep at packPrep's 3-drill floor and under its own
// budget", so the constant that governs session length was derived against a
// packer that was not running.
//
// This branch surfaced it because matching narrows the pool: the worst seed
// drew four unilateral drills, which is packPrep's own test fixture.

test('a generated session has its prep block packed, not merely built', () => {
  let checked = 0;
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 400; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      const prep = s.blocks.filter(b => b.role === 'prep');
      if (!prep.length) continue;
      checked++;
      const mins = estimateMinutes(prep);
      assert.ok(mins <= TIME.PREP_MIN || prep.length <= 3,
        `${dayType}/seed ${seed}: prep is ${mins.toFixed(1)} min over a ` +
        `${TIME.PREP_MIN} min budget with ${prep.length} drills still in it`);
    }
  }
  assert.ok(checked > 1000, `only checked ${checked} sessions`);
});

const maxDrill = () =>
  ({ role: 'prep', mode: 'drill', sets: 1, reps: 12, restSec: 0, perSide: true });

// This test used to assert that the sourced floor was STILL over budget, and
// it was right at the time: at 3 s/rep -- the barbell figure -- three per-side
// drills cost 4.4 min against a 3 min budget, so the floor could never fit.
// MOBILITY_SECONDS_PER_REP (2026-09-05) prices a mobility rep as a mobility
// rep, and the floor now fits with a little room. The budget and the sourced
// dose stopped contradicting each other, which is the outcome the constant was
// wrong about, not a weakening of this test.
test('the sourced floor now fits the prep budget', () => {
  const packed = packPrep([maxDrill(), maxDrill(), maxDrill(), maxDrill()]);
  assert.equal(packed.blocks.length, 3, 'trims to the sourced floor');
  assert.equal(packed.overBudget, false,
    'three per-side drills at the max dose should fit 3 min');
});

test('a prep that is genuinely too long still says so', () => {
  // The mechanism must stay alive even though the real dose no longer reaches
  // it: a dose above MOBILITY_DOSE's range is the only way there now, which is
  // exactly why it is asserted here rather than left to a live session.
  const long = { role: 'prep', mode: 'drill', sets: 1, reps: 40, restSec: 0, perSide: true };
  const packed = packPrep([long, long, long, long]);
  assert.equal(packed.blocks.length, 3, 'trims to the sourced floor');
  assert.equal(packed.overBudget, true, 'and reports that it is still long');
});

test('a prescribed warm-up jog is not counted as drills overrunning', () => {
  // Interval days put a four-minute jog in the prep. PREP_MIN budgets the
  // DRILL dose, so charging the jog against it fired the overrun warning on
  // every interval session ever generated. The jog still costs its four
  // minutes in the session duration; it is only this budget it is exempt from.
  const jog = { role: 'prep', mode: 'time', durationMin: 4 };
  const packed = packPrep([jog, maxDrill(), maxDrill()]);
  assert.equal(packed.overBudget, false,
    'the jog was charged against the drill budget again');
  assert.ok(packed.blocks.includes(jog), 'and it must not be trimmed away');
});

test('packing never wastes a pick -- no drill doubles up while a pattern goes bare', () => {
  // Coverage is bounded by the drill count, and the drill count is bounded by
  // TIME.PREP_MIN. A four-pattern day that only fits three drills MUST leave
  // one pattern unprepped -- max-strength/seed 8 is exactly that, and it says
  // so in session.warnings. What must never happen is a prep that spends a
  // drill on a pattern it already covered while another day pattern has no
  // drill at all. That is the property the coverage-ordered draw guarantees
  // and that packPrep's tail-first pop preserves.
  let sawTrimmedDay = false;
  for (let seed = 1; seed <= 200; seed++) {
    const s = generate({ library: LIB, dayType: 'max-strength', seed, now: 1e12 });
    const prep = s.blocks.filter(b => b.role === 'prep');
    const main = sessionTargets(s.blocks);
    if (!prep.length || !main.length) continue;

    const reachable = main.filter(t =>
      LIB.some(e => (e.modalities || []).includes('mobility-dynamic') &&
                    (e.targets || []).includes(t)));
    const covered = new Set(prep
      .flatMap(b => byId(b.exerciseId).targets || [])
      .filter(t => reachable.includes(t)));

    // A floor, not an equality: one drill can carry several targets, so three
    // drills covering four patterns is a good outcome, not a violation.
    assert.ok(covered.size >= Math.min(reachable.length, prep.length),
      `seed ${seed}: ${prep.length} drills ` +
      `[${prep.map(b => b.exerciseId).join(', ')}] cover ${covered.size} of ` +
      `${reachable.length} reachable patterns [${reachable.join(', ')}]`);

    if (reachable.length > prep.length) sawTrimmedDay = true;
  }
  assert.ok(sawTrimmedDay,
    'no day in the sweep had more patterns than drills -- the bound is untested');
});

test('every drill in a packed prep still serves the day', () => {
  // The other half: trimming must not leave a drill that prepares nothing the
  // athlete is about to do.
  for (let seed = 1; seed <= 200; seed++) {
    const s = generate({ library: LIB, dayType: 'max-strength', seed, now: 1e12 });
    const main = sessionTargets(s.blocks);
    const prep = s.blocks.filter(b => b.role === 'prep');
    if (!main.length) continue;
    // Only assert where the day is servable at all; a day whose patterns no
    // drill targets falls back to the open pool by design.
    const servable = main.some(t =>
      LIB.some(e => (e.modalities || []).includes('mobility-dynamic') &&
                    (e.targets || []).includes(t)));
    if (!servable) continue;
    for (const b of prep) {
      const t = byId(b.exerciseId).targets || [];
      assert.ok(t.some(x => main.includes(x)),
        `seed ${seed}: ${b.exerciseId} ${JSON.stringify(t)} prepares nothing ` +
        `on a ${main.join('/')} day`);
    }
  }
});
