// The neglect model's DISTRIBUTION. The suite had 290 tests and not one of
// them could see which day types get proposed, which is why a year-long
// starvation of three day types shipped unnoticed. plan-06.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildState, proposeDayType } from '../js/generator.js';
import { NEGLECT_CAP_DAYS } from '../js/rules.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';
import { readFileSync } from 'node:fs';
import { resolveSession } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

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

// A state built by hand: every day type trained recently EXCEPT the two under
// test, so the winner is decided purely by which is more neglected.
function stateWith(daysAgoByType) {
  const hoursSince = {};
  for (const dt of ['max-strength', 'power', 'hypertrophy', 'aerobic-steady',
                    'interval', 'sprint', 'plyometric']) {
    hoursSince[dt] = 1;                       // trained an hour ago
  }
  for (const [dt, days] of Object.entries(daysAgoByType)) hoursSince[dt] = days * 24;
  return { hoursSince, cnsAccount: 0, rampWeek: 5, chronicLoad: 0, gymShare: 0,
           weeksSinceEasyWeek: 0, patternSets: {}, recent: [] };
}

test('the most neglected day type wins, even when both are past three weeks', () => {
  // 21 was a bare literal and flattened these two to the same score, so the
  // one earlier in PHASE_1_DAY_TYPES took it every time.
  const p = proposeDayType(stateWith({ sprint: 25, plyometric: 45 }), { soreness: {} });
  assert.equal(p.dayType, 'plyometric');
});

test('the cap stops an abandoned day type outranking everything forever', () => {
  const beyond = proposeDayType(
    stateWith({ sprint: NEGLECT_CAP_DAYS + 200, plyometric: NEGLECT_CAP_DAYS + 400 }),
    { soreness: {} }
  );
  const sprintScore = beyond.candidates.find(c => c.dayType === 'sprint').score;
  const plyoScore = beyond.candidates.find(c => c.dayType === 'plyometric').score;
  assert.equal(sprintScore, plyoScore, 'both are past the cap and should saturate together');
  assert.equal(sprintScore, NEGLECT_CAP_DAYS);
});

test('array order does not decide the proposal when neglect differs', () => {
  // plyometric is LAST in PHASE_1_DAY_TYPES, so if order still decides, it
  // loses. Give it the most neglect and it must win from last position.
  const daysAgo = {};
  PHASE_1_DAY_TYPES.forEach((dt, i) => { daysAgo[dt] = 20 + i; });   // plyometric = most
  const p = proposeDayType(stateWith(daysAgo), { soreness: {} });
  assert.equal(p.dayType, 'plyometric', 'the most neglected day type must win from last position');

  // And the reverse: the FIRST entry wins when it is the most neglected, so
  // this is not simply an inverted order.
  const reversed = {};
  PHASE_1_DAY_TYPES.forEach((dt, i) => { reversed[dt] = 40 - i; });  // max-strength = most
  assert.equal(proposeDayType(stateWith(reversed), { soreness: {} }).dayType, 'max-strength');
});

// Walk a year at a given cadence, committing each session the way app.js does
// (commitSession REPLACES by date), and count what was actually proposed.
function yearOfSessions(perWeek) {
  const start = Date.parse('2026-01-05T12:00:00Z');
  const profile = { returnDate: iso(start), banned: [], plyoLevel: 'beginner' };
  let history = [];
  const counts = {};
  for (let i = 0; i < 52 * perWeek; i++) {
    const t = start + Math.round(i * 7 / perWeek) * DAY;
    const r = resolveSession({
      library: LIB, profile, history, soreness: {},
      dayType: null, excludeEquipment: [], seed: t, now: t
    });
    if (!r.session) continue;
    const s = { ...r.session, date: iso(t), confirmed: true };
    history = [s, ...history.filter(h => h.date !== s.date)];
    counts[s.dayType] = (counts[s.dayType] || 0) + 1;
  }
  return counts;
}

// He trains 1-3x/week, irregularly. Every one of those cadences must reach
// every day type. Before plan-06: at 1x/week hypertrophy, sprint and
// plyometric were each proposed ZERO times in a full year.
for (const perWeek of [1, 2, 3]) {
  test(`every day type is proposed at least once a year at ${perWeek}x/week`, () => {
    const counts = yearOfSessions(perWeek);
    const missing = PHASE_1_DAY_TYPES.filter(dt => !counts[dt]);
    assert.deepEqual(missing, [],
      `never proposed in a year at ${perWeek}x/week: ${missing.join(', ')} ` +
      `(got ${JSON.stringify(counts)})`);
  });
}
