// The antagonist superset. design-architectures.md §3.6.
//
// Pairing is checked against blocks built to exercise the rule rather than
// against generated sessions alone: a rule that only ever sees the pairs the
// generator happens to produce is a rule nobody has tested the edges of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairAntagonists } from '../js/generator.js';

const blk = (over = {}) => ({
  slot: 'A', role: 'primary compound', mode: 'reps',
  pattern: 'push-h', exerciseId: 'x', sets: 3, reps: 10, restSec: 90, ...over
});

test('a non-superset architecture is left exactly alone', () => {
  const blocks = [blk(), blk({ slot: 'B', pattern: 'pull-h' })];
  assert.equal(pairAntagonists(blocks, 'straight'), blocks);
  assert.equal(pairAntagonists(blocks, 'ladder'), blocks);
});

test('push-h pairs with pull-h, and push-v with pull-v', () => {
  const out = pairAntagonists(
    [blk({ pattern: 'push-h' }), blk({ slot: 'B', pattern: 'pull-h' })],
    'antagonist-superset');
  assert.equal(out[0].group, 'S1');
  assert.equal(out[0].groupRole, 'A1');
  assert.equal(out[1].group, 'S1');
  assert.equal(out[1].groupRole, 'A2');

  const vert = pairAntagonists(
    [blk({ pattern: 'push-v' }), blk({ slot: 'B', pattern: 'pull-v' })],
    'antagonist-superset');
  assert.equal(vert[0].group, 'S1');
});

test('cross-plane and squat/hinge do NOT pair -- §3.6.2 declined them', () => {
  for (const [a, b] of [['push-h', 'pull-v'], ['push-v', 'pull-h'],
                        ['squat', 'hinge'], ['push-h', 'push-h'],
                        ['lunge', 'carry']]) {
    const out = pairAntagonists(
      [blk({ pattern: a }), blk({ slot: 'B', pattern: b })],
      'antagonist-superset');
    assert.equal(out[0].group, undefined, `${a} must not pair with ${b}`);
    assert.equal(out[1].group, undefined, `${b} must not pair with ${a}`);
  }
});

test('groupRounds is the SMALLER set count, carried on both members', () => {
  const out = pairAntagonists(
    [blk({ sets: 4 }), blk({ slot: 'B', pattern: 'pull-h', sets: 2 })],
    'antagonist-superset');
  assert.equal(out[0].groupRounds, 2);
  assert.equal(out[1].groupRounds, 2);
});

test('only main work pairs -- core and mobility never do', () => {
  const out = pairAntagonists([
    blk({ role: 'core', mode: 'reps', pattern: 'push-h' }),
    blk({ slot: 'B', role: 'core', mode: 'reps', pattern: 'pull-h' })
  ], 'antagonist-superset');
  assert.equal(out[0].group, undefined);
});

test('a block joins at most one pair', () => {
  const out = pairAntagonists([
    blk({ slot: 'A', pattern: 'push-h' }),
    blk({ slot: 'B', pattern: 'pull-h' }),
    blk({ slot: 'C', pattern: 'pull-h' })
  ], 'antagonist-superset');
  assert.equal(out[0].group, 'S1');
  assert.equal(out[1].group, 'S1');
  assert.equal(out[2].group, undefined, 'C had no partner left');
});

// The A2 side of the marker matters as much as the A1 side: without it a block
// already used as a partner stays eligible and gets re-paired under a SECOND
// group id, silently overwriting the first. The three-block case above cannot
// see that -- its leftover is the same pattern as the partner, so no second
// pair was ever possible. This one puts a legal partner after the pair.
test('a block already used as a partner is not re-paired', () => {
  const out = pairAntagonists([
    blk({ slot: 'A', pattern: 'push-h' }),
    blk({ slot: 'B', pattern: 'pull-h' }),
    blk({ slot: 'C', pattern: 'push-h' })
  ], 'antagonist-superset');
  assert.equal(out[0].group, 'S1');
  assert.equal(out[1].group, 'S1', 'B must stay in the pair it already joined');
  assert.equal(out[1].groupRole, 'A2');
  assert.equal(out[2].group, undefined, 'C had no free partner');
});

test('two independent pairs get two group ids', () => {
  const out = pairAntagonists([
    blk({ slot: 'A', pattern: 'push-h' }),
    blk({ slot: 'B', pattern: 'pull-h' }),
    blk({ slot: 'C', pattern: 'push-v' }),
    blk({ slot: 'D', pattern: 'pull-v' })
  ], 'antagonist-superset');
  assert.deepEqual(out.map(b => b.group), ['S1', 'S1', 'S2', 'S2']);
});

test('the input blocks are not mutated', () => {
  const blocks = [blk({ pattern: 'push-h' }), blk({ slot: 'B', pattern: 'pull-h' })];
  pairAntagonists(blocks, 'antagonist-superset');
  assert.equal(blocks[0].group, undefined);
});
