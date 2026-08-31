// localStorage round-trip. spec §7, design-equipment-and-swap.md §3.3.
//
// storage.js had NO tests until now, so the claim that a per-session equipment
// constraint "survives a reroll and is gone tomorrow" had never been executed
// -- only read. This file executes it against the real storage.js.
//
// NOT covered here, and still not covered anywhere: `js/app.js`. The line that
// restores the constraint on reload
//
//     const constraint = excludeEquipment ?? (saved && saved.excludeEquipment) ?? [];
//
// lives inside `showSession`, which reads `document.getElementById` at import
// time and cannot be imported into Node. Re-stating that expression here would
// test a copy of it, which is worth nothing. What these tests prove is that the
// field it reads is genuinely on the record after a write and a read -- the
// half that a shim can honestly measure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

// The smallest localStorage that is honest: a string-valued map that throws on
// nothing. The failure modes storage.js guards (quota, private mode) get their
// own stub below rather than being simulated here by accident.
function installStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    get length() { return map.size; }
  };
  return map;
}

// Imported AFTER the stub exists is not required -- storage.js touches
// localStorage only inside its functions -- but the tests each install a fresh
// one so no test can inherit another's history.
const storage = await import('../js/storage.js');

const PROFILE = { returnDate: '2026-08-01', banned: [], plyoLevel: 'beginner' };

function sessionWith(excludeEquipment, date, seed = 42) {
  const s = generate({
    library: LIB, profile: PROFILE, history: [], soreness: {},
    dayType: 'max-strength', excludeEquipment, seed
  });
  s.date = date;
  return s;
}

// --------------------------------------------------------------------------
// The round trip
// --------------------------------------------------------------------------

test('generate puts the constraint on the session record', () => {
  const s = sessionWith(['barbell'], '2026-08-30');
  assert.deepEqual(s.excludeEquipment, ['barbell']);
});

test('the constraint survives a write and a read', () => {
  installStorage();
  storage.commitSession(sessionWith(['barbell', 'rack'], '2026-08-30'));

  const back = storage.sessionFor('2026-08-30');
  assert.ok(back, 'nothing came back for today');
  assert.deepEqual(back.excludeEquipment, ['barbell', 'rack']);
});

test('it survives as JSON, not as a live object reference', () => {
  // The round trip is JSON.stringify/parse. A Set or a Map would come back as
  // `{}` with no error anywhere, so assert the shape that actually persists.
  const map = installStorage();
  storage.commitSession(sessionWith(['barbell'], '2026-08-30'));

  const raw = JSON.parse(map.get('gymbuddy.v1'));
  assert.ok(Array.isArray(raw.history[0].excludeEquipment));
  assert.deepEqual(raw.history[0].excludeEquipment, ['barbell']);
});

test('an unconstrained session persists an empty constraint, not undefined', () => {
  // `saved.excludeEquipment ?? []` in app.js tolerates undefined, but a field
  // that vanishes from the record is a field no later reader can trust.
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-30'));
  assert.deepEqual(storage.sessionFor('2026-08-30').excludeEquipment, []);
});

// --------------------------------------------------------------------------
// "This session only" -- design §3.3
// --------------------------------------------------------------------------

test('a constrained regenerate REPLACES today rather than appending', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-30'));
  const history = storage.commitSession(sessionWith(['barbell'], '2026-08-30'));

  assert.equal(history.length, 1, 'the constrained rebuild appended a second entry');
  assert.deepEqual(history[0].excludeEquipment, ['barbell']);
});

test("yesterday's constraint does not reach today", () => {
  installStorage();
  storage.commitSession(sessionWith(['barbell'], '2026-08-29'));
  storage.commitSession(sessionWith([], '2026-08-30'));

  assert.deepEqual(storage.sessionFor('2026-08-29').excludeEquipment, ['barbell']);
  assert.deepEqual(storage.sessionFor('2026-08-30').excludeEquipment, []);
});

// --------------------------------------------------------------------------
// The failure modes storage.js claims to survive
// --------------------------------------------------------------------------

test('a disabled store reads EMPTY instead of throwing', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('private mode'); },
    setItem() { throw new Error('private mode'); },
    removeItem() { throw new Error('private mode'); }
  };
  assert.deepEqual(storage.readAll(), { schemaVersion: 1, profile: null, history: [] });
  assert.equal(storage.writeAll({ history: [] }), false);
});

test('a corrupt blob reads EMPTY instead of throwing', () => {
  installStorage({ 'gymbuddy.v1': '{not json' });
  assert.deepEqual(storage.readAll().history, []);
});
