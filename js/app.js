// app.js -- entry point and screen routing. spec §7
//
// Three states, no router: setup (no profile), session (normal), error.
// The app has one screen in Phase 1; the body map and swap controls that
// sit either side of it arrive in Phase 2. spec §8.

import { generate } from './generator.js';
import {
  loadProfile, saveProfile, loadHistory, commitSession, sessionFor
} from './storage.js';
import { renderSession, renderSetup, renderError, mount } from './ui.js';

const root = document.getElementById('app');

let library = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

// --------------------------------------------------------------------------
// Screens
// --------------------------------------------------------------------------

function showSetup() {
  mount(root, renderSetup({
    onSubmit(returnDate) {
      if (!returnDate) return;
      saveProfile({ returnDate, banned: [], plyoLevel: 'beginner' });
      showSession();
    }
  }));
}

// Generating a session marks it done, so a session already committed for today
// is shown as-is rather than regenerated. Without this, every app launch would
// silently replace the workout the user is halfway through. spec §1.
function showSession({ reroll = false } = {}) {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  let session = reroll ? null : sessionFor(today());

  if (!session) {
    try {
      session = generate({
        library,
        profile,
        history: loadHistory(),
        soreness: {},          // Phase 2 -- body map. spec §4.1
        seed: Date.now()
      });
    } catch (err) {
      return mount(root, renderError(err.message));
    }
    commitSession(session);
  }

  mount(root, renderSession(session, {
    onReroll: () => showSession({ reroll: true })
  }));
}

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------

async function boot() {
  try {
    const res = await fetch('./data/exercises.json');
    if (!res.ok) throw new Error(`exercises.json: HTTP ${res.status}`);
    const data = await res.json();
    library = data.exercises;
  } catch (err) {
    // fetch on file:// is blocked by every browser worth shipping to. This is
    // the message that tells the user why, rather than a blank screen.
    return mount(root, renderError(
      `Could not load the exercise library (${err.message}). ` +
      'GymBuddy has to be served over http, not opened as a file.'
    ));
  }
  showSession();
}

// --------------------------------------------------------------------------
// Service worker
// --------------------------------------------------------------------------

// Registered after boot, never before: a failed or slow registration must not
// delay the workout appearing. Relative path so the scope follows the app
// wherever it is served from -- '/GymBuddy/' on Pages, '/' on localhost.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Offline install is a nicety; the app works without it. Nothing to show
    // the user, and nothing worth blocking on.
  });
}

boot().then(registerServiceWorker);
