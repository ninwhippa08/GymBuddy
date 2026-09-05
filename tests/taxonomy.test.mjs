// The taxonomy guard. A pattern is a movement family; a bucket holding two
// families is how a backward walk became a 20-minute steady run.
// design-running-programming.md §4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const byId = Object.fromEntries(LIB.map(e => [e.id, e]));
const idsWithPattern = p => LIB.filter(e => e.pattern === p).map(e => e.id).sort();

test('the sprint bucket holds only maximal-effort running', () => {
  assert.deepEqual(idsWithPattern('sprint'), [
    'acceleration-sprint', 'build-up-run', 'falling-start', 'flying-run',
    'half-kneeling-start', 'hill-sprint', 'lateral-half-kneeling-start',
    'resisted-sprint', 'sled-push', 'three-point-start'
  ]);
});

test('technique drills are their own family', () => {
  assert.deepEqual(idsWithPattern('sprint-drill'), [
    'a-march', 'a-skip', 'a-skip-with-overhead-reach', 'ankling', 'b-skip',
    'butt-kicks', 'fast-leg-drill', 'high-knee-switches', 'high-knees',
    'power-skip', 'power-skip-for-distance', 'standing-knee-drive',
    'straight-leg-bound', 'straight-leg-skip', 'straight-leg-walk', 'wall-drill'
  ]);
});

test('multidirectional prep is its own family', () => {
  assert.deepEqual(idsWithPattern('agility'), [
    'backpedal', 'backward-hurdle-walk', 'carioca', 'carioca-short-long',
    'crossover-run', 'forward-hurdle-walk', 'lateral-cross-behind-skip',
    'lateral-crossover-skip', 'lateral-shuffle', 'lateral-skip', 'low-shuffle',
    'mini-band-forward-walk', 'mini-band-lateral-walk', 'mini-band-skater-walk', 'open-up-run-to-stick', 'pro-agility-shuttle',
    'shuffle-with-arm-swing'
  ]);
});

test('the run bucket holds only unloaded running on feet', () => {
  assert.deepEqual(idsWithPattern('run'), [
    'easy-run', 'fartlek', 'run-interval', 'shuttle-run', 'stair-run',
    'tempo-run', 'trail-run', 'warmup-jog'
  ]);
});

test('ergometers and marches are not runs', () => {
  assert.deepEqual(idsWithPattern('erg'), ['assault-bike', 'rower']);
  assert.deepEqual(idsWithPattern('march'), [
    'backward-walk', 'incline-walk', 'lateral-sled-drag', 'ruck-march',
    'sled-drag', 'sled-march'
  ]);
});

test('jump-rope is a jump, not a run', () => {
  assert.equal(byId['jump-rope'].pattern, 'jump');
});

test('every sprint entry declares an effort class', () => {
  for (const e of LIB.filter(x => x.pattern === 'sprint')) {
    assert.ok(['submaximal', 'maximal'].includes(e.effortClass),
      `${e.id} has effortClass ${JSON.stringify(e.effortClass)}`);
  }
});

test('build-up run is the only submaximal sprint', () => {
  const sub = LIB.filter(e => e.effortClass === 'submaximal').map(e => e.id);
  assert.deepEqual(sub, ['build-up-run']);
});

test('interval work no longer claims to be steady-state', () => {
  // A prescribed easy run coming back as a fartlek was the second instance
  // of the bucket-conflation bug. design §4.5.
  for (const id of ['tempo-run', 'fartlek', 'stair-run']) {
    assert.ok(!byId[id].modalities.includes('aerobic-steady'),
      `${id} still carries aerobic-steady`);
  }
});

test('no exercise is left in a retired bucket', () => {
  const retired = LIB.filter(e => e.pattern === 'locomotion');
  assert.deepEqual(retired, [], 'locomotion was split and must be empty');
});

test('the warm-up jog exists and is cued like everything else', () => {
  const e = byId['warmup-jog'];
  assert.ok(e, 'warmup-jog is missing');
  assert.equal(e.pattern, 'run');
  assert.equal(e.tier, 'accessory');
  assert.ok(e.cues.length >= 3, 'needs at least three cues like the other 235');
});

// --------------------------------------------------------------------------
// Knee-dominant single-leg work. Issue #2.
// --------------------------------------------------------------------------

// The athlete asked for this one through the app's Add-a-move panel, having
// looked for it and not found it: "hold dumbell in hand, slowly squat until you
// sit on a bench at knee level. Then get up". Nothing in the library was that
// movement -- step-up and the split squats all keep a second foot down, and the
// only other unilateral knee-dominant entry is the cossack squat, which is a
// lateral movement. It is the one true single-leg squat here.
test('the single-leg box squat exists and is filed as unilateral knee work', () => {
  const e = byId['single-leg-box-squat'];
  assert.ok(e, 'single-leg-box-squat is missing');
  assert.equal(e.pattern, 'lunge');
  assert.equal(e.tier, 'accessory');
  assert.equal(e.unilateral, true);
  // He sits to the bench rather than stopping short of it, so the bench is
  // load-bearing equipment and not a suggestion -- without one there is no
  // depth target and the movement is a different, harder exercise.
  assert.deepEqual([...e.equipment].sort(), ['bench', 'dumbbell']);
  assert.ok((e.joints || []).includes('ankle'),
    'a single-leg squat is limited by ankle dorsiflexion before anything else');
  assert.ok(e.cues && e.cues.length >= 3, 'needs cues like the other 236');
});

// The classification above is not a preference, it is the rule the two families
// have always followed: `squat` is where both feet drive and `lunge` is where
// one does. Every one of the 15 squat entries is bilateral and every one of the
// 10 lunge entries is unilateral, and filing a single-leg movement under
// `squat` would have let it be drawn as a squat-pattern accessory and counted
// against back-squat volume. A ratchet, in the manner of the cued-pool guard:
// it passes today, and it is what stops the next authoring pass breaking it.
test('the squat family is bilateral and the lunge family is not', () => {
  for (const e of LIB.filter(x => x.pattern === 'squat')) {
    assert.equal(e.unilateral, false,
      `${e.id} is a unilateral movement filed under squat`);
  }
  for (const e of LIB.filter(x => x.pattern === 'lunge')) {
    assert.equal(e.unilateral, true,
      `${e.id} is a bilateral movement filed under lunge`);
  }
});
