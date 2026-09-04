// Guards for the optional `derivedFrom` field. design-library-expansion.md §11.
//
// Most of these check the guard against entries built to break it, because the
// real library is where the guard has to hold but not where it can be proven --
// a pool with no derived entries yet would pass a guard that did nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivationProblems, INHERITED } from './derivation-guard.mjs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const byId = Object.fromEntries(LIB.map(e => [e.id, e]));

// A minimal well-formed pair. `parent` is shaped like a real core entry.
const parent = {
  id: 'plank-p', name: 'Parent Plank', pattern: 'core', tier: 'core',
  loadable: false, prRef: null, prCoef: null,
  joints: ['lumbar', 'shoulder'], equipment: ['bodyweight'], venue: 'either',
  cnsCost: 1, technical: 1, unilateral: false, isometric: true,
  cues: ['Elbows under the shoulders.', 'Squeeze the glutes.'],
  modalities: ['isolation']
};
const child = (over = {}) => ({
  ...parent, ...over,
  id: 'plank-c', name: 'Child Plank', derivedFrom: 'plank-p',
  cues: over.cues ?? ['Elbows under the shoulders.', 'Hold a plate on the back.']
});
const pair = (over = {}) => ({ 'plank-p': parent, ...over });

test('an entry with no derivedFrom is fine -- the field is optional', () => {
  assert.deepEqual(derivationProblems(parent, pair()), []);
  assert.deepEqual(derivationProblems({ ...parent, derivedFrom: null }, pair()), []);
});

test('a well-formed variant passes', () => {
  assert.deepEqual(derivationProblems(child(), pair()), []);
});

test('a parent that is not in the library is rejected', () => {
  const p = derivationProblems({ ...child(), derivedFrom: 'no-such-lift' }, pair());
  assert.equal(p.length, 1);
  assert.match(p[0], /no-such-lift/);
});

test('derivedFrom must name an id, not be blank or a non-string', () => {
  assert.match(derivationProblems({ ...child(), derivedFrom: '  ' }, pair())[0], /id/);
  assert.match(derivationProblems({ ...child(), derivedFrom: 7 }, pair())[0], /id/);
});

test('an entry cannot be derived from itself', () => {
  const self = { ...parent, derivedFrom: 'plank-p' };
  assert.match(derivationProblems(self, pair())[0], /itself/);
});

// The rule that keeps every variant one edit from a reviewed line.
test('derivation is one deep -- a derived entry cannot be a parent', () => {
  const mid = { ...parent, id: 'plank-m', derivedFrom: 'plank-p' };
  const grandchild = { ...child(), id: 'plank-g', derivedFrom: 'plank-m' };
  const p = derivationProblems(grandchild, pair({ 'plank-m': mid }));
  assert.equal(p.length, 1);
  assert.match(p[0], /one deep|itself derived/i);
});

// The failure the guard exists to prevent: a parent is repriced and its
// children silently keep the old value. One case per inherited field.
test('every inherited field is checked, one problem each', () => {
  const drift = {
    pattern: 'squat', tier: 'accessory', joints: ['lumbar'],
    cnsCost: 3, technical: 2, unilateral: true, modalities: ['hypertrophy'],
    isometric: false
  };
  assert.deepEqual(Object.keys(drift).sort(), [...INHERITED].sort(),
    'a field was added to INHERITED without a drift case here');
  for (const [field, value] of Object.entries(drift)) {
    const p = derivationProblems(child({ [field]: value }), pair());
    assert.equal(p.length, 1, `${field} produced ${p.length} problems: ${p}`);
    assert.match(p[0], new RegExp(field));
  }
});

// VENUE_FOLLOWS_IMPLEMENT: venue is a function of the implement in this
// library, so it is inherited only when the implement did not move.
test('a stance variant may not quietly change venue', () => {
  const p = derivationProblems(child({ venue: 'gym' }), pair());
  assert.equal(p.length, 1);
  assert.match(p[0], /venue/);
});

test('an implement variant declares its own venue', () => {
  assert.deepEqual(
    derivationProblems(child({ equipment: ['cable'], venue: 'gym' }), pair()), []);
});

// Checked on a variant that DID move the implement, so the drift branch cannot
// answer for the vocabulary check -- the first version of this test passed
// against a guard that had no vocabulary check at all.
test('a venue the library does not use is rejected', () => {
  const p = derivationProblems(
    child({ equipment: ['cable'], venue: 'garage' }), pair());
  assert.equal(p.length, 1);
  assert.match(p[0], /garage/);
});

test('joints and modalities compare as sets -- order is not a claim', () => {
  assert.deepEqual(
    derivationProblems(child({ joints: ['shoulder', 'lumbar'] }), pair()), []);
});

test('a variant whose cues are identical to its parent has not moved an axis', () => {
  const p = derivationProblems(child({ cues: parent.cues.slice() }), pair());
  assert.equal(p.length, 1);
  assert.match(p[0], /cue/i);
});

test('a variant may not inherit its parent\'s load coefficient', () => {
  const loadedParent = { ...parent, loadable: true, prRef: 'back-squat', prCoef: 0.7 };
  const inheriting = { ...child(), loadable: true, prRef: 'back-squat', prCoef: 0.7 };
  const p = derivationProblems(inheriting, { 'plank-p': loadedParent });
  assert.equal(p.length, 1);
  assert.match(p[0], /coefficient/i);
});

test('the real library carries no broken derivation', () => {
  const problems = [];
  for (const e of LIB) {
    for (const p of derivationProblems(e, byId)) problems.push(`${e.id}: ${p}`);
  }
  assert.deepEqual(problems, []);
});
