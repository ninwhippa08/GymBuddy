// Provenance for every load coefficient in the library.
//
// design-library-expansion.md §8: "A `prCoef` is a dose and carries a
// provenance tag." That rule was written down and never applied -- when this
// file was created on 2026-08-25 all 30 coefficient claims in the library
// had no provenance record of any kind: no field on the entry, nothing in the
// docs. They are all plausible, which is exactly what makes them dangerous.
// They are also the numbers that decide how much weight goes on the bar,
// against college PRs, for someone returning from years off.
//
// Test-side rather than a schema field, for the same reason as the cue guard:
// the library is authored in this repo and gated by this suite, so a
// coefficient can never reach a user without passing through here. It also
// keeps Project A out of the schema, which design §2 requires.
//
// A `prCoef` of 1.00 on a PR ROOT is definitional and is not listed. A
// coefficient of 1.00 on anything else is still a claim -- sumo-deadlift,
// clean-high-pull and power-snatch each assert parity with their reference --
// and those are listed like any other.
//
// TAGS, matching js/rules.js: 'verified' | 'corroborated' | 'measured' |
// 'unverified'. Everything here starts 'unverified' because that is the honest
// state, not because sourcing is optional. The ratchet in
// coefficients.test.mjs freezes that debt: it may shrink, never grow.
//
// HIGHEST PRIORITY TO SOURCE are the coefficients ABOVE 1.00, because those
// prescribe MORE weight than the reference PR and an error there is an
// overload rather than a wasted set.

export const COEF_PROVENANCE = {
  "box-squat"                 : { coef: 0.9  , of: "back-squat"      , tag: 'unverified' },
  "safety-bar-squat"          : { coef: 0.9  , of: "back-squat"      , tag: 'unverified' },
  "front-squat"               : { coef: 0.85 , of: "back-squat"      , tag: 'unverified' },
  "pause-squat"               : { coef: 0.85 , of: "back-squat"      , tag: 'unverified' },
  "zercher-squat"             : { coef: 0.65 , of: "back-squat"      , tag: 'unverified' },
  "good-morning"              : { coef: 0.4  , of: "back-squat"      , tag: 'unverified' },
  "floor-press"               : { coef: 0.92 , of: "bench-press"     , tag: 'unverified' },
  "pause-bench-press"         : { coef: 0.92 , of: "bench-press"     , tag: 'unverified' },
  "close-grip-bench-press"    : { coef: 0.9  , of: "bench-press"     , tag: 'unverified' },
  "incline-bench-press"       : { coef: 0.85 , of: "bench-press"     , tag: 'unverified' },
  "rack-pull"                 : { coef: 1.15 , of: "deadlift"        , tag: 'unverified' },
  "trap-bar-deadlift"         : { coef: 1.05 , of: "deadlift"        , tag: 'unverified' },
  "sumo-deadlift"             : { coef: 1    , of: "deadlift"        , tag: 'unverified' },
  "deficit-deadlift"          : { coef: 0.85 , of: "deadlift"        , tag: 'unverified' },
  "romanian-deadlift"         : { coef: 0.7  , of: "deadlift"        , tag: 'unverified' },
  "barbell-row"               : { coef: 0.55 , of: "deadlift"        , tag: 'unverified' },
  "pendlay-row"               : { coef: 0.5  , of: "deadlift"        , tag: 'unverified' },
  "split-jerk"                : { coef: 1.55 , of: "overhead-press"  , tag: 'unverified' },
  "push-jerk"                 : { coef: 1.45 , of: "overhead-press"  , tag: 'unverified' },
  "push-press"                : { coef: 1.3  , of: "overhead-press"  , tag: 'unverified' },
  "z-press"                   : { coef: 0.75 , of: "overhead-press"  , tag: 'unverified' },
  "clean-pull"                : { coef: 1.15 , of: "power-clean"     , tag: 'unverified' },
  // The first coefficient in this register to arrive sourced rather than
  // inherited. Coaching sources put the power clean at 80-90% of the full
  // clean; 85% inverts to 1.18. Two independent sources agree on the band,
  // neither is a primary study, so: corroborated, not verified.
  //   https://www.catalystathletics.com/article/2130/
  //   https://store.torokhtiy.com/blogs/guides/power-clean-standards
  "squat-clean"               : { coef: 1.18 , of: "power-clean"     , tag: 'corroborated' },
  "clean-high-pull"           : { coef: 1    , of: "power-clean"     , tag: 'unverified' },
  "hang-power-clean"          : { coef: 0.9  , of: "power-clean"     , tag: 'unverified' },
  "high-hang-clean"           : { coef: 0.82 , of: "power-clean"     , tag: 'unverified' },
  "snatch-pull"               : { coef: 1.15 , of: "snatch"          , tag: 'unverified' },
  "overhead-squat"            : { coef: 1.1  , of: "snatch"          , tag: 'unverified' },
  // RESOLVED 2026-08-25 by the athlete: the `snatch` root IS his power snatch,
  // not a full squat snatch. So parity is definitional rather than a claim,
  // and [verified] is right on its own terms -- for "what does his PR refer
  // to" the primary source is him. This retires the ~14% overload risk raised
  // in design 5.5, and it is the first entry to leave the backlog, so
  // UNVERIFIED_BUDGET falls 30 -> 29.
  //
  // It also makes the three neighbours MORE coherent, not less: snatch-pull at
  // 1.15 and overhead-squat at 1.10 of a POWER snatch land near 101% and 97%
  // of a full snatch, which is where coaching guidance puts them. They stay
  // unverified -- coherence is not a source -- but they no longer look odd.
  "power-snatch"              : { coef: 1    , of: "snatch"          , tag: 'verified' },
  "hang-power-snatch"         : { coef: 0.9  , of: "snatch"          , tag: 'unverified' },
  "muscle-snatch"             : { coef: 0.65 , of: "snatch"          , tag: 'unverified' },
};

// The count of unsourced coefficients on the day the register was created.
// This is a DEBT CEILING, not a target: it may fall, never rise. A new
// loadable movement must arrive with a sourced coefficient.
// Lowered 30 -> 29 on 2026-08-25 when power-snatch was resolved. This is the
// ratchet working in the direction it was built for.
export const UNVERIFIED_BUDGET = 29;
