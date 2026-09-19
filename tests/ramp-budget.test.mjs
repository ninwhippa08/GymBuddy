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
  for (const dayType of LIFTING) {
    let cut = 0, total = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const s = generate({ library: LIB, profile: atWeek(4), history: [], soreness: {},
                           dayType, seed, now: NOW });
      total++;
      if (s.rampSets.budget < s.rampSets.drawn) cut++;
    }
    assert.ok(cut / total > 0.97,
      `${dayType}: week 4 cut nothing on ${total - cut}/${total} sessions`);
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
  // sessions): 0 were floor-forced. Bounded at 2% here, well above what was
  // observed, so a template change that makes floor-forcing common trips it.
  let floorForced = 0, total = 0;
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
        if (delivered > budget) { floorForced++; continue; }
        assert.ok(delivered <= budget,
          `${dayType} wk${week} seed ${seed}: delivered ${delivered} exceeds budget ${budget}`);
      }
    }
  }
  assert.ok(floorForced / total < 0.02,
    `floor-forced sessions were ${floorForced}/${total} (${(100 * floorForced / total).toFixed(1)}%), not a small minority`);
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

test('full volume is unchanged, block for block', () => {
  // The ramp is the only thing this touches. A fully recovered athlete's
  // session must be what v77 built -- pinned in tests/fixtures/full-volume-v77.json
  // rather than compared against a second live call, because two live
  // full-volume profiles go through the same code and a change that moved
  // both equally would pass here undetected. See tests/fixtures/README.md.
  const fixture = JSON.parse(
    readFileSync(new URL('../tests/fixtures/full-volume-v77.json', import.meta.url), 'utf8')
  );
  for (const dayType of LIFTING) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = generate({ library: LIB, profile: atWeek(5), history: [], soreness: {},
                           dayType, seed, now: NOW });
      assert.deepEqual(s.blocks.map(x => [x.slot, x.sets, x.reps]),
                       fixture[dayType][String(seed)]);
    }
  }
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
