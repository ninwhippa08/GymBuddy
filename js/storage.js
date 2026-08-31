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
