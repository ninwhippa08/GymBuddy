// tests/load-groups.test.mjs
// Reps, weight and pairing by what the exercise is.
// docs/superpowers/specs/2026-09-16-rep-method-design.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repMax, loadGroupFor, isHeavyLower } from '../js/generator.js';
import { REP_TO_PCT, LOAD_GROUPS, VOLUME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = id => {
  const e = LIB.find(x => x.id === id);
  assert.ok(e, `${id} is not in the library`);
  return e;
};

test('repMax reads the chart on every row it has', () => {
  for (const [n, pct] of Object.entries(REP_TO_PCT)) {
    assert.equal(repMax(Number(n)), pct, `row ${n}`);
  }
});

test('repMax interpolates the row the chart skips', () => {
  assert.ok(Math.abs(repMax(11) - 0.725) < 1e-9, `got ${repMax(11)}`);
});

test('repMax falls as reps rise, all the way past the chart', () => {
  for (let n = 2; n <= 20; n++) {
    assert.ok(repMax(n) < repMax(n - 1), `repMax(${n}) ${repMax(n)} >= repMax(${n - 1})`);
  }
});

test('the groups carry the doses the athlete approved', () => {
  assert.deepEqual([...LOAD_GROUPS.heavy.reps], [6, 8]);
  assert.deepEqual([...LOAD_GROUPS.heavy.rir], [2, 3]);
  assert.deepEqual([...LOAD_GROUPS.compound.reps], [8, 12]);
  assert.deepEqual([...LOAD_GROUPS.compound.rir], [2, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.reps], [10, 15]);
  assert.deepEqual([...LOAD_GROUPS.light.rir], [1, 2]);
  assert.deepEqual([...LOAD_GROUPS.light.restSec], [60, 90]);
  assert.deepEqual([...LOAD_GROUPS.heavy.restSec], [120, 180]);
  assert.deepEqual([...LOAD_GROUPS.compound.restSec], [120, 180]);
  assert.equal(VOLUME.SETS_PER_PATTERN_PER_SESSION, 10);
});

test('group membership on the spec\'s named samples', () => {
  const want = {
    'single-arm-lat-pulldown': 'light', 'tall-kneeling-cable-chop': 'light',
    'leg-press': 'light', 'dumbbell-bench-press': 'compound',
    'romanian-deadlift': 'compound', 'weighted-pull-up': 'compound',
    'pause-squat': 'heavy', deadlift: 'heavy', 'bench-press': 'heavy'
  };
  for (const [id, group] of Object.entries(want)) {
    assert.equal(loadGroupFor(byId(id)), group, id);
  }
});

test('an isolation slot doses whatever it draws as light', () => {
  assert.equal(loadGroupFor(byId('ab-wheel-rollout'), { modality: 'isolation' }), 'light');
  assert.equal(loadGroupFor(byId('ab-wheel-rollout')), 'compound');
});

test('heavy lower means a heavy squat or hinge, nothing else', () => {
  assert.equal(isHeavyLower(byId('deadlift')), true);
  assert.equal(isHeavyLower(byId('pause-squat')), true);
  assert.equal(isHeavyLower(byId('bench-press')), false, 'heavy, but not lower');
  assert.equal(isHeavyLower(byId('romanian-deadlift')), false, 'lower, but compound');
});

import { generate, prescribe } from '../js/generator.js';
import { TEMPLATES } from '../js/templates.js';
import { ZONES } from '../js/rules.js';

const DAY = 86400e3;
const NOW = 1e12;
const TRAINED = { returnDate: new Date(NOW - 400 * DAY).toISOString().slice(0, 10) };
const COOL = ['prep', 'mobility', 'core'];
const sweep = (dayType, n = 400) => Array.from({ length: n }, (_, i) =>
  generate({ library: LIB, profile: TRAINED, history: [], now: NOW, seed: i + 1, dayType }));
const mainOf = s => s.blocks.filter(b => !COOL.includes(b.role));
const slotOf = (dayType, b) => TEMPLATES[dayType].find(s => s.slot === b.slot);
const RIR_ZONE_KEYS = ['maxStrength', 'hypertrophy', 'muscularEndurance'];
// Loads print to the hundredth, so a load may round up by at most 0.005.
const PRINT = 0.005;

const SESSIONS = {
  'max-strength': sweep('max-strength'),
  hypertrophy: sweep('hypertrophy'),
  power: sweep('power')
};

test('no working set is heavier than its reps allow (defect A)', () => {
  let checked = 0;
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || b.mode !== 'load' || !RIR_ZONE_KEYS.includes(slot.zone)) continue;
        assert.ok(Array.isArray(b.rir), `${dayType} ${b.name} carries no rir`);
        const sets = b.setPlan ? b.setPlan.filter(x => x.kind === 'work') : [b];
        for (const w of sets) {
          checked++;
          const limit = repMax(w.reps + b.rir[0]);
          assert.ok(w.pct <= limit + PRINT,
            `${dayType} ${b.name}: ${w.reps} reps at ${w.pct} > ${limit.toFixed(3)} (rir ${b.rir[0]})`);
        }
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} working sets checked -- the sweep is not reaching load blocks`);
});

test('hypertrophy-zone blocks take reps and rest from their group', () => {
  let checked = 0;
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || slot.zone !== 'hypertrophy' || !['load', 'reps'].includes(b.mode)) continue;
        const g = LOAD_GROUPS[loadGroupFor(LIB.find(e => e.id === b.exerciseId), slot)];
        checked++;
        assert.ok(b.reps >= g.reps[0] && b.reps <= g.reps[1],
          `${dayType} ${b.name}: ${b.reps} reps outside ${g.reps}`);
        if (!b.group) {   // a superset's card rest is its round rest
          assert.ok(b.restSec >= g.restSec[0] && b.restSec <= g.restSec[1],
            `${dayType} ${b.name}: rest ${b.restSec} outside ${g.restSec}`);
        }
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} blocks checked`);
});

test('maxStrength and muscularEndurance slots keep their own reps', () => {
  for (const [dayType, sessions] of Object.entries(SESSIONS)) {
    for (const s of sessions) {
      for (const b of mainOf(s)) {
        const slot = slotOf(dayType, b);
        if (!slot || !['maxStrength', 'muscularEndurance'].includes(slot.zone)) continue;
        if (b.architecture === 'ladder') continue;   // rungs change reps by design
        assert.ok(b.reps >= slot.reps[0] && b.reps <= slot.reps[1] + 1,
          `${dayType} ${slot.slot} ${b.name}: ${b.reps} outside slot ${slot.reps}`);
      }
    }
  }
});

test('the pause squat that started this is no longer an 11-rep near-failure set', () => {
  const pause = LIB.find(e => e.id === 'pause-squat');
  const slot = TEMPLATES.hypertrophy.find(s => s.slot === 'B');
  for (let seed = 1; seed <= 200; seed++) {
    let x = seed;
    const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
    const b = prescribe(slot, pause, { pctCeiling: 1, volumeMultiplier: 1 }, rng, {});
    assert.ok(b.reps >= 6 && b.reps <= 8, `pause squat at ${b.reps} reps`);
    assert.ok(b.pct <= repMax(b.reps + 2) + PRINT, `pause squat ${b.reps} @ ${b.pct}`);
    assert.match(b.effort, /reps in reserve/);
  }
});
