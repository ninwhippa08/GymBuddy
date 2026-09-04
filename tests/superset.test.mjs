// The antagonist superset. design-architectures.md §3.6.
//
// Pairing is checked against blocks built to exercise the rule rather than
// against generated sessions alone: a rule that only ever sees the pairs the
// generator happens to produce is a rule nobody has tested the edges of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pairAntagonists, estimateMinutes, groupAdjacent, generate,
  countsTowardVolume, swapBlock, makeRng
} from '../js/generator.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

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

// --------------------------------------------------------------------------
// Ordering. design-architectures.md §3.6.4.
// --------------------------------------------------------------------------

const ord = (slot, role) => ({
  slot, exerciseId: slot,
  group: role ? 'S1' : undefined, groupRole: role
});

test('A2 is pulled up to sit immediately after A1', () => {
  const out = groupAdjacent([ord('A', 'A1'), ord('B'), ord('C', 'A2'), ord('D')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'C', 'B', 'D']);
});

test('A1 leads even when A2 came first in the ordering', () => {
  const out = groupAdjacent([ord('C', 'A2'), ord('B'), ord('A', 'A1')]);
  assert.deepEqual(out.map(b => b.slot), ['B', 'A', 'C']);
});

// The mirror of the crossed-pair case, for the OTHER lookup: an A2 that sits
// after a different group's A1 must still defer to its own. A lead lookup that
// matched any A1 would see one already placed and stop deferring, stranding
// the A2 ahead of its partner.
test('an A2 defers to its own A1, not to whichever A1 came first', () => {
  const crossed = [
    { slot: 'B', group: 'S2', groupRole: 'A1' },
    { slot: 'C', group: 'S1', groupRole: 'A2' },
    { slot: 'A', group: 'S1', groupRole: 'A1' },
    { slot: 'D', group: 'S2', groupRole: 'A2' }
  ];
  assert.deepEqual(groupAdjacent(crossed).map(b => b.slot), ['B', 'D', 'A', 'C']);
});

test('ungrouped blocks keep their order', () => {
  const out = groupAdjacent([ord('A'), ord('B'), ord('C')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'B', 'C']);
});

test('every block survives, exactly once', () => {
  const input = [ord('A', 'A1'), ord('B'), ord('C', 'A2'), ord('D')];
  const out = groupAdjacent(input);
  assert.equal(out.length, input.length);
  assert.equal(new Set(out).size, input.length);
});

test('a half-pair is passed through rather than dropped', () => {
  const out = groupAdjacent([ord('A', 'A1'), ord('B')]);
  assert.deepEqual(out.map(b => b.slot), ['A', 'B']);
  const orphanA2 = groupAdjacent([ord('A'), ord('C', 'A2')]);
  assert.deepEqual(orphanA2.map(b => b.slot), ['A', 'C']);
});

test('two pairs are each made adjacent without interleaving', () => {
  const two = [
    { slot: 'A', group: 'S1', groupRole: 'A1' },
    { slot: 'B', group: 'S2', groupRole: 'A1' },
    { slot: 'C', group: 'S1', groupRole: 'A2' },
    { slot: 'D', group: 'S2', groupRole: 'A2' }
  ];
  assert.deepEqual(groupAdjacent(two).map(b => b.slot), ['A', 'C', 'B', 'D']);
});

// The fixture above cannot tell "find my partner" from "find any A2": its A2s
// happen to appear in the same order as its A1s, so both lookups agree. This
// one crosses them, and a partner lookup that ignored the group id would pair
// A with S2's half.
test('a pair is matched by group id, not by finding any A2', () => {
  const crossed = [
    { slot: 'A', group: 'S1', groupRole: 'A1' },
    { slot: 'B', group: 'S2', groupRole: 'A1' },
    { slot: 'C', group: 'S2', groupRole: 'A2' },
    { slot: 'D', group: 'S1', groupRole: 'A2' }
  ];
  assert.deepEqual(groupAdjacent(crossed).map(b => b.slot), ['A', 'D', 'B', 'C']);
});

// --------------------------------------------------------------------------
// The architecture, live. design-architectures.md §3.6.4.
// --------------------------------------------------------------------------

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const hyper = seed => generate({ library: LIB, dayType: 'hypertrophy', seed, now: 1e12 });

const ANTAGONIST = {
  'push-h': 'pull-h', 'pull-h': 'push-h', 'push-v': 'pull-v', 'pull-v': 'push-v'
};

test('supersets actually reach real sessions', () => {
  let supersetted = 0;
  for (let seed = 1; seed <= 500; seed++) {
    if (hyper(seed).blocks.some(b => b.group)) supersetted++;
  }
  assert.ok(supersetted > 0, 'no session in 500 carried a superset');
});

test('every pair in a real session is a legal antagonist pair', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const blocks = hyper(seed).blocks.filter(b => b.group);
    const byGroup = {};
    for (const b of blocks) (byGroup[b.group] = byGroup[b.group] || []).push(b);
    for (const [id, pair] of Object.entries(byGroup)) {
      assert.equal(pair.length, 2, `seed ${seed} group ${id} has ${pair.length} members`);
      const [a, b] = pair;
      assert.equal(ANTAGONIST[a.pattern], b.pattern, `seed ${seed}: ${a.pattern} + ${b.pattern}`);
      assert.equal(a.groupRounds, b.groupRounds, `seed ${seed}: rounds disagree`);
      assert.equal(a.groupRounds, Math.min(a.sets, b.sets), `seed ${seed}: wrong rounds`);
    }
  }
});

test('A1 sits immediately before A2 in the ordered session', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const blocks = hyper(seed).blocks;
    blocks.forEach((b, i) => {
      if (b.groupRole !== 'A1') return;
      const next = blocks[i + 1];
      assert.ok(next && next.group === b.group && next.groupRole === 'A2',
        `seed ${seed}: ${b.slot} is not followed by its partner`);
    });
  }
});

test('no day type other than hypertrophy is ever supersetted', () => {
  for (const dayType of PHASE_1_DAY_TYPES) {
    if (dayType === 'hypertrophy') continue;
    for (let seed = 1; seed <= 200; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      assert.ok(!s.blocks.some(b => b.group), `${dayType}/${seed} carried a group`);
    }
  }
});

// --------------------------------------------------------------------------
// The guarantees. design-architectures.md §3.6.4.
// --------------------------------------------------------------------------

// The straight counterpart of a supersetted session: the same blocks with the
// grouping stripped. If the architecture changed anything but rest and order,
// it shows up here.
const unpaired = blocks =>
  blocks.map(({ group, groupRole, groupRounds, ...rest }) => rest);

test('a superset never pairs more rounds than the block has sets', () => {
  for (let seed = 1; seed <= 500; seed++) {
    for (const b of hyper(seed).blocks.filter(x => x.group)) {
      assert.ok(b.groupRounds > 0 && b.groupRounds <= b.sets,
        `seed ${seed}: ${b.slot} pairs ${b.groupRounds} rounds of ${b.sets} sets`);
    }
  }
});

test('a supersetted session is never LONGER than the same blocks unpaired', () => {
  let checked = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;
    assert.ok(estimateMinutes(s.blocks) <= estimateMinutes(unpaired(s.blocks)),
      `seed ${seed}: pairing made the session longer`);
    checked++;
  }
  assert.ok(checked > 0, 'no supersetted session was ever compared');
});

test('a superset actually saves time -- it is not a no-op', () => {
  // The test above passes if pairing does nothing at all. This one requires
  // the saving to be real on at least the sessions that carry a pair.
  let saved = 0, checked = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;
    const d = estimateMinutes(unpaired(s.blocks)) - estimateMinutes(s.blocks);
    saved += d;
    checked++;
  }
  assert.ok(saved > 0, 'pairing never saved a single minute across 1000 seeds');
  assert.ok(saved / checked >= 1,
    `mean saving ${(saved / checked).toFixed(2)} min is below one minute per session`);
});

test('patternSets counts a paired block exactly as it counts a straight one', () => {
  // The claim in §3.6.4 is that finalise() cannot see the pairing. The way to
  // check it is to recompute patternSets from the blocks WITHOUT the group
  // fields and require the same answer -- if finalise ever started reading
  // `group`, these two would part company.
  let checked = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = hyper(seed);
    if (!s.blocks.some(b => b.group)) continue;

    const recomputed = {};
    for (const b of unpaired(s.blocks)) {
      if (!countsTowardVolume(b)) continue;
      recomputed[b.pattern] = (recomputed[b.pattern] || 0) + b.sets;
    }
    assert.deepEqual(s.patternSets, recomputed,
      `seed ${seed}: patternSets disagrees with the unpaired blocks`);
    checked++;
  }
  assert.ok(checked > 0, 'no supersetted session was ever checked');
});

test('a paired block still counts toward volume at all', () => {
  // The cheap way to break the test above is for grouped blocks to stop
  // counting on BOTH sides, which would leave it comparing zero to zero.
  let checked = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const b of hyper(seed).blocks.filter(x => x.group)) {
      assert.ok(countsTowardVolume(b), 'a grouped block stopped counting as volume');
      checked++;
    }
  }
  assert.ok(checked > 0, 'no grouped block was ever checked');
});

test('swapping half a superset keeps the pair antagonist', () => {
  // The design leans on swapBlock's pattern narrowing rather than adding new
  // machinery, because the athlete's answer to "a superset means holding two
  // stations" was that he would swap the movement when the gym is busy. That
  // path has to be asserted, not assumed.
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 20; seed++) {
    const s = hyper(seed);
    const a1 = s.blocks.find(b => b.groupRole === 'A1');
    if (!a1) continue;
    const a2 = s.blocks.find(b => b.group === a1.group && b.groupRole === 'A2');

    const { block } = swapBlock(s, a1.slot, LIB, {}, makeRng(seed));
    if (!block) continue;                       // pool exhausted; not this test
    assert.equal(block.pattern, a1.pattern,
      `seed ${seed}: swap changed the pattern, so the pair is no longer antagonist`);
    assert.equal(ANTAGONIST[block.pattern], a2.pattern,
      `seed ${seed}: the pair stopped being antagonist after a swap`);
    checked++;
  }
  assert.ok(checked > 0, 'no superset was ever swapped');
});

test('the round rest is carried on both blocks and agrees with the pricing', () => {
  // groupRestSec is a second copy of what pairSeconds computes from the two
  // blocks' own rests. A sidecar that can drift is asserted, never trusted --
  // the rule the coefficient register already follows.
  let checked = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const blocks = hyper(seed).blocks.filter(b => b.group);
    const byGroup = {};
    for (const b of blocks) (byGroup[b.group] = byGroup[b.group] || []).push(b);
    for (const pair of Object.values(byGroup)) {
      const [a, b] = pair;
      const expected = Math.max(a.restSec || 120, b.restSec || 120);
      assert.equal(a.groupRestSec, expected, `seed ${seed}: A1 round rest wrong`);
      assert.equal(b.groupRestSec, expected, `seed ${seed}: A2 round rest wrong`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no pair was ever checked');
});
