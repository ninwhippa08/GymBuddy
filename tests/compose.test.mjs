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
import { DAY_TYPES, TEMPLATES } from '../js/templates.js';

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

// drawPatterns: what an ADMITTED slot is narrowed to. Controller ruling after
// Task 1: §4.1 asks only that SOME target pattern owe weekly volume, so a
// slot's non-target patterns (carry, rotate) stay drawable -- subject to the
// session dose alone -- and only the TARGET patterns failing 4.1/4.2 are cut.
test('drawPatterns keeps non-target patterns once a target pattern admits the slot', () => {
  // `lunge` is a hypertrophy target (not a max-strength one), `carry` is
  // neither, so this is hypertrophy slot D's shape cut to two patterns.
  const slot = { patterns: ['lunge', 'carry'], mode: 'load' };
  assert.deepEqual(G.qualifyingPatterns(slot, 'hypertrophy', EMPTY, []), ['lunge']);
  assert.deepEqual(G.drawPatterns(slot, 'hypertrophy', EMPTY, []), ['lunge', 'carry']);
  // Lunge paid for the week: no target pattern admits the slot, so it is not
  // admitted, and carry alone cannot earn it a place.
  const paid = { patternSets: { lunge: 10 } };
  assert.deepEqual(G.qualifyingPatterns(slot, 'hypertrophy', paid, []), []);
  // Lunge at its dose: the target is cut from the draw, carry stays.
  assert.deepEqual(G.drawPatterns({ patterns: ['lunge', 'hinge', 'carry'], mode: 'load' },
                                  'hypertrophy', EMPTY, [load('lunge', 10)]), ['hinge', 'carry']);
});

test('drawPatterns: a non-target pattern is still held to the session dose', () => {
  const slot = { patterns: ['lunge', 'hinge', 'pull-h', 'carry'], mode: 'load' };
  assert.deepEqual(G.drawPatterns(slot, 'max-strength', EMPTY, []),
    ['lunge', 'hinge', 'pull-h', 'carry']);
  // Two carry sets already: a strength day's dose of 2 is spent on carry.
  assert.deepEqual(G.drawPatterns(slot, 'max-strength', EMPTY, [load('carry', 2)]),
    ['lunge', 'hinge', 'pull-h']);
  // A target with no weekly debt is cut; a non-target never has debt to pay.
  assert.deepEqual(G.drawPatterns(slot, 'max-strength', { patternSets: { 'pull-h': 4 } }, []),
    ['lunge', 'hinge', 'carry']);
  // Contacts slots stay exempt from the dose, for non-targets too.
  assert.deepEqual(G.drawPatterns({ patterns: ['jump', 'sprint'], mode: 'contacts' }, 'power', EMPTY,
    [{ mode: 'contacts', role: 'potentiation', pattern: 'sprint', sets: 3 }]), ['jump', 'sprint']);
  // `patterns: null` draws the qualifying targets only. Not the v79 behaviour
  // (any tier-allowed pattern, non-targets included); open question for the athlete.
  assert.deepEqual(G.drawPatterns({ patterns: null, mode: 'load' }, 'max-strength', EMPTY,
    [load('squat', 4, 'main lift')]), G.qualifyingPatterns({ patterns: null, mode: 'load' },
    'max-strength', EMPTY, [load('squat', 4, 'main lift')]));
});

// --------------------------------------------------------------------------
// The fill loop admits only on a qualifying pattern (spec §4.2)
// --------------------------------------------------------------------------

// `admittedPatterns` is the DRAW set (drawPatterns) the slot was narrowed to.
// Replay from s.blocks cannot be exact: rampToBudget shaves sets after the
// fill (the dose is read on PRE-ramp counts), and capPatternSets shaves
// again -- and on a lifting day can drop an optional block whole (Rulings
// J/K) whose sets fed a later admission. (packToBudget, which could also drop
// one, no longer runs on lifting days -- spec §5.) So the fill loop records
// what qualified at the moment each optional block was admitted, and this
// checks the drawn exercise is on one of them.
// The record is never rendered (js/ui.js names the fields it prints).
const order = (dayType, slot) => TEMPLATES[dayType].findIndex(sl => sl.slot === slot);
test('an optional block is always on a qualifying pattern', () => {
  let optional = 0, offTarget = 0;
  for (const dayType of LIFTING) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = session(dayType, week, seed);
        for (const b of s.blocks.filter(b => b.optional && G.countsTowardVolume(b))) {
          optional++;
          // A NECESSARY condition on the dose's input, independent of what the
          // loop recorded: the sets FINALLY on this pattern from earlier
          // template slots are a lower bound on what the fill loop counted
          // (the ramp, packer and pattern cap only ever remove), so they too
          // must be under the dose. Catches a wrong `blocks` passed to the
          // helpers, which admittedPatterns alone cannot see.
          if (b.mode !== 'contacts' && DAY_TYPES[dayType].targets.includes(b.pattern)) {
            const here = order(dayType, b.slot);
            const before = s.blocks
              .filter(x => G.countsTowardVolume(x) && x.pattern === b.pattern &&
                           order(dayType, x.slot) < here)
              .reduce((a, x) => a + x.sets, 0);
            assert.ok(before < VOLUME.SESSION_DOSE[G.sessionGoal(dayType)],
              `${dayType} w${week} s${seed} slot ${b.slot}: ${before} earlier ${b.pattern} sets`);
          }
          if (!DAY_TYPES[dayType].targets.includes(b.pattern)) offTarget++;
          assert.ok(Array.isArray(b.admittedPatterns) && b.admittedPatterns.length,
            `${dayType} w${week} s${seed} slot ${b.slot}: no admission record`);
          assert.ok(b.admittedPatterns.includes(b.pattern),
            `${dayType} w${week} s${seed} slot ${b.slot}: ${b.pattern} not in [${b.admittedPatterns}]`);
          // Admission needs a qualifying TARGET pattern in the draw set.
          assert.ok(b.admittedPatterns.some(p => DAY_TYPES[dayType].targets.includes(p)),
            `${dayType} w${week} s${seed} slot ${b.slot}: admitted with no target pattern`);
        }
      }
    }
  }
  assert.ok(optional > 0, 'the sweep reached no optional block');
  // And the narrowing does not delete the slots' non-target patterns: carry
  // and rotate are still drawn somewhere in 1,500 sessions.
  assert.ok(offTarget > 0, 'no optional block drew a non-target pattern (carry, rotate)');
});

// --------------------------------------------------------------------------
// No clock on a lifting day (spec §1, §5)
// --------------------------------------------------------------------------

// The athlete, 2026-10-22: "don't set a limit … I want to test the new
// method. Then we can see if the workouts created are too much for me." So
// on a lifting day nothing is dropped or shaved for time: packToBudget is not
// called. spec §1, §5.
test('nothing trims a lifting session', () => {
  for (const dayType of LIFTING) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = session(dayType, week, seed);
        assert.deepEqual(s.trimmedSlots, [], `${dayType} w${week} s${seed}: trimmed ${s.trimmedSlots}`);
        assert.notEqual(s.overBudget, true, `${dayType} w${week} s${seed}: overBudget`);
        assert.ok(!s.warnings.some(w => /main-work budget/.test(w)),
          `${dayType} w${week} s${seed}: ${s.warnings}`);
      }
    }
  }
});

// spec §2 anti-goal: "Any required working set is removed or shaved on a
// lifting day." Replaces tests/work-held.test.mjs (which pinned required
// slots to v78) without a fixture.
//
// METHOD. The fill loop's blocks pass through rampToBudget and
// applyArchitecture; generate() stamps each main-work block's set count at
// that point as `shapedSets` (diagnostic, never rendered -- js/ui.js names the
// fields it prints). After that only two steps may touch a set count:
// capPatternSets (a dose rule, spec §2 keeps it) and pairAntagonists (which
// only groups). So the test rebuilds the shaped session from the finished
// one -- every REQUIRED block carrying `shapedSets`, in template order, with
// `sets` and its work entries restored -- runs the exported capPatternSets on
// those alone (Ruling K: the only permitted loss is required work alone over
// the cap), and requires every required block to come out exactly as the
// card has it. Any other step removing a set (the packer, a clock of any
// kind, optional work) shows up as a required block carrying fewer sets.
//
// Template order IS the shaped order the live cap breaks ties on: the fill
// loop walks TEMPLATES[dayType] in order and pushes each filled slot, and
// nothing reorders before the cap (orderSession runs later). The test pins
// the one thing that reading needs -- slot ids unique per template, so
// findIndex is a total order.
//
// A REMOVED required block cannot be seen by the set comparison (it is not in
// s.blocks to compare), so presence is asserted separately: every required
// template slot that the session does not list in `unfilled` (and that is
// not opt-in gated, `requiresMeasuredGround`) must be on the card.
//
// More sets than v78 is intended: the packer used to shave required sets on
// long max-strength days.
test('required working sets survive to the card', () => {
  let required = 0;
  for (const dayType of LIFTING) {
    const ids = TEMPLATES[dayType].map(sl => sl.slot);
    assert.equal(new Set(ids).size, ids.length, `${dayType}: template slot ids are not unique`);
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = session(dayType, week, seed);
        const tag = `${dayType} w${week} s${seed}`;
        const unfilled = new Set(s.unfilled.map(u => u.slot));
        const onCard = new Set(s.blocks.map(b => b.slot));
        for (const sl of TEMPLATES[dayType]) {
          if (sl.optional || sl.requiresMeasuredGround || unfilled.has(sl.slot)) continue;
          assert.ok(onCard.has(sl.slot), `${tag}: required slot ${sl.slot} was removed`);
        }
        const main = s.blocks.filter(b => G.countsTowardVolume(b));
        assert.ok(main.length && main.every(b => Number.isInteger(b.shapedSets)),
          `${tag}: main-work block without shapedSets`);
        // Ruling K: the REQUIRED blocks alone go through the cap, so the only
        // loss this permits on a required block is the pre-existing
        // required-alone overflow (the cap acting on the template's own draw).
        // Optional work can never cost a required set.
        const rebuilt = main.filter(b => !b.optional)
          .slice().sort((a, b) => order(dayType, a.slot) - order(dayType, b.slot))
          .map(b => {
            const extra = b.shapedSets - b.sets;
            const work = (b.setPlan || []).filter(x => x.kind === 'work');
            return {
              ...b,
              sets: b.shapedSets,
              setPlan: b.setPlan && b.setPlan.concat(
                Array.from({ length: extra }, () => ({ ...work[work.length - 1] })))
            };
          });
        const expected = new Map(G.capPatternSets(rebuilt).map(b => [b.slot, b.sets]));
        for (const b of main.filter(b => !b.optional)) {
          required++;
          assert.equal(b.sets, expected.get(b.slot),
            `${tag} slot ${b.slot} (${b.exerciseId}): ${b.sets} sets on the card, ` +
            `${expected.get(b.slot)} after the ramp, architecture and the cap on required work alone`);
          // setPlan must still agree with what the card prints.
          if (b.setPlan) {
            assert.equal(b.setPlan.filter(x => x.kind === 'work').length, b.sets, `${tag} slot ${b.slot} setPlan`);
          }
        }
      }
    }
  }
  assert.ok(required > 0, 'the sweep reached no required block');
});

// With the packer gone from lifting days nothing can split a pair after
// pairAntagonists, and this holds that: every group is two blocks, adjacent
// on the card. design-architectures.md 3.6.3/3.6.4.
test('every superset is adjacent and complete', () => {
  let groups = 0;
  for (const dayType of LIFTING) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        const s = session(dayType, week, seed);
        const at = {};
        s.blocks.forEach((b, i) => { if (b.group) (at[b.group] = at[b.group] || []).push(i); });
        for (const [g, idx] of Object.entries(at)) {
          groups++;
          assert.equal(idx.length, 2, `${dayType} w${week} s${seed}: group ${g} has ${idx.length} blocks`);
          assert.equal(idx[1] - idx[0], 1, `${dayType} w${week} s${seed}: group ${g} not adjacent`);
        }
      }
    }
  }
  assert.ok(groups > 0, 'the sweep reached no superset');
});

// The v79 pricing hold existed only so a shorter warm-up could not buy work
// while the clock filled sessions. No clock, no hold. spec §5.
test('the v79 hold is gone', () => {
  assert.equal(G.legacyWarmup, undefined, 'generator.js still exports legacyWarmup');
  for (const dayType of [...LIFTING, ...NON_LIFTING]) {
    for (let seed = 1; seed <= 20; seed++) {
      for (const b of session(dayType, 5, seed).blocks) {
        assert.ok(!('budgetWarmupReps' in b), `${dayType} s${seed} ${b.slot}: budgetWarmupReps`);
      }
    }
  }
});

// Deferred from Task 1: an optional power contacts block (slot E) is admitted
// outside the set dose, and its foot contacts are denormalised from the set
// count at prescribe() time. Whatever later removes a set (the ramp, the
// pattern cap) must carry the contacts with it, fixture-free.
test('every contacts block on a lifting day carries contactsPerSet x sets', () => {
  let optional = 0;
  for (const dayType of LIFTING) {
    for (let week = 1; week <= 5; week++) {
      for (let seed = 1; seed <= 100; seed++) {
        for (const b of session(dayType, week, seed).blocks.filter(b => b.mode === 'contacts')) {
          if (b.optional) optional++;
          assert.equal(b.footContacts, b.contactsPerSet * b.sets,
            `${dayType} w${week} s${seed} slot ${b.slot}: ${b.footContacts} contacts, ` +
            `${b.contactsPerSet} x ${b.sets} sets`);
        }
      }
    }
  }
  assert.ok(optional > 0, 'the sweep reached no optional contacts block');
});

// Controller Ruling J (2026-10-22): spec §2's anti-goal -- no required working
// set shaved on a lifting day -- outranks keeping capPatternSets as it was.
// With no clock, an optional block admitted under the dose (9 < 10) could take
// a pattern to 11, and the cap then shaved the biggest block -- a REQUIRED one
// on a tie (hypertrophy w5 seed 40, slot A 3 -> 2; 7 of 1,500 sessions).
// With { protectRequired: true } (lifting days) the cap takes sets from the
// optional blocks only, largest first down to setFloor, then drops the
// optional block whole.
const req = (slot, sets) => ({ slot, mode: 'reps', role: 'accessory', pattern: 'push-h', sets, optional: false });
const opt = (slot, sets) => ({ slot, mode: 'reps', role: 'accessory', pattern: 'push-h', sets, optional: true });
test('the pattern cap never shaves a required block on a lifting day', () => {
  // The seed-40 shape: 3 + 3 + 3 required, 2 optional = 11 > 10.
  let out = G.capPatternSets([req('A', 3), req('B', 3), req('C', 3), opt('G', 2)], 10, { protectRequired: true });
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 3], ['B', 3], ['C', 3], ['G', 1]]);
  // Shaving the optional block to its floor is not enough: it is dropped.
  out = G.capPatternSets([req('A', 4), req('B', 3), req('C', 3), opt('G', 2)], 10, { protectRequired: true });
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 4], ['B', 3], ['C', 3]]);
  // Largest optional block first.
  out = G.capPatternSets([req('A', 6), opt('F', 2), opt('G', 4)], 10, { protectRequired: true });
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 6], ['F', 2], ['G', 2]]);
  // Without the option (non-lifting days) the old behaviour stands exactly.
  out = G.capPatternSets([req('A', 3), req('B', 3), req('C', 3), opt('G', 2)], 10);
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 2], ['B', 3], ['C', 3], ['G', 2]]);
});

// Ruling K: when REQUIRED work alone is over the cap (max-strength seed 89
// drew 6 + 4 + 3 = 13 pull-v sets from required slots), the sourced IUSCA cap
// still holds: required blocks are shaved by the old rule -- but only after
// every optional block on the pattern is gone.
test('required work alone over the cap is shaved down to it', () => {
  const pullV = (slot, sets, optional) => ({ slot, mode: 'reps', role: 'accessory', pattern: 'pull-v', sets, optional });
  let out = G.capPatternSets([pullV('A', 6, false), pullV('B', 4, false), pullV('C', 3, false)], 10,
    { protectRequired: true });
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 3], ['B', 4], ['C', 3]]);
  // With an optional block on the pattern it goes first, whole, and only then
  // is required work shaved -- to exactly what the cap does to it alone.
  out = G.capPatternSets([pullV('A', 6, false), pullV('B', 4, false), pullV('C', 3, false),
    pullV('G', 2, true)], 10, { protectRequired: true });
  assert.deepEqual(out.map(b => [b.slot, b.sets]), [['A', 3], ['B', 4], ['C', 3]]);
});
