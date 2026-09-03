// The launch path. design-home-and-calendar.md §2, §3.
//
// app.js has never had tests: it needs a root element, localStorage, fetch and
// a working replaceChildren, and dom-shim.mjs deliberately THROWS on the last
// of those so that a missing DOM feature cannot pass silently. plan-08 accepted
// that gap and named the manual browser script as the compensating control.
//
// This file exists because the central claim of the feature -- LAUNCHING THE
// APP WRITES NOTHING -- is a claim about app.js and nothing else, and it is a
// regression that would be invisible everywhere else in the suite. The shim is
// extended here rather than in dom-shim.mjs: those throws guard ui.js, which
// should not gain a dependency on a DOM feature just because app.js needs one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom, Element } from './dom-shim.mjs';

const KEY = 'gymbuddy.v1';

// --------------------------------------------------------------------------
// Enough browser to boot
// --------------------------------------------------------------------------

function installBrowser() {
  const document = installDom();

  // mount() calls both of these. The shim's replaceChildren throws on purpose;
  // a real one is needed to boot, so it is defined here and nowhere else.
  Element.prototype.replaceChildren = function replaceChildren(node) {
    this.childNodes = [];
    if (node) this.append(node);
  };
  globalThis.window = { scrollTo() {} };

  const root = new Element('div');
  document.getElementById = id => (id === 'app' ? root : null);

  // navigator is a getter-only global in node 24, so it is defined rather than
  // assigned. No serviceWorker key on it: registerServiceWorker returns early,
  // which is correct -- there is no worker to register here.
  const define = (name, value) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

  define('navigator', {});

  const store = new Map();
  define('localStorage', {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); }
  });

  // The real library, so FILL has real exercises to choose from.
  const library = readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8');
  define('fetch', async () => ({ ok: true, status: 200, json: async () => JSON.parse(library) }));

  return { root, store };
}

const readState = store => JSON.parse(store.get(KEY) || '{"history":[]}');

// A profile that is well past the ramp, so nothing is blocked for being early.
const seedProfile = store => store.set(KEY, JSON.stringify({
  schemaVersion: 1,
  profile: { returnDate: '2026-01-05', banned: [], plyoLevel: 'beginner' },
  history: [],
  drafts: []
}));

// app.js runs boot() at import time and boot is async, so the module has to be
// re-imported per test with a cache-busting query and then given a tick to
// finish. A plain `await import` returns before boot's fetch resolves.
let bust = 0;
async function boot() {
  await import(`../js/app.js?t=${bust++}`);
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
}

// --------------------------------------------------------------------------
// The claim
// --------------------------------------------------------------------------

test('launching the app writes NOTHING to history', async () => {
  // storage.js:78 -- "merely OPENING the app on a rest day writes a completed
  // workout". That is the behaviour this feature exists to end. If this test
  // ever goes red, phantom entries are back in the CNS account, the neglect
  // score and (design §4.4) the exercise count.
  const { store } = installBrowser();
  seedProfile(store);

  await boot();

  assert.deepEqual(readState(store).history, [],
    'launching the app wrote a session to history');
});

test('the home screen is what a launch renders', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);

  await boot();

  assert.ok(root.querySelector('.screen-home'), 'did not land on the home screen');
  assert.ok(root.querySelector('.home-generate'), 'no generate button on launch');
  assert.ok(root.querySelector('.calendar'), 'no calendar on launch');
});

test('a profile-less launch lands on setup, still writing nothing', async () => {
  const { root, store } = installBrowser();

  await boot();

  assert.ok(root.querySelector('.screen-setup'), 'did not land on setup');
  assert.equal(store.has(KEY), false, 'setup wrote to storage before being asked');
});

test('tapping generate is what writes the session', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();

  assert.deepEqual(readState(store).history, [], 'precondition: nothing written yet');

  root.querySelector('.home-generate').dispatch('click');

  const history = readState(store).history;
  assert.equal(history.length, 1, 'the tap did not write exactly one session');
  assert.equal(history[0].confirmed, undefined,
    'a generated session must not arrive pre-confirmed');
});

test('the generated session renders as a card, not the home screen', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();

  root.querySelector('.home-generate').dispatch('click');

  assert.equal(root.querySelector('.screen-home'), null, 'still on home after generating');
  assert.ok(root.querySelector('.session-head'), 'no session card after generating');
});

test('the card offers a way back to home', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();
  root.querySelector('.home-generate').dispatch('click');

  root.querySelector('.session-home').dispatch('click');

  assert.ok(root.querySelector('.screen-home'), 'Home did not return to the home screen');
});

// --------------------------------------------------------------------------
// design §3: reopening mid-session
// --------------------------------------------------------------------------

test('reopening with today unconfirmed goes straight to the card', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();
  root.querySelector('.home-generate').dispatch('click');

  // Relaunch against the same storage.
  await boot();

  assert.ok(root.querySelector('.session-head'), 'did not go straight to the workout');
  assert.equal(root.querySelector('.screen-home'), null);
});

test('generating twice in one day does not write a second entry', async () => {
  // storage.commitSession replaces by date, and the neglect model reads every
  // entry -- two rows for one day would double-count patternSets and cnsLoad.
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();
  root.querySelector('.home-generate').dispatch('click');
  await boot();

  assert.equal(readState(store).history.length, 1);
});

// --------------------------------------------------------------------------
// Backup. spec §6.6
// --------------------------------------------------------------------------
//
// The delivery cascade (`navigator.share` -> `<a download>` -> clipboard) is
// NOT asserted anywhere and cannot be: it needs a real share sheet on a real
// phone. What this boot CAN prove is the half that would otherwise only be
// proven by opening the app -- that the panel is on the launched screen at
// all, that it is wired to the real storage module rather than to a fixture,
// and that a `navigator` with no `share` on it does not stop the app booting.

test('the backup panel is on the screen a launch renders', async () => {
  const { root, store } = installBrowser();
  seedProfile(store);

  await boot();

  const panel = root.querySelector('.backup');
  assert.ok(panel, 'no backup panel on the home screen');
  assert.ok(root.querySelector('.backup-save'), 'no way to save a backup');
  assert.ok(root.querySelector('.backup-file'), 'no way to choose a file');
  // Collapsed, and offering nothing destructive until a file has been read.
  assert.equal(panel.getAttribute('open'), null);
  assert.equal(root.querySelector('.backup-apply'), null,
    'a launch offered to overwrite the history');
});

test('rendering the backup panel writes nothing', async () => {
  // The panel reads the history to say how many sessions a restore would
  // destroy. Reading is all it may do -- this is the same claim as the first
  // test in this file, re-made against the code that was added after it.
  const { store } = installBrowser();
  seedProfile(store);
  const before = store.get(KEY);

  await boot();

  assert.equal(store.get(KEY), before, 'launching with the panel wrote to storage');
});

test('a backup taken from a booted app can be read back by the app', async () => {
  // End to end through the real modules, not through a hand-built blob: boot,
  // generate a session so there is something worth keeping, export, wipe, and
  // import. This is the claim the whole feature exists to make.
  const { root, store } = installBrowser();
  seedProfile(store);
  await boot();

  root.querySelector('.home-generate').dispatch('click');
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
  const trained = readState(store).history;
  assert.equal(trained.length, 1, 'nothing was generated to back up');

  const storage = await import('../js/storage.js');
  const { json } = storage.exportBlob();

  store.delete(KEY);                       // the phone is gone
  assert.deepEqual(storage.loadHistory(), []);

  const result = storage.readImport(json);
  assert.equal(result.ok, true, result.error);
  assert.equal(storage.applyImport(result.state), true);

  assert.deepEqual(storage.loadHistory().map(s => s.date), trained.map(s => s.date));
  assert.equal(storage.loadProfile().returnDate, '2026-01-05');
});
