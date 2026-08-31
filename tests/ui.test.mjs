// Dose units in the card. Task 8, design 2.1, discrepancy 4.
//
// renderSession needs a DOM and is checked in the browser in Task 10, not here.
// loadLine and volumeLine are pure, so they are checked directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

installDom();
const {
  loadLine, volumeLine, equipmentControl, renderNothingBuildable,
  renderConfirmPrevious
} = await import('../js/ui.js');

test('a drill prints reps, never minutes', () => {
  assert.equal(loadLine({ mode: 'drill', reps: 12, sets: 1 }), '12 reps');
  assert.equal(
    loadLine({ mode: 'drill', reps: 10, sets: 1, perSide: true }),
    '10 reps per side'
  );
});

test('a hold prints seconds', () => {
  assert.equal(loadLine({ mode: 'hold', holdSec: 30, sets: 2 }), '30s hold');
  assert.equal(
    loadLine({ mode: 'hold', holdSec: 25, sets: 2, perSide: true }),
    '25s hold per side'
  );
});

test('the volume chip suits the dose', () => {
  assert.equal(volumeLine({ mode: 'drill', sets: 1, reps: 12 }), '');
  assert.equal(volumeLine({ mode: 'hold', sets: 2, holdSec: 30 }), '× 2');
  assert.equal(volumeLine({ mode: 'reps', sets: 3, reps: 12 }), '3 × 12');
});

test('an interval prints the whole prescription, never a multiplier', () => {
  // "8 x 90 s" left three questions unanswered on the phone: how long is one
  // round, how long do I jog, and how do I know when I am done. The card now
  // answers all three without being flipped over. design §8.
  const block = {
    name: 'Running Intervals', mode: 'interval',
    workSec: 90, restSec: 90, sets: 8
  };
  assert.equal(loadLine(block), '8 rounds of 90 s hard, 1:30 easy between');
  // Work plus the seven recoveries BETWEEN the rounds -- you do not rest
  // after the last one. 8x90 + 7x90 = 1350 s.
  assert.equal(volumeLine(block), '~23 min');
});

test('a recovery under a minute prints as seconds, not as 0:45', () => {
  assert.equal(
    loadLine({ mode: 'interval', sets: 6, workSec: 60, restSec: 45 }),
    '6 rounds of 60 s hard, 45 s easy between'
  );
});

test('an interval block never reaches the multiplier fallthrough', () => {
  // Regression: loadLine's final line is block.displayMultiplier.toFixed(2).
  // An interval block has no displayMultiplier, so a missing branch here is
  // a TypeError that kills the whole render.
  assert.doesNotThrow(() => loadLine({
    name: 'Fartlek', mode: 'interval', workSec: 60, restSec: 120, sets: 6
  }));
});

// --------------------------------------------------------------------------
// The "what's missing today?" control. design-equipment-and-swap.md §7.
// --------------------------------------------------------------------------

test('the control renders one checkbox per offerable item, all ticked', () => {
  const boxes = equipmentControl(['barbell', 'bench', 'rack'], [], () => {})
    .querySelectorAll('input');
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every(b => b.checked));
});

test('an item already excluded comes back unticked', () => {
  const boxes = equipmentControl(['barbell', 'bench'], ['barbell'], () => {})
    .querySelectorAll('input');
  assert.equal(boxes[0].checked, false);
  assert.equal(boxes[1].checked, true);
});

test('toggling an item names it to the caller', () => {
  let seen = null;
  const node = equipmentControl(['barbell', 'bench'], [], q => { seen = q; });
  node.querySelectorAll('input')[1].dispatch('change');
  assert.equal(seen, 'bench');
});

test('the control names every item beside its box', () => {
  const node = equipmentControl(['barbell', 'bench'], [], () => {});
  const labels = node.querySelectorAll('span').map(n => n.textContent);
  assert.deepEqual(labels, ['barbell', 'bench']);
});

test('nothing buildable is a calm screen, not an error', () => {
  const node = renderNothingBuildable();
  assert.equal(node.className, 'empty');
  assert.ok(node.querySelector('h2').textContent.length > 0);
});

// --------------------------------------------------------------------------
// "Did you finish this?" -- spec §6 limitation 1. One question, two taps.
// --------------------------------------------------------------------------

const PAST = { date: '2026-08-29', dayType: 'max-strength' };

test('the question names the day it is asking about', () => {
  const node = renderConfirmPrevious(PAST, { onYes(){}, onNo(){} });
  const text = node.textContent;
  assert.match(text, /Max Strength/, 'the day type is not named');
  assert.match(text, /2026-08-29|Aug|29/, 'the date is not named');
});

test('yes and no each reach their own handler', () => {
  let said = null;
  const node = renderConfirmPrevious(PAST, {
    onYes: () => { said = 'yes'; }, onNo: () => { said = 'no'; }
  });
  const buttons = node.querySelectorAll('button');
  assert.equal(buttons.length, 2, 'expected exactly two answers');

  buttons[0].dispatch('click');
  assert.equal(said, 'yes');
  buttons[1].dispatch('click');
  assert.equal(said, 'no');
});

test('it is a question, not an error screen', () => {
  // renderError is for a broken app. This is the app working correctly and
  // asking something only he can answer. design §6.1 precedent.
  const node = renderConfirmPrevious(PAST, { onYes(){}, onNo(){} });
  assert.ok(!/error|wrong|failed/i.test(node.textContent));
});
