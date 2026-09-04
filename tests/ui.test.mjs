// Dose units in the card. Task 8, design 2.1, discrepancy 4.
//
// renderSession needs a DOM and is checked in the browser in Task 10, not here.
// loadLine, volumeLine and warmupLine are pure, so they are checked directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './dom-shim.mjs';

installDom();
const {
  loadLine, volumeLine, equipmentControl, renderNothingBuildable,
  renderConfirmPrevious, sorenessMap, addMoveControl, warmupLine, workLine,
  renderSession, blockCard, renderCalendar, renderHome, backupControl
} = await import('../js/ui.js');
const { SORENESS_JOINTS } = await import('../js/rules.js');

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

// --------------------------------------------------------------------------
// The soreness body map. spec §4.1.
//
// The cycle lives in the control, not in the caller: three states in a fixed
// order is exactly the kind of rule that drifts when two places both know it.
// The caller is told the joint and the level it should now store.
// --------------------------------------------------------------------------

test('the map offers every joint the engine can act on', () => {
  const node = sorenessMap(SORENESS_JOINTS, {}, () => {});
  const buttons = node.querySelectorAll('button');
  assert.equal(buttons.length, SORENESS_JOINTS.length);
});

test('a clear joint cycles to sore', () => {
  let seen = null;
  const node = sorenessMap(SORENESS_JOINTS, {}, (joint, level) => { seen = [joint, level]; });
  node.querySelectorAll('button')[0].dispatch('click');
  assert.deepEqual(seen, [SORENESS_JOINTS[0], 'sore']);
});

test('a sore joint cycles to hurt', () => {
  let seen = null;
  const node = sorenessMap(SORENESS_JOINTS, { knee: 'sore' }, (joint, level) => { seen = [joint, level]; });
  const knee = node.querySelectorAll('button').find(b => /knee/.test(b.getAttribute('aria-label')));
  knee.dispatch('click');
  assert.deepEqual(seen, ['knee', 'hurt']);
});

test('a hurt joint cycles back to clear, reported as null', () => {
  // null, not the string 'clear' or a missing argument: the caller stores it
  // straight onto the soreness map and `undefined` there would read as "no
  // opinion" in some places and "not sore" in others.
  let seen = 'untouched';
  const node = sorenessMap(SORENESS_JOINTS, { knee: 'hurt' }, (joint, level) => { seen = [joint, level]; });
  const knee = node.querySelectorAll('button').find(b => /knee/.test(b.getAttribute('aria-label')));
  knee.dispatch('click');
  assert.deepEqual(seen, ['knee', null]);
});

test('a saved flag shows up pre-filled, not blank', () => {
  // spec §4.1: flags persist to the next session pre-checked.
  const node = sorenessMap(SORENESS_JOINTS, { knee: 'hurt', hip: 'sore' }, () => {});
  const byJoint = j => node.querySelectorAll('button')
    .find(b => new RegExp(`^${j}`).test(b.getAttribute('aria-label')));
  assert.match(byJoint('knee').className, /is-hurt/);
  assert.match(byJoint('hip').className, /is-sore/);
  assert.ok(!/is-sore|is-hurt/.test(byJoint('ankle').className));
});

test('the state is in the label, not only in the colour', () => {
  // Colour alone is not an accessible way to say "this one is excluded".
  const node = sorenessMap(SORENESS_JOINTS, { knee: 'hurt' }, () => {});
  const knee = node.querySelectorAll('button').find(b => /knee/.test(b.getAttribute('aria-label')));
  assert.match(knee.getAttribute('aria-label'), /hurt/);
});

test('every joint the caller can pass has somewhere to sit on the figure', () => {
  // ui.js owns the coordinates, rules.js owns the vocabulary, and nothing else
  // would notice if the two drifted apart -- a joint with no position would
  // render stacked in the corner rather than throw.
  const node = sorenessMap(SORENESS_JOINTS, {}, () => {});
  const placed = node.querySelectorAll('button')
    .map(b => b.getAttribute('style'))
    .filter(v => /left:\d+%;top:\d+%/.test(v));
  assert.equal(placed.length, SORENESS_JOINTS.length);
});

// --------------------------------------------------------------------------
// Both controls collapse. Measured 2026-08-30: expanded, the body map is 460px
// and the equipment list 125px, which put the first exercise card at 884px --
// below the fold on an 844px phone. The app's whole promise is that you open it
// at the gym door and see the session, so the session comes first and the
// controls fold away with their state still readable on the closed line.
//
// <details>/<summary> rather than a class and a click handler: it is native,
// keyboard-operable and screen-reader-labelled for free, and it keeps working
// if the script ever fails to run.
// --------------------------------------------------------------------------

test('the body map is collapsed until asked for', () => {
  const node = sorenessMap(SORENESS_JOINTS, {}, () => {});
  assert.equal(node.tagName, 'DETAILS');
  assert.equal(node.getAttribute('open'), null, 'it must not start open');
});

test('the equipment control is collapsed until asked for', () => {
  const node = equipmentControl(['barbell', 'bench'], [], () => {});
  assert.equal(node.tagName, 'DETAILS');
  assert.equal(node.getAttribute('open'), null);
});

test('what is marked is readable without opening the map', () => {
  // The point of collapsing is lost if you have to open it to find out whether
  // anything is set.
  const node = sorenessMap(SORENESS_JOINTS, { knee: 'hurt', hip: 'sore' }, () => {});
  const line = node.querySelector('summary').textContent;
  assert.match(line, /knee hurt/);
  assert.match(line, /hip sore/);
});

test('an unmarked map says so rather than showing a bare title', () => {
  const node = sorenessMap(SORENESS_JOINTS, {}, () => {});
  assert.match(node.querySelector('summary').textContent, /nothing/i);
});

test('what is excluded is readable without opening the equipment list', () => {
  const node = equipmentControl(['barbell', 'bench'], ['barbell'], () => {});
  assert.match(node.querySelector('summary').textContent, /barbell/);
});

test('collapsing does not cost the controls their behaviour', () => {
  let seen = null;
  const map = sorenessMap(SORENESS_JOINTS, {}, (j, l) => { seen = [j, l]; });
  map.querySelectorAll('button')[0].dispatch('click');
  assert.deepEqual(seen, [SORENESS_JOINTS[0], 'sore']);

  let item = null;
  const eq = equipmentControl(['barbell', 'bench'], [], q => { item = q; });
  eq.querySelectorAll('input')[1].dispatch('change');
  assert.equal(item, 'bench');
});

// Re-rendering must not close the panel under his finger. Every tap rebuilds
// the whole screen (app.js mounts a fresh tree), so a <details> that defaults
// to closed reopens closed after each joint -- marking a knee, a hip and a
// shoulder would mean opening the map three times. The caller therefore owns
// the open state and hands it back on the next render.
test('a control can be rendered already open', () => {
  assert.equal(sorenessMap(SORENESS_JOINTS, {}, () => {}, true).getAttribute('open'), '');
  assert.equal(equipmentControl(['barbell'], [], () => {}, true).getAttribute('open'), '');
});

test('closed is still the default', () => {
  assert.equal(sorenessMap(SORENESS_JOINTS, {}, () => {}).getAttribute('open'), null);
  assert.equal(equipmentControl(['barbell'], [], () => {}).getAttribute('open'), null);
});

// --------------------------------------------------------------------------
// Capture a movement at the rack, send it to GitHub as an issue later.
//
// The link is a plain <a href> to GitHub's pre-filled new-issue form, so the
// app never holds a token: he is already signed in on his phone and submits it
// himself. Nothing here writes to the repo.
// --------------------------------------------------------------------------

const ISSUE_BASE = 'https://github.com/ninwhippa08/GymBuddy/issues/new';
const paramsOf = href => new URL(href).searchParams;

test('the add-move control is collapsed like the others', () => {
  const node = addMoveControl([], ISSUE_BASE, {});
  assert.equal(node.tagName, 'DETAILS');
  assert.equal(node.getAttribute('open'), null);
});

test('the closed line says how many drafts are waiting', () => {
  assert.match(addMoveControl([], ISSUE_BASE, {}).querySelector('summary').textContent, /add a move/i);
  const two = addMoveControl(
    [{ id: 'a', name: 'One', note: '' }, { id: 'b', name: 'Two', note: '' }],
    ISSUE_BASE, {});
  assert.match(two.querySelector('summary').textContent, /2/);
});

test('saving reports the name and the note', () => {
  let seen = null;
  const node = addMoveControl([], ISSUE_BASE, { onSave: (n, note) => { seen = [n, note]; } });
  node.querySelector('input').value = 'Dumbbell Clean';
  node.querySelector('textarea').value = 'like a power clean but with two dumbbells';
  node.querySelectorAll('button').find(b => /save/i.test(b.textContent)).dispatch('click');
  assert.deepEqual(seen, ['Dumbbell Clean', 'like a power clean but with two dumbbells']);
});

test('a nameless draft is not saved', () => {
  // A row with no name is unremovable-looking clutter and tells me nothing.
  let called = false;
  const node = addMoveControl([], ISSUE_BASE, { onSave: () => { called = true; } });
  node.querySelector('input').value = '   ';
  node.querySelectorAll('button').find(b => /save/i.test(b.textContent)).dispatch('click');
  assert.equal(called, false);
});

test('each draft carries a link that pre-fills the issue', () => {
  const node = addMoveControl(
    [{ id: 'a', name: 'Dumbbell Clean', note: 'two dumbbells' }], ISSUE_BASE, {});
  const href = node.querySelector('a').getAttribute('href');
  assert.ok(href.startsWith(ISSUE_BASE));
  const p = paramsOf(href);
  assert.match(p.get('title'), /Dumbbell Clean/);
  assert.match(p.get('body'), /two dumbbells/);
});

test('a note full of URL punctuation arrives intact', () => {
  // The one thing here that corrupts silently. `&` ends a query parameter and
  // `#` ends the URL, so an unencoded note loses everything after the first one.
  const note = 'clean & press #2 -- 50% of a "power clean"\nsecond line';
  const node = addMoveControl([{ id: 'a', name: 'Odd & Name #1', note }], ISSUE_BASE, {});
  const p = paramsOf(node.querySelector('a').getAttribute('href'));
  assert.equal(p.get('body'), note, 'the note did not survive the round trip');
  assert.match(p.get('title'), /Odd & Name #1/);
});

test('a draft can be thrown away by id', () => {
  let removed = null;
  const node = addMoveControl(
    [{ id: 'abc', name: 'Bin Me', note: '' }], ISSUE_BASE,
    { onRemove: id => { removed = id; } });
  node.querySelectorAll('button').find(b => /remove|delete|✕|x/i.test(b.textContent))
      .dispatch('click');
  assert.equal(removed, 'abc');
});

// --------------------------------------------------------------------------
// The ladder, under the hero line. Task 2's setPlan drives it.
// --------------------------------------------------------------------------

const RAMPED = {
  mode: 'load', sets: 3, reps: 5, displayMultiplier: 0.8, prRef: 'back-squat',
  setPlan: [
    { kind: 'warmup', reps: 8, pct: 0.3,  displayMultiplier: 0.3 },
    { kind: 'warmup', reps: 5, pct: 0.55, displayMultiplier: 0.55 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 },
    { kind: 'work',   reps: 5, pct: 0.8,  displayMultiplier: 0.8 }
  ]
};

test('the warm-up line lists every step as reps by multiplier', () => {
  const line = warmupLine(RAMPED);
  assert.match(line, /8 × 0\.30/);
  assert.match(line, /5 × 0\.55/);
});

test('the warm-up line names itself, so its numbers are not read as work', () => {
  assert.match(warmupLine(RAMPED), /warm-up/i);
});

test('the warm-up line never lists a working set', () => {
  // The hero line already carries the working load. Repeating it here would
  // read as a fourth warm-up.
  assert.equal((warmupLine(RAMPED).match(/0\.80/g) || []).length, 0);
});

test('a block with no plan has no warm-up line', () => {
  assert.equal(warmupLine({ mode: 'load', displayMultiplier: 0.4 }), '');
  assert.equal(warmupLine({ mode: 'reps' }), '');
});

test('the hero line still prints the WORKING load, unchanged', () => {
  // Regression: the number read mid-set must not become the first warm-up.
  assert.equal(loadLine(RAMPED), '0.80 × Back Squat PR');
});

// A technical: 3 lift's extra technique set sits AT WARMUP.START, alongside
// rung 0, so its first two rungs are identical by construction -- 46.2% of
// ramped cards measured over 24,355 generated blocks. Printed twice it read as
// a typo, and it pushed the worst-case line to 82 characters, which wraps
// mid-step on the phone.
const TECHNICAL = {
  mode: 'load', sets: 2, reps: 3, displayMultiplier: 0.81, prRef: 'back-squat',
  setPlan: [
    { kind: 'warmup', reps: 3, pct: 0.30, displayMultiplier: 0.30 },
    { kind: 'warmup', reps: 3, pct: 0.30, displayMultiplier: 0.30 },
    { kind: 'warmup', reps: 3, pct: 0.43, displayMultiplier: 0.43 },
    { kind: 'work',   reps: 3, pct: 0.81, displayMultiplier: 0.81 },
    { kind: 'work',   reps: 3, pct: 0.81, displayMultiplier: 0.81 }
  ]
};

test('two identical rungs in a row print once, with a set count', () => {
  assert.equal(warmupLine(TECHNICAL),
    'warm-up  2 × 3 × 0.30  ·  3 × 0.43');
});

test('the collapse compares values, so distinct rungs are never merged', () => {
  // The ladder is not tabulated, so nothing guarantees which rungs repeat --
  // this is a value comparison, not a `technical === 3` special case. A single
  // rung keeps the plain `reps × load` form; only a repeat earns a count.
  assert.equal(warmupLine(RAMPED), 'warm-up  8 × 0.30  ·  5 × 0.55');
});

test('three of the same rung collapse into one, not two', () => {
  const line = warmupLine({
    setPlan: [
      { kind: 'warmup', reps: 3, pct: 0.3, displayMultiplier: 0.3 },
      { kind: 'warmup', reps: 3, pct: 0.3, displayMultiplier: 0.3 },
      { kind: 'warmup', reps: 3, pct: 0.3, displayMultiplier: 0.3 },
      { kind: 'work',   reps: 3, pct: 0.7, displayMultiplier: 0.7 }
    ]
  });
  assert.equal(line, 'warm-up  3 × 3 × 0.30');
});

test('same load at different reps stays two rungs', () => {
  const line = warmupLine({
    setPlan: [
      { kind: 'warmup', reps: 5, pct: 0.3, displayMultiplier: 0.3 },
      { kind: 'warmup', reps: 3, pct: 0.3, displayMultiplier: 0.3 }
    ]
  });
  assert.equal(line, 'warm-up  5 × 0.30  ·  3 × 0.30');
});


// --------------------------------------------------------------------------
// "I did this workout"
// --------------------------------------------------------------------------

// The session record the card renders. Only the fields renderSession reads.
function card(extra = {}) {
  return {
    date: '2026-09-01', dayType: 'max-strength', venue: 'gym', durationMin: 52,
    rampWeek: 3, reason: 'nothing like heavy lifting in 6 days', seed: 42,
    warnings: [], blocks: [
      { role: 'prep', name: 'Leg swings', mode: 'drill', reps: 10, sets: 1 },
      { role: 'main', name: 'Back squat', mode: 'load', reps: 5, sets: 3,
        pct: 0.8, displayMultiplier: 0.8, prRef: 'squat' }
    ],
    ...extra
  };
}

const buttonText = node => node.querySelectorAll('button').map(b => b.textContent);

test('the session card offers a way to say the workout was done', () => {
  const node = renderSession(card(), { onReroll() {}, onDone() {} });
  assert.ok(
    buttonText(node).some(t => /did this/i.test(t)),
    `no completion button among ${JSON.stringify(buttonText(node))}`
  );
});

test('tapping it reports the session as done', () => {
  let done = 0;
  const node = renderSession(card(), { onReroll() {}, onDone: () => { done++; } });
  const btn = node.querySelectorAll('button').find(b => /did this/i.test(b.textContent));
  btn.dispatch('click');
  assert.equal(done, 1);
});

test('a confirmed session says so and drops the reroll', () => {
  const node = renderSession(card({ confirmed: true }), { onReroll() {}, onDone() {} });
  const texts = buttonText(node);
  assert.ok(!texts.some(t => /reroll/i.test(t)),
    `reroll still offered on a confirmed session: ${JSON.stringify(texts)}`);
  assert.ok(/done|completed/i.test(node.textContent),
    'a confirmed session should say it was done');
});

// --------------------------------------------------------------------------
// Strides: contact-less sprint work that still has a distance
// --------------------------------------------------------------------------

// The strides block carries sprintMeters (6 x 50 m = 300) and footContacts 0 --
// strides are not counted as plyometric ground contacts. The contacts branch
// read only footContacts, so the one number he needs was computed, stored and
// then never shown: the card said "6 x 1" and an effort cue, and nothing about
// how far a stride is. Sourced prescription is 50-150 m per rep, so the
// distance IS the prescription.
const STRIDES = {
  name: 'Strides', role: 'strides', mode: 'contacts', sets: 6, reps: 1,
  footContacts: 0, sprintMeters: 300, restSec: 75, optional: true,
  effort: 'build to about 90%, never a maximal effort'
};

test('a stride prints the distance of ONE stride, not the session total', () => {
  assert.equal(loadLine(STRIDES), '50 m');
});

test('the chip carries how many strides, not sets x reps', () => {
  // "6 x 1" is noise for the same reason "1 x 12" is noise over a drill.
  assert.equal(volumeLine(STRIDES), '× 6');
});

test('contact-less work with no distance still falls back to the effort cue', () => {
  // Throws and slams have neither contacts nor metres; the cue is all there is.
  assert.equal(
    loadLine({ mode: 'contacts', sets: 3, reps: 1, footContacts: 0, effort: 'maximal intent' }),
    'maximal intent'
  );
});

test('real contact work is unchanged', () => {
  assert.equal(
    loadLine({ mode: 'contacts', sets: 4, reps: 5, footContacts: 20, sprintMeters: 120 }),
    '20 contacts · 120 m'
  );
  assert.equal(loadLine({ mode: 'contacts', sets: 4, reps: 5, footContacts: 20 }), '20 contacts');
});

test('the effort cue survives on the stride card once the hero is a distance', () => {
  const node = blockCard(STRIDES, () => null);
  assert.match(node.textContent, /50 m/);
  assert.match(node.textContent, /build to about 90%/);
});

test('a single set of distance work carries no chip', () => {
  // Same rule as a drill: "× 1" over one set of A-skips says nothing.
  assert.equal(volumeLine({ mode: 'contacts', sets: 1, reps: 1, footContacts: 0, sprintMeters: 20 }), '');
});

test('a confirmed card offers a way back', () => {
  const node = renderSession(card({ confirmed: true }), {
    onReroll() {}, onDone() {}, onUndo() {}
  });
  assert.ok(
    node.querySelectorAll('button').some(b => /undo/i.test(b.textContent)),
    `no undo on a confirmed card: ${JSON.stringify(node.querySelectorAll('button').map(b => b.textContent))}`
  );
});

test('undo reports back, and does not pretend to be the reroll', () => {
  let undone = 0, rerolled = 0;
  const node = renderSession(card({ confirmed: true }), {
    onReroll: () => { rerolled++; }, onDone() {}, onUndo: () => { undone++; }
  });
  node.querySelectorAll('button').find(b => /undo/i.test(b.textContent)).dispatch('click');
  assert.equal(undone, 1);
  assert.equal(rerolled, 0);
});


// --------------------------------------------------------------------------
// The calendar. design-home-and-calendar.md §5, §8.
// --------------------------------------------------------------------------

const trained = (date, dayType = 'max-strength') =>
  ({ date, dayType, confirmed: true, blocks: [] });

const cal = (over = {}) => renderCalendar({
  year: 2026, month: 9, history: [], today: '2026-09-14',
  onPrev() {}, onNext() {}, onPick() {}, ...over
});

const dayButton = (node, label) => node.querySelectorAll('button').find(
  b => new RegExp(label).test(b.getAttribute('aria-label') || '')
);

test('the calendar shows the month and year', () => {
  assert.match(cal().textContent, /September 2026/);
});

test('the calendar has seven weekday headings starting Monday', () => {
  const heads = cal().querySelectorAll('.cal-weekday');
  assert.equal(heads.length, 7);
  assert.equal(heads[0].textContent, 'Mon');
});

test('a trained day carries its two-letter code', () => {
  const node = cal({ history: [trained('2026-09-14', 'power')] });
  assert.match(node.textContent, /PW/);
});

test('a trained day is a button', () => {
  const node = cal({ history: [trained('2026-09-14')] });
  assert.ok(dayButton(node, '14 September'), 'no button for the trained day');
});

test('an untrained day is not focusable -- there is nothing to open', () => {
  assert.equal(dayButton(cal(), '14 September'), undefined);
});

test('the accessible name says the date and the day type, not just a colour', () => {
  // design §8: colour is never the only encoding, and it is never the name.
  const node = cal({ history: [trained('2026-09-14', 'hypertrophy')] });
  assert.match(dayButton(node, '14 September').getAttribute('aria-label'), /Hypertrophy/i);
});

test('tapping a trained day reports its date', () => {
  let picked = null;
  const node = cal({ history: [trained('2026-09-14')], onPick: d => { picked = d; } });
  dayButton(node, '14 September').dispatch('click');
  assert.equal(picked, '2026-09-14');
});

test('the month arrows report which way', () => {
  const seen = [];
  const node = cal({ onPrev: () => seen.push('prev'), onNext: () => seen.push('next') });
  node.querySelector('.cal-prev').dispatch('click');
  node.querySelector('.cal-next').dispatch('click');
  assert.deepEqual(seen, ['prev', 'next']);
});

test('today is marked even when nothing was trained', () => {
  assert.ok(cal().querySelector('.is-today'), 'no today marker');
});

test('a legend entry exists for every day type that appears', () => {
  const node = cal({ history: [trained('2026-09-14', 'power'), trained('2026-09-16', 'sprint')] });
  const legend = node.querySelector('.cal-legend').textContent;
  assert.match(legend, /PW/);
  assert.match(legend, /SP/);
});

test('the legend lists only day types present in the month', () => {
  // A legend of all seven every month is noise; it explains marks that are there.
  const node = cal({ history: [trained('2026-09-14', 'power')] });
  assert.equal(/HY/.test(node.querySelector('.cal-legend').textContent), false);
});


// --------------------------------------------------------------------------
// The home screen. design-home-and-calendar.md §6.
// --------------------------------------------------------------------------

const home = (over = {}) => renderHome({
  rampWeek: 2,
  daysSince: 3,
  todaySession: null,
  soreness: { joints: SORENESS_JOINTS, current: {}, onCycle() {} },
  calendar: {
    year: 2026, month: 9, history: [], today: '2026-09-14',
    onPrev() {}, onNext() {}, onPick() {}
  },
  onGenerate() {},
  onOpenToday() {},
  ...over
});

test('the home screen offers to generate when nothing exists for today', () => {
  const btn = home().querySelector('.home-generate');
  assert.ok(btn);
  assert.match(btn.textContent, /generate/i);
});

test('generating is reported once, on tap', () => {
  let taps = 0;
  home({ onGenerate: () => { taps++; } }).querySelector('.home-generate').dispatch('click');
  assert.equal(taps, 1);
});

test('an unconfirmed session for today offers a way back into it', () => {
  const node = home({
    todaySession: { date: '2026-09-14', dayType: 'power', blocks: [] }
  });
  assert.equal(node.querySelector('.home-generate'), null);
  assert.match(node.querySelector('.home-today').textContent, /power/i);
});

test('a confirmed session for today does not offer to generate again', () => {
  // design §12 leaves a second session for a day unanswered; until it is
  // asked for, the button is simply not there.
  const node = home({
    todaySession: { date: '2026-09-14', dayType: 'power', confirmed: true, blocks: [] }
  });
  assert.equal(node.querySelector('.home-generate'), null);
  assert.match(node.textContent, /done/i);
});

test('the status line carries the ramp week', () => {
  assert.match(home().querySelector('.home-status').textContent, /week 2/i);
});

test('the status line carries days since the last session', () => {
  assert.match(home().querySelector('.home-status').textContent, /3 days/i);
});

test('one day ago is not "1 days"', () => {
  assert.match(home({ daysSince: 1 }).querySelector('.home-status').textContent, /1 day\b/);
});

test('training today reads as today, not "0 days ago"', () => {
  assert.match(home({ daysSince: 0 }).querySelector('.home-status').textContent, /today/i);
});

test('never having trained does not render a number', () => {
  // daysSinceLastSession returns null, and null must not reach the sentence.
  const text = home({ daysSince: null }).querySelector('.home-status').textContent;
  assert.equal(/null|NaN|undefined|Infinity/.test(text), false);
});

test('the soreness map is on the home screen', () => {
  // design §6.1: flagged BEFORE generating, so it informs the first build
  // instead of rebuilding the session being looked at.
  //
  // Scoped to .soreness rather than counting the screen's buttons: the
  // calendar contributes its own, and a count over both would pass for the
  // wrong reason on a month with training in it.
  const map = home().querySelector('.soreness');
  assert.ok(map, 'no soreness map on home');
  assert.equal(map.querySelectorAll('button').length, SORENESS_JOINTS.length);
});

test('the soreness map on home reports a cycle to its caller', () => {
  // The home screen saves to the profile and re-renders; it must receive the
  // joint and the level like the session card did.
  let seen = null;
  const node = home({
    soreness: {
      joints: SORENESS_JOINTS, current: {},
      onCycle: (joint, level) => { seen = [joint, level]; }
    }
  });
  node.querySelector('.soreness').querySelectorAll('button')[0].dispatch('click');
  assert.deepEqual(seen, [SORENESS_JOINTS[0], 'sore']);
});

test('the calendar is on the home screen', () => {
  assert.ok(home().querySelector('.calendar'));
});


// --------------------------------------------------------------------------
// A past day, read-only. design-home-and-calendar.md §7.
// --------------------------------------------------------------------------

test('a read-only session still shows its work', () => {
  const node = renderSession(card(), { readOnly: true });
  assert.match(node.textContent, /Back squat/i);
});

test('a read-only session offers no reroll, no done and no undo', () => {
  const node = renderSession(card(), {
    readOnly: true, onReroll() {}, onDone() {}, onUndo() {}
  });
  const labels = buttonText(node).join(' ');
  assert.equal(/reroll/i.test(labels), false, `reroll survived: ${labels}`);
  assert.equal(/did this workout/i.test(labels), false, `done survived: ${labels}`);
  assert.equal(/undo/i.test(labels), false, `undo survived: ${labels}`);
});

test('a read-only CONFIRMED session offers no undo either', () => {
  // The confirmed branch renders a different footer; both must be suppressed.
  const node = renderSession(card({ confirmed: true }), {
    readOnly: true, onUndo() {}
  });
  assert.equal(/undo/i.test(buttonText(node).join(' ')), false);
});

test('a read-only session offers no swap even when a handler is passed', () => {
  const node = renderSession(card(), { readOnly: true, onSwap() {} });
  assert.equal(node.querySelector('.block-swap'), null);
});

test('a read-only session shows no equipment or add-move panel', () => {
  const node = renderSession(card(), {
    readOnly: true,
    equipment: { items: ['barbell'], selected: [], open: false, onToggle() {} },
    addMove: { drafts: [], issueBase: 'x', open: false, onSave() {}, onRemove() {} }
  });
  assert.equal(node.querySelector('.equipment'), null);
  assert.equal(node.querySelector('.addmove'), null);
});

test('an editable session is unaffected', () => {
  const node = renderSession(card(), { onSwap() {}, onDone() {}, onReroll() {} });
  assert.ok(node.querySelector('.block-swap'), 'swap vanished from a live card');
  assert.match(buttonText(node).join(' '), /did this workout/i);
});

test('a session card offers a way home', () => {
  let home = 0;
  const node = renderSession(card(), { onHome: () => { home++; } });
  node.querySelector('.session-home').dispatch('click');
  assert.equal(home, 1);
});

test('a read-only card still offers a way home', () => {
  // It is the ONLY way back from a past day -- suppressing it would strand him.
  const node = renderSession(card(), { readOnly: true, onHome() {} });
  assert.ok(node.querySelector('.session-home'));
});

// --------------------------------------------------------------------------
// The backup control. spec §6 "no export or import".
// --------------------------------------------------------------------------
//
// Collapsed, like the add-move panel, and for the same reason: it is a control
// he touches a handful of times a year and it must not compete with the one
// button the home screen exists for.
//
// What is asserted here is the SHAPE and the guard. The delivery cascade
// (`navigator.share` -> `<a download>` -> clipboard) is app.js's job, needs a
// real device, and no shim can honestly stand in for it.

const SUMMARY = { sessions: 47, drafts: 2, from: '2026-06-01', to: '2026-09-01',
                  hasProfile: true };

test('the backup panel is collapsed until it is asked for', () => {
  const node = backupControl({});
  assert.equal(node.tagName, 'DETAILS');
  assert.equal(node.getAttribute('open'), null);
  assert.match(node.querySelector('summary').textContent, /backup/i);
});

test('saving a backup is one tap and reports nothing else', () => {
  let called = 0;
  const node = backupControl({ onExport: () => { called += 1; } });
  node.querySelectorAll('button').find(b => /save a backup/i.test(b.textContent))
      .dispatch('click');
  assert.equal(called, 1);
});

test('a file picker is offered, restricted to JSON', () => {
  const input = backupControl({}).querySelector('input');
  assert.equal(input.getAttribute('type'), 'file');
  assert.match(input.getAttribute('accept'), /json/);
});

// The guard. Restoring destroys every session on the device, so it must never
// be reachable in one gesture from a file picker that opens on a tap.
test('choosing a file does not restore anything on its own', () => {
  let applied = 0;
  const node = backupControl({ pending: SUMMARY, onApply: () => { applied += 1; } });
  assert.equal(applied, 0, 'rendering the confirmation restored data by itself');
});

test('the confirmation names what it is about to destroy', () => {
  const node = backupControl({ pending: SUMMARY, existing: { sessions: 12 } });
  const text = node.textContent;
  assert.match(text, /47/, 'does not say how many sessions are coming in');
  assert.match(text, /12/, 'does not say how many sessions are being replaced');
  assert.match(text, /2026-06-01/);
  assert.match(text, /2026-09-01/);
  assert.match(text, /replace/i);
});

test('confirming reports it once, and only when it is confirmed', () => {
  let applied = 0;
  const node = backupControl({ pending: SUMMARY, existing: { sessions: 12 },
                               onApply: () => { applied += 1; } });
  node.querySelectorAll('button').find(b => /replace/i.test(b.textContent))
      .dispatch('click');
  assert.equal(applied, 1);
});

test('a restore can be backed out of before it happens', () => {
  let applied = 0, cancelled = 0;
  const node = backupControl({ pending: SUMMARY, existing: { sessions: 12 },
                               onApply: () => { applied += 1; },
                               onCancel: () => { cancelled += 1; } });
  node.querySelectorAll('button').find(b => /cancel/i.test(b.textContent))
      .dispatch('click');
  assert.equal(cancelled, 1);
  assert.equal(applied, 0);
});

test('with nothing chosen there is no confirm button to hit', () => {
  const node = backupControl({});
  const confirm = node.querySelectorAll('button')
    .find(b => /replace/i.test(b.textContent));
  assert.equal(confirm, undefined);
});

test('a refused file shows the reason instead of the confirmation', () => {
  const node = backupControl({ error: 'That is not a GymBuddy backup file.' });
  assert.match(node.textContent, /not a GymBuddy backup/);
  assert.equal(
    node.querySelectorAll('button').find(b => /replace/i.test(b.textContent)),
    undefined,
    'a file that was refused still offered to overwrite the history');
});

test('an empty backup still says so rather than reading as a no-op', () => {
  const node = backupControl({
    pending: { sessions: 0, drafts: 0, from: null, to: null, hasProfile: false },
    existing: { sessions: 12 }
  });
  assert.match(node.textContent, /0 session|no session/i);
});

test('the home screen carries the backup panel, below the calendar', () => {
  const node = home({ backup: {} });
  const panel = node.querySelector('.backup');
  assert.ok(panel, 'no backup panel on the home screen');
  assert.equal(panel.tagName, 'DETAILS');

  // Below the calendar, not above it. The one thing this screen is for is the
  // Generate button; a rarely-used panel must not push the month grid down.
  const kids = node.childNodes.filter(c => c.nodeType === 1);
  const cal = kids.findIndex(c => c.classList.contains('calendar'));
  const bak = kids.findIndex(c => c.classList.contains('backup'));
  assert.ok(cal >= 0 && bak > cal, `calendar at ${cal}, backup at ${bak}`);
});

test('no backup panel is rendered when the screen is not given one', () => {
  assert.equal(home().querySelector('.backup'), null);
});

// --------------------------------------------------------------------------
// Found by reviewing the rendered panel in Chrome at 320-430px, not by the
// suite. Each of these was visible on screen and invisible to every assertion
// above it.
// --------------------------------------------------------------------------

test('the file picker is labelled by something you can actually tap', () => {
  // Measured at 320/360/390/430px: the bare <input type="file"> lays out 25px
  // tall against 44px for every other control on the screen. Wrapping it in a
  // label gives the visible text a hit target and makes the row tappable, and
  // the label is then the accessible name, so the aria-label comes off --
  // semantic HTML before ARIA.
  const node = backupControl({});
  const label = node.querySelector('label');
  assert.ok(label, 'the file input has no label element');
  assert.ok(label.querySelector('input'), 'the label does not wrap the input');
  assert.match(label.textContent, /restore/i);
  assert.equal(node.querySelector('input').getAttribute('aria-label'), null,
    'aria-label duplicates the visible label and overrides it');
});

test('a refused file announces itself', () => {
  // The whole screen is re-mounted when a file is chosen, so a message that is
  // only visible is a message a screen reader never gets.
  const node = backupControl({ error: 'That is not a GymBuddy backup file.' });
  assert.equal(node.querySelector('.backup-error').getAttribute('role'), 'alert');
});

test('the destructive button does not dress as the safe one', () => {
  // "Replace everything" was rendering in --accent, the same colour as
  // "Generate today's workout" -- the most inviting thing on the screen, worn
  // by the only control that can destroy the history.
  const node = backupControl({ pending: SUMMARY, existing: { sessions: 12 } });
  const apply = node.querySelector('.backup-apply');
  assert.ok(apply.classList.contains('btn-danger'),
    'the restore button still wears the primary accent');
  const cancel = node.querySelector('.backup-cancel');
  assert.ok(!cancel.classList.contains('btn-danger'));
});

// --------------------------------------------------------------------------
// The ladder's working sets. design-architectures.md §3.3: block.reps and
// block.pct stop being true of every working set, so a card that prints only
// them would tell him to do six sets at the lightest rung.
// --------------------------------------------------------------------------

const LADDERED = {
  mode: 'load', sets: 6, reps: 4, displayMultiplier: 0.85, prRef: 'back-squat',
  architecture: 'ladder',
  setPlan: [
    { kind: 'warmup', reps: 8, pct: 0.3,  displayMultiplier: 0.3 },
    { kind: 'work', reps: 4, pct: 0.85, displayMultiplier: 0.85 },
    { kind: 'work', reps: 3, pct: 0.89, displayMultiplier: 0.89 },
    { kind: 'work', reps: 2, pct: 0.93, displayMultiplier: 0.93 },
    { kind: 'work', reps: 4, pct: 0.87, displayMultiplier: 0.87 },
    { kind: 'work', reps: 3, pct: 0.91, displayMultiplier: 0.91 },
    { kind: 'work', reps: 2, pct: 0.95, displayMultiplier: 0.95 }
  ]
};

test('a ladder prints every working rung, not just the one it leads with', () => {
  const line = workLine(LADDERED);
  for (const [reps, mult] of [[4, '0.85'], [3, '0.89'], [2, '0.93'],
                              [4, '0.87'], [3, '0.91'], [2, '0.95']]) {
    assert.match(line, new RegExp(`${reps} × ${mult.replace('.', '\.')}`),
      `the ${reps} × ${mult} rung is missing from "${line}"`);
  }
});

test('a straight block gets no working-set line -- the hero already says it', () => {
  assert.equal(workLine(RAMPED), '');
});

test('the ladder line never prints a warm-up rung as work', () => {
  assert.equal((workLine(LADDERED).match(/0\.30/g) || []).length, 0);
});
