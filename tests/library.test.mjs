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
//
// This was an enumerated list of every marked entry, and 2026-09-03 predicted
// it would "break next" -- it did, on the first authoring commit that added a
// hold. A list every authoring commit must edit is a list nobody reads, so it
// is replaced by the two invariants it was standing in for rather than bumped.
//
// The REVIEWED HOLDS below are the parents, not the population. They grow only
// when a genuinely new held movement is authored, which is exactly the moment a
// human should be looking at the flag -- and NOT when a variant is derived from
// one, because derivation carries the flag across by inheritance (§11.2, and
// derivation-guard.mjs asserts it still matches).
//
// A NAME-BASED RULE WAS TRIED AND REJECTED: matching /plank|hold|l-sit|hang/ on
// the name misfires in both directions -- `hang-power-clean` names a start
// position, `deep-squat-hold` and `dead-hang` are mobility entries dosed by the
// mobility block, and `side-plank-reach-through` is a plank name for a dynamic
// movement. There is no fact in the data that says which core movements are
// held; that is a human claim, so the human claim is what is written down.
const REVIEWED_HOLDS = [
  'plank', 'side-plank', 'copenhagen-plank',
  'hollow-hold', 'l-sit', 'suitcase-hold'
];

test('the isometric flag is only ever set where it is read', () => {
  // generator.js resolves `mode: 'core'` per exercise -- a plank by time, an ab
  // wheel by reps -- and that branch is the ONLY reader of `isometric`. A
  // mobility or main-work entry carrying the flag would be dosed by its own
  // block and the mark would silently mean nothing.
  for (const e of EX.filter(x => x.isometric === true)) {
    assert.equal(e.pattern, 'core', `${e.id} is marked isometric but is not a core entry`);
  }
});

test('every marked hold is a reviewed one or inherits from one', () => {
  for (const e of EX.filter(x => x.isometric === true)) {
    if (REVIEWED_HOLDS.includes(e.id)) continue;
    assert.ok(e.derivedFrom,
      `${e.id} is marked isometric but is neither reviewed nor derived`);
    const parent = EX.find(x => x.id === e.derivedFrom);
    assert.ok(parent && parent.isometric === true,
      `${e.id} inherits isometric from ${e.derivedFrom}, which is not a marked hold`);
  }
});

test('every reviewed hold is still in the library, still a core hold', () => {
  for (const id of REVIEWED_HOLDS) {
    const e = EX.find(x => x.id === id);
    assert.ok(e, `${id} missing from the library`);
    assert.equal(e.pattern, 'core', `${id} should be a core-pattern entry`);
    assert.equal(e.isometric, true, `${id} is a reviewed hold but is not marked`);
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

// --------------------------------------------------------------------------
// Two entries were under-tagged, not missing — 2026-09-05
// --------------------------------------------------------------------------

// Found while measuring the shortfall in `secondary+accessory :: pull-v/pull-h
// :: hypertrophy`, which read two entries short. It was not short of
// MOVEMENTS. `face-pull` and `straight-arm-pulldown` were already in the
// library carrying `modalities: ["isolation"]` and nothing else, so a
// hypertrophy day could never select them and they counted toward no
// hypertrophy pool.
//
// That is a rear-delt movement and a lat movement, both prescribed in sets of
// 10-15 for size by anyone who programmes them, sitting beside `barbell-curl`,
// `dumbbell-curl` and `hammer-curl` which all carry
// `["isolation","hypertrophy"]`. The single tag looks like an oversight rather
// than a judgement.
//
// Retagging is NOT the same act as adding an entry: it changes which DAYS a
// movement already in circulation can be selected on. So it was raised
// separately (design-library-expansion.md §13.6) and made only on the
// athlete's explicit instruction, 2026-09-05.
//
// DELIBERATELY NOT RETAGGED, and left unasserted here so a later reading can
// still change them: `band-pull-apart`, `incline-curl`, `preacher-curl` and
// `wrist-curl` sit the same way. He named two; two is what moved.

test('the rear-delt and lat isolation pulls are hypertrophy work as well', () => {
  for (const id of ['face-pull', 'straight-arm-pulldown']) {
    const e = EX.find(x => x.id === id);
    assert.ok(e, `${id} is missing from the library`);
    assert.ok(e.modalities.includes('isolation'),
      `${id} must stay isolation work -- this adds a tag, it does not swap one`);
    assert.ok(e.modalities.includes('hypertrophy'),
      `${id} is tagged ${JSON.stringify(e.modalities)}, so no hypertrophy day ` +
      'can ever select it');
  }
});
