// The two ceilings, and which one the card is allowed to blame.
//
// Found 2026-09-09 while pricing the snatch deadlift. `rampWeekFor` returns the
// LAST ramp row both for "week 5" and for "no ramp declared", and `rampRow`
// clamps every week past the table to that row -- so its 0.95 ceiling applied
// forever. `prescribe` reported every cap as a ramp cap, so at full volume the
// card said "held down by the return ramp" on 38.3% of max-strength load
// blocks with no ramp running.
//
// The athlete chose to KEEP the cap and fix the sentence, so these tests pin
// both halves: the cap still binds, and it stops lying about why.
// design-library-expansion.md §24.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
import { RAMP, STANDING_PCT_CEILING } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const GYM = ['max-strength', 'power', 'hypertrophy'];

const loadBlocks = session => session.blocks.filter(b => b.mode === 'load');

// The constant must not drift from the table row it silently inherited for
// months. If someone changes the last ramp row, this says so out loud rather
// than letting the two disagree.
test('the standing ceiling equals the last ramp row it grew out of', () => {
  assert.equal(STANDING_PCT_CEILING, RAMP[RAMP.length - 1].pctCeiling);
});

test('past the ramp, no block ever blames the return ramp', () => {
  let checked = 0;
  for (const dayType of GYM) {
    for (let seed = 1; seed <= 300; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      assert.equal(s.rampWeek, RAMP.length, 'fixture should be past the ramp');
      for (const b of loadBlocks(s)) {
        checked++;
        assert.equal(b.rampLimited, false,
          `${dayType} seed ${seed}: ${b.exerciseId} claims a ramp cap with no ramp running`);
      }
    }
  }
  assert.ok(checked > 1000, `expected a real sample, saw ${checked}`);
});

// The half that MATTERS, and the one the first draft of this file got wrong.
//
// "Flagged capped" does not mean "prints the ceiling". The first clamp bounds
// `pct` -- the fraction of the movement's OWN max -- so a sub-parity prCoef is
// legitimately flagged while printing well under the cap. And a ladder leads
// with its LOWEST rung, which is lower still. The real invariant is not about
// the lead number at all: it is that NOTHING THE CARD PRINTS goes over the
// line, on any set, in any week.
test('no printed working set ever exceeds the ceiling of its week', () => {
  const now = Date.now();
  const weeks = [[null, STANDING_PCT_CEILING]];
  for (let w = 1; w < RAMP.length; w++) {
    weeks.push([new Date(now - (w - 1) * 7 * DAY).toISOString().slice(0, 10),
                RAMP[w - 1].pctCeiling]);
  }
  for (const [returnDate, ceiling] of weeks) {
    for (const dayType of GYM) {
      for (let seed = 1; seed <= 200; seed++) {
        const s = generate({
          library: LIB, dayType, seed,
          profile: returnDate ? { returnDate } : undefined,
          now: returnDate ? now : 1e12
        });
        for (const b of loadBlocks(s)) {
          assert.ok(b.displayMultiplier <= ceiling + 1e-9,
            `week ${s.rampWeek} ${dayType} seed ${seed}: ${b.exerciseId} leads with ` +
            `${b.displayMultiplier} against a ceiling of ${ceiling}`);
          for (const st of b.setPlan || []) {
            if (st.kind !== 'work') continue;
            assert.ok(st.displayMultiplier <= ceiling + 1e-9,
              `week ${s.rampWeek} ${dayType} seed ${seed}: ${b.exerciseId} prints a ` +
              `${st.reps}-rep set at ${st.displayMultiplier} against a ceiling of ${ceiling}`);
          }
        }
      }
    }
  }
});

// The cap was KEPT, so it must still bite. If this goes near zero the ceiling
// has been removed by accident rather than by decision.
test('past the ramp, the standing cap still binds', () => {
  let capped = 0, total = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const s = generate({ library: LIB, dayType: 'max-strength', seed, now: 1e12 });
    for (const b of loadBlocks(s)) {
      total++;
      if (b.ceilingLimited) capped++;
    }
  }
  assert.ok(capped / total > 0.2,
    `the standing cap bound on ${(100 * capped / total).toFixed(1)}% of max-strength ` +
    'load blocks; it was 38.3% when this was written, so near zero means it was removed');
});

// During the ramp nothing changes: that note was always true and stays.
test('inside the ramp the ramp is still blamed, and the standing flag is not set', () => {
  const now = Date.now();
  let seen = 0;
  for (const dayType of GYM) {
    for (let seed = 1; seed <= 120; seed++) {
      const s = generate({
        library: LIB,
        profile: { returnDate: new Date(now).toISOString().slice(0, 10) },
        dayType, seed, now
      });
      assert.equal(s.rampWeek, 1, 'fixture should sit in week 1');
      for (const b of loadBlocks(s)) {
        assert.equal(b.ceilingLimited, false,
          `${b.exerciseId} blamed the standing cap during week 1 of the ramp`);
        if (b.rampLimited) seen++;
      }
    }
  }
  assert.ok(seen > 0, 'week 1 capped nothing at all, which the ramp table forbids');
});

// The two are mutually exclusive by construction. Asserted because the card
// renders a separate note for each and would print both.
test('a block never carries both notes', () => {
  for (const dayType of GYM) {
    for (let seed = 1; seed <= 200; seed++) {
      for (const now of [1e12, Date.now()]) {
        const s = generate({ library: LIB, dayType, seed, now });
        for (const b of loadBlocks(s)) {
          assert.ok(!(b.rampLimited && b.ceilingLimited),
            `${b.exerciseId} claims both a ramp cap and the standing cap`);
        }
      }
    }
  }
});
