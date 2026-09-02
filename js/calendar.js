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
  const lead = mondayIndex(first);

  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      // Constructed by day-offset from the 1st rather than by incrementing a
      // Date, so a DST transition cannot drop or repeat a day: the Date
      // constructor normalises an out-of-range day-of-month itself.
      const cell = new Date(year, month - 1, 1 - lead + w * 7 + d);
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
