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
