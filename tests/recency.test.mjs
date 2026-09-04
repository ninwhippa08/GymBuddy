// The variety target is stated in SESSIONS. The mechanism enforcing it was
// written in DAYS, and his cadence is the gap between the two.
//
// Reported 2026-09-04: "I don't want to do the same squat for weeks."
// Measured before writing any of this, 200 simulated athletes x 30 sessions
// at his real cadence (1-3x/week, irregular):
//
//   gap between consecutive sessions of the SAME day type: median 21 days
//   share of those gaps longer than the 14-day recency window:  100.0%
//   main work repeated from the previous session of that day type: 32.9%
//
// Not 98%. One hundred per cent. With seven day types at 1-3 sessions a week
// a day type comes round every three weeks or so, and `recentExerciseIds` was
// built from `recent`, which is truncated to VOLUME.HISTORY_DAYS (14). So the
// 0.25 penalty at fillSlot never once applied to the comparison he actually
// notices -- this squat day against the last squat day.
//
// This is the THIRD instance of one bug. buildState already carries two
// comments warning about it, both beginning "NOT `recent`: it is truncated to
// VOLUME.HISTORY_DAYS": `hoursSince` (plan-06, a day type starved for a year)
// and `chronicFrom` (a 28-day window that was silently 14). The exercise
// recency set is the one nobody caught.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildState, generate } from '../js/generator.js';
import { VOLUME, VARIETY } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const NOW = Date.parse('2026-09-01T12:00:00Z');
const iso = t => new Date(t).toISOString().slice(0, 10);
const PROFILE = { returnDate: '2026-01-01', banned: [], plyoLevel: 'beginner' };

const sessionAt = (daysAgo, ids, dayType = 'max-strength') => ({
  date: iso(NOW - daysAgo * DAY),
  dayType,
  cnsLoad: 4,
  patternSets: {},
  blocks: ids.map(id => ({ exerciseId: id, role: 'primary', pattern: 'squat',
                           mode: 'load', sets: 3 }))
});

// --------------------------------------------------------------------------
// The window is counted in sessions
// --------------------------------------------------------------------------

test('a movement from three weeks ago is still recent if it is the last session', () => {
  // The whole bug in one assertion. 21 days is the MEDIAN gap between two
  // sessions of the same day type at his cadence, so this is the ordinary
  // case, not an edge case.
  const history = [sessionAt(21, ['back-squat'])];
  const state = buildState(PROFILE, history, NOW);
  assert.ok(state.recentExerciseIds.has('back-squat'),
    'the movement he did last time must be penalised this time, ' +
    `even though 21 days is outside the ${VOLUME.HISTORY_DAYS}-day volume window`);
});

test('the window is the last N sessions, however long ago they were', () => {
  const history = [];
  for (let i = VARIETY.RECENT_SESSIONS + 4; i >= 1; i--) {
    history.push(sessionAt(i * 30, [`move-${i}`]));   // one a month, all old
  }
  const state = buildState(PROFILE, history, NOW);
  assert.equal(state.recentExerciseIds.size, VARIETY.RECENT_SESSIONS,
    'exactly the last N sessions contribute, regardless of their dates');
  assert.ok(state.recentExerciseIds.has('move-1'), 'the most recent counts');
  assert.ok(!state.recentExerciseIds.has(`move-${VARIETY.RECENT_SESSIONS + 4}`),
    'the oldest, beyond N sessions, does not');
});

test('the volume windows are NOT widened with it', () => {
  // recentExerciseIds is the only thing that moves. patternSets is a 7-day
  // rolling count and the CNS account decays by hours; both are sourced and
  // both would be wrong if they started reading months-old sessions.
  const history = [sessionAt(90, ['back-squat'])];
  history[0].patternSets = { squat: 5 };
  history[0].cnsLoad = 9;
  const state = buildState(PROFILE, history, NOW);
  assert.ok(state.recentExerciseIds.has('back-squat'), 'recency sees it');
  assert.equal(state.patternSets.squat ?? 0, 0,
    'a session 90 days ago contributes no weekly volume');
  assert.equal(state.cnsAccount, 0, 'and no CNS load');
});

test('an empty history is still empty', () => {
  assert.equal(buildState(PROFILE, [], NOW).recentExerciseIds.size, 0);
});

// --------------------------------------------------------------------------
// What he actually notices
// --------------------------------------------------------------------------

// Walk his cadence forward, committing each session the way the app does, and
// measure the overlap between consecutive sessions OF THE SAME DAY TYPE.
// That is the comparison behind "the same squat for weeks" -- overall variety
// was never the problem, and this file must not claim it was.
function sameDayTypeRepeatRate(runs = 60, sessions = 24) {
  let repeated = 0, compared = 0;
  for (let run = 0; run < runs; run++) {
    let seed = run * 613 + 3;
    const history = [], timeline = [];
    for (let i = 0; i < sessions; i++) {
      const at = NOW - (sessions - i) * 3 * DAY;
      const s = generate({ library: LIB, history, seed: seed++, now: at, profile: PROFILE });
      const main = s.blocks
        .filter(b => !['prep', 'mobility', 'core'].includes(b.role))
        .map(b => b.exerciseId);
      timeline.push({ dayType: s.dayType, ids: main });
      history.push({ date: iso(at), dayType: s.dayType, cnsLoad: s.cnsLoad,
                     patternSets: s.patternSets, blocks: s.blocks });
    }
    const byType = {};
    for (const s of timeline) (byType[s.dayType] ||= []).push(s);
    for (const list of Object.values(byType)) {
      for (let k = 1; k < list.length; k++) {
        compared += list[k].ids.length;
        repeated += list[k].ids.filter(id => list[k - 1].ids.includes(id)).length;
      }
    }
  }
  return repeated / compared;
}

test('a day type no longer repeats a third of its main work', () => {
  // This harness reads 14.1% against the fix and 25.0% against main, so the
  // 20% threshold sits between the two with margin on both sides rather than
  // hugging the achieved number. (The 32.9% quoted at the top of this file is
  // the RETURN-RAMP harness, a different regime -- it reads 20.0% after the
  // fix. Two harnesses, two honest numbers, neither quoted as the other.)
  // The sweep that chose VARIETY.RECENT_SESSIONS = 8, and the finding that a
  // WIDER window is worse, are in docs/design-library-expansion.md §12.3.
  const rate = sameDayTypeRepeatRate();
  assert.ok(rate < 0.20,
    `${(rate * 100).toFixed(1)}% of main work repeats from the previous ` +
    'session of the same day type; it was 32.9% before the window was ' +
    'counted in sessions, and must be well clear of that');
});

test('the fix does not empty a pool -- every required slot still fills', () => {
  // The penalty is a downweight, not a ban, precisely so a thin pool degrades
  // instead of failing. Assert that directly rather than trusting it.
  let unfilledRequired = 0, sessions = 0;
  for (let run = 0; run < 40; run++) {
    let seed = run * 911 + 5;
    const history = [];
    for (let i = 0; i < 20; i++) {
      const at = NOW - (20 - i) * 3 * DAY;
      const s = generate({ library: LIB, history, seed: seed++, now: at, profile: PROFILE });
      sessions++;
      unfilledRequired += s.warnings.filter(w => w.startsWith('no eligible exercise')).length;
      history.push({ date: iso(at), dayType: s.dayType, cnsLoad: s.cnsLoad,
                     patternSets: s.patternSets, blocks: s.blocks });
    }
  }
  assert.equal(unfilledRequired, 0,
    `${unfilledRequired} unfilled required slots across ${sessions} sessions`);
});
