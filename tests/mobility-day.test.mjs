// The deload day. spec §5, built 2026-09-04.
//
// It exists for one situation: everything else is vetoed. Its whole content is
// the prep block and the full cool-down, so it invents no dose -- but it must
// stay inert in the three accounts that decide what gets proposed next, or a
// deload would make the next day harder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
import { DAY_TYPES, TEMPLATES, PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const deload = (seed = 1) => generate({
  library: LIB, profile: {}, history: [], soreness: {},
  dayType: 'mobility', seed, now: 1e12
});

test('a deload adds nothing to the CNS account', () => {
  // If it did, the day taken because everything was vetoed would push the
  // account further and veto more of tomorrow.
  for (let seed = 1; seed <= 200; seed++) {
    assert.equal(deload(seed).cnsLoad, 0, `seed ${seed} charged the CNS account`);
  }
});

test('a deload contributes no pattern volume', () => {
  // patternSets drives both the neglect score and coverage debt. A deload that
  // paid down debt would make the app think the week was covered.
  for (let seed = 1; seed <= 200; seed++) {
    assert.deepEqual(deload(seed).patternSets, {}, `seed ${seed} claimed volume`);
  }
});

test('a deload is still a session -- prep and cool-down, nothing between', () => {
  const s = deload(3);
  const roles = new Set(s.blocks.map(b => b.role));
  assert.ok(s.blocks.length > 0, 'a deload with no blocks is a rest day, not a session');
  assert.ok(roles.has('prep'), 'the dynamic warm-up is half the point');
  assert.ok(roles.has('mobility'), 'the static work is the other half');
  assert.deepEqual([...roles].filter(r => !['prep', 'mobility', 'core'].includes(r)), [],
    'no main work: the template is empty on purpose');
});

test('a deload carries no load and nothing unfilled', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = deload(seed);
    assert.equal((s.unfilled || []).length, 0, `seed ${seed} left a slot unfilled`);
    assert.deepEqual(s.blocks.filter(b => b.setPlan), [],
      `seed ${seed} prescribed a warm-up ramp on a deload`);
  }
});

test('the deload stays out of the rotation', () => {
  // It must never compete on neglect, or it becomes a day type he is told to
  // do because he has not done it lately -- which is the opposite of a deload.
  assert.ok(!PHASE_1_DAY_TYPES.includes('mobility'),
    'the deload is reached by the all-vetoed fallback, never by the rotation');
  assert.ok(DAY_TYPES.mobility, 'but it is still a declared day type');
  assert.deepEqual(TEMPLATES.mobility, [], 'with an empty template');
});
