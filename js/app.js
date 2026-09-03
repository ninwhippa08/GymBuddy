// app.js -- entry point and screen routing. spec §7
//
// Three states, no router: setup (no profile), session (normal), error, plus
// the nothing-buildable screen and the "did you finish this?" question.
// The swap control landed in v9 with the equipment constraint; the soreness
// body map landed in v13 and reads its flags off the profile, so they persist
// between sessions. spec §4.1, §8.

import {
  resolveSession, offerableEquipment, swapBlock, makeRng, localDate, rampWeekFor
} from './generator.js';
import { shiftMonth, daysSinceLastSession } from './calendar.js';
import { SORENESS_JOINTS } from './rules.js';
import {
  loadProfile, saveProfile, loadHistory, commitSession, sessionFor,
  pendingConfirmations, confirmSession, unconfirmSession, discardSession,
  addDraft, loadDrafts, removeDraft, exportBlob, readImport, applyImport
} from './storage.js';
import {
  renderSession, renderSetup, renderError, renderNothingBuildable,
  renderConfirmPrevious, renderHome, mount
} from './ui.js';

const root = document.getElementById('app');

// GitHub's pre-filled new-issue form. A draft is sent by OPENING this link --
// the app holds no token and writes nothing to the repo; he is already signed
// in and submits it himself. design: capture here, author in a session.
const ISSUE_BASE = 'https://github.com/ninwhippa08/GymBuddy/issues/new';

let library = null;

// A chosen-but-not-yet-applied backup, and why the last one was refused. Held
// here rather than on the profile because it must not survive a reload: a
// pending restore is a question waiting for an answer on THIS screen, and one
// that outlived a relaunch would sit there offering to wipe the history of a
// session that has moved on.
let pendingRestore = null;      // { state, summary } from readImport
let restoreError = '';

// The local calendar day. NOT toISOString() -- see generator.js's localDate
// for why that locked his card the morning after an evening session.
function today() {
  return localDate();
}

// --------------------------------------------------------------------------
// Screens
// --------------------------------------------------------------------------

function showSetup() {
  mount(root, renderSetup({
    onSubmit(returnDate) {
      if (!returnDate) return;
      saveProfile({ returnDate, banned: [], plyoLevel: 'beginner' });
      showHome();
    }
  }));
}

// Generating a session marks it done, so a session already committed for today
// is shown as-is rather than regenerated. Without this, every app launch would
// silently replace the workout the user is halfway through. spec §1.
function showSession({
  reroll = false, excludeEquipment = null, generate = false, openPanel = null
} = {}) {
  const profile = loadProfile();
  if (!profile || !profile.returnDate) return showSetup();

  const saved = reroll ? null : sessionFor(today());
  // Read whether or not this is a reroll: it carries the rotation's memory of
  // which day types have already been offered today, and a reroll clears
  // `saved` before that can be read off it.
  const onRecord = sessionFor(today());
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
  // A confirmed session is training he has reported doing, so nothing
  // regenerates it -- not a reroll (the card no longer offers one), and not a
  // soreness or equipment change, which from here on are about tomorrow.
  // `generate` is the whole feature: opening the app no longer builds anything.
  // A session is written when he ASKS for one, not when he looks at the app.
  // design §2. Reroll and an equipment change still rebuild -- both are taps on
  // a session that already exists.
  const locked = !!(session && session.confirmed);
  if (!locked && (generate || reroll || excludeEquipment)) {
    try {
      const result = resolveSession({
        library,
        profile,
        history: loadHistory(),
        soreness,
        dayType: session ? session.dayType : null,
        excludeEquipment: constraint,
        seed: Date.now(),
        // Walks the ranking down instead of swapping between the top two.
        // generator.js's proposeDayType explains why the list is needed.
        offeredDayTypes: (onRecord && onRecord.offeredDayTypes) || []
      });
      if (!result.session) return mount(root, renderNothingBuildable());
      session = result.session;
      offer = result.offer;
    } catch (err) {
      return mount(root, renderError(err.message));
    }
    commitSession(session);
  }

  // Nothing on the record and nothing asked for: that is the home screen's
  // job now, not an empty card. Reachable if a stale link or a reload lands
  // here on a rest day.
  if (!session) return showHome();

  // The library is already in memory; the cues ride along with it rather than
  // being copied into every saved session. design-card-flip.md §4.
  const cuesFor = id => {
    const e = library.find(x => x.id === id);
    return e && e.cues && e.cues.length ? e.cues : null;
  };

  // Built once so the swap can re-render the same screen with a note added.
  const opts = {
    onReroll: () => showSession({ reroll: true, excludeEquipment: constraint }),
    // The record is already on disk -- generating wrote it (spec §1). This
    // marks it as training he did, which is what keeps it out of tomorrow's
    // "Did you finish this?" and what stops it being rerolled away.
    onDone: () => { confirmSession(today()); showSession(); },
    // Lifts the confirmation and nothing else: the session stays on the
    // record, the card unlocks, Reroll comes back, and the day goes back into
    // tomorrow's prompt. Not discardSession -- "undo" is not "I didn't do it".
    onUndo: () => { unconfirmSession(today()); showSession(); },
    cuesFor,
    offer,
    onHome: () => showHome(),
    // Neither of these regenerates: writing a note down must not reshuffle the
    // workout he is halfway through. showSession is called with no `generate`,
    // no reroll and no excludeEquipment, so it re-renders the saved session.
    addMove: {
      drafts: loadDrafts(),
      issueBase: ISSUE_BASE,
      open: openPanel === 'addmove',
      onSave: (name, text) => {
        addDraft(name, text);
        showSession({ openPanel: 'addmove' });
      },
      onRemove: id => {
        removeDraft(id);
        showSession({ openPanel: 'addmove' });
      }
    },
    equipment: {
      items: offerableEquipment(session.blocks, library, constraint),
      selected: constraint,
      open: openPanel === 'equipment',
      onToggle: item => showSession({
        openPanel: 'equipment',
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

// --------------------------------------------------------------------------
// Home
// --------------------------------------------------------------------------

// The month the calendar is showing. Not persisted on purpose: paging back to
// March and closing the app should not mean opening it in March next week.
let calYear = null;
let calMonth = null;

// --------------------------------------------------------------------------
// Backup delivery. spec §6
// --------------------------------------------------------------------------

// Three ways to hand over a file, tried in order, because no single one of
// them works everywhere and the athlete is on an iPhone.
//
// 1. `navigator.share` with a File. On iOS this is the only path that behaves:
//    it opens the share sheet, so the backup can go to Files, AirDrop or Mail.
//    Requires a secure context and a user gesture, both of which a tap on the
//    button gives us.
// 2. `<a download>` with a blob URL. The desktop answer, and Android's. In an
//    iOS standalone PWA it has historically done nothing at all, which is
//    exactly why it is second and not first.
// 3. The clipboard. A last resort and openly a poor one: a year of training is
//    around half a megabyte of JSON, and pasting that anywhere useful on a
//    phone is unpleasant. It is here so that the answer is never "nothing
//    happened".
//
// NONE of this is covered by the test suite. It needs a real device with a
// real share sheet, and a shim standing in for `navigator.share` would only
// assert that the code calls the function it obviously calls. `tests/
// storage.test.mjs` carries the same note about `showSession`. Checked by hand
// on the phone, like every other release.
async function deliver(filename, json) {
  const file = typeof File === 'function'
    ? new File([json], filename, { type: 'application/json' })
    : null;

  // canShare({files}) is the documented way to ask, and skipping it is how you
  // get a rejected promise on a browser that has share() but not file sharing.
  if (file && navigator.share && navigator.canShare
      && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      // A cancelled share sheet is not a failure and must not fall through to
      // dumping half a megabyte on the clipboard. Every other error may.
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Not revoked synchronously: Safari has cancelled the download it just
    // started when the URL went away in the same tick.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  } catch { /* fall through */ }

  try {
    await navigator.clipboard.writeText(json);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function backupPanel() {
  return {
    open: pendingRestore !== null || restoreError !== '',
    pending: pendingRestore && pendingRestore.summary,
    existing: { sessions: loadHistory().length },
    error: restoreError,

    onExport: async () => {
      const { filename, json } = exportBlob();
      const how = await deliver(filename, json);
      restoreError = how === 'failed'
        ? 'This phone would not let the app hand over the file.'
        : how === 'copied'
          ? 'Saving was not available, so the backup is on your clipboard instead.'
          : '';
      if (restoreError) showHome();
    },

    onFile: async f => {
      pendingRestore = null;
      restoreError = '';
      if (!f) return;
      let text;
      try {
        text = await f.text();
      } catch {
        restoreError = 'That file could not be read.';
        return showHome();
      }
      const result = readImport(text);
      if (result.ok) pendingRestore = result;
      else restoreError = result.error;
      showHome();
    },

    // The only call that writes. Everything above this point is reversible.
    onApply: () => {
      if (!pendingRestore) return;
      const ok = applyImport(pendingRestore.state);
      pendingRestore = null;
      restoreError = ok ? '' : 'The restore could not be saved to this phone.';
      // The calendar is pinned to a month that may predate the restored
      // history, and the profile behind the whole screen has just been
      // replaced. Reset both and rebuild from what is now on disk.
      calYear = null;
      calMonth = null;
      showHome();
    },

    onCancel: () => {
      pendingRestore = null;
      restoreError = '';
      showHome();
    }
  };
}

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
    // No second argument: rampWeekFor takes a TIMESTAMP and defaults to
    // Date.now(). Handing it a 'YYYY-MM-DD' string subtracts a string from a
    // number and puts NaN in the status line.
    rampWeek: rampWeekFor(profile),
    daysSince: daysSinceLastSession(history, date),
    todaySession: sessionFor(date),
    soreness: {
      joints: SORENESS_JOINTS,
      current: soreness,
      // Soreness lives on the PROFILE, so the flags persist pre-checked into
      // the next session (spec §4.1). Nothing regenerates here -- there is
      // nothing generated yet, which is the entire point of this screen.
      onCycle: (joint, level) => {
        const next = { ...soreness };
        if (level) next[joint] = level; else delete next[joint];
        saveProfile({ ...profile, soreness: next });
        showHome();
      }
    },
    calendar: {
      year: calYear, month: calMonth, history, today: date,
      onPrev: () => {
        ({ year: calYear, month: calMonth } = shiftMonth(calYear, calMonth, -1));
        showHome();
      },
      onNext: () => {
        ({ year: calYear, month: calMonth } = shiftMonth(calYear, calMonth, 1));
        showHome();
      },
      onPick: d => showPastSession(d)
    },
    backup: backupPanel(),
    onGenerate: () => showSession({ generate: true }),
    onOpenToday: () => showSession()
  }));
}

// A day already trained, rendered by the same function as a live card but with
// every control withheld. design §7.
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

// Asked at LAUNCH only, never after a swap or a reroll -- those call
// showSession directly. One question per unanswered day, most recent first,
// and it keeps asking until none are left rather than clearing one per launch.
// spec §6 limitation 1.
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

  // Straight back to the card once today is under way: he reopens the app
  // between sets, and putting a calendar between him and the workout he is
  // halfway through is friction in the one place the app should disappear.
  // A CONFIRMED session does not qualify -- training is over. design §3.
  const t = sessionFor(today());
  if (t && !t.confirmed) return showSession();
  return showHome();
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
  showPendingOrHome();
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
