// design §4.4: the exercise count is a residual of coverage debt and time,
// not the hardcoded 4 or 5 that spec.md §10 item 4 calls "this document
// citing itself". plan-07.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_TYPES, PHASE_1_DAY_TYPES, TEMPLATES } from '../js/templates.js';
import { patternDebt, weeklySetTarget, generate, packToBudget } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const LIBRARY_PATTERNS = new Set(LIB.map(e => e.pattern));

test('every lifting day type declares the patterns it targets', () => {
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    const targets = DAY_TYPES[dt].targets;
    assert.ok(Array.isArray(targets) && targets.length > 0,
      `${dt} declares no targets, so coverage has nothing to count against`);
  }
});

test('a declared target is a pattern the library can actually fill', () => {
  // A target naming a pattern with no exercises would be permanent debt: the
  // coverage rule would ask for a slot that can never be satisfied.
  for (const dt of PHASE_1_DAY_TYPES) {
    for (const p of DAY_TYPES[dt].targets || []) {
      assert.ok(LIBRARY_PATTERNS.has(p),
        `${dt} targets "${p}", which no exercise in the library has`);
    }
  }
});

const stateWith = patternSets => ({ patternSets, recentExerciseIds: new Set() });

test('an untrained pattern owes the whole weekly target', () => {
  assert.equal(patternDebt('squat', 'max-strength', stateWith({})),
    weeklySetTarget('max-strength'));
});

test('debt falls by the sets already done', () => {
  // max-strength targets 4 sets/week (Pelland et al. 2025 -- strength's
  // efficient band ends at 4, where hypertrophy's runs to 10).
  assert.equal(patternDebt('squat', 'max-strength', stateWith({ squat: 3 })), 1);
});

test('debt never goes negative', () => {
  // Over-trained is not credit toward another pattern.
  assert.equal(patternDebt('squat', 'max-strength', stateWith({ squat: 99 })), 0);
});

test('the same history leaves more debt on a hypertrophy day than a strength day', () => {
  // The whole point of the per-goal split: 4 sets of squatting is a full
  // max-strength week and not even half a hypertrophy one.
  const done = stateWith({ squat: 4 });
  assert.equal(patternDebt('squat', 'max-strength', done), 0);
  assert.ok(patternDebt('squat', 'hypertrophy', done) > 0);
});

test('a lifting template offers more slots than a session will use', () => {
  // §4.4: "TEMPLATES stays a list, but becomes longer than will fit and is
  // consumed in priority order". Before plan-07 these were 4, 4 and 5 -- the
  // exact counts spec.md calls invented.
  assert.ok(TEMPLATES['max-strength'].length > 4);
  assert.ok(TEMPLATES.power.length > 4);
  assert.ok(TEMPLATES.hypertrophy.length > 5);
});

test('every slot beyond the original ones is optional', () => {
  // The required core of each day is unchanged, so coverage can only ADD.
  for (const [dt, originallyRequired] of [['max-strength', 3], ['power', 3], ['hypertrophy', 3]]) {
    const required = TEMPLATES[dt].filter(s => !s.optional).length;
    assert.equal(required, originallyRequired,
      `${dt} changed its required slot count, which changes what a session must contain`);
  }
});

test('every added slot can be filled from the library', () => {
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    for (const slot of TEMPLATES[dt]) {
      if (!slot.patterns) continue;   // a null-pattern slot is filled by tier
      const pool = LIB.filter(e => slot.patterns.includes(e.pattern));
      assert.ok(pool.length > 0,
        `${dt} slot ${slot.slot} names patterns no exercise has: ${JSON.stringify(slot.patterns)}`);
    }
  }
});

const mainBlocks = s =>
  s.blocks.filter(b => b.role !== 'prep' && b.role !== 'mobility' && b.role !== 'core');

function countMain(dayType, patternSets, seed = 11) {
  const history = Object.keys(patternSets).length
    ? [{ date: '2026-08-30', dayType: 'hypertrophy', cnsLoad: 0, patternSets, blocks: [] }]
    : [];
  const s = generate({
    library: LIB, profile: { banned: [], plyoLevel: 'beginner' },
    history, soreness: {}, dayType, excludeEquipment: [], seed,
    now: Date.parse('2026-09-01T12:00:00Z')
  });
  return mainBlocks(s).length;
}

test('a week with nothing trained pulls in more exercises than a week already covered', () => {
  // The complaint §4.4 answers: the count never responded to what was trained.
  //
  // Measured on hypertrophy, not max-strength. At full volume a max-strength
  // day already spends its whole main-work budget on the three required slots
  // -- measured 259 of 300 seeds at exactly 3 blocks -- so TIME binds there and
  // coverage has nothing to spend. That is §4.4 working as written ("time wins
  // and the session is flagged"), not coverage failing, and a test that cannot
  // observe the property it names is not a test of it.
  const fresh = countMain('hypertrophy', {});
  const covered = countMain('hypertrophy', {
    squat: 20, hinge: 20, 'push-h': 20, 'push-v': 20,
    'pull-h': 20, 'pull-v': 20, lunge: 20
  });
  assert.ok(fresh > covered,
    `coverage is not driving the count: ${fresh} exercises on a fresh week ` +
    `vs ${covered} on a fully covered one`);
});

test('the required core of a day is always delivered', () => {
  // Even with every pattern at its target, a session is still a session.
  const covered = countMain('hypertrophy', {
    squat: 99, hinge: 99, 'push-h': 99, 'push-v': 99,
    'pull-h': 99, 'pull-v': 99, lunge: 99
  });
  assert.ok(covered >= 3, `only ${covered} main blocks -- the required slots must survive`);
});

test('when something must go, the least overdue work goes first', () => {
  // §4.4: "drop the slot whose pattern carries the least outstanding debt, so
  // the work that survives is the work most overdue." It used to drop the
  // LAST optional slot, which is a statement about template order, not about
  // what the athlete needs.
  const blocks = [
    { slot: 'A', pattern: 'squat',  optional: false, mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'B', pattern: 'hinge',  optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'C', pattern: 'pull-h', optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 }
  ];
  // hinge is fully covered this week; pull-h has not been touched. Slot B is
  // earlier, so position-ordered trimming would keep it and drop C.
  const state = { patternSets: { hinge: 99, 'pull-h': 0 }, recentExerciseIds: new Set() };
  // 23 min fits A plus exactly ONE optional block (A alone is 11, A+B is 23,
  // A+B+C is 34), so precisely one has to go and the choice is observable. A
  // budget that drops BOTH cannot see the ordering at all -- the first draft
  // of this test used one and passed against the old position-ordered code.
  const out = packToBudget(blocks, 23, { dayType: 'max-strength', state });
  const kept = out.blocks.map(b => b.slot);

  assert.ok(kept.includes('A'), 'a required slot must never be dropped');
  assert.ok(kept.includes('C'),
    `the most overdue work should survive, but kept ${kept.join(',')}`);
  assert.ok(!kept.includes('B'), `dropped by position, not debt: kept ${kept.join(',')}`);
});

test('called without a day type it trims exactly as it always did', () => {
  const blocks = [
    { slot: 'A', pattern: 'squat', optional: false, mode: 'load', sets: 3, reps: 5, restSec: 180 },
    { slot: 'B', pattern: 'hinge', optional: true,  mode: 'load', sets: 3, reps: 5, restSec: 180 }
  ];
  const out = packToBudget(blocks, 11);   // fits A alone
  assert.deepEqual(out.trimmedSlots, ['B']);
});
