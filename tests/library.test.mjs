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

test('every mobility-pattern entry carries exactly one split tag', () => {
  const mob = EX.filter(e => e.pattern === 'mobility');
  assert.equal(mob.length, 19, 'the mobility pattern should hold 19 entries');
  for (const e of mob) {
    const tags = e.modalities.filter(
      m => m === 'mobility-dynamic' || m === 'mobility-static'
    );
    assert.equal(tags.length, 1,
      `${e.id} should carry exactly one of dynamic/static, has ${tags.length}`);
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
