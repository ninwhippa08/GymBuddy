// The weekly volume target is per GOAL, not one number for the whole app.
// ~10 sets/muscle/week is a HYPERTROPHY figure (Pelland et al. 2025 put
// strength's efficient band at 1-4, with 5+ adding no consistent detectable
// strength). Applying 10 to a max-strength day asked for ~2.5x the volume that
// buys anything. basis §2, design §8 question 6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillSlot, weeklySetTarget, makeRng } from '../js/generator.js';
import { VOLUME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

test('hypertrophy keeps the sourced ~10 sets per week', () => {
  assert.equal(weeklySetTarget('hypertrophy'), 10);
});

test('max-strength is dosed at the top of its efficient band, not hypertrophy volume', () => {
  assert.equal(weeklySetTarget('max-strength'), 4);
});

test('power is bounded at or below strength', () => {
  assert.ok(weeklySetTarget('power') <= weeklySetTarget('max-strength'));
});

test('a day type with no resistance-volume literature falls back to the default', () => {
  // Running days barely reach patternSets at all; changing them would be a
  // claim the sources do not make.
  assert.equal(weeklySetTarget('aerobic-steady'), VOLUME.SETS_PER_PATTERN_PER_WEEK.DEFAULT);
  assert.equal(weeklySetTarget(undefined), VOLUME.SETS_PER_PATTERN_PER_WEEK.DEFAULT);
});

// The target is not decoration: it decides how hard an already-trained pattern
// is pushed down when the next exercise is chosen.
function pickShare(dayType, patternSets, seeds = 400) {
  const slot = { tier: ['primary'], patterns: ['squat', 'hinge'], mode: 'load' };
  let squat = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const e = fillSlot(slot, LIB, {
      soreness: {}, banned: [], venue: 'gym', excludeIds: new Set(),
      excludeEquipment: [], dayType,
      state: { patternSets, recentExerciseIds: new Set() }
    }, makeRng(seed));
    if (e && e.pattern === 'squat') squat++;
  }
  return squat;
}

test('an over-trained pattern is pushed down harder on a strength day than a hypertrophy day', () => {
  // Identical slot, library, state and seeds -- only the day type differs. With
  // one shared target the two are the SAME number by construction.
  const used = { squat: 8 };
  const onStrength = pickShare('max-strength', used);
  const onHypertrophy = pickShare('hypertrophy', used);
  assert.ok(onStrength < onHypertrophy,
    `squat picked ${onStrength} times on max-strength vs ${onHypertrophy} on hypertrophy ` +
    `-- the day type is not reaching the weighting`);
});
