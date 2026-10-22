// The working sets, pinned. docs/superpowers/specs/2026-10-22-warmup-and-staircase-card-design.md.
//
// The warm-up ladder is about to lose rungs. Warm-up sets are priced into the
// session's time budget, so fewer of them frees time, and freed time can let
// the packer keep a working set it used to drop. That would change the work
// the athlete does -- the one thing this change must not touch. So the working
// output of v78 is pinned here and asserted unchanged afterward.
//
// Captured from the tree at eaf4f92, whose behaviour is v78's (only docs have
// changed since 5758824). Do NOT regenerate it from a tree carrying the
// warm-up change: that would assert the new code against itself. See
// tests/fixtures/README.md.
//
// workPrint is what counts as "working output": slot, exercise, sets, reps,
// the load multiplier, the architecture, and each working set of the plan.
// Warm-up entries are deliberately excluded -- they are what changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { generate, swapBlock, makeRng } from '../js/generator.js';
import { PHASE_1_DAY_TYPES } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const NOW = 1e12;
const DAY = 86400e3;
// Mid-week, so a rounding error in rampWeekFor cannot land this on a boundary.
const atWeek = w => ({ returnDate: new Date(NOW - ((w - 1) * 7 + 3) * DAY).toISOString().slice(0, 10) });

const FIXTURE = new URL('./fixtures/work-v78.json', import.meta.url);
const WEEKS = [1, 2, 3, 4, 5];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

const workPrint = b => [
  b.slot, b.exerciseId, b.sets, b.reps,
  b.displayMultiplier ?? null, b.architecture ?? null,
  (b.setPlan || []).filter(s => s.kind === 'work').map(s => [s.reps, s.displayMultiplier])
];

const session = (dayType, week, seed) =>
  generate({ library: LIB, profile: atWeek(week), history: [], soreness: {},
             dayType, seed, now: NOW });

function capture() {
  const out = {};
  for (const dayType of PHASE_1_DAY_TYPES) {
    out[dayType] = {};
    for (const week of WEEKS) {
      out[dayType][week] = {};
      for (const seed of SEEDS) out[dayType][week][seed] = session(dayType, week, seed).blocks.map(workPrint);
    }
  }
  writeFileSync(FIXTURE, JSON.stringify(out) + '\n');
}

test('working sets are what v78 built, every day type and ramp week', () => {
  if (process.env.CAPTURE_WORK === '1') { capture(); return; }
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  for (const dayType of PHASE_1_DAY_TYPES) {
    for (const week of WEEKS) {
      for (const seed of SEEDS) {
        assert.deepEqual(session(dayType, week, seed).blocks.map(workPrint),
          fixture[dayType][week][seed], `${dayType} week ${week} seed ${seed}`);
      }
    }
  }
});

// A swap runs the replacement through prescribe() and drops it into a session
// the packer has already priced. If the swapped block came back with a
// setPlan but no budgetWarmupReps, any later held pricing of that session
// would charge it the new two rungs and the hold would leak through the swap.
// Call shape is tests/swap.test.mjs's.
test('a swap is priced the same as before', () => {
  const ctx = { venue: 'gym', soreness: {}, banned: [], excludeEquipment: [] };
  let checked = 0;
  for (const dayType of ['power', 'max-strength']) {
    for (const week of [1, 5]) {
      for (const seed of SEEDS) {
        const s = session(dayType, week, seed);
        const { block } = swapBlock(s, 'A', LIB, ctx, makeRng(seed));
        // Slot A is not a loaded slot on every day and seed; those cases have
        // nothing to hold, so they are skipped rather than failed.
        if (!block || !block.setPlan) continue;
        checked++;
        assert.ok(Array.isArray(block.budgetWarmupReps) && block.budgetWarmupReps.length > 0,
          `${dayType} week ${week} seed ${seed}: swapped ${block.exerciseId} has a setPlan ` +
          `but no budgetWarmupReps`);
      }
    }
  }
  assert.ok(checked > 0, 'no swap produced a setPlan, so nothing was checked');
});
