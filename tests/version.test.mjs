// The version he can see, and the update he can take. 2026-09-16.
//
// WHY THIS EXISTS. He trained a session and reported a warm-up at 12 and 11
// reps, with core printed after the stretches. Both had been fixed five days
// and six deploys earlier (v70). The live site served v75; his phone was
// running something older than v70, and nothing on screen could have told
// either of us. sw.js is cache-first with no skipWaiting, so a new version
// waits for a relaunch the athlete has no reason to know he needs.
// design-mobility-and-warmup.md §14.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { APP_VERSION } from '../js/version.js';

const SW_SOURCE = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// Run sw.js against a fake worker global and hand back what it registered.
function loadWorker() {
  const listeners = {};
  let skipped = 0;
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { skipped++; return Promise.resolve(); },
    location: { origin: 'https://example.test' },
    clients: { claim: () => Promise.resolve() }
  };
  const caches = { open: async () => ({ addAll: async () => {} }), keys: async () => [] };
  vm.runInNewContext(SW_SOURCE, { self, caches, fetch: () => {}, Request: class {}, URL, Response: class {} });
  return { listeners, skipped: () => skipped };
}

test('the version shown in the app is the version the worker caches under', () => {
  const m = /const VERSION = '([^']+)'/.exec(SW_SOURCE);
  assert.ok(m, 'sw.js no longer declares VERSION the way this test reads it');
  assert.equal(APP_VERSION, m[1],
    'js/version.js and sw.js disagree -- bump both on every deploy');
});

test('the worker precaches version.js, or the label would break offline', () => {
  assert.ok(SW_SOURCE.includes("'./js/version.js'"),
    'js/version.js is imported by app.js and must be in SHELL');
});

test('a waiting worker takes over when the app asks it to, and only then', () => {
  const w = loadWorker();
  assert.ok(w.listeners.message, 'sw.js registers no message listener');
  w.listeners.message({ data: 'something-else' });
  assert.equal(w.skipped(), 0, 'an unrelated message activated the worker');
  w.listeners.message({ data: 'SKIP_WAITING' });
  assert.equal(w.skipped(), 1, 'SKIP_WAITING did not call skipWaiting');
});

test('installing never takes over on its own -- a workout mid-read stays put', async () => {
  const w = loadWorker();
  const waits = [];
  w.listeners.install({ waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  assert.equal(w.skipped(), 0, 'install called skipWaiting');
});
