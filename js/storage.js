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
  history: []
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
    return { ...EMPTY, history: [] }; // private mode, storage disabled
  }
  if (!raw) return { ...EMPTY, history: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: parsed.schemaVersion || 1,
      profile: parsed.profile || null,
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return { ...EMPTY, history: [] };
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

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
