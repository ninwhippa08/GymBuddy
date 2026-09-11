// The foot-contact budget's SCOPE. design-library-expansion.md §36.
//
// `PLYO_CONTACTS_PER_SESSION` bounds plyometric landing volume, and
// `generator.js` accumulates it from `exercise.contactsPerRep` -- but ONLY on
// blocks whose slot is `mode: 'contacts'`, and the field is optional, so a
// missing value is read as zero:
//
//     const per = exercise.contactsPerRep == null ? 0 : exercise.contactsPerRep;
//
// That makes ABSENCE INDISTINGUISHABLE FROM A DELIBERATE ZERO, which is the
// same failure shape the `isometric` flag had before REVIEWED_HOLDS: a fact
// that only a human can assert, asserted by omission. 63 entries reachable by a
// contacts slot declare nothing, and for almost all of them zero is correct --
// a med-ball throw has no foot contacts, a sprint is budgeted in METRES by
// `SPRINT.METERS_PER_SESSION` instead, and an A-skip is a low-amplitude
// technique drill rather than a landing. Three sprint drills DO carry a count,
// because a bound and a power skip have a flight phase and a landing that the
// plyometric literature counts. That line is real and was written down nowhere.
//
// Audited 2026-09-11. These three tests are the audit, kept.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEMPLATES, PREP_BLOCK, COOLDOWN_BLOCK } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

// Every slot any template can present, flattened. Same walk the reachability
// pre-flight of §17.5 uses -- a slot is anything carrying both a `slot` label
// and a selection filter.
const SLOTS = [];
(function walk(node, path) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, path)); return; }
  if (node.slot && (node.tier || node.patterns)) SLOTS.push({ ...node, from: path });
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') walk(v, `${path}.${k}`);
  }
})({ TEMPLATES, PREP_BLOCK, COOLDOWN_BLOCK }, '');

// The eligibility filter, in the subset that depends only on the entry. Venue,
// soreness and equipment are per-session and would make this test depend on a
// profile; every field below is a fact about the library and the templates.
function admits(slot, e) {
  if (slot.tier && !slot.tier.includes(e.tier)) return false;
  if (slot.patterns && !slot.patterns.includes(e.pattern)) return false;
  if (slot.modality && !(e.modalities || []).includes(slot.modality)) return false;
  if (slot.joints && !(e.joints || []).some(j => slot.joints.includes(j))) return false;
  if (slot.targets && !(e.targets || []).some(t => slot.targets.includes(t))) return false;
  if (slot.effortClass && e.effortClass !== slot.effortClass) return false;
  if (slot.plyoIntensity && !slot.plyoIntensity.includes(e.plyoIntensity)) return false;
  return true;
}

const slotsFor = e => SLOTS.filter(s => admits(s, e));

// Non-jump movements that legitimately carry a contact count. Like
// REVIEWED_HOLDS in library.test.mjs, this is a HUMAN CLAIM written down rather
// than a rule derived from the data, and it grows only when someone decides a
// new movement lands hard enough to spend the budget.
//
// The bounds and power skips are here because they have a flight phase and a
// single-leg landing -- the plyometric literature counts them and the A-skips
// and ankling beside them are not counted, which is the line this list draws.
//
// The two push-ups are here at ZERO and that is the point: an upper-body plyo
// spends none of a FOOT-contact budget. Writing the zero is what distinguishes
// "reviewed, and it is nothing" from "nobody looked".
const REVIEWED_CONTACTS = {
  'straight-leg-bound': 1,
  'power-skip': 1,
  'power-skip-for-distance': 1,
  'depth-push-up': 0,
  'plyo-push-up': 0
};

test('every jump-pattern entry declares its foot contacts', () => {
  const silent = LIB
    .filter(e => e.pattern === 'jump' && e.contactsPerRep == null)
    .map(e => e.id);
  assert.deepEqual(silent, [],
    'a jump that declares no contactsPerRep spends none of the plyometric ' +
    'budget, and nothing else in the suite would notice: ' + silent.join(', '));
});

test('a non-jump entry may only carry a contact count if it was reviewed', () => {
  for (const e of LIB) {
    if (e.pattern === 'jump' || e.contactsPerRep == null) continue;
    assert.ok(e.id in REVIEWED_CONTACTS,
      `${e.id} is pattern "${e.pattern}" and claims ${e.contactsPerRep} foot ` +
      'contacts per rep. That is a human claim about how hard it lands -- add ' +
      'it to REVIEWED_CONTACTS with the reason, or drop the field.');
    assert.equal(e.contactsPerRep, REVIEWED_CONTACTS[e.id],
      `${e.id} was reviewed at ${REVIEWED_CONTACTS[e.id]} contacts and now claims ` +
      `${e.contactsPerRep}`);
  }
});

// THE ONE THAT GUARDS THE TRAP. Until now this lived only as a comment on
// RUN_RAISE in templates.js, where it warned a future reader not to widen
// `patterns: ['run']` to admit `jump-rope`: that stage is `mode: 'time'`, so
// three to five minutes of skipping -- 300-700 contacts against a beginner band
// of 50-100 PER SESSION -- would be counted as zero, on all four running days.
//
// A comment asks to be read. This fails.
//
// THE FIRST VERSION OF THIS TEST WAS WRONG AND THE MUTATION FOUND IT. It asked
// whether a landing movement can reach AT LEAST ONE contacts slot, which
// `jump-rope` already does via `plyometric:C` -- so widening RUN_RAISE to
// `['run', 'jump']` left it passing, which is the entire case it exists for.
// The hazard is not "can it ever be counted". It is "can it be drawn somewhere
// that CANNOT count it", because the budget is undercounted every time that
// happens. One slot that miscounts is enough, however many count correctly.
//
// Verified by making the mistake: widening RUN_RAISE turns this red and naming
// `jump-rope`. The first version stayed green.
test('no movement that lands is reachable by a slot that cannot count it', () => {
  const miscounted = [];
  for (const e of LIB) {
    if (!e.contactsPerRep) continue;            // absent or a reviewed zero
    const blind = slotsFor(e).filter(s => s.mode !== 'contacts');
    if (!blind.length) continue;
    miscounted.push(`${e.id} (${e.contactsPerRep}/rep) reachable by ` +
      blind.map(s => `${s.slot}[${s.mode}]`).join(', '));
  }
  assert.deepEqual(miscounted, [],
    'these movements spend foot contacts and can be drawn by a slot dosed by ' +
    'something other than contacts, where the budget will read zero:\n  ' +
    miscounted.join('\n  ') +
    '\nEither teach generator.js to count contacts in that dose mode, or do not ' +
    'admit a landing movement to that slot. design-library-expansion.md §36.');
});
