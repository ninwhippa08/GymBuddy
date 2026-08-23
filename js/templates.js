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
  'aerobic-steady': Object.freeze({
    venue: 'outdoor', cnsClass: 'low', volumeUnit: 'minutes', mobilityCore: 'short'
  })
});

// The remaining five day types -- plyometric, sprint, isolation, interval,
// mobility -- arrive in Phase 2. spec §8.
export const PHASE_1_DAY_TYPES = Object.freeze([
  'max-strength', 'power', 'hypertrophy', 'aerobic-steady'
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
  'aerobic-steady': Object.freeze(['straight'])
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
    tier: ['primary', 'secondary', 'accessory'], patterns: ['locomotion'],
    modality: 'aerobic-steady', zone: null, mode: 'time',
    durationMin: [20, 45], effort: 'easy -- able to hold a conversation',
    sets: [1, 1], reps: [1, 1], restSec: [0, 0], optional: false
  }),
  Object.freeze({
    slot: 'B', role: 'strides',
    tier: ['secondary', 'accessory'], patterns: ['sprint'],
    modality: 'sprint', zone: null, mode: 'contacts',
    sets: [4, 6], reps: [1, 1], restSec: [60, 90],
    effort: 'build to about 90%, never a maximal effort', optional: true
  })
]);

export const TEMPLATES = Object.freeze({
  'max-strength': MAX_STRENGTH,
  power: POWER,
  hypertrophy: HYPERTROPHY,
  'aerobic-steady': AEROBIC_STEADY
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
export const PREP_BLOCK = Object.freeze({
  full: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      count: MOBILITY_DOSE.DYNAMIC_DRILLS, reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    })
  ]),
  short: Object.freeze([
    Object.freeze({
      slot: 'P1', role: 'prep', tier: ['mobility'], patterns: ['mobility'],
      modality: 'mobility-dynamic', zone: null, mode: 'drill',
      count: Object.freeze([2, 3]), // [unverified] -- carried over from pre-split short block, not literature-sourced
      reps: MOBILITY_DOSE.DYNAMIC_REPS,
      effort: 'controlled, full range -- not a stretch', optional: false
    })
  ])
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
