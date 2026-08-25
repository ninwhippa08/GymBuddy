// The shim is test infrastructure, so it gets tested like anything else.
// A shim that lies produces green tests over broken code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

const document = installDom();

test('an element carries its tag, class and text', () => {
  const n = document.createElement('p');
  n.className = 'block-note';
  n.textContent = 'held down by the return ramp';
  assert.equal(n.tagName, 'P');
  assert.equal(n.className, 'block-note');
  assert.equal(n.textContent, 'held down by the return ramp');
});

test('textContent reads through the whole subtree', () => {
  const ul = document.createElement('ul');
  for (const t of ['one', 'two']) {
    const li = document.createElement('li');
    li.textContent = t;
    ul.append(li);
  }
  assert.equal(ul.textContent, 'onetwo');
});

test('classList toggles and reports', () => {
  const n = document.createElement('div');
  n.className = 'block-inner';
  assert.equal(n.classList.contains('is-flipped'), false);
  assert.equal(n.classList.toggle('is-flipped'), true);
  assert.equal(n.className, 'block-inner is-flipped');
  assert.equal(n.classList.toggle('is-flipped'), false);
  assert.equal(n.className, 'block-inner');
});

test('attributes round-trip and missing ones read null', () => {
  const n = document.createElement('button');
  n.setAttribute('aria-pressed', 'false');
  assert.equal(n.getAttribute('aria-pressed'), 'false');
  assert.equal(n.getAttribute('aria-label'), null);
});

test('a dispatched click runs the listener', () => {
  const n = document.createElement('button');
  let runs = 0;
  n.addEventListener('click', () => { runs += 1; });
  n.dispatch('click');
  assert.equal(runs, 1);
});

test('querySelector finds by tag, class, and both', () => {
  const root = document.createElement('li');
  const face = document.createElement('div');
  face.className = 'block-face is-back';
  const h = document.createElement('h3');
  h.className = 'block-name';
  h.textContent = 'Back Squat';
  face.append(h);
  root.append(face);

  assert.equal(root.querySelector('.is-back'), face);
  assert.equal(root.querySelector('h3').textContent, 'Back Squat');
  assert.equal(root.querySelector('div.block-face'), face);
  assert.equal(root.querySelector('.nope'), null);
  assert.equal(root.querySelectorAll('.block-face').length, 1);
});

test('an unimplemented method throws instead of returning undefined', () => {
  const n = document.createElement('div');
  assert.throws(() => n.insertAdjacentHTML('beforeend', '<b>x</b>'), /not implemented/);
});
