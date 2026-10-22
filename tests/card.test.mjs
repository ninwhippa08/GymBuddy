// The card's two faces. design-card-flip.md §5, §7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

installDom();
const { blockCard, warmupLine, workLine } = await import('../js/ui.js');

const BLOCK = {
  slot: 'A', role: 'primary', exerciseId: 'back-squat', name: 'Back Squat',
  mode: 'load', sets: 3, reps: 5, displayMultiplier: 0.72, prRef: 'back-squat',
  restSec: 180
};
const CUES = [
  'Bar on the upper back, feet shoulder-width, toes slightly out.',
  'Brace hard, then sit down between the hips.',
  'Knees track over the toes; hip crease passes the knee.'
];

test('a card without cues stays exactly as it was -- no button, no back', () => {
  const li = blockCard(BLOCK, () => null);
  assert.equal(li.tagName, 'LI');
  assert.equal(li.className, 'block');
  assert.equal(li.querySelector('button'), null);
  assert.equal(li.querySelector('.is-back'), null);
  assert.equal(li.querySelector('.block-name').textContent, 'Back Squat');
});

test('a card with cues renders a button wrapping two faces', () => {
  const li = blockCard(BLOCK, () => CUES);
  const btn = li.querySelector('button.block-flip');
  assert.ok(btn, 'no flip button');
  assert.equal(btn.getAttribute('type'), 'button');
  assert.ok(li.querySelector('.is-front'), 'no front face');
  assert.ok(li.querySelector('.is-back'), 'no back face');
});

test('the back carries every cue as its own line', () => {
  const li = blockCard(BLOCK, () => CUES);
  const lines = li.querySelector('.is-back').querySelectorAll('.cue');
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map(n => n.textContent), CUES);
});

test('the back names the movement, so a flipped card is still identifiable', () => {
  const li = blockCard(BLOCK, () => CUES);
  assert.equal(
    li.querySelector('.is-back').querySelector('.block-name').textContent,
    'Back Squat'
  );
});

test('cues are looked up by exercise id, not read off the block', () => {
  let askedFor = null;
  blockCard(BLOCK, id => { askedFor = id; return CUES; });
  assert.equal(askedFor, 'back-squat');
});

test('a missing cuesFor is survivable -- the card just does not flip', () => {
  const li = blockCard(BLOCK, undefined);
  assert.equal(li.querySelector('button'), null);
});

// design-card-flip.md §6. backface-visibility is a paint-time trick: it hides a
// face from the eye and leaves it in the accessibility tree and the tab order.
// If aria-hidden does not move with the flip, a screen reader reads both faces.
test('flipping toggles the class and every aria attribute with it', () => {
  const li = blockCard(BLOCK, () => CUES);
  const btn = li.querySelector('button.block-flip');
  const front = li.querySelector('.is-front');
  const back = li.querySelector('.is-back');

  assert.equal(btn.classList.contains('is-flipped'), false);
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  assert.equal(back.getAttribute('aria-hidden'), 'true');
  assert.match(btn.getAttribute('aria-label'), /show cues/);

  btn.dispatch('click');

  assert.equal(btn.classList.contains('is-flipped'), true);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.equal(front.getAttribute('aria-hidden'), 'true');
  assert.equal(back.getAttribute('aria-hidden'), 'false');
  assert.match(btn.getAttribute('aria-label'), /hide cues/);
});

test('flipping back restores every attribute', () => {
  const li = blockCard(BLOCK, () => CUES);
  const btn = li.querySelector('button.block-flip');
  const front = li.querySelector('.is-front');
  const back = li.querySelector('.is-back');

  btn.dispatch('click');
  btn.dispatch('click');

  assert.equal(btn.classList.contains('is-flipped'), false);
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  assert.equal(front.getAttribute('aria-hidden'), 'false');
  assert.equal(back.getAttribute('aria-hidden'), 'true');
  assert.match(btn.getAttribute('aria-label'), /show cues/);
});

test('each card flips independently', () => {
  const a = blockCard(BLOCK, () => CUES);
  const b = blockCard(
    { ...BLOCK, exerciseId: 'front-squat', name: 'Front Squat' }, () => CUES
  );
  a.querySelector('button.block-flip').dispatch('click');
  assert.equal(a.querySelector('button.block-flip').classList.contains('is-flipped'), true);
  assert.equal(b.querySelector('button.block-flip').classList.contains('is-flipped'), false);
});

// --------------------------------------------------------------------------
// Height. design-card-flip.md 5.1
//
// The shim cannot measure a box, so these check the RULE -- the card takes the
// height of the face turned towards you -- against heights a test supplies.
// The numbers below are the ones a real Chrome measured at 375px: a primary
// lift's front is 126px and its four-cue back is 251px.
// --------------------------------------------------------------------------

test('an unflipped card is sized to its front, a flipped one to its back', () => {
  const li = blockCard(BLOCK, () => CUES);
  const btn = li.querySelector('button.block-flip');
  li.querySelector('.is-front').offsetHeight = 126;
  li.querySelector('.is-back').offsetHeight = 251;

  btn.dispatch('click');
  assert.equal(btn.style.height, '251px');

  btn.dispatch('click');
  assert.equal(btn.style.height, '126px');
});

test('a card that has not been laid out yet is left alone, not pinned to zero', () => {
  // Both faces measure 0 -- detached, or the first frame. Writing "0px" here
  // would collapse the card and then animate it open on load.
  const li = blockCard(BLOCK, () => CUES);
  const btn = li.querySelector('button.block-flip');
  btn.dispatch('click');
  assert.equal(btn.style.height, undefined);
});

test('a card renders where ResizeObserver does not exist', () => {
  // Node has none, so every other test in this file already proves it. This
  // one says so out loud, because the guard around it is easy to delete.
  assert.equal(typeof globalThis.ResizeObserver, 'undefined');
  assert.ok(blockCard(BLOCK, () => CUES).querySelector('button.block-flip'));
});

const INTERVAL_BLOCK = {
  slot: 'A', role: 'intervals', exerciseId: 'run-interval',
  name: 'Running Intervals', mode: 'interval',
  sets: 6, reps: 1, workSec: 90, restSec: 175,
  effort: 'hard -- talking is down to a word or two'
};

test('an interval card says what to do during the recovery', () => {
  const meta = blockCard(INTERVAL_BLOCK, () => null)
    .querySelector('.block-meta').textContent;
  assert.ok(meta.includes('walk or jog the recovery'),
    `recovery instruction missing from "${meta}"`);
  assert.ok(!meta.includes('rest 2:55'),
    'the recovery is already in the hero line -- printing it twice is noise');
});

const RELAXED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'chin-up', name: 'Chin-Up',
  mode: 'reps', sets: 4, reps: 5, restSec: 180, tierRelaxed: true,
  effort: 'leave 2-3 reps in reserve'
};

test('a substituted movement says so on the front of the card', () => {
  const notes = blockCard(RELAXED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(notes.some(t => t.includes('closest movement available')),
    `no substitution note, got ${JSON.stringify(notes)}`);
});

test('an ordinary block carries no substitution note', () => {
  const notes = blockCard(BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(!notes.some(t => t.includes('closest movement available')));
});

// The two ramp-swap notes, added 2026-09-05. A swap during the return ramp
// used to be able to leave the ramp silently -- only `loadable` movements
// reach the ceiling, so a reps-mode replacement was uncapped and the card said
// nothing. Both notes exist so the card cannot go quiet about it again.

const RAMP_WIDENED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'close-grip-bench-press',
  name: 'Close-Grip Bench Press', mode: 'load', sets: 4, reps: 5, restSec: 180,
  pct: 0.65, prRef: 'bench-press', prCoef: 0.93, displayMultiplier: 0.6,
  rampLimited: true, rampTierWidened: true
};

const RAMP_UNCAPPED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'weighted-dip', name: 'Weighted Dip',
  mode: 'reps', sets: 4, reps: 5, restSec: 180, rampUncapped: true,
  effort: 'leave 2-3 reps in reserve'
};

test('a ramp swap that widened tier says why, without blaming equipment', () => {
  const notes = blockCard(RAMP_WIDENED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  const note = notes.find(t => t.includes('return ramp can still cap it'));
  assert.ok(note, `no widening note, got ${JSON.stringify(notes)}`);
  // Nothing is missing from the gym here, so the equipment sentence would be a
  // false statement sitting right next to a true one.
  assert.ok(!notes.some(t => t.includes('closest movement available')),
    'the ramp widening was reported as missing equipment');
});

test('an uncapped ramp swap warns that the ceiling does not reach it', () => {
  const notes = blockCard(RAMP_UNCAPPED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(notes.some(t => t.includes('does not reach this one')),
    `no uncapped-swap warning, got ${JSON.stringify(notes)}`);
});

test('an ordinary block carries neither ramp-swap note', () => {
  const notes = blockCard(BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(!notes.some(t => t.includes('return ramp can still cap it')));
  assert.ok(!notes.some(t => t.includes('does not reach this one')));
});

// tierRelaxed fires for whatever equipment is absent -- a machine, a
// kettlebell, a rack. The note must not name a specific item it cannot know
// was the one missing.
test('the substitution note does not name equipment it cannot know about', () => {
  const notes = blockCard(RELAXED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  const note = notes.find(t => t.includes('closest movement available'));
  assert.ok(note, 'no note to check');
  assert.ok(!/barbell|kettlebell|dumbbell|machine|rack/i.test(note),
    `the note claims a specific item was missing: ${JSON.stringify(note)}`);
});

// --------------------------------------------------------------------------
// The per-block swap control. design-equipment-and-swap.md §5, §7.
// --------------------------------------------------------------------------

test('a swap control appears only when a handler is supplied', () => {
  assert.equal(blockCard(BLOCK, () => CUES).querySelector('.block-swap'), null);
  assert.ok(blockCard(BLOCK, () => CUES, () => {}).querySelector('.block-swap'));
});

test('the swap names its slot to the caller', () => {
  let seen = null;
  blockCard(BLOCK, () => CUES, slot => { seen = slot; })
    .querySelector('.block-swap').dispatch('click');
  assert.equal(seen, BLOCK.slot);
});

// The plan put this button on the front face -- which lives INSIDE
// button.block-flip. A button inside a button is not valid HTML: the parser
// closes the outer one, and the card comes apart in a real browser. The shim
// builds nodes rather than parsing markup, so nothing else here would catch it.
test('the swap control is not nested inside the flip button', () => {
  const flip = blockCard(BLOCK, () => CUES, () => {}).querySelector('button.block-flip');
  assert.ok(flip, 'fixture should have cues and therefore a flip button');
  assert.equal(flip.querySelector('.block-swap'), null,
    'a button inside a button -- the parser closes the outer one');
});

test('tapping swap does not flip the card', () => {
  const li = blockCard(BLOCK, () => CUES, () => {});
  li.querySelector('.block-swap').dispatch('click');
  assert.ok(!li.querySelector('button.block-flip').classList.contains('is-flipped'));
});

test('a card with no cues still offers the swap', () => {
  const li = blockCard(BLOCK, () => null, () => {});
  assert.equal(li.querySelector('button.block-flip'), null);
  assert.ok(li.querySelector('.block-swap'), 'no swap on a card that cannot flip');
});

// The two ceilings on the card. The flags are asserted in ceiling.test.mjs;
// these pin the SENTENCES, because the bug fixed on 2026-09-09 was not that
// the load was capped -- it was capped correctly -- but that the card named
// the wrong reason for it on 38.3% of full-volume max-strength blocks.

const RAMP_CAPPED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'deadlift', name: 'Deadlift',
  mode: 'load', sets: 4, reps: 5, restSec: 180,
  pct: 0.65, prRef: 'deadlift', prCoef: 1, displayMultiplier: 0.65,
  rampLimited: true
};

const STANDING_CAPPED_BLOCK = {
  slot: 'A', role: 'main lift', exerciseId: 'push-jerk', name: 'Push Jerk',
  mode: 'load', sets: 4, reps: 3, restSec: 180,
  pct: 0.9, prRef: 'push-press', prCoef: 1.05, displayMultiplier: 0.95,
  ceilingLimited: true
};

test('a block capped during the ramp still blames the ramp', () => {
  const notes = blockCard(RAMP_CAPPED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(notes.some(t => t.includes('held down by the return ramp')),
    `no ramp note, got ${JSON.stringify(notes)}`);
  assert.ok(!notes.some(t => t.includes('standing')),
    'a ramp cap was reported as the standing cap');
});

test('a block capped past the ramp names the standing cap, not the ramp', () => {
  const notes = blockCard(STANDING_CAPPED_BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(notes.some(t => t.includes('standing 95% cap')),
    `no standing-cap note, got ${JSON.stringify(notes)}`);
  // The whole point. This sentence was appearing with no ramp running.
  assert.ok(!notes.some(t => t.includes('return ramp')),
    'the card still blamed the return ramp with no ramp running');
});

test('both capped blocks are marked capped, because both are', () => {
  for (const b of [RAMP_CAPPED_BLOCK, STANDING_CAPPED_BLOCK]) {
    const load = blockCard(b, () => null).querySelectorAll('.block-load');
    assert.ok(load.some(n => String(n.className).includes('is-capped')),
      `${b.exerciseId} lost its capped styling`);
  }
});

test('an uncapped block carries neither ceiling note', () => {
  const notes = blockCard(BLOCK, () => null)
    .querySelectorAll('.block-note').map(n => n.textContent);
  assert.ok(!notes.some(t => t.includes('return ramp')));
  assert.ok(!notes.some(t => t.includes('standing 95% cap')));
});

// --------------------------------------------------------------------------
// The staircase card.
// docs/superpowers/specs/2026-10-22-warmup-and-staircase-card-design.md §5
// --------------------------------------------------------------------------

const rung = (kind, reps, displayMultiplier) => ({ kind, reps, displayMultiplier });

const STAIR_BLOCK = {
  ...BLOCK,
  setPlan: [rung('warmup', 5, 0.3), rung('warmup', 3, 0.5),
    rung('work', 5, 0.72), rung('work', 5, 0.72), rung('work', 5, 0.72)]
};

const LADDER_BLOCK = {
  ...BLOCK, architecture: 'ladder', sets: 6, reps: 3, displayMultiplier: 0.76,
  setPlan: [rung('warmup', 5, 0.4), rung('warmup', 3, 0.6),
    ...[0.76, 0.78, 0.8, 0.77, 0.79, 0.81].map(m => rung('work', 3, m))]
};

const frontOf = b => blockCard(b, () => null).querySelector('.is-front');

test('a loaded block draws one bar per set, warm-ups marked', () => {
  const bars = frontOf(STAIR_BLOCK).querySelectorAll('.stair-bar');
  assert.equal(bars.length, 5);
  assert.deepEqual(bars.map(b => b.classList.contains('is-warmup')),
    [true, true, false, false, false]);
  const cols = frontOf(STAIR_BLOCK).querySelectorAll('.stair-col').map(c => c.textContent);
  assert.equal(bars[0].textContent, '5');
  assert.equal(cols[0], '5.30');
  assert.equal(cols[4], '5.72');
});

test('the staircase replaces the warm-up and sets text lines', () => {
  const f = frontOf(LADDER_BLOCK);
  assert.equal(f.querySelector('.block-warmup'), null);
  assert.equal(f.querySelector('.block-work'), null);
});

test('the staircase keeps the full prescription for screen readers', () => {
  const stair = frontOf(LADDER_BLOCK).querySelector('.stair');
  assert.equal(stair.getAttribute('role'), 'img');
  const label = stair.getAttribute('aria-label');
  assert.ok(label.includes(warmupLine(LADDER_BLOCK)));
  assert.ok(label.includes(workLine(LADDER_BLOCK)));
});

test('the tallest bar is full height and none falls under the minimum', () => {
  const pct = n => parseFloat(n.style.height);
  const bars = frontOf({
    ...STAIR_BLOCK,
    setPlan: [rung('warmup', 5, 0.1), rung('work', 5, 0.8)]
  }).querySelectorAll('.stair-bar');
  assert.equal(bars[1].style.height, '100%');
  assert.ok(pct(bars[0]) >= 18, `shortest bar is ${bars[0].style.height}`);
  for (const b of frontOf(LADDER_BLOCK).querySelectorAll('.stair-bar')) {
    assert.ok(pct(b) >= 18 && pct(b) <= 100);
  }
});

test('the header carries sets, reps and a plain rest', () => {
  assert.equal(frontOf(STAIR_BLOCK).querySelector('.block-volume').textContent,
    '3 × 5 · rest 3 min');
  const meta = frontOf(STAIR_BLOCK).querySelectorAll('.block-meta')
    .map(n => n.textContent).join('|');
  assert.ok(!meta.includes('rest'), `rest printed twice: ${meta}`);
});

test('a superset keeps its rest sentence in the meta line, not the header', () => {
  const sup = { ...STAIR_BLOCK, group: 'g1', groupRole: 'A2', groupRounds: 3, groupRestSec: 120 };
  const f = frontOf(sup);
  assert.equal(f.querySelector('.block-volume').textContent, '3 × 5');
  const meta = f.querySelectorAll('.block-meta').map(n => n.textContent);
  assert.ok(meta.some(t => t.includes('rest 2 min')), JSON.stringify(meta));
});

test('the hero is the multiplier, with the PR reference under it', () => {
  const f = frontOf(STAIR_BLOCK);
  assert.equal(f.querySelector('.block-load').textContent, '0.72×');
  assert.equal(f.querySelector('.block-load-ref').textContent, 'Back Squat PR');
});

test('a ladder keeps the first working set as its hero', () => {
  assert.equal(frontOf(LADDER_BLOCK).querySelector('.block-load').textContent, '0.76×');
});

test('a capped loaded block keeps is-capped on the hero and the staircase', () => {
  const f = frontOf({ ...STAIR_BLOCK, rampLimited: true });
  assert.ok(f.querySelector('.block-load').classList.contains('is-capped'));
  assert.ok(f.querySelector('.stair').classList.contains('is-capped'));
});

test('a straight block with no warm-ups gets no staircase', () => {
  const f = frontOf({ ...BLOCK, setPlan: [rung('work', 5, 0.72), rung('work', 5, 0.72)] });
  assert.equal(f.querySelector('.stair'), null);
  assert.equal(f.querySelector('.block-load').textContent, '0.72×');
});

test('ten bars render ten bars', () => {
  const plan = [rung('warmup', 5, 0.3), rung('warmup', 3, 0.5)];
  for (let i = 0; i < 8; i++) plan.push(rung('work', 3, 0.5));
  assert.equal(frontOf({ ...STAIR_BLOCK, setPlan: plan })
    .querySelectorAll('.stair-bar').length, 10);
});

// Saved days from v78 or earlier carry the old ladder (up to 8 warm-ups and 8
// work sets, measured max 13 bars). They get is-dense so the labels shrink.
test('a 13-bar block from an old saved day renders 13 bars and is-dense', () => {
  const plan = [];
  for (let i = 0; i < 5; i++) plan.push(rung('warmup', 3, 0.3 + i * 0.1));
  for (let i = 0; i < 8; i++) plan.push(rung('work', 3, 0.7));
  const stair = frontOf({ ...STAIR_BLOCK, setPlan: plan }).querySelector('.stair');
  assert.equal(stair.querySelectorAll('.stair-bar').length, 13);
  assert.ok(stair.classList.contains('is-dense'));
});

test('ten bars or fewer are not dense', () => {
  assert.ok(!frontOf(STAIR_BLOCK).querySelector('.stair').classList.contains('is-dense'));
});

// Everything that is not a loaded block must read exactly as it did. These
// strings were captured from the card before the staircase existed.
test('non-loaded cards read exactly as before the staircase', () => {
  const text = b => frontOf(b).textContent;
  assert.equal(text(INTERVAL_BLOCK),
    'Running Intervals~24 min6 rounds of 90 s hard, 2:55 easy betweenwalk or jog the recovery -- never stand still · hard -- talking is down to a word or two');
  assert.equal(text(RELAXED_BLOCK),
    'Chin-Up4 × 5leave 2-3 reps in reserveneeds equipment you do not have -- this is the closest movement availablerest 3 min');
  assert.equal(text({ slot: 'C', exerciseId: 'box-jump', name: 'Box Jump', mode: 'contacts',
    sets: 4, reps: 3, footContacts: 12, restSec: 90 }),
    'Box Jump4 × 312 contactsrest 1:30');
  assert.equal(text({ slot: 'C', exerciseId: 'plank', name: 'Plank', mode: 'hold',
    sets: 3, reps: 1, holdSec: 30, restSec: 60 }),
    'Plank× 330s holdrest 1 min');
});
