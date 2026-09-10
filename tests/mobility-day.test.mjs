// The deload day. spec §5, built 2026-09-04.
//
// It exists for one situation: everything else is vetoed. Its whole content is
// the prep block and the full cool-down, so it invents no dose -- but it must
// stay inert in the three accounts that decide what gets proposed next, or a
// deload would make the next day harder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, estimateMinutes } from '../js/generator.js';
import { DAY_TYPES, TEMPLATES, PHASE_1_DAY_TYPES, PREP_BLOCK } from '../js/templates.js';

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

// --------------------------------------------------------------------------
// Balance on the deload, added 2026-09-09. design-library-expansion.md §28.
//
// §22 put balance on the four outdoor day types and excluded the gym prep ON
// THE CLOCK -- gym days hold 3 minutes of headroom against the 70-minute
// ceiling. The deload shared `PREP_BLOCK.full` with them and inherited an
// exclusion written for a constraint it does not have: it runs 16 minutes and
// holds 52 of headroom, the most in the app.
// --------------------------------------------------------------------------

const byId = new Map(LIB.map(e => [e.id, e]));
const balanceBlocks = s =>
  s.blocks.filter(b => {
    const e = byId.get(b.exerciseId);
    return e && e.pattern === 'balance';
  });

test('the deload has its own prep variant rather than sharing the gym one', () => {
  assert.equal(DAY_TYPES.mobility.prep, 'deload');
  // The point of the split. If these ever become the same array again the
  // gym day types silently inherit a stage their clock cannot pay for.
  assert.notDeepEqual(PREP_BLOCK.deload, PREP_BLOCK.full);
  assert.equal(PREP_BLOCK.full.length, 1, 'the gym prep gained a stage');
});

test('every deload delivers balance work', () => {
  // 19.2's rule: counted is not delivered. This is the assertion that would
  // have caught §22.1's undelivered warm-up stages.
  for (let seed = 1; seed <= 300; seed++) {
    assert.equal(balanceBlocks(deload(seed)).length, 1,
      `seed ${seed} delivered no balance block on a deload`);
  }
});

test('the deload draws the whole balance pool, not a corner of it', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 400; seed++) {
    for (const b of balanceBlocks(deload(seed))) seen.add(b.exerciseId);
  }
  const pool = LIB.filter(e => e.pattern === 'balance').map(e => e.id);
  assert.deepEqual([...seen].sort(), [...pool].sort(),
    'some balance entries are never reachable from the deload');
});

// Why the stage is OPTIONAL here where the running prep has it required. The
// balance pool is entirely ankle/knee/hip, and the deload is the day type
// reached when everything else is VETOED -- disproportionately the day he is
// sore. A required stage with an empty pool would report an unfilled slot on
// the one day that exists to be gentle.
test('a hurt ankle removes the balance stage without leaving a hole', () => {
  for (const joint of ['ankle', 'knee', 'hip']) {
    for (let seed = 1; seed <= 100; seed++) {
      const s = generate({
        library: LIB, profile: {}, history: [],
        soreness: { [joint]: 'hurt' }, dayType: 'mobility', seed, now: 1e12
      });
      assert.equal(balanceBlocks(s).length, 0,
        `seed ${seed} prescribed balance work on a hurt ${joint}`);
      assert.equal((s.unfilled || []).length, 0,
        `seed ${seed} reported an unfilled slot instead of skipping the stage`);
      assert.ok(s.blocks.length > 0, `seed ${seed} produced an empty deload`);
    }
  }
});

test('adding the stage did not push the deload near anyone else\u2019s ceiling', () => {
  let worst = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    worst = Math.max(worst, estimateMinutes(deload(seed).blocks));
  }
  // Measured at 20 when this landed, against a 70-minute session limit. The
  // bound is deliberately loose: it is here to catch a stage being added to
  // the wrong prep variant, not to pin the exact figure.
  assert.ok(worst <= 30,
    `the deload now runs to ${worst} min; it was 18 before balance and 20 after`);
});
