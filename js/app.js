// app.js -- entry point and screen routing. spec §7
//
// Three states, no router: setup (no profile), session (normal), error, plus
// the nothing-buildable screen. The swap control landed in v9 alongside the
// equipment constraint; the soreness body map is still the outstanding one --
// `soreness: {}` below is hardcoded. spec §8.

import {
  resolveSession, offerableEquipment, swapBlock, makeRng
} from './generator.js';
import {
  loadProfile, saveProfile, loadHistory, commitSession, sessionFor
} from './storage.js';
import {
  renderSession, renderSetup, renderError, renderNothingBuildable, mount
} from './ui.js';

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
function showSession({ reroll = false, excludeEquipment = null } = {}) {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const saved = reroll ? null : sessionFor(today());
  // The constraint lives on the record, so it survives a reroll and is gone
  // tomorrow -- which is what "this session only" means. design §3.3.
  const constraint = excludeEquipment ?? (saved && saved.excludeEquipment) ?? [];

  let session = saved;
  let offer = null;

  // A changed constraint rebuilds even when today's session is on the record:
  // that is the whole point of the control. Reroll clears `saved` already.
  if (!session || excludeEquipment) {
    try {
      const result = resolveSession({
        library,
        profile,
        history: loadHistory(),
        soreness: {},          // Phase 2 -- body map. spec §4.1
        dayType: session ? session.dayType : null,
        excludeEquipment: constraint,
        seed: Date.now()
      });
      if (!result.session) return mount(root, renderNothingBuildable());
      session = result.session;
      offer = result.offer;
    } catch (err) {
      return mount(root, renderError(err.message));
    }
    commitSession(session);
  }

  // The library is already in memory; the cues ride along with it rather than
  // being copied into every saved session. design-card-flip.md §4.
  const cuesFor = id => {
    const e = library.find(x => x.id === id);
    return e && e.cues && e.cues.length ? e.cues : null;
  };

  // Built once so the swap can re-render the same screen with a note added.
  const opts = {
    onReroll: () => showSession({ reroll: true, excludeEquipment: constraint }),
    cuesFor,
    offer,
    equipment: {
      items: offerableEquipment(session.blocks, library, constraint),
      selected: constraint,
      onToggle: item => showSession({
        excludeEquipment: constraint.includes(item)
          ? constraint.filter(q => q !== item)
          : [...constraint, item]
      })
    },
    onSwap: slotId => {
      const { block, reason } = swapBlock(session, slotId, library, {
        venue: session.venue,
        soreness: {},
        banned: profile.banned || [],
        excludeEquipment: constraint,
        profile,
        history: loadHistory()
      }, makeRng(Date.now()));
      // A dead control that silently does nothing is the failure mode this
      // design exists to avoid. design §5.3.
      if (!block) return mount(root, renderSession(session, { ...opts, swapNote: reason }));
      const i = session.blocks.findIndex(b => b.slot === slotId);
      session.blocks[i] = block;
      commitSession(session);
      showSession();
    }
  };

  mount(root, renderSession(session, opts));
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
