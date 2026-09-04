// The antagonist superset. design-architectures.md §3.6.
//
// Pairing is checked against blocks built to exercise the rule rather than
// against generated sessions alone: a rule that only ever sees the pairs the
// generator happens to produce is a rule nobody has tested the edges of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairAntagonists, estimateMinutes } from '../js/generator.js';

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

// --------------------------------------------------------------------------
// Pricing. design-architectures.md §3.6.3.
// --------------------------------------------------------------------------

// Same two blocks, paired and unpaired. Everything except rest is identical,
// so the difference must be exactly the rest arithmetic in §3.6.3.
const P1 = { slot: 'A', role: 'primary compound', mode: 'reps', pattern: 'push-h',
             exerciseId: 'a', sets: 3, reps: 10, restSec: 90 };
const P2 = { slot: 'B', role: 'accessory', mode: 'reps', pattern: 'pull-h',
             exerciseId: 'b', sets: 3, reps: 10, restSec: 60 };

test('pairing removes one rest per round and keeps every second of work', () => {
  const straight = estimateMinutes([P1, P2]);
  const paired = estimateMinutes([
    { ...P1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...P2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  // straight rest: 3x90 + 3x60 = 450 s. paired rest: 3 x max(90,60) = 270 s.
  // Difference is exactly 180 s = 3 min.
  assert.equal(straight - paired, 3);
});

test('the round rest is the LONGER of the two, never the shorter', () => {
  const paired = estimateMinutes([
    { ...P1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...P2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  const ifShorter = estimateMinutes([
    { ...P1, restSec: 60, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...P2, restSec: 60, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  assert.ok(paired > ifShorter,
    'taking the shorter rest would invent a recovery saving the source does not describe');
});

test('unequal sets: only the common rounds are paired, the tail runs straight', () => {
  const four = { ...P1, sets: 4 };
  const two = { ...P2, sets: 2 };
  const straight = estimateMinutes([four, two]);
  const paired = estimateMinutes([
    { ...four, group: 'S1', groupRole: 'A1', groupRounds: 2 },
    { ...two, group: 'S1', groupRole: 'A2', groupRounds: 2 }
  ]);
  // straight rest: 4x90 + 2x60 = 480. paired: 2x90 (rounds) + 2x90 (A1 tail)
  // + 0 (A2 has no tail) = 360. Difference 120 s = 2 min.
  assert.equal(straight - paired, 2);
});

// A2 is whichever block comes second in slot order, NOT whichever is shorter,
// so the leftover tail can sit on either side. Every fixture above happened to
// put the longer block first, which left the A2 tail term untested -- a mutant
// that dropped it survived the whole file.
test('the leftover tail is charged whichever side it falls on', () => {
  const short = { ...P1, sets: 2 };
  const long = { ...P2, sets: 4 };
  const straight = estimateMinutes([short, long]);
  const paired = estimateMinutes([
    { ...short, group: 'S1', groupRole: 'A1', groupRounds: 2 },
    { ...long, group: 'S1', groupRole: 'A2', groupRounds: 2 }
  ]);
  // straight rest: 2x90 + 4x60 = 420. paired: 2x90 (rounds) + 0 (A1 tail)
  // + 2x60 (A2 tail) = 300. Difference 120 s = 2 min.
  assert.equal(straight - paired, 2);
});

test('a pair is priced once, not once per member', () => {
  const paired = estimateMinutes([
    { ...P1, group: 'S1', groupRole: 'A1', groupRounds: 3 },
    { ...P2, group: 'S1', groupRole: 'A2', groupRounds: 3 }
  ]);
  const single = estimateMinutes([P1]);
  assert.ok(paired < single * 2 + 5, `pair priced at ${paired} min looks doubled`);
});

test('an unpaired block is priced exactly as it was before', () => {
  assert.equal(estimateMinutes([P1]), estimateMinutes([{ ...P1, group: undefined }]));
});

test('a half-pair is charged as the straight block it is, not mispriced', () => {
  // A group with one member is a bug elsewhere; estimateMinutes must not
  // compound it by returning NaN or double-charging.
  const orphan = estimateMinutes([{ ...P1, group: 'S1', groupRole: 'A1', groupRounds: 3 }]);
  assert.equal(orphan, estimateMinutes([P1]));
});
