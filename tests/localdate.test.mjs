// `today()` and `session.date` were built from toISOString(), which is UTC.
// West of UTC an evening session was stamped with TOMORROW's date, so a
// workout confirmed at 20:30 locked the next morning's card -- reported from
// his phone: "it says logged for today and I cannot click anything anymore".
// East of UTC it failed the other way: after local midnight it was still
// yesterday. A training day is a LOCAL calendar day.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, localDate, buildState } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

test('localDate reports the local calendar day, not the UTC one', () => {
  // Constructed in LOCAL time: 2026-09-01 at 20:30, whatever zone this runs in.
  const evening = new Date(2026, 8, 1, 20, 30, 0);
  assert.equal(localDate(evening.getTime()), '2026-09-01');

  // And half an hour after local midnight it is the NEW day.
  const justAfterMidnight = new Date(2026, 8, 2, 0, 30, 0);
  assert.equal(localDate(justAfterMidnight.getTime()), '2026-09-02');
});

test('localDate zero-pads month and day', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 12, 0, 0).getTime()), '2026-01-05');
});

test('a session generated at 20:30 is stamped with that evening, not tomorrow', () => {
  // The bug that locked his card: west of UTC this stamped 2026-09-02, so the
  // next morning the app found a confirmed record for a day he had not trained.
  const evening = new Date(2026, 8, 1, 20, 30, 0).getTime();
  const s = generate({ library: LIB, dayType: 'max-strength', seed: 5, now: evening });
  assert.equal(s.date, '2026-09-01');
});

// A day-string has to be read back as the same day it was written. `date` is
// now a LOCAL calendar day, but Date.parse('2026-09-01') resolves to UTC
// midnight -- so every hours-since figure in buildState was skewed by the
// timezone offset, which is enough to move a session across a 24/48/72 h CNS
// decay bucket and put two high-CNS days back to back.
test('a stored day-string is read back as that LOCAL day', () => {
  const noon = new Date(2026, 8, 1, 12, 0, 0).getTime();
  const state = buildState(
    { returnDate: '2026-01-01', banned: [], plyoLevel: 'beginner' },
    [{ date: '2026-09-01', dayType: 'sprint', cnsLoad: 5, patternSets: {}, blocks: [] }],
    noon
  );
  // Local midnight to local noon is twelve hours, in every timezone there is.
  assert.ok(Math.abs(state.hoursSince.sprint - 12) < 0.001,
    `expected 12 h since local midnight, got ${state.hoursSince.sprint}`);
});
