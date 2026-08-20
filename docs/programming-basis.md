# Programming Basis

Every rule the generator applies traces back to something in this file. If a
prescription looks wrong, the disagreement should be findable here rather than
buried in code.

**Status of sources.** Where a number came from reading the primary source, it is
cited directly. Where it came from a secondary summary because the source PDF
would not extract, it is marked *(secondary)*. Those are the ones to verify first
if something looks off.

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

| Goal | Load | Reps |
|------|------|------|
| Max strength | ≥ 85% | ≤ 6 |
| Hypertrophy | 67–85% | 6–12 |
| Muscular endurance | ≤ 67% | 12+ |
| Strength-speed | 40–60% | low reps, maximal intent |
| Power / Olympic derivatives | 60–80% | 1–5, maximal intent |

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

Headline is the **50/30/20/10 rule** — week 1 at 50% of previous workload,
progressing across a four-week transition. *(secondary — paper PDF did not
extract; read the original before trusting finer detail)*

### Why this dominates the design

The user is a retired college athlete. His PRs are **college numbers**. A
prescription of `0.90 × PR` for triples in week one is not an aggressive session;
it is an injury. The ramp is what makes percentage-of-PR programming safe without
ever asking him to enter or update a number.

### Ramp table (interpretation — see caveat)

| Week since return | Volume multiplier | %PR ceiling |
|---|---|---|
| 1 | 0.50 | 70% |
| 2 | 0.65 | 75% |
| 3 | 0.80 | 82% |
| 4 | 0.90 | 87% |
| 5+ | 1.00 | 95% |

**This mapping is an interpretation, not a quotation.** The published rule
concerns workload progression; applying it as a ceiling on prescribed percentage
is a design decision made here. It errs conservative deliberately. Revisit after
reading the source paper.

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

Given detraining, the generator starts at the beginner band and progresses with
the ramp.

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

---

## 8. Session ordering (fixed)

Derived jointly from the interference finding and standard practice of placing
the most technical and most neurally demanding work while fresh:

```
sprint / plyometric  →  power  →  max strength  →  hypertrophy
      →  isolation  →  conditioning  →  mobility + core
```

---

## 9. Time budget

- Gym session: **≤ 70 min total**
- Main work: **≤ 45 min**
- Mobility + core: **~25 min, mandatory, never randomised out**
- Running / cardio: **uncapped** — prescribed by distance, time, or interval
  structure

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
