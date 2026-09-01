// Reroll rotation. The reported bug: tapping Reroll ping-ponged between two
// day types forever and could never reach a third, because committing today's
// session rewrites the very history the neglect score reads (storage.js's
// replace-by-date). Every test here drives the loop the way app.js does:
// resolve, replace today's record, resolve again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSession } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const NOW = Date.parse('2026-09-01T18:00:00Z');
const PROFILE = { returnDate: '2026-08-18', banned: [], plyoLevel: 'beginner' };
const iso = t => new Date(t).toISOString().slice(0, 10);

// A history built the way the app builds one: real generated sessions on real
// past dates, so the neglect scores and CNS account are the ones he would have.
function pastSessions(offsets, soreness = {}) {
  const history = [];
  for (const off of offsets.slice().sort((a, b) => b - a)) {
    const t = NOW - off * DAY;
    const r = resolveSession({
      library: LIB, profile: PROFILE, history, soreness,
      dayType: null, excludeEquipment: [], seed: t, now: t
    });
    history.push({ ...r.session, date: iso(t), confirmed: true });
  }
  return history;
}

// app.js's reroll loop: `saved` is cleared, the record is replaced by date,
// and the day types already offered today ride along on the record.
function tapReroll(history, taps, soreness = {}) {
  const h = history.map(s => ({ ...s }));
  const seen = [];
  for (let i = 0; i < taps; i++) {
    const prev = h.find(s => s.date === iso(NOW));
    const r = resolveSession({
      library: LIB, profile: PROFILE, history: h, soreness,
      dayType: null, excludeEquipment: [], seed: NOW + i, now: NOW,
      offeredDayTypes: (prev && prev.offeredDayTypes) || []
    });
    assert.ok(r.session, `reroll ${i} built nothing`);
    const j = h.findIndex(s => s.date === r.session.date);
    if (j >= 0) h[j] = r.session; else h.push(r.session);
    seen.push(r.session.dayType);
  }
  return seen;
}

test('repeated rerolls do not ping-pong between two day types', () => {
  const seen = tapReroll(pastSessions([12, 9, 5, 2]), 6);
  const distinct = new Set(seen);
  assert.ok(
    distinct.size >= 4,
    `six rerolls offered only ${distinct.size} day types: ${seen.join(' -> ')}`
  );
});

test('the rotation offers every open day type before repeating one', () => {
  const history = pastSessions([12, 9, 5, 2]);
  const open = new Set(
    resolveSession({
      library: LIB, profile: PROFILE, history, soreness: {},
      dayType: null, excludeEquipment: [], seed: NOW, now: NOW
    }).session.candidates.filter(c => !c.vetoed).map(c => c.dayType)
  );

  const seen = tapReroll(history, open.size);
  assert.deepEqual(
    new Set(seen), open,
    `${open.size} taps should cover the open field, got ${seen.join(' -> ')}`
  );
  assert.equal(new Set(seen).size, seen.length, `a day type repeated: ${seen.join(' -> ')}`);
});

test('the rotation wraps to the top once the open field is exhausted', () => {
  const history = pastSessions([12, 9, 5, 2]);
  const open = resolveSession({
    library: LIB, profile: PROFILE, history, soreness: {},
    dayType: null, excludeEquipment: [], seed: NOW, now: NOW
  }).session.candidates.filter(c => !c.vetoed).length;

  const seen = tapReroll(history, open + 1);
  assert.equal(seen[open], seen[0], `the tap after a full cycle should restart it: ${seen.join(' -> ')}`);
});

test('a vetoed day type never enters the rotation', () => {
  // A heavy session yesterday holds the CNS account above the threshold, which
  // vetoes every HIGH_CNS_DAY_TYPE. Those must not be offered however many
  // times he taps -- the rotation walks the open field, not the whole field.
  const history = [{
    date: iso(NOW - DAY), dayType: 'max-strength', cnsLoad: 9,
    patternSets: {}, blocks: [], confirmed: true
  }];
  const seen = tapReroll(history, 6);
  for (const dt of ['max-strength', 'power', 'plyometric', 'sprint']) {
    assert.ok(
      !seen.includes(dt),
      `${dt} was offered with the CNS account still loaded: ${seen.join(' -> ')}`
    );
  }
});

test('a rebuild of the same day type keeps the rotation memory', () => {
  // Toggling equipment or a sore joint regenerates today WITHOUT changing the
  // day type (app.js passes it back in). That must not wipe what the rotation
  // has already offered, or the next tap could walk back over it.
  const history = pastSessions([12, 9, 5, 2]);
  const rebuilt = resolveSession({
    library: LIB, profile: PROFILE, history, soreness: {},
    dayType: 'interval', excludeEquipment: [], seed: NOW, now: NOW,
    offeredDayTypes: ['interval', 'sprint']
  }).session;

  assert.deepEqual(rebuilt.offeredDayTypes, ['interval', 'sprint']);
});

test('a record written before the rotation existed still rerolls off its day type', () => {
  // Every session saved before v18 carries no offeredDayTypes -- including the
  // one sitting on his phone the moment he upgrades. Read as an empty list,
  // the rotation would exclude nothing, re-pick the arg-max and hand him back
  // the day type he is already looking at: the reported bug's symptom, on the
  // first tap after the fix shipped.
  const history = pastSessions([12, 9, 5, 2]);
  const legacy = { ...history[0] };
  const today = resolveSession({
    library: LIB, profile: PROFILE, history, soreness: {},
    dayType: null, excludeEquipment: [], seed: NOW, now: NOW
  }).session;
  delete today.offeredDayTypes;                    // as an older version wrote it
  const withLegacy = [today, ...history];

  const next = resolveSession({
    library: LIB, profile: PROFILE, history: withLegacy, soreness: {},
    dayType: null, excludeEquipment: [], seed: NOW + 1, now: NOW,
    offeredDayTypes: []
  }).session;

  assert.notEqual(next.dayType, today.dayType,
    `the first tap handed back the same day type: ${today.dayType}`);
  assert.ok(legacy.date < today.date);              // the fixture is what it claims
});
