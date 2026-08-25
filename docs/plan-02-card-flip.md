# Card Flip Cues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a session card rotates it 180 degrees to reveal three or four setup and execution cues for that movement.

**Architecture:** `cues` becomes an optional array field on exercise entries. `app.js` passes a `cuesFor(exerciseId)` lookup into `renderSession`, which threads it to `blockCard`; a card with cues renders as a `<button>` wrapping two stacked faces that rotate on click, and a card without cues renders exactly as it does today. A hand-written DOM shim lets all of this be tested in Node for the first time.

**Tech Stack:** Vanilla ES modules, no build step, no npm. `node --test` for tests. CSS custom properties and 3D transforms.

**Spec:** `docs/design-card-flip.md`

## Global Constraints

- **No npm, no build step, no runtime dependencies.** Everything committed must be readable as-is. This is a hard project constraint.
- **Never `innerHTML`.** `js/ui.js` builds every node with `createElement` and `textContent`. See the file header comment at `js/ui.js:1-9`.
- **`js/ui.js` stays pure rendering:** data in, detached DOM nodes out. It must not read `localStorage`, generate sessions, or reach for app state. The one flip handler it owns is presentational — it toggles a class on the node it was given and touches nothing outside that card.
- **Tests run with:** `node --test tests/*.test.mjs` (the bare `tests/` directory form fails on this setup).
- **Line endings are CRLF.** Patch scripts that match on `\n` will silently fail to match.
- **Commit identity is already configured** (`ninwhippa08 <99660645+ninwhippa08@users.noreply.github.com>`). Do not change it.
- **Cue text rules:** 1–4 strings per entry, each non-empty, each ≤ 90 characters, no duplicates inside one entry.
- The pool-by-pool cue **backfill is out of scope for this plan** (design §9 step 6). This plan ships the mechanism with `CUED_POOLS` empty.

---

### Task 1: A DOM shim you can trust

`renderSession` and `blockCard` have never been tested, because Node has no DOM and this project takes no npm dependencies. This task adds the smallest DOM that `js/ui.js` actually touches.

A shim that silently returns `undefined` for an unimplemented method turns a real bug into a passing test, so anything not implemented throws.

**Files:**
- Create: `tests/dom-shim.mjs`
- Create: `tests/dom-shim.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `installDom()` — sets `globalThis.document` and returns it. `Element` instances expose `tagName`, `className`, `classList` (`add`/`remove`/`toggle`/`contains`), `textContent` (get and set), `getAttribute`/`setAttribute`/`removeAttribute`, `append`, `addEventListener`, `dispatch(type)`, `querySelector(sel)`, `querySelectorAll(sel)`. Selector support is `tag`, `.class`, and `tag.class` only.

- [ ] **Step 1: Write the failing test**

Create `tests/dom-shim.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/dom-shim.test.mjs`
Expected: FAIL — `Cannot find module ... dom-shim.mjs`.

- [ ] **Step 3: Write the shim**

Create `tests/dom-shim.mjs`:

```js
// A DOM small enough to read in one sitting.
//
// It exists because js/ui.js builds real nodes and Node has no DOM, and this
// project takes no npm dependencies. It implements exactly what ui.js's el()
// touches, plus the query helpers the tests need.
//
// NOT a substitute for a browser. This project has already been bitten once --
// a headless sweep passed clean while two real bugs sat in the code. Anything
// visual still gets looked at. design-card-flip.md §8.

class ClassList {
  constructor(node) { this.node = node; }
  _set() { return new Set(this.node.className.split(/\s+/).filter(Boolean)); }
  _write(set) { this.node.className = [...set].join(' '); }
  contains(c) { return this._set().has(c); }
  add(c) { const s = this._set(); s.add(c); this._write(s); }
  remove(c) { const s = this._set(); s.delete(c); this._write(s); }
  toggle(c, force) {
    const want = force === undefined ? !this.contains(c) : !!force;
    if (want) this.add(c); else this.remove(c);
    return want;
  }
}

class TextNode {
  constructor(text) { this.nodeType = 3; this.data = String(text); }
  get textContent() { return this.data; }
}

// 'tag', '.class', 'tag.class'. Anything else is a typo in a test, and a
// silent no-match would hide it.
function parseSelector(sel) {
  const m = /^([a-zA-Z][\w-]*)?(?:\.([\w-]+))?$/.exec(sel.trim());
  if (!m || (!m[1] && !m[2])) {
    throw new Error(`dom-shim: selector "${sel}" not implemented`);
  }
  return { tag: m[1] ? m[1].toUpperCase() : null, cls: m[2] || null };
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.attributes = {};
    this.childNodes = [];
    this.listeners = {};
    this.classList = new ClassList(this);
  }

  set textContent(v) { this.childNodes = [new TextNode(v)]; }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  // Test-only. There is no event system here, and no bubbling.
  dispatch(type) {
    for (const fn of this.listeners[type] || []) fn({ type, target: this });
  }

  append(...kids) {
    for (const k of kids) this.childNodes.push(k);
  }

  matches(sel) {
    const { tag, cls } = parseSelector(sel);
    if (tag && this.tagName !== tag) return false;
    if (cls && !this.classList.contains(cls)) return false;
    return true;
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = node => {
      for (const c of node.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) {
    const hits = this.querySelectorAll(sel);
    return hits.length ? hits[0] : null;
  }
}

// Everything ui.js might reach for that this shim does not have. Throwing is
// the whole point: an undefined return would turn a bug into a green test.
for (const name of [
  'insertAdjacentHTML', 'replaceChildren', 'remove', 'closest',
  'getBoundingClientRect', 'focus'
]) {
  Element.prototype[name] = function notImplemented() {
    throw new Error(`dom-shim: ${name} is not implemented`);
  };
}

export function installDom() {
  const document = {
    createElement: tag => new Element(tag),
    createTextNode: text => new TextNode(text)
  };
  globalThis.document = document;
  return document;
}

export { Element, TextNode };
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/dom-shim.test.mjs`
Expected: PASS, 7 tests.

Then run the whole suite to be sure nothing else moved:
Run: `node --test tests/*.test.mjs`
Expected: PASS, 54 tests (47 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add tests/dom-shim.mjs tests/dom-shim.test.mjs
git commit -m "Add a DOM shim so the rendering layer can be tested at all"
```

---

### Task 2: The cues field and its guards

The field is optional, so 186 entries without it must stay green. That means the guard has to be tested against synthetic entries — running it over a library where nothing has cues proves nothing.

**Files:**
- Create: `tests/cue-guard.mjs`
- Create: `tests/cues.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `cueProblems(entry)` → array of human-readable problem strings, empty when the entry is fine. `CUED_POOLS` → array of modality/tier names whose entries must all carry cues; starts empty.

- [ ] **Step 1: Write the failing test**

Create `tests/cues.test.mjs`:

```js
// Guards for the optional `cues` field. design-card-flip.md §3.
//
// The library has no cues yet, so running the guard across it proves nothing.
// These check the guard itself against entries built to break it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cueProblems, CUED_POOLS } from './cue-guard.mjs';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const withCues = cues => ({
  id: 'x', name: 'X', modalities: ['hypertrophy'], tier: 'primary', cues
});

test('an entry with no cues at all is fine -- the field is optional', () => {
  assert.deepEqual(cueProblems({ id: 'x', name: 'X' }), []);
});

test('one to four non-empty lines pass', () => {
  assert.deepEqual(cueProblems(withCues(['Brace, then sit between the hips.'])), []);
  assert.deepEqual(cueProblems(withCues(['a', 'b', 'c', 'd'])), []);
});

test('a paragraph instead of an array is rejected', () => {
  const p = cueProblems(withCues('Brace, then sit between the hips.'));
  assert.equal(p.length, 1);
  assert.match(p[0], /array/);
});

test('an empty array and a fifth line are both rejected', () => {
  assert.match(cueProblems(withCues([]))[0], /1-4/);
  assert.match(cueProblems(withCues(['a', 'b', 'c', 'd', 'e']))[0], /1-4/);
});

test('a blank line is rejected', () => {
  assert.match(cueProblems(withCues(['ok', '   ']))[0], /empty/);
});

test('a cue over 90 characters is rejected', () => {
  const long = 'x'.repeat(91);
  assert.match(cueProblems(withCues([long]))[0], /90/);
});

test('a duplicated cue inside one entry is rejected', () => {
  assert.match(cueProblems(withCues(['same', 'same']))[0], /duplicate/i);
});

test('the whole library passes the guard', () => {
  for (const e of LIB) {
    assert.deepEqual(cueProblems(e), [], `${e.id}: ${cueProblems(e).join('; ')}`);
  }
});

// The ratchet. design-card-flip.md §3.1.
test('every entry in a cued pool actually has cues', () => {
  for (const pool of CUED_POOLS) {
    const inPool = LIB.filter(
      e => (e.modalities || []).includes(pool) || e.tier === pool
    );
    assert.ok(inPool.length > 0, `CUED_POOLS names "${pool}" but no entry is in it`);
    for (const e of inPool) {
      assert.ok(e.cues && e.cues.length,
        `${e.id} is in cued pool "${pool}" but has no cues`);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/cues.test.mjs`
Expected: FAIL — `Cannot find module ... cue-guard.mjs`.

- [ ] **Step 3: Write the guard**

Create `tests/cue-guard.mjs`:

```js
// Rules for the optional `cues` field. design-card-flip.md §3.
//
// Test-side rather than app-side on purpose: the library is authored in this
// repo and gated by this suite, so a malformed entry can never reach a user.
// The app does not need to re-check at runtime.

export const MAX_CUE_CHARS = 90;   // what keeps the back of a card the size of the front
export const MAX_CUES = 4;

// Pools whose cues are written. Adding a line here is how a backfill commit
// becomes permanent -- an entry added to a cued pool later cannot arrive blank.
// Empty until the first backfill; this plan ships the mechanism, not the text.
export const CUED_POOLS = [];

export function cueProblems(entry) {
  const problems = [];
  if (!('cues' in entry) || entry.cues == null) return problems;   // optional

  if (!Array.isArray(entry.cues)) {
    problems.push('cues must be an array of lines, not a paragraph');
    return problems;                            // nothing else can be checked
  }
  if (entry.cues.length < 1 || entry.cues.length > MAX_CUES) {
    problems.push(`cues must hold 1-4 lines, found ${entry.cues.length}`);
  }
  entry.cues.forEach((c, i) => {
    if (typeof c !== 'string' || c.trim() === '') {
      problems.push(`cue ${i + 1} is empty`);
      return;
    }
    if (c.length > MAX_CUE_CHARS) {
      problems.push(`cue ${i + 1} is ${c.length} chars, over the ${MAX_CUE_CHARS} limit`);
    }
  });
  const seen = new Set();
  for (const c of entry.cues) {
    const k = String(c).trim().toLowerCase();
    if (seen.has(k)) problems.push(`duplicate cue: "${c}"`);
    seen.add(k);
  }
  return problems;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/cues.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the ratchet bites before trusting it**

The ratchet test passes with `CUED_POOLS` empty, which proves nothing. Check it by hand:

```bash
node -e "const f='tests/cue-guard.mjs';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('export const CUED_POOLS = [];','export const CUED_POOLS = [\'mobility-static\'];'))"
node --test tests/cues.test.mjs
# NOT git checkout -- cue-guard.mjs is untracked at this point and git would
# refuse. Put the empty list back by hand.
node -e "const f='tests/cue-guard.mjs';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/CUED_POOLS = [[^]]*]/,'CUED_POOLS = []'))"
```

Expected: the middle command FAILS with `couch-stretch is in cued pool "mobility-static" but has no cues`, then the restore puts the empty list back. If it passed, the ratchet is broken — fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add tests/cue-guard.mjs tests/cues.test.mjs
git commit -m "Add the cues field guards and the CUED_POOLS ratchet"
```

---

### Task 3: A card with cues renders two faces

**Files:**
- Modify: `js/ui.js:107-136` (`blockCard`), `js/ui.js:138-145` (`blockGroup`), `js/ui.js:152` (`renderSession` signature) and its three `blockGroup` calls
- Create: `tests/card.test.mjs`

**Interfaces:**
- Consumes: `installDom` from `tests/dom-shim.mjs`
- Produces: `blockCard(block, cuesFor)` — exported from `js/ui.js`. `cuesFor` is `(exerciseId) => string[] | null`. `renderSession(session, { onReroll, cuesFor })`.

- [ ] **Step 1: Write the failing test**

Create `tests/card.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/card.test.mjs`
Expected: FAIL — `blockCard is not a function` (it is not exported yet).

- [ ] **Step 3: Rewrite blockCard**

In `js/ui.js`, replace the whole `blockCard` function with this. Note it is now **exported**, takes `cuesFor`, and moves the existing children into a named `front`:

```js
export function blockCard(block, cuesFor) {
  const volume = volumeLine(block);

  // The effort cue is already the headline for contact-less explosive work;
  // don't print it twice.
  const heroIsEffort =
    block.mode === 'reps' || (block.mode === 'contacts' && !block.footContacts);
  const meta = [formatRest(block.restSec)];
  if (block.effort && !heroIsEffort) meta.push(block.effort);
  if (block.optional) meta.push('optional');

  const front = el('div', { class: 'block-face is-front' }, [
    el('div', { class: 'block-head' }, [
      el('h3', { class: 'block-name', text: block.name }),
      volume ? el('span', { class: 'block-volume', text: volume }) : null
    ]),
    el('p', {
      class: block.rampLimited ? 'block-load is-capped' : 'block-load',
      text: loadLine(block)
    }),
    // The ramp is not skippable and the user asked to be told when it bites.
    // basis §3, spec §9.
    block.rampLimited
      ? el('p', { class: 'block-note', text: 'held down by the return ramp' })
      : null,
    meta.filter(Boolean).length
      ? el('p', { class: 'block-meta', text: meta.filter(Boolean).join(' · ') })
      : null
  ]);

  const cues = typeof cuesFor === 'function' ? cuesFor(block.exerciseId) : null;

  // No cues yet means no flip and no affordance, rather than a card that turns
  // over to an empty back. design-card-flip.md §7.
  if (!cues || !cues.length) return el('li', { class: 'block' }, front);

  const back = el('div', { class: 'block-face is-back', 'aria-hidden': 'true' }, [
    el('h3', { class: 'block-name', text: block.name }),
    el('ul', { class: 'cue-list' }, cues.map(c => el('li', { class: 'cue', text: c })))
  ]);

  const inner = el('div', { class: 'block-inner' }, [front, back]);

  // A real button, so keyboard access costs nothing and needs no extra code.
  // It holds no interactive descendants, so the nesting is legal.
  const btn = el('button', {
    class: 'block-flip',
    type: 'button',
    'aria-pressed': 'false',
    'aria-label': `${block.name} — show cues`
  }, inner);

  // The one handler ui.js owns. It is presentational: it toggles a class on
  // the node it was just given and touches nothing outside this card, so the
  // "app.js does the wiring" rule in the file header is intact.
  btn.addEventListener('click', () => {
    const flipped = btn.classList.toggle('is-flipped');
    btn.setAttribute('aria-pressed', String(flipped));
    // backface-visibility hides a face visually and leaves it in the a11y tree
    // and the tab order, so the turned-away face is hidden explicitly.
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    btn.setAttribute('aria-label', `${block.name} — ${flipped ? 'hide' : 'show'} cues`);
  });

  return el('li', { class: 'block has-cues' }, btn);
}
```

- [ ] **Step 4: Thread cuesFor through the two callers**

In `js/ui.js`, replace `blockGroup`:

```js
function blockGroup(title, blocks, cuesFor) {
  if (!blocks.length) return null;
  return el('section', { class: 'group' }, [
    el('h2', { class: 'group-title', text: title }),
    // NOT blocks.map(blockCard) -- map passes the index as the second argument,
    // which would arrive where cuesFor belongs.
    el('ul', { class: 'block-list' }, blocks.map(b => blockCard(b, cuesFor)))
  ]);
}
```

Change the `renderSession` signature:

```js
export function renderSession(session, { onReroll, cuesFor } = {}) {
```

And its three group calls:

```js
    blockGroup('Prep', prep, cuesFor),
    blockGroup('Main work', main, cuesFor),
    blockGroup('Cool-down', cooldown, cuesFor),
```

- [ ] **Step 5: Run the card tests and watch them pass**

Run: `node --test tests/card.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the whole suite**

Run: `node --test tests/*.test.mjs`
Expected: PASS, 69 tests. The existing `ui.test.mjs` tests must still pass untouched — `loadLine` and `volumeLine` did not change.

- [ ] **Step 7: Commit**

```bash
git add js/ui.js tests/card.test.mjs
git commit -m "Render movement cues on the back of a card"
```

---

### Task 4: Flipping toggles state, visually and for a screen reader

No production change is expected here — Task 3 wrote the handler. This task proves it, and stands alone because the accessibility half is the part most likely to be quietly wrong.

**Files:**
- Modify: `tests/card.test.mjs` (append)

**Interfaces:**
- Consumes: `blockCard` from Task 3
- Produces: nothing new

- [ ] **Step 1: Write the test**

Append to `tests/card.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it**

Run: `node --test tests/card.test.mjs`
Expected: PASS, 9 tests. If any fail, the handler from Task 3 is wrong — fix `js/ui.js`, not the test.

- [ ] **Step 3: Prove the aria assertions actually bite**

A test written after the code proves nothing until you watch it fail. Break the handler on purpose:

```bash
node -e "const f='js/ui.js';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(\"back.setAttribute('aria-hidden', String(!flipped));\",'// MUTANT'))"
node --test tests/card.test.mjs
git checkout js/ui.js
```

Expected: the middle command FAILS on `flipping toggles the class and every aria attribute with it`, then `git checkout` restores it. If it passed, the test is not testing what it claims.

- [ ] **Step 4: Commit**

```bash
git add tests/card.test.mjs
git commit -m "Test that a flipped card hides the face turned away from the reader"
```

---

### Task 5: The CSS

Not unit-testable. Every claim here gets checked in a browser in Task 6.

**Files:**
- Modify: `style.css` (append after the `.block-note` rule)

**Interfaces:**
- Consumes: class names from Task 3 — `.block.has-cues`, `.block-flip`, `.block-flip.is-flipped`, `.block-inner`, `.block-face`, `.block-face.is-back`, `.cue-list`, `.cue`
- Produces: nothing consumed by later code

- [ ] **Step 1: Check which custom properties exist**

Run: `grep -n "^  --" style.css`

Expected: a list including `--surface`, `--surface-edge`, `--accent`, `--radius`, `--gap`, `--text-dim`. **Use only names that appear in that output.** If a name used below is missing, substitute the closest one that exists rather than inventing a variable — an undefined custom property silently resolves to nothing.

- [ ] **Step 2: Append the styles**

```css
/* -------------------------------------------------------------------------
   Card flip -- cues on the back. design-card-flip.md §5, §6
   ------------------------------------------------------------------------- */

/* The button owns the padding now, so the faces can carry it instead. */
.block.has-cues { padding: 0; }

.block-flip {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  /* Without a perspective the rotation reads as a horizontal squash rather
     than a card turning over. */
  perspective: 900px;
}

.block-inner {
  /* Both faces sit in ONE grid cell, so the card is as tall as the taller of
     them and the list never reflows mid-flip. Absolute positioning would clip
     the back; leaving both in normal flow would make the page jump. §5. */
  display: grid;
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
}

.block-flip.is-flipped .block-inner { transform: rotateY(180deg); }

.block-face {
  grid-area: 1 / 1;
  padding: 16px;
  backface-visibility: hidden;
}

.block-face.is-back { transform: rotateY(180deg); }

.cue-list {
  margin: 10px 0 0;
  padding-left: 1.15em;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cue {
  font-size: 0.95rem;
  line-height: 1.35;
}

/* The card is a real control now, so its focus ring has to be visible. */
.block-flip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius);
}

/* A 3D spin is a genuine vestibular trigger, and this app gets opened by
   someone who is already tired. Swap instantly instead of turning. §6. */
@media (prefers-reduced-motion: reduce) {
  .block-inner { transition: none; }
}
```

- [ ] **Step 3: Confirm nothing else broke**

Run: `node --test tests/*.test.mjs`
Expected: PASS, 72 tests. (CSS cannot break these; this is a guard against a stray edit.)

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "Style the card flip, with both faces in one grid cell"
```

---

### Task 6: Wire it up and look at it

**Files:**
- Modify: `js/app.js` (the `renderSession` call, around line 59)
- Modify: `sw.js` (cache version bump)
- Modify: `data/exercises.json` (three temporary entries, reverted within this task)

**Interfaces:**
- Consumes: `renderSession(session, { onReroll, cuesFor })` from Task 3
- Produces: nothing

- [ ] **Step 1: Wire the lookup**

In `js/app.js`, replace the `mount(root, renderSession(...))` call:

```js
  // The library is already in memory; the cues ride along with it rather than
  // being copied into every saved session. design-card-flip.md §4.
  const cuesFor = id => {
    const e = library.find(x => x.id === id);
    return e && e.cues && e.cues.length ? e.cues : null;
  };

  mount(root, renderSession(session, {
    onReroll: () => showSession({ reroll: true }),
    cuesFor
  }));
```

- [ ] **Step 2: Bump the service worker cache**

Run: `grep -n "v4" sw.js`

Edit that line to `v5`. Without this the browser serves the old `ui.js` and `style.css` from cache and none of this appears.

- [ ] **Step 3: Add temporary cues to three entries so there is something to look at**

Add a `cues` array to exactly three entries in `data/exercises.json`: `back-squat`, `couch-stretch`, and `ninety-ninety-hip-switch`. These are throwaway — they are reverted in step 7, and the real text arrives in the backfill.

For `back-squat`:

```json
"cues": [
  "Bar on the upper back, feet shoulder-width, toes slightly out.",
  "Brace hard, then sit down between the hips.",
  "Knees track over the toes; hip crease passes the knee."
]
```

For `couch-stretch`:

```json
"cues": [
  "Back foot up the wall, front foot flat and forward of the knee.",
  "Square the hips and tuck the tailbone under before leaning up.",
  "Breathe out and hold; never force it past a strong stretch."
]
```

For `ninety-ninety-hip-switch`:

```json
"cues": [
  "Sit tall, both knees bent at ninety degrees, feet wide.",
  "Rotate both knees to the other side without using your hands.",
  "Chest stays up; move from the hips, not the lower back."
]
```

Run: `node --test tests/*.test.mjs`
Expected: PASS — the guard accepts all three.

> **Trap, measured 2026-08-24.** Do NOT rewrite the file with
> `JSON.stringify(data, null, 2)`. The committed file uses a more compact
> layout, so a full re-serialise reformats all 186 entries -- a 4,621-line
> diff for three additions. Harmless here because step 7 reverts it, but the
> BACKFILL must edit entries in place or every cue commit becomes
> unreviewable.

- [ ] **Step 4: Serve the app**

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`. Hard-reload (Ctrl+Shift+R) so the new service worker takes over.

- [ ] **Step 5: Check these by eye, on a desktop browser**

Reroll until a session contains one of the three cued movements.

- [ ] a card for a cued movement shows a pointer cursor; the others do not
- [ ] clicking it turns the card over about its vertical axis — a turn, not a squash
- [ ] the back shows the movement name and the cues as separate lines
- [ ] clicking again turns it back
- [ ] **the list does not jump** when a card flips — the cards below stay put
- [ ] no cue text is clipped at the bottom of the back face
- [ ] two cards can be flipped at once, independently
- [ ] Tab reaches the cued card and shows a visible focus ring; Enter and Space both flip it
- [ ] a card with no cues is not reachable by Tab at all

- [ ] **Step 6: Check these on a phone**

Open the same URL on the phone (same wifi, the machine's LAN IP).

- [ ] the flip is smooth, not janky
- [ ] the back's text is readable at arm's length without zooming
- [ ] tapping a card does not accidentally scroll the page
- [ ] with the OS "Reduce Motion" setting on, the card swaps instantly instead of spinning

- [ ] **Step 7: Revert the temporary cues**

```bash
git checkout data/exercises.json
node --test tests/*.test.mjs
```

Expected: PASS, 72 tests, and no entry has cues. The mechanism ships empty; the text arrives in the backfill.

- [ ] **Step 8: Commit**

```bash
git add js/app.js sw.js
git commit -m "Wire cues into the session render and bump the cache to v5"
```

---

## Done means

- `node --test tests/*.test.mjs` is green at 72 tests
- every box in Task 6 steps 5 and 6 is ticked, in a real browser and on a real phone
- `data/exercises.json` is unchanged from before this plan — no cues committed
- `CUED_POOLS` is still `[]`

The next work is the backfill, one commit per pool in Project A's order, starting with `mobility-static` — and from then on every pool Project A authors arrives with its cues already written.
