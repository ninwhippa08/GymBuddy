import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODALITIES, MOBILITY_DOSE, SESSION_ORDER, TIME, SORENESS_JOINTS, SORENESS_LEVELS
} from '../js/rules.js';
import { readFileSync } from 'node:fs';
import { eligibleFor } from '../js/generator.js';

test('the modality vocabulary is split and complete', () => {
  assert.ok(MODALITIES.includes('mobility-dynamic'));
  assert.ok(MODALITIES.includes('mobility-static'));
  assert.ok(!MODALITIES.includes('mobility'),
    'the pre-split value must not survive in the vocabulary');
});

test('prep leads the session order and static mobility still closes it', () => {
  assert.equal(SESSION_ORDER[0], 'prep');
  assert.equal(SESSION_ORDER[SESSION_ORDER.length - 1], 'mobility');
  assert.ok(SESSION_ORDER.indexOf('prep') < SESSION_ORDER.indexOf('max-strength'),
    'dynamic prep must precede the work it prepares for -- discrepancy 6');
});

test('the time budget matches design 5', () => {
  assert.equal(TIME.GYM_SESSION_TOTAL_MIN, 60);
  assert.equal(TIME.MAIN_WORK_MAX_MIN, 45);
  assert.equal(TIME.PREP_MIN, 3);
  assert.equal(TIME.COOLDOWN_MIN, 12);
  assert.equal(TIME.PREP_MIN + TIME.MAIN_WORK_MAX_MIN + TIME.COOLDOWN_MIN,
    TIME.GYM_SESSION_TOTAL_MIN, 'the three budgets must sum to the total');
  assert.equal(TIME.MOBILITY_CORE_MIN, undefined,
    'the withdrawn 25 min figure must be gone -- discrepancy 5');
});

test('every dose is an inclusive [lo, hi] pair inside its sourced range', () => {
  for (const [k, v] of Object.entries(MOBILITY_DOSE)) {
    assert.ok(Array.isArray(v) && v.length === 2, `${k} is not a pair`);
    assert.ok(v[0] <= v[1], `${k} is inverted`);
  }
  // ACSM: 10-30 s per hold, 2-4 repetitions per muscle group.
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SEC[0] >= 10);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SEC[1] <= 30);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SETS[0] >= 2);
  assert.ok(MOBILITY_DOSE.STATIC_HOLD_SETS[1] <= 4);
  // design 2.1: dynamic volume does not scale with available time.
  assert.deepEqual([...MOBILITY_DOSE.DYNAMIC_REPS], [10, 12]);
  assert.deepEqual([...MOBILITY_DOSE.DYNAMIC_DRILLS], [3, 4]);
});

test('a slot can require the joints it means to prepare', () => {
  const lib = [
    { id: 'hip-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['hip'], modalities: ['mobility-dynamic'], venue: 'either' },
    { id: 'shoulder-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['shoulder'], modalities: ['mobility-dynamic'], venue: 'either' }
  ];
  const slot = {
    tier: ['mobility'], patterns: ['mobility'], modality: 'mobility-dynamic',
    joints: ['hip', 'knee', 'ankle']
  };
  const got = eligibleFor(slot, lib, {}).map(e => e.id);
  assert.deepEqual(got, ['hip-drill']);
});

test('a slot with no joints filter still sees everything', () => {
  const lib = [
    { id: 'shoulder-drill', tier: 'mobility', pattern: 'mobility',
      joints: ['shoulder'], modalities: ['mobility-dynamic'], venue: 'either' }
  ];
  const slot = {
    tier: ['mobility'], patterns: ['mobility'], modality: 'mobility-dynamic'
  };
  assert.equal(eligibleFor(slot, lib, {}).length, 1);
});

// --------------------------------------------------------------------------
// The soreness body map. spec §4.1.
// --------------------------------------------------------------------------

const SORE_LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

test('every joint the library loads has a place on the map', () => {
  // The drift guard. A movement added later with an eleventh joint would
  // otherwise be unreachable by the map -- silently un-excludable, which for a
  // HURT joint is a safety claim the app would be failing to honour.
  const inLibrary = new Set();
  for (const e of SORE_LIB) for (const j of (e.joints || [])) inLibrary.add(j);
  assert.deepEqual([...inLibrary].sort(), [...SORENESS_JOINTS].sort());
});

test('the map offers exactly the two severities the engine understands', () => {
  // `hurt` excludes in eligibleFor, `sore` downweights. A third value would be
  // silently ignored by both.
  assert.deepEqual([...SORENESS_LEVELS], ['sore', 'hurt']);
});

test('the joints are ordered head to toe, not alphabetically', () => {
  // The figure is read as a body, so the constant carries the body's order.
  assert.equal(SORENESS_JOINTS[0], 'neck');
  assert.equal(SORENESS_JOINTS[SORENESS_JOINTS.length - 1], 'ankle');
});
