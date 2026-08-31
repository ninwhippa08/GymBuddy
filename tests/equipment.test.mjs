// Equipment constraints. design-equipment-and-swap.md §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eligibleFor, generate, requiredUnfilled, offerableEquipment, resolveSession
} from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { NON_NEGOTIABLE_EQUIPMENT, ALL_TIERS } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const MAIN_LIFT = TEMPLATES['max-strength'][0];
const ids = (slot, excludeEquipment = []) =>
  eligibleFor(slot, LIB, { venue: 'gym', excludeEquipment }).map(e => e.id);

test('an empty constraint changes nothing', () => {
  assert.deepEqual(ids(MAIN_LIFT, []), ids(MAIN_LIFT));
});

test('excluding the barbell removes the back squat', () => {
  assert.ok(ids(MAIN_LIFT).includes('back-squat'));
  assert.ok(!ids(MAIN_LIFT, ['barbell']).includes('back-squat'));
});

test('equipment is a conjunction -- losing any one item rules an entry out', () => {
  // Derived, not written down: an earlier draft of this test asserted that
  // back-squat needs barbell AND rack AND plates. It needs the first two, and
  // the test failed on a claim about the library rather than about the filter.
  const squat = LIB.find(e => e.id === 'back-squat');
  assert.ok(squat.equipment.length > 1, 'this test needs a multi-item entry');
  for (const gear of squat.equipment) {
    assert.ok(!ids(MAIN_LIFT, [gear]).includes('back-squat'),
      `excluding ${gear} left the back squat in`);
  }
});

test('excluding one item does not remove entries that never needed it', () => {
  assert.ok(ids(MAIN_LIFT, ['kettlebell']).includes('back-squat'));
});

test('the non-negotiables are the three that cannot be absent', () => {
  assert.deepEqual([...NON_NEGOTIABLE_EQUIPMENT].sort(),
    ['bodyweight', 'open-space', 'wall']);
});

// --------------------------------------------------------------------------
// The constraint through generate(). design §3.3.
// --------------------------------------------------------------------------

const gen = (excludeEquipment, dayType = 'max-strength', seed = 42) =>
  generate({ library: LIB, dayType, seed, excludeEquipment,
             profile: { venue: 'gym' } });

test('a constrained session contains none of the excluded equipment', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell']).blocks) {
    const gear = byId.get(b.exerciseId).equipment || [];
    assert.ok(!gear.includes('barbell'),
      `${b.exerciseId} needs a barbell and should not be here`);
  }
});

test('the session records the constraint it was built under', () => {
  assert.deepEqual(gen(['barbell', 'rack']).excludeEquipment, ['barbell', 'rack']);
  assert.deepEqual(gen([]).excludeEquipment, []);
});

test('a buildable day reports no required slot unfilled', () => {
  assert.deepEqual(requiredUnfilled(gen(['barbell'])), []);
});

test('unfilled records optionality, not just the letter', () => {
  for (const u of gen(['barbell', 'rack', 'plates']).unfilled) {
    assert.equal(typeof u.slot, 'string');
    assert.equal(typeof u.optional, 'boolean');
  }
});

// --------------------------------------------------------------------------
// Tier relaxation. design §4.2 -- the athlete rejected the premise of open
// question 4: "there should also be power moves without barbells."
// --------------------------------------------------------------------------

test('the three main-work tiers are named once, in rules', () => {
  assert.deepEqual([...ALL_TIERS], ['primary', 'secondary', 'accessory']);
});

test('a barbell-free power day finds the movements tier was hiding', () => {
  // Bar, rack AND plates: the strict primary pool for this slot is EMPTY, so
  // this can only pass through relaxation. Excluding the barbell alone leaves
  // trap-bar-deadlift and would pass without any implementation at all.
  const olympic = gen(['barbell', 'rack', 'plates'], 'power', 7).blocks
    .find(b => b.role === 'Olympic derivative');
  assert.ok(olympic, 'the Olympic derivative slot was dropped, not relaxed');
  assert.ok(
    ['kettlebell-swing', 'dumbbell-snatch', 'kettlebell-clean']
      .includes(olympic.exerciseId),
    `unexpected fill: ${olympic.exerciseId}`);
  assert.ok(olympic.tierRelaxed, 'filled by relaxation but not flagged');
});

test('relaxation widens tier and nothing else', () => {
  // A relaxed max-strength slot must not start returning mobility drills.
  // Only `tier` widens; patterns, modality and zone are what a slot is FOR.
  const byId = new Map(LIB.map(e => [e.id, e]));
  for (const b of gen(['barbell', 'rack', 'plates'], 'max-strength', 3).blocks
                    .filter(x => x.tierRelaxed)) {
    const mods = byId.get(b.exerciseId).modalities || [];
    assert.ok(mods.includes('max-strength') || mods.includes('hypertrophy'),
      `${b.exerciseId} is not strength work`);
  }
});

test('a relaxed block is flagged, so the card can say so', () => {
  assert.ok(gen(['barbell', 'rack', 'plates'], 'max-strength', 3)
    .blocks.some(b => b.tierRelaxed),
    'nothing was flagged, so the substitution would be silent');
});

test('an unconstrained session relaxes nothing', () => {
  assert.ok(!gen([]).blocks.some(b => b.tierRelaxed));
});

test('the control lists only what this session asks for', () => {
  const byId = new Map(LIB.map(e => [e.id, e]));
  const s = gen([]);
  const used = new Set(s.blocks.flatMap(b => byId.get(b.exerciseId).equipment || []));
  for (const q of offerableEquipment(s.blocks, LIB)) {
    assert.ok(used.has(q), `${q} is not in this session`);
  }
});

test('the control never offers the non-negotiables', () => {
  const offered = offerableEquipment(gen([]).blocks, LIB);
  for (const q of NON_NEGOTIABLE_EQUIPMENT) {
    assert.ok(!offered.includes(q), `${q} must never be offerable`);
  }
});

test('the control stays short enough to read on a phone', () => {
  // Measured across nine sessions while designing: 4 to 8. design §3.2.
  for (const dt of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= 5; seed++) {
      const n = offerableEquipment(gen([], dt, seed * 1009).blocks, LIB).length;
      assert.ok(n >= 1 && n <= 10, `${dt}/${seed} offered ${n} items`);
    }
  }
});

const resolve = (excludeEquipment, dayType = 'max-strength', seed = 11) =>
  resolveSession({ library: LIB, dayType, seed, excludeEquipment,
                   profile: { venue: 'gym' } });

// Every equipment value in the library bar the three that cannot be absent.
// Removing the session's own equipment is NOT enough to block a day type --
// tier relaxation finds a bodyweight fill -- so a test that wants the fallback
// path has to take the whole gym away.
const EVERYTHING = [...new Set(LIB.flatMap(e => e.equipment || []))]
  .filter(q => !NON_NEGOTIABLE_EQUIPMENT.includes(q));

test('a buildable day type comes back unchanged and unannounced', () => {
  const { session, offer } = resolve(['barbell']);
  assert.equal(offer, null);
  assert.equal(session.dayType, 'max-strength');
});

test('losing the equipment a session uses is absorbed, not escalated', () => {
  // The plan expected this to block the day type. It does not: tier relaxation
  // fills the slots another way, and the athlete keeps the day he asked for.
  const { session, offer } = resolve(offerableEquipment(gen([]).blocks, LIB));
  assert.equal(session.dayType, 'max-strength');
  assert.equal(offer, null);
});

test('an unbuildable day type is never silently substituted', () => {
  const { session, offer } = resolve(EVERYTHING);
  if (session) {
    assert.ok(offer, 'the day type changed with no offer -- a silent substitution');
    assert.equal(offer.blocked, 'max-strength');
    assert.notEqual(session.dayType, 'max-strength');
    assert.deepEqual(requiredUnfilled(session), []);
  } else {
    assert.equal(offer, null, 'no session and no offer is the §6.1 case');
  }
});

test('the fallback never offers a vetoed day type', () => {
  const { session } = resolve(EVERYTHING);
  if (!session) return;
  const vetoed = (session.candidates || []).filter(c => c.vetoed).map(c => c.dayType);
  assert.ok(!vetoed.includes(session.dayType),
    `${session.dayType} was vetoed and offered anyway`);
});

// The test above is satisfied by a resolveSession that gives up immediately:
// it passes vacuously when `session` is null. This one does not. A directly
// chosen day type used to come back with an empty candidate list, which left
// the fallback loop with nothing to walk -- the feature was inert and the
// suite was still green.
test('a day type that cannot be built falls back to one that can', () => {
  const { session, offer } = resolve(EVERYTHING);
  assert.ok(session, 'bodyweight day types exist, so something was buildable');
  assert.equal(offer.blocked, 'max-strength');
  assert.notEqual(session.dayType, 'max-strength');
  assert.deepEqual(requiredUnfilled(session), []);
});

// showSession passes dayType: null on a first build, so the day type that got
// blocked is the one generate PROPOSED. Reporting opts.dayType there names
// nothing, and the offer line renders as "A null day needs equipment...".
test('a blocked day type is named even when it was proposed, not chosen', () => {
  const { session, offer } = resolveSession({
    library: LIB, dayType: null, seed: 11, excludeEquipment: EVERYTHING,
    profile: { venue: 'gym' }
  });
  assert.ok(session, 'expected a fallback session for this fixture');
  assert.ok(offer, 'expected the fallback to be announced');
  assert.equal(offer.blocked, 'max-strength');
});

// renderSession prints session.reason under the day title. Every constrained
// regeneration passes an explicit dayType, so 'chosen directly' would be the
// line the athlete reads on screen.
test('an explicitly chosen day type still explains itself', () => {
  const s = gen([]);
  assert.notEqual(s.reason, 'chosen directly');
  assert.ok(s.reason.length > 0, 'no reason at all');
});

// Unticking an item regenerates the session without it -- so the item drops
// out of the next session's equipment, the checkbox disappears, and there is
// no way back. The control has to keep offering what is already excluded.
test('an unticked item stays on the list so it can be ticked again', () => {
  assert.ok(offerableEquipment(gen([]).blocks, LIB).includes('barbell'));
  const { session } = resolve(['barbell']);
  assert.ok(offerableEquipment(session.blocks, LIB, ['barbell']).includes('barbell'),
    'barbell vanished from the control -- it can never be ticked again');
});

test('the constraint never smuggles a non-negotiable onto the list', () => {
  const items = offerableEquipment(gen([]).blocks, LIB, ['wall', 'barbell']);
  assert.ok(!items.includes('wall'));
  assert.ok(items.includes('barbell'));
});

// --------------------------------------------------------------------------
// Specialty bars ARE barbells. Found in the gym 2026-08-30.
//
// The athlete unticked the barbell on a hypertrophy day and said "nothing
// happened": the squat slot came back Safety-Bar Squat, and swap offered a
// Trap-Bar Deadlift. Both are barbells. So is a landmine -- it is a barbell
// with one end in a floor sleeve.
//
// The equipment model treated `safety-bar`, `trap-bar` and `landmine` as items
// independent of `barbell`, so excluding the barbell left all five entries
// standing. The conjunction filter was working exactly as written; what was
// wrong is that the data says these movements do not need a bar.
// --------------------------------------------------------------------------

// The four ways a bar reaches the gym floor. Named here rather than imported
// so the test states the physical claim and production has to honour it.
const BARS = ['barbell', 'trap-bar', 'safety-bar', 'landmine'];
const usesABar = id => {
  const e = LIB.find(x => x.id === id);
  return (e.equipment || []).some(q => BARS.includes(q));
};

test('excluding the barbell excludes the specialty bars too', () => {
  // The five entries that need a bar without being tagged `barbell`.
  for (const id of ['safety-bar-squat', 'trap-bar-deadlift', 'trap-bar-carry',
                    'landmine-push-press', 'landmine-rainbow']) {
    const entry = LIB.find(e => e.id === id);
    const slot = { tier: entry.tier, patterns: [entry.pattern], modality: entry.modality };
    const survivors = eligibleFor(slot, LIB, { venue: 'gym', excludeEquipment: ['barbell'] })
      .map(e => e.id);
    assert.ok(!survivors.includes(id),
      `excluding the barbell left ${id} eligible -- it needs a bar`);
  }
});

test('no session built without a barbell contains a bar movement', () => {
  for (const dayType of ['max-strength', 'hypertrophy', 'power']) {
    for (let seed = 1; seed <= 120; seed++) {
      const s = generate({
        library: LIB, profile: { returnDate: '2026-08-01', banned: [], plyoLevel: 'beginner' },
        history: [], soreness: {}, dayType, excludeEquipment: ['barbell'], seed
      });
      for (const b of s.blocks) {
        assert.ok(!usesABar(b.exerciseId),
          `${dayType} seed ${seed}: ${b.exerciseId} needs a bar under a no-barbell constraint`);
      }
    }
  }
});

test('the implication runs one way -- no trap bar still leaves the straight bar', () => {
  // A gym can own a barbell and no trap bar. The reverse -- a trap bar and no
  // barbell at all -- is not a room this app has to model, and collapsing the
  // two directions would silently delete the main lift.
  assert.ok(ids(MAIN_LIFT, ['trap-bar']).includes('back-squat'));
  assert.ok(ids(MAIN_LIFT, ['landmine']).includes('back-squat'));
});
