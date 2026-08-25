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
