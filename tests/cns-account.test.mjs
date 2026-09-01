// CNS account regression suite. The bug: finalise()'s `cnsLoad += b.cnsCost
// || 0` summed EVERY block, including prep drills and cool-down stretches.
// The 2026-08-24 mobility split turned one timed mobility block into ~9
// individual drill/stretch blocks, and every mobility-dynamic and
// mobility-static entry carries cnsCost 1, so cnsLoad roughly doubled and
// pinned the account above CNS_VETO_THRESHOLD permanently. From day 3 of
// daily use onward every high-CNS day type (max-strength, power, plyometric,
// sprint) was vetoed every day, forever -- the reported symptom was "I only
// ever get aerobic-steady and interval". js/rules.js §7, generator.js
// finalise().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generate, buildState, proposeDayType, countsTowardVolume
} from '../js/generator.js';
import { HIGH_CNS_DAY_TYPES, CNS_VETO_THRESHOLD, CNS_DECAY } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const HOUR = 3600e3;
const DAY = 86400e3;

// -----------------------------------------------------------------------
// 1. cnsLoad counts only training work, not mobility.
// -----------------------------------------------------------------------
// Mutation check performed by hand (not encoded here, since the guard lives
// in generator.js and this file cannot safely monkeypatch it): moving
// `cnsLoad += b.cnsCost || 0` back outside the `countsTowardVolume` guard in
// finalise() makes this test fail, because the full-block sum then includes
// every prep and cool-down mobility drill's cnsCost of 1.
test('cnsLoad counts only blocks that count toward training volume, not mobility', () => {
  for (const dayType of HIGH_CNS_DAY_TYPES) {
    const s = generate({ library: LIB, dayType, seed: 7, now: 1e12 });

    const expected = s.blocks
      .filter(countsTowardVolume)
      .reduce((sum, b) => sum + (b.cnsCost || 0), 0);
    assert.equal(s.cnsLoad, expected,
      `${dayType}: cnsLoad should equal the sum over countsTowardVolume blocks only`);

    // The session actually has mobility/prep blocks carrying cnsCost, so this
    // is a meaningful guard, not a vacuous one -- the naive full-block sum
    // must be strictly higher than the correct one.
    const naiveSum = s.blocks.reduce((sum, b) => sum + (b.cnsCost || 0), 0);
    const excludedBlocks = s.blocks.filter(b => !countsTowardVolume(b) && b.cnsCost);
    assert.ok(excludedBlocks.length > 0,
      `${dayType}: expected at least one excluded block carrying cnsCost`);
    assert.ok(naiveSum > expected,
      `${dayType}: the naive sum (${naiveSum}) should exceed the guarded one (${expected})`);
  }
});

test('every mobility-dynamic and mobility-static drill is excluded from cnsLoad by mode', () => {
  const mobility = LIB.filter(e =>
    (e.modalities || []).includes('mobility-dynamic') ||
    (e.modalities || []).includes('mobility-static')
  );
  assert.ok(mobility.length > 0, 'fixture sanity: mobility entries exist');
  for (const e of mobility) {
    // A mobility block is always mode 'drill' or 'hold' (prescribeMobility),
    // neither of which is in VOLUME_MODES, so countsTowardVolume must be
    // false for it regardless of role.
    assert.ok(!countsTowardVolume({ mode: 'drill', role: 'prep', cnsCost: e.cnsCost }));
    assert.ok(!countsTowardVolume({ mode: 'hold', role: 'mobility', cnsCost: e.cnsCost }));
  }
});

// -----------------------------------------------------------------------
// 2. The §7 spacing: vetoed within 24 h, vetoed again at 48 h, permitted by
//    72 h+. Sessions are constructed directly with an exact midnight date so
//    the day-granularity of `session.date` cannot shift the hour boundaries.
// -----------------------------------------------------------------------
function highCnsSessionAt(dayType, midnightMs) {
  const s = generate({ library: LIB, dayType, seed: 3, now: midnightMs });
  assert.equal(s.date, new Date(midnightMs).toISOString().slice(0, 10));
  return s;
}

test('a high-CNS day is vetoed at 1h and 24h, vetoed again at 48h, and permitted at 72h+', () => {
  const midnight = Date.parse('2030-01-01T00:00:00Z');
  const seedSession = highCnsSessionAt('sprint', midnight);
  assert.ok(seedSession.cnsLoad > CNS_VETO_THRESHOLD,
    'fixture sanity: a hard day must actually exceed the threshold acutely');

  const history = [seedSession];
  const vetoedAt = (hours) => {
    const now = midnight + hours * HOUR;
    const state = buildState({}, history, now);
    const proposal = proposeDayType(state, {});
    // Every high-CNS type shares one account -- check them all, not just the
    // one that was just trained.
    return HIGH_CNS_DAY_TYPES.map(dt => {
      const cand = proposal.candidates.find(c => c.dayType === dt);
      return { dayType: dt, vetoed: cand.vetoed };
    });
  };

  for (const { dayType, vetoed } of vetoedAt(1)) {
    assert.ok(vetoed, `${dayType} should be vetoed 1h after a hard day`);
  }
  for (const { dayType, vetoed } of vetoedAt(24)) {
    assert.ok(vetoed, `${dayType} should be vetoed 24h after a hard day`);
  }
  for (const { dayType, vetoed } of vetoedAt(48)) {
    assert.ok(vetoed, `${dayType} should be vetoed 48h after a hard day`);
  }
  for (const { dayType, vetoed } of vetoedAt(72)) {
    assert.ok(!vetoed, `${dayType} should be permitted by 72h after a hard day`);
  }
});

// Direct arithmetic check of CNS_DECAY x CNS_VETO_THRESHOLD against the
// measured cnsLoad range -- the derivation itself, asserted as a property.
//
// The range is SWEPT HERE, live, rather than hardcoded. A hardcoded
// MEASURED_MIN_LOAD/MEASURED_MAX_LOAD is exactly the failure shape this PR
// fixes: a number baked in as a comment or a literal, silently invalidated
// the next time data/exercises.json changes, with nothing to notice. The old
// CNS_VETO_THRESHOLD comment ("cnsCost 1-3 over a ~6-slot session") was
// exactly that kind of stale literal.
//
// SEED_COUNT = 30: seeds 1..20 already reproduce the true 300-seed floor and
// ceiling for every HIGH_CNS_DAY_TYPES member exactly (verified by hand --
// max-strength's floor of 5 first appears at seed 20, the latest of any
// type's extremum among the four); 30 keeps a margin past that first
// occurrence without paying for anywhere near 300 generate() calls per type.
// generate() is fast enough (this suite's other sweeps run hundreds of
// sessions in milliseconds) that this adds negligible time to the run.
const SEED_COUNT = 30;

function sweepCnsLoadRange() {
  let min = Infinity, max = -Infinity;
  for (const dayType of HIGH_CNS_DAY_TYPES) {
    for (let seed = 1; seed <= SEED_COUNT; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      if (s.cnsLoad < min) min = s.cnsLoad;
      if (s.cnsLoad > max) max = s.cnsLoad;
    }
  }
  return { min, max };
}

test('the threshold enforces 48-72h spacing across the measured hard-day load range', () => {
  const retainedAt = (hours) => {
    const bucket = CNS_DECAY.find(b => hours < b.withinHours);
    return bucket.retained;
  };
  const { min: measuredMinLoad, max: measuredMaxLoad } = sweepCnsLoadRange();

  // Sanity: the sweep actually produced a real range, not a degenerate one
  // (e.g. an empty library or a broken generator returning a constant).
  assert.ok(Number.isFinite(measuredMinLoad) && measuredMinLoad > 0,
    'the sweep should have measured a positive cnsLoad floor');

  // Nothing in the measured range clears before 48h. This is the binding,
  // safety-critical direction: it fails both if CNS_VETO_THRESHOLD is raised
  // too high (>= 2.5 against today's floor of 5) AND if a future library
  // edit quietly lowers the real floor below what the current threshold
  // assumes is safe -- both change measuredMinLoad or CNS_VETO_THRESHOLD,
  // and this assertion reads both live.
  assert.ok(measuredMinLoad * retainedAt(47) > CNS_VETO_THRESHOLD,
    `the lightest measured hard day (${measuredMinLoad}) must still be vetoed just before 48h`);
  // Everything clears by 72h -- retained is 0 there regardless of load.
  assert.equal(retainedAt(72), 0);
  assert.ok(measuredMaxLoad * retainedAt(72) <= CNS_VETO_THRESHOLD,
    'the heaviest measured hard day must be clear at 72h');
});

// -----------------------------------------------------------------------
// 3. Regression for the reported symptom: over a run of consecutive daily
//    sessions, high-CNS day types must not be vetoed indefinitely. This is
//    the reproduction from the bug report -- it fails against the old
//    behaviour (verified by hand: reverting cnsLoad's accumulation to sit
//    outside the countsTowardVolume guard, or reverting CNS_VETO_THRESHOLD
//    to 8, reproduces "0 high-CNS days from day 3 onward" here).
// -----------------------------------------------------------------------
test('daily use for 21 days does not lock high-CNS day types out forever', () => {
  const start = Date.parse('2030-02-01T00:00:00Z');
  const history = [];
  const dayTypes = [];
  for (let d = 0; d < 21; d++) {
    const now = start + d * DAY;
    const s = generate({ library: LIB, history, seed: 1000 + d, now });
    history.push(s);
    dayTypes.push(s.dayType);
  }

  const highCnsDays = dayTypes.filter(dt => HIGH_CNS_DAY_TYPES.includes(dt));
  assert.ok(highCnsDays.length >= 3,
    `expected high-CNS day types to reappear in the rotation, got: ${dayTypes.join(', ')}`);

  // From day 3 (index 2) onward is where the old bug locked out every
  // high-CNS type forever -- assert at least one shows up in that tail.
  const tail = dayTypes.slice(2);
  assert.ok(tail.some(dt => HIGH_CNS_DAY_TYPES.includes(dt)),
    `no high-CNS day type appeared from day 3 onward: ${tail.join(', ')}`);
});

test('the fix is not too permissive: no back-to-back high-CNS days across 21 days', () => {
  const start = Date.parse('2030-03-01T00:00:00Z');
  const history = [];
  const dayTypes = [];
  for (let d = 0; d < 21; d++) {
    const now = start + d * DAY;
    const s = generate({ library: LIB, history, seed: 2000 + d, now });
    history.push(s);
    dayTypes.push(s.dayType);
  }

  for (let i = 1; i < dayTypes.length; i++) {
    const prevHigh = HIGH_CNS_DAY_TYPES.includes(dayTypes[i - 1]);
    const currHigh = HIGH_CNS_DAY_TYPES.includes(dayTypes[i]);
    assert.ok(!(prevHigh && currHigh),
      `day ${i - 1} (${dayTypes[i - 1]}) and day ${i} (${dayTypes[i]}) are both high-CNS`);
  }
});
