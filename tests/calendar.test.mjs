// Month-grid arithmetic. design-home-and-calendar.md §5.
//
// No dom-shim import on purpose: js/calendar.js must hold no DOM, and this
// file crashing on import is how that stays true.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  monthGrid, monthLabel, shiftMonth, daysSinceLastSession,
  DAY_TYPE_CODE, WEEKDAY_LABELS
} from '../js/calendar.js';

const done = (date, dayType = 'max-strength') =>
  ({ date, dayType, confirmed: true, blocks: [] });

// --------------------------------------------------------------------------
// The constraint that keeps the module pure
// --------------------------------------------------------------------------

test('calendar.js never calls toISOString', () => {
  // localDate() exists because toISOString() locked the card the morning after
  // an evening session. Month arithmetic is that bug one step harder.
  //
  // Comments are stripped before the check. The module's own header explains
  // at length why it does not use toISOString, and the first version of this
  // test failed on that explanation -- which would have left exactly two ways
  // to go green: delete the reasoning, or weaken the test. Neither is the
  // thing being asked for. What is being asked for is that no CODE calls it.
  const src = readFileSync(new URL('../js/calendar.js', import.meta.url), 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/^[ \t]*\/\/.*$/gm, '')    // whole-line comments
    .replace(/[ \t]+\/\/.*$/gm, '');    // trailing comments
  assert.equal(/toISOString/.test(code), false,
    'js/calendar.js calls toISOString outside a comment');
});

// --------------------------------------------------------------------------
// Shape
// --------------------------------------------------------------------------

test('a grid is always six weeks of seven days', () => {
  for (const [y, m] of [[2026, 2], [2026, 9], [2027, 1], [2024, 2]]) {
    const g = monthGrid(y, m, [], '2026-09-01');
    assert.equal(g.length, 6, `${y}-${m} week count`);
    for (const week of g) assert.equal(week.length, 7);
  }
});

test('weeks start Monday', () => {
  // 2026-09-01 is a Tuesday, so the grid opens on Monday 2026-08-31.
  const g = monthGrid(2026, 9, [], '2026-09-01');
  assert.equal(g[0][0].date, '2026-08-31');
  assert.equal(g[0][0].inMonth, false);
  assert.equal(g[0][1].date, '2026-09-01');
  assert.equal(g[0][1].inMonth, true);
});

test('a month starting on a Monday needs no leading padding', () => {
  // 2026-06-01 is a Monday.
  const g = monthGrid(2026, 6, [], '2026-06-01');
  assert.equal(g[0][0].date, '2026-06-01');
  assert.equal(g[0][0].inMonth, true);
});

test('every date in the grid is a YYYY-MM-DD string', () => {
  const g = monthGrid(2026, 9, [], '2026-09-01');
  for (const week of g) {
    for (const cell of week) assert.match(cell.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('the grid is 42 consecutive days', () => {
  const flat = monthGrid(2026, 9, [], '2026-09-01').flat();
  assert.equal(flat.length, 42);
  for (let i = 1; i < flat.length; i++) {
    const prev = new Date(`${flat[i - 1].date}T00:00:00`);
    const cur = new Date(`${flat[i].date}T00:00:00`);
    assert.equal((cur - prev) / 86400000, 1, `gap before ${flat[i].date}`);
  }
});

// --------------------------------------------------------------------------
// Month boundaries
// --------------------------------------------------------------------------

test('February in a leap year carries the 29th', () => {
  const dates = monthGrid(2024, 2, [], '2024-02-01').flat()
    .filter(c => c.inMonth).map(c => c.date);
  assert.equal(dates.length, 29);
  assert.equal(dates.at(-1), '2024-02-29');
});

test('February in a common year stops at the 28th', () => {
  const dates = monthGrid(2026, 2, [], '2026-02-01').flat()
    .filter(c => c.inMonth).map(c => c.date);
  assert.equal(dates.length, 28);
  assert.equal(dates.at(-1), '2026-02-28');
});

test('a 31-day month carries all 31', () => {
  const dates = monthGrid(2026, 1, [], '2026-01-01').flat()
    .filter(c => c.inMonth).map(c => c.date);
  assert.equal(dates.length, 31);
});

test('a session on the 1st and one on the 31st both land in the grid', () => {
  const g = monthGrid(2026, 1, [done('2026-01-01'), done('2026-01-31')], '2026-02-05');
  const marked = g.flat().filter(c => c.session);
  assert.deepEqual(marked.map(c => c.date), ['2026-01-01', '2026-01-31']);
});

// --------------------------------------------------------------------------
// Sessions on cells
// --------------------------------------------------------------------------

test('a confirmed session is attached to its day', () => {
  const g = monthGrid(2026, 9, [done('2026-09-14', 'power')], '2026-09-20');
  const cell = g.flat().find(c => c.date === '2026-09-14');
  assert.equal(cell.session.dayType, 'power');
});

test('an unconfirmed session is not a training day', () => {
  // design §4: if he did not click completed, assume he did not complete it.
  const history = [{ date: '2026-09-14', dayType: 'power', blocks: [] }];
  const g = monthGrid(2026, 9, history, '2026-09-20');
  assert.equal(g.flat().find(c => c.date === '2026-09-14').session, null);
});

test('a month with no training has no marked days', () => {
  const g = monthGrid(2026, 9, [done('2026-07-04')], '2026-09-20');
  assert.equal(g.flat().filter(c => c.session).length, 0);
});

test('a session outside the month does not leak in through a padding cell', () => {
  // 2026-08-31 is a padding cell of September's grid. It is not September.
  const g = monthGrid(2026, 9, [done('2026-08-31')], '2026-09-20');
  const cell = g.flat().find(c => c.date === '2026-08-31');
  assert.equal(cell.inMonth, false);
  assert.equal(cell.session, null);
});

// --------------------------------------------------------------------------
// today
// --------------------------------------------------------------------------

test('exactly one cell is today, in the month containing it', () => {
  const g = monthGrid(2026, 9, [], '2026-09-14');
  assert.equal(g.flat().filter(c => c.isToday).length, 1);
  assert.equal(g.flat().find(c => c.isToday).date, '2026-09-14');
});

test('no cell is today in a month that does not contain it', () => {
  const g = monthGrid(2026, 3, [], '2026-09-14');
  assert.equal(g.flat().filter(c => c.isToday).length, 0);
});

test('a padding cell is never today', () => {
  // 2026-08-31 pads September's grid; on that date, September shows no today.
  const g = monthGrid(2026, 9, [], '2026-08-31');
  assert.equal(g.flat().filter(c => c.isToday).length, 0);
});

// --------------------------------------------------------------------------
// Labels and navigation
// --------------------------------------------------------------------------

test('a month is labelled by name and year', () => {
  assert.equal(monthLabel(2026, 9), 'September 2026');
  assert.equal(monthLabel(2026, 1), 'January 2026');
});

test('weekday labels start Monday and there are seven', () => {
  assert.deepEqual(WEEKDAY_LABELS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('shifting a month rolls the year at both ends', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 9, -1), { year: 2026, month: 8 });
});

// --------------------------------------------------------------------------
// Days since the last session
// --------------------------------------------------------------------------

test('days since the last confirmed session', () => {
  assert.equal(daysSinceLastSession([done('2026-09-11')], '2026-09-14'), 3);
});

test('training today reads as zero days', () => {
  assert.equal(daysSinceLastSession([done('2026-09-14')], '2026-09-14'), 0);
});

test('an unconfirmed session does not count as having trained', () => {
  const history = [{ date: '2026-09-13', dayType: 'power', blocks: [] }];
  assert.equal(daysSinceLastSession(history, '2026-09-14'), null);
});

test('no confirmed history reads as null, not a number', () => {
  // The status line branches on this; a sentinel number would render.
  assert.equal(daysSinceLastSession([], '2026-09-14'), null);
});

test('the most recent confirmed session wins regardless of array order', () => {
  const history = [done('2026-09-01'), done('2026-09-12'), done('2026-09-05')];
  assert.equal(daysSinceLastSession(history, '2026-09-14'), 2);
});

// --------------------------------------------------------------------------
// Codes
// --------------------------------------------------------------------------

test('every day type has a distinct two-letter code', () => {
  const codes = Object.values(DAY_TYPE_CODE);
  assert.equal(codes.length, 7);
  assert.equal(new Set(codes).size, 7, 'codes collide');
  for (const c of codes) assert.match(c, /^[A-Z]{2}$/);
});
