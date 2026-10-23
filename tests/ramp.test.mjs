// The warm-up. design-mobility-and-warmup.md §4.3, and since v79
// docs/superpowers/specs/2026-10-22-warmup-and-staircase-card-design.md §3-§4:
// two rungs -- WARMUP.START, then a heavy rung at 80% of the work or one
// body-region jump below it, whichever is heavier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWarmup } from '../js/generator.js';
import { WARMUP } from '../js/rules.js';

const pcts = ladder => ladder.map(s => Math.round(s.pct * 100) / 100);
const plain = { technical: 1 };
const pushH = { technical: 1, pattern: 'push-h' };
// 0.50 to 0.95 in hundredths, built from integers so no float drift.
const WORKINGS = Array.from({ length: 46 }, (_, i) => (50 + i) / 100);

test('a working load under the floor gets no ramp at all', () => {
  // "Light work gets nothing, which is what the sources say and what a rest
  // day should feel like." §4.3
  assert.deepEqual(buildWarmup(0.49, plain), []);
  assert.deepEqual(buildWarmup(0.30, plain), []);
});

test('never more than two warm-up sets', () => {
  // spec §3: no trial found tests more than two sets against two before heavy
  // work. Every load from the floor up gets exactly two, technical or not.
  for (const working of WORKINGS) {
    for (const ex of [plain, { technical: 3 }, pushH]) {
      const n = buildWarmup(working, ex).length;
      assert.equal(n, 2, `working ${working} ${JSON.stringify(ex)}: ${n} warm-up sets, want 2`);
    }
  }
});

test('rung one is WARMUP.START, rung two is the heavy rung', () => {
  // spec §4's worked examples, written out rather than recomputed.
  assert.deepEqual(pcts(buildWarmup(0.80, plain)), [0.30, 0.65]);
  assert.deepEqual(pcts(buildWarmup(0.90, plain)), [0.30, 0.75]);
  assert.deepEqual(pcts(buildWarmup(0.95, plain)), [0.30, 0.80]);
  assert.deepEqual(pcts(buildWarmup(0.55, plain)), [0.30, 0.44]);
  assert.deepEqual(pcts(buildWarmup(0.85, pushH)), [0.30, 0.75]);
});

test('the jump into the work stays inside the body-region band', () => {
  // The rung-1 to rung-2 jump may be wide -- light loads, and Ribeiro's own
  // protocol jumps 40% -> 80% -- but the last jump, into the work, may not.
  // 0.15 and 0.10 written out: they pin the SOURCED bands, so widening the
  // constants must break this. spec §4, design §8 q5.
  for (const working of WORKINGS) {
    for (const [ex, band] of [[plain, 0.15], [{ technical: 3 }, 0.15], [pushH, 0.10]]) {
      const w = buildWarmup(working, ex);
      const jump = working - w[w.length - 1].pct;
      assert.ok(jump <= band + 1e-9,
        `working ${working} ${JSON.stringify(ex)}: jump of ${jump.toFixed(3)} into the work`);
    }
  }
});

test('reps are unchanged rules', () => {
  // WARMUP.REPS_BY_PCT is untouched; only the rung count changed. 0.44 is
  // under the 0.45 threshold, so 0.55's heavy rung is still eight. spec §4.
  assert.deepEqual(buildWarmup(0.55, plain).map(s => s.reps), [8, 8]);
  assert.deepEqual(buildWarmup(0.80, plain).map(s => s.reps), [8, 3]);
  assert.deepEqual(buildWarmup(0.90, plain).map(s => s.reps), [8, 2]);
  assert.deepEqual(buildWarmup(0.80, { technical: 3 }).map(s => s.reps), [3, 3]);
});

test('a technical lift gets no extra set', () => {
  // The v78 extra START set is gone: it broke "at most two". spec §4.
  assert.equal(buildWarmup(0.80, { technical: 3 }).length, 2);
});

test('the ladder starts at WARMUP.START and never reaches the working load', () => {
  const ladder = buildWarmup(0.80, plain);
  assert.equal(ladder[0].pct, WARMUP.START);
  assert.ok(ladder[ladder.length - 1].pct < 0.80);
});

test('reps fall as the step gets heavier', () => {
  const ladder = buildWarmup(0.90, plain);
  const reps = ladder.map(s => s.reps);
  for (let i = 1; i < reps.length; i++) {
    assert.ok(reps[i] <= reps[i - 1], `reps went up: ${JSON.stringify(reps)}`);
  }
  assert.equal(ladder[0].reps, 8, 'a 0.30 step is eight reps');
});

test('a missing technical rating is treated as the plain progression', () => {
  assert.deepEqual(buildWarmup(0.80, {}), buildWarmup(0.80, { technical: 1 }));
});

test('every step is marked as a warm-up', () => {
  for (const s of buildWarmup(0.85, plain)) assert.equal(s.kind, 'warmup');
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

test('the return ramp lowers the heavy rung on its own', () => {
  // §4.3's emergent property, restated for v79: during the return ramp
  // env.pctCeiling is 0.65, so no working load can exceed it, and the heavy
  // rung (80% of the work, or one body-region jump below it) cannot sit above
  // max(0.80 x 0.65, 0.65 - maxJump) -- 0.52 on the lower-body band, 0.55 on
  // the upper-body one. The 0.80 is written out below rather than read from
  // WARMUP, so retuning HEAVY_RUNG breaks this. The ladder is two rungs at any
  // load now, so what the ramp changes is HOW HEAVY the second one is, not
  // how many there are.
  // Nothing special-cases the ramp weeks -- if this ever needs a special case,
  // the clamp has stopped doing its job.
  for (const ex of LOADABLE) {
    for (const zone of Object.keys(ZONES)) {
      const block = prescribe({ ...SLOT, zone }, ex,
        { pctCeiling: 0.65, volumeMultiplier: 1 }, rng, {});
      if (!block.setPlan) continue;
      const warmups = block.setPlan.filter(s => s.kind === 'warmup');
      const maxJump = WARMUP.UPPER_BODY_PATTERNS.includes(ex.pattern)
        ? WARMUP.MAX_JUMP_UPPER : WARMUP.MAX_JUMP;
      const heavyCeiling = Math.round(
        Math.max(0.80 * 0.65, 0.65 - maxJump) * 100) / 100;
      assert.equal(warmups.length, 2,
        `${ex.id} (technical ${ex.technical}) ${zone}: ${warmups.length} warm-up sets under a 0.65 ceiling`);
      assert.ok(warmups[1].pct <= heavyCeiling,
        `${ex.id} ${zone}: heavy rung ${warmups[1].pct} above ${heavyCeiling} under a 0.65 ceiling`);
    }
  }
});

test('the work entries and block.sets never disagree', () => {
  // §4.3: "Warm-up sets are not training volume. They must be excluded from
  // patternSets, cnsLoad and footContacts." Keeping block.sets as the WORKING
  // count is what buys that for free (plan-05 decision 1); this test is what
  // stops a later edit from summing setPlan into the volume instead.
  const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 60; seed++) {
      const s = generate({ library: LIB, profile, history: [], soreness: {}, dayType, seed });
      for (const b of s.blocks) {
        if (!b.setPlan) continue;
        assert.equal(b.setPlan.filter(x => x.kind === 'work').length, b.sets,
          `${dayType} seed ${seed} ${b.exerciseId}: work sets and b.sets disagree`);
      }
    }
  }
});

test('a ramp does not inflate patternSets', () => {
  // The same session, generated twice, differing only in whether the ramp is
  // attached. The pattern counts must be identical.
  const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({ library: LIB, profile, history: [], soreness: {},
                         dayType: 'max-strength', seed });
    const fromBlocks = s.blocks
      .filter(b => b.mode === 'load' || b.mode === 'reps' || b.mode === 'contacts')
      .filter(b => b.role !== 'core' && b.role !== 'prep')
      .reduce((n, b) => n + b.sets, 0);
    const counted = Object.values(s.patternSets).reduce((a, b) => a + b, 0);
    assert.equal(counted, fromBlocks,
      `seed ${seed}: patternSets ${counted} does not match working sets ${fromBlocks}`);
  }
});

import { estimateMinutes, packToBudget } from '../js/generator.js';

test('a ramped lift is priced above the same lift without one', () => {
  const squat = LIB.find(e => e.id === 'back-squat');
  const withRamp = prescribe(SLOT, squat, ENV, rng, {});
  assert.ok(withRamp.setPlan, 'this test needs a ramped block');
  const without = { ...withRamp };
  delete without.setPlan;
  assert.ok(estimateMinutes([withRamp]) > estimateMinutes([without]),
    'the warm-up sets cost nothing in the time estimate');
});

test('shaving a set shaves the plan with it', () => {
  // packToBudget drops sets to fit the budget. A setPlan left at its old
  // length would print more working sets than the block claims to have.
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  const { blocks } = packToBudget([block], 1);   // an impossible budget forces shaving
  const out = blocks[0];
  assert.equal(out.setPlan.filter(s => s.kind === 'work').length, out.sets);
});

test('trimming never removes a warm-up', () => {
  // The ramp is the safety feature. Cutting IT to save a minute is the wrong
  // end of the session to cut. basis §3.
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  const before = block.setPlan.filter(s => s.kind === 'warmup').length;
  const { blocks } = packToBudget([block], 1);
  assert.equal(blocks[0].setPlan.filter(s => s.kind === 'warmup').length, before);
});

test('trimming never leaves a ramped block with one working set', () => {
  // Five warm-up sets to perform ONE working set is not a prescription anyone
  // would write by hand, and it is what the old `b.sets > 1` shave floor
  // produced: max-strength/seed 34 printed pause-squat at 1 x 6 @ 0.71 behind
  // five rungs, and 136 ramped blocks over a 21,000-session sweep (7 day types
  // x 3,000 seeds, now: 1e12) ended the same way. Warm-ups cannot be shaved --
  // they are the safety
  // feature -- so the working sets are the only thing left to cut, and two is
  // the floor at which the ramp still buys something.
  const squat = LIB.find(e => e.id === 'back-squat');
  const block = prescribe(SLOT, squat, ENV, rng, {});
  assert.ok(block.setPlan, 'this test needs a ramped block');
  const { blocks } = packToBudget([block], 1);   // an impossible budget
  assert.equal(blocks[0].sets, 2,
    'a ramped block was shaved past the two-working-set floor');
});

test('no generated session prescribes a ramp for fewer than two working sets', () => {
  // The population the regression was measured on. NOT "no ramped block
  // carries more warm-ups than working sets" -- that is false by construction
  // and always was: a technical: 3 lift at a high ceiling gets six rungs and a
  // power slot may only ask for two working sets, with no trimming involved.
  // The floor is on the WORK, which is the part packToBudget can take away.
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 300; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      for (const b of s.blocks) {
        if (!b.setPlan) continue;
        assert.ok(b.sets >= 2,
          `${dayType} seed ${seed} ${b.exerciseId}: ${b.sets} working set behind ` +
          `${b.setPlan.filter(x => x.kind === 'warmup').length} warm-ups`);
      }
    }
  }
});

// --------------------------------------------------------------------------
// The jump splits by body region. design §8 q5, closed 2026-09-04: the sourced
// increment band is 5-10% for upper-body lifts and 10-20% for lower-body ones,
// so one constant could not be right for both.
//
// Since v79 the band only governs the jump INTO the work (pinned above in
// 'the jump into the work stays inside the body-region band'). v78's
// rung-count tests pinned the v79 pricing hold and went with it (composition
// spec §5).
// --------------------------------------------------------------------------

const upper = { technical: 1, pattern: 'push-h' };
const lower = { technical: 1, pattern: 'squat' };

test('lower-body and unclassified lifts keep the wider band', () => {
  // The default must stay the wider number: a movement the taxonomy has not
  // classified is never over-ramped on the strength of a missing field.
  assert.deepEqual(pcts(buildWarmup(0.80, lower)), pcts(buildWarmup(0.80, plain)));
});

// --------------------------------------------------------------------------
// The rule, across what the generator actually builds. spec §4: "at most two"
// and "never heavier than the working set", over every day type and ramp week.
// --------------------------------------------------------------------------

import { PHASE_1_DAY_TYPES } from '../js/templates.js';

test('every generated plan has at most two warm-ups, none heavier than the work', () => {
  const NOW = 1e12;
  const DAY = 86400e3;
  const atWeek = w => ({
    returnDate: new Date(NOW - ((w - 1) * 7 + 3) * DAY).toISOString().slice(0, 10)
  });
  let plans = 0;
  for (const dayType of PHASE_1_DAY_TYPES) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = generate({ library: LIB, profile: atWeek(week), history: [],
                             soreness: {}, dayType, seed, now: NOW });
        for (const b of s.blocks) {
          if (!b.setPlan) continue;
          plans++;
          const where = `${dayType} week ${week} seed ${seed} ${b.exerciseId}`;
          const warm = b.setPlan.filter(x => x.kind === 'warmup');
          assert.ok(warm.length <= 2, `${where}: ${warm.length} warm-up sets`);
          // Against the LIGHTEST working set, not the first: a ladder
          // architecture's waves dip, and the invariant is "never heavier
          // than the work", not "lighter than whatever prints first".
          const lightest = Math.min(...b.setPlan.filter(x => x.kind === 'work')
                                                .map(x => x.displayMultiplier));
          for (const w of warm) {
            assert.ok(w.displayMultiplier <= lightest + 1e-9,
              `${where}: warm-up ${w.displayMultiplier} above the lightest work ${lightest}`);
          }
        }
      }
    }
  }
  assert.ok(plans > 0, 'the sweep found no set plans to check');
});
