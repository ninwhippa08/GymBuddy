// app.js -- entry point and screen routing. spec §7
//
// Three states, no router: setup (no profile), session (normal), error, plus
// the nothing-buildable screen and the "did you finish this?" question.
// The swap control landed in v9 with the equipment constraint; the soreness
// body map landed in v13 and reads its flags off the profile, so they persist
// between sessions. spec §4.1, §8.

import {
  resolveSession, offerableEquipment, swapBlock, makeRng
} from './generator.js';
import { SORENESS_JOINTS } from './rules.js';
import {
  loadProfile, saveProfile, loadHistory, commitSession, sessionFor,
  pendingConfirmations, confirmSession, discardSession
} from './storage.js';
import {
  renderSession, renderSetup, renderError, renderNothingBuildable,
  renderConfirmPrevious, mount
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
function showSession({ reroll = false, excludeEquipment = null, soreChanged = false } = {}) {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const saved = reroll ? null : sessionFor(today());
  // The constraint lives on the record, so it survives a reroll and is gone
  // tomorrow -- which is what "this session only" means. design §3.3.
  const constraint = excludeEquipment ?? (saved && saved.excludeEquipment) ?? [];
  // Soreness lives on the PROFILE, not the session: spec §4.1 makes the flags
  // persist to the next session pre-checked, which is what turns them into a
  // de facto chronic-injury profile without asking him to maintain one.
  const soreness = profile.soreness || {};

  let session = saved;
  let offer = null;

  // A changed constraint rebuilds even when today's session is on the record:
  // that is the whole point of the control. Reroll clears `saved` already.
  if (!session || excludeEquipment || soreChanged) {
    try {
      const result = resolveSession({
        library,
        profile,
        history: loadHistory(),
        soreness,
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
    soreness: {
      joints: SORENESS_JOINTS,
      current: soreness,
      // Saved to the PROFILE before the rebuild, so the flag outlives today's
      // session -- that persistence is the whole point (spec §4.1). A `null`
      // level clears the joint rather than storing a falsy value that nothing
      // downstream would recognise as "fine".
      onCycle: (joint, level) => {
        const next = { ...soreness };
        if (level) next[joint] = level; else delete next[joint];
        saveProfile({ ...profile, soreness: next });
        showSession({ soreChanged: true, excludeEquipment: constraint });
      }
    },
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
        soreness,
        banned: profile.banned || [],
        excludeEquipment: constraint,
        profile,
        history: loadHistory()
      }, makeRng(Date.now()));
      // A dead control that silently does nothing is the failure mode this
      // design exists to avoid. design §5.3.
      if (!block) return mount(root, renderSession(session, { ...opts, swapNote: reason }));
      const i = session.blocks.findIndex(b => b.slot === slotId);
      // Remember what he turned down, so tapping swap again moves on instead
      // of reshuffling the same few. It rides on the session record, so it is
      // scoped to today exactly like the equipment constraint. spec §4.2.
      session.rejected = session.rejected || {};
      session.rejected[slotId] =
        [...(session.rejected[slotId] || []), session.blocks[i].exerciseId];
      session.blocks[i] = block;
      commitSession(session);
      showSession();
    }
  };

  mount(root, renderSession(session, opts));
}

// Asked at LAUNCH only, never after a swap or a reroll -- those call
// showSession directly. One question per unanswered day, most recent first,
// and it keeps asking until none are left rather than clearing one per launch.
// spec §6 limitation 1.
function showPendingOrSession() {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const pending = pendingConfirmations(loadHistory(), today());
  if (!pending.length) return showSession();

  const asking = pending[0];
  mount(root, renderConfirmPrevious(asking, {
    onYes: () => { confirmSession(asking.date); showPendingOrSession(); },
    onNo: () => { discardSession(asking.date); showPendingOrSession(); }
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
  showPendingOrSession();
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
