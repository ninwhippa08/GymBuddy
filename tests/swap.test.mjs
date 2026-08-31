// The per-block swap. design-equipment-and-swap.md §5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, swapBlock, makeRng } from '../js/generator.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;
const byId = new Map(LIB.map(e => [e.id, e]));

const session = generate({ library: LIB, dayType: 'hypertrophy', seed: 5,
                           profile: { venue: 'gym' } });
const ctx = { venue: 'gym', soreness: {}, banned: [], excludeEquipment: [] };
const target = session.blocks.find(b => b.mode === 'load');

test('a swap holds the pattern of the block it replaces', () => {
  // The athlete's expectation: "another move like one with dumbbell that hits
  // the same area." Six slots carry patterns: null and slot C alone spans ten
  // patterns, so same-slot is not enough. design §5.1.
  for (const t of session.blocks.filter(b => b.slot && b.mode === 'load')) {
    const { block } = swapBlock(session, t.slot, LIB, ctx, makeRng(1));
    if (!block) continue;
    assert.equal(byId.get(block.exerciseId).pattern,
                 byId.get(t.exerciseId).pattern,
                 `${t.exerciseId} -> ${block.exerciseId} changed pattern`);
  }
});

test('a swap never returns the exercise it replaced', () => {
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(session, target.slot, LIB, ctx, makeRng(s));
    if (block) assert.notEqual(block.exerciseId, target.exerciseId);
  }
});

test('a swap never returns something already in the session', () => {
  const present = new Set(session.blocks.map(b => b.exerciseId));
  present.delete(target.exerciseId);
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(session, target.slot, LIB, ctx, makeRng(s));
    if (block) assert.ok(!present.has(block.exerciseId));
  }
});

test('a swap reprices against the new exercise', () => {
  // displayMultiplier folds the new entry's own prCoef, so a replacement with
  // a different coefficient must not inherit the old number. This is why a
  // swap runs through prescribe rather than relabelling the card. design §5.2.
  const loaded = session.blocks.find(b => b.mode === 'load' && b.displayMultiplier);
  if (!loaded) return;
  const { block } = swapBlock(session, loaded.slot, LIB, ctx, makeRng(2));
  if (!block || !block.displayMultiplier) return;
  const a = byId.get(loaded.exerciseId), b = byId.get(block.exerciseId);
  if (a.prCoef !== b.prCoef && a.prRef === b.prRef) {
    assert.notEqual(block.displayMultiplier, loaded.displayMultiplier);
  }
});

test('an exhausted pool reports rather than throws', () => {
  // Ban everything sharing the target's pattern: the swap must come back
  // empty-handed with a sentence, not an exception. design §5.3.
  const pattern = byId.get(target.exerciseId).pattern;
  const banned = LIB.filter(e => e.pattern === pattern).map(e => e.id);
  const { block, reason } = swapBlock(session, target.slot, LIB,
                                      { ...ctx, banned }, makeRng(1));
  assert.equal(block, null);
  assert.ok(typeof reason === 'string' && reason.length > 0);
});

// --------------------------------------------------------------------------
// The ramp. basis §3 -- it is not skippable, and a swap is not an exit from it.
// --------------------------------------------------------------------------

const RAMP_PROFILE = {
  venue: 'gym',
  returnDate: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)
};
const rampSession = generate({ library: LIB, dayType: 'hypertrophy', seed: 5,
                               profile: RAMP_PROFILE });
const rampTarget = rampSession.blocks.find(b => b.slot && b.mode === 'load');

test('a swap is priced by the session it joins, not by the caller ctx', () => {
  // swapBlock used to rebuild the envelope from ctx.profile/ctx.history and
  // fall back to {} and [] when they were absent -- which is exactly the ctx
  // shape the tests above use. That put the swap outside the return ramp: a
  // heavier load than every other block on the card, and no "held down by the
  // return ramp" note to say so.
  const full = { ...ctx, profile: RAMP_PROFILE, history: [] };
  const bare = swapBlock(rampSession, rampTarget.slot, LIB, ctx, makeRng(3));
  const rich = swapBlock(rampSession, rampTarget.slot, LIB, full, makeRng(3));
  assert.equal(bare.block.exerciseId, rich.block.exerciseId);
  assert.equal(bare.block.displayMultiplier, rich.block.displayMultiplier,
    'the same swap priced two ways depending on what the caller passed');
  assert.equal(bare.block.rampLimited, rich.block.rampLimited);
});

test('a swap during the ramp is capped and says so', () => {
  assert.equal(rampSession.rampWeek, 1, 'fixture should sit in week 1');
  const { block } = swapBlock(rampSession, rampTarget.slot, LIB, ctx, makeRng(3));
  assert.ok(block.rampLimited, 'a week-1 swap came back uncapped');
});

// --------------------------------------------------------------------------
// A swap must honour the equipment constraint. Found in the gym 2026-08-30:
// the athlete unticked the barbell, hit swap, and was handed another bar
// movement. The filter was right; the data called a trap bar something other
// than a barbell. rules.js EQUIPMENT_IMPLIES.
// --------------------------------------------------------------------------

test('a swap under a no-barbell constraint never returns a bar movement', () => {
  const BARS = ['barbell', 'trap-bar', 'safety-bar', 'landmine'];
  const profile = { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' };
  let swaps = 0;

  for (const dayType of ['max-strength', 'hypertrophy', 'power']) {
    for (let seed = 1; seed <= 30; seed++) {
      const s = generate({ library: LIB, profile, history: [], soreness: {},
                           dayType, excludeEquipment: ['barbell'], seed });
      for (const b of s.blocks) {
        const { block } = swapBlock(s, b.slot, LIB,
          { venue: s.venue, soreness: {}, banned: [], excludeEquipment: ['barbell'],
            profile, history: [] },
          makeRng(seed * 31));
        if (!block) continue;
        swaps++;
        const eq = (byId.get(block.exerciseId) || {}).equipment || [];
        assert.ok(!eq.some(q => BARS.includes(q)),
          `${dayType} seed ${seed} ${b.slot}: swap returned ${block.exerciseId} ${JSON.stringify(eq)}`);
      }
    }
  }
  assert.ok(swaps > 100, `only ${swaps} swaps exercised -- the sweep proved little`);
});
