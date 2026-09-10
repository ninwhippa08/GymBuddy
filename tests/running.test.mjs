// The running prep block and the four running templates.
// design-running-programming.md §5-6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREP_BLOCK, TEMPLATES } from '../js/templates.js';
import { eligibleFor, generate } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const pool = slot => eligibleFor(slot, LIB, { venue: 'outdoor' }).map(e => e.id);

test('the running prep has five stages in order', () => {
  const stages = PREP_BLOCK.running.map(s => s.slot);
  assert.deepEqual(stages, ['P1', 'P2', 'P3', 'P4', 'P5']);
});

// P3 is RAMP's Activate, separated back out of mobilise on 2026-09-07. The
// stage exists to carry balance work and must draw nothing else -- a drill or
// a stretch reaching it would mean the modality filter is not biting.
// design-library-expansion.md §22.
test('stage 3 draws balance work and only balance work', () => {
  const ids = pool(PREP_BLOCK.running[2]);
  assert.ok(ids.length > 0, 'the balance stage can draw nothing');
  assert.ok(ids.includes('single-leg-balance'));
  for (const id of ids) {
    assert.equal(LIB.find(e => e.id === id).pattern, 'balance',
      `${id} reached the balance stage without being balance work`);
  }
});

test('stage 2 reaches only hip, knee and ankle drills', () => {
  const ids = pool(PREP_BLOCK.running[1]);
  assert.ok(ids.length >= 10, `only ${ids.length} drills available`);
  for (const id of ['thread-the-needle', 'banded-shoulder-dislocate',
                    'shoulder-cars', 'scapular-wall-slide']) {
    assert.ok(!ids.includes(id), `${id} must not appear in a running warm-up`);
  }
});

test('stage 4 draws drills and agility, never a maximal sprint', () => {
  const ids = pool(PREP_BLOCK.running[3]);
  assert.ok(ids.includes('a-skip'));
  assert.ok(ids.includes('carioca'));
  assert.ok(!ids.includes('acceleration-sprint'),
    'a maximal sprint is not warm-up work');
});

test('stage 5 potentiates submaximally only', () => {
  const ids = pool(PREP_BLOCK.running[4]);
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
  // Index 1 since 2026-09-09: the start slot went in at the front. Indexing a
  // template by position is exactly the fixture-dependence design-equipment-
  // and-swap.md §12.2 warns about, so both slots are named here rather than
  // one being reached by number and trusted.
  const maximal = TEMPLATES.sprint.find(s => s.role === 'maximal sprints');
  const ids = pool(maximal);
  assert.ok(ids.includes('acceleration-sprint'));
  assert.ok(!ids.includes('build-up-run'), 'a build-up is not the hard work');
  assert.ok(!ids.includes('flying-run'),
    'flying runs need measured ground and stay opt-in');
});

// ADDED 2026-09-09. The three starts existed in the library and NO SLOT
// ANYWHERE admitted an accessory-tier maximal sprint, so none had ever been
// prescribed. design-library-expansion.md §25.
test('the sprint day has a slot that reaches the starts', () => {
  const starts = TEMPLATES.sprint.find(s => s.role === 'starts and acceleration');
  assert.ok(starts, 'the sprint day lost its start slot');
  assert.equal(starts.optional, false,
    'an optional start slot is how the warm-up stages went undelivered');
  assert.deepEqual(pool(starts).sort(),
    ['falling-start', 'half-kneeling-start', 'lateral-crossover-start',
     'lateral-half-kneeling-start', 'push-up-start', 'rolling-start',
     'two-point-start']);
});

// The gate that was a comment rather than a fact until 2026-09-09: it lived on
// the ENTRY, so the slot filled with an ordinary primary sprint on 100% of
// sessions instead of emptying. design-library-expansion.md §25.
test('the opt-in flying-run slot is gated on the SLOT, not on its pool', () => {
  const optIn = TEMPLATES.sprint.find(s => /opt-in/.test(s.role || ''));
  assert.ok(optIn, 'the opt-in slot disappeared');
  assert.equal(optIn.requiresMeasuredGround, true,
    'without the flag on the slot, it fills with whatever else matches its tier');
});

// The property, not the identity of the winner. A sprint session must never
// contain a start slot and a maximal slot holding the same movement, and the
// day must actually deliver the starts.
test('every sprint session delivers a start, and never twice the same sprint', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = generate({ library: LIB, dayType: 'sprint', seed, now: 1e12 });
    const main = s.blocks.filter(b => b.slot && !/^[PM]/.test(b.slot));
    const starts = main.filter(b => b.role === 'starts and acceleration');
    assert.equal(starts.length, 1, `seed ${seed} delivered ${starts.length} start blocks`);
    const ids = main.map(b => b.exerciseId);
    assert.equal(new Set(ids).size, ids.length,
      `seed ${seed} prescribed the same sprint twice: ${ids.join(', ')}`);
    assert.ok(!ids.includes('flying-run'), `seed ${seed} drew an opt-in flying run`);
  }
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
