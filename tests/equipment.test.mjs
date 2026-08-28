// Equipment constraints. design-equipment-and-swap.md §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eligibleFor, generate, requiredUnfilled, offerableEquipment
} from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { NON_NEGOTIABLE_EQUIPMENT, ALL_TIERS } from '../js/rules.js';

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

// --------------------------------------------------------------------------
// The constraint through generate(). design §3.3.
// --------------------------------------------------------------------------

const gen = (excludeEquipment, dayType = 'max-strength', seed = 42) =>
  generate({ library: LIB, dayType, seed, excludeEquipment,
             profile: { venue: 'gym' } });

test('a constrained session contains none of the excluded equipment', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell']).blocks) {
    const gear = byId.get(b.exerciseId).equipment || [];
    assert.ok(!gear.includes('barbell'),
      `${b.exerciseId} needs a barbell and should not be here`);
  }
});

test('the session records the constraint it was built under', () => {
  assert.deepEqual(gen(['barbell', 'rack']).excludeEquipment, ['barbell', 'rack']);
  assert.deepEqual(gen([]).excludeEquipment, []);
});

test('a buildable day reports no required slot unfilled', () => {
  assert.deepEqual(requiredUnfilled(gen(['barbell'])), []);
});

test('unfilled records optionality, not just the letter', () => {
  for (const u of gen(['barbell', 'rack', 'plates']).unfilled) {
    assert.equal(typeof u.slot, 'string');
    assert.equal(typeof u.optional, 'boolean');
  }
});

// --------------------------------------------------------------------------
// Tier relaxation. design §4.2 -- the athlete rejected the premise of open
// question 4: "there should also be power moves without barbells."
// --------------------------------------------------------------------------

test('the three main-work tiers are named once, in rules', () => {
  assert.deepEqual([...ALL_TIERS], ['primary', 'secondary', 'accessory']);
});

test('a barbell-free power day finds the movements tier was hiding', () => {
  // Bar, rack AND plates: the strict primary pool for this slot is EMPTY, so
  // this can only pass through relaxation. Excluding the barbell alone leaves
  // trap-bar-deadlift and would pass without any implementation at all.
  const olympic = gen(['barbell', 'rack', 'plates'], 'power', 7).blocks
    .find(b => b.role === 'Olympic derivative');
  assert.ok(olympic, 'the Olympic derivative slot was dropped, not relaxed');
  assert.ok(
    ['kettlebell-swing', 'dumbbell-snatch', 'kettlebell-clean']
      .includes(olympic.exerciseId),
    `unexpected fill: ${olympic.exerciseId}`);
  assert.ok(olympic.tierRelaxed, 'filled by relaxation but not flagged');
});

test('relaxation widens tier and nothing else', () => {
  // A relaxed max-strength slot must not start returning mobility drills.
  // Only `tier` widens; patterns, modality and zone are what a slot is FOR.
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell', 'rack', 'plates'], 'max-strength', 3).blocks
                    .filter(x => x.tierRelaxed)) {
    const mods = byId.get(b.exerciseId).modalities || [];
    assert.ok(mods.includes('max-strength') || mods.includes('hypertrophy'),
      `${b.exerciseId} is not strength work`);
  }
});

test('a relaxed block is flagged, so the card can say so', () => {
  assert.ok(gen(['barbell', 'rack', 'plates'], 'max-strength', 3)
    .blocks.some(b => b.tierRelaxed),
    'nothing was flagged, so the substitution would be silent');
});

test('an unconstrained session relaxes nothing', () => {
  assert.ok(!gen([]).blocks.some(b => b.tierRelaxed));
});

test('the control lists only what this session asks for', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  const s = gen([]);
  const used = new Set(s.blocks.flatMap(b => byId.get(b.exerciseId).equipment || []));
  for (const q of offerableEquipment(s.blocks, LIB)) {
    assert.ok(used.has(q), `${q} is not in this session`);
  }
});

test('the control never offers the non-negotiables', () => {
  const offered = offerableEquipment(gen([]).blocks, LIB);
  for (const q of NON_NEGOTIABLE_EQUIPMENT) {
    assert.ok(!offered.includes(q), `${q} must never be offerable`);
  }
});

test('the control stays short enough to read on a phone', () => {
  // Measured across nine sessions while designing: 4 to 8. design §3.2.
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 5; seed++) {
      const n = offerableEquipment(gen([], dt, seed * 1009).blocks, LIB).length;
      assert.ok(n >= 1 && n <= 10, `${dt}/${seed} offered ${n} items`);
    }
  }
});
