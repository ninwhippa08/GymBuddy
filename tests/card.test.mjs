// The card's two faces. design-card-flip.md §5, §7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

installDom();
const { blockCard } = await import('../js/ui.js');

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
