# Design — equipment constraints and the per-block swap

Status: drafted 2026-08-27, not built.
Answers: `design-running-programming.md` §9 (equipment filtering, deferred) and
spec §8 / `js/app.js:4` ("the swap controls that sit either side of it arrive
in Phase 2").
Sits after: the running programming work, `main` at `21c4566`.

Origin: the athlete generated a session, read the cards, and said — *"I see
that I will need a barbell for my workouts. I want to specify that to the
program, and I expect to receive the same type of program that just should be
completed without a barbell."* Then, unprompted: *"what happens when I go to
the gym and the machine is broken?"* Both sentences are in this design; the
second is why there are two gestures rather than one.

---

## 1  The problem

`eligibleFor` filters venue, soreness, bans and measured ground. It has never
filtered equipment. The library carries the field — every one of the 236
entries declares an `equipment` array, 29 distinct values — and nothing reads
it. The generator will happily prescribe a sled push to a man with no sled.

The recorded decision (running design §9) was *assume full access and let the
swap path handle gaps*. That decision has now been overtaken by events twice:
the swap path was never built, and the athlete hit the gap in real use.

### 1.1 What the constraint actually costs, measured

Filtering the library and re-running every template slot at `venue: 'gym'`:

**No barbell** — library 236 → 190. Every *required* slot still fills:

| Slot | with | without |
|---|---|---|
| `max-strength` A · main lift | 21 | 5 |
| `max-strength` B · second compound | 38 | 9 |
| `max-strength` C · accessory volume | 68 | 54 |
| `power` B · Olympic derivative | 13 | **1** |
| `power` C · dynamic effort | 16 | 7 |
| `hypertrophy` A · primary compound | 16 | 6 |
| `hypertrophy` B · second compound | 36 | 18 |

The running and plyometric day types are untouched — they ask for open space
and a body.

**No barbell, rack or plates** — the hotel gym, the park:

| Slot | with | without |
|---|---|---|
| `max-strength` A · main lift | 21 | **0** |
| `power` B · Olympic derivative | 13 | **0** |

Both are `optional: false`. This is the case the design has to answer, and it
is why the feature is not merely "one more line in `eligibleFor`".

### 1.2 What the athlete settled

| Question | Answer |
|---|---|
| How long is "no barbell" true for? | **This session only.** Nothing enters the profile. |
| A required slot empties — then what? | **Say so and offer the next day type.** Never silently substitute. |
| How is the constraint expressed? | **Only the equipment this session actually asks for**, never a list of 29. |
| Is the per-block swap in scope? | **Yes**, built second, on the same machinery. |

---

## 2  Two gestures, not one

| | The athlete says | The app does | Because |
|---|---|---|---|
| **Equipment** | "there is no barbell here" | refills **every** slot from a narrowed library | it is a fact about the room |
| **Swap** | "this machine is broken" | replaces **that one block**, leaves the rest | it is a fact about one exercise |

Collapsing them would be wrong in both directions. Ticking "no machine" for one
broken leg press strips the cable row he can still do and reshuffles a session
he was happy with. Tapping "not this one" through a barbell day means tapping
once per barbell lift, because the refill keeps offering them.

They share their machinery, which is what makes the second cheap: refilling a
slot is `fillSlot` + `prescribe`, and both gestures are that pair called with a
different exclusion. Equipment narrows the library for every slot; a swap
narrows `excludeIds` for one.

---

## 3  The constraint model

### 3.1 One field, one filter line

`excludeEquipment` joins `soreness`, `banned` and `venue` in the generator's
`ctx`, and `eligibleFor` gains one line beside the others:

```js
if (excludeEquipment.length &&
    (e.equipment || []).some(q => excludeEquipment.includes(q))) return false;
```

`.some`, not `.every`: an entry's `equipment` array is a **conjunction**. A
back squat lists `["barbell","rack","plates"]` because it needs all three, so
losing any one of them rules it out.

The line goes in `eligibleFor` rather than in a pre-filtered library handed to
`generate()`, though the latter would be a smaller diff. Two reasons. Every
filter in this app lives in that one function, and the 2026-08-27 interval/tempo
bug was produced by exactly that kind of split — a rule enforced somewhere other
than where the other rules live. And a pre-filtered library destroys the
*reason* a pool emptied: the generator could no longer tell "nothing eligible
because a knee hurts" from "because there is no rack", which is precisely the
sentence §4.2 has to write.

### 3.2 Non-negotiable equipment

Three values are never offered as missing:

| Value | Entries | Why |
|---|---|---|
| `bodyweight` | 50 | You cannot arrive without it |
| `open-space` | 33 | If there is no space there is no session |
| `wall` | 12 | Mobility work only; a room has walls |

`wall` is the arguable one and is called out rather than assumed (open question
1). It appears only on cool-down stretches, so excluding it from the control
costs a hurt athlete nothing and keeps four checkboxes from becoming five.

Everything else is offerable. With those three removed, a real session asks for
**4 to 8** distinct items — measured across nine generated sessions. A typical
power day: wall, box, bench, barbell, plates, safety-bar, rack, dumbbell → six
offerable.

### 3.3 Where the constraint lives

On the committed session record, not the profile:

```json
{ "date": "2026-08-27", "dayType": "max-strength",
  "excludeEquipment": ["barbell", "rack"], "blocks": [ ... ] }
```

So it survives a reroll — the athlete does not re-tick "no barbell" every time
he rerolls in the same gym — and it is gone tomorrow, which is what "this
session only" means in practice. `loadProfile` is untouched by this design.

---

## 4  Buildability and the day-type fallback

### 4.1 Generate, then check — do not predict

The obvious move is a `buildableUnder(dayType, library, ctx)` predicate that
walks the required slots and asserts each pool is non-empty. **This design
rejects that**, because such a predicate checks each slot in isolation while
the real fill accumulates `excludeIds` as it goes: two required slots sharing a
two-entry pool would pass the predicate and still fail at fill. A second
implementation of "can this be built" that can disagree with the first is the
class of bug this project keeps producing.

Instead, use the real thing. `generate()` already records `unfilled` and
already warns `no eligible exercise for slot A`. The fallback reads that:

```
1. generate under the constraint, day type pinned
2. if no REQUIRED slot is unfilled  -> done, this is the session
3. otherwise                        -> discard it, walk proposeDayType's
                                       candidates (already score-sorted,
                                       already veto-flagged) and generate the
                                       first non-vetoed day type that comes
                                       back with every required slot filled
4. if none can be built             -> §6.1
```

Cost is one discarded generation, which is microseconds and no I/O. The benefit
is that buildability is *defined by* the fill rather than predicted alongside
it, so the two cannot drift apart.

One change is needed to make step 2 possible: `unfilled` currently records slot
letters only (`['A']`), losing whether the slot was required. It becomes
`[{ slot: 'A', optional: false }]`. The array is consumed in one place, so the
change is contained.

### 4.2 The offer

Never a silent substitution. The athlete sees what happened and chooses:

```
A max-strength day needs a barbell, and you said there isn't one.

  Plyometric instead?
  nothing like jumping in 9 days -- week 6 back, capped at 85%
                                                    [ take it ]
```

The reason string is `proposeDayType`'s own, unchanged — `reasonFor` already
produces it and it is already what the athlete reads every day. The fallback
adds one sentence in front of it and reuses the rest.

---

## 5  The swap

### 5.1 Shape

```js
export function swapBlock(session, slotId, library, ctx, rng)
```

Locates the slot definition from `TEMPLATES[session.dayType]`, adds the
rejected exercise **and every other exercise already in the session** to
`excludeIds`, then calls `fillSlot` + `prescribe` — the same pair generation
uses. The block is replaced in place; nothing else in the session moves.

`prescribe` needs `env` and `state`, which the session record does not carry.
Both are cheap to rebuild at swap time: `buildState(profile, loadHistory())`
then `envelopeFor(session.dayType, state)`. This is deliberate — recomputing
from the same inputs cannot go stale, whereas a denormalised copy of `env` on
the record could.

### 5.2 The load line changes, and that is correct

Swap Back Squat → Front Squat and the card goes from `0.72 × Back Squat PR` to
`0.61 ×`, because `prescribe` folds the new exercise's `prCoef` into
`displayMultiplier`. This is the whole reason a swap must run through
`prescribe` rather than editing the name on the card: a swapped exercise is a
new prescription, not a relabelled one.

It also means every swap reaches the coefficient debt — 23 of 31 `prCoef`
values are `[unverified]` (`tests/coef-provenance.mjs`). The swap does not make
that worse, but it does make it easier to reach.

### 5.3 Running out

A slot with two entries, asked for a third option, has nothing to give. The
swap says so and leaves the block alone. It must never return the exercise just
rejected, which is what putting the rejected id in `excludeIds` guarantees.

This will be common on the thin pools — `power` slot B under "no barbell" holds
exactly one entry (§1.1), so it is unswappable by construction. Correct, and
worth saying on the card rather than leaving the control dead.

### 5.4 Duration

A swap can change the session's estimated length; `packToBudget` ran at
generation and does not run again. Accepted rather than solved: swaps are
within-slot, so the replacement carries the same sets and reps and the drift is
seconds. Recorded so that a future swap across slot types knows it must re-pack.

---

## 6  Failure modes

| Situation | Behaviour |
|---|---|
| Optional slot empties | Skipped, as today — `unfilled` records it, nothing is said |
| Required slot empties | §4.2 — the offer |
| No day type is buildable | §6.1 |
| Swap has no alternative | §5.3 — block unchanged, control reports it |
| Every offerable item unticked | Falls out of §6.1; not special-cased |

### 6.1 Nothing can be built

Possible: untick enough and the strength days die on empty required slots while
the running days die on `venue`. The app says so plainly and offers nothing:

```
With what you've got there's no session here worth calling a session.
Untick less, or take a rest day.
```

Not an error screen — `renderError` is for a broken app, and this is the app
working correctly on a hard input.

---

## 7  UI

Two controls, deliberately unlike each other, because they do unlike things.

**Equipment** — session level, beside the existing reroll. Collapsed to one
line until tapped; expanded, the 4–8 items this session asks for, each a
checkbox, all ticked. Unticking any regenerates. The list is derived from the
session in front of him, so it is never a catalogue and never lists something
irrelevant.

**Swap** — block level, on the card. The card already flips on tap
(`design-card-flip.md`), so the swap must not steal that gesture; it is a small
control on the front face, not a tap on the body of the card. Exact affordance
deferred to implementation, where it can be seen on a phone — this document
should not invent a pixel it cannot check.

---

## 8  Testing

Behaviour first, in the house style — derived from the templates and the real
library, no hand-written pool numbers.

| Test | Asserts |
|---|---|
| `eligibleFor` honours `excludeEquipment` | A back squat is gone when `barbell` is excluded, and when `rack` is, and when `plates` is |
| The conjunction holds | Excluding only `plates` still removes the back squat |
| Non-negotiables are never offerable | The control's item list never contains `bodyweight`, `open-space`, `wall` |
| A barbell-free max-strength day still fills | Every required slot non-empty at `venue: 'gym'` — §1.1's 5, 9, 54 |
| A bar/rack/plate-free max-strength day does not | Required slot A empty, and the fallback fires |
| The fallback offers a buildable day type | The offered type generates with no required slot unfilled |
| The fallback never offers a vetoed type | Walks `candidates` respecting `vetoed` |
| A swap never returns the rejected exercise | Rejected id absent from N swaps |
| A swap never duplicates a session exercise | Swapped-in id not already in the session |
| A swap reprices | `displayMultiplier` tracks the new exercise's `prCoef` |
| A swap on a one-entry pool reports, not throws | Returns unchanged with a reason |
| The constraint survives a reroll | Same `excludeEquipment` on the regenerated record |
| The constraint does not survive the day | Tomorrow's session record has none |

---

## 9  Migration and test impact

| Change | Scale |
|---|---|
| `data/exercises.json` | none — `equipment` already on all 236 entries |
| `js/rules.js` | `NON_NEGOTIABLE_EQUIPMENT` constant |
| `js/generator.js` | one filter line; `unfilled` gains optionality; `swapBlock`; fallback loop |
| `js/storage.js` | `excludeEquipment` on the session record |
| `js/app.js` | constraint plumbed through `showSession`; swap handler |
| `js/ui.js` | equipment control; swap control; the offer screen |
| `docs/spec.md` | §3.3 unchanged (profile untouched); §8 swap no longer deferred |
| `docs/design-running-programming.md` | §9 no longer deferred |

No coefficient changes. No cue changes. Coverage pools are unaffected —
`excludeEquipment` is empty at generation and the matrix measures the
unconstrained library.

---

## 10  Open questions

1. **Is `wall` non-negotiable?** §3.2. Recommended yes; it costs an outdoor
   athlete one cool-down stretch and saves a checkbox. The athlete's call.
2. **Should an unbuildable day type be remembered?** If he unticks the barbell
   at 06:00 and the app falls back to plyometrics, then rerolls, should
   max-strength be re-offered and re-rejected? Recommended: no memory — the
   constraint is on the record and the fallback recomputes, which costs one
   discarded generation and keeps zero extra state.
3. **Should a swap be able to cross slots?** "Give me anything but a squat
   pattern today." Out of scope here; it would break §5.4's duration assumption
   and needs its own thinking.
4. **Does the thin-pool problem get worse under constraint?** `power` slot B
   holds one entry with no barbell (§1.1), so a barbell-free power day is the
   same session every time. This is §11.0 of the running design in a new place:
   VARIETY measured against the *unconstrained* library flatters pools that
   collapse under a real constraint. Not solved here; recorded because the
   matrix will not show it.
