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
    isometric: false,
    // The parent fixture is a core plank and carries no `targets` at all, so
    // naming any is a difference -- which is the drift worth catching. Only
    // the 38 mobility entries carry the field, and absent-vs-present is
    // exactly how a variant would wander into a pool its parent is not in.
    targets: ['squat']
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

// --------------------------------------------------------------------------
// `targets` joined the inherited set 2026-09-05
// --------------------------------------------------------------------------

// The gap this closes was opened by v38. `targets` names the movement
// patterns a drill or stretch serves, and it is what the prep and cool-down
// select on -- so it decides which DAY an entry can ever be drawn for, which
// is the same job `pattern` does for the main work. `pattern` was on the
// inherited list from the start; `targets` was added to the library without
// being added here, so a derived mobility variant could drift silently.
//
// There were no derived mobility entries when this landed (checked: 15
// derived entries, none tier `mobility`, zero targets mismatches), so this is
// a guard put in place BEFORE the first entry that needs it -- which is the
// only time it is cheap.

test('targets is inherited, because it decides which day a drill is drawn for', () => {
  assert.ok(INHERITED.includes('targets'),
    'a derived drill that changed its targets would be selected on a ' +
    'different day from its parent and nothing would notice');
});

test('a derived drill that quietly re-aims itself is caught', () => {
  const parent = {
    id: 'leg-swing', pattern: 'mobility', tier: 'mobility',
    joints: ['hip'], cnsCost: 1, technical: 1, unilateral: true,
    modalities: ['mobility-dynamic'], targets: ['hinge', 'run', 'sprint', 'lunge'],
    equipment: ['bodyweight'], venue: 'either'
  };
  const drifted = {
    ...parent, id: 'lateral-leg-swing', derivedFrom: 'leg-swing',
    targets: ['squat', 'lunge']            // re-aimed: no longer a hinge drill
  };
  const byId = { 'leg-swing': parent };
  const problems = derivationProblems(drifted, byId);
  assert.ok(problems.some(p => p.startsWith('targets')),
    `expected a targets problem, got ${JSON.stringify(problems)}`);
});

test('a derived drill that keeps its parent aim is fine', () => {
  const parent = {
    id: 'leg-swing', pattern: 'mobility', tier: 'mobility',
    joints: ['hip'], cnsCost: 1, technical: 1, unilateral: true,
    modalities: ['mobility-dynamic'], targets: ['hinge', 'run'],
    equipment: ['bodyweight'], venue: 'either'
  };
  const ok = {
    ...parent, id: 'wall-supported-leg-swing', derivedFrom: 'leg-swing',
    targets: ['run', 'hinge']              // same set, different order
  };
  const byId = { 'leg-swing': parent };
  assert.deepEqual(derivationProblems(ok, byId), []);
});

test('absent targets inherits as absent, like isometric', () => {
  // Only the 38 mobility entries carry targets. A derived barbell variant has
  // none, and neither does its parent; that must not read as a difference.
  const parent = {
    id: 'hip-thrust', pattern: 'hinge', tier: 'accessory', joints: ['hip'],
    cnsCost: 2, technical: 1, unilateral: false, modalities: ['hypertrophy'],
    equipment: ['barbell', 'bench'], venue: 'gym'
  };
  const child = { ...parent, id: 'b-stance-hip-thrust', derivedFrom: 'hip-thrust' };
  const byId = { 'hip-thrust': parent };
  assert.deepEqual(derivationProblems(child, byId), []);
});
