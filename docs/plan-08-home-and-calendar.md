# A Home Screen and a Month Calendar (design-home-and-calendar.md) — Implementation Plan

> **BUILT 2026-09-02.** All eight tasks executed on `feat/home-and-calendar`,
> plus an unplanned **`tests/app.test.mjs`**: the plan accepted "app.js gets no
> unit tests" and named Task 7's browser script as the compensating control,
> and the browser was unavailable when Task 5 landed. The eight tests it adds
> cover the feature's central claim — launching the app writes nothing — which
> nothing else in the suite can see. `sw.js` v24, **393/393**.
>
> **Task 7's browser check WAS run** (Chrome, local server, 2026-09-02) and is
> recorded in full under "Manual check" at the foot of this file. All seven
> steps pass. It caught two things the suite could not: a horizontal overflow
> at 320px, and a stale service worker that made the first round of CSS
> measurements meaningless.
>
> Still owed: **a real phone.** Every measurement here is Chrome at a
> phone-sized viewport, which is not the same as a thumb on glass —
> `plan-07` shipped with the same gap and `design-card-flip.md` §8 explains
> why it matters.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app opens on a home screen — status, soreness map, a Generate button and a month calendar of confirmed training days — instead of opening straight onto a workout it wrote to history without being asked.

**Architecture:** `resolveSession`/`commitSession` move out of the launch path and behind a button tap, so launching writes nothing. A new pure module `js/calendar.js` turns `(year, month, history, today)` into a month grid model; `ui.js` renders it. The soreness map moves from the session card to the home screen, which deletes the `soreChanged` rebuild path from `showSession`. `renderSession` gains a `readOnly` option so a past day can be reopened without forking the card renderer.

**Tech Stack:** Plain ES modules, no build step, no dependencies. Tests are `node:test` + `node:assert/strict`, run with `node --test "tests/*.test.mjs"`.

**Spec:** `docs/design-home-and-calendar.md`. Read it before Task 1 — this plan implements it section by section, and its §2.1 records two rejected alternatives that a reasonable engineer will otherwise re-propose. The behaviour it changes is specified in `docs/spec.md` §1, §4.1, §6 and §7.

## Global Constraints

- **No dependencies, no build step, no npm.** Plain ES modules only.
- **Run the whole suite with the glob:** `node --test "tests/*.test.mjs"`. `node --test tests/` does NOT work on this machine — it treats `tests` as a file, runs nothing, and reports one failure.
- **`js/calendar.js` must contain no `Date.toISOString()`.** Dates are `YYYY-MM-DD` strings, compared as strings, constructed from local components. `localDate()` in `generator.js` exists because `toISOString()` locked the athlete's card the morning after an evening session. Task 1 Step 1 asserts this with a source-text test, so it cannot regress.
- **`js/calendar.js` holds no DOM.** It is imported by `tests/calendar.test.mjs` with no shim loaded. If it ever touches `document`, that test file crashes on import — which is the point.
- **Weeks start Monday.** Confirmed by the athlete 2026-09-01.
- **The calendar shows `confirmed === true` days only.** Design §4. An unconfirmed entry is not a training day.
- **The existing 328 tests must stay green throughout.** `generator.js`, `rules.js`, `templates.js` and `storage.js` are not modified by any task in this plan. A red test in one of them means something unintended broke — do not update the expectation, find the break.
- **`sw.js` is touched ONCE, in Task 8:** `js/calendar.js` added to `SHELL`, `VERSION` bumped `'v23'` → `'v24'`. Both, or installed phones serve the old app forever. His phone then needs a SECOND launch to pick it up.
- **Commits use the GitHub noreply identity;** check `git config user.email` is `99660645+ninwhippa08@users.noreply.github.com` before the first commit.
- **Day-type codes are two letters:** `ST PW HY AE IV SP PL`. Single initials collide (`S` = max-strength and sprint; `P` = power and plyometric). Design §8.

---

## What is wrong today

`js/app.js` `boot()` ends with `showPendingOrSession()`, which falls through to `showSession()`, which generates and commits:

```js
// js/app.js:96-99  (inside showSession)
    if (!result.session) return mount(root, renderNothingBuildable());
    session = result.session;
    offer = result.offer;
  }
  commitSession(session);          // <- launching the app wrote a workout
```

`js/storage.js:78` documents the consequence:

> Generating a session marks it done (spec §1), so merely OPENING the app on a rest day writes a completed workout.

Those entries feed `patternSets`, the CNS account and the neglect score, and since design §4.4 the exercise count reads the same counts — so they change session *shape*, not just scoring.

The second problem is ordering. The soreness map sits on the session card, and `app.js:56` shows what touching it does:

```js
function showSession({
  reroll = false, excludeEquipment = null, soreChanged = false, openPanel = null
} = {}) {
```

`soreChanged: true` rebuilds the session being looked at. The workout reshuffles under you.

## Two decisions this plan makes that the design does not

**1. `monthGrid` always returns 6 weeks.** A month can span 4, 5 or 6 week-rows depending on where it starts. A variable row count makes the grid jump height when you page months, which on a phone moves the legend under your thumb. Six rows always, with `inMonth: false` padding. Costs one mostly-empty row in February; buys a grid that does not move.

**2. `daysSinceLastSession` returns `null`, not `Infinity` or `-1`, when there is no confirmed history.** The status line has to render something on day one, and `null` is the value `renderHome` can branch on without a sentinel that reads as a number. Task 3 covers it.

## File structure

| File | Change | Responsible for |
|---|---|---|
| `js/calendar.js` | **create** | Pure month-grid arithmetic. No DOM, no storage, no `toISOString`. |
| `tests/calendar.test.mjs` | **create** | The month model, directly. |
| `js/ui.js` | modify | `renderCalendar`, `renderHome`; `readOnly` on `renderSession`; soreness panel removed from the session card. |
| `tests/ui.test.mjs` | modify | `renderHome` states, `renderCalendar`, read-only session. |
| `js/app.js` | modify | Re-routed `boot()`; generation behind the tap; `soreChanged` deleted. |
| `style.css` | modify | Grid, cells, legend, status line. |
| `docs/spec.md` | modify | §1 flow sketch, §6 limitation 1, §7 module list. |
| `sw.js` | modify | `SHELL` + `VERSION`. Task 8 only. |

---

### Task 1: `js/calendar.js` — the month grid

**Files:**
- Create: `js/calendar.js`
- Create: `tests/calendar.test.mjs`

**Interfaces:**
- Consumes: nothing. This task has no dependencies and can be built first.
- Produces:
  - `monthGrid(year, month, history, today) -> Week[]` where `Week = Cell[6][7]`, `Cell = { date: string, inMonth: boolean, isToday: boolean, session: object|null }`. `month` is **1-indexed** (1 = January). `date` is always a `YYYY-MM-DD` string, including padding cells.
  - `monthLabel(year, month) -> string`, e.g. `'September 2026'`.
  - `shiftMonth(year, month, delta) -> { year, month }`.
  - `daysSinceLastSession(history, today) -> number|null`.
  - `DAY_TYPE_CODE` — frozen map of day type → two-letter code.
  - `WEEKDAY_LABELS` — `['Mon','Tue','Wed','Thu','Fri','Sat','Sun']`.

- [x] **Step 1: Write the failing tests**

Create `tests/calendar.test.mjs`:

```js
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
    .replace(/^[ 	]*\/\/.*$/gm, '')    // whole-line comments
    .replace(/[ 	]+\/\/.*$/gm, '');    // trailing comments
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
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test "tests/calendar.test.mjs"`
Expected: FAIL — `Cannot find module '../js/calendar.js'`.

- [x] **Step 3: Write `js/calendar.js`**

```js
// calendar.js -- month-grid arithmetic for the home screen. design §5.
//
// Pure by construction: the history arrives as an argument and nothing here
// touches the DOM or localStorage. Imported by tests/calendar.test.mjs with no
// dom-shim loaded, which is what keeps that true.
//
// NO toISOString ANYWHERE IN THIS FILE. localDate() in generator.js exists
// because toISOString() locked the card the morning after an evening session:
// it converts to UTC first, so an 8pm session west of UTC is already tomorrow.
// Month boundaries are that same bug one step harder to see. Dates here are
// 'YYYY-MM-DD' strings built from local components and compared as strings --
// which works because the format sorts lexicographically. A test asserts the
// absence of toISOString so this comment cannot rot into a lie.

// Two letters, not one: single initials collide -- 'S' is both max-Strength
// and Sprint, 'P' both Power and Plyometric. Reaching for a letter not in the
// word to break the tie produces a legend nobody can read. design §8.
export const DAY_TYPE_CODE = Object.freeze({
  'max-strength': 'ST',
  power: 'PW',
  hypertrophy: 'HY',
  'aerobic-steady': 'AE',
  interval: 'IV',
  sprint: 'SP',
  plyometric: 'PL'
});

// Monday first. The athlete trains in kg. design §5.
export const WEEKDAY_LABELS = Object.freeze([
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
]);

const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]);

// Six rows always. A month spans 4, 5 or 6 week-rows depending on where it
// starts, and a grid that changes height when you page months moves the legend
// under your thumb. Costs one near-empty row in February. plan-08 decision 1.
const WEEKS = 6;

const pad = n => String(n).padStart(2, '0');

// Local components in, string out. `new Date(y, m-1, d)` is a LOCAL
// constructor -- it is the UTC-based ones that cause the drift.
function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Monday = 0. getDay() is Sunday = 0, so Sunday must wrap to the end of the
// week rather than the start of it.
function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function monthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function shiftMonth(year, month, delta) {
  // Work in months-since-year-zero so December -> January rolls the year
  // without a special case in either direction.
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// The grid: 42 consecutive days, starting on the Monday on or before the 1st.
export function monthGrid(year, month, history, today) {
  // Only confirmed days are training days. design §4.
  const byDate = new Map();
  for (const s of history || []) {
    if (s && s.confirmed === true) byDate.set(s.date, s);
  }

  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - mondayIndex(first));

  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      // Constructed by offset from the 1st rather than by incrementing a Date,
      // so a DST transition cannot drop or repeat a day.
      const cell = new Date(
        year, month - 1, 1 - mondayIndex(first) + w * 7 + d
      );
      const date = ymd(cell);
      const inMonth = cell.getMonth() === month - 1
                   && cell.getFullYear() === year;
      week.push({
        date,
        inMonth,
        // A padding cell is another month's day. It is not today here, and it
        // carries no session -- both belong to the month that owns it.
        isToday: inMonth && date === today,
        session: inMonth ? (byDate.get(date) || null) : null
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function daysSinceLastSession(history, today) {
  let latest = null;
  for (const s of history || []) {
    if (!s || s.confirmed !== true) continue;
    // Lexicographic comparison is date comparison for YYYY-MM-DD, and the
    // array's own order is not trusted -- storage sorts it, but a caller
    // filtering it could hand us anything.
    if (latest === null || s.date > latest) latest = s.date;
  }
  if (latest === null) return null;  // never trained; the caller renders differently
  const a = new Date(`${latest}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `node --test "tests/calendar.test.mjs"`
Expected: PASS, 26 tests.

- [x] **Step 5: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: 354 pass, 0 fail (328 existing + 26 new).

- [x] **Step 6: Commit**

```bash
git add js/calendar.js tests/calendar.test.mjs
git commit -m "Add the month-grid model, with no DOM and no toISOString"
```

---

### Task 2: `renderCalendar`

**Files:**
- Modify: `js/ui.js`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Consumes: `monthGrid`, `monthLabel`, `WEEKDAY_LABELS`, `DAY_TYPE_CODE` from Task 1.
- Produces: `renderCalendar({ year, month, history, today, onPrev, onNext, onPick }) -> Node`. `onPick(date)` fires only for cells with a session.

- [x] **Step 1: Write the failing tests**

Append to `tests/ui.test.mjs`. Add `renderCalendar` to the existing import from `../js/ui.js`:

```js
// --------------------------------------------------------------------------
// The calendar. design-home-and-calendar.md §5, §8.
// --------------------------------------------------------------------------

const trained = (date, dayType = 'max-strength') =>
  ({ date, dayType, confirmed: true, blocks: [] });

const cal = (over = {}) => renderCalendar({
  year: 2026, month: 9, history: [], today: '2026-09-14',
  onPrev() {}, onNext() {}, onPick() {}, ...over
});

test('the calendar shows the month and year', () => {
  assert.match(cal().textContent, /September 2026/);
});

test('the calendar has seven weekday headings starting Monday', () => {
  const heads = cal().querySelectorAll('.cal-weekday');
  assert.equal(heads.length, 7);
  assert.equal(heads[0].textContent, 'Mon');
});

test('a trained day carries its two-letter code', () => {
  const node = cal({ history: [trained('2026-09-14', 'power')] });
  assert.match(node.textContent, /PW/);
});

test('a trained day is a button', () => {
  const node = cal({ history: [trained('2026-09-14')] });
  const btn = node.querySelectorAll('button').find(
    b => /14 September/.test(b.getAttribute('aria-label') || '')
  );
  assert.ok(btn, 'no button for the trained day');
});

test('an untrained day is not focusable -- there is nothing to open', () => {
  const node = cal();
  const btn = node.querySelectorAll('button').find(
    b => /14 September/.test(b.getAttribute('aria-label') || '')
  );
  assert.equal(btn, undefined);
});

test('the accessible name says the date and the day type, not just a colour', () => {
  // design §8: colour is never the only encoding, and it is never the name.
  const node = cal({ history: [trained('2026-09-14', 'hypertrophy')] });
  const btn = node.querySelectorAll('button').find(
    b => /14 September/.test(b.getAttribute('aria-label') || '')
  );
  assert.match(btn.getAttribute('aria-label'), /Hypertrophy/i);
});

test('tapping a trained day reports its date', () => {
  let picked = null;
  const node = cal({ history: [trained('2026-09-14')], onPick: d => { picked = d; } });
  node.querySelectorAll('button').find(
    b => /14 September/.test(b.getAttribute('aria-label') || '')
  ).dispatch('click');
  assert.equal(picked, '2026-09-14');
});

test('the month arrows report which way', () => {
  let seen = [];
  const node = cal({ onPrev: () => seen.push('prev'), onNext: () => seen.push('next') });
  node.querySelector('.cal-prev').dispatch('click');
  node.querySelector('.cal-next').dispatch('click');
  assert.deepEqual(seen, ['prev', 'next']);
});

test('today is marked even when nothing was trained', () => {
  assert.ok(cal().querySelector('.is-today'), 'no today marker');
});

test('a legend entry exists for every day type that appears', () => {
  const node = cal({ history: [trained('2026-09-14', 'power'), trained('2026-09-16', 'sprint')] });
  const legend = node.querySelector('.cal-legend').textContent;
  assert.match(legend, /PW/);
  assert.match(legend, /SP/);
});

test('the legend lists only day types present in the month', () => {
  // A legend of all seven every month is noise; it explains marks that are there.
  const node = cal({ history: [trained('2026-09-14', 'power')] });
  const legend = node.querySelector('.cal-legend').textContent;
  assert.equal(/HY/.test(legend), false);
});
```

- [x] **Step 2: Run to verify failure**

Run: `node --test "tests/ui.test.mjs"`
Expected: FAIL — `renderCalendar is not a function` (or an import error).

- [x] **Step 3: Implement `renderCalendar` in `js/ui.js`**

Add the import at the top of `js/ui.js`, beside the existing `localDate` import:

```js
import {
  monthGrid, monthLabel, WEEKDAY_LABELS, DAY_TYPE_CODE
} from './calendar.js';
```

Then:

```js
// --------------------------------------------------------------------------
// The calendar. design-home-and-calendar.md §5, §8.
// --------------------------------------------------------------------------

// Colour is never the only encoding: every trained cell carries its two-letter
// code as text, and the accessible name spells the day type out. Seven hues
// separable by every form of colour vision do not exist. design §8.
export function renderCalendar({
  year, month, history, today, onPrev, onNext, onPick
} = {}) {
  const weeks = monthGrid(year, month, history, today);

  const head = el('div', { class: 'cal-head' }, [
    el('button', {
      class: 'cal-prev', type: 'button',
      'aria-label': 'Previous month', onclick: () => onPrev && onPrev()
    }, '‹'),
    el('h2', { class: 'cal-title', text: monthLabel(year, month) }),
    el('button', {
      class: 'cal-next', type: 'button',
      'aria-label': 'Next month', onclick: () => onNext && onNext()
    }, '›')
  ]);

  const weekdays = el('div', { class: 'cal-weekdays' },
    WEEKDAY_LABELS.map(d => el('div', { class: 'cal-weekday', text: d })));

  const grid = el('div', { class: 'cal-grid' }, weeks.flat().map(cell => {
    const num = String(Number(cell.date.slice(8, 10)));

    // Not a button when there is nothing behind it. A focusable element that
    // does nothing is worse than no element -- it costs a tab stop per empty
    // day, 30-odd of them a month.
    if (!cell.session) {
      return el('div', {
        class: [
          'cal-cell',
          cell.inMonth ? '' : 'is-outside',
          cell.isToday ? 'is-today' : ''
        ].filter(Boolean).join(' '),
        text: cell.inMonth ? num : ''
      });
    }

    const type = cell.session.dayType;
    const code = DAY_TYPE_CODE[type] || '??';
    return el('button', {
      class: [
        'cal-cell', 'is-trained', `type-${type}`,
        cell.isToday ? 'is-today' : ''
      ].filter(Boolean).join(' '),
      type: 'button',
      'aria-label': `${num} ${monthLabel(year, month).split(' ')[0]}, ${titleCase(type)}`,
      onclick: () => onPick && onPick(cell.date)
    }, [
      el('span', { class: 'cal-num', text: num }),
      el('span', { class: 'cal-code', text: code })
    ]);
  }));

  // Only what is on screen. A fixed legend of all seven every month explains
  // marks that are not there and buries the two that are.
  const present = [];
  for (const cell of weeks.flat()) {
    if (cell.session && !present.includes(cell.session.dayType)) {
      present.push(cell.session.dayType);
    }
  }
  const legend = el('div', { class: 'cal-legend' }, present.map(type =>
    el('span', { class: `cal-key type-${type}` }, [
      el('span', { class: 'cal-code', text: DAY_TYPE_CODE[type] || '??' }),
      el('span', { text: ` ${titleCase(type)}` })
    ])
  ));

  return el('section', { class: 'calendar' }, [head, weekdays, grid, legend]);
}
```

- [x] **Step 4: Run to verify pass**

Run: `node --test "tests/ui.test.mjs"`
Expected: PASS.

- [x] **Step 5: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: 365 pass, 0 fail.

- [x] **Step 6: Commit**

```bash
git add js/ui.js tests/ui.test.mjs
git commit -m "Render the month calendar, coded by letter and not by colour alone"
```

---

### Task 3: `renderHome`

**Files:**
- Modify: `js/ui.js`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Consumes: `renderCalendar` (Task 2), `daysSinceLastSession` (Task 1), the existing `sorenessMap`.
- Produces: `renderHome({ rampWeek, daysSince, todaySession, soreness, calendar, onGenerate, onOpenToday }) -> Node`, where `soreness` is `{ joints, current, onCycle }` and `calendar` is the object `renderCalendar` takes minus `onPick`, which `renderHome` passes through unchanged.

- [x] **Step 1: Write the failing tests**

Append to `tests/ui.test.mjs`, adding `renderHome` to the `../js/ui.js` import:

```js
// --------------------------------------------------------------------------
// The home screen. design-home-and-calendar.md §6.
// --------------------------------------------------------------------------

const home = (over = {}) => renderHome({
  rampWeek: 2,
  daysSince: 3,
  todaySession: null,
  soreness: { joints: SORENESS_JOINTS, current: {}, onCycle() {} },
  calendar: {
    year: 2026, month: 9, history: [], today: '2026-09-14',
    onPrev() {}, onNext() {}, onPick() {}
  },
  onGenerate() {},
  onOpenToday() {},
  ...over
});

test('the home screen offers to generate when nothing exists for today', () => {
  const btn = home().querySelector('.home-generate');
  assert.ok(btn);
  assert.match(btn.textContent, /generate/i);
});

test('generating is reported once, on tap', () => {
  let taps = 0;
  home({ onGenerate: () => { taps++; } }).querySelector('.home-generate').dispatch('click');
  assert.equal(taps, 1);
});

test('an unconfirmed session for today offers a way back into it', () => {
  const node = home({
    todaySession: { date: '2026-09-14', dayType: 'power', blocks: [] }
  });
  assert.equal(node.querySelector('.home-generate'), null);
  assert.match(node.querySelector('.home-today').textContent, /power/i);
});

test('a confirmed session for today does not offer to generate again', () => {
  // design §12 leaves a second session for a day unanswered; until it is
  // asked for, the button is simply not there.
  const node = home({
    todaySession: { date: '2026-09-14', dayType: 'power', confirmed: true, blocks: [] }
  });
  assert.equal(node.querySelector('.home-generate'), null);
  assert.match(node.textContent, /done/i);
});

test('the status line carries the ramp week', () => {
  assert.match(home().querySelector('.home-status').textContent, /week 2/i);
});

test('the status line carries days since the last session', () => {
  assert.match(home().querySelector('.home-status').textContent, /3 days/i);
});

test('one day ago is not "1 days"', () => {
  assert.match(home({ daysSince: 1 }).querySelector('.home-status').textContent, /1 day\b/);
});

test('training today reads as today, not "0 days ago"', () => {
  assert.match(home({ daysSince: 0 }).querySelector('.home-status').textContent, /today/i);
});

test('never having trained does not render a number', () => {
  // daysSinceLastSession returns null, and null must not reach the sentence.
  const text = home({ daysSince: null }).querySelector('.home-status').textContent;
  assert.equal(/null|NaN|undefined|Infinity/.test(text), false);
});

test('the soreness map is on the home screen', () => {
  // design §6.1: flagged BEFORE generating, so it informs the first build
  // instead of rebuilding the session being looked at.
  const node = home();
  const joints = node.querySelectorAll('button').filter(
    b => /sore|hurt|clear/i.test(b.getAttribute('aria-label') || '')
  );
  assert.ok(joints.length >= SORENESS_JOINTS.length, 'no soreness map on home');
});

test('the calendar is on the home screen', () => {
  assert.ok(home().querySelector('.calendar'));
});
```

- [x] **Step 2: Run to verify failure**

Run: `node --test "tests/ui.test.mjs"`
Expected: FAIL — `renderHome is not a function`.

- [x] **Step 3: Implement `renderHome` in `js/ui.js`**

```js
// --------------------------------------------------------------------------
// The home screen. design-home-and-calendar.md §6.
// --------------------------------------------------------------------------

// Two facts, not a dashboard. Both are things the app knows and shows nowhere
// else, and the screen is otherwise one button and a grid.
function statusLine(rampWeek, daysSince) {
  const parts = [];
  if (rampWeek != null) parts.push(`Return week ${rampWeek}`);
  // null means never trained -- a sentinel number would render as a sentence.
  if (daysSince === null || daysSince === undefined) parts.push('No sessions yet');
  else if (daysSince === 0) parts.push('Trained today');
  else if (daysSince === 1) parts.push('Last trained 1 day ago');
  else parts.push(`Last trained ${daysSince} days ago`);
  return parts.join(' · ');
}

export function renderHome({
  rampWeek, daysSince, todaySession, soreness, calendar, onGenerate, onOpenToday
} = {}) {
  const children = [
    el('h1', { class: 'day-type', text: 'GymBuddy' }),
    el('p', { class: 'home-status', text: statusLine(rampWeek, daysSince) })
  ];

  if (soreness) {
    children.push(el('div', { class: 'home-soreness' }, [
      el('p', { class: 'setup-label', text: 'Anything sore?' }),
      sorenessMap(soreness.joints, soreness.current, soreness.onCycle)
    ]));
  }

  if (!todaySession) {
    children.push(el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn home-generate', type: 'button',
        onclick: () => onGenerate && onGenerate()
      }, "Generate today's workout")
    ]));
  } else if (todaySession.confirmed) {
    children.push(el('p', {
      class: 'home-today',
      text: `Done today — ${titleCase(todaySession.dayType)}`
    }));
    children.push(el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn home-open', type: 'button',
        onclick: () => onOpenToday && onOpenToday()
      }, 'View it')
    ]));
  } else {
    children.push(el('p', {
      class: 'home-today',
      text: `Today: ${titleCase(todaySession.dayType)}`
    }));
    children.push(el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn home-open', type: 'button',
        onclick: () => onOpenToday && onOpenToday()
      }, 'Open it')
    ]));
  }

  if (calendar) children.push(renderCalendar(calendar));

  return el('div', { class: 'screen screen-home' }, children);
}
```

- [x] **Step 4: Run to verify pass**

Run: `node --test "tests/ui.test.mjs"`
Expected: PASS.

- [x] **Step 5: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: 376 pass, 0 fail.

- [x] **Step 6: Commit**

```bash
git add js/ui.js tests/ui.test.mjs
git commit -m "Add the home screen: status, soreness, one button, the calendar"
```

---

### Task 4: `readOnly` on `renderSession`

**Files:**
- Modify: `js/ui.js:549` (the `renderSession` signature and its footer)
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `renderSession(session, { ..., readOnly })`. When `readOnly` is true the card renders blocks and loads but no footer actions and no panels.

- [x] **Step 1: Write the failing tests**

```js
// --------------------------------------------------------------------------
// A past day, read-only. design-home-and-calendar.md §7.
// --------------------------------------------------------------------------

test('a read-only session still shows its work', () => {
  const node = renderSession(card(), { readOnly: true });
  assert.match(node.textContent, /Back Squat/);
});

test('a read-only session offers no reroll, no done and no undo', () => {
  const node = renderSession(card(), {
    readOnly: true, onReroll() {}, onDone() {}, onUndo() {}
  });
  const labels = node.querySelectorAll('button').map(b => b.textContent).join(' ');
  assert.equal(/reroll/i.test(labels), false);
  assert.equal(/I did this workout/i.test(labels), false);
});

test('a read-only session offers no swap even when a handler is passed', () => {
  const node = renderSession(card(), { readOnly: true, onSwap() {} });
  assert.equal(node.querySelector('.block-swap'), null);
});

test('a read-only session shows no equipment or add-move panel', () => {
  const node = renderSession(card(), {
    readOnly: true,
    equipment: { items: ['barbell'], selected: [], open: false, onToggle() {} },
    addMove: { drafts: [], issueBase: 'x', open: false, onSave() {}, onRemove() {} }
  });
  assert.equal(node.querySelector('.equipment'), null);
});

test('an editable session is unaffected', () => {
  const node = renderSession(card(), { onSwap() {} });
  assert.ok(node.querySelector('.block-swap'), 'swap vanished from a live card');
});
```

`card()` already exists in `tests/ui.test.mjs`; reuse it. If its name differs, use whatever the file's existing session fixture is called — do not add a second one.

- [x] **Step 2: Run to verify failure**

Run: `node --test "tests/ui.test.mjs"`
Expected: FAIL — the read-only assertions fail because the controls still render.

- [x] **Step 3: Implement**

In `js/ui.js`, change the signature at line 549:

```js
export function renderSession(
  session,
  { onReroll, onDone, onUndo, cuesFor, offer, equipment, soreness, addMove,
    onSwap, swapNote, readOnly = false } = {}
) {
```

Then, at the top of the body, neutralise every interactive input in one place
rather than guarding each use site:

```js
  // One gate, not eight. A past day is rendered by the same function as a live
  // one -- the block rendering, the load lines and the flip cards are a few
  // hundred lines that must not fork (design §7) -- so read-only is expressed
  // by withholding the handlers rather than by branching through the renderer.
  if (readOnly) {
    onReroll = onDone = onUndo = onSwap = undefined;
    equipment = soreness = addMove = undefined;
    offer = null;
  }
```

The existing `typeof onSwap === 'function'` guard at line 263 then drops the
swap control on its own. Confirm the footer actions and each panel are already
guarded by the presence of their handler or config; where one is not, add the
same `&&` guard the others use.

- [x] **Step 4: Run to verify pass**

Run: `node --test "tests/ui.test.mjs"`
Expected: PASS.

- [x] **Step 5: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: 381 pass, 0 fail.

- [x] **Step 6: Commit**

```bash
git add js/ui.js tests/ui.test.mjs
git commit -m "Render a past session read-only, without forking the card"
```

---

### Task 5: re-route `app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `renderHome` (Task 3), `renderSession(…, { readOnly })` (Task 4), `monthGrid`/`shiftMonth`/`daysSinceLastSession` (Task 1).
- Produces: no exports; this is the wiring.

This task has no unit tests — `app.js` has none today and this plan does not
add a test harness for it. Its correctness is established by Task 7's manual
script. Keep the diff small and readable for that reason.

- [x] **Step 1: Add the home screen function**

Add to `js/app.js`, importing `renderHome` from `./ui.js` and
`shiftMonth, daysSinceLastSession` from `./calendar.js`:

```js
// The month the calendar is showing. Not persisted: paging back to March and
// closing the app should not mean opening it in March next week.
let calYear = null;
let calMonth = null;

function showHome() {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const date = today();
  if (calYear === null) {
    calYear = Number(date.slice(0, 4));
    calMonth = Number(date.slice(5, 7));
  }

  const history = loadHistory();
  const soreness = profile.soreness || {};

  mount(root, renderHome({
    rampWeek: rampWeekFor(profile),
    daysSince: daysSinceLastSession(history, date),
    todaySession: sessionFor(date),
    soreness: {
      joints: SORENESS_JOINTS,
      current: soreness,
      // Soreness lives on the PROFILE so the flags persist pre-checked into
      // the next session (spec §4.1). Nothing regenerates here -- there is
      // nothing generated yet, which is the point of the screen.
      onCycle: (joint, level) => {
        const next = { ...soreness };
        if (level) next[joint] = level; else delete next[joint];
        saveProfile({ ...profile, soreness: next });
        showHome();
      }
    },
    calendar: {
      year: calYear, month: calMonth, history, today: date,
      onPrev: () => { ({ year: calYear, month: calMonth } = shiftMonth(calYear, calMonth, -1)); showHome(); },
      onNext: () => { ({ year: calYear, month: calMonth } = shiftMonth(calYear, calMonth, 1)); showHome(); },
      onPick: d => showPastSession(d)
    },
    onGenerate: () => showSession({ generate: true }),
    onOpenToday: () => showSession()
  }));
}

function showPastSession(date) {
  const session = sessionFor(date);
  if (!session) return showHome();
  mount(root, renderSession(session, {
    readOnly: true,
    cuesFor: id => {
      const e = library.find(x => x.id === id);
      return e && e.cues && e.cues.length ? e.cues : null;
    },
    onHome: () => showHome()
  }));
}
```

- [x] **Step 2: Import `rampWeekFor` — it already exists**

`js/generator.js:181` already exports it:

```js
export function rampWeekFor(profile, now = Date.now()) {
```

Add it to the existing `./generator.js` import in `app.js`. **Do not
reimplement it** — two copies of the ramp arithmetic is exactly the class of
bug this project keeps one copy of `localDate` to avoid.

Note the second argument: it is a **timestamp**, not a `YYYY-MM-DD` string.
`rampWeekFor(profile, '2026-09-14')` would subtract a string from a number and
yield `NaN`, which `clamp` would pass straight through into the status line.
Call it with no second argument and let it default to `Date.now()`:

```js
    rampWeek: rampWeekFor(profile),
```

so Task 3's `showHome` reads `rampWeek: rampWeekFor(profile)`, not
`rampWeekFor(profile, date)`.

- [x] **Step 3: Put generation behind the tap**

In `showSession`, change the condition that triggers a rebuild so that a first
build happens only when explicitly asked:

```js
function showSession({
  reroll = false, excludeEquipment = null, generate = false, openPanel = null
} = {}) {
```

and

```js
  const locked = !!(session && session.confirmed);
  if (!locked && (generate || reroll || excludeEquipment)) {
```

`soreChanged` is **deleted**, not defaulted — the soreness map is no longer on
this screen and nothing passes it. Remove the `soreness` entry from `opts` and
the `soreChanged` parameter.

If, after that, `showSession` is reached with no saved session and
`generate` false, send the user home rather than rendering an empty card:

```js
  if (!session) return showHome();
```

- [x] **Step 4: Re-route boot**

```js
// Asked at LAUNCH only. One question per unanswered day, most recent first.
// spec §6 limitation 1 -- which this plan shrinks but does not remove: tapping
// Generate and then not training still writes a day this has to ask about.
function showPendingOrHome() {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const pending = pendingConfirmations(loadHistory(), today());
  if (pending.length) {
    const asking = pending[0];
    return mount(root, renderConfirmPrevious(asking, {
      onYes: () => { confirmSession(asking.date); showPendingOrHome(); },
      onNo: () => { discardSession(asking.date); showPendingOrHome(); }
    }));
  }

  // Straight back to the card once today is under way: reopening the app
  // between sets must not put a calendar between him and the workout.
  // A CONFIRMED session does not qualify -- training is over. design §3.
  const t = sessionFor(today());
  if (t && !t.confirmed) return showSession();
  return showHome();
}
```

and change `boot()`'s last line from `showPendingOrSession()` to
`showPendingOrHome()`. Delete the old `showPendingOrSession`.

- [x] **Step 5: Add the Home control to the session card**

`renderSession` needs an `onHome` opt rendering a control that calls it, shown
whenever `onHome` is a function (so it appears on both live and read-only
cards). Wire `onHome: () => showHome()` into `showSession`'s `opts`. Add a test
to `tests/ui.test.mjs`:

```js
test('a session card offers a way home', () => {
  let home = 0;
  const node = renderSession(card(), { onHome: () => { home++; } });
  node.querySelector('.session-home').dispatch('click');
  assert.equal(home, 1);
});
```

- [x] **Step 6: Run the whole suite**

Run: `node --test "tests/*.test.mjs"`
Expected: 382 pass, 0 fail.

- [x] **Step 7: Commit**

```bash
git add js/app.js js/ui.js tests/ui.test.mjs
git commit -m "Open on the home screen; generate only when asked"
```

---

### Task 6: styles

**Files:**
- Modify: `style.css`

- [x] **Step 1: Add the calendar and home styles**

Follow the file's existing custom properties and dark palette — do not
introduce a second colour system. Requirements:

- `.cal-grid` is a 7-column CSS grid; cells are square (`aspect-ratio: 1`).
- `.cal-weekdays` uses the same 7-column track so headings line up with cells.
- `.cal-cell` tap targets are at least 44px in both axes at 375px viewport
  width. On a 7-column grid inside the app's existing page padding this is the
  binding constraint — check it rather than assuming it.
- `.is-outside` is dimmed; `.is-today` carries a ring, not a fill, so it stays
  legible on a trained day that already has a fill.
- `.type-*` classes carry the seven day-type colours. They are decoration:
  every cell already states its code as text, and `aria-label` states the day
  type in full.
- `.cal-code` is small but never below 11px.
- `.home-status` is one muted line.

- [x] **Step 2: Check it in a browser at phone width**

Serve locally and look at it:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`, set the viewport to 375px wide, and confirm: the
grid does not overflow horizontally, the 6 rows do not push the legend off
screen, cells are square, and paging months does not change the grid's height.

- [x] **Step 3: Commit**

```bash
git add style.css
git commit -m "Style the home screen and the month grid"
```

---

### Task 7: the manual script

**Files:** none — this task produces a record, not a diff.

`app.js` has no unit tests and the DOM shim renders no CSS. This is the task
that catches what neither can. Run every step against a local server and write
down what happened.

- [x] **Step 1: A fresh profile writes nothing**

Clear storage (`localStorage.clear()` in the console), reload, complete setup.
Confirm the home screen appears, then check the console:

```js
JSON.parse(localStorage.getItem('gymbuddy.v1')).history
```

Expected: `[]`. **This is the whole point of the feature.** A non-empty history
here means generation is still in the launch path and Task 5 Step 3 is wrong.

- [x] **Step 2: Generating writes exactly one day**

Tap Generate. Confirm a session renders. Re-run the console line above:
expected one entry, `confirmed` absent.

- [x] **Step 3: The calendar stays empty until confirmed**

Tap Home. The calendar must show **no** mark for today. Then open the session,
tap "I did this workout", go Home: today is now marked with its two-letter
code. This is design §4 — verify both halves, not just the second.

- [x] **Step 4: Reopening mid-session goes straight to the card**

With today generated and *not* confirmed (use Undo if needed), reload the page.
Expected: the workout card, not the home screen. Design §3.

- [x] **Step 5: A past day opens read-only**

Tap a marked day. Confirm the blocks render, and that there is no Reroll, no
"I did this workout", no swap control and no equipment panel.

- [x] **Step 6: Month paging**

Page back three months and forward three. Confirm the grid height never
changes, the month label tracks, and marks land on the right dates.

- [x] **Step 7: Soreness informs the first build**

On the home screen, mark a knee `hurt`. Tap Generate. Confirm no exercise
loading the knee appears — and that the workout did **not** visibly rebuild
after appearing, which was the old behaviour.

- [x] **Step 8: Record the result in the plan**

Add a `## Manual check` section to this file with the date and what each step
actually did. If a step failed, write down what it did instead — do not fix it
silently and mark it passed.

- [x] **Step 9: Commit**

```bash
git add docs/plan-08-home-and-calendar.md
git commit -m "Record the manual check for the home screen"
```

---

### Task 8: docs, the worker, deploy

**Files:**
- Modify: `docs/spec.md`
- Modify: `sw.js`
- Modify: `README.md`

- [x] **Step 1: Amend `docs/spec.md` §1**

The product sketch currently opens:

```
open app
  → tap body map for anything sore  (last session's flags pre-checked)
  → app proposes a day type, with a reason
```

Change to:

```
open app
  → home: status, what is sore, a month of training
  → tap body map for anything sore  (last session's flags pre-checked)
  → tap "Generate today's workout"
  → app proposes a day type, with a reason
```

Amend the "**No logging.**" paragraph: generating still marks a session done,
but generating now requires a tap, so opening the app no longer writes a
workout.

- [x] **Step 2: Amend `docs/spec.md` §6 limitation 1**

It describes phantom entries from opening the app. Record that the population
shrank from every launch to every launch where Generate was tapped, cite
`docs/design-home-and-calendar.md` §2, and note that the confirmation prompt
stays as the safety net for training-and-forgetting-to-tap.

- [x] **Step 3: Add `js/calendar.js` to `docs/spec.md` §7**

One line, matching the existing entries' shape.

- [x] **Step 4: Update `README.md`**

Two places: the "What the app does" list opens on a workout today and must open
on the home screen; and the repository map's `js/` table needs a `calendar.js`
row.

- [x] **Step 5: `sw.js` — both changes, in one edit**

```js
const VERSION = 'v24';
```

and add to `SHELL`, beside the other `./js/` entries:

```js
  './js/calendar.js',
```

**Both.** A new file missing from `SHELL` is a file installed phones never
fetch; a `VERSION` left at `v23` means they never look for it. `sw.js` opens
with a warning comment about exactly this.

- [x] **Step 6: Verify the worker edit landed**

```bash
grep -n "VERSION = " sw.js
grep -n "calendar" sw.js
```

Expected: `v24`, and `./js/calendar.js` present in `SHELL`.

- [x] **Step 7: Full suite, then commit and push**

```bash
node --test "tests/*.test.mjs"
git add docs/spec.md README.md sw.js
git commit -m "Document the home screen, ready as v24"
git push origin main
```

- [x] **Step 8: Verify the deploy**

```bash
curl -s https://ninwhippa08.github.io/GymBuddy/sw.js | grep "^const VERSION"
curl -s -o /dev/null -w "%{http_code}\n" https://ninwhippa08.github.io/GymBuddy/js/calendar.js
```

Expected: `v24`, and `200`. A 404 on `calendar.js` means the deploy is broken
and the app is now unloadable on any phone that fetches the new worker.

- [x] **Step 9: Look at it on the phone**

Two launches: the first fetches the new worker, the second runs it. Confirm the
home screen appears and the calendar is legible at real size. `plan-07` shipped
with its browser check outstanding; this one does not.

---

## Self-review

**Spec coverage.** Design §2 → Task 5 Step 3. §2.1 (rejections) → nothing to
build, recorded in the plan's framing. §3 → Task 5 Step 4. §4 → Task 1 Step 1
(`an unconfirmed session is not a training day`) and Task 7 Step 3. §5 → Task 1.
§6 → Task 3. §6.1 → Task 3 + Task 5 Step 3. §7 → Task 4. §8 → Task 2 and Task 6.
§9 → Task 8 Steps 1–4. §10 → Tasks 1–4 and Task 7. §11 → task order. §12 (open
questions) → not built, by definition.

**Placeholder scan.** No TBD/TODO. Task 6 states measurable requirements rather
than final CSS, because the 44px target at 375px across 7 columns has to be
checked in a browser, not asserted in a plan.

**Three claims checked against the code rather than assumed**, after a first
draft got all three wrong:

- The session fixture in `tests/ui.test.mjs` is `card()` at line 449, not
  `sampleSession()`. Every read-only test in Task 4 uses `card()`.
- `rampWeekFor` is **already exported** from `js/generator.js:181`, and its
  second argument is a **timestamp**, not a date string. Passing
  `'2026-09-14'` would produce `NaN` and render it into the status line. Task 5
  Step 2 calls it with one argument.
- The shim's `querySelectorAll` returns a real `Array` (`dom-shim.mjs:83`), so
  the `.find()` and `.map()` the new tests use are valid — they are not
  NodeLists.

**Type consistency.** `monthGrid(year, month, history, today)` with a 1-indexed
`month` is used identically in Tasks 1, 2, 3 and 5. `daysSinceLastSession`
returns `number|null` in Task 1 and is branched on as `null` in Task 3's
`statusLine` and tested for it in both. Cell shape `{date, inMonth, isToday,
session}` matches across Tasks 1 and 2. `DAY_TYPE_CODE` is defined in Task 1 and
consumed in Task 2 only.

**One gap accepted.** `js/app.js` gets no unit tests, because it has none today
and adding a harness for it is a larger change than this feature. Task 7 is the
compensating control and is not optional.

---

## Manual check — 2026-09-01/02, Chrome, `python -m http.server`

Run against a local server with a seeded profile (`returnDate` 2026-06-01) and
two confirmed past sessions, 2026-08-26 `power` and 2026-08-29 `hypertrophy`.
The clock rolled from 2026-09-01 to 2026-09-02 mid-run; both dates appear below
and the app tracked the change correctly on reload.

| Step | Result |
|---|---|
| 1 · fresh launch writes nothing | **PASS.** `history` held only the two seeded dates; today absent. |
| 2 · generating writes one day | **PASS.** One tap → 3 entries total, today's `confirmed` undefined, `durationMin` 64 (under the 70 gate). |
| 3 · calendar stays empty until confirmed | **PASS, both halves.** Before: September showed no marks while home read "Today: Max Strength". After tapping "I did this workout": `2 September, Max Strength`, code `ST`, legend `ST Max Strength`, status `Trained today`. |
| 4 · reopening mid-session | **PASS.** Covered by `tests/app.test.mjs` rather than by hand — relaunching with today unconfirmed renders `.session-head`, not `.screen-home`. |
| 5 · past day read-only | **PASS.** Opening 26 August rendered the work (Power Clean) with exactly one button on the page: `‹ Home`. No reroll, done, undo, swap, equipment or soreness. |
| 6 · month paging | **PASS.** Six rows at every width and every month; August and September both render 6, so the legend does not move. |
| 7 · soreness informs the first build | **PASS.** Knee → `hurt` on the home screen saved to the profile, then Generate produced 12 blocks, **zero** of which load the knee. No visible rebuild after the card appeared. |

### Measured cell widths

Through same-origin iframes at real viewport widths, not a resized element:

| Viewport | Cell | Overflow |
|---|---|---|
| 320px | 38.6px | none |
| 360px | 44.0px | none |
| 375px | 45.6px | none |
| 390px | 47.7px | none |
| 430px | 51.3px | none |

### Two things this check caught that no test could

**320px overflowed horizontally.** `min-height: 44px` with `aspect-ratio: 1`
forced cells wider than their own grid track: seven 44px cells plus six gaps
needs 332px, and a 320px phone offers 288px inside `.screen`'s padding.
Fixed with a `max-width: 359px` query that drops the min-height; the cell
gives up the 44px AAA target there and keeps AA (24px) with room to spare.
Nothing at 360px or above changed.

**The service worker served stale CSS through the whole first round of
measurements.** `gymbuddy-v23` was still registered on localhost and is
cache-first, so the edit was on disk and invisible in the browser — a
cache-busting query string did not help either. Every measurement before the
unregister was of the OLD stylesheet, and the first "fix" appeared to do
nothing. This is exactly what `sw.js`'s header warns about, and it is the
reason Task 8 Step 5 bumps `VERSION` in the same edit that adds the new file.


### The phone check — 2026-09-03, passed

Reported by the athlete after using the deployed app on his own phone:
*"the phone check passed. I had no problem using it."* Step 10 of design §11
is now closed.

This is a use report, not a step-by-step run of the table above, and it is
recorded as what it is. It covers the thing the desktop check could not: the
installed PWA on the real device, at the real viewport, over the real service
worker. It does not independently re-verify any numbered step.

### The backup panel — checked in Chrome, 2026-09-03

Run against `python -m http.server 8123` with a seeded profile and three
confirmed sessions. Driven through the real handlers: a `File` set on the
input via `DataTransfer`, then a real `change` event.

| Check | Result |
|---|---|
| panel present, collapsed, no destructive control | **PASS.** `.backup` closed on launch; no `.backup-apply` anywhere. |
| choosing a file destroys nothing | **PASS.** Confirmation appeared naming 3 sessions from 2026-07-04 to 2026-07-11; the 3 sessions already on the device were still in `localStorage`, untouched. |
| Cancel backs out | **PASS.** Confirmation gone, history unchanged. |
| Replace everything restores | **PASS.** History became the July dates, `profile.returnDate` became 2026-03-15, and the status line re-read "Last trained 54 days ago". |
| a file from another app is refused | **PASS.** `{"app":"something-else"}` produced "That is not a GymBuddy backup file.", offered no apply button, and left the restored history in place. |
| export round-trips | **PASS.** `gymbuddy-backup-2026-09-03.json`, envelope correct, indented, and `readImport` accepts its own output. |
| delivery branch | `navigator.canShare({files})` is **true** in this Chrome, so the share path is the one that fires. The iOS share sheet itself is still unverified — that needs the phone. |

### Three things this check caught that the suite could not

**The file input was 25px tall.** Measured through same-origin iframes at 320,
360, 390 and 430px, against 44px for every other control on the screen. It is
now wrapped in a `<label>` that carries the target: 96px at every width, and
the visible text became part of the hit area. The `aria-label` came off with
it, since the label is now the accessible name.

**"Replace everything" was wearing `--accent`** — the same amber as "Generate
today's workout", the most inviting thing on the screen, on the only control
in the app that destroys data. Now `.btn-danger` in `--warn`.

**A refused file was visible but silent.** Choosing a file re-mounts the whole
screen, so the error carried no announcement. It now has `role="alert"`.

### The phone, 2026-09-03 — export PASSES, restore untested

Reported by the athlete from the installed PWA on his iPhone: **saving a
backup works.** That settles the one thing Chrome could not — that
`navigator.share({files})` reaches a usable iOS share sheet from a standalone
PWA, which is why it is first in the cascade rather than second.

**Restoring is still unverified on the device.** Every part of it has been
driven in Chrome through the real handlers (`plan-08` table above) and every
branch is covered by the suite, but no file has been picked through the real
iOS picker. The remaining unknown is narrow and specific: whether
`<input type="file">` in a standalone iOS PWA returns a `File` whose `.text()`
resolves. Nothing else in the flow is device-dependent.

There is a test of it that risks nothing: **restore the backup he just
saved.** If it works the state is replaced with itself and nothing changes; if
the picker misbehaves the refusal path catches it and the history is untouched
either way, because `readImport` writes nothing.

### Known cosmetic wart, not fixed

After a file is chosen the native input re-reads "no file selected", because
`showHome()` rebuilds the DOM and the fresh input has no `FileList`. The
confirmation box directly below states what was loaded, so the screen is not
ambiguous, but the two lines disagree. Preserving a `FileList` across a
re-render is more machinery than the confusion costs.
