# Programming Basis

Every rule the generator applies traces back to something in this file. If a
prescription looks wrong, the disagreement should be findable here rather than
buried in code.

**Status of sources.** Where a number came from reading the primary source, it is
cited directly. Where it came from a secondary summary because the source PDF
would not extract, it is marked *(secondary)*. Those are the ones to verify first
if something looks off.

**Verification pass, 2026-08-20.** The *(secondary)* items were re-checked
against primary sources. Results are marked inline with one of:

- **[verified]** — confirmed against the primary source directly.
- **[corroborated]** — confirmed by a practitioner summary of the primary
  source, not the source itself. Strong, but not final.
- **[unverified]** — could not be checked; the primary text is paywalled.

What that pass could and could not reach: the consensus-guidelines paper's front
matter was extracted directly from the NSCA's own PDF, but the body sits behind
Lippincott's paywall and the published PDF resists text extraction. The
week-by-week resistance-training and plyometric numbers below therefore rest on a
practitioner summary. **Three discrepancies were found — see §1, §3, and §4.**
One of them made the ramp *less* conservative than the source, in the week where
that matters most.

---

## 1. Load prescription (%1RM ↔ reps)

From the NSCA training load chart, originally Landers, J. "Maximum based on
reps," *NSCA Journal* 6(6):60–61, 1984; carried into *Essentials of Strength
Training and Conditioning*, 4th ed., Tables 17.7 and 17.9. *(secondary — chart
PDF did not extract)*

| Reps | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 |
|------|---|---|---|---|---|---|---|---|---|----|----|
| %1RM | 100 | 95 | 93 | 90 | 87 | 85 | 83 | 80 | 77 | 75 | 70 |

Training-goal zones:

| Goal | Load | Reps | Status |
|------|------|------|--------|
| Max strength | ≥ 85% | ≤ 6 | **[verified]** |
| Hypertrophy | 67–85% | 6–12 | **[verified]** |
| Muscular endurance | ≤ 67% | 12+ | **[verified]** |
| Power — single effort | 80–90% | 1–2, maximal intent | **[verified]** |
| Power — multiple effort | 75–85% | 3–5, maximal intent | **[verified]** |
| Strength-speed / dynamic effort | 40–60% | low reps, maximal intent | *(not NSCA — see below)* |

### Discrepancy 1 — the power zone was too low

The earlier draft of this file gave a single "Power / Olympic derivatives"
row at **60–80%**. The NSCA splits power into single-effort (80–90%) and
multiple-effort (75–85%) events, both **above** that range.

The 60–80% figure is not wrong so much as from a different tradition: it belongs
to dynamic-effort / velocity-based work, where the percentage refers to the
*squat or bench* 1RM being moved fast. The NSCA percentages refer to the **power
exercise's own 1RM** — a power clean at 80% of the power clean max.

**What each PR root means, recorded 2026-08-25.** Five of the six were
called unambiguous: `back-squat`, `deadlift`, `bench-press`, `overhead-press`
and `power-clean` "name exactly the lift they are". **Two have since been
confirmed with him rather than assumed, and `overhead-press` is one of them —
his PR is a STRICT standing press, no leg drive** (design §5.6). That matters
because the whole jerk ladder is priced against it. It also shows "unambiguous"
was doing more work than it earned: it was an assumption in the same clothes as
the one that turned out to be wrong about `snatch`. **`snatch` is the exception and
was ambiguous** — in weightlifting the bare word means the full squat snatch,
and the library prices `power-snatch` at parity with it, which the literature
puts at 0.88. **The athlete settled it: the `snatch` root is his POWER snatch.**
The coefficient is therefore definitional and correct. Recorded here because it
decides how much weight goes on the bar and nothing else in the repo said it.
See design-library-expansion.md §5.5.

This matters because `exercises.json` references Olympic lifts to their own PR
(`power-clean`, `snatch`, `prCoef: 1.00`). Prescribing 60–80% against those
references is materially lighter than the NSCA intends, so power days would
under-stimulate once the ramp is over. Both rows are kept: the generator should
use the NSCA power zones for Oly derivatives on `power` days, and reserve the
40–60% dynamic-effort row for speed work against squat/bench references.

Rep↔%1RM table above: the chart's distinctive structure — reps 1–10 then
jumping to 12 — and the values for 1–3 reps (100/95/93%) were confirmed
against the NSCA's published training load chart. **[verified]** The
intermediate values are the canonical NSCA figures but were not read off the
chart directly. **[unverified]**

**Caveat carried into the code.** The rep↔percentage relationship is
exercise-dependent — more reps are achievable at 80% on a leg press than a bench
press. The table is a starting point, not a law. The generator treats it as a
centre point and jitters within the zone rather than prescribing exact
percentages as if they were precise.

**Why percentages at all.** The user holds his own PRs and does the arithmetic.
The app never stores a weight. This removes the entire max-registry, e1RM-update,
and stale-number problem, and it happens to be exactly how the NSCA prescribes.

---

## 2. Frequency and volume

Training happens 1–3× per week, irregularly, driven by work schedule.

- With **volume equated**, frequencies from 1 to 9×/week showed no significant
  difference in strength gain over 6–12 weeks.
  [Grgic et al., meta-analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6081873/)
- 2 days/week produced adaptations similar to 3; hypertrophy effect sizes were
  marginally *greater* at 2.
- ACSM recommends 2–3 days/week for healthy adults.
- A single set, 1–3×/week at 70–85%, produced significant 1RM gains.
  [Minimum effective dose review](https://pubmed.ncbi.nlm.nih.gov/31797219/)
- Minimalist review: one weekly session suffices for beginners over 8–12 weeks,
  6–15 reps at 30–80% 1RM, **multi-joint movements prioritised over isolation**.
  Effectiveness beyond 12 weeks is explicitly unknown.
  [Minimalist training review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10933173/)
- Graded dose-response for hypertrophy, with **10+ sets per muscle per week**
  producing significantly more growth than fewer.
  [Schoenfeld dose-response](https://pubmed.ncbi.nlm.nih.gov/27433992/)

### Rules derived

1. **Never count days.** Track a rolling 7-day set count per movement pattern.
   An irregular week must not confuse the model.
2. **Compounds first under low frequency.** The minimalist literature is explicit.
   Isolation work is what a fourth session buys.
3. **Arms/isolation is rarely *proposed*.** Always *selectable*, but the engine
   should not spend a scarce session on it.
4. **Be honest about the ceiling.** At 1–2 sessions/week most patterns are in
   maintenance, with growth in two or three prioritised ones. The app should say
   so rather than imply otherwise.

---

## 3. Return from inactivity — the governing constraint

**[CSCCa and NSCA Joint Consensus Guidelines for Transition Periods: Safe Return
to Training Following Inactivity](https://www.nsca.com/about-us/position-statements/safe-return-to-training/)**,
*Strength & Conditioning Journal*, 2019.

These guidelines exist because injury and death cluster precisely in the
transition from inactivity back to real training. They set upper limits on
volume, intensity, and work:rest for the first 2–4 weeks back.

Headline is the **50/30/20/10 rule**. The numbers are **percentage reductions
against the athlete's normal workload**, not absolute percentages and not
compounding increases: week 1 is cut by 50%, week 2 by 30%, week 3 by 20%,
week 4 by 10% — each step conditional on the athlete being comfortable at the
end of the previous week. **[verified]**

The rule is scaled off "the uppermost volume of the conditioning program," and
applies to **conditioning and testing volume**. **[verified]**

Two schedules: a **2-week** transition for returning athletes or a new head sport
coach, and a **4-week** transition for new athletes, prolonged inactivity, or
return from EHI/ER. This app uses the **4-week** version — prolonged inactivity
is exactly the case it was written for. **[verified]**

### Why this dominates the design

The user is a retired college athlete. His PRs are **college numbers**. A
prescription of `0.90 × PR` for triples in week one is not an aggressive session;
it is an injury. The ramp is what makes percentage-of-PR programming safe without
ever asking him to enter or update a number.

### Discrepancy 2 — week 2 volume, and a week 1 ceiling that was too high

The earlier draft had two problems, one cosmetic and one that mattered.

**Volume multipliers.** The draft read 0.50 / 0.65 / 0.80 / 0.90. Derived
correctly from the reductions above, they are 0.50 / **0.70** / 0.80 / 0.90.
Weeks 1, 3, and 4 were already exact; week 2 was conservative by five points.
Corrected to 0.70 below — no reason to invent extra caution the source does
not ask for, when the source's own caution is the thing being trusted.

**The %PR ceiling.** This is the one that mattered. The draft claimed the
ceilings "err conservative deliberately" while setting **week 1 at 70%**. The
guidelines indicate resistance training in the early transition at roughly
**1–3 sets of 12 reps at 65% 1RM** **[corroborated]**. The draft's week-1
ceiling was therefore *above* the source, not below it — the claim in the file
was the reverse of the truth, in the first week back, for an athlete whose PRs
are college numbers. Week 1 is now **65%**, and the later weeks are pulled down
to approach an unrestricted ceiling more gradually.

### Ramp table (corrected)

| Week since return | Volume multiplier | %PR ceiling | Sessions/week | Work:rest |
|---|---|---|---|---|
| 1 | 0.50 | 65% | 1–3 | 1:4 |
| 2 | 0.70 | 70% | 1–3 | 1:3 |
| 3 | 0.80 | 78% | 2–4 | — |
| 4 | 0.90 | 85% | 2–4 | — |
| 5+ | 1.00 | 95% | — | — |

Frequency and work:rest columns are **[corroborated]**, from the same summary as
the 65% figure. The `Sessions/week` column is guidance the app cannot enforce —
he trains 1–3× per week by circumstance, not by prescription (§2).

**The %PR ceiling remains an interpretation, not a quotation.** The published
rule governs conditioning volume; turning it into a ceiling on prescribed
percentage is still a design decision made here. What changed is that the
week-1 value is now anchored to a real number from the guidelines rather than
chosen freely. Re-check the whole column against the paper body if it ever
becomes readable.

---

## 4. Plyometrics — volume in foot contacts

A jump cannot be expressed as a percentage. Plyometric volume is counted in
ground contacts. *(secondary — aggregated from NSCA guidance and practitioner
sources; figures vary by author)*

| Level | Contacts per session |
|---|---|
| Beginner | 50–100 |
| Intermediate | 80–120 |
| Advanced | 100–140 (up to 200 low-intensity) |

Frequency 1–3×/week, with **48–72 h between plyometric sessions**.

### Discrepancy 3 — the transition cap is lower than the beginner band

The table above is steady-state guidance. The transition guidelines impose a
tighter cap while returning: **no more than 70 foot contacts in week 1 and 100
in week 2**, for an average-sized athlete, progressing low-intensity to
high-intensity. **[corroborated]**

The conflict is real. The beginner band permits up to 100 contacts *per session*;
the transition cap allows 70 for the *entire first week*. A single generated
plyometric session in week 1 could therefore deliver about 1.5× the week's
sanctioned volume while appearing to sit inside the beginner range.

**Resolution: during the ramp, the transition cap wins, and it is a weekly
budget rather than a per-session one.**

| Week since return | Foot contacts | Basis |
|---|---|---|
| 1 | ≤ 70 per week | transition cap |
| 2 | ≤ 100 per week | transition cap |
| 3–4 | ≤ 100 per session, beginner band × ramp multiplier | §3 |
| 5+ | beginner band, progressing | table above |

Foot contacts are counted from `contactsPerRep` in `exercises.json`. Upper-body
plyometrics carry `contactsPerRep: 0` — they draw on the CNS account (§7) but
not on this budget.

---

## 5. Sprinting — volume in metres

- Efforts at 95–100% require **48 h minimum, 72 h+ typical** before the next
  sprint session.
- Work:rest for an ~8 s sprint is **1:12 to 1:20** — roughly 96–160 s of rest.
- Typical athlete volume: **1,000–2,000 m/week** of acceleration and high-speed
  work; **200–800 m per session**.
- Overshooting weekly volume degrades the *first* rep of the following session.
  That degraded first rep is the injury window.

[NSCA, Designing Speed Training Sessions](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/)

### Sprint ≠ interval conditioning

Kept as separate day types deliberately:

- **Sprint / speed** — a neural quality. Trained *fresh*, full recovery, low
  volume, measured in metres.
- **Interval conditioning** — a metabolic quality. Trained *tired*, incomplete
  recovery, measured in work:rest.

Merging them produces sessions that develop neither.

---

## 6. Concurrent training — session ordering

[Meta-analysis of intra-session exercise sequence](https://pmc.ncbi.nlm.nih.gov/articles/PMC5752732/),
10 studies, 227 subjects.

Resistance-before-endurance produced **6.91% greater lower-body dynamic strength**
gain (95% CI 1.96–11.87%, p = 0.006). No significant effect on hypertrophy
(1.15%, p = 0.40), static strength (−0.04%, p = 0.98), aerobic capacity (−0.27%,
p = 0.83), or body fat (0.68%, p = 0.42).

Where modalities are separated, **> 3 h apart** avoids acute interference.

### Rules derived

1. Within a session, **lifting always precedes conditioning**. Hard rule.
2. Splitting modalities across days is *better* than combining them — which
   independently validates the gym-day / park-day structure.

---

## 7. CNS load accounting

Max strength, power, plyometrics, and sprinting all draw on the same recovery
account. The three sources above independently converge on **48–72 h** spacing.

The generator maintains a decaying CNS budget rather than a fixed weekly
calendar, so irregular attendance does not break it:

| Time since session | Weight retained |
|---|---|
| 0–24 h | 100% |
| 24–48 h | 50% |
| 48–72 h | 25% |
| 72 h+ | 0% |

A high-CNS day type is vetoed while the account sits above threshold.

**Bug, found and fixed 2026-08-31 (`sw.js` v17).** `finalise()` summed
`cnsCost` over every block in the session, not just the ones that count as
training work — prep drills and cool-down stretches went into `cnsLoad` too.
That was harmless while the whole warm-up/cool-down was one `mode: 'time'`
block worth zero `cnsCost`, but the 2026-08-24 mobility split
(`design-mobility-and-warmup.md`) replaced it with roughly nine individual
drill/stretch blocks, and every `mobility-dynamic` and `mobility-static`
entry in `data/exercises.json` carries `cnsCost: 1`. That doubled a typical
hard day's `cnsLoad` (measured ~16–18 at the old threshold of 8, against the
doc's own description of a "full hard day" landing near 12–15) and pinned
every high-CNS day type vetoed permanently after about three days of daily
use — the account never decayed back under threshold. Fixed by moving the
`cnsLoad` accumulation inside the same `countsTowardVolume` guard
`patternSets` already uses: `VOLUME_MODES` excludes `drill`/`hold`/`time`
modes, and `role` `core`/`prep` are excluded too, so mobility and prep work
drop out the same way they always should have.

**`CNS_VETO_THRESHOLD` re-derived to 2. `[measured]`, 300 seeds per
high-CNS day type, `now: 1e12`, post-fix.** Measured `cnsLoad` range:
max-strength 5–9 (median 7), power 7–11 (median 8), plyometric 5–7
(median 6), sprint always 9. Overall range 5–11.

Deriving from the decay table above: the veto must hold through the
24–48 h bucket (retained 50%) for the *lightest* measured hard day, so no
day type can ever repeat before 48 h regardless of how light it happened to
land: `5 × 0.50 = 2.5`, so the threshold must be under 2.5. It clears
automatically by 72 h+ for every load, since retained is 0% there regardless
of threshold. **2** is the largest integer under 2.5, and checking both ends
of the measured range against it confirms the result lands inside the
required 48–72 h band: the lightest loads (plyometric, 5–7) clear at the
48 h bucket (`7 × 0.25 = 1.75 ≤ 2`), while the heaviest (power's 11, sprint's
9) hold through 48–72 h (`11 × 0.25 = 2.75 > 2`, `9 × 0.25 = 2.25 > 2`) and
clear only at 72 h+ — heavier days earning longer spacing, lighter ones
shorter, both within the sourced band.

Verified against a 21-day daily-open simulation (build history by generating
and committing one session per day): before the fix, all four high-CNS day
types were vetoed every day from day 3 onward, permanently. After, they
reappear in the rotation at roughly 4–5 day intervals with zero back-to-back
high-CNS days across the run.

---

## 8. Session ordering (fixed)

Derived jointly from the interference finding and standard practice of placing
the most technical and most neurally demanding work while fresh:

```
prep (dynamic drills)  →  sprint / plyometric  →  power  →  max strength
      →  hypertrophy  →  isolation  →  conditioning
      →  cool-down (static stretching + core)
```

### Discrepancy 6 — dynamic preparation ran after the work it prepared for

The ordering above originally placed all mobility work last, in a single block.
The interference reasoning that puts stretching at the end (§6) applies to
**static** stretching and to conditioning; it does not apply to dynamic drills.
A drill whose purpose is to prepare the athlete for the main lift cannot run
after the main lift. **[corroborated]**

**Resolution: the block splits in two. Dynamic drills become a prep block that
runs first; static stretching and core become a cool-down that runs last.**
Implemented as `SESSION_ORDER` in `rules.js`.

---

## 9. Time budget

Re-derived from per-movement doses rather than asserted. `TIME` in `rules.js`
held the same figures **as of this section's original derivation** — see the
note below the table for where that stopped being true.

| Item | Old | New | Constant |
|---|---|---|---|
| Prep block (dynamic drills) | — | 3 min | `PREP_MIN` |
| Main work | 45 min | 45 min | `MAIN_WORK_MAX_MIN` |
| Cool-down (static + core) | 25 min | 12 min | `COOLDOWN_MIN` |
| **Gym session total** | **70 min** | **60 min** | `GYM_SESSION_TOTAL_MIN` |

**Stale as of 2026-08-31: the Main work row's "New" column, 45 min, is no
longer what `MAIN_WORK_MAX_MIN` holds.** It was raised to 50 min the same day
— see discrepancy 7's addendum below and design-mobility-and-warmup.md §4.3/
§8 item 9 for why. Left as the original historical figure rather than edited
in place, the same way this file's other re-derivations (discrepancy 7's
`FLOOR_OVERRUN_ALLOWANCE_MIN` history, immediately below) are recorded as
dated addenda rather than silently overwritten. Every other row in this table
still matches `rules.js`.

Running / cardio remains **uncapped** — prescribed by distance, time, or
interval structure, not by a minute budget.

The main-work budget is unchanged. The entire saving comes from dosing the
mobility work in the unit its own source uses.

### Discrepancy 4 — the mobility block was time-dosed throughout

Static stretching is legitimately dosed by time. Dynamic drills are dosed by
repetitions, and are actively harmed by excess volume. Prescribing both by
duration made the dynamic drills wrong in **unit**, not merely in amount: a leg
swing prescribed as "3 min" is not a small error inside a correct instruction,
it is the wrong instruction. **[corroborated]**

**Resolution: the `mobility` modality splits into `mobility-dynamic` (dosed in
reps) and `mobility-static` (dosed in seconds).** See design §4.1.

### Discrepancy 5 — the ~25 minute mobility budget had no source

Every other number in this document carries a section reference and a
provenance tag. The former §9 was a bare bullet list, and its 25-minute
mobility figure traced to nothing. Re-derived from the per-movement doses
above, the real cost is 11–15 min. **The 25-minute figure is withdrawn**, and
is recorded here only so that its removal is not silent.

### Discrepancy 7 — the re-derived total is a target, not a guarantee

The arithmetic above (3 + 45 + 12 = 60) assumes the cool-down can always be
packed inside 12 min. It cannot. `packCooldown` has a sourced floor of three
static stretches and two core sets; once it has trimmed everything trimmable,
that floor can still cost up to 14 min. **[measured]**

Two independent sweeps agreed: 80,000 sampled sessions, and a separate
4,000-session deterministic sweep, both put the worst case at **63 min** — on
max-strength, with power tying it. That case is 45 min of main work at the cap,
3 min of prep at its floor, and a 14 min cool-down sitting over budget.

**Resolution: 60 min is the design target; the honest ceiling is 65 min,
carried as `FLOOR_OVERRUN_ALLOWANCE_MIN: 5`.** The allowance is measured rather
than chosen — re-derive it by sweep if either floor changes, and do not round
it up for headroom.

**Re-derived 2026-08-24: 63 → 64.** Closing the `mobility-static` pool took it
from 7 entries to 19, and 7 of the new stretches are per-side. The `sides`
multiplier in `estimateMinutes` doubles those, so a cool-down drawing several
unilateral stretches reaches a minute past what the old pool could. 40,000
deterministic sessions (4 day types × 5 ramp weeks × 2,000 seeds) put the new
worst case at 64 min on max-strength, and the tail is thin: 63 min ×38,
64 min ×4 out of 40,000.

**Re-derived 2026-08-25: 64 → 65.** Closing the `mobility-dynamic` pool took it
from 12 entries to 19, and 4 of the 7 new drills are per-side. **This time the
overrun is the prep block's, not the cool-down's** — the worst case draws three
unilateral drills out of four (Knee CARs, Leg Swing, Hip CARs) and the `sides`
multiplier doubles each. 40,000 deterministic sessions put the worst case at
65 min on power, seed 7919, and exactly one session in 40,000 reaches it:
63 min ×124, 64 min ×16, 65 min ×1.

The committed sweep in `tests/session.test.mjs` was widened from 1,000 seeds
per day type to 10,000 at the same time, because at 1,000 it never reached seed
7919 and so passed against the stale 4 min allowance. A ceiling test that cannot
reach the seed producing the ceiling is not a test; the sweep's seed count must
stay at or above the count the allowance was derived from.

**Re-derived again 2026-08-25 on closing the `core` pool: the ceiling HELD at
65 min and the allowance stays 5.** Three core entries were added and none is a
per-side hold, so the cool-down's floor cost did not move. The distribution did:
the tail thickened from 65 min ×1 to 65 min ×4 out of 40,000, and the worst case
moved from power/seed 7919 to max-strength/seed 9. Recorded because a
re-derivation that changes nothing is still a re-derivation — the rule is to
measure at every pool boundary, not only when a number is expected to move.

This is the allowance behaving as designed rather than a problem: it is a
measured consequence of the pool, and it will move again as the remaining pools
are closed. Re-derive it at each pool boundary; do not pre-emptively pad it.

**Re-derived 2026-08-31: 65 → 70 min, allowance 5 → 10 — a different
mechanism from every entry above.** Every prior re-derivation here moved the
allowance because a mobility or prep pool grew. This one moved it because the
athlete decided design-mobility-and-warmup.md §8 open question 9:
`TIME.MAIN_WORK_MAX_MIN` was raised from 45 to 50 to buy back most of the
working-set volume the warm-up ramp was displacing, after a full trim-budget
exemption was tried and rejected (it reached 81 min, breaching his stated
≤70 min requirement, spec.md line 36). Re-swept the same committed-sweep
population (7 `PHASE_1_DAY_TYPES` × 10,000 seeds, `now: 1e12`, no profile):
worst case exactly 70 min, tied across max-strength (seed 3466), power
(seed 8820), hypertrophy (seed 5663) and interval (seed 3580). Allowance is
exactly `70 − 60 = 10`, not rounded up — and it sits with zero margin against
his stated limit, tighter than any prior derivation in this history. See
`js/rules.js`'s `MAIN_WORK_MAX_MIN` and `FLOOR_OVERRUN_ALLOWANCE_MIN`
comments for the full four-option table that was priced before this was
chosen, and design-mobility-and-warmup.md §4.3/§8 item 9 for the working-set
and duration tables.

---

## Further reading

1. **NSCA, *Essentials of Strength Training and Conditioning*, 4th ed.** — the
   textbook nearly every rule above traces to. Chapters 17–19.
2. **Zatsiorsky & Kraemer, *Science and Practice of Strength Training*** — the
   theory behind why the percentages are what they are.
3. **Cal Dietz, *Triphasic Training*** — explosive/athlete focus, closest to how
   the user was originally coached.

---

## Scope limit

This file encodes published population-level guidelines. It cannot account for
one specific knee or shoulder. The transition-period paper in §3 is worth showing
to a physio or S&C coach once, because individual injury history is the one input
this application structurally cannot provide.

### Discrepancy 8 — the load coefficients were never sourced, and the rule saying they must be was never applied

`design-library-expansion.md` §8 states plainly: "A `prCoef` is a dose and
carries a provenance tag. The movement itself does not." **On 2026-08-25 that
rule had never once been applied.** All **30** coefficient claims in the library
had no provenance record of any kind — no field on the entry, nothing in any
document, nothing in the tests.

This is the project's signature failure, discrepancy 5's exact shape, sitting in
the one place it matters most. `prCoef` is the multiplier from a held PR to the
movement actually being prescribed, so a wrong coefficient does not produce a
vague instruction — **it puts the wrong weight on the bar**, against college
PRs, for an athlete returning after years off. Every value is *plausible*, which
is precisely why none of them was ever questioned.

**Eight of the thirty are above 1.00**, and those are the ones to source first,
because an error there prescribes *more* than the reference PR rather than less:

| movement | coefficient | priced off | state |
|---|---|---|---|
| ~~`split-jerk`~~ | ~~1.55~~ → **1.38** | `overhead-press` | sourced 2026-08-25 |
| ~~`push-jerk`~~ | ~~1.45~~ → **1.24** | `overhead-press` | sourced 2026-08-25 |
| ~~`push-press`~~ | ~~1.30~~ → **1.10** | `overhead-press` | sourced 2026-08-25 |
| `rack-pull` | 1.15 | `deadlift` | **blocked** — pin height unstated |
| `clean-pull` | **1.15** | `power-clean` | sourced 2026-08-25, unchanged |
| `snatch-pull` | **1.15** | `snatch` | sourced 2026-08-25, unchanged |
| `overhead-squat` | 1.10 | `snatch` | **blocked** — mobility-limited, no ratio exists |
| `trap-bar-deadlift` | **1.05** | `deadlift` | sourced 2026-08-25, unchanged |

Three further claims sit at exactly 1.00 and are easy to mistake for
definitional roots — `sumo-deadlift`, `clean-high-pull` and `power-snatch`
each assert *parity* with their reference, which is a claim like any other.

**Resolution: the debt is registered and frozen, not silently carried.**
`tests/coef-provenance.mjs` records every coefficient with its reference and a
tag, and `tests/coefficients.test.mjs` asserts four things: every claim in the
library is registered, the register names nothing that has been deleted, the
register's numbers still match the library's (a sidecar's whole risk is drift),
and the count of `unverified` coefficients never rises above the debt recorded
on the day the register was created. All thirty start `unverified` because that
is the honest state. `UNVERIFIED_BUDGET` falls as the backlog is worked off and
is never raised, so **a movement added tomorrow must arrive with a sourced
coefficient rather than joining the backlog.**

The register is test-side rather than a new schema field, for the same reason
the cue guard is: the library is authored in this repo and gated by this suite,
so a coefficient cannot reach a user without passing through it — and it keeps
Project A out of the schema, which design §2 requires.

**Not resolved: the thirty numbers themselves are still unsourced.** Registering
a debt is not paying it. This is the largest open item in the project.

**Paid down 2026-08-25 — the overhead-press ladder, and it was wrong in the
dangerous direction.** `split-jerk`, `push-jerk` and `push-press` were the first
three coefficients sourced by research rather than settled by a definition, and
**all three were overloads**: 1.55 / 1.45 / 1.30 became 1.38 / 1.24 / 1.10, a
cut of 11–15% on the weight the app would have put overhead. Two independent
derivations — a US Olympic weightlifting coach's worked ladder and a 90,000-user
dataset walked down through published programming percentages — agree to within
2% on all three rungs. Tagged `corroborated`. The full reasoning, including a
third source rejected for implying a push jerk heavier than a split jerk, is in
`design-library-expansion.md` §5.6. `UNVERIFIED_BUDGET` falls 29 → 26.

**This is the first evidence about the backlog as a whole, and it is not
reassuring.** The one prior resolution (`power-snatch`, §5.5) left its number
unchanged, which invited the reading that the values were fine and only the
paperwork was missing. Three for three in the other direction says otherwise:
these were inherited plausible-looking numbers, and plausible-looking numbers
drifted high. **The remaining five above 1.00 should be assumed high until
sourced, not assumed fine because they are believable.**

**Amended the same day, after the deadlift pair.** `trap-bar-deadlift` was
sourced and **kept its value**: three peer-reviewed 1RM comparisons put the hex
bar between 0% and 8% above the straight bar, and 1.05 sits in the middle of
that spread. So the backlog is not uniformly inflated, and the exercise is a
test the numbers can pass rather than a ritual that always ends in a change.
Four sourced, three moved, one held.

**`rack-pull` was investigated and deliberately left unsourced, which is a
result in its own right.** Its load is set by pin height, the entry does not say
where the pins go, and the joints that imply an above-knee pull are not
user-facing. A coefficient may not depend on knowledge the athlete has no way of
having. It is fixed by authoring — state the pin height, then price it — not by
more reading. Full reasoning in `design-library-expansion.md` §5.7, including
the question to ask of every coefficient still in the backlog: *does this number
assume a version of the movement the athlete cannot see?*
**Closed out 2026-08-25 — all eight above 1.00 have now been worked, and they
ended in three different states.**

| outcome | movements | what it means |
|---|---|---|
| **moved** | `split-jerk` 1.55→1.38, `push-jerk` 1.45→1.24, `push-press` 1.30→1.10 | inherited values were overloads by 11–15% |
| **held** | `trap-bar-deadlift` 1.05, `clean-pull` 1.15, `snatch-pull` 1.15 | sourced and unchanged — the evidence brackets them |
| **blocked** | `rack-pull` 1.15, `overhead-squat` 1.10 | not sourceable as posed; the obstacle is not a lack of reading |

Five of eight are now `corroborated`; `UNVERIFIED_BUDGET` falls 30 → 23.

**Three findings the exercise produced that outlive the numbers:**

1. **Half the backlog was fine.** The three that moved invited the conclusion
   that every inherited number is inflated; the three that held refute it. The
   sourcing exercise is a *test* the numbers can pass, and a project that
   assumed otherwise would rewrite good values on suspicion.
2. **Two coefficients are blocked on things reading cannot fix.** `rack-pull`
   depends on a pin height the athlete is never told; `overhead-squat` is
   mobility-limited, so no strength ratio predicts it and Everett declines to
   give one. **A coefficient may not depend on knowledge the user does not
   have, and it is the wrong instrument for a lift that strength does not
   limit.**
3. **A ratio is a fact about a population, not about two movements.** The jerk
   ladder's sources disagree by 20% and agree on everything except the
   strict-press anchor — the one rung that depends on who is lifting. Resolving
   it required knowing which population the athlete belongs to, not finding a
   better source. Expect this wherever a coefficient spans training cultures.

**What remains of discrepancy 8:** 23 coefficients, all at or below 1.00, where
an error under-prescribes rather than overloads. That is a genuinely lower
priority than the eight above — but the ratchet holds, so it cannot grow, and a
new loadable movement must still arrive sourced.

