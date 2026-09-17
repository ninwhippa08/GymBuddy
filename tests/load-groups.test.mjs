// tests/load-groups.test.mjs
// Reps, weight and pairing by what the exercise is.
// docs/superpowers/specs/2026-09-16-rep-method-design.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repMax, loadGroupFor, isHeavyLower } from '../js/generator.js';
import { REP_TO_PCT, LOAD_GROUPS, VOLUME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = id => {
  const e = LIB.find(x => x.id === id);
  assert.ok(e, `${id} is not in the library`);
  return e;
};

test('repMax reads the chart on every row it has', () => {
  for (const [n, pct] of Object.entries(REP_TO_PCT)) {
    assert.equal(repMax(Number(n)), pct, `row ${n}`);
  }
});

test('repMax interpolates the row the chart skips', () => {
  assert.ok(Math.abs(repMax(11) - 0.725) < 1e-9, `got ${repMax(11)}`);
});

test('repMax falls as reps rise, all the way past the chart', () => {
  for (let n = 2; n <= 20; n++) {
    assert.ok(repMax(n) < repMax(n - 1), `repMax(${n}) ${repMax(n)} >= repMax(${n - 1})`);
  }
});

test('the groups carry the doses the athlete approved', () => {
  assert.deepEqual([...LOAD_GROUPS.heavy.reps], [6, 8]);
  assert.deepEqual([...LOAD_GROUPS.heavy.rir], [2, 3]);
  assert.deepEqual([...LOAD_GROUPS.compound.reps], [8, 12]);
  assert.deepEqual([...LOAD_GROUPS.compound.rir], [2, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.reps], [10, 15]);
  assert.deepEqual([...LOAD_GROUPS.light.rir], [1, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.restSec], [60, 90]);
  assert.deepEqual([...LOAD_GROUPS.heavy.restSec], [120, 180]);
  assert.deepEqual([...LOAD_GROUPS.compound.restSec], [120, 180]);
  assert.equal(VOLUME.SETS_PER_PATTERN_PER_SESSION, 10);
});

test('group membership on the spec\'s named samples', () => {
  const want = {
    'single-arm-lat-pulldown': 'light', 'tall-kneeling-cable-chop': 'light',
    'leg-press': 'light', 'dumbbell-bench-press': 'compound',
    'romanian-deadlift': 'compound', 'weighted-pull-up': 'compound',
    'pause-squat': 'heavy', deadlift: 'heavy', 'bench-press': 'heavy'
  };
  for (const [id, group] of Object.entries(want)) {
    assert.equal(loadGroupFor(byId(id)), group, id);
  }
});

test('an isolation slot doses whatever it draws as light', () => {
  assert.equal(loadGroupFor(byId('ab-wheel-rollout'), { modality: 'isolation' }), 'light');
  assert.equal(loadGroupFor(byId('ab-wheel-rollout')), 'compound');
});

test('heavy lower means a heavy squat or hinge, nothing else', () => {
  assert.equal(isHeavyLower(byId('deadlift')), true);
  assert.equal(isHeavyLower(byId('pause-squat')), true);
  assert.equal(isHeavyLower(byId('bench-press')), false, 'heavy, but not lower');
  assert.equal(isHeavyLower(byId('romanian-deadlift')), false, 'lower, but compound');
});
