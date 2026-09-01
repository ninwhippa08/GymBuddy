// design §4.4: the exercise count is a residual of coverage debt and time,
// not the hardcoded 4 or 5 that spec.md §10 item 4 calls "this document
// citing itself". plan-07.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_TYPES, PHASE_1_DAY_TYPES } from '../js/templates.js';

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
