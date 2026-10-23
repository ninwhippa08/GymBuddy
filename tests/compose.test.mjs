// Sessions built from the work, not the clock -- the admission rule.
// docs/superpowers/specs/2026-10-22-session-composition-design.md §4.
//
// On a lifting day an optional slot is admitted by weekly need (§4.1), the
// per-session dose (§4.2) and count (§4.3). This file pins §4.2's helpers, the
// promise that every optional block the fill loop admits sits on a pattern
// that qualified at the moment it was admitted, and the non-goal that the
// day types without `targets` are untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
import { DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const NOW = 1e12;
const DAY = 86400e3;
// Mid-week, so a rounding error in rampWeekFor cannot land this on a boundary.
// Same helper as tests/ramp-budget.test.mjs.
const atWeek = w => ({ returnDate: new Date(NOW - ((w - 1) * 7 + 3) * DAY).toISOString().slice(0, 10) });
const session = (dayType, week, seed) =>
  generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
             dayType, seed, now: NOW });

// --------------------------------------------------------------------------
// Non-lifting day types are unchanged (spec §2 non-goals)
// --------------------------------------------------------------------------

// Every day type that declares no `targets` -- the ones §4 does not touch.
// Read from DAY_TYPES rather than PHASE_1_DAY_TYPES so `mobility` (the deload,
// deliberately outside the rotation) is held too.
const NON_LIFTING = Object.keys(DAY_TYPES)
  .filter(d => !(DAY_TYPES[d].targets && DAY_TYPES[d].targets.length));
const FIXTURE = new URL('./fixtures/nonlifting-v79.json', import.meta.url);
const print = s => ({
  blocks: s.blocks.map(b => [b.slot, b.exerciseId, b.sets, b.reps ?? null, b.durationMin ?? null]),
  durationMin: s.durationMin
});

function capture() {
  const out = {};
  for (const dayType of NON_LIFTING) {
    out[dayType] = {};
    for (const week of [1, 5]) {
      out[dayType][week] = {};
      for (let seed = 1; seed <= 20; seed++) out[dayType][week][seed] = print(session(dayType, week, seed));
    }
  }
  writeFileSync(FIXTURE, JSON.stringify(out) + '\n');
}

test('non-lifting day types are unchanged', () => {
  if (process.env.CAPTURE_NONLIFTING === '1') { capture(); return; }
  assert.deepEqual(NON_LIFTING,
    ['aerobic-steady', 'interval', 'sprint', 'plyometric', 'mobility']);
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  for (const dayType of NON_LIFTING) {
    for (const week of [1, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        assert.deepEqual(print(session(dayType, week, seed)), fixture[dayType][week][seed],
          `${dayType} week ${week} seed ${seed}`);
      }
    }
  }
});

// --------------------------------------------------------------------------
// The helpers (spec §4.1, §4.2)
// --------------------------------------------------------------------------

// Namespace import, so a missing export fails these tests by name instead of
// failing the whole file at link time.
import * as G from '../js/generator.js';
import { VOLUME } from '../js/rules.js';

const LIFTING = ['max-strength', 'power', 'hypertrophy'];
const EMPTY = { patternSets: {} };              // every target owes its whole week
const load = (pattern, sets, role = 'accessory') => ({ mode: 'load', role, pattern, sets });

test('sessionGoal maps each lifting day type to its dose-response goal', () => {
  // spec §4.2: max-strength and power are dosed as strength, hypertrophy as
  // hypertrophy; a day type with no targets has no session dose at all.
  assert.equal(G.sessionGoal('max-strength'), 'strength');
  assert.equal(G.sessionGoal('power'), 'strength');
  assert.equal(G.sessionGoal('hypertrophy'), 'hypertrophy');
  assert.equal(G.sessionGoal('interval'), null);
});

test('SESSION_DOSE is the PUOS for strength and the IUSCA cap for hypertrophy', () => {
  assert.deepEqual({ ...VOLUME.SESSION_DOSE }, { strength: 2, hypertrophy: 10 });
  assert.equal(VOLUME.SESSION_DOSE.hypertrophy, VOLUME.SETS_PER_PATTERN_PER_SESSION);
});

test('sessionSets counts direct working sets on one pattern, not prep', () => {
  assert.equal(G.sessionSets('squat', [
    { mode: 'load', role: 'main lift', pattern: 'squat', sets: 4 },
    { mode: 'load', role: 'accessory', pattern: 'hinge', sets: 3 },
    { mode: 'drill', role: 'prep', pattern: 'squat', sets: 2 }
  ]), 4);
  assert.equal(G.sessionSets('squat', []), 0);
});

test('qualifyingPatterns: a strength day stops adding to a pattern after 2 sets', () => {
  const blocks = [load('squat', 4, 'main lift')];
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['squat', 'pull-h'], mode: 'load' }, 'max-strength', EMPTY, blocks),
    ['pull-h']);
  // `patterns: null` serves every target (the fill loop's long-standing reading).
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: null, mode: 'load' }, 'max-strength', EMPTY, blocks),
    DAY_TYPES['max-strength'].targets.filter(p => p !== 'squat'));
  // Slot patterns outside the day's targets never qualify: `carry` owes no
  // weekly debt because the day type does not count it.
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['lunge', 'hinge', 'pull-h', 'carry'], mode: 'load' },
                         'max-strength', EMPTY, []),
    ['hinge', 'pull-h']);
});

test('qualifyingPatterns: a hypertrophy day takes a pattern up to 10 sets', () => {
  const slot = { patterns: ['squat', 'hinge'], mode: 'load' };
  assert.deepEqual(G.qualifyingPatterns(slot, 'hypertrophy', EMPTY, [load('squat', 9)]),
    ['squat', 'hinge']);
  assert.deepEqual(G.qualifyingPatterns(slot, 'hypertrophy', EMPTY, [load('squat', 10)]),
    ['hinge']);
});

test('qualifyingPatterns: contacts-mode slots are exempt from the session dose', () => {
  // Power slot A already puts 3 sets on jump; a set-based dose of 2 would
  // remove slot E always. spec §4.2.
  const blocks = [{ mode: 'contacts', role: 'potentiation', pattern: 'jump', sets: 3 }];
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['jump', 'throw'], mode: 'contacts' }, 'power', EMPTY, blocks),
    ['jump', 'throw']);
  // The same blocks against a load slot: the dose applies.
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['jump', 'throw'], mode: 'load' }, 'power', EMPTY, blocks),
    ['throw']);
});

test('qualifyingPatterns: a pattern with no weekly debt never qualifies', () => {
  const paid = { patternSets: { 'pull-h': 4 } };   // max-strength weekly target is 4
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['squat', 'pull-h'], mode: 'load' }, 'max-strength', paid, []),
    ['squat']);
  // Exempt from the dose is not exempt from the week.
  const jumped = { patternSets: { jump: 4 } };
  assert.deepEqual(
    G.qualifyingPatterns({ patterns: ['jump', 'throw'], mode: 'contacts' }, 'power', jumped, []),
    ['throw']);
});

// --------------------------------------------------------------------------
// The fill loop admits only on a qualifying pattern (spec §4.2)
// --------------------------------------------------------------------------

// Replay from s.blocks cannot be exact: rampToBudget shaves sets after the
// fill (the dose is read on PRE-ramp counts), packToBudget can still drop an
// optional block whose sets fed a later admission, and capPatternSets shaves
// again. So the fill loop records what qualified at the moment each optional
// block was admitted, and this checks the drawn exercise is on one of them.
// The record is never rendered (js/ui.js names the fields it prints).
test('an optional block is always on a qualifying pattern', () => {
  let optional = 0;
  for (const dayType of LIFTING) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = session(dayType, week, seed);
        for (const b of s.blocks.filter(b => b.optional && G.countsTowardVolume(b))) {
          optional++;
          assert.ok(Array.isArray(b.admittedPatterns) && b.admittedPatterns.length,
            `${dayType} w${week} s${seed} slot ${b.slot}: no admission record`);
          assert.ok(b.admittedPatterns.includes(b.pattern),
            `${dayType} w${week} s${seed} slot ${b.slot}: ${b.pattern} not in [${b.admittedPatterns}]`);
          assert.ok(DAY_TYPES[dayType].targets.includes(b.pattern));
        }
      }
    }
  }
  assert.ok(optional > 0, 'the sweep reached no optional block');
});
