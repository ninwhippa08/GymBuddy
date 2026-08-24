# Design — movement cues on the back of the card

Status: approved 2026-08-24, not yet implemented.
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

## 9  Build order

1. DOM shim + failing tests
2. `cues` field, guards, and the `CUED_POOLS` ratchet
3. flip markup and CSS, including reduced-motion and the grid stack
4. `cuesFor` wiring through `app.js`
5. browser verification, including a phone
6. backfill pool by pool, in Project A's order, `mobility-static` first

Steps 1–5 are one branch. Step 6 is one commit per pool and interleaves with
Project A: a pool authored by Project A arrives with its cues already written.

## 10  Open questions

1. Whether a cue set should ever carry a safety line for movements that hurt
   people when done wrong (loaded spinal flexion, plyometrics, overhead work).
   Deferred: it is additive, and the field shape already allows it.
2. Whether the back should show the movement's joints, so a sore-joint decision
   can be made from the card. Deferred to Project B, which owns soreness.
