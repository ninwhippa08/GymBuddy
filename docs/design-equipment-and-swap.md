# Design — equipment constraints and the per-block swap

Status: drafted 2026-08-27, **built and deployed 2026-08-30** as `sw.js` v9.
Built by `plan-04-equipment-and-swap.md`, tasks 1-11.

**As built, three things this document did not say.** (1) A swap takes its
load envelope off `session.rampWeek`, not off a rebuilt profile -- rebuilding
gave ramp week 0 and no ceiling, pricing a swapped block ~24% heavy on a card
whose every other block was capped, and saying nothing. The ramp is not
skippable and a swap is not an exit from it. (2) The swap control is a sibling
of the card's front face, not a child of it: the front face is itself a
`button`, and a button inside a button is not parsed, it is unwrapped.
(3) A day type is only genuinely blocked when the whole gym is excluded --
removing just the equipment one session happens to use is absorbed by tier
relaxation (§4.2) long before the fallback in §4.3 is reached.
Answers, and as of v9 closes: `design-running-programming.md` §9 (equipment
filtering, was deferred) and spec §8 / `js/app.js:4` ("the swap controls that
sit either side of it arrive in Phase 2").
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
| What does a swap return? | **Something hitting the same area** — the same pattern, not merely the same slot (§5.1). |
| A slot's pool is thin because of `tier`? | **Widen the search before giving up on the day** (§4.2). |

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
back squat lists `["barbell","rack"]` because it needs both, so losing either
one rules it out. (A deadlift lists `["barbell","plates"]` — no rack. The
arrays are per-entry and are not a fixed set; a test asserting otherwise fails
on a claim about the library rather than about the filter.)

The line goes in `eligibleFor` rather than in a pre-filtered library handed to
`generate()`, though the latter would be a smaller diff. Two reasons. Every
filter in this app lives in that one function, and the 2026-08-27 interval/tempo
bug was produced by exactly that kind of split — a rule enforced somewhere other
than where the other rules live. And a pre-filtered library destroys the
*reason* a pool emptied: the generator could no longer tell "nothing eligible
because a knee hurts" from "because there is no rack", which is precisely the
sentence §4.3 has to write.

**A specialty bar IS a barbell — added 2026-08-30, after the gym found it.**
The athlete unticked the barbell on a hypertrophy day and said nothing
happened. He was right. The squat slot came back **Safety-Bar Squat**, and the
swap control offered a **Trap-Bar Deadlift**. Five entries need a bar without
being tagged `barbell`: `safety-bar-squat`, `trap-bar-deadlift`,
`trap-bar-carry`, `landmine-push-press`, `landmine-rainbow`.

Nothing was wrong with the conjunction. The data was wrong: a trap bar and a
safety squat bar are barbells with different handles, and a landmine is a
barbell with one end in a floor sleeve. The library names them by their handle,
which is the right name for the movement and the wrong answer to "there is no
barbell here".

`rules.js EQUIPMENT_IMPLIES` carries the missing fact, read as *having X
requires having Y*, and `equipmentNeededBy` expands an entry before the filter
sees it. It is used **one way**: excluding `barbell` excludes all three
specialty bars, while excluding `trap-bar` leaves the straight bar alone. A gym
can own a barbell and no trap bar; the reverse is not a room worth modelling,
and collapsing the directions would delete the main lift. The one-way property
has its own test, so a later edit cannot quietly make it symmetric.

**The lesson is the same one §3.1 already half-states:** the filter can only be
as true as the equipment arrays. This was not a code defect and no amount of
reading `eligibleFor` would have found it — it took the athlete standing in a
gym looking at a bar the app had told him he did not need.

### 3.2 Non-negotiable equipment

Three values are never offered as missing:

| Value | Entries | Why |
|---|---|---|
| `bodyweight` | 50 | You cannot arrive without it |
| `open-space` | 33 | If there is no space there is no session |
| `wall` | 12 | Mobility work only; a room has walls |

`wall` was the arguable one. **Settled by the athlete 2026-08-27: non-negotiable.**
It appears only on cool-down stretches, so excluding it from the control costs
nothing and keeps four checkboxes from becoming five.

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
3. a required slot IS unfilled      -> retry that slot with tiers relaxed and
                                       the block flagged (§4.2)
4. still unfilled                   -> discard it, walk proposeDayType's
                                       candidates (already score-sorted,
                                       already veto-flagged) and generate the
                                       first non-vetoed day type that comes
                                       back with every required slot filled
                                       (§4.3)
5. if none can be built             -> §6.1
```

Cost is one discarded generation, which is microseconds and no I/O. The benefit
is that buildability is *defined by* the fill rather than predicted alongside
it, so the two cannot drift apart.

One change is needed to make step 2 possible: `unfilled` currently records slot
letters only (`['A']`), losing whether the slot was required. It becomes
`[{ slot: 'A', optional: false }]`. The array is consumed in one place, so the
change is contained.

### 4.2 Relax the tier before abandoning the day type

Added 2026-08-27 after the athlete rejected the premise of open question 4:
*"there should also be power moves without barbells. that does not make sense
to me. maybe a search would be better."* He was right, and the cause is the
slot rather than the library.

`power` slot B is `tier: ['primary']`. Of the 18 power-modality `hinge`/`pull-h`
entries, the only non-barbell **primary** one is `trap-bar-deadlift` — hence the
lone entry in §1.1. One tier down the library already holds exactly the
movements he expected: `kettlebell-swing`, `dumbbell-snatch`, `kettlebell-clean`.
They were never missing; `tier` hid them.

So a required slot that comes back empty is retried with **all three tiers**
before the day type is abandoned. Measured:

| Slot | Constraint | `tier` as written | all tiers |
|---|---|---|---|
| `power` B · Olympic derivative | no barbell | 1 | 4 |
| `max-strength` A · main lift | no bar/rack/plates | 0 | 3 |
| `power` B · Olympic derivative | no bar/rack/plates | 0 | 3 |
| `hypertrophy` A · primary compound | no bar/rack/plates | 1 | 30 |

This nearly empties §6.1: with tier relaxation, no strength day type reached
zero under either constraint tested.

**It is not free, and it is not silent.** `tier` carries meaning: `primary` on
a max-strength main lift means a movement worth loading for 2-5 heavy reps.
Relaxed, that slot can return a chin-up — bodyweight, so `prescribe` drops to
`mode: 'reps'` and the load line becomes an effort cue rather than a `× PR`.
That is a materially different session, and the athlete's standing rule is that
the app never substitutes silently (§1.2).

The relaxed block therefore carries a flag and says so on the card, reusing the
`rampLimited` precedent already in `blockCard` (`js/ui.js`), which prints
*"held down by the return ramp"* under the load line:

```js
block.tierRelaxed
  ? el('p', { class: 'block-note', text: 'no barbell here -- this is the closest movement available' })
  : null
```

Relaxation applies to `tier` only. `patterns`, `modality` and `zone` are never
widened: a max-strength slot must not return a mobility drill, and the whole
point of the slot is the pattern it trains.

### 4.3 The offer

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

**The swap holds the pattern, not merely the slot.** Corrected 2026-08-27: the
athlete's expectation is *"it states machine moves, I ask for a new move
because I do not have a machine move so I expect another move like one with
dumbbell that hits the same area."* Same slot does not deliver that. Six slots
carry `patterns: null` — `max-strength` B and C, `power` D, `hypertrophy` B, C
and E — and on those the slot spans **68 entries across 10 patterns**, so a
swap on a machine chest press could legitimately return a farmer's carry.

So `swapBlock` narrows the slot to the pattern of the block being replaced:

```js
const narrowed = { ...slot, patterns: [current.pattern] };
```

Alternatives available per pattern in the widest such slot (tier
secondary+accessory, modality hypertrophy):

| pattern | n | pattern | n |
|---|---|---|---|
| lunge | 10 | push-v | 7 |
| push-h | 10 | carry | 7 |
| pull-h | 9 | pull-v | 5 |
| hinge | 8 | rotate | 4 |
| squat | 7 | march | 1 |

Enough everywhere except `march`, which holds only `sled-drag` and is therefore
unswappable — reported per §5.3 rather than left as a dead control.

`pattern` is a proxy for "the same area", not a synonym. `push-h` covering both
a bench press and a push-up is exactly right; `hinge` covering both a deadlift
and a nordic curl is looser than the athlete's sentence implies. It is the best
grouping the library has and the one the whole app is built on, so it is what
the swap uses — recorded here so the looseness is a known choice rather than a
surprise.

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
| Required slot empties | §4.2 relaxation first, then §4.3 — the offer |
| No day type is buildable | §6.1 |
| Swap has no alternative | §5.3 — block unchanged, control reports it |
| Every offerable item unticked | Falls out of §6.1; not special-cased |

### 6.1 Nothing can be built

**Rare, after §4.2.** Tier relaxation left no strength day type at zero under
either constraint measured in §1.1, so this path is now the tail rather than the
common case. Still reachable: untick enough and the strength days die on empty
required slots while the running days die on `venue`. The app says so plainly and offers nothing:

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
| A relaxed slot draws the movements tier hid | `power` B under "no barbell", all tiers, contains `kettlebell-swing`, `dumbbell-snatch`, `kettlebell-clean` |
| Relaxation widens `tier` and nothing else | A relaxed `max-strength` slot never returns a mobility or isolation entry |
| A relaxed block is flagged and says so | `tierRelaxed` set, and `blockCard` renders the note |
| Relaxation is tried before the day type changes | A bar/rack/plate-free max-strength day still returns max-strength |
| A swap holds the pattern | N swaps on a `patterns: null` slot all share the replaced block's pattern |
| A swap on `march` reports rather than fails | `sled-drag` is the only entry; the block is unchanged |
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
| `js/generator.js` | one filter line; `unfilled` gains optionality; tier-relaxation retry; `swapBlock` with pattern narrowing; fallback loop |
| `js/storage.js` | `excludeEquipment` on the session record |
| `js/app.js` | constraint plumbed through `showSession`; swap handler |
| `js/ui.js` | equipment control; swap control; the offer screen; the `tierRelaxed` note (mirrors `rampLimited`) |
| `docs/spec.md` | §3.3 unchanged (profile untouched); §8 swap no longer deferred |
| `docs/design-running-programming.md` | §9 no longer deferred |

No coefficient changes. No cue changes. Coverage pools are unaffected —
`excludeEquipment` is empty at generation and the matrix measures the
unconstrained library.

---

## 10  Open questions — answered 2026-08-27

All four were put to the athlete and all four are settled. Kept with their
answers rather than deleted, because two of them changed the design.

1. **Is `wall` non-negotiable?** — **Yes.** Folded into §3.2.

2. **Should an unbuildable day type be remembered?** — **Deferred, at his
   direction:** *"maybe we can take care of this when we do that. whichever one
   makes sense."* Taking the doc's original recommendation meanwhile: **no
   memory.** The constraint lives on the record and the fallback recomputes,
   which costs one discarded generation and keeps zero extra state.

   One correction to the premise: he believed the app does not yet read history
   to recommend a day type. It has since Phase 1 — `proposeDayType` scores every
   day type by how long since it was last done, applies the CNS and soreness
   vetoes, and returns the reason string he reads each morning ("nothing like
   heavy lifting in 9 days"). §4.3's offer is that same machinery, so this
   question needs no new subsystem before it can be revisited.

3. **Should a swap cross slots?** — **No.** His expectation is a replacement
   that "hits the same area", which is *tighter* than the slot, not looser.
   Answered in §5.1: the swap narrows to the pattern of the block it replaces.
   Investigating this found a real defect in the first draft — six slots carry
   `patterns: null`, so slot-only swapping would have crossed body areas
   routinely.

4. **Do thin pools get worse under constraint?** — **The premise was wrong, and
   he called it:** *"there should also be power moves without barbells. that
   does not make sense to me."* The moves exist; `tier: ['primary']` hid them.
   Answered by §4.2's tier relaxation.

   What survives of the original concern: VARIETY is still measured against the
   **unconstrained** library, so `docs/coverage-matrix.md` cannot show that
   `power` slot B falls to one strict-tier entry without a barbell. The matrix
   is not wrong, it is answering a different question. Whether it should grow a
   constrained view belongs with the still-open §11.0 of the running design, not
   here.

---

## 11  Still open

Nothing in this design. The two items below are its neighbours, both older:

- **`docs/design-running-programming.md` §11.0** — eight pools miss VARIETY;
  exemption recommended, his call, untouched by this work.
- **`tests/coef-provenance.mjs`** — 23 of 31 `prCoef` values `[unverified]`.
  §5.2 notes the swap makes them easier to reach without making them worse.
