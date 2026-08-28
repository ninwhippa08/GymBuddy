// The running prep block and the four running templates.
// design-running-programming.md §5-6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREP_BLOCK, TEMPLATES } from '../js/templates.js';
import { eligibleFor } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const pool = slot => eligibleFor(slot, LIB, { venue: 'outdoor' }).map(e => e.id);

test('the running prep has four stages in order', () => {
  const stages = PREP_BLOCK.running.map(s => s.slot);
  assert.deepEqual(stages, ['P1', 'P2', 'P3', 'P4']);
});

test('stage 2 reaches only hip, knee and ankle drills', () => {
  const ids = pool(PREP_BLOCK.running[1]);
  assert.ok(ids.length >= 10, `only ${ids.length} drills available`);
  for (const id of ['thread-the-needle', 'banded-shoulder-dislocate',
                    'shoulder-cars', 'scapular-wall-slide']) {
    assert.ok(!ids.includes(id), `${id} must not appear in a running warm-up`);
  }
});

test('stage 3 draws drills and agility, never a maximal sprint', () => {
  const ids = pool(PREP_BLOCK.running[2]);
  assert.ok(ids.includes('a-skip'));
  assert.ok(ids.includes('carioca'));
  assert.ok(!ids.includes('acceleration-sprint'),
    'a maximal sprint is not warm-up work');
});

test('stage 4 potentiates submaximally only', () => {
  const ids = pool(PREP_BLOCK.running[3]);
  assert.deepEqual(ids, ['build-up-run'],
    'only the build-up run is submaximal');
});

test('every prep stage declares a count, as buildPools requires', () => {
  for (const s of PREP_BLOCK.running) {
    assert.ok(Array.isArray(s.count) && s.count.length === 2,
      `stage ${s.slot} has no [min,max] count`);
  }
});

test('the dynamic drill dose is unchanged from the sourced value', () => {
  // js/rules.js:255 -- dynamic stretching volume must not scale with
  // available time. [corroborated]
  assert.deepEqual(PREP_BLOCK.running[1].count, [3, 4]);
});

test('all four running day types exist', () => {
  for (const dt of ['aerobic-steady', 'interval', 'sprint', 'plyometric']) {
    assert.ok(TEMPLATES[dt], `${dt} has no template`);
  }
});

test('an easy run cannot come back as a fartlek or a backward walk', () => {
  const ids = pool(TEMPLATES['aerobic-steady'][0]);
  for (const bad of ['fartlek', 'tempo-run', 'stair-run',
                     'backward-walk', 'ruck-march', 'sled-drag']) {
    assert.ok(!ids.includes(bad), `${bad} is not an easy run`);
  }
  assert.ok(ids.includes('easy-run') && ids.includes('trail-run'));
});

test('easy-day strides are submaximal only', () => {
  const strides = TEMPLATES['aerobic-steady'][1];
  assert.equal(strides.effortClass, 'submaximal');
  assert.deepEqual(pool(strides), ['build-up-run']);
});

test('the sprint day draws maximal efforts only', () => {
  const ids = pool(TEMPLATES.sprint[0]);
  assert.ok(ids.includes('acceleration-sprint'));
  assert.ok(!ids.includes('build-up-run'), 'a build-up is not the hard work');
  assert.ok(!ids.includes('flying-run'),
    'flying runs need measured ground and stay opt-in');
});

test('the interval day never draws a maximal sprint', () => {
  const ids = pool(TEMPLATES.interval[0]);
  assert.ok(ids.includes('run-interval'));
  assert.ok(!ids.includes('acceleration-sprint'));
});

test('the plyometric day draws jumps', () => {
  const ids = pool(TEMPLATES.plyometric[0]);
  assert.ok(ids.length >= 5, `only ${ids.length} jumps available`);
});

// The third instance of the bucket-conflation bug: an exercise landing in a
// slot whose SHAPE it does not fit. The first two were a prescribed easy run
// coming back as a fartlek (design §3). This one put "Running Intervals" in
// the continuous tempo slot and prescribed a stair run as 7 x 60 s.
// design-running-programming.md §6.2.
test('the interval slot draws only efforts that hold a prescribed 60-90 s', () => {
  const ids = pool(TEMPLATES.interval[0]);
  assert.ok(ids.includes('run-interval'));
  assert.ok(ids.includes('shuttle-run'));
  for (const bad of ['stair-run', 'fartlek', 'tempo-run']) {
    assert.ok(!ids.includes(bad),
      `${bad} cannot be held hard for a prescribed 60-90 s`);
  }
});

test('the tempo finisher draws only one continuous effort', () => {
  const ids = pool(TEMPLATES.interval[1]);
  assert.ok(ids.includes('tempo-run'));
  assert.ok(ids.includes('fartlek'));
  assert.ok(ids.includes('stair-run'),
    'stairs are prescribable in minutes without knowing the staircase');
  for (const bad of ['run-interval', 'shuttle-run']) {
    assert.ok(!ids.includes(bad),
      `${bad} is interval work, not one continuous effort`);
  }
});
