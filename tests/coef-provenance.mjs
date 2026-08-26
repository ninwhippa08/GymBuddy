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
  // INVESTIGATED 2026-08-25 AND DELIBERATELY LEFT UNSOURCED. Not skipped --
  // stopped, for a reason that is itself the finding. See design §5.7.
  //
  // A rack pull's load is set almost entirely by PIN HEIGHT, and this entry
  // does not say where the pins go. Its joints -- hip and lumbar, NO KNEE --
  // encode an above-knee pull, and for that the evidence puts the load at
  // 1.20-1.40 (competitive powerlifters produce ~21% more force from just
  // above the kneecap than from the floor), so 1.15 is probably LOW.
  //
  // It was not raised, because the joints field is not user-facing. The card
  // said "Rack Pull" and nothing else, so he set the pins wherever he liked --
  // and a coefficient sourced for an above-knee pull is an OVERLOAD on a
  // below-knee one.
  //
  // HALF FIXED 2026-08-25: the entry is now "Rack Pull (Above Knee)" and its
  // first cue says to set the pins just above the kneecaps. That closes the
  // ambiguity -- 1.15 is now a claim about a movement the app actually
  // prescribes, rather than a gamble on where the pins ended up. THIS IS A
  // SAFETY FIX INDEPENDENT OF THE COEFFICIENT'S VALUE.
  //
  // STILL UNVERIFIED, and the reason changed. The evidence that pointed at
  // 1.20-1.40 does not survive inspection: the widely repeated "~21% more
  // force above the kneecap" traces to isometric force-plate work (Beckham et
  // al., n=14, floor < knee < lockout), and FORCE PRODUCED AT A POSITION IS
  // NOT A 1RM RATIO. The direction is peer-reviewed; the multiplier is not.
  // The coaching "20-40% more" is a working-load range, not a max. So the
  // question is now well-posed and still unanswered -- which is progress, and
  // is not the same as being sourced.
  "rack-pull"                 : { coef: 1.15 , of: "deadlift"        , tag: 'unverified' },
  // SOURCED 2026-08-25, AND IT SURVIVED UNCHANGED -- the first one to. Three
  // peer-reviewed 1RM comparisons of the hexagonal against the straight bar:
  //   Swinton et al. 2011 (n=19 powerlifters): 265 vs 245 kg, +8%
  //   Lake et al. 2017 (n=11): 194 +/- 20 vs 183 +/- 22 kg, +6%, p=0.003
  //   Camara et al. 2016: 181 +/- 27 vs 181 +/- 28 kg, NO difference
  //     https://pmc.ncbi.nlm.nih.gov/articles/PMC5969032/  (reports its own
  //     result and cites the other two)
  // The literature spans 0% to 8% and 1.05 sits in the middle of that spread,
  // so the inherited value needed no correction. That is the honest reading,
  // not a rescue: had the spread bracketed 1.15 the number would have moved.
  //
  // 'corroborated' rather than 'verified' DESPITE the sources being primary
  // studies, because they DISAGREE. 1.05 is a central estimate across a
  // spread, not a measurement of it. A tag describes the strength of the
  // claim, not the prestige of the citation.
  "trap-bar-deadlift"         : { coef: 1.05 , of: "deadlift"        , tag: 'corroborated' },
  "sumo-deadlift"             : { coef: 1    , of: "deadlift"        , tag: 'unverified' },
  "deficit-deadlift"          : { coef: 0.85 , of: "deadlift"        , tag: 'unverified' },
  "romanian-deadlift"         : { coef: 0.7  , of: "deadlift"        , tag: 'unverified' },
  "barbell-row"               : { coef: 0.55 , of: "deadlift"        , tag: 'unverified' },
  "pendlay-row"               : { coef: 0.5  , of: "deadlift"        , tag: 'unverified' },
  // THE OVERHEAD-PRESS LADDER, SOURCED 2026-08-25. All three were high.
  //
  // The root is a STRICT press: `overhead-press` lists joints shoulder/elbow/
  // lumbar/scapula and NO knee or hip, so the library itself says no leg drive.
  // Every number below is therefore a ratio against a strict standing press.
  //
  // Two independent derivations, agreeing to within 2% on all three rungs:
  //
  //   (a) Jim Schmitz -- three-time US Olympic weightlifting team coach --
  //       gives the ladder as a worked example: "If you MP 80 kg, then you
  //       should PP about 90 kg and PJ 100 kg and split jerk 110 kg."
  //       That is 1.125 / 1.25 / 1.375.
  //       https://ironmind.com/articles/jim-schmitz-on-the-lifts/Push-Press-Push-Jerk-aka-Power-Jerk/
  //
  //   (b) Anchor the top rung on measured data, then walk down it. WODconnect
  //       reports means over 90,000 users: male press 61.1 kg, split jerk
  //       84.14 kg, a ratio of 1.38. Push press is programmed at ~80% of jerk
  //       max (0.80 x 1.38 = 1.10); the push jerk gives way to the split jerk
  //       at ~85-90% of it (0.90 x 1.38 = 1.24).
  //       https://www.wodconnect.com/blog/posts/the-correlation-between-overhead-press-and-jerk
  //       https://www.performancemenu.com/article/1205/Maximizing-the-Push-Press-for-the-Jerk/
  //
  // Where the two bands differ the LOWER value is taken, on §8's asymmetry: a
  // low coefficient wastes a set, a high one puts weight overhead that cannot
  // be stabilised.
  //
  // A THIRD SOURCE DISAGREES AND IS REJECTED, on the record. Strength Level's
  // per-lift means (press 57 kg, push press 82, push jerk 89) imply 1.44 and
  // 1.56 -- both far higher, and the push jerk figure ALONE EXCEEDS the split
  // jerk figure the other two sources give. A push jerk cannot beat a split
  // jerk; that is what the split is for. The tell is that those averages are
  // unpaired -- the population logging strict presses is not the population
  // logging push jerks -- so they cannot yield a within-athlete ratio.
  // Rejected for failing the ordering the movements themselves impose, not for
  // being inconvenient.
  //
  // 'corroborated', not 'verified': a coach's prescription and a commercial
  // user database agree, but neither is a peer-reviewed study. Same standard
  // as squat-clean above.
  //
  // ROOT CONFIRMED 2026-08-25 BY THE ATHLETE: his `overhead-press` PR is a
  // STRICT standing press, no leg drive. The library's reading was right and
  // the ladder needs no further adjustment. Asked rather than assumed, on the
  // §5.5 precedent -- and the answer independently supports the low camp, since
  // a lifter whose held PR is a strict press is a lifter who presses, which is
  // the population whose jerk-to-press ratio is 1.38 rather than 1.67.
  "split-jerk"                : { coef: 1.38 , of: "overhead-press"  , tag: 'corroborated' },
  "push-jerk"                 : { coef: 1.24 , of: "overhead-press"  , tag: 'corroborated' },
  "push-press"                : { coef: 1.1  , of: "overhead-press"  , tag: 'corroborated' },
  "z-press"                   : { coef: 0.75 , of: "overhead-press"  , tag: 'unverified' },
  // SOURCED 2026-08-25, unchanged, TOGETHER WITH snatch-pull -- they stand or
  // fall on the same argument. Greg Everett, Catalyst Athletics: "typically
  // pulls are done with 80-105% of the lifter's best snatch or clean."
  //   https://www.catalystathletics.com/article/1728/
  //
  // 1.15 looks OUTSIDE that band until the roots are taken into account, and
  // this is the whole point: BOTH ROOTS ARE POWER VARIANTS. The power clean is
  // 80-90% of the clean (Everett again, article 2130 -- already cited for
  // squat-clean above), so 1.15 x 0.85 lands the clean pull at ~98% of the
  // FULL clean. Inside the band, near its top.
  //
  // Near the top is the right end for him specifically. Everett's caveat is
  // that 80-105% is "far too light" for lifters with a surplus of strength
  // relative to technical ability -- which is the exact description of a
  // retired college football athlete whose Olympic technique is years stale.
  // The band is sourced; placing him at its top is reasoning from his case,
  // so: corroborated, not verified.
  "clean-pull"                : { coef: 1.15 , of: "power-clean"     , tag: 'corroborated' },
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
  // SOURCED 2026-08-25, unchanged -- same argument as clean-pull above, and
  // the arithmetic is even cleaner because §5.5 established that the `snatch`
  // root IS his power snatch. A power snatch is ~0.88 of the full snatch
  // (PMC6890263, cited in §5.5), so 1.15 x 0.88 puts the snatch pull at ~101%
  // of the full snatch: inside Everett's 80-105% band, at the top end where a
  // strength-surplus lifter belongs.
  //
  // Note what happened here. The register already observed that these two
  // "no longer look odd" once the root was resolved, and explicitly refused to
  // count that as a source -- "coherence is not a source". It still isn't. What
  // changed is that a sourced BAND now exists to check the coherent value
  // against, and it falls inside. Coherence pointed; the band is the evidence.
  "snatch-pull"               : { coef: 1.15 , of: "snatch"          , tag: 'corroborated' },
  // INVESTIGATED 2026-08-25 AND LEFT UNSOURCED, for a different reason than
  // rack-pull's. There is no strength ratio to find, because THE OVERHEAD SQUAT
  // IS NOT STRENGTH-LIMITED. Asked directly what the snatch:overhead-squat
  // ratio should be, Everett declines to give one and treats the gap as a
  // mobility and stability problem: "you don't necessarily need to overhead
  // squat more than you snatch."
  //   https://www.catalystathletics.com/article/2130/
  //
  // So a coefficient is the wrong instrument here. It predicts load from a PR,
  // and the binding constraint is shoulder, thoracic and ankle mobility -- for
  // a returning athlete, the thing most likely to have decayed. The number is
  // not defensible and not obviously wrong either: 1.10 of a POWER snatch is
  // ~97% of a full snatch, which satisfies Everett's "not necessarily more".
  // That is coherence again, and coherence is not a source.
  //
  // FLAGGED FOR HIM rather than guessed at. Inventing a lower number would be
  // this project's signature failure wearing a safety costume.
  //
  // HIS DECISION, 2026-08-25: leave it at 1.10 as tagged standing debt. Decided,
  // not deferred -- do not reopen without new information. It stays in
  // UNVERIFIED_BUDGET, which is the right place for a number nobody can source.
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
// Lowered 29 -> 26 the same day when the overhead-press ladder was sourced --
// the first entries paid off by RESEARCH rather than by a definition, and all
// three proved to be overloads: 1.55 / 1.45 / 1.30 became 1.38 / 1.24 / 1.10.
// Lowered 26 -> 25 for trap-bar-deadlift, which was sourced and kept its
// value -- the debt falls when a number gains a source, not when it changes.
// Lowered 25 -> 23 for the two Olympic pulls, also unchanged. Of the eight
// coefficients above 1.00, five are now sourced (three moved, two held) and
// three are blocked on something other than reading: rack-pull and
// overhead-squat below, and the root question in the ladder above.
export const UNVERIFIED_BUDGET = 23;
