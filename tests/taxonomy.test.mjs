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
    'hill-sprint', 'resisted-sprint', 'sled-push', 'three-point-start'
  ]);
});

test('technique drills are their own family', () => {
  assert.deepEqual(idsWithPattern('sprint-drill'), [
    'a-march', 'a-skip', 'ankling', 'b-skip', 'fast-leg-drill',
    'high-knees', 'power-skip', 'straight-leg-bound', 'wall-drill'
  ]);
});

test('multidirectional prep is its own family', () => {
  assert.deepEqual(idsWithPattern('agility'),
    ['backpedal', 'carioca', 'lateral-shuffle']);
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
    'backward-walk', 'incline-walk', 'ruck-march', 'sled-drag', 'sled-march'
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
