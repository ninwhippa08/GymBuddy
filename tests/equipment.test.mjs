// Equipment constraints. design-equipment-and-swap.md §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligibleFor } from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { NON_NEGOTIABLE_EQUIPMENT } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const MAIN_LIFT = TEMPLATES['max-strength'][0];
const ids = (slot, excludeEquipment = []) =>
  eligibleFor(slot, LIB, { venue: 'gym', excludeEquipment }).map(e => e.id);

test('an empty constraint changes nothing', () => {
  assert.deepEqual(ids(MAIN_LIFT, []), ids(MAIN_LIFT));
});

test('excluding the barbell removes the back squat', () => {
  assert.ok(ids(MAIN_LIFT).includes('back-squat'));
  assert.ok(!ids(MAIN_LIFT, ['barbell']).includes('back-squat'));
});

test('equipment is a conjunction -- losing any one item rules an entry out', () => {
  // Derived, not written down: an earlier draft of this test asserted that
  // back-squat needs barbell AND rack AND plates. It needs the first two, and
  // the test failed on a claim about the library rather than about the filter.
  const squat = LIB.find(e => e.id === 'back-squat');
  assert.ok(squat.equipment.length > 1, 'this test needs a multi-item entry');
  for (const gear of squat.equipment) {
    assert.ok(!ids(MAIN_LIFT, [gear]).includes('back-squat'),
      `excluding ${gear} left the back squat in`);
  }
});

test('excluding one item does not remove entries that never needed it', () => {
  assert.ok(ids(MAIN_LIFT, ['kettlebell']).includes('back-squat'));
});

test('the non-negotiables are the three that cannot be absent', () => {
  assert.deepEqual([...NON_NEGOTIABLE_EQUIPMENT].sort(),
    ['bodyweight', 'open-space', 'wall']);
});
