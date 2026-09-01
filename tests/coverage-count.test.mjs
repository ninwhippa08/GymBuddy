// design §4.4: the exercise count is a residual of coverage debt and time,
// not the hardcoded 4 or 5 that spec.md §10 item 4 calls "this document
// citing itself". plan-07.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_TYPES, PHASE_1_DAY_TYPES } from '../js/templates.js';
import { patternDebt, weeklySetTarget } from '../js/generator.js';

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
