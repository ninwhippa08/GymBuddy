// The per-block swap. design-equipment-and-swap.md §5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, swapBlock, makeRng } from '../js/generator.js';
import { RAMP_WEEKS } from '../js/rules.js';

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

// THE RAMP MUST SURVIVE A SWAP. basis §3 -- the ramp is not skippable, and a
// swap is not an exit from it.
//
// The hole these tests close, found 2026-09-05: `rampLimited` is set only
// inside the load-pricing path (generator.js), because that is the only place a
// percentage exists to cap. A swap that came back in `reps` mode therefore
// carried NO ramp cap and NO note. It was unreachable from this fixture until
// the library grew -- at 435 entries the week-1 swap of `bench-press` returned
// `incline-bench-press` (load mode, capped); at 458 the extra push-h entries
// changed which candidate won and it returned `weighted-dip`, dosed by reps and
// silently uncapped. The growth did not create the hole, it exposed it.
test('a swap during the ramp is capped and says so', () => {
  assert.equal(rampSession.rampWeek, 1, 'fixture should sit in week 1');
  const { block } = swapBlock(rampSession, rampTarget.slot, LIB, ctx, makeRng(3));
  assert.equal(block.mode, 'load',
    `ramp swap returned ${block.exerciseId} in ${block.mode} mode, which the ` +
    'ramp ceiling cannot reach');
  assert.ok(block.rampLimited, 'a week-1 load swap came back uncapped');
});

test('every ramp swap of a load block stays loadable, across seeds', () => {
  // Not one seed: the preference must hold however the ranking falls out.
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(rampSession, rampTarget.slot, LIB, ctx, makeRng(s));
    if (!block) continue;
    assert.ok(byId.get(block.exerciseId).loadable,
      `seed ${s} handed back ${block.exerciseId}, which has no load to cap`);
    assert.ok(block.rampLimited, `seed ${s}: ${block.exerciseId} came back uncapped`);
  }
});

test('the ramp preference does not leak outside the ramp', () => {
  // Off the ramp there is no ceiling to escape, so an unloaded alternative is a
  // legitimate answer and must stay reachable -- otherwise this fix quietly
  // narrows every swap in the app to the 36 barbell entries.
  // "Off the ramp" is the LAST ramp row, not an absent one: a profile with no
  // returnDate starts fully ramped at week 5, which is where this fixture sits.
  assert.equal(session.rampWeek, RAMP_WEEKS,
    'the plain fixture should be fully ramped');
  const seen = new Set();
  for (let s = 1; s <= 20; s++) {
    const { block } = swapBlock(session, target.slot, LIB, ctx, makeRng(s));
    if (block) seen.add(byId.get(block.exerciseId).loadable === true);
  }
  assert.ok(seen.has(false),
    'no unloaded movement was offered off-ramp; the ramp preference leaked');
});

test('a ramp swap with nothing loadable left still answers, and says why', () => {
  // The preference is a preference. Banning every loadable movement of the
  // pattern must not turn a swap into a refusal -- it falls back to the best
  // unloaded answer and flags it, in the manner of `tierRelaxed`.
  const pattern = byId.get(rampTarget.exerciseId).pattern;
  const banned = LIB.filter(e => e.pattern === pattern && e.loadable).map(e => e.id);
  const { block, reason } = swapBlock(rampSession, rampTarget.slot, LIB,
                                      { ...ctx, banned }, makeRng(3));
  assert.ok(block, `swap refused instead of falling back: ${reason}`);
  assert.equal(byId.get(block.exerciseId).loadable, false);
  assert.ok(block.rampUncapped,
    'an unloaded ramp swap must say the ceiling does not reach it');
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

// --------------------------------------------------------------------------
// Swapping your way out of the barbell. His workflow, 2026-08-30:
//
//   "in the first move of the day I see a hang clean. I would edit the move
//    and swap it for an alternative such as dumbell clean."
//
// It could not work. `swapBlock` held the slot's tier, and EVERY primary hinge
// in the library is a barbell movement -- measured: seven alternatives to a
// clean, all seven needing a bar. Tapping swap could never reach a dumbbell.
//
// Two pieces, and neither works without the other. Rejection memory means a
// repeat tap makes progress instead of reshuffling the same seven (spec §4.2
// promised this and it was never built). Exhausting the tier is then what
// widens it, using the same rule generate() already applies to an empty
// required slot -- so the pool opens up only once the honest answers are gone.
// --------------------------------------------------------------------------

// What app.js does after a successful swap: the movement leaving the card is
// remembered so the slot does not offer it again this session.
function recordRejection(session, slotId, exerciseId) {
  session.rejected = session.rejected || {};
  session.rejected[slotId] = [...(session.rejected[slotId] || []), exerciseId];
}

const powerDay = generate({ library: LIB, dayType: 'power', seed: 1,
  profile: { returnDate: '2026-06-01', banned: [], plyoLevel: 'beginner' },
  history: [], soreness: {}, excludeEquipment: [] });
const barSlot = powerDay.blocks.find(b => {
  const e = byId.get(b.exerciseId);
  return e && (e.equipment || []).includes('barbell') && b.mode === 'load';
});

test('repeated swaps on one slot never offer the same movement twice', () => {
  const s = JSON.parse(JSON.stringify(powerDay));
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const { block } = swapBlock(s, barSlot.slot, LIB,
      { venue: s.venue, soreness: {}, banned: [], excludeEquipment: [] }, makeRng(i * 61 + 7));
    if (!block) break;
    assert.ok(!seen.includes(block.exerciseId),
      `swap offered ${block.exerciseId} twice -- seen ${JSON.stringify(seen)}`);
    seen.push(block.exerciseId);
    const idx = s.blocks.findIndex(b => b.slot === barSlot.slot);
    recordRejection(s, barSlot.slot, s.blocks[idx].exerciseId);
    s.blocks[idx] = block;
  }
  assert.ok(seen.length >= 5, `only ${seen.length} distinct movements offered`);
});

test('swapping a barbell lift repeatedly reaches a movement needing no bar', () => {
  const BARS = ['barbell', 'trap-bar', 'safety-bar', 'landmine'];
  const s = JSON.parse(JSON.stringify(powerDay));
  const offered = [];
  let escaped = false;

  for (let i = 0; i < 15 && !escaped; i++) {
    const { block } = swapBlock(s, barSlot.slot, LIB,
      { venue: s.venue, soreness: {}, banned: [], excludeEquipment: [] }, makeRng(i * 61 + 7));
    if (!block) break;
    const eq = (byId.get(block.exerciseId) || {}).equipment || [];
    offered.push(block.exerciseId);
    if (!eq.some(q => BARS.includes(q))) escaped = true;
    const idx = s.blocks.findIndex(b => b.slot === barSlot.slot);
    recordRejection(s, barSlot.slot, s.blocks[idx].exerciseId);
    s.blocks[idx] = block;
  }
  assert.ok(escaped,
    `never escaped the barbell in 15 swaps: ${JSON.stringify(offered)}`);
});

test('a swap that had to widen tier says so on the block', () => {
  const s = JSON.parse(JSON.stringify(powerDay));
  let relaxedSeen = false;
  for (let i = 0; i < 15; i++) {
    const { block } = swapBlock(s, barSlot.slot, LIB,
      { venue: s.venue, soreness: {}, banned: [], excludeEquipment: [] }, makeRng(i * 61 + 7));
    if (!block) break;
    const e = byId.get(block.exerciseId);
    if (e.tier !== 'primary') {
      assert.ok(block.tierRelaxed,
        `${block.exerciseId} is ${e.tier}, not the slot's tier, but the block does not say so`);
      relaxedSeen = true;
      break;
    }
    const idx = s.blocks.findIndex(b => b.slot === barSlot.slot);
    recordRejection(s, barSlot.slot, s.blocks[idx].exerciseId);
    s.blocks[idx] = block;
  }
  assert.ok(relaxedSeen, 'the tier never widened, so the flag was never tested');
});
