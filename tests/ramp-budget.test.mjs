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

// --------------------------------------------------------------------------
// Session-level: generate() honours the budget
// --------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { generate, countsTowardVolume } from '../js/generator.js';
import { RAMP } from '../js/rules.js';
import { TEMPLATES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const NOW = 1e12;
const DAY = 86400e3;
const LIFTING = ['max-strength', 'power', 'hypertrophy'];
// Mid-week, so a rounding error in rampWeekFor cannot land this on a boundary.
const atWeek = w => ({ returnDate: new Date(NOW - ((w - 1) * 7 + 3) * DAY).toISOString().slice(0, 10) });

function meanSets(dayType, week, seeds = 120) {
  let sets = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
                         dayType, seed, now: NOW });
    sets += s.blocks.filter(countsTowardVolume).reduce((a, b) => a + b.sets, 0);
  }
  return sets / seeds;
}

test('every ramp week delivers more work than the one before it', () => {
  // THE FLAT SPOT AT SESSION LEVEL. Before this change, hypertrophy slot C sat
  // at 2.00 sets for weeks 1, 2 and 3, and week 4 delivered 101% of full volume.
  for (const dayType of LIFTING) {
    const by = [1, 2, 3, 4, 5].map(w => meanSets(dayType, w));
    for (let i = 1; i < by.length; i++) {
      assert.ok(by[i] > by[i - 1],
        `${dayType}: week ${i + 1} delivered ${by[i].toFixed(2)} against week ${i}'s ${by[i - 1].toFixed(2)}`);
    }
  }
});

test('week 4 is not a free week', () => {
  // round(3 x 0.9) = 3, so at a dose of 3 the old per-block rule cut nothing
  // here. The claim is now against week 4's OWN draw, not against week 5:
  // budget must land below drawn on essentially every session.
  // [measured] 2026-09-19, 300 seeds x 3 lifting day types: 300/300 cut on
  // every one. Bounded at 97%, well under what was observed.
  //
  // `budget < drawn` alone is near-tautological once the test below pins
  // `budget === round(drawn x 0.9)`, which is below drawn for any drawn of 2
  // or more -- it says nothing about sets actually DELIVERED, the original
  // defect's whole subject. Assert that too: delivered, not just budget, must
  // land under drawn. [measured] 2026-09-19, 120 seeds x 3 lifting day types:
  // 120/120 on every day type.
  for (const dayType of LIFTING) {
    let cut = 0, deliveredCut = 0, total = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const s = generate({ library: LIB, profile: atWeek(4), history: [], soreness: {},
                           dayType, seed, now: NOW });
      total++;
      if (s.rampSets.budget < s.rampSets.drawn) cut++;
      if (s.rampSets.delivered < s.rampSets.drawn) deliveredCut++;
    }
    assert.ok(cut / total > 0.97,
      `${dayType}: week 4 cut nothing on ${total - cut}/${total} sessions`);
    assert.equal(deliveredCut, total,
      `${dayType}: week 4 delivered full drawn volume on ${total - deliveredCut}/${total} sessions`);
  }
});

test('a ramped session delivers the budget its own draw implies', () => {
  // THE CLAIM THE WHOLE CHANGE MAKES, stated per session rather than against
  // a week-5 denominator the clock has already clipped. packToBudget's
  // ceiling is never ramped (TIME.MAIN_WORK_MAX_MIN, flat), and it trims week
  // 5 in 109-244 of 300 measured sessions against 1-7 at week 4 -- dividing
  // delivered sets by meanSets(week 5) cannot express what rampToBudget
  // promises, because the denominator moves for reasons this function does
  // not own.
  //
  // budget is round(drawn x RAMP[week-1].volume) -- rampToBudget's own
  // arithmetic, recomputed here from the numbers the session carries rather
  // than trusted, so a broken gate (wrong volume, or not called at all) is
  // caught directly.
  //
  // delivered <= budget always, with one named exception: setFloor can force
  // delivered OVER budget (see 'floors that exceed the budget overshoot it,
  // visibly' above). Nothing after rampToBudget can raise a set count --
  // applyArchitecture rearranges, never adds; packToBudget and capPatternSets
  // only remove -- and rampToBudget's own leftover loop always has enough
  // headroom to reach budget exactly (budget <= drawn by construction), so it
  // never delivers UNDER budget on its own. `delivered < budget` is therefore
  // the signature of a later trim (the clock or the ten-per-pattern cap)
  // firing after the budget was already met -- no separate flag is needed to
  // detect it.
  //
  // [measured] 2026-09-19, 120 seeds x 3 lifting day types x weeks 1-4 (1440
  // sessions): 0 floor-forced, 132 trimmed below budget (all at max-strength
  // week 3-4 and the higher-volume tail of power/hypertrophy week 4), 1308
  // exact. Bounds below are set well outside those measured values, so both
  // branches can actually fail -- a per-iteration `delivered <= budget` recheck
  // was dropped here because it was vacuous: reachable only when already known
  // true by the branch that led to it.
  let floorForced = 0, trimmed = 0, exact = 0, total = 0;
  for (const dayType of LIFTING) {
    for (const week of [1, 2, 3, 4]) {
      const intended = RAMP[week - 1].volume;
      for (let seed = 1; seed <= 120; seed++) {
        const s = generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
                             dayType, seed, now: NOW });
        const { drawn, budget, delivered } = s.rampSets;
        assert.equal(budget, Math.max(1, Math.round(drawn * intended)),
          `${dayType} wk${week} seed ${seed}: budget ${budget} does not match round(${drawn} x ${intended})`);
        total++;
        if (delivered > budget) floorForced++;
        else if (delivered < budget) trimmed++;
        else exact++;
      }
    }
  }
  assert.ok(floorForced / total < 0.02,
    `floor-forced sessions were ${floorForced}/${total} (${(100 * floorForced / total).toFixed(1)}%), not a small minority`);
  assert.ok(exact / total > 0.5,
    `sessions delivering exactly the budget were only ${exact}/${total} (${(100 * exact / total).toFixed(1)}%)`);
});

test('no session is emptied, and none is left at every floor by accident', () => {
  for (const dayType of LIFTING) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = generate({ library: LIB, profile: atWeek(1), history: [], soreness: {},
                           dayType, seed, now: NOW });
      const work = s.blocks.filter(countsTowardVolume);
      assert.ok(work.length >= 1, `${dayType} seed ${seed}: week 1 has no working blocks`);
      for (const b of work) {
        assert.ok(b.sets >= (b.setPlan ? 2 : 1),
          `${dayType} seed ${seed} slot ${b.slot}: ${b.sets} sets is under its floor`);
        if (b.setPlan) {
          assert.equal(b.setPlan.filter(x => x.kind === 'work').length, b.sets,
            `${dayType} seed ${seed} slot ${b.slot}: setPlan disagrees with block.sets`);
        }
      }
    }
  }
});

test('required full-volume work is v77 work, and the ramp cuts nothing at week 5', () => {
  // The ramp is the only thing this touches. A fully recovered athlete's
  // session must be what v77 built -- pinned in tests/fixtures/full-volume-v77.json
  // rather than compared against a second live call, because two live
  // full-volume profiles go through the same code and a change that moved
  // both equally would pass here undetected. See tests/fixtures/README.md.
  //
  // Widened to footContacts and sprintMeters (null where the block never had
  // either): [slot, sets, reps] alone cannot see the counter desync
  // 'footContacts and sprintMeters track delivered sets, not drawn ones'
  // exists to catch. rampToBudget is a no-op at full volume, but
  // packToBudget and capPatternSets are not, and both go through
  // dropWorkingSet on any ramp week including this one -- so a contacts block
  // shaved by either at full volume would drift here too. This particular
  // 40-seed sample does not happen to exercise that path (checked: this test
  // stayed green with the fix reverted); the comprehensive guard above, run
  // across all five ramp weeks, is what actually caught the bug. This
  // widening is a second, independent net for the same defect, not the one
  // that found it. Captured from af71716 (pre-behavioural-change), not from
  // HEAD -- see tests/fixtures/README.md for why regenerating from the
  // current tree would have asserted the new code against itself.
  const fixture = JSON.parse(
    readFileSync(new URL('../tests/fixtures/full-volume-v77.json', import.meta.url), 'utf8')
  );
  //
  // NARROWED by the session-composition change. Optional slots are now
  // admitted by weekly need and per-session dose, not minutes
  // (docs/superpowers/specs/2026-10-22-session-composition-design.md §4.2),
  // and §4.4 says outright that the full-volume session changes -- so the
  // OPTIONAL blocks are no longer v77's, by design, and are left out here.
  // The required blocks are filled before any optional slot is reached, so
  // their slots, order and reps are still v77's exactly. Their sets may only
  // go UP: the packer used to shave a required set to make room for optional
  // work, and the spec's anti-goal is that no required working set is removed
  // on a lifting day. Measured 40 seeds x 3 day types at this change: 1
  // required block differs (hypertrophy seed 33, slot A 3 -> 4 sets), none
  // lower. And the ramp itself -- what this test was written for -- must
  // still cut nothing at full volume: budget equals drawn.
  const required = new Map(LIFTING.map(d =>
    [d, new Set(TEMPLATES[d].filter(sl => !sl.optional).map(sl => sl.slot))]));
  let hipThrustSkipped = 0;
  for (const dayType of LIFTING) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = generate({ library: LIB, profile: atWeek(5), history: [], soreness: {},
                           dayType, seed, now: NOW });
      // 2026-10-24: hip-thrust became loadable (priced off the back squat;
      // tests/coef-provenance.mjs). A loaded block draws its percentage from
      // the rng, so every block filled after one in the same session moves
      // off v77's stream. Three of these 120 sessions hold a hip thrust; two
      // of them moved (hypertrophy seeds 28 and 33), nothing else did.
      // Skipped, and counted, so the exemption cannot quietly grow.
      if (s.blocks.some(b => b.exerciseId === 'hip-thrust')) {
        hipThrustSkipped++;
        assert.equal(s.rampSets.budget, s.rampSets.drawn, `${dayType} seed ${seed}`);
        continue;
      }
      const req = required.get(dayType);
      const got = s.blocks.filter(x => req.has(x.slot));
      const want = fixture[dayType][String(seed)].filter(([slot]) => req.has(slot));
      assert.deepEqual(got.map(x => [x.slot, x.reps]), want.map(([slot, , reps]) => [slot, reps]),
        `${dayType} seed ${seed}`);
      got.forEach((x, i) => {
        assert.ok(x.sets >= want[i][1],
          `${dayType} seed ${seed} slot ${x.slot}: ${x.sets} sets, v77 had ${want[i][1]}`);
        // The counter-desync net, kept wherever the set count is unchanged.
        if (x.sets === want[i][1]) {
          assert.deepEqual([x.footContacts ?? null, x.sprintMeters ?? null], want[i].slice(3),
            `${dayType} seed ${seed} slot ${x.slot}: counters`);
        }
      });
      assert.equal(s.rampSets.budget, s.rampSets.drawn, `${dayType} seed ${seed}`);
    }
  }
  assert.equal(hipThrustSkipped, 3, 'the hip-thrust exemption covers a different set of sessions now');
});

test('intervals are still ramped by prescribe, and core never was', () => {
  // TWO DIFFERENT FACTS, and an earlier draft of this test conflated them.
  //
  // Intervals go through prescribe() and ARE scaled by the multiplier. That is
  // the half this change could break: if the new gate is written wrongly,
  // interval work silently stops being ramped.
  //
  // Core does not go through prescribe() AT ALL. buildBlockGroups routes
  // MOBILITY_BLOCK_MODES -- drill, hold, core -- to prescribeMobility, which
  // takes no `env` and multiplies nothing. Core has never been ramped, before
  // this change or after it. Recorded here rather than fixed: adding a ramp to
  // core work would be a new, unsourced behaviour change, and it is the
  // athlete's call, not this task's.
  const meanSets = (w, pick) => {
    let n = 0, sets = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const s = generate({ library: LIB, profile: atWeek(w), history: [], soreness: {},
                           dayType: 'hypertrophy', seed, now: NOW });
      for (const b of s.blocks.filter(pick)) { n++; sets += b.sets; }
    }
    return n ? sets / n : 0;
  };
  const core = b => b.role === 'core';
  assert.ok(Math.abs(meanSets(1, core) - meanSets(5, core)) < 0.15,
    'core is not ramped, and this change must not start ramping it');

  const intervals = (w) => {
    let n = 0, sets = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const s = generate({ library: LIB, profile: atWeek(w), history: [], soreness: {},
                           dayType: 'interval', seed, now: NOW });
      for (const b of s.blocks.filter(x => x.mode === 'interval')) { n++; sets += b.sets; }
    }
    return n ? sets / n : 0;
  };
  assert.ok(intervals(1) < intervals(5),
    `interval work must stay ramped: week 1 ${intervals(1)} against full ${intervals(5)}`);
});

test('footContacts and sprintMeters track delivered sets, not drawn ones', () => {
  // THE FLAT SPOT THIS TASK REMOVED FROM SETS, STILL ALIVE IN THE COUNTERS.
  // prescribe() denormalises both from the drawn set count; before this task
  // that count was already the ramped one, so it was right. Now rampToBudget
  // (and packToBudget, and capPatternSets) can remove sets from a 'contacts'
  // block via dropWorkingSet AFTER prescribe() ran, and until this fix
  // neither counter followed -- reported contacts sat flat across ramp
  // weeks exactly the way sets used to before rampToBudget existed.
  //
  // Checked against the exercise library (contactsPerRep, nominalMeters)
  // rather than against the block's own stored per-set rate, so a bug that
  // corrupts the rate and the recompute the same way cannot hide behind
  // internal self-consistency.
  for (const dayType of LIFTING) {
    for (const week of [1, 2, 3, 4, 5]) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
                             dayType, seed, now: NOW });
        for (const b of s.blocks) {
          if (b.mode !== 'contacts') {
            assert.equal(b.contactsPerSet, undefined,
              `${dayType} wk${week} seed ${seed} slot ${b.slot}: non-contacts block carries contactsPerSet`);
            assert.equal(b.metersPerSet, undefined,
              `${dayType} wk${week} seed ${seed} slot ${b.slot}: non-contacts block carries metersPerSet`);
            continue;
          }
          const exercise = LIB.find(e => e.id === b.exerciseId);
          const per = exercise.contactsPerRep == null ? 0 : exercise.contactsPerRep;
          assert.equal(b.footContacts, per * b.sets * b.reps,
            `${dayType} wk${week} seed ${seed} slot ${b.slot}: footContacts ${b.footContacts} against ${per} x ${b.sets} x ${b.reps}`);
          if (exercise.nominalMeters) {
            assert.equal(b.sprintMeters, exercise.nominalMeters * b.sets * b.reps,
              `${dayType} wk${week} seed ${seed} slot ${b.slot}: sprintMeters ${b.sprintMeters} against ${exercise.nominalMeters} x ${b.sets} x ${b.reps}`);
          }
        }
      }
    }
  }
});
