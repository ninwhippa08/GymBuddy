// The architecture pass. design-architectures.md.
//
// chooseArchitecture returned 'straight' unconditionally for the whole life of
// the project, so this file is the first thing that has ever asserted the
// variety engine does anything at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prescribe, applyArchitecture, generate, estimateMinutes } from '../js/generator.js';
import { ZONES } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const SQUAT = LIB.find(e => e.id === 'back-squat');
const ENV = { pctCeiling: 1, volumeMultiplier: 1 };
const rng = () => 0.5;
const ZONE_BY_SLOT = { A: 'maxStrength' };

// Six sets, so the ladder splits 3 + 3. reps [4,4] keeps the draw predictable.
const SIX = { slot: 'A', role: 'main', mode: 'load', zone: 'maxStrength',
              sets: [6, 6], reps: [4, 4], restSec: [180, 180] };

const ladderOf = (slot = SIX) => {
  const block = prescribe(slot, SQUAT, ENV, rng, {});
  return applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
};
const work = b => b.setPlan.filter(s => s.kind === 'work');

test('a ladder descends in reps and ascends in load within each wave', () => {
  const w = work(ladderOf());
  assert.equal(w.length, 6, 'six sets in, six sets out');
  const wave1 = w.slice(0, 3), wave2 = w.slice(3);
  for (const wave of [wave1, wave2]) {
    for (let i = 1; i < wave.length; i++) {
      assert.ok(wave[i].reps < wave[i - 1].reps,
        `reps must fall across a wave, got ${wave.map(s => s.reps)}`);
      assert.ok(wave[i].pct > wave[i - 1].pct,
        `load must rise across a wave, got ${wave.map(s => s.pct)}`);
    }
  }
});

test('the second wave is heavier than the first, rung for rung', () => {
  const w = work(ladderOf());
  for (let i = 0; i < 3; i++) {
    assert.ok(w[i + 3].pct > w[i].pct,
      `wave 2 rung ${i} (${w[i + 3].pct}) must sit above wave 1's (${w[i].pct})`);
  }
});

test('the ladder is CENTRED on the load the straight session would have used', () => {
  // Not anchored to it as the top rung -- see the comment in ladderise. The
  // mean rung equalling the straight load is what keeps a ladder a change of
  // arrangement rather than a change of intensity, which is the scope agreed.
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const straightPct = block.pct;
  const w = work(applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0]);
  const mean = w.reduce((a, s) => a + s.pct, 0) / w.length;
  assert.ok(Math.abs(mean - straightPct) < 0.005,
    `ladder mean ${mean.toFixed(3)} should sit on the straight load ${straightPct}`);
});

test('the ladder starts lighter than the straight session -- Wood et al. 2016', () => {
  // Starting lighter yields the same gains at lower exertion, so a ladder
  // whose FIRST set matched the straight load would have missed the finding.
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const straightPct = block.pct;
  const w = work(applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0]);
  assert.ok(w[0].pct < straightPct,
    `first rung ${w[0].pct} must sit below the straight load ${straightPct}`);
});

test('a load too near the band edge stays straight, and never descends', () => {
  // THE BUG THIS PINS: the first implementation made the drawn load the TOP
  // rung, so when PCT_JITTER put it below the zone floor (0.83 against 0.85)
  // the step came out negative and the "ladder" ran DOWNHILL -- 0.85, 0.84,
  // 0.83. One rng fixture of 0.5 hid it completely.
  for (const draw of [0, 0.05, 0.3, 0.7, 0.95, 1]) {
    const block = prescribe(SIX, SQUAT, ENV, () => draw, {});
    const out = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
    const w = out.setPlan.filter(s => s.kind === 'work');
    if (out.architecture === 'ladder') {
      for (let i = 1; i < 3; i++) {
        assert.ok(w[i].pct > w[i - 1].pct,
          `draw ${draw} produced a descending ladder: ${w.map(s => s.pct)}`);
      }
    } else {
      assert.equal(out.architecture, 'straight');
      for (const s of w) assert.equal(s.pct, block.pct, 'straight means identical sets');
    }
  }
});

test('every rung stays inside the zone band', () => {
  const [lo, hi] = ZONES.maxStrength.pct;
  for (const s of work(ladderOf())) {
    assert.ok(s.pct >= lo - 1e-9 && s.pct <= hi + 1e-9,
      `rung at ${s.pct} escaped the ${lo}-${hi} band`);
  }
});

test('reps never fall below the zone minimum', () => {
  const [repLo] = ZONES.maxStrength.reps;
  for (const s of work(ladderOf())) {
    assert.ok(s.reps >= repLo, `rung of ${s.reps} reps is under the zone floor ${repLo}`);
  }
});

test('an odd set count puts the extra set in the lighter wave', () => {
  const five = { ...SIX, sets: [5, 5] };
  const w = work(ladderOf(five));
  assert.equal(w.length, 5);
  // 3 + 2: the first wave is the longer one, so the extra set is the light one.
  assert.ok(w[2].reps < w[1].reps, 'wave 1 should run three rungs');
  assert.ok(w[3].reps > w[2].reps, 'wave 2 should restart the rep count');
});

test('fewer than four sets stays straight -- a 2+1 split is not a wave', () => {
  const three = { ...SIX, sets: [3, 3] };
  const block = prescribe(three, SQUAT, ENV, rng, {});
  const out = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
  const w = out.setPlan.filter(s => s.kind === 'work');
  assert.equal(w.length, 3);
  for (const s of w) {
    assert.equal(s.reps, block.reps, 'a straight block keeps identical work sets');
    assert.equal(s.pct, block.pct);
  }
  assert.equal(out.architecture, 'straight',
    'a block that could not take the ladder must say so, not claim one');
});

test('the ladder never changes total volume', () => {
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const out = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
  assert.equal(out.sets, block.sets, 'sets drive patternSets and the CNS account');
});

test('straight leaves every block untouched', () => {
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const out = applyArchitecture([block], 'straight', ZONE_BY_SLOT)[0];
  assert.deepEqual(out, block);
});

test('warm-up rungs are never restructured', () => {
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const before = block.setPlan.filter(s => s.kind === 'warmup');
  const after = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0]
    .setPlan.filter(s => s.kind === 'warmup');
  assert.deepEqual(after, before, 'the ramp is sourced work, not the ladder’s to move');
});

// --------------------------------------------------------------------------
// Wiring. The pass is inert unless chooseArchitecture can pick a ladder and
// generate actually runs the transform.
// --------------------------------------------------------------------------

test('generated max-strength sessions sometimes ladder', () => {
  let ladders = 0, sessions = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const s = generate({ library: LIB, profile: {}, history: [], soreness: {},
                         dayType: 'max-strength', seed, now: 1e12 });
    sessions++;
    if ((s.blocks || []).some(b => b.architecture === 'ladder')) ladders++;
  }
  assert.ok(ladders > 0,
    `no ladder in ${sessions} max-strength sessions -- the variety engine is still inert`);
});

test('no other day type ladders', () => {
  // ARCHITECTURES gates this. A ladder on a conditioning day would mean the
  // gate is not being consulted.
  for (const dayType of ['hypertrophy', 'power', 'aerobic-steady', 'interval']) {
    for (let seed = 1; seed <= 60; seed++) {
      const s = generate({ library: LIB, profile: {}, history: [], soreness: {},
                           dayType, seed, now: 1e12 });
      assert.ok(!(s.blocks || []).some(b => b.architecture === 'ladder'),
        `${dayType} seed ${seed} produced a ladder`);
    }
  }
});

test('a ladder is priced from its own reps, not sets x reps', () => {
  // 4-3-2 / 4-3-2 is 18 reps; block.reps would price six sets of four as 24.
  // The time budget is the one place this error would be invisible.
  const block = prescribe(SIX, SQUAT, ENV, rng, {});
  const laddered = applyArchitecture([block], 'ladder', ZONE_BY_SLOT)[0];
  assert.equal(laddered.architecture, 'ladder', 'fixture must actually ladder');
  const straightReps = block.sets * block.reps;
  const ladderReps = laddered.setPlan
    .filter(s => s.kind === 'work').reduce((a, s) => a + s.reps, 0);
  assert.ok(ladderReps < straightReps, 'fixture should have fewer total reps');
  // estimateMinutes rounds to whole minutes and the gap here is 6 reps -- 18
  // seconds -- so a single block hides it. Four blocks put it over the minute.
  const four = n => Array.from({ length: 4 }, () => n);
  assert.ok(estimateMinutes(four(laddered)) < estimateMinutes(four(block)),
    'a ladder with fewer total reps must be priced below the straight version');
});
