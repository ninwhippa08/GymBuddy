# Design — movement cues on the back of the card

Status: approved 2026-08-24, built; verified in desktop Chrome at phone size
2026-08-26 (sections 3.3 and 5.1). Still owed: a real phone.
Sits before: `design-library-expansion.md` (Project A).
Reason for that order: cues are a field on every exercise. Authoring them after
the expansion would mean writing them twice for the ~76 entries Project A adds —
once at authoring, again at retrofit. Landing the field first makes cues part of
the authoring contract Project A already has to satisfy.

## 1  The feature

A session card shows what to do and how much. It does not say how to do it. For
a movement the athlete has performed for fifteen years that is fine; for a
90/90 hip switch or a scapular wall slide it is not.

Clicking a card rotates it 180 degrees about its vertical axis. The back carries
three or four short cues: how to set up, how to execute.

## 2  Content shape

Three to four lines, each a single instruction, each under ~90 characters.

```json
"cues": [
  "Bar on the upper back, feet shoulder-width, toes slightly out.",
  "Brace hard, then sit down between the hips.",
  "Knees track over the toes; hip crease passes the knee.",
  "Drive the floor away, chest staying tall."
]
```

An **array, not a paragraph**. The shape is enforced structurally rather than by
discipline, it renders as a list with no parsing, and the 90-character cap is
what keeps the back of a card the size of the front of a card (section 5).

Rejected: a full explanation with common mistakes (~120 words). It needs its own
scroll area inside a card that is already an inch tall on a phone, and it roughly
triples the authoring cost across ~260 entries. Cues are what is needed between
sets; a treatise is what is needed the first time, and that is what a video is
for.

## 3  Field and guards

`cues` is **optional**. 186 entries do not have it and the suite stays green.

Guards, as tests:

- if `cues` is present it is an array of 1–4 non-empty strings
- no cue exceeds 90 characters
- no cue is duplicated inside one entry

### 3.1 The ratchet

Optional fields rot. A `CUED_POOLS` constant lists the pools already backfilled;
a test asserts **every** entry in those pools carries cues. The list grows by one
line per backfill commit.

It **starts empty** — steps 1–5 ship the mechanism, not the content — and gains
its first entry with the first backfill commit:

```js
// Pools whose cues are written. Adding a line here is how a backfill commit
// becomes permanent -- an entry added to a cued pool later cannot arrive blank.
const CUED_POOLS = [];                          // after step 2
const CUED_POOLS = ['mobility-static'];         // after the first backfill
```

This is the same shape as the coverage matrix: a floor that only ever rises.


### 3.2 The four-cue card has never actually been rendered — noted 2026-08-25

The guard allows 1–4 cues and §2 says "three or four", so four is by design. But
until the primary-tier backfill **no entry in the library had ever carried more
than three**, and the largest back face ever rendered was 3 lines totalling 212
characters (`ruck-march`).

The backfill created **22 entries with four cues, the largest 283 characters**
(`power-clean`) — a third more text than the card back has ever been asked to
hold. `MAX_CUE_CHARS = 90` is documented as "what keeps the back of a card the
size of the front"; that reasoning was calibrated against three lines, not four.

**Nothing is known to be wrong.** The guard passes, `card.test.mjs` passes, and
the DOM shim confirms every cue renders as its own line. But the shim cannot
measure a box, and this project has been burned exactly here twice: a 600-session
headless sweep stayed green while a real browser found a mislabelled unit and a
service worker caching the previous deploy. **A layout that only a browser can
falsify has changed, so it needs a browser.**

**Added to the athlete's existing card-flip pass** — the one that already owes
keyboard (Tab / Enter / Space / focus ring) and phone verification. One extra
thing to look at: open a `power-clean` or `overhead-press` card and check the
back does not clip, scroll or grow past the front. **If it does, the fix is
trivial and needs no redesign** — drop the fourth cue on the 22 entries that
have one; every one of them was written so the first three carry the movement
and the fourth adds an expectation or a warning.

### 3.3 What the browser actually said — 2026-08-26

Run in Chrome at 375×667, device pixel ratio 2.

**The back was never the problem.** Four cues render as four lines, nothing
clips, nothing scrolls, the card is exactly as tall as its content. The grid
stack in section 5 does its job. Keyboard came back clean in the same pass:
real `<button>`, `aria-pressed` toggling, the label swapping show/hide, both
faces' `aria-hidden` swapping, a visible 2px focus ring, and Enter and Space
both operating the card.

**The front was.** Measured natural heights:

| face | height |
|---|---|
| front of a primary lift (`power-clean`, load mode) | 126px |
| back, four cues | 251px |
| back, three cues (median of the 114 that had them) | 203px |

The card took the taller face, so an **unflipped** `power-clean` was 253px tall
with 126px of it empty — the name and the load in the top half, a void in the
bottom half. It read as broken rather than as a card waiting to be turned over.
Primary lifts are the worst case because they also have the shortest fronts: no
effort line, just a name, a multiplier and a rest.

So the fear was wrong and the instinct was right — something only a browser
could have found. Two other fixes were tried in the same session and rejected on
the evidence: vertically centring the front splits one void into two and breaks
the alignment of names down the list, and tightening the cue typography only
takes the back from 251px to 219px.

Dropping the fourth cue — the fix planned above — would have taken the void
from 125px to 77px. It was not taken. It treats the symptom on 22 entries while
77px of the same void is already shipped on the 114 three-cue ones. Section 5.1
is what shipped instead.

## 4  Where the text comes from

`blockCard` receives a block, which carries `exerciseId` and `name` but no prose.
The cues are looked up at render time through a `cuesFor(exerciseId)` function
passed from `app.js`, which already holds the library in memory.

**Not denormalised into the block at generation time**, unlike the volume
counters. The counters are facts about a session that happened and must not
change afterwards. Prose is not: a cue corrected today should read correctly on a
session generated last month, and copying 40 words into every block of every
saved session to achieve the opposite is a cost with no benefit.

`ui.js` stays pure — data in, detached nodes out. A lookup argument is the same
shape as the handler arguments it already takes.

## 5  Markup and the height problem

For an entry that has cues (section 7 covers the entries that do not):

```
li.block
  button.block-flip          <- the whole card is the control
    div.block-inner          <- the element that rotates
      div.block-face.is-front
      div.block-face.is-back
```

The rotation is `transform: rotateY(180deg)` on `.block-inner`, with
`backface-visibility: hidden` on both faces and the back pre-rotated 180 degrees.

**The height problem.** Front and back have different natural heights, so the
obvious implementation makes the list jump on every flip, and absolutely
positioning the back makes the card collapse to the front's height and clip
anything longer.

Both faces are placed in **one CSS grid cell** (`grid-area: 1 / 1`). The card is
then as tall as the taller face, always. Nothing jumps and nothing clips. The
cost is a little unused height on cards whose front is short; the 90-character
cue cap keeps that small.

### 5.1 The card takes the height of the face you are looking at — 2026-08-26

The cost above turned out not to be little. Section 3.3 has the measurements: on
a primary lift the unflipped card was twice the height of the content on it.

The taller-of-the-two rule is replaced by **the height of the face turned
towards you**. The faces still share one grid cell, so neither can ever clip the
other; what changed is that **the face turned away is taken out of flow**, which
leaves the one still in flow to decide how tall the card is.

```css
.block-flip:not(.is-flipped) .block-face.is-back,
.block-flip.is-flipped   .block-face.is-front { position: absolute; top: 0; left: 0; width: 100%; }
```

That is CSS alone, and it is why the height is right on the **first paint**,
before any script has measured anything. It is also why a rotated phone needs no
help: the height is `auto`, so it re-resolves with the wrapping.

**What section 5 rejected, and why this is not that.** Section 5 chose the
taller face precisely so the list would not jump on every flip, and a height
that follows the visible face does move the cards below it. The difference is
that it *eases*. An `auto` height cannot be transitioned, so `blockCard`
pins the number the CSS would have produced — `btn.style.height` from the
visible face's `offsetHeight` — and the same 0.45s curve as the rotation carries
it. The list settles over the turn instead of snapping at the click. Under
`prefers-reduced-motion` the height transition is dropped with the rotation.

`overflow: hidden` goes on `.block-flip`, not on `.block-inner`: anything other
than `visible` on a `preserve-3d` element flattens it and the flip stops being a
flip. It matters for one moment only — mid-turn the growing face is briefly
taller than the box holding it, and at that moment the card is edge-on.

A pinned pixel height goes stale when a cue re-wraps. One `ResizeObserver` per
card, watching both faces, re-pins it — a rotated phone, a resized window, a
font arriving late. It also fires once on its own as the card is laid out, which
is what sets the first height, and there is no resize listener to remember to
remove. Node has none, so the tests take the branch that skips it.

Verified in Chrome at 375×667: first paint 126px with no inline height, the
observer then pinning 126px; flipped, 126 → 240px at 220ms → 251px settled, back
fully visible, `transform-style` still `preserve-3d` and the mid-flip matrix a
real Y rotation. Widened to 820px while flipped, the pin followed 251px → 231px
as a cue unwrapped.

## 6  Accessibility

Not optional, and two of these are the reason the card is a `button` rather than
a `div` with a click handler.

- **Keyboard.** The card is a real `<button type="button">`, so it is reachable
  and operable with no extra code. It contains no interactive descendants, so
  the nesting is legal.
- **State.** `aria-pressed` reflects the flip.
- **The hidden face.** `backface-visibility: hidden` hides a face *visually* and
  leaves it in the accessibility tree and the tab order. The face that is facing
  away therefore also carries `aria-hidden="true"`, toggled with the flip.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the rotation is
  replaced by an instant swap. A 3D spin is a genuine vestibular trigger, and
  this app is opened by someone who is already tired.
- **Label.** The button is labelled for what it does: "Back Squat — show cues".

## 7  Cards without cues do not flip

An entry with no cues yet produces a plain `li.block` with no button, no
affordance and no flip — rather than a card that flips to an empty back.

During the backfill this means some cards flip and some do not. That reads as
honest progress; eight dead flips per session reads as a broken feature.

**The backfill finished on 2026-08-26 and every entry in the library now has
cues, so in practice no card takes this branch any more.** It stays, and stays
tested. `cues` is still an optional field and the next entry authored into a
pool that is not in `CUED_POOLS` will arrive without them; a card that flips to
an empty back is exactly what this branch exists to prevent, and it costs one
`if`.

## 8  Testing

`tests/ui.test.mjs` covers only `loadLine` and `volumeLine` today, because they
are pure and `renderSession` needs a DOM that Node does not have.

A **minimal DOM shim** lands as a test utility: `createElement`, `textContent`,
`className`, `classList`, `setAttribute`, `append`, and a small `querySelector`
subset — roughly 40 lines, hand-written, no npm. It is readable in one sitting,
which is the standard this project holds its dependencies to.

What the shim makes testable:

- a card with cues renders two faces; the back carries every cue as its own node
- a card without cues renders no button and no back
- flipping toggles the class, `aria-pressed`, and `aria-hidden` on both faces
- cues reach the card through `cuesFor`, not through the block

**The shim is a supplement, not a substitute.** This project has already been
bitten once: a headless sweep passed clean while two real bugs sat in the code.
The feature is not done until it has been flipped in a real browser on a phone.

As of 2026-08-26 the browser half of that is done and is written up in
sections 3.3 and 5.1: Chrome at 375x667, which found a real defect the shim
could not see. **The phone half is still owed** -- iOS Safari rather than
Chrome, a thumb rather than a click, and `prefers-reduced-motion` turned on,
which is the one branch of section 5.1 no measurement here has exercised.

## 9  Build order

1. DOM shim + failing tests
2. `cues` field, guards, and the `CUED_POOLS` ratchet
3. flip markup and CSS, including reduced-motion and the grid stack
4. `cuesFor` wiring through `app.js`
5. browser verification, including a phone
6. backfill pool by pool, in Project A's order, `mobility-static` first
   -- **complete 2026-08-26.** All seven pools in `CUED_POOLS`; 235 of 235
   entries cued, 157 with three lines and 78 with four; longest cue 82
   characters against a cap of 90.

Steps 1–5 are one branch. Step 6 is one commit per pool and interleaves with
Project A: a pool authored by Project A arrives with its cues already written.

## 10  Open questions

1. Whether a cue set should ever carry a safety line for movements that hurt
   people when done wrong (loaded spinal flexion, plyometrics, overhead work).
   Deferred: it is additive, and the field shape already allows it.
2. Whether the back should show the movement's joints, so a sore-joint decision
   can be made from the card. Deferred to Project B, which owns soreness.
