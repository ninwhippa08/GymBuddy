import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../js/generator.js';
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
// script: a fixed sweep of 1000 seeds per Phase-1 day type, full ramp volume
// (no returnDate -- see rampWeekFor), so it probes the worst case rather than
// an arbitrary point in the ramp.
test('duration sweep (1000 seeds x day type): observed maximum stays within the measured allowance', () => {
  const ceiling = TIME.GYM_SESSION_TOTAL_MIN + TIME.FLOOR_OVERRUN_ALLOWANCE_MIN;
  let worst = { durationMin: -1, dayType: null, seed: null };

  for (const dayType of PHASE_1_DAY_TYPES) {
    for (let seed = 1; seed <= 1000; seed++) {
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
