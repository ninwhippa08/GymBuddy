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
  assert.deepEqual(storage.readAll(),
    { schemaVersion: 1, profile: null, history: [], drafts: [] });
  assert.equal(storage.writeAll({ history: [] }), false);
});

test('a corrupt blob reads EMPTY instead of throwing', () => {
  installStorage({ 'gymbuddy.v1': '{not json' });
  assert.deepEqual(storage.readAll().history, []);
});

// --------------------------------------------------------------------------
// "Did you finish this?" -- spec §6 limitation 1, queued since Phase 1.
//
// Generating a session marks it done, so merely OPENING the app on a rest day
// writes a completed session. Those phantom entries feed the rolling pattern
// counts, the CNS account and the neglect scoring -- and since design §4.4 the
// exercise count reads the same counts, so they distort session SHAPE too.
//
// The mitigation the spec names is a one-tap confirmation on next launch, not
// a logging flow during the session: "no logging, no confirmation prompt"
// stays true of the workout itself. Today's session is never asked about --
// it is still in progress. It gets asked about tomorrow.
// --------------------------------------------------------------------------

test('a past session that was never confirmed is pending', () => {
  const history = [
    { date: '2026-08-30', dayType: 'max-strength' },
    { date: '2026-08-29', dayType: 'hypertrophy' }
  ];
  const pending = storage.pendingConfirmations(history, '2026-08-30');
  assert.deepEqual(pending.map(s => s.date), ['2026-08-29']);
});

test("today's session is never asked about -- it is still in progress", () => {
  const history = [{ date: '2026-08-30', dayType: 'max-strength' }];
  assert.deepEqual(storage.pendingConfirmations(history, '2026-08-30'), []);
});

test('a session already answered is not asked again', () => {
  const history = [
    { date: '2026-08-29', dayType: 'hypertrophy', confirmed: true },
    { date: '2026-08-28', dayType: 'power' }
  ];
  const pending = storage.pendingConfirmations(history, '2026-08-30');
  assert.deepEqual(pending.map(s => s.date), ['2026-08-28']);
});

test('several skipped days are all pending, newest first', () => {
  const history = [
    { date: '2026-08-29', dayType: 'a' },
    { date: '2026-08-27', dayType: 'b' },
    { date: '2026-08-25', dayType: 'c' }
  ];
  assert.deepEqual(
    storage.pendingConfirmations(history, '2026-08-30').map(s => s.date),
    ['2026-08-29', '2026-08-27', '2026-08-25']
  );
});

test('answering yes keeps the session and stops the asking', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-29'));
  storage.confirmSession('2026-08-29');

  assert.equal(storage.sessionFor('2026-08-29').confirmed, true);
  assert.deepEqual(storage.pendingConfirmations(storage.loadHistory(), '2026-08-30'), []);
});

test('answering no removes the session from history entirely', () => {
  // Not a flag -- gone. A session he did not do must not reach the CNS
  // account or the neglect score, and the cheapest way to guarantee that is
  // for it not to be there.
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-29'));
  storage.commitSession(sessionWith([], '2026-08-28'));
  storage.discardSession('2026-08-29');

  assert.equal(storage.sessionFor('2026-08-29'), null);
  assert.deepEqual(storage.loadHistory().map(s => s.date), ['2026-08-28']);
});

test('discarding a date that is not there changes nothing', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-28'));
  storage.discardSession('2026-07-01');
  assert.deepEqual(storage.loadHistory().map(s => s.date), ['2026-08-28']);
});

// --------------------------------------------------------------------------
// Movement drafts. Captured at the rack, sent to GitHub as an issue later.
//
// A draft is NOT a library entry and must never be mistaken for one: a real
// entry carries pattern, tier, modalities, joints, equipment and a sourced
// prCoef, and those decide whether it can be selected, what a hurt joint
// excludes, and how much weight goes on the bar. A draft is a name and a note
// -- the raw material for that work, kept where the generator cannot see it.
// --------------------------------------------------------------------------

test('a draft comes back with what was written on it', () => {
  installStorage();
  const saved = storage.addDraft('Dumbbell Clean', 'like a power clean but with two dumbbells');
  assert.equal(saved.name, 'Dumbbell Clean');
  assert.equal(saved.note, 'like a power clean but with two dumbbells');
  assert.ok(saved.id, 'a draft needs an id to be removable');
});

test('drafts come back newest first', () => {
  installStorage();
  storage.addDraft('First', 'a');
  storage.addDraft('Second', 'b');
  assert.deepEqual(storage.loadDrafts().map(d => d.name), ['Second', 'First']);
});

test('removing one draft leaves the others', () => {
  installStorage();
  const a = storage.addDraft('Keep Me', 'x');
  const b = storage.addDraft('Bin Me', 'y');
  storage.removeDraft(b.id);
  assert.deepEqual(storage.loadDrafts().map(d => d.name), ['Keep Me']);
  assert.equal(storage.loadDrafts()[0].id, a.id);
});

test('two drafts written in the same millisecond get different ids', () => {
  // Removal is by id. Ids that collide would delete the wrong row, and a
  // timestamp alone collides exactly when someone taps twice quickly.
  installStorage();
  const a = storage.addDraft('One', '');
  const b = storage.addDraft('Two', '');
  assert.notEqual(a.id, b.id);
});

test('drafts live beside the profile and history, not instead of them', () => {
  installStorage();
  storage.saveProfile({ returnDate: '2026-06-01', banned: [] });
  storage.commitSession(sessionWith([], '2026-08-30'));
  storage.addDraft('Dumbbell Clean', 'note');

  assert.equal(storage.loadProfile().returnDate, '2026-06-01');
  assert.equal(storage.loadHistory().length, 1);
  assert.equal(storage.loadDrafts().length, 1);
});

test('a store that has never held a draft reads as none, not as a crash', () => {
  installStorage({ 'gymbuddy.v1': JSON.stringify({ schemaVersion: 1, profile: null, history: [] }) });
  assert.deepEqual(storage.loadDrafts(), []);
});

// --------------------------------------------------------------------------
// Undoing a confirmation
// --------------------------------------------------------------------------

// Confirming was a one-way door: the card locked, dropped its Reroll, and
// there was no way back until the date rolled over. Reported from his phone --
// "it says logged for today and I cannot click anything anymore".
test('a confirmation can be undone, and the session survives it', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-29'));
  storage.confirmSession('2026-08-29');

  assert.equal(storage.unconfirmSession('2026-08-29'), true);
  assert.equal(storage.sessionFor('2026-08-29').confirmed, undefined);
  // The session itself is untouched -- undo is not "I didn't do it", which
  // removes the record entirely (discardSession). It only unlocks the card.
  assert.equal(storage.sessionFor('2026-08-29').dayType, 'max-strength');
});

test('undoing a day with no session on record reports that it did nothing', () => {
  installStorage();
  assert.equal(storage.unconfirmSession('2026-07-04'), false);
});

test('an undone day is asked about again on the next launch', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-29'));
  storage.confirmSession('2026-08-29');
  storage.unconfirmSession('2026-08-29');

  assert.deepEqual(
    storage.pendingConfirmations(storage.loadHistory(), '2026-08-30').map(s => s.date),
    ['2026-08-29']
  );
});

// --------------------------------------------------------------------------
// Backup: export and import. spec §6 "no export or import".
// --------------------------------------------------------------------------
//
// localStorage holds the only copy of the profile and the history, so this is
// the one gap in the app with no workaround at all -- clearing site data or
// changing phones loses everything. These tests cover the half a shim can
// honestly measure: building the blob, and reading one back. The delivery
// cascade (`navigator.share` -> `<a download>` -> clipboard) lives in app.js,
// needs a real device, and is asserted nowhere. Same honesty as the note at
// the top of this file about `showSession`.

test('an export carries an envelope, so an import can recognise it', () => {
  installStorage();
  storage.saveProfile(PROFILE);
  storage.commitSession(sessionWith([], '2026-08-29'));

  const { filename, json } = storage.exportBlob();
  const parsed = JSON.parse(json);

  // The envelope is what makes "is this one of ours?" answerable. Without it a
  // truncated file, or any other JSON on the phone, reaches the writer.
  assert.equal(parsed.app, 'gymbuddy');
  assert.equal(parsed.schemaVersion, 1);
  assert.match(parsed.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(parsed.state.profile.returnDate, '2026-08-01');
  assert.equal(parsed.state.history.length, 1);
  assert.match(filename, /^gymbuddy-backup-\d{4}-\d{2}-\d{2}\.json$/);
});

test('a backup read back reports what it holds before anything is written', () => {
  installStorage();
  storage.saveProfile(PROFILE);
  storage.commitSession(sessionWith([], '2026-08-29'));
  storage.commitSession(sessionWith([], '2026-08-31'));
  storage.addDraft('Dumbbell Clean', 'from the rack');

  const { json } = storage.exportBlob();
  const result = storage.readImport(json);

  assert.equal(result.ok, true);
  // The summary is what the confirmation names. A destructive step that cannot
  // say what it is about to destroy is not a confirmation.
  assert.equal(result.summary.sessions, 2);
  assert.equal(result.summary.drafts, 1);
  assert.equal(result.summary.from, '2026-08-29');
  assert.equal(result.summary.to, '2026-08-31');
  assert.equal(result.summary.hasProfile, true);
});

test('a full round trip restores the profile, the history and the drafts', () => {
  installStorage();
  storage.saveProfile(PROFILE);
  storage.commitSession(sessionWith(['barbell'], '2026-08-29'));
  storage.addDraft('Dumbbell Clean', 'from the rack');
  const { json } = storage.exportBlob();

  installStorage();                       // a different phone: nothing on it
  assert.equal(storage.loadHistory().length, 0);

  const result = storage.readImport(json);
  assert.equal(storage.applyImport(result.state), true);

  assert.equal(storage.loadProfile().returnDate, '2026-08-01');
  assert.deepEqual(storage.sessionFor('2026-08-29').excludeEquipment, ['barbell']);
  assert.equal(storage.loadDrafts()[0].name, 'Dumbbell Clean');
});

test('importing replaces what is there rather than merging into it', () => {
  installStorage();
  storage.commitSession(sessionWith([], '2026-08-29'));
  const { json } = storage.exportBlob();

  installStorage();
  storage.commitSession(sessionWith([], '2026-09-02'));   // a day not in the file
  storage.applyImport(storage.readImport(json).state);

  assert.deepEqual(storage.loadHistory().map(s => s.date), ['2026-08-29']);
});

// --------------------------------------------------------------------------
// Everything that must be refused
// --------------------------------------------------------------------------

const REJECTED = [
  ['not JSON at all', 'this is not json {'],
  ['JSON that is not an object', '"a string"'],
  ['a JSON array', '[1, 2, 3]'],
  ['some other app\'s export', JSON.stringify({ app: 'notgymbuddy', state: {} })],
  ['an envelope with no state', JSON.stringify({ app: 'gymbuddy', schemaVersion: 1 })],
  ['a state with no history array', JSON.stringify({
    app: 'gymbuddy', schemaVersion: 1, state: { profile: null, history: 'nope' } })],
  ['a session with no date', JSON.stringify({
    app: 'gymbuddy', schemaVersion: 1,
    state: { profile: null, history: [{ dayType: 'power' }], drafts: [] } })],
  ['a schemaVersion from the future', JSON.stringify({
    app: 'gymbuddy', schemaVersion: 99,
    state: { profile: null, history: [], drafts: [] } })]
];

for (const [label, text] of REJECTED) {
  test(`${label} is refused with a reason`, () => {
    installStorage();
    const result = storage.readImport(text);
    assert.equal(result.ok, false, `${label} was accepted`);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0, 'a refusal with no reason tells him nothing');
  });
}

// The reason readImport and applyImport are two functions rather than one.
test('a refused import leaves the existing data byte-identical', () => {
  const map = installStorage();
  storage.saveProfile(PROFILE);
  storage.commitSession(sessionWith([], '2026-08-29'));
  const before = map.get('gymbuddy.v1');

  for (const [, text] of REJECTED) storage.readImport(text);

  assert.equal(map.get('gymbuddy.v1'), before,
    'reading a bad import changed the store');
});

test('an empty but valid backup is accepted -- a new phone has nothing on it', () => {
  installStorage();
  const result = storage.readImport(JSON.stringify({
    app: 'gymbuddy', schemaVersion: 1,
    state: { profile: null, history: [], drafts: [] }
  }));
  assert.equal(result.ok, true);
  assert.equal(result.summary.sessions, 0);
  assert.equal(result.summary.from, null);
  assert.equal(result.summary.hasProfile, false);
});
