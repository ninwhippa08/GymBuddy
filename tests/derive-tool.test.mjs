// The scaffolding tool. design-library-expansion.md §11.5.
//
// Of the ~15 fields on a library entry, a derived variant copies nine off its
// parent unchanged and forces three more to a fixed value. Only four need a
// human: the id, the name, the equipment, and the cue line the moved axis
// actually changed. The copying is mechanical and easy to get subtly wrong,
// and getting it wrong is exactly what derivation-guard.mjs fails on -- so it
// is worth doing by machine.
//
// THE CONTRACT, and it is deliberate: the draft is correct in every mechanical
// respect and WRONG IN EXACTLY ONE WAY -- its cues are still the parent's,
// which the derivation guard rejects as "has not moved an axis". So a draft
// that is pasted in and forgotten does not ship; it fails the suite, and the
// failure names the one thing only a human can do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derive } from '../tools/derive.mjs';
import { derivationProblems, INHERITED } from './derivation-guard.mjs';
import { cueProblems } from './cue-guard.mjs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = Object.fromEntries(LIB.map(e => [e.id, e]));

test('every inherited field is copied off the parent', () => {
  const { entry } = derive({ parentId: 'hip-thrust', id: 'b-stance-hip-thrust',
                             name: 'B-Stance Hip Thrust' }, LIB);
  const parent = byId['hip-thrust'];
  for (const field of INHERITED) {
    assert.deepEqual(entry[field], parent[field],
      `${field} was not carried across`);
  }
  assert.equal(entry.derivedFrom, 'hip-thrust');
});

test('the draft is wrong in exactly one way, and it is the cues', () => {
  const { entry } = derive({ parentId: 'hip-thrust', id: 'b-stance-hip-thrust',
                             name: 'B-Stance Hip Thrust' }, LIB);
  const problems = derivationProblems(entry, byId);
  assert.equal(problems.length, 1,
    `expected only the cue problem, got ${JSON.stringify(problems)}`);
  assert.match(problems[0], /cue/i);
  // ...and it is a real entry otherwise: the cue guard itself is satisfied,
  // so the only thing standing between this and a valid entry is judgement.
  assert.deepEqual(cueProblems(entry), []);
});

test('rewriting one cue line is all it takes', () => {
  const { entry } = derive({ parentId: 'hip-thrust', id: 'b-stance-hip-thrust',
                             name: 'B-Stance Hip Thrust' }, LIB);
  entry.cues = [...entry.cues];
  entry.cues[0] = 'Front foot flat, back foot up on the toes for balance only.';
  assert.deepEqual(derivationProblems(entry, byId), [],
    'once a cue moves, the draft is a valid derived entry');
});

test('a coefficient is never inherited, even from a loadable parent', () => {
  const parent = byId['romanian-deadlift'];
  assert.equal(parent.loadable, true, 'fixture must have a loadable parent');
  assert.ok(parent.prCoef > 0, 'and it must actually carry a coefficient');
  const { entry } = derive({ parentId: 'romanian-deadlift', id: 'snatch-grip-rdl',
                             name: 'Snatch-Grip Romanian Deadlift' }, LIB);
  assert.equal(entry.loadable, false,
    'loadable is false until a coefficient is sourced for the variant itself');
  assert.equal(entry.prCoef, null);
  assert.equal(entry.prRef, null);
});

test('moving the implement lets the variant declare its own venue', () => {
  const { entry } = derive({ parentId: 'hip-thrust', id: 'band-hip-thrust',
                             name: 'Band Hip Thrust', equipment: ['bands'],
                             venue: 'either' }, LIB);
  assert.deepEqual(entry.equipment, ['bands']);
  assert.equal(entry.venue, 'either');
  const problems = derivationProblems(entry, byId).filter(p => !/cue/i.test(p));
  assert.deepEqual(problems, [], 'VENUE_FOLLOWS_IMPLEMENT is satisfied');
});

test('keeping the implement but moving the venue is refused', () => {
  assert.throws(
    () => derive({ parentId: 'hip-thrust', id: 'x-hip-thrust', name: 'X',
                   venue: 'either' }, LIB),
    /venue/i,
    'the tool must not emit a draft the guard would reject on venue');
});

test('a mobility parent carries its targets across', () => {
  const { entry } = derive({ parentId: 'leg-swing', id: 'lateral-leg-swing',
                             name: 'Lateral Leg Swing' }, LIB);
  assert.deepEqual(entry.targets, byId['leg-swing'].targets,
    'a re-aimed drill is not a derived variant -- v39 guard');
});

// ---- refusals -------------------------------------------------------------

test('an unknown parent is refused', () => {
  assert.throws(() => derive({ parentId: 'no-such-lift', id: 'x', name: 'X' }, LIB),
    /no-such-lift/);
});

test('a parent that is itself derived is refused -- depth is one', () => {
  const derived = LIB.find(e => e.derivedFrom);
  assert.ok(derived, 'fixture needs a derived entry in the library');
  assert.throws(
    () => derive({ parentId: derived.id, id: 'x-variant', name: 'X' }, LIB),
    /one deep|derived/i);
});

test('an id already in the library is refused', () => {
  assert.throws(
    () => derive({ parentId: 'hip-thrust', id: 'back-squat', name: 'X' }, LIB),
    /back-squat/);
});

test('an id that is not a slug is refused', () => {
  assert.throws(
    () => derive({ parentId: 'hip-thrust', id: 'B Stance Thrust', name: 'X' }, LIB),
    /id/i);
});
