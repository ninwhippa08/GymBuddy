// Running is programmed from accumulated lifting load, not requested.
// design-running-programming.md §7.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chronicBoost } from '../js/generator.js';

const state = over => ({
  chronicLoad: 0, gymShare: 0, weeksSinceEasyWeek: 0, ...over
});

test('a lifting-dominated month boosts the easy and interval days', () => {
  const s = state({ chronicLoad: 120, gymShare: 0.9 });
  assert.ok(chronicBoost('aerobic-steady', s) > 1);
  assert.ok(chronicBoost('interval', s) > 1);
});

test('it never boosts the high-CNS days', () => {
  // Prescribing sprints as the answer to accumulated fatigue is backwards.
  const s = state({ chronicLoad: 120, gymShare: 0.9, weeksSinceEasyWeek: 6 });
  assert.equal(chronicBoost('sprint', s), 1);
  assert.equal(chronicBoost('plyometric', s), 1);
  assert.equal(chronicBoost('max-strength', s), 1);
});

test('a balanced month changes nothing', () => {
  assert.equal(chronicBoost('aerobic-steady', state({ gymShare: 0.4 })), 1);
});

test('four weeks without a lighter week boosts harder than gym share alone', () => {
  const shareOnly = chronicBoost('aerobic-steady',
    state({ chronicLoad: 120, gymShare: 0.9 }));
  const andWeeks = chronicBoost('aerobic-steady',
    state({ chronicLoad: 120, gymShare: 0.9, weeksSinceEasyWeek: 4 }));
  assert.ok(andWeeks > shareOnly);
});

test('an empty history boosts nothing', () => {
  // A two-week gap lowers chronic load, which correctly makes lifting more
  // attractive rather than less. §7.3.
  assert.equal(chronicBoost('aerobic-steady', state()), 1);
});

test('the boost is capped', () => {
  const extreme = state({ chronicLoad: 9999, gymShare: 1, weeksSinceEasyWeek: 52 });
  assert.ok(chronicBoost('aerobic-steady', extreme) <= 3,
    'an unbounded boost would make running the only proposal forever');
});
