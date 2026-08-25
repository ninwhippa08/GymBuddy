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
export const MODALITIES = Object.freeze([
  'max-strength', 'power', 'hypertrophy', 'isolation',
  'plyometric', 'sprint', 'interval', 'aerobic-steady',
  'mobility-dynamic', 'mobility-static'
]);

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

// --------------------------------------------------------------------------
// §2  Frequency and volume
// --------------------------------------------------------------------------

export const VOLUME = Object.freeze({
  // Never count days -- track a rolling window, so an irregular week cannot
  // confuse the model. §2 rule 1.
  ROLLING_WINDOW_DAYS: 7,
  // History depth the generator loads. spec §4 step 1.
  HISTORY_DAYS: 14,
  // 10+ sets per muscle per week produces significantly more growth than fewer
  // (Schoenfeld dose-response). An aspiration at 1-3 sessions/week, not a
  // guarantee -- see §2 rule 4 on being honest about the ceiling.
  SETS_PER_PATTERN_PER_WEEK_TARGET: 10,
  // Compounds first under low frequency; isolation is what a fourth session
  // buys. §2 rule 2. Applied as a scoring penalty, not a ban.
  ISOLATION_PROPOSAL_PENALTY: 0.25
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

// A high-CNS day type is vetoed while the account sits above this. Tuned
// against cnsCost 1-3 per exercise over a ~6-slot session: a full hard day
// lands near 12-15, so this vetoes back-to-back maximal days while still
// allowing a hard day 48 h after a moderate one.
export const CNS_VETO_THRESHOLD = 8;

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

  // Core. 3 sets x 10-15 reps is [unverified] as a specific prescription and is
  // the least-sourced number in the design -- design 8, open question 4. It is
  // also the first thing packCooldown trims, which is deliberate.
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
  MAIN_WORK_MAX_MIN: 45,
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
  // This number moves with the pool. Expect to re-derive it again as the
  // remaining pools are closed. design-library-expansion.md.
  FLOOR_OVERRUN_ALLOWANCE_MIN: 4
});
