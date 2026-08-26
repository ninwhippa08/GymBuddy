// tests/library.test.mjs -- data invariants for data/exercises.json.
//
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lib = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
);
const EX = lib.exercises;

test('the bare "mobility" modality no longer exists anywhere', () => {
  const stragglers = EX.filter(e => e.modalities.includes('mobility'));
  assert.deepEqual(stragglers.map(e => e.id), [],
    'these entries still carry the pre-split modality');
});

const splitTags = e => e.modalities.filter(
  m => m === 'mobility-dynamic' || m === 'mobility-static'
);

test('every mobility-pattern entry carries exactly one split tag', () => {
  const mob = EX.filter(e => e.pattern === 'mobility');
  // No hardcoded count here any more. It said 19 and the pool is now 31, and a
  // number every authoring commit has to edit is a number nobody reads. The
  // invariant was never the size -- it is the tagging, which is now asserted
  // both ways round and cannot be satisfied by editing a total.
  assert.ok(mob.length > 0, 'the mobility pattern is empty');
  for (const e of mob) {
    assert.equal(splitTags(e).length, 1,
      `${e.id} should carry exactly one of dynamic/static, has ${splitTags(e).length}`);
  }
  // The reverse direction, which the count was standing in for: nothing outside
  // the mobility pattern may claim a split tag and quietly join those pools.
  for (const e of EX) {
    if (splitTags(e).length) {
      assert.equal(e.pattern, 'mobility',
        `${e.id} carries a split tag but its pattern is "${e.pattern}"`);
    }
  }
});

test('no entry is left with an empty modalities array', () => {
  for (const e of EX) {
    assert.ok(e.modalities.length > 0, `${e.id} has no modalities left`);
  }
});

test('both pools are deep enough for a 3-4 pick at either venue', () => {
  const pool = (tag, venue) => EX.filter(e =>
    e.pattern === 'mobility' &&
    e.modalities.includes(tag) &&
    (e.venue === 'either' || e.venue === venue)
  );
  for (const venue of ['gym', 'outdoor']) {
    assert.ok(pool('mobility-dynamic', venue).length >= 4,
      `dynamic pool too thin at ${venue}`);
    assert.ok(pool('mobility-static', venue).length >= 4,
      `static pool too thin at ${venue}`);
  }
});

// Deviation 4: one hurt joint must not empty the static pool. Three is the
// floor packCooldown is allowed to trim to, so three is what must survive.
test('a single hurt joint leaves at least 3 static stretches at the gym', () => {
  const statics = EX.filter(e =>
    e.pattern === 'mobility' && e.modalities.includes('mobility-static')
  );
  const joints = [...new Set(statics.flatMap(e => e.joints || []))];
  for (const hurt of joints) {
    const left = statics.filter(e => !(e.joints || []).includes(hurt));
    assert.ok(left.length >= 3,
      `a hurt ${hurt} leaves only ${left.length} static stretches`);
  }
});

// A plank dosed as "3 x 12 reps" is a wrong instruction, not a vague one --
// the same failure class as the old "bodyweight" load line. Core holds are
// dosed by time. design 2.1.
test('isometric core holds are marked, and only they are', () => {
  const HOLDS = [
    'plank', 'side-plank', 'copenhagen-plank',
    'hollow-hold', 'l-sit', 'suitcase-hold'
  ];
  const marked = EX.filter(e => e.isometric === true).map(e => e.id).sort();
  assert.deepEqual(marked, [...HOLDS].sort());
  for (const id of HOLDS) {
    const e = EX.find(x => x.id === id);
    assert.ok(e, `${id} missing from the library`);
    assert.equal(e.pattern, 'core', `${id} should be a core-pattern entry`);
  }
});

// A primary-tier lift you can load heavy is, by definition, also a lift you can
// run at hypertrophy reps. The exception is the speed lifts -- an Olympic lift
// or a jerk dosed at 8-12 reps is a wrong instruction, not a hard set -- and
// those are exactly the entries that also carry `power`. So: heavy, primary,
// and NOT a speed lift implies hypertrophy is available.
//
// Written as an invariant rather than a list because a list of "which lifts are
// hypertrophy lifts" is a fact about the data that every authoring commit would
// have to edit, and this project has been bitten by that twice.
test('a primary-tier strength lift that is not a speed lift is available for hypertrophy', () => {
  const missing = EX.filter(e =>
    e.tier === 'primary' &&
    (e.modalities || []).includes('max-strength') &&
    !(e.modalities || []).includes('power') &&
    !(e.modalities || []).includes('hypertrophy')
  ).map(e => e.id);

  assert.deepEqual(missing, [],
    'these are loadable primary lifts with no speed component, so excluding them ' +
    'from hypertrophy days is an oversight rather than a decision: ' + missing.join(', '));
});

// An id is the only handle anything has on an exercise. `cuesFor` looks one up
// with `find`, the generator excludes what it has already drawn by id, and the
// coverage matrix counts bodies in a pool. A second entry under the same id
// breaks all three quietly: the first copy shadows the second, so cues written
// for the second are never rendered, and both copies are counted as separate
// movements when a pool is measured.
//
// Five of these were live on 2026-08-26 -- depth-jump, hurdle-hop, tuck-jump,
// split-jump and lateral-bound, each added twice by two different authoring
// passes. Nothing in the suite noticed.
test('no id appears twice in the library', () => {
  const seen = new Map();
  const dupes = [];
  for (const e of EX) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.set(e.id, true);
  }
  assert.deepEqual(dupes, [], `duplicated ids: ${dupes.join(', ')}`);
});
