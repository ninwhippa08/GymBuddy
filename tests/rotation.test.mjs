// The neglect model's DISTRIBUTION. The suite had 290 tests and not one of
// them could see which day types get proposed, which is why a year-long
// starvation of three day types shipped unnoticed. plan-06.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildState } from '../js/generator.js';

const DAY = 86400e3;
const NOW = Date.parse('2026-09-01T12:00:00Z');
const iso = t => new Date(t).toISOString().slice(0, 10);
const PROFILE = { returnDate: '2026-01-01', banned: [], plyoLevel: 'beginner' };

test('a day type skipped for 40 days is more neglected than one skipped for 20', () => {
  // Both sit outside VOLUME.HISTORY_DAYS (14). Read off `recent`, both came
  // back Infinity -> 99 days -> indistinguishable, and the tie went to
  // whichever appears first in PHASE_1_DAY_TYPES. That is the whole bug.
  const history = [
    { date: iso(NOW - 20 * DAY), dayType: 'sprint', cnsLoad: 5, patternSets: {}, blocks: [] },
    { date: iso(NOW - 40 * DAY), dayType: 'plyometric', cnsLoad: 5, patternSets: {}, blocks: [] }
  ];
  const state = buildState(PROFILE, history, NOW);

  assert.ok(Number.isFinite(state.hoursSince.sprint),
    'a session 20 days ago must be visible, not Infinity');
  assert.ok(Number.isFinite(state.hoursSince.plyometric),
    'a session 40 days ago must be visible, not Infinity');
  assert.ok(state.hoursSince.plyometric > state.hoursSince.sprint,
    'the longer-neglected day type must read as longer-neglected');
});

test('a day type never trained still reads as never', () => {
  const state = buildState(PROFILE, [], NOW);
  assert.equal(state.hoursSince.plyometric, Infinity);
});
