import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, countsTowardVolume } from '../js/generator.js';
import { TIME, SESSION_ORDER } from '../js/rules.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const COOLDOWN_ROLES = ['mobility', 'core'];
const isMain = b => b.role !== 'prep' && !COOLDOWN_ROLES.includes(b.role);

// Ramp week N is derived from returnDate; walk it across the whole ramp.
const sessions = [];
for (const dayType of PHASE_1_DAY_TYPES) {
  for (let week = 1; week <= 5; week++) {
    for (let seed = 1; seed <= 40; seed++) {
      const now = Date.now();
      sessions.push(generate({
        library: LIB,
        profile: {
          returnDate: new Date(now - (week - 1) * 7 * DAY)
            .toISOString().slice(0, 10)
        },
        history: [], soreness: {}, dayType, seed, now
      }));
    }
  }
}

test('the sweep produced sessions for every day type and ramp week', () => {
  assert.equal(sessions.length, PHASE_1_DAY_TYPES.length * 5 * 40);
});

// design 7 -- the ordering assertion, and the reason this work exists.
test('every dynamic drill sorts before every main-work block', () => {
  for (const s of sessions) {
    const lastPrep = s.blocks.map(b => b.role).lastIndexOf('prep');
    const firstMain = s.blocks.findIndex(isMain);
    if (lastPrep === -1 || firstMain === -1) continue;
    assert.ok(lastPrep < firstMain,
      `${s.dayType}/${s.seed}: prep ran after the main work`);
  }
});

test('every static stretch and core block sorts after the main work', () => {
  for (const s of sessions) {
    const lastMain = s.blocks.map(isMain).lastIndexOf(true);
    const firstCool = s.blocks.findIndex(b => COOLDOWN_ROLES.includes(b.role));
    if (lastMain === -1 || firstCool === -1) continue;
    assert.ok(firstCool > lastMain,
      `${s.dayType}/${s.seed}: cool-down ran before the main work ended`);
  }
});

// The brief's original blanket "no block anywhere is ever mode 'time'" broke
// on aerobic-steady's own main slot A (the steady run, legitimately dosed by
// duration -- spec 9.1, unrelated to the prep/cool-down split). Scoped to the
// two roles the split actually governs, matching the test's own name.
test('no drill is ever dosed in minutes and no stretch in reps', () => {
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (b.role === 'prep') assert.equal(b.mode, 'drill');
      if (b.role === 'mobility') assert.equal(b.mode, 'hold');
    }
  }
});

// Ruling C7: design 5's arithmetic (3 + 45 + 12 = 60) is contradicted by up to
// FLOOR_OVERRUN_ALLOWANCE_MIN by packCooldown's own sourced floor -- Task 6
// measured 63 min worst case (max-strength/power) across 80,000 samples. The
// allowance is that measured overrun, not a designed number, so this test
// checks the real ceiling rather than the unattainable 60.
test('no session exceeds 60 minutes plus the measured floor-overrun allowance', () => {
  for (const s of sessions) {
    assert.ok(
      s.durationMin <= TIME.GYM_SESSION_TOTAL_MIN + TIME.FLOOR_OVERRUN_ALLOWANCE_MIN,
      `${s.dayType}/${s.seed} ran ${s.durationMin} min`);
  }
});

// Ruling C8: the 40-seed shared sweep above is too narrow to stand behind a
// ceiling -- the 63 min figure came from 80,000 samples. This is the
// reproducible, deterministic replacement for Task 6's deleted throwaway
// script: a fixed sweep per Phase-1 day type at full ramp volume (no
// returnDate -- see rampWeekFor), so it probes the worst case rather than an
// arbitrary point in the ramp.
//
// WIDENED 2026-08-25, 1000 seeds -> 10000. At 1000 this test could no longer
// fail: closing mobility-dynamic moved the true worst case to 65 min on
// power/seed 7919, which a 1000-seed sweep never reaches, so the test passed
// against a stale 4 min allowance. A ceiling test that cannot reach the seed
// producing the ceiling is not a test. The seed count must stay >= the one
// the allowance was derived from -- currently 10000 x 4 day types = 40,000.
// It costs about 7s of the suite's ~9s; that is the price of the number
// being measured rather than asserted.
test('duration sweep (10000 seeds x day type): observed maximum stays within the measured allowance', () => {
  const ceiling = TIME.GYM_SESSION_TOTAL_MIN + TIME.FLOOR_OVERRUN_ALLOWANCE_MIN;
  let worst = { durationMin: -1, dayType: null, seed: null };

  for (const dayType of PHASE_1_DAY_TYPES) {
    for (let seed = 1; seed <= 10000; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      if (s.durationMin > worst.durationMin) {
        worst = { durationMin: s.durationMin, dayType, seed };
      }
    }
  }

  assert.ok(worst.durationMin <= ceiling,
    `observed maximum ${worst.durationMin} min on ${worst.dayType}/seed ${worst.seed} ` +
    `exceeds the ${ceiling} min allowance (${TIME.GYM_SESSION_TOTAL_MIN} + ` +
    `${TIME.FLOOR_OVERRUN_ALLOWANCE_MIN} measured)`);
});

test('every session carries a prep block and a cool-down', () => {
  for (const s of sessions) {
    assert.ok(s.blocks.some(b => b.role === 'prep'),
      `${s.dayType}/${s.seed} has no prep`);
    assert.ok(s.blocks.some(b => b.role === 'mobility'),
      `${s.dayType}/${s.seed} has no cool-down`);
  }
});

test('mobility and core contribute nothing to pattern volume', () => {
  for (const s of sessions) {
    assert.equal(s.patternSets.mobility, undefined,
      'mobility work must not be counted as training volume');
    // The name says "and core", so check the core half too. Core blocks
    // carry pattern 'core' or 'rotate' and real sets, and a main-work
    // accessory slot may legitimately land on those same patterns -- so the
    // claim is arithmetic, not a lookup: patternSets must account for the
    // main work and for nothing else.
    const expected = {};
    for (const b of s.blocks.filter(isMain)) {
      if (!countsTowardVolume(b)) continue;
      expected[b.pattern] = (expected[b.pattern] || 0) + b.sets;
    }
    assert.deepEqual(s.patternSets, expected,
      `${s.dayType}/${s.seed}: prep, static or core leaked into pattern volume`);
  }
});

test('no movement is repeated inside a session', () => {
  for (const s of sessions) {
    const ids = s.blocks.map(b => b.exerciseId);
    assert.equal(new Set(ids).size, ids.length,
      `${s.dayType}/${s.seed} repeated a movement`);
  }
});

test('the same seed reproduces the same session', () => {
  const a = generate({ library: LIB, dayType: 'power', seed: 99, now: 1e12 });
  const b = generate({ library: LIB, dayType: 'power', seed: 99, now: 1e12 });
  assert.deepEqual(a.blocks.map(x => x.exerciseId), b.blocks.map(x => x.exerciseId));
});

test('prep leads SESSION_ORDER', () => {
  assert.equal(SESSION_ORDER[0], 'prep');
});

// --------------------------------------------------------------------------
// Task 9: adversarial sweep -- sore joints, venue, ban lists
// --------------------------------------------------------------------------

// Deviation 4 under load: a hurt joint bans every exercise touching it.
test('a hurt hip still yields a usable cool-down', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({
      library: LIB, dayType: 'hypertrophy', seed, now: 1e12,
      soreness: { hip: 'hurt' }
    });
    const statics = s.blocks.filter(b => b.role === 'mobility');
    // Measured, not guessed: a hurt hip bans 4 of the 7 static stretches and
    // every seed lands on exactly 3. So 3 is the real floor and >= 2 could not
    // fail. The brief's `if (statics.length < 3)` branch was unreachable for
    // this input -- the genuinely short cool-down is covered by the collapse
    // test below, which does reach the warning.
    assert.ok(statics.length >= 3,
      `seed ${seed}: a hurt hip left ${statics.length} stretches`);
    for (const b of s.blocks) {
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(!(e.joints || []).includes('hip'),
        `${b.name} loads a hurt hip`);
    }
  }
});

test('the outdoor day still gets a split block', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = generate({ library: LIB, dayType: 'aerobic-steady', seed, now: 1e12 });
    assert.ok(s.blocks.some(b => b.role === 'prep'));
    assert.ok(s.blocks.some(b => b.role === 'mobility'));
    for (const b of s.blocks) {
      const e = LIB.find(x => x.id === b.exerciseId);
      assert.ok(e.venue === 'either' || e.venue === 'outdoor',
        `${b.name} is gym-only on an outdoor day`);
    }
  }
});

test('the session never quietly loses its prep block to a ban list', () => {
  // Ban four dynamic drills and check the block still fills.
  const banned = LIB
    .filter(e => e.modalities.includes('mobility-dynamic'))
    .slice(0, 4).map(e => e.id);
  const s = generate({
    library: LIB, dayType: 'power', seed: 5, now: 1e12, profile: { banned }
  });
  assert.ok(s.blocks.filter(b => b.role === 'prep').length >= 3);
});

// Two hurt joints can collapse the static pool: hip appears in 4 of the 7
// static stretches, thoracic in 2 more. hip+thoracic leaves exactly one. That
// is thin, but the contract is that it is never SILENT -- a cool-down below
// the sourced floor of 3 must say so. This is the case that actually reaches
// the short-cool-down warning; the single hurt hip never does.
test('a collapsed static pool is announced, never silently shipped', () => {
  const COLLAPSING = [
    ['hip', 'thoracic'], ['hip', 'ankle'], ['hip', 'shoulder'], ['hip', 'scapula']
  ];
  for (const [a, b] of COLLAPSING) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = generate({
        library: LIB, dayType: 'hypertrophy', seed, now: 1e12,
        soreness: { [a]: 'hurt', [b]: 'hurt' }
      });
      const statics = s.blocks.filter(x => x.role === 'mobility');
      assert.ok(statics.length >= 1,
        `${a}+${b} seed ${seed}: cool-down vanished entirely`);
      if (statics.length < 3) {
        assert.ok(s.warnings.some(w => w.includes('static stretches')),
          `${a}+${b} seed ${seed}: ${statics.length} stretches shipped silently`);
      }
      // The ban must hold no matter how thin the pool gets.
      for (const blk of s.blocks) {
        const e = LIB.find(x => x.id === blk.exerciseId);
        const j = e.joints || [];
        assert.ok(!j.includes(a) && !j.includes(b),
          `${blk.name} loads a hurt joint (${a}/${b})`);
      }
    }
  }
});

// T10 finding: the shortfall warning compared the stretch count against a
// hardcoded 3, but aerobic-steady draws COOLDOWN_BLOCK.short, which asks for
// [2, 3]. Two stretches there is the block being SATISFIED, not a pool that
// came up short -- and 49% of aerobic-steady sessions were being warned about
// a shortfall that never happened.
test('a short cool-down that got what it asked for is not warned about', () => {
  const twoStretch = sessions.filter(s =>
    s.dayType === 'aerobic-steady' &&
    s.blocks.filter(b => b.role === 'mobility').length === 2
  );
  assert.ok(twoStretch.length > 0,
    'no aerobic-steady session drew 2 stretches -- the case is untested');
  for (const s of twoStretch) {
    assert.ok(!s.warnings.some(w => w.includes('static stretches')),
      `${s.dayType}/${s.seed}: warned about 2 stretches when the block asked for 2`);
  }
});
