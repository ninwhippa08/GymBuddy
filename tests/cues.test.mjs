// Guards for the optional `cues` field. design-card-flip.md §3.
//
// The library has no cues yet, so running the guard across it proves nothing.
// These check the guard itself against entries built to break it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cueProblems, CUED_POOLS } from './cue-guard.mjs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const withCues = cues => ({
  id: 'x', name: 'X', modalities: ['hypertrophy'], tier: 'primary', cues
});

test('an entry with no cues at all is fine -- the field is optional', () => {
  assert.deepEqual(cueProblems({ id: 'x', name: 'X' }), []);
});

test('one to four non-empty lines pass', () => {
  assert.deepEqual(cueProblems(withCues(['Brace, then sit between the hips.'])), []);
  assert.deepEqual(cueProblems(withCues(['a', 'b', 'c', 'd'])), []);
});

test('a paragraph instead of an array is rejected', () => {
  const p = cueProblems(withCues('Brace, then sit between the hips.'));
  assert.equal(p.length, 1);
  assert.match(p[0], /array/);
});

test('an empty array and a fifth line are both rejected', () => {
  assert.match(cueProblems(withCues([]))[0], /1-4/);
  assert.match(cueProblems(withCues(['a', 'b', 'c', 'd', 'e']))[0], /1-4/);
});

test('a blank line is rejected', () => {
  assert.match(cueProblems(withCues(['ok', '   ']))[0], /empty/);
});

test('a cue over 90 characters is rejected', () => {
  const long = 'x'.repeat(91);
  assert.match(cueProblems(withCues([long]))[0], /90/);
});

test('a duplicated cue inside one entry is rejected', () => {
  assert.match(cueProblems(withCues(['same', 'same']))[0], /duplicate/i);
});

test('the whole library passes the guard', () => {
  for (const e of LIB) {
    assert.deepEqual(cueProblems(e), [], `${e.id}: ${cueProblems(e).join('; ')}`);
  }
});

// The ratchet. design-card-flip.md §3.1.
test('every entry in a cued pool actually has cues', () => {
  for (const pool of CUED_POOLS) {
    const inPool = LIB.filter(
      e => (e.modalities || []).includes(pool) || e.tier === pool
    );
    assert.ok(inPool.length > 0, `CUED_POOLS names "${pool}" but no entry is in it`);
    for (const e of inPool) {
      assert.ok(e.cues && e.cues.length,
        `${e.id} is in cued pool "${pool}" but has no cues`);
    }
  }
});
