// templates.js -- day-type definitions and their slot templates.
//
// A template is a shape, not a workout. It says "slot B wants a primary-tier
// Olympic derivative in the power zone, 5-6 sets of 2-3"; the FILL step in
// generator.js decides which exercise lands there. Variety comes from that
// choice plus the ranges below, not from having many templates. spec §4.3.
//
// Slot fields:
//   tier      eligible tiers, in preference order
//   patterns  eligible movement patterns; null means "any"
//   modality  which pool to filter exercises by -- an exercise is eligible
//             only if its `modalities` array contains this value
//   zone      key into ZONES in rules.js, or null when the slot is not
//             prescribed as a percentage
//   mode      how the slot is prescribed:
//               'load'     sets x reps at a % of a PR
//               'contacts' sets x reps, counted as foot contacts
//               'time'     duration and an effort word (terrain-agnostic, 9.1)
//   sets/reps inclusive [min, max] ranges the generator jitters within
//   restSec   inclusive [min, max] range
//   optional  the PACK step drops these first when trimming to 45 min

import { ZONES, MODALITIES, MOBILITY_DOSE } from './rules.js';

// --------------------------------------------------------------------------
// Day types -- spec §5
// --------------------------------------------------------------------------

// `mobilityCore` resolves a tension between two parts of the spec: §4 step 9
// says the mobility block is appended "always", while §2 and basis §9 scope the
// ~25 min block to gym sessions. Gym days get the full block; outdoor days get
// a short one, since a park session still ends with the hips and ankles that
// just did the work. Never randomised out either way.
export const DAY_TYPES = Object.freeze({
  'max-strength': Object.freeze({
    venue: 'gym', cnsClass: 'high', volumeUnit: 'sets', mobilityCore: 'full'
  }),
  power: Object.freeze({
    venue: 'gym', cnsClass: 'high', volumeUnit: 'sets', mobilityCore: 'full'
  }),
  hypertrophy: Object.freeze({
    venue: 'gym', cnsClass: 'moderate', volumeUnit: 'sets', mobilityCore: 'full'
  }),
  // `prep` names the prep variant; `mobilityCore` still names the cool-down.
  // The running days want the four-stage prep AND the short cool-down, which
  // one key could not say. design-running-programming.md §5.3, §6.
  'aerobic-steady': Object.freeze({
    venue: 'outdoor', cnsClass: 'low', volumeUnit: 'minutes',
    mobilityCore: 'short', prep: 'running'
  }),
  interval: Object.freeze({
    venue: 'outdoor', cnsClass: 'moderate', volumeUnit: 'minutes',
    mobilityCore: 'short', prep: 'running'
  }),
  sprint: Object.freeze({
    venue: 'outdoor', cnsClass: 'high', volumeUnit: 'meters',
    mobilityCore: 'short', prep: 'running'
  }),
  // The one running day that is not run. Its stage 4 potentiates with low
  // plyos rather than build-ups, per design §5 -- and a build-up run is
  // outdoor-only, so a gym plyo session could not have drawn one anyway.
  plyometric: Object.freeze({
    venue: 'either', cnsClass: 'high', volumeUnit: 'contacts',
    mobilityCore: 'short', prep: 'running-plyo'
  })
});

// Isolation and mobility days arrive in Phase 2. spec §8. The other three --
// interval, sprint, plyometric -- landed here with the running programming;
// their recovery vetoes were already wired in proposeDayType before they had
// templates to select. design-running-programming.md §6.
export const PHASE_1_DAY_TYPES = Object.freeze([
  'max-strength', 'power', 'hypertrophy',
  'aerobic-steady', 'interval', 'sprint', 'plyometric'
]);

// --------------------------------------------------------------------------
// Architectures -- spec §4.3
// --------------------------------------------------------------------------

// Gated by day type: no EMOM on a max-strength day, no cluster sets on a
// conditioning day. Phase 1 generates 'straight' only; the rest land in
// Phase 3. Declared now so the gating lives with the templates it constrains.
export const ARCHITECTURES = Object.freeze({
  'max-strength': Object.freeze(['straight', 'cluster', 'ladder']),
  power: Object.freeze(['straight', 'emom', 'complex', 'cluster']),
  hypertrophy: Object.freeze(['straight', 'antagonist-superset', 'circuit']),
  'aerobic-steady': Object.freeze(['straight']),
  interval: Object.freeze(['straight']),
  sprint: Object.freeze(['straight']),
  plyometric: Object.freeze(['straight'])
});

export const PHASE_1_ARCHITECTURE = 'straight';

// --------------------------------------------------------------------------
// Templates
// --------------------------------------------------------------------------

// Heavy compound first, while fresh (basis §8). The accessory slots draw from
// the `hypertrophy` pool rather than `max-strength`: the library has no
// accessory-tier max-strength exercises, and correctly so -- accessory work
// is not max-strength work. Filtering an accessory slot by 'max-strength'
// would starve it. Recorded in spec §10.
const MAX_STRENGTH = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'main lift',
    tier: ['primary'], patterns: ['squat', 'hinge', 'push-h', 'push-v', 'pull-v'],
    modality: 'max-strength', zone: 'maxStrength', mode: 'load',
    sets: [4, 6], reps: [2, 5], restSec: [180, 240], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'second compound, opposing pattern',
    tier: ['primary', 'secondary'], patterns: null,
    modality: 'max-strength', zone: 'maxStrength', mode: 'load',
    sets: [3, 4], reps: [3, 6], restSec: [150, 210], optional: false
  }),
  Object.freeze({
    slot: 'C', role: 'accessory volume',
    tier: ['secondary', 'accessory'], patterns: null,
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [3, 3], reps: [6, 10], restSec: [90, 120], optional: false
  }),
  Object.freeze({
    slot: 'D', role: 'accessory, unilateral or posterior',
    tier: ['accessory'], patterns: ['lunge', 'hinge', 'pull-h', 'carry'],
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [2, 3], reps: [8, 12], restSec: [60, 90], optional: true
  })
]);

// spec §5.1. Slot A potentiates: a few sharp contacts before the bar, not a
// plyometric workout -- keep the contact count low so it does not eat the
// weekly budget (basis §4).
const POWER = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'potentiation',
    tier: ['primary', 'secondary'], patterns: ['jump', 'throw'],
    modality: 'power', zone: null, mode: 'contacts',
    sets: [3, 3], reps: [3, 3], restSec: [90, 120], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'Olympic derivative',
    tier: ['primary'], patterns: ['hinge', 'pull-h'],
    // 75-85% of THAT LIFT'S OWN max, not of the squat. See rules.js ZONES.
    modality: 'power', zone: 'powerMultiple', mode: 'load',
    sets: [5, 6], reps: [2, 3], restSec: [150, 210], optional: false
  }),
  Object.freeze({
    slot: 'C', role: 'dynamic effort',
    tier: ['primary', 'secondary'], patterns: ['squat', 'push-h', 'push-v'],
    // 40-60% of the squat or bench -- speed against a slow-lift reference.
    modality: 'power', zone: 'dynamicEffort', mode: 'load',
    sets: [6, 8], reps: [2, 3], restSec: [60, 90], optional: false
  }),
  Object.freeze({
    slot: 'D', role: 'accessory, opposing pattern',
    tier: ['secondary', 'accessory'], patterns: null,
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [3, 3], reps: [8, 10], restSec: [90, 120], optional: true
  })
]);

// Multi-joint work first even here -- the minimalist literature is explicit
// that compounds come first at low frequency. basis §2 rule 2.
const HYPERTROPHY = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'primary compound',
    tier: ['primary'], patterns: ['squat', 'hinge', 'push-h', 'push-v', 'pull-v'],
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [3, 4], reps: [6, 10], restSec: [120, 180], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'second compound, opposing pattern',
    tier: ['primary', 'secondary'], patterns: null,
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [3, 4], reps: [8, 12], restSec: [90, 150], optional: false
  }),
  Object.freeze({
    slot: 'C', role: 'accessory',
    tier: ['secondary', 'accessory'], patterns: null,
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [3, 3], reps: [10, 12], restSec: [60, 90], optional: false
  }),
  Object.freeze({
    slot: 'D', role: 'accessory, unilateral or carry',
    tier: ['accessory'], patterns: ['lunge', 'carry', 'rotate'],
    modality: 'hypertrophy', zone: 'hypertrophy', mode: 'load',
    sets: [2, 3], reps: [10, 15], restSec: [60, 90], optional: true
  }),
  Object.freeze({
    slot: 'E', role: 'isolation finisher',
    tier: ['accessory'], patterns: null,
    modality: 'isolation', zone: 'muscularEndurance', mode: 'load',
    sets: [2, 3], reps: [12, 15], restSec: [45, 60], optional: true
  })
]);

// Terrain-agnostic: time and effort, never pace or distance. There is no
// measured route, so "run 1.6 km" is unverifiable. spec 9.1.
const AEROBIC_STEADY = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'steady run',
    // Primary tier alone leaves only two candidates, so every easy day would
    // be the same run. Secondary and accessory locomotion -- fartlek, stair
    // runs, an incline walk -- are legitimate steady-state work.
    tier: ['primary', 'secondary', 'accessory'], patterns: ['run', 'erg'],
    modality: 'aerobic-steady', zone: null, mode: 'time',
    durationMin: [20, 45], effort: 'easy -- able to hold a conversation',
    sets: [1, 1], reps: [1, 1], restSec: [0, 0], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'strides',
    tier: ['secondary', 'accessory'], patterns: ['sprint'], effortClass: 'submaximal',
    modality: 'sprint', zone: null, mode: 'contacts',
    sets: [4, 6], reps: [1, 1], restSec: [60, 90],
    effort: 'build to about 90%, never a maximal effort', optional: true
  })
]);


// spec §5, design-running-programming.md §6.2. Work is seconds, never metres
// or pace: the terrain is not known and must not be assumed (spec 9.1).
const INTERVAL = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'intervals',
    // The ergs sit here as well as outdoors: a rower is interval work whether
    // or not it is raining. Pattern `run` alone would have excluded them.
    tier: ['primary', 'secondary', 'accessory'], patterns: ['run', 'erg'],
    modality: 'interval', zone: null, mode: 'interval',
    // INTERVAL_WORK_SEC 60-90 s and INTERVAL_REST_RATIO 1-2x work, both
    // [corroborated] -- multiple secondary sources on interval prescription
    // converge, no single position stand pins them. design §10.
    workSec: [60, 90], restRatio: [1, 2],
    sets: [6, 10], reps: [1, 1], restSec: [0, 0],
    effort: 'hard -- talking is down to a word or two', optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'tempo finisher',
    // Modality `tempo`, not `interval`. This slot is one continuous effort,
    // so it must not reach an exercise that is intermittent by definition --
    // a fartlek, a shuttle run, or the entry literally named Running
    // Intervals, which is what it used to draw. design §6.2.
    tier: ['primary', 'secondary', 'accessory'], patterns: ['run', 'erg'],
    modality: 'tempo', zone: null, mode: 'time',
    durationMin: [8, 12], effort: 'comfortably hard, one steady effort',
    sets: [1, 1], reps: [1, 1], restSec: [0, 0], optional: true
  })
]);

// design §6.3. Metreage stays inside SPRINT.METERS_PER_SESSION as an internal
// budget, checked in finalise() and never shown as a target (spec 9.1). Rest
// derives from SPRINT.WORK_REST_RATIO: 12-20x an assumed 8 s effort.
const SPRINT_DAY = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'maximal sprints',
    tier: ['primary'], patterns: ['sprint'], effortClass: 'maximal',
    modality: 'sprint', zone: null, mode: 'contacts',
    sets: [4, 8], reps: [1, 1], restSec: [96, 160],
    effort: 'maximal -- full recovery between every rep', optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'resisted or hill work',
    // "hill or resisted" in the design table is not a field the library
    // carries; secondary-tier maximal sprints are exactly hill-sprint,
    // resisted-sprint and three-point-start, so tier expresses it.
    tier: ['secondary'], patterns: ['sprint'], effortClass: 'maximal',
    modality: 'sprint', zone: null, mode: 'contacts',
    sets: [4, 6], reps: [1, 1], restSec: [96, 160],
    effort: 'drive out low and hard', optional: true
  }),
  Object.freeze({
    // Unreachable by default and deliberately kept: eligibleFor excludes
    // requiresMeasuredGround unconditionally, so this slot fills only once
    // the opt-in lands. design §6.3.
    slot: 'C', role: 'flying runs (opt-in: needs measured ground)',
    tier: ['primary'], patterns: ['sprint'], effortClass: 'maximal',
    modality: 'sprint', zone: null, mode: 'contacts',
    sets: [2, 3], reps: [1, 1], restSec: [96, 160],
    effort: 'float at top speed -- do not strain', optional: true
  })
]);

// design §6.4. PLYO_CONTACTS_PER_SESSION and the week 1-2 transition cap are
// already enforced in finalise(); no new safety machinery here.
const PLYOMETRIC = Object.freeze([
  Object.freeze({
    slot: 'A', role: 'main jump',
    tier: ['primary'], patterns: ['jump'],
    plyoIntensity: ['moderate', 'high'],
    modality: null, zone: null, mode: 'contacts',
    // Doses across this template and the prep's stage 4 are sized so the
    // worst case lands inside PLYO_CONTACTS_PER_SESSION.beginner [50, 100]
    // rather than warning its way past it: 24 + 20 + 16 + 36 = 96 contacts.
    // A high-intensity jump is dosed for quality anyway -- 3-4 sharp reps,
    // not 5 tired ones.
    sets: [3, 5], reps: [3, 4], restSec: [90, 120], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'second jump, different landing',
    // The design table says "bounds / lateral". The library has no field for
    // that, and inventing one to hold four ids would be worse than saying so:
    // excludeIds already guarantees this is a different movement from slot A.
    tier: ['primary', 'secondary'], patterns: ['jump'],
    plyoIntensity: ['moderate', 'high'],
    modality: null, zone: null, mode: 'contacts',
    sets: [3, 4], reps: [3, 4], restSec: [90, 120], optional: false
  }),
  Object.freeze({
    slot: 'C', role: 'low-intensity finisher',
    tier: ['secondary', 'accessory'], patterns: ['jump'],
    plyoIntensity: ['low'],
    modality: null, zone: null, mode: 'contacts',
    sets: [2, 3], reps: [8, 12], restSec: [45, 60],
    effort: 'quick off the ground, quiet landings', optional: true
  })
]);

export const TEMPLATES = Object.freeze({
  'max-strength': MAX_STRENGTH,
  power: POWER,
  hypertrophy: HYPERTROPHY,
  'aerobic-steady': AEROBIC_STEADY,
  interval: INTERVAL,
  sprint: SPRINT_DAY,
  plyometric: PLYOMETRIC
});

// --------------------------------------------------------------------------
// Prep and cool-down -- appended to every session, never randomised out
// --------------------------------------------------------------------------

// One block became two, because one block could not be in two places. Dynamic
// drills prepare the work and belong before it; static stretching impairs
// explosive performance and belongs after it. design 4.2, discrepancy 6.
//
// `count` is how many movements the block holds; the dose per movement comes
// from MOBILITY_DOSE and is stated in the unit the source uses -- reps for
// drills, seconds for holds.
// --------------------------------------------------------------------------
// The four running prep stages -- design-running-programming.md §5
// --------------------------------------------------------------------------

// Raise -> mobilise -> integrate -> potentiate. Every running session runs all
// four; only stage 4's endpoint differs, so the first three are shared objects
// rather than copies. Stage order is preserved by orderSession's stable sort,
// which breaks SESSION_ORDER ties by emission index -- so these must stay in
// the order they are listed into each variant.
//
// One variant serves several day types, so each count is the range spanning
// that stage's per-day-type values in design §5.1 and the generator jitters
// within it -- the same mechanism MOBILITY_DOSE already uses. Writing one
// block per day type would give them no more resolution than this, and four
// places to drift.

const RUN_RAISE = Object.freeze({
  slot: 'P1', role: 'prep', tier: ['accessory'], patterns: ['run'],
  modality: 'aerobic-steady', zone: null, mode: 'time',
  count: Object.freeze([1, 1]), durationMin: Object.freeze([3, 5]),
  effort: 'easy -- finish warm, never tired', optional: false
});

const RUN_MOBILISE = Object.freeze({
  slot: 'P2', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
  modality: 'mobility-dynamic', zone: null, mode: 'drill',
  // The running warm-up prepares the hips, knees and ankles. Pattern alone
  // cannot express that -- every drill is pattern 'mobility'.
  joints: Object.freeze(['hip', 'knee', 'ankle']),
  count: MOBILITY_DOSE.DYNAMIC_DRILLS, reps: MOBILITY_DOSE.DYNAMIC_REPS,
  effort: 'controlled, full range -- not a stretch', optional: false
});

const RUN_INTEGRATE = Object.freeze({
  slot: 'P3', role: 'prep', tier: ['accessory'],
  patterns: ['sprint-drill', 'agility'],
  modality: null, zone: null, mode: 'contacts',
  // PREP_INTEGRATE_COUNT: 2 on easy-run and interval days, 3 on sprint and
  // plyometric. [unverified] -- no literature pins a stage-3 count; it scales
  // with session CNS demand by the same judgement as the core-count line at
  // js/rules.js:267. design §5.1, §10.
  count: Object.freeze([2, 3]),
  sets: Object.freeze([1, 1]), reps: Object.freeze([1, 1]),
  restSec: Object.freeze([30, 45]),
  effort: 'rhythm before speed -- these rehearse the mechanics', optional: false
});

// Stage 4, endpoint one: the running days.
const RUN_POTENTIATE_SPRINT = Object.freeze({
  slot: 'P4', role: 'prep', tier: ['secondary'], patterns: ['sprint'],
  // The one field standing between a warm-up and a maximal effort.
  effortClass: 'submaximal',
  modality: 'sprint', zone: null, mode: 'contacts',
  // PREP_POTENTIATE_COUNT: 2 on interval days, 3-4 on sprint, none on the
  // easy run -- build-ups before a conversational-pace run make it something
  // other than an easy run, which `optional` expresses. [unverified],
  // design §5.1, §10.
  count: Object.freeze([2, 4]),
  sets: Object.freeze([1, 1]), reps: Object.freeze([1, 1]),
  restSec: Object.freeze([60, 90]),
  // BUILDUP_PCT_INTERVAL ~80% and BUILDUP_PCT_SPRINT ~95% bracket the day
  // types this shared stage serves, so the prescription names the span rather
  // than either endpoint. Printing "~95%" on an interval day would be the
  // same class of mis-prescription this block exists to stop. Both are
  // [unverified] project choices; design §10.
  effort: 'build up to ~80-95% -- fast and smooth, never a maximal effort',
  optional: true
});

// Stage 4, endpoint two: the plyometric day. design §5's stage-4 row names
// `jump` at plyoIntensity low as the alternative to a submaximal sprint, and
// it is the only one available here -- the build-up run is outdoor-only and
// this is the one running day that can happen in a gym.
// PREP_POTENTIATE_COUNT: 2-3 low plyos. [unverified], design §5.1.
const RUN_POTENTIATE_PLYO = Object.freeze({
  slot: 'P4', role: 'prep', tier: ['secondary', 'accessory'], patterns: ['jump'],
  plyoIntensity: Object.freeze(['low']),
  modality: null, zone: null, mode: 'contacts',
  count: Object.freeze([2, 3]),
  sets: Object.freeze([1, 1]), reps: Object.freeze([6, 8]),
  restSec: Object.freeze([30, 45]),
  effort: 'light and springy off the ground -- ankles, not knees', optional: true
});

export const PREP_BLOCK = Object.freeze({
  full: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      count: MOBILITY_DOSE.DYNAMIC_DRILLS, reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    })
  ]),
  // PREP_BLOCK.short is gone. Its count of [2, 3] was the last [unverified]
  // number in this file, carried over from the pre-split block and sourced to
  // nothing. The four outdoor day types that used to select it now name the
  // running prep instead, so nothing reached it. design §5.3.
  // Raise -> mobilise -> integrate -> potentiate. Every running session runs
  // all four; only stage 4's endpoint differs. design-running-programming.md
  // §5. Stage order is preserved by orderSession's stable sort, which breaks
  // SESSION_ORDER ties by emission index -- so these must stay in order.
  //
  // One block serves all four running day types, so each count is the range
  // spanning that stage's per-day-type values in design §5.1, and the
  // generator jitters within it -- the same mechanism MOBILITY_DOSE already
  // uses. Writing four near-identical blocks would give the day types no
  // more resolution than this and four places to drift.
  running: Object.freeze([RUN_RAISE, RUN_MOBILISE, RUN_INTEGRATE, RUN_POTENTIATE_SPRINT]),
  // Same first three stages; stage 4 potentiates with low plyos instead of
  // build-ups, which is design §5's second stage-4 endpoint.
  'running-plyo': Object.freeze([RUN_RAISE, RUN_MOBILISE, RUN_INTEGRATE, RUN_POTENTIATE_PLYO])
});

export const COOLDOWN_BLOCK = Object.freeze({
  full: Object.freeze([
    Object.freeze({
      slot: 'M1', role: 'mobility', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-static', zone: null, mode: 'hold',
      count: MOBILITY_DOSE.STATIC_STRETCHES,
      holdSec: MOBILITY_DOSE.STATIC_HOLD_SEC,
      sets: MOBILITY_DOSE.STATIC_HOLD_SETS,
      effort: 'ease in -- no bouncing, no forcing', optional: false
    }),
    Object.freeze({
      // modality is null on purpose: core is selected by tier and pattern.
      // `mode: 'core'` tells the builder to resolve the dose per exercise --
      // a plank by time, an ab wheel by reps.
      slot: 'M2', role: 'core', tier: ['core'], patterns: ['core', 'rotate'],
      modality: null, zone: null, mode: 'core',
      count: MOBILITY_DOSE.CORE_EXERCISES,
      sets: MOBILITY_DOSE.CORE_SETS,
      reps: MOBILITY_DOSE.CORE_REPS,
      holdSec: MOBILITY_DOSE.CORE_HOLD_SEC,
      restSec: MOBILITY_DOSE.CORE_REST_SEC,
      optional: false
    })
  ]),
  short: Object.freeze([
    Object.freeze({
      slot: 'M1', role: 'mobility', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-static', zone: null, mode: 'hold',
      count: Object.freeze([2, 3]), // [unverified] -- carried over from pre-split short block, not literature-sourced
      holdSec: MOBILITY_DOSE.STATIC_HOLD_SEC,
      sets: MOBILITY_DOSE.STATIC_HOLD_SETS,
      effort: 'ease in -- no bouncing, no forcing', optional: false
    })
  ])
});

// --------------------------------------------------------------------------
// Sanity guard
// --------------------------------------------------------------------------

// Every zone and every modality a slot names must exist in rules.js. Cheap to
// check at import time, and it turns a typo into an immediate error rather
// than a silently undefined prescription at the gym door.
//
// The modality half is what makes the 4.1 migration safe: if any slot still
// names the pre-split `mobility`, the app refuses to start instead of quietly
// filling the block from an empty pool.
export function validateSlots(allSlotGroups) {
  for (const [where, slot] of allSlotGroups) {
    if (slot.zone != null && !(slot.zone in ZONES)) {
      throw new Error(
        `templates.js: ${where} slot ${slot.slot} names unknown zone "${slot.zone}"`
      );
    }
    if (slot.modality != null && !MODALITIES.includes(slot.modality)) {
      throw new Error(
        `templates.js: ${where} slot ${slot.slot} names unknown modality "${slot.modality}"`
      );
    }
  }
}

const ALL_SLOT_GROUPS = [
  ...Object.entries(TEMPLATES).flatMap(([k, slots]) => slots.map(s => [k, s])),
  ...Object.entries(PREP_BLOCK).flatMap(([k, slots]) => slots.map(s => [`prep.${k}`, s])),
  ...Object.entries(COOLDOWN_BLOCK).flatMap(([k, slots]) => slots.map(s => [`cooldown.${k}`, s]))
];

validateSlots(ALL_SLOT_GROUPS);
