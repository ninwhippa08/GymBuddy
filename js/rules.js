// rules.js -- every training constant the generator uses.
//
// This file holds no logic. Each table is transcribed from a section of
// docs/programming-basis.md and carries a pointer back to it. Changing a
// training rule should mean editing one constant here, not hunting through
// generator.js.
//
// Provenance tags mirror the basis doc:
//   [verified]     confirmed against the primary source
//   [corroborated] confirmed via a practitioner summary of the primary source
//   [unverified]   could not be checked; primary text paywalled
//   [measured]     no source exists to check against; the figure comes from
//                  sweeping generated sessions. Re-derive it by sweep -- never
//                  by judgement, and never rounded up for headroom.

// --------------------------------------------------------------------------
// Vocabulary
// --------------------------------------------------------------------------

// The closed set of modality values. `templates.js` checks every slot against
// this at import time, so a typo or a half-done migration is an immediate
// error rather than a silently empty pool at the gym door.
//
// `mobility` split into two on 2026-08-23: dosing follows from the modality,
// so one value could not carry two dosing units. design 4.1, discrepancy 4.
//
// `interval` split off `tempo` on 2026-08-27 for the same reason one step
// further out: dosing follows from the modality, and interval work is dosed
// in rounds of seconds while tempo work is dosed in continuous minutes. One
// value carrying both let the tempo slot prescribe "Running Intervals, 8 min"
// and the interval slot prescribe a stair run as 7 x 60 s. design §6.2.
export const MODALITIES = Object.freeze([
  'max-strength', 'power', 'hypertrophy', 'isolation',
  'plyometric', 'sprint', 'interval', 'tempo', 'aerobic-steady',
  'mobility-dynamic', 'mobility-static'
]);

// Equipment you cannot turn up without. Offering these in the "what's missing
// today" control would be offering a way to have no session at all. `wall` is
// here by the athlete's decision, 2026-08-27: it appears only on cool-down
// stretches, so excluding it costs nothing and saves a checkbox.
// design-equipment-and-swap.md §3.2.
export const NON_NEGOTIABLE_EQUIPMENT = Object.freeze([
  'bodyweight', 'open-space', 'wall'
]);

// A specialty bar IS a barbell. A trap bar and a safety squat bar are barbells
// with different handles; a landmine is a barbell with one end in a floor
// sleeve. The library tags them by their handle, which is the right name for
// the movement and the wrong answer to "there is no barbell here".
//
// Found in the gym 2026-08-30: the athlete unticked the barbell on a
// hypertrophy day, got a Safety-Bar Squat back, and swap offered him a Trap-Bar
// Deadlift. Nothing was wrong with the filter -- the data said these movements
// do not need a bar.
//
// Read as "having X requires having Y", and used ONE WAY: excluding `barbell`
// excludes all three, while excluding `trap-bar` leaves the straight bar alone.
// A gym can own a barbell and no trap bar; the reverse is not a room worth
// modelling, and collapsing the directions would delete the main lift.
// design-equipment-and-swap.md §3.1.
// The soreness body map. spec §4.1.
//
// Head to toe, because the constant drives a figure that is read as a body --
// alphabetical order would scatter the shoulder and the scapula to opposite
// ends of a drawing where they sit a centimetre apart.
//
// This list must stay equal to the joint vocabulary the library actually
// loads, and a test asserts exactly that. A movement added later carrying an
// eleventh joint would otherwise be unreachable from the map: for a HURT joint
// that is not a cosmetic gap but a safety claim the app quietly stops keeping.
export const SORENESS_JOINTS = Object.freeze([
  'neck', 'shoulder', 'scapula', 'thoracic', 'elbow',
  'wrist', 'lumbar', 'hip', 'knee', 'ankle'
]);

// The only two the engine understands: `hurt` excludes every exercise loading
// the joint (`eligibleFor`), `sore` multiplies its weight by 0.2. A third value
// would be silently ignored by both, so the map offers no third value.
export const SORENESS_LEVELS = Object.freeze(['sore', 'hurt']);

export const EQUIPMENT_IMPLIES = Object.freeze({
  'trap-bar': Object.freeze(['barbell']),
  'safety-bar': Object.freeze(['barbell']),
  'landmine': Object.freeze(['barbell']),
  // A mini-band is a band, by the same reading: a gym that owns no bands owns
  // no mini-band either, while owning bands does not guarantee the small loop
  // the banded walks need. Added 2026-09-05 with the first mini-band entries.
  'mini-band': Object.freeze(['bands'])
});

// The three main-work tiers. Used only to widen a slot that came back EMPTY
// under an equipment constraint -- never to widen one that filled. `tier`
// ranks how central a movement is; it is not a safety rule, which is why
// widening it is an acceptable answer to "there is no barbell here".
// design-equipment-and-swap.md §4.2.
export const ALL_TIERS = Object.freeze(['primary', 'secondary', 'accessory']);

// --------------------------------------------------------------------------
// §1  Load prescription
// --------------------------------------------------------------------------

// Reps achievable at a given fraction of 1RM. Note the chart skips 11.
// Reps 1-3 [verified] against the NSCA training load chart; the rest are the
// canonical NSCA values but were not read off the chart directly [unverified].
export const REP_TO_PCT = Object.freeze({
  1: 1.00,
  2: 0.95,
  3: 0.93,
  4: 0.90,
  5: 0.87,
  6: 0.85,
  7: 0.83,
  8: 0.80,
  9: 0.77,
  10: 0.75,
  12: 0.70
});

// Training-goal zones. `pct` is a fraction of the reference max -- which max
// depends on the zone, see `reference` below. This distinction is the whole of
// discrepancy 1 in the basis doc: an Olympic lift at 80% means 80% of the clean,
// not 80% of the squat.
export const ZONES = Object.freeze({
  // [verified]
  maxStrength: Object.freeze({
    pct: [0.85, 0.95], reps: [1, 6], reference: 'own', intent: 'grind'
  }),
  // [verified]
  hypertrophy: Object.freeze({
    pct: [0.67, 0.85], reps: [6, 12], reference: 'own', intent: 'controlled'
  }),
  // [verified]
  muscularEndurance: Object.freeze({
    pct: [0.50, 0.67], reps: [12, 20], reference: 'own', intent: 'controlled'
  }),
  // [verified] -- single-effort power events, e.g. a heavy single clean
  powerSingle: Object.freeze({
    pct: [0.80, 0.90], reps: [1, 2], reference: 'own', intent: 'maximal'
  }),
  // [verified] -- multiple-effort power, the default for Oly derivatives
  powerMultiple: Object.freeze({
    pct: [0.75, 0.85], reps: [3, 5], reference: 'own', intent: 'maximal'
  }),
  // Dynamic effort. NOT an NSCA zone -- velocity-based tradition, where the
  // percentage refers to the squat or bench max being moved fast. Only valid
  // for exercises whose prRef is a slow-lift root.
  dynamicEffort: Object.freeze({
    pct: [0.40, 0.60], reps: [1, 3], reference: 'slow-lift', intent: 'maximal'
  })
});

// The generator treats a zone as a centre of mass and jitters inside it rather
// than prescribing exact percentages. The rep<->percentage relationship is
// exercise-dependent (more reps at 80% on a leg press than a bench), so the
// chart is a starting point, not a law. §1.
export const PCT_JITTER = 0.025;

// The warm-up ramp. design-mobility-and-warmup.md §4.3.
//
// A ladder is COMPUTED from these, never tabulated: the step count is
// ceil((workingPct - START) / MAX_JUMP), so a heavier working set gets more
// steps because the gap to bridge is longer, and nothing special-cases it.
export const WARMUP = Object.freeze({
  // Where every ladder starts, as a fraction of the movement's own max.
  // Ribeiro et al. 2020's effective progressive warm-up began at 40% of the
  // training load, and that load was 80% of 1RM -- a first rung at 0.32 of the
  // movement's max, two points from this. [corroborated] design §2.3, §8 q5.
  //
  // This used to read "the empty bar, for most lifters", which is arithmetic
  // that only holds if the movement's max is ~67 kg. It described a lifter the
  // athlete is not. The number was right; the reason was not.
  START: 0.30,
  // No step, and no jump into the working set, may exceed this. The sourced
  // increment band splits by body region -- 10-20% for lower-body lifts,
  // 5-10% for upper-body ones -- so one number could not be right for both.
  // 0.15 is the midpoint of the lower band; it was ABOVE the upper band
  // entirely until 2026-09-04. [corroborated] design §2.3, §8 q5.
  MAX_JUMP: 0.15,
  MAX_JUMP_UPPER: 0.10,
  // Which patterns take the upper-body band. Everything else, and anything
  // with no pattern at all, takes MAX_JUMP -- the default stays the wider one
  // so a movement the taxonomy has not classified is never over-ramped.
  UPPER_BODY_PATTERNS: Object.freeze(['push-h', 'push-v', 'pull-h', 'pull-v']),
  // Below this working load there is no ramp at all -- there is nothing to
  // bridge. The PRINCIPLE is [corroborated] -- design §2.3, "the lighter the
  // weight, the less warming up you'll need" -- but 0.50 itself is still
  // [unverified] and no source found gives a floor. Note before searching: a
  // "2017 NSCA position stand on warm-ups" putting the threshold at ~60% of
  // 1RM is returned confidently by search and DOES NOT EXIST. design §8 q5
  // records the whole dead end. Do not go looking for it again.
  FLOOR: 0.50,
  // Reps for a step, by that step's own load. Descending; first match wins.
  // [corroborated] from the 75% and 90% thresholds in design §2.3.
  REPS_BY_PCT: Object.freeze([
    Object.freeze([0.90, 1]),
    Object.freeze([0.75, 2]),
    Object.freeze([0.60, 3]),
    Object.freeze([0.45, 5]),
    Object.freeze([0.00, 8])
  ]),
  // An Olympic derivative warms up with light repetition, not with eights.
  // [corroborated] design §2.3.
  TECHNICAL_REP_CAP: 3
});

// --------------------------------------------------------------------------
// §2  Frequency and volume
// --------------------------------------------------------------------------

export const VOLUME = Object.freeze({
  // Never count days -- track a rolling window, so an irregular week cannot
  // confuse the model. §2 rule 1.
  ROLLING_WINDOW_DAYS: 7,
  // History depth the generator loads. spec §4 step 1.
  HISTORY_DAYS: 14,
  // Weekly set volume per muscle group, BY GOAL. This was a single 10 for every
  // day type, which is a hypertrophy figure standing in for training volume
  // generally -- and the two dose-responses are not the same shape. Pelland et
  // al. 2025 (67 studies, 2,058 participants) puts strength's minimum effective
  // dose at 1 weekly set, its efficient band at 1-4, and finds that beyond 5
  // more sets do not consistently add DETECTABLE strength, while hypertrophy's
  // efficient band is 5-10 and keeps paying past 20. Median study volume: 6
  // sets/week for strength against 10.5 for hypertrophy. One shared number
  // asked a max-strength day for ~2.5x the volume that buys anything.
  // basis §2 "The dose-response differs by goal" and rule 5.
  //
  // hypertrophy 10   [verified]     top of the efficient band, unchanged
  // max-strength 4   [verified]     where detectable returns stop
  // power/plyo/sprint 4 [corroborated] NO dose-response literature exists for
  //                                 power: 3-6 sets of 2-5 reps, 2-3x/week,
  //                                 quality over volume (NSCA). Bounded at
  //                                 strength, and NOT to be read as measured.
  // DEFAULT 10       [verified]     running days barely reach patternSets;
  //                                 moving them would be a claim no source
  //                                 makes, so they keep the old behaviour.
  SETS_PER_PATTERN_PER_WEEK: Object.freeze({
    DEFAULT: 10,
    hypertrophy: 10,
    'max-strength': 4,
    power: 4,
    plyometric: 4,
    sprint: 4
  }),
  // Compounds first under low frequency; isolation is what a fourth session
  // buys. §2 rule 2. Applied as a scoring penalty, not a ban.
  //
  // DELIBERATELY DORMANT since 2026-09-04, like `profile.banned`. The isolation
  // DAY TYPE was declined -- there is no `isolation` template and it is not in
  // PHASE_1_DAY_TYPES, so nothing currently reaches this line. It stays because
  // the reasoning it encodes is the reasoning that declined the day type, and
  // because a fourth weekly session would make it live again for the cost of a
  // template. spec §5. Do not "clean it up".
  ISOLATION_PROPOSAL_PENALTY: 0.25
});

// --------------------------------------------------------------------------
// Variety -- how far back "you just did this" reaches
// --------------------------------------------------------------------------

// Counted in SESSIONS, not in days, and that distinction is the whole point.
//
// fillSlot downweights a movement used recently. The set it consults used to
// be built from buildState's `recent`, which is truncated to
// VOLUME.HISTORY_DAYS (14). Measured over 200 simulated athletes x 30
// sessions at the athlete's real cadence (1-3x/week, irregular): the gap
// between consecutive sessions OF THE SAME DAY TYPE has a median of 21 days,
// and **100.0%** of those gaps are longer than 14 days. Not most. All of
// them. So the penalty never once applied to the comparison he notices --
// this squat day against the last squat day -- and 32.9% of a day type's main
// work repeated from its previous outing. "I don't want to do the same squat
// for weeks", 2026-09-04.
//
// The target was already stated in sessions and had been for months:
// SESSIONS_BEFORE_REPEAT = 16, the athlete's own preference, which
// tests/coverage.test.mjs uses to size every pool. The target was in sessions
// and the mechanism was in days; his cadence is the gap between the two.
//
// This is the THIRD instance of one bug in buildState. Two comments there
// already open with "NOT `recent`: it is truncated to VOLUME.HISTORY_DAYS" --
// hoursSince (plan-06: a day type starved for a simulated year) and
// chronicFrom (a 28-day window that was silently 14). Anything in that
// function reasoning about training HISTORY rather than training VOLUME has
// to escape the volume window, and this was the one nobody caught.
export const VARIETY = Object.freeze({
  // [measured] -- swept, not chosen. See design-library-expansion.md §12 for
  // the table: repeat rate and pool survival at N = 4, 6, 8, 12, 16.
  RECENT_SESSIONS: 8
});

// --------------------------------------------------------------------------
// §3  Return from inactivity -- the governing constraint
// --------------------------------------------------------------------------

// The 50/30/20/10 rule is a schedule of percentage REDUCTIONS against normal
// workload: week 1 cut by 50%, week 2 by 30%, week 3 by 20%, week 4 by 10%,
// each step conditional on finishing the previous week comfortably. [verified]
//
// `pctCeiling` is an interpretation, not a quotation -- the published rule
// governs conditioning volume, and turning it into a cap on prescribed
// percentage is a design decision made in this project. Week 1 is anchored to
// the ~65% 1RM the guidelines indicate for early transition work
// [corroborated]; the rest of the column is chosen to approach an open ceiling
// gradually [unverified].
//
// This table is the single most important safety feature in the app. His PRs
// are college numbers and are not currently achievable.
export const RAMP = Object.freeze([
  Object.freeze({ week: 1, volume: 0.50, pctCeiling: 0.65, workRest: 4 }),
  Object.freeze({ week: 2, volume: 0.70, pctCeiling: 0.70, workRest: 3 }),
  Object.freeze({ week: 3, volume: 0.80, pctCeiling: 0.78, workRest: null }),
  Object.freeze({ week: 4, volume: 0.90, pctCeiling: 0.85, workRest: null }),
  Object.freeze({ week: 5, volume: 1.00, pctCeiling: 0.95, workRest: null })
]);

// Weeks past the end of the table clamp to the last row.
export const RAMP_WEEKS = RAMP.length;

// --------------------------------------------------------------------------
// §4  Plyometrics -- volume in foot contacts
// --------------------------------------------------------------------------

// Steady-state guidance, per session. [unverified -- aggregated from NSCA
// guidance and practitioner sources; figures vary by author]
export const PLYO_CONTACTS_PER_SESSION = Object.freeze({
  beginner: Object.freeze([50, 100]),
  intermediate: Object.freeze([80, 120]),
  advanced: Object.freeze([100, 140])
});

// During the ramp the transition cap wins, and it is a WEEKLY budget, not a
// per-session one. The beginner band would otherwise permit a single week-1
// session at ~1.5x the whole week's sanctioned volume. [corroborated]
// See discrepancy 3 in the basis doc.
export const PLYO_TRANSITION_WEEKLY_CAP = Object.freeze({
  1: 70,
  2: 100
});

// Weeks 3-4 fall back to the per-session band scaled by the ramp volume
// multiplier; week 5+ uses the band as published.
export const PLYO_TRANSITION_LAST_WEEK = 2;

// 48-72 h between plyometric sessions. §4.
export const PLYO_RECOVERY_HOURS = 48;

// --------------------------------------------------------------------------
// §5  Sprinting -- volume in metres
// --------------------------------------------------------------------------

export const SPRINT = Object.freeze({
  // Internal budgets, estimated from prescribed reps x nominalMeters. Never
  // shown to the user as a target to hit -- spec 9.1.
  METERS_PER_SESSION: Object.freeze([200, 800]),
  METERS_PER_WEEK: Object.freeze([1000, 2000]),
  // Work:rest for an ~8 s effort is 1:12 to 1:20, i.e. 96-160 s of rest.
  WORK_REST_RATIO: Object.freeze([12, 20]),
  ASSUMED_EFFORT_SECONDS: 8,
  // Efforts at 95-100% need 48 h minimum, 72 h typical, before the next
  // sprint session. Overshooting weekly volume degrades the FIRST rep of the
  // following session, and that degraded rep is the injury window.
  RECOVERY_HOURS: 48,
  RECOVERY_HOURS_TYPICAL: 72
});

// --------------------------------------------------------------------------
// §6  Concurrent training -- ordering is enforced in §8 below
// --------------------------------------------------------------------------

// Resistance-before-endurance produced 6.91% greater lower-body dynamic
// strength gain (95% CI 1.96-11.87, p = 0.006). Within a session, lifting
// always precedes conditioning -- a hard rule, not a preference. §6.
export const LIFT_BEFORE_CONDITIONING = true;

// Where modalities are separated, >3 h apart avoids acute interference. §6.
export const MODALITY_SEPARATION_HOURS = 3;

// --------------------------------------------------------------------------
// §7  CNS load accounting
// --------------------------------------------------------------------------

// A decaying budget rather than a fixed weekly calendar, so irregular
// attendance does not break it. Bucket boundaries in hours since the session.
export const CNS_DECAY = Object.freeze([
  Object.freeze({ withinHours: 24, retained: 1.00 }),
  Object.freeze({ withinHours: 48, retained: 0.50 }),
  Object.freeze({ withinHours: 72, retained: 0.25 }),
  Object.freeze({ withinHours: Infinity, retained: 0.00 })
]);

// A high-CNS day type is vetoed while the account sits above this.
//
// [measured] 2026-08-31. The old comment ("cnsCost 1-3 over a ~6-slot
// session, a full hard day near 12-15") described load that no longer
// exists: generator.js's finalise() was summing `cnsCost` over EVERY block,
// including prep drills and cool-down stretches, and the 2026-08-24 mobility
// split turned one timed mobility block into ~9 individual drill/stretch
// blocks, every one of which carries cnsCost 1 (data audit). That roughly
// doubled cnsLoad and pinned the account above the old threshold of 8
// permanently -- from day 3 of daily use onward, every high-CNS day type was
// vetoed every day, forever (the reported bug: only aerobic-steady and
// interval were ever offered). cnsLoad now sums only blocks that
// countsTowardVolume() passes -- the same guard patternSets already used --
// so mobility drops out by mode and prep/core drop out by role, leaving only
// actual training work.
//
// Re-swept post-fix, 300 seeds/day type, `now: 1e12`: max-strength
// 5-9 (median 7), power 7-11 (median 8), plyometric 5-7 (median 6), sprint
// always 9. Range across all four: 5-11.
//
// Threshold re-derived from that range against the CNS_DECAY buckets above,
// to hit the 48-72 h spacing basis §7 requires ("Max strength, power,
// plyometrics, and sprinting all draw on the same recovery account"):
//   - MUST still veto through the 24-48 h bucket (retained 0.50) for the
//     LIGHTEST measured hard day, so no day type ever gets a repeat before
//     48 h: 5 (min load) x 0.50 = 2.5, so threshold must be < 2.5.
//   - Automatically clears by the 72 h+ bucket for every load, since
//     retained hits 0.00 there regardless of threshold -- no upper-bound
//     arithmetic needed.
// 2 is the largest integer below 2.5, and sweeping it against the buckets
// confirms both ends of the range land inside 48-72 h: lightest loads
// (plyometric, 5-7) clear at the 48 h bucket (7 x 0.25 = 1.75 <= 2); heaviest
// loads (power's 11, sprint's 9) hold through 48-72 h (11 x 0.25 = 2.75 > 2,
// 9 x 0.25 = 2.25 > 2) and clear only at 72 h+. Verified against a 21-day
// daily-open simulation: 0 back-to-back high-CNS days, and every high-CNS
// day type reappears in the rotation instead of being vetoed forever.
//
// The arithmetic above is a FLOOR, not the whole picture -- it treats the
// account as if only the most recent hard day ever contributes, but
// buildState sums decayed cnsLoad over every session in the window, of any
// day type. hypertrophy (not itself high-CNS, so never vetoed by this rule)
// measures 6-12, overlapping the high-CNS range of 5-11, so a hypertrophy
// day's decayed contribution alone can sit right at the threshold: a load-8
// hypertrophy session 48 h prior contributes 8 x 0.25 = 2.0, which is NOT
// > 2 and so does not veto by itself -- but it eats into whatever margin the
// isolated-day math above assumed, and stacks with anything else still
// decaying. Real margins are tighter than a single-session calculation
// implies. The bias only ever runs one direction: more accumulated load can
// only make a high-CNS day MORE likely to be vetoed, never less, so this
// cannot reproduce the original bug's failure mode (a permanently pinned
// veto came from double-counting a single session's own cnsLoad, not from
// cross-session accumulation, which was already correct and untouched).
// Where the neglect score stops growing, in days. `[unverified]` and NOT a
// physiological claim -- no source sets a saturation point for neglect. This
// is a product decision: without a cap, a modality abandoned for two years
// scores 730 and outranks everything for months after it comes back; with the
// cap too low, distinct gaps flatten into ties that get broken by array order
// instead of by neglect, which is exactly how plyometric went unproposed for a
// simulated year (plan-06). Was a bare `21` inline in proposeDayType with no
// name and no comment. 90 days is longer than any gap the rotation should
// shrug off and short enough that a season away does not distort the next one.
// Removing the cap entirely measures identically across 1-3x/week, the
// athlete's actual range; it is kept for the case a sweep cannot reach.
export const NEGLECT_CAP_DAYS = 90;

export const CNS_VETO_THRESHOLD = 2;

// The acute account above is a 72 h horizon and cannot see a month. This is
// the chronic one: as lifting accumulates, the low- and moderate-CNS running
// days get more attractive. A BOOST, never a veto -- if he is fresh and has
// not lifted in a week, lifting still wins on neglect.
// design-running-programming.md §7.
export const CHRONIC = Object.freeze({
  // [corroborated] -- the acute:chronic workload literature (Gabbett 2016,
  // Hulin et al. 2016) standardises on a rolling 7-day acute / 28-day chronic
  // pairing. Borrowed as a WINDOW LENGTH only: this term is a boost on
  // session selection, not an injury-risk ratio, so none of ACWR's risk
  // thresholds come with it.
  WINDOW_DAYS: 28,
  // [unverified] -- no source sets a gym-share fraction for anything like
  // this; a modality split of workload does not appear in the ACWR
  // literature, which totals load regardless of source. Chosen high so one
  // heavy week does not fire it and only a sustained lifting block does,
  // which suits attendance that swings 1-3x/week on its own.
  GYM_SHARE_TRIGGER: 0.70,
  // [unverified] -- borrowed by analogy from deloading practice (PMC9811819,
  // PMC10948666 report every 4-6 weeks and 5.6 +/- 2.3 weeks; same research
  // group, so not independent corroboration). That literature governs when a
  // LIFTER should deload, not when running should be boosted. 4 sits at the
  // low end, chosen conservatively for a returning athlete, and is fixed
  // independently by design §7.4's own worked scenario.
  WEEKS_TRIGGER: 4,
  // [unverified] -- no source for a boost magnitude exists; the term is this
  // app's own invention (design §7.2). Capped modestly so the boost-never-veto
  // rule holds: even at the cap, min(daysSince, 21) from raw neglect can still
  // dominate the score for a badly neglected day type.
  BOOST_MAX: 1.5,
  // Below this there is not enough of a month to draw a conclusion from. An
  // empty or sparse history must boost nothing at all -- §7.3 property 3.
  MIN_LOAD: 20
});

// Day types the chronic term may boost. Deliberately excludes sprint and
// plyometric: they are HIGH_CNS_DAY_TYPES and cannot serve as recovery.
export const CHRONIC_BOOSTABLE = Object.freeze(['aerobic-steady', 'interval']);

// Day types that draw on the CNS account. §7.
export const HIGH_CNS_DAY_TYPES = Object.freeze([
  'max-strength', 'power', 'plyometric', 'sprint'
]);

// --------------------------------------------------------------------------
// §8  Session ordering (fixed)
// --------------------------------------------------------------------------

// Most technical and most neurally demanding work while fresh, conditioning
// last, mobility and core to close. Derived jointly from the interference
// finding (§6) and standard practice.
export const SESSION_ORDER = Object.freeze([
  // Dynamic preparation first. It used to run last, after the lifting it was
  // meant to prepare for -- the finding with real injury relevance.
  // design 4.2, discrepancy 6.
  'prep',
  'sprint',
  'plyometric',
  'power',
  'max-strength',
  'hypertrophy',
  'isolation',
  'conditioning',
  // Static stretching and core close the session: static work impairs
  // subsequent explosive performance. [corroborated] design 2.2.
  'mobility'
]);

// Within a slot group, lead with the most technical movement. spec §4 step 10.
export const ORDER_BY_TECHNICAL_DESC = true;

// --------------------------------------------------------------------------
// §9  Mobility and core doses
// --------------------------------------------------------------------------

// Inclusive [lo, hi] ranges the generator jitters within. design 2.1, 4.2.
export const MOBILITY_DOSE = Object.freeze({
  // 3-4 drills at 10-12 reps. Deliberately does NOT scale with available time:
  // three sets of dynamic stretching induced acute fatigue and impaired sprint
  // performance within five minutes. [corroborated]
  DYNAMIC_DRILLS: Object.freeze([3, 4]),
  DYNAMIC_REPS: Object.freeze([10, 12]),

  // ACSM: 10-30 s per hold, 2-4 repetitions per muscle group. [corroborated]
  // The old block spent ~3 min on a single stretch -- 1.5-9x the source.
  STATIC_STRETCHES: Object.freeze([3, 4]),
  STATIC_HOLD_SEC: Object.freeze([20, 30]),
  STATIC_HOLD_SETS: Object.freeze([2, 2]),

  // Core. 3 sets x 10-15 reps and 30-45 s holds are [corroborated]: they sit
  // inside the dose envelope of the 31 trials pooled in Saeterbakken 2022
  // (2-4 sets, 10-25 reps, 20-60 s holds). That is the strongest claim the
  // literature supports -- no trial in that pool, and none in the 2025 core
  // meta-analyses, moderates on sets or reps at all, so there is no optimum to
  // read. Inside the range that worked, NOT the best value in it. design 8 q4,
  // closed 2026-09-03. packCooldown still trims these first, but its floor of
  // two sets is now the modal trial dose rather than an accident.
  CORE_EXERCISES: Object.freeze([2, 2]),
  CORE_SETS: Object.freeze([3, 3]),
  CORE_REPS: Object.freeze([10, 15]),
  CORE_HOLD_SEC: Object.freeze([30, 45]),
  CORE_REST_SEC: Object.freeze([30, 45])
});

// --------------------------------------------------------------------------
// §9  Time budget
// --------------------------------------------------------------------------

export const TIME = Object.freeze({
  // 70 -> 60. The whole saving comes from dosing mobility correctly; main work
  // is untouched. design 5.
  GYM_SESSION_TOTAL_MIN: 60,
  // 45 -> 50 [measured], 2026-08-31. The warm-up ramp (design-mobility-and-
  // warmup.md §4.3) is real time on the clock that packToBudget cannot trim --
  // warm-ups are the safety feature -- so it was paying for itself by shaving
  // WORKING sets instead: max-strength fell from 37,068 to 27,934 working sets
  // (75% of pre-ramp) across a 3,000-seed x 7 PHASE_1_DAY_TYPES sweep,
  // now: 1e12, no profile. The athlete was offered four measured options on
  // that same sweep and chose this one:
  //
  //   cap 45 (as shipped)      27,934 sets (75%)  max session 65 min  0% over 70
  //   cap 50 (CHOSEN)          32,600 sets (88%)  max session 70 min  0% over 70
  //   cap 52                   34,458 sets (93%)  max session 71 min  1 in 21,000 over 70
  //   warm-up trim exemption   37,068 (100%)      max session 81 min  31% of heavy days over 70
  //
  // Attribution: cap 45, cap 50 and the exemption row were measured directly,
  // by re-running the sweep against this repository. The cap 52 row is
  // carried from the controller's own comparison sweep and was not
  // independently re-run -- it is second-hand within this comment, unlike
  // the other three rows, even though all four sit under one table.
  //
  // (Cap 50's max session was first estimated at 69 min on the 3,000-seed
  // pricing sweep; the 70 above is the 10,000-seed committed-sweep figure the
  // allowance below is actually derived from, and is the one that governs.)
  //
  // Cap 52 and the trim-budget exemption were REJECTED because they breach
  // his stated <=70 min session requirement, spec.md line 36 -- do not
  // re-raise this constant past 50 without re-clearing that line with him.
  // Cap 50 buys back 88% of the pre-ramp working-set count and never exceeds
  // 70 minutes in the 10,000-seed committed sweep (see
  // FLOOR_OVERRUN_ALLOWANCE_MIN below, re-derived to match). GYM_SESSION_TOTAL_MIN
  // is unchanged -- only the main-work share of it moved.
  //
  // 50 -> 49 [measured], 2026-09-04, TO BUY BACK MARGIN THE CEILING NEVER HAD.
  // Growing the core pool 18 -> 33 (design-library-expansion.md §11) did not
  // make sessions longer -- the duration distribution barely moved, 68 min
  // 254 -> 279 sessions -- but it re-rolled WHICH seeds land in the tail, and
  // at cap 50 the tail was sitting exactly on his limit with nothing to spare.
  // One session in 70,000 came out at 71.
  //
  // That is not a fact about the new entries. It is a fact about the ceiling:
  // 70 was never ENFORCED, only OBSERVED on one sample, because prep, main
  // work and cool-down are packed against three independent budgets and
  // nothing checks their sum. In the 71-minute session all three were at their
  // limits at once -- prep 6.0 against a budget of 3, main 50.0 against a cap
  // of 50, cool-down 15.0 against a budget of 12 -- with prep and cool-down
  // over budget because their trims stop at SOURCED floors (three stretches,
  // two core sets) and both core movements drawn were unilateral, which
  // estimateMinutes doubles. Every pool this project grows re-rolls that
  // sample, so at zero margin the next authoring commit breaks the limit again.
  //
  // Re-swept at 10,000 seeds x 7 PHASE_1_DAY_TYPES, now: 1e12, against the
  // 252-entry library, one node process per cap:
  //
  //   cap 50 (was)     max 71 min   3 sessions at 70, 1 over   sets 10.48 / 15.20
  //   cap 49 (CHOSEN)  max 69 min   0 at 70, 0 over            sets 10.16 / 14.80
  //   cap 48           max 67 min   0 at 70, 0 over            sets  9.84 / 14.39
  //
  // (sets = mean working sets per session, max-strength / hypertrophy.)
  //
  // The athlete chose 49 with the cost stated first: -3.1% max-strength working
  // sets, -2.6% hypertrophy, -1.9% power, and interval, sprint and plyometric
  // unchanged. What it buys is one real minute between the worst observed
  // session and the line he set, where before there was none. The cap may be
  // lowered again on the same evidence; raising it past 49 needs the spec.md
  // line 36 conversation again, exactly as cap 52 did.
  //
  // CLOSED 2026-09-01, no change: the shared constant STAYS shared. This was
  // recorded as an open question because raising it to buy back ramped working
  // sets also gave packToBudget more room on day types that carry no ramp at
  // all. The mechanism is real and traced: aerobic-steady's only
  // VOLUME_MODES-countable block is slot B, "strides" (js/templates.js:
  // 212-218, mode: 'contacts', sets [4,6], optional: true); its primary
  // steady-run block is mode: 'time' and never reaches patternSets, so strides
  // is the only place the extra room could land. Re-measured 2026-09-01 in two
  // separate node processes -- one process cannot do it, since generator.js
  // imports rules.js unversioned and the second sweep silently reuses the
  // first cap:
  //
  //   cap 45 -> 50, 3,000 seeds, aerobic-steady
  //   full volume:  10,284 -> 13,431 stride sets (+30.6%), 69.2% -> 90.3%
  //                 of easy runs carrying strides
  //   ramp week 4:  12,401 -> 13,968 (+12.6%),            89% -> 100%
  //   easy-run length: 29.3 min in both -- the RUN did not change at all
  //
  // So the change was to FREQUENCY, not to the run: every easy day now carries
  // strides where about one in ten did not. What settles it is his cadence.
  // Walking the neglect model forward 16 weeks, committing each session the way
  // the app does: at 1x/week he gets 0.25 stride sessions per week (1.1 reps),
  // at 2-3x/week 0.50 (2.2-2.4 reps) -- because aerobic-steady only comes up
  // every few weeks at that frequency.
  //
  // Sourced norm is 4-8 strides, 1-3 times per week, 50-150 m per rep at 85-95%
  // with recovery 2-3x the rep [corroborated, practitioner sources: Runners
  // Connect, Coach Saltmarsh, COROS; the polarized-training frame from Seiler
  // via Fast Talk Labs and Stoggl & Sperlich 2014]. Strides are a neuromuscular
  // stimulus with full recovery, not a metabolic load, which is why they are
  // standard ON easy days rather than a violation of one.
  //
  // He therefore sits at 0.25-0.50 stride sessions per week against a floor of
  // 1: the raise moved him TOWARD the recommended range and nowhere near
  // through it. The block's own dose already matches the source -- 4-6 reps
  // (norm 4-8), 75 s rest (norm 2-3x a ~25-30 s rep), "about 90%, never a
  // maximal effort" (norm 85-95%). A second budget constant for non-ramped day
  // types would buy nothing and would need its own calibration. Reopen only if
  // his cadence rises far enough that aerobic-steady lands weekly.
  // The most main-work exercises a coverage-driven session may propose.
  // [measured] -- 4,000 seeds x 3 lifting day types x 3 ramp positions at
  // MAXIMUM coverage pressure (empty history = every pattern owes its full
  // target), plan-07 Task 6. Observed distribution of main-block counts:
  // 3:5965  4:3478  5:6007  6:12619  7:1413  8:6518, so 8 is the ceiling the
  // templates and the time budget actually produce.
  //
  // NOT CURRENTLY BINDING, and that is the point of measuring rather than
  // guessing: the worst session in that sweep is 70 min (power, seed 2140) and
  // it has only THREE main blocks -- time saturates long before the count
  // does. The cap exists because coverage can propose more slots than their
  // floors will fit and floors are irreducible (packToBudget cannot shave a
  // ramped block below two working sets), so without it a future change to the
  // templates or the budget could push a session past the athlete's stated
  // 70 min (spec.md:36) in a way trimming cannot rescue. If it ever starts
  // binding, LOWER IT -- never widen the limit.
  MAX_MAIN_SLOTS: 8,
  MAIN_WORK_MAX_MIN: 49,
  // Mandatory, never randomised out. Prep is capped by the drill dose rather
  // than by this figure; it is here so the three budgets can be seen to sum.
  PREP_MIN: 3,
  // Static stretches plus core. design 5 table: 25 -> 12, the whole session
  // saving. [corroborated] from the per-movement doses in MOBILITY_DOSE.
  COOLDOWN_MIN: 12,
  // The withdrawn MOBILITY_CORE_MIN: 25 lived here. It had no source -- every
  // other number in this file carries one. design discrepancy 5.
  // Running/cardio is uncapped -- prescribed by time, effort, or interval
  // structure. spec 9.1.
  CONDITIONING_MAX_MIN: null,
  // Used by the PACK step to estimate duration before trimming.
  SECONDS_PER_REP: 3,
  DEFAULT_REST_SEC: 120,
  // Rest between warm-up sets. Deliberately shorter than DEFAULT_REST_SEC: a
  // warm-up set is not taken near failure and does not need a working rest.
  // [unverified] -- design §4.3 specifies the ladder but no rest for it, and
  // no source was found. plan-05 decision 4. Tell the athlete it is a guess.
  WARMUP_REST_SEC: 60,
  TRANSITION_SEC_PER_EXERCISE: 90,
  // Mobility work has no plates to change. Using the 90 s barbell figure put
  // the 3 min prep block at 8 min. [unverified] as an exact value.
  MOBILITY_TRANSITION_SEC: 15,
  // [measured] -- not designed, not sourced from literature. design §5's
  // arithmetic (3 + 45 + 12 = 60) assumed COOLDOWN_MIN as an achievable
  // estimate, but packCooldown's own sourced floor (3 stretches, 2 core sets)
  // can sit above that 12 min budget once it has nothing left to trim. Task 6
  // swept 80,000 sampled sessions and measured a worst case of 63 min on
  // max-strength (power ties it): 45 min main work at MAIN_WORK_MAX_MIN, 3 min
  // prep at packPrep's 3-drill floor and under its own budget, 14 min
  // cool-down over its 12 min budget because packCooldown had already hit its
  // floor. This constant is that measured 3 min overrun, named so the
  // duration ceiling test can state its real tolerance instead of asserting
  // the unattainable 60. Re-derive by sweep, do not round up for headroom.
  //
  // RE-DERIVED 2026-08-24, from 3 to 4. Closing the mobility-static pool took
  // it from 7 entries to 19, and 7 of the new stretches are per-side. The
  // `sides` multiplier in estimateMinutes doubles those, so a cool-down that
  // draws several unilateral stretches now costs a minute more than the old
  // pool could reach. 40,000 deterministic sessions (4 day types x 5 ramp
  // weeks x 2,000 seeds) put the new worst case at 64 min on max-strength,
  // and only 4 sessions reach it: 63 min x38, 64 min x4.
  //
  // RE-DERIVED 2026-08-25, from 4 to 5. Closing mobility-dynamic took it from
  // 12 entries to 19, and 4 of the 7 new drills are per-side. This time the
  // overrun is the PREP block's, not the cool-down's: the worst case draws 3
  // unilateral drills out of 4 (Knee CARs, Leg Swing, Hip CARs), which the
  // `sides` multiplier doubles. 40,000 deterministic sessions put the new
  // worst case at 65 min on power/seed 7919, and exactly one session reaches
  // it: 63 min x124, 64 min x16, 65 min x1.
  // This number moves with the pool. Expect to re-derive it again as the
  // remaining pools are closed. design-library-expansion.md.
  //
  // RE-DERIVED 2026-08-31, held at 5. Task 6 priced buildWarmup's warm-up
  // ladder into estimateMinutes and packToBudget (plan-05 tasks 1-5) and
  // re-swept to confirm the allowance still covers it. Re-swept again the same
  // day after packToBudget gained the two-working-set floor for ramped blocks
  // (that floor stops the shave earlier, so it can only make sessions longer).
  // 70,000 deterministic sessions -- PHASE_1_DAY_TYPES's 7 day types x 10,000
  // seeds each, the same population and call shape as the committed sweep
  // below (no returnDate, now: 1e12) -- put the worst case at 65 min still,
  // unchanged: 56 min x3736, 57 x4598, 58 x5775, 59 x6382, 60 x6091,
  // 61 x4081, 62 x1538, 63 x318, 64 x47, 65 x6. The same six sessions reach
  // 65: max-strength/7917, max-strength/7919, power/4743, hypertrophy/7546,
  // hypertrophy/9918, interval/2348 -- so the ceiling is no longer a
  // single-day-type artifact of the prep block, it now also shows up on
  // interval. The ramp did not move the ceiling: it adds warm-up sets ahead of
  // the working sets already inside MAIN_WORK_MAX_MIN, not after the cool-down
  // or prep floors that produced the 65. Held at 5, not lowered -- see
  // plan-05-set-plan/task-6-report.md for the pre-floor tail.
  //
  // RE-DERIVED 2026-08-31, from 5 to 10. MAIN_WORK_MAX_MIN moved 45 -> 50 (see
  // its own comment above) -- a trim-budget exemption for warm-up time was
  // tried and rejected because it let some max-strength sessions reach 81 min,
  // well past the athlete's <=70 min requirement (spec.md line 36); raising
  // the main-work cap instead buys back most of the working sets while
  // keeping the ceiling inside a number he actually agreed to. Re-swept the
  // same 70,000-session population as the committed sweep below
  // (PHASE_1_DAY_TYPES x 10,000 seeds, no returnDate, now: 1e12): worst case
  // 70 min, tied across max-strength (seed 3466), power (seed 8820),
  // hypertrophy (seed 5663) and interval (seed 3580) -- five sessions out of
  // 70,000 reach it, all at exactly 70. Allowance is exactly
  // worst - GYM_SESSION_TOTAL_MIN = 70 - 60 = 10, not rounded up. 70 satisfies
  // his <=70 min requirement exactly, with no margin: this is the tightest
  // this allowance has ever sat against a stated constraint, and it is why
  // cap 52 (worst case 71, one session in 21,000) was rejected outright.
  //
  // RE-DERIVED 2026-09-04, from 10 to 9, following MAIN_WORK_MAX_MIN 50 -> 49
  // (see its comment above for the sweep and the choice). Same rule as before:
  // the allowance is exactly worst - GYM_SESSION_TOTAL_MIN, measured and not
  // rounded up, so 69 - 60 = 9. It FALLS here, which is the direction that
  // matters -- this number has only ever been allowed to move to match a
  // measurement, never to make room for one.
  //
  // The ceiling test above and the athlete's stated limit are now DIFFERENT
  // numbers again (69 vs 70) rather than the same number, which is the point:
  // the one minute between them is the margin that lets the next pool grow
  // without breaking spec.md line 36.
  //
  // RE-DERIVED 2026-09-04, from 9 to 8, on wiring packPrep into
  // generateSession. It had never been called: the cool-down was packed and
  // the prep was not, so the 3-drill floor and the 3 min budget this same
  // comment block cites at MOBILITY_TRANSITION_SEC ("3 min prep at packPrep's
  // 3-drill floor and under its own budget") were describing a packer that
  // did not run on any generated session. Four per-side drills -- packPrep's
  // own test fixture, and reachable once the 2026-08-25 pool close took
  // mobility-dynamic to 19 entries with 7 of them unilateral -- went into the
  // session unpacked and priced at roughly double.
  //
  // Same rule, same direction: re-swept the same 70,000-session population
  // (PHASE_1_DAY_TYPES x 10,000 seeds, no returnDate, now: 1e12), worst case
  // 68 min on power/seed 2149, so 68 - 60 = 8. Five sessions reach 68, 43
  // reach 67. The margin against spec.md line 36 widens from one minute to
  // two, which is what fixing an unbounded block is supposed to do.
  // RE-DERIVED 2026-09-05, from 8 to 9, on the playlist expansion that took the
  // library 258 -> 405 and the mobility pool 38 -> 134. THIS IS THE FIRST TIME
  // THIS NUMBER HAS RISEN. It has only ever fallen before (10 -> 9 -> 8), and
  // the comments above are right that falling is the direction that matters.
  // So the reason it rises is recorded here rather than left to be inferred.
  //
  // Same rule as every previous derivation, applied unchanged: the allowance is
  // exactly worst - GYM_SESSION_TOTAL_MIN, measured over the same
  // 70,000-session population (PHASE_1_DAY_TYPES x 10,000 seeds, no
  // returnDate, now: 1e12), not rounded up. Worst case 69 min on power/seed
  // 5522, so 69 - 60 = 9. It is a measurement of a library that got bigger, NOT
  // room made for one -- nothing was widened to let an entry in, and no entry
  // was authored to a length the budget then had to accommodate.
  //
  // WHAT IT COSTS, stated plainly because it is the athlete's own constraint:
  // the margin against spec.md line 36 (<=70 min, his number) falls from two
  // minutes to one. The v38 comment above called that one minute "the margin
  // that lets the next pool grow without breaking spec.md line 36", and this is
  // the pool growth it was being kept for. There is no second minute behind it.
  // The next expansion that moves this number has to buy the time back
  // somewhere -- packing the cool-down the way packPrep packs the prep is the
  // obvious candidate -- rather than spending a margin that is now gone.
  //
  // Measured twice on the way, which is why it was 9 and not 10: at 318 entries
  // (the soft-tissue rolls alone) the worst was 69, at 398 it fell back to 68
  // as more variety diluted the expensive combinations, and at 405 it was 69
  // again. A per-batch derivation would have recorded 9, then 8, then 9. The
  // number is taken once, from the finished library.
  //
  // RE-DERIVED 2026-09-05 (same day), from 9 back to 8, on the SECOND playlist
  // expansion taking the library 405 -> 458. Worst 68 min on max-strength/seed
  // 720, so 68 - 60 = 8, and the margin against spec.md line 36 goes back from
  // one minute to two. The minute borrowed a few hours earlier is returned.
  //
  // WHY IT FELL WHILE THE LIBRARY GREW, because that is the counter-intuitive
  // part and it is now observed twice. This batch is gym work -- carries,
  // chops, planks, throws, cuff work -- and added almost nothing to the prep
  // and cool-down pools that drive the long tail. The mobility pool it did not
  // grow is the one that had made 69 reachable, and every non-mobility entry
  // added since dilutes the draw further. The rule the two observations
  // support: THIS NUMBER TRACKS THE MOBILITY POOL'S COMPOSITION, NOT THE
  // LIBRARY'S SIZE. Growing the gym half is close to free in session time;
  // growing the prep half is what costs, and what to sweep before shipping.
  FLOOR_OVERRUN_ALLOWANCE_MIN: 8
});
