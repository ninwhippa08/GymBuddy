// storage.js -- localStorage read/write. spec §7
//
// Everything lives under one key so the whole app state can be read, exported
// or wiped in one operation. No server, no account, no cookies. spec §2.
//
// Nothing in here validates training rules. It moves objects in and out of
// localStorage and nothing else.

const KEY = 'gymbuddy.v1';

const EMPTY = Object.freeze({
  schemaVersion: 1,
  profile: null,
  history: [],
  drafts: []
});

// --------------------------------------------------------------------------
// Raw read/write
// --------------------------------------------------------------------------

// A corrupt or absent blob returns EMPTY rather than throwing. Losing history
// is bad; refusing to open the app at the gym door is worse.
export function readAll() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { ...EMPTY, history: [], drafts: [] }; // private mode, storage disabled
  }
  if (!raw) return { ...EMPTY, history: [], drafts: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: parsed.schemaVersion || 1,
      profile: parsed.profile || null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      // Absent in every store written before drafts existed, so it is defaulted
      // here rather than at each call site.
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : []
    };
  } catch {
    return { ...EMPTY, history: [], drafts: [] };
  }
}

export function writeAll(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // quota or private mode -- the session still renders
  }
}

// --------------------------------------------------------------------------
// Profile
// --------------------------------------------------------------------------

export function loadProfile() {
  return readAll().profile;
}

export function saveProfile(profile) {
  const state = readAll();
  state.profile = profile;
  return writeAll(state);
}

// --------------------------------------------------------------------------
// History
// --------------------------------------------------------------------------

export function loadHistory() {
  return readAll().history;
}

// Generating a session marks it done -- there is no confirmation step. spec §1.
//
// A reroll must therefore REPLACE today's entry rather than append a second
// one. Two entries for one training day would double-count patternSets and
// cnsLoad, and the neglect model reads both. Same date in, same slot out.
export function commitSession(session) {
  const state = readAll();
  const i = state.history.findIndex(s => s.date === session.date);
  if (i >= 0) state.history[i] = session;
  else state.history.push(session);
  state.history.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  writeAll(state);
  return state.history;
}

export function sessionFor(date) {
  return readAll().history.find(s => s.date === date) || null;
}

// --------------------------------------------------------------------------
// "Did you finish this?"  spec §6 limitation 1
// --------------------------------------------------------------------------

// Generating a session marks it done (spec §1), so merely OPENING the app on a
// rest day writes a completed workout. Those phantom entries feed the rolling
// pattern counts, the CNS account and the neglect score, and since design §4.4
// the exercise count reads the same counts -- so they distort session SHAPE,
// not just scoring.
//
// The answer the spec names is a one-tap confirmation on NEXT LAUNCH. That
// keeps "no logging, no confirmation prompt" true of the workout itself: he is
// never interrupted between sets, only asked once about a day that is already
// over. Today is never pending -- it is still in progress, and it gets asked
// about tomorrow.
export function pendingConfirmations(history, today) {
  return history
    .filter(s => s.date < today && s.confirmed !== true)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

export function confirmSession(date) {
  const state = readAll();
  const session = state.history.find(s => s.date === date);
  if (!session) return false;
  session.confirmed = true;
  writeAll(state);
  return true;
}

// Confirming used to be a one-way door -- the card locked, dropped its Reroll
// and there was no way back until the date rolled over, which he ran straight
// into: "it says logged for today and I cannot click anything anymore".
//
// This is NOT discardSession. Undo means "I have not finished after all", so
// the session stays exactly as it is and only the confirmation is lifted: the
// card unlocks, Reroll comes back, and the day returns to the next-launch
// prompt. Saying "I didn't do it" is a different answer with a different
// consequence, and it is below.
export function unconfirmSession(date) {
  const state = readAll();
  const session = state.history.find(s => s.date === date);
  if (!session) return false;
  delete session.confirmed;
  writeAll(state);
  return true;
}

// Removed, not flagged. A session he did not do must not reach the CNS account
// or the neglect score, and the cheapest way to guarantee that is for it not to
// be in the history at all.
export function discardSession(date) {
  const state = readAll();
  const before = state.history.length;
  state.history = state.history.filter(s => s.date !== date);
  if (state.history.length === before) return false;
  writeAll(state);
  return true;
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

// --------------------------------------------------------------------------
// Movement drafts
// --------------------------------------------------------------------------

// A draft is a NAME AND A NOTE, and deliberately nothing else. A library entry
// carries pattern, tier, modalities, joints, equipment and a sourced prCoef --
// which decide whether it can be selected at all, what a hurt joint excludes,
// and how much weight goes on the bar. None of that can be guessed from a
// sentence typed at a rack, so a draft is kept where the generator cannot see
// it and is turned into an entry by hand, sourced, later.
let draftSeq = 0;

export function addDraft(name, note = '') {
  const state = readAll();
  const draft = {
    // Date.now() alone collides when two are saved in the same millisecond, and
    // removal is by id -- a collision would delete the wrong row.
    id: `d${Date.now()}-${draftSeq++}`,
    name: String(name).trim(),
    note: String(note).trim(),
    created: new Date().toISOString()
  };
  state.drafts.unshift(draft);          // newest first, the order they are read in
  writeAll(state);
  return draft;
}

export function loadDrafts() {
  return readAll().drafts;
}

export function removeDraft(id) {
  const state = readAll();
  const before = state.drafts.length;
  state.drafts = state.drafts.filter(d => d.id !== id);
  if (state.drafts.length === before) return false;
  writeAll(state);
  return true;
}

// --------------------------------------------------------------------------
// Backup -- export and import
// --------------------------------------------------------------------------

// This file's opening comment says the whole state lives under one key so it
// can be read, exported or wiped in one operation. Until now only two of those
// three were true. localStorage holds the ONLY copy of the profile and the
// history: clearing site data, a browser evicting the origin, or changing
// phones loses all of it, and with no account and no server there is nothing
// to restore from. Every other limitation in spec §6 is a consequence of a
// decision; this one was just missing.
//
// Export and import are split across THREE functions rather than two, and the
// split is the design. `readImport` validates and returns what it found;
// `applyImport` is the only thing that writes. A single `import(text)` that
// validated and wrote would have exactly one bad day -- the day a truncated
// file passes the first half of validation and fails the second, after the
// old data is already gone.
const SCHEMA_VERSION = 1;

// The local calendar day, NOT toISOString(). The same reason generator.js has
// its own `localDate`: an evening export in a western timezone gets tomorrow's
// date off toISOString, and a file named for a day he did not make it on is a
// small lie that makes two backups sort wrongly. Not imported from
// generator.js -- this file has no imports and is not going to grow a
// dependency on a 60 kB module to format eight characters.
function localStamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function exportBlob(now = new Date()) {
  return {
    filename: `gymbuddy-backup-${localStamp(now)}.json`,
    // The envelope is what makes "is this one of ours?" answerable at all. A
    // bare state object is indistinguishable from any other JSON on the phone,
    // and the file picker will happily hand over any of them.
    //
    // Indented, because the one thing he can do with this file without the app
    // is open it and look at it. The size cost is real -- a session record is
    // ~4.8 kB and a year of training is around half a megabyte -- but it is
    // paid on a file that gets saved, not on anything the app reads at launch.
    json: JSON.stringify({
      app: 'gymbuddy',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      state: readAll()
    }, null, 2)
  };
}

const refuse = error => ({ ok: false, error });

// Returns what it found. Writes NOTHING, on any path, including the happy one.
export function readImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse('That file is not JSON. Pick the backup file GymBuddy saved.');
  }

  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  if (!isObject(parsed) || parsed.app !== 'gymbuddy') {
    return refuse('That is not a GymBuddy backup file.');
  }
  const v = parsed.schemaVersion;
  if (!Number.isInteger(v) || v < 1 || v > SCHEMA_VERSION) {
    // Forward compatibility is refused loudly rather than attempted. A newer
    // file may hold fields this build would silently drop on the next write.
    return refuse(
      `That backup was written by a newer version of GymBuddy (${v}). ` +
      `This one reads up to version ${SCHEMA_VERSION}.`);
  }
  const state = parsed.state;
  if (!isObject(state)) return refuse('That backup has no data in it.');
  if (!Array.isArray(state.history)) {
    return refuse('That backup has no history in it.');
  }
  if (state.drafts != null && !Array.isArray(state.drafts)) {
    return refuse('That backup\'s saved moves are damaged.');
  }
  // `date` is the key everything else joins on -- `sessionFor`, the calendar,
  // `pendingConfirmations` and the rolling pattern counts all look it up. A
  // session without one is not a session that reads oddly; it is one no screen
  // can ever show and no count can ever reach.
  for (const s of state.history) {
    if (!isObject(s) || typeof s.date !== 'string' || s.date === '') {
      return refuse('That backup holds a session with no date, so it is damaged.');
    }
  }

  const dates = state.history.map(s => s.date).sort();
  return {
    ok: true,
    // Rebuilt rather than passed through: an imported store must have the same
    // shape as a written one, including the newest-first ordering commitSession
    // maintains, and unknown top-level keys do not survive into it.
    state: {
      schemaVersion: SCHEMA_VERSION,
      profile: state.profile || null,
      history: [...state.history].sort((a, b) => (a.date < b.date ? 1 : -1)),
      drafts: Array.isArray(state.drafts) ? state.drafts : []
    },
    // What the confirmation names. A destructive step that cannot say what it
    // is about to destroy is not a confirmation, it is a button.
    summary: {
      sessions: state.history.length,
      drafts: Array.isArray(state.drafts) ? state.drafts.length : 0,
      from: dates.length ? dates[0] : null,
      to: dates.length ? dates[dates.length - 1] : null,
      hasProfile: Boolean(state.profile)
    }
  };
}

// Replaces, and does not merge. "Restore a backup" means the file becomes the
// state; joining two histories by date would need a rule for every conflict
// and no way to be sure it picked right. Only ever called with a `state` that
// came back from `readImport`.
export function applyImport(state) {
  return writeAll(state);
}
