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
//
// WHERE THE READING RUNS OUT -- established 2026-09-03, after working through
// the sub-parity entries. The remaining debt is not one backlog, it is two,
// and they need different work:
//
//   (a) Variations that get 1RM-TESTED IN THEIR OWN RIGHT. Front squat,
//       incline bench, close-grip bench and the safety bar squat all have
//       within-subject studies that measured a separate 1RM per variation,
//       because those variations are common enough to be worth a protocol.
//       All four were sourced in an afternoon and THREE OF THE FOUR WERE
//       WRONG -- two 9% high, one 3% low.
//
//   (b) Everything else. The literature on box squats, sumo deadlifts, rack
//       pulls and the Olympic variants is BIOMECHANICS: joint moments, EMG,
//       bar path, lever distance. Those studies routinely load every variation
//       at a percentage of ONE measured 1RM, so by construction they cannot
//       report a ratio between variations. This is the same category error
//       rack-pull's note identified in 2026-08 and it turns out to be
//       structural rather than incidental -- it is what most of this
//       literature is FOR.
//
// So the cheap wins are spent. What is left needs either a primary study
// nobody has run, or a decision to stop pretending a coefficient is the right
// instrument. Entries below say which of the two they are waiting on.
//
// ONE LEAD, NOT PURSUED, recorded so it is not rediscovered as though new.
// "A Weight-Dependent 1RM Prediction Equation Optimized on 303,494
// Near-Failure Sets Across 388 Exercises" (arXiv 2603.17495) covers far more
// movements than any lab study ever will. It is probably still the wrong
// instrument: it fits how REPS TO FAILURE predict a 1RM WITHIN an exercise,
// which is a different quantity from how one exercise's 1RM relates to
// another's, and a per-exercise coefficient in that equation is not a prCoef.
// Reading it here also failed for a dull reason -- the PDF's text is
// font-encoded and did not extract.
//
// What WOULD answer this file is the dataset underneath it rather than the
// paper: logged sets from users who train several variations would give
// within-subject ratios directly, at a sample size no protocol can match. If
// that data is ever reachable, it is worth more than every source cited above
// put together. Noted as a direction, not as evidence -- nothing here is
// sourced on a paper nobody has read.

export const COEF_PROVENANCE = {
  // INVESTIGATED 2026-09-03 AND LEFT UNSOURCED. See "WHERE THE READING RUNS
  // OUT" above -- this is the clearest instance of it.
  //
  // The one relevant paper (Swinton et al., PubMed 22505136) compares the
  // traditional, powerlifting and box squats in 12 male powerlifters, and the
  // subjects lifted at 30, 50 and 70% OF THEIR BACK SQUAT 1RM in all three
  // variations. One 1RM, three exercises: the design cannot produce a ratio
  // between them, whatever else it produces. What it reports is peak joint
  // moments, which is not the quantity this file needs.
  "box-squat"                 : { coef: 0.9  , of: "back-squat"      , tag: 'unverified' },
  // SOURCED 2026-09-03 AND HELD UNCHANGED, the second entry to survive contact
  // with the literature. Three within-subject 1RM comparisons, and they agree
  // more tightly than any other family in this register:
  //   Vantrease et al. (n=32 trained men): 144.7 vs 128.8 kg, back squat
  //     +11.6%  ->  0.890
  //   n=12 competitive powerlifters: +11.3%  ->  0.898
  //   a third comparison: +10.9%  ->  0.902
  //   https://www.strongerbyscience.com/safety-bar-squats/
  //   https://pubmed.ncbi.nlm.nih.gov/38595263/
  // The band is 0.890-0.902 and the inherited 0.90 sits inside it. Unlike
  // close-grip above, the sources here do not disagree -- a 0.7-point spread
  // is agreement -- so there is no lower bound to prefer, and trap-bar's
  // precedent applies: the value needed no correction. Taking the bottom of
  // the band anyway would be 0.89, a 1% change and a false precision.
  //
  // 'corroborated', not 'verified', for trap-bar's reason: a tag describes the
  // strength of the claim, not the prestige of the citation. Three samples of
  // 12-32 people agreeing is strong; it is not a measurement of the ratio.
  "safety-bar-squat"          : { coef: 0.9  , of: "back-squat"      , tag: 'corroborated' },
  // SOURCED 2026-09-03, AND IT MOVED DOWN. 0.85 -> 0.78.
  //
  // Gullett et al. 2009 (JSCR 23(1):284-292) is the right shape of evidence
  // for this register and the first sub-parity entry to get one: the SAME 15
  // subjects (9M, 6F) performed both lifts, and every one had at least a year
  // of front AND back squatting at least weekly, so the ratio is not
  // confounded by which lift they train.
  //   back squat  61.8 kg   front squat  48.5 kg   ->  0.785
  //   https://pubmed.ncbi.nlm.nih.gov/19002072/
  //
  // 0.78 rather than 0.79, on §8's asymmetry, and rounding toward the lower
  // of the estimates seen rather than away from it.
  //
  // 'corroborated', not 'verified'. One study at n=15 measures those fifteen
  // people; it does not measure the ratio. The coaching bands agree with its
  // direction -- 75-85% is the commonly quoted range for lifters who do both,
  // and 0.85 sat at the very top of that band.
  //
  // WHAT IS STILL OWED, and it points DOWN, not up. Every source agrees the
  // ratio is a function of TRAINING EMPHASIS rather than leverage: coaching
  // puts it near 90% for weightlifters who mostly front squat and at 50-60%
  // for lifters who mostly back squat. Gullett's subjects trained both. HE
  // DID NOT -- he is a retired college football athlete, and football programs
  // back squat. So 0.78 is very likely still high for him specifically, and
  // the honest floor is unknown. It is not moved further on a forum-sourced
  // band; that would be inventing a number wearing a safety costume, which is
  // this project's signature failure. Recorded as standing debt instead.
  "front-squat"                : { coef: 0.78 , of: "back-squat"      , tag: 'corroborated' },
  "pause-squat"               : { coef: 0.85 , of: "back-squat"      , tag: 'unverified' },
  "zercher-squat"             : { coef: 0.65 , of: "back-squat"      , tag: 'unverified' },
  "good-morning"              : { coef: 0.4  , of: "back-squat"      , tag: 'unverified' },
  // INVESTIGATED 2026-09-03 AND LEFT UNSOURCED. This entry was the TEST of the
  // generalisation above rather than another instance of it: floor press is
  // the borderline case, common enough in powerlifting to plausibly have been
  // 1RM-tested but not common enough to be certain. It has not been. What
  // exists is the same standards-site class of source the register already
  // rejects, and the range-of-motion literature studies partial vs full ROM
  // training EFFECTS, not the 1RM either produces.
  //
  // Recorded as a confirmation, because a generalisation nobody tried to break
  // is just an assertion.
  "floor-press"               : { coef: 0.92 , of: "bench-press"     , tag: 'unverified' },
  // INVESTIGATED 2026-09-03 AND LEFT UNSOURCED. A NEGATIVE RESULT, recorded so
  // the next pass does not spend the same hour.
  //
  // The paused/touch-and-go 1RM ratio does not appear to have been measured.
  // What exists is powerlifting coaching on why a competition pause is trained
  // (it removes the stretch-shortening contribution) and forum self-reports,
  // which is not evidence of a ratio. The DIRECTION is not in doubt and the
  // library already has it right -- a paused press is lighter, and this entry
  // sits below 1.00. The MAGNITUDE, 8%, has nothing behind it.
  //
  // Note the root is a touch-and-go press: `bench-press`'s cues say "bar to
  // the lower chest" and never mention a pause, so the comparison is at least
  // well-posed. That is worth more than it sounds -- it is the condition
  // incline-bench and close-grip needed before their studies could be used.
  "pause-bench-press"         : { coef: 0.92 , of: "bench-press"     , tag: 'unverified' },
  // SOURCED 2026-09-03, AND IT IS THE FIRST ONE THAT WAS TOO LOW. 0.90 -> 0.93.
  //
  // Lockwood et al. (PMC5968970): n=27 resistance-trained (21M, 6F, >=2 years,
  // >=2 sessions/week, experienced with maximal lifts), repeated measures, the
  // same people on both lifts.
  //   traditional  87.35 +/- 27.23 kg     close-grip  83.03 +/- 24.67 kg
  //   83.03 / 87.35 = 0.951, a significant but trivial effect (d = 0.17)
  //   https://pmc.ncbi.nlm.nih.gov/articles/PMC5968970/
  //
  // AND THE GRIP MATCHES, which is the second time the library's own cues have
  // made a study usable. CGBP was standardised at 95% of biacromial distance;
  // biacromial distance IS shoulder width, and this entry's first cue says
  // "Hands about shoulder-width -- close, not touching in the middle."
  //
  // 0.93, NOT the measured 0.951. Between-subject competition data puts the
  // ratio nearer 0.93-0.94, so the estimates disagree and the LOWER is taken,
  // exactly as the overhead-press ladder did. That rule was written to stop
  // overloads; here it costs a little load instead, and it is applied in the
  // direction that is inconvenient rather than only when convenient.
  //
  // Worth noting that this is a coefficient RISING, which puts more weight on
  // the bar than yesterday. It is defensible because the root's own cue
  // mandates a spotter or rack pins, and because 0.90 was below every estimate
  // found rather than inside the spread.
  "close-grip-bench-press"    : { coef: 0.93 , of: "bench-press"     , tag: 'corroborated' },
  // SOURCED 2026-09-03, AND IT MOVED DOWN. 0.85 -> 0.78. The best-evidenced
  // entry in this register.
  //
  // Rodriguez-Ridao et al. 2020, Int J Environ Res Public Health 17(19):7339.
  // n=30 trained adults (>=1 year, >=3 sessions/week). The SAME subjects were
  // tested at five inclinations and 1RM WAS MEASURED SEPARATELY AT EACH ONE,
  // in randomised counterbalanced order -- so this is a direct measurement of
  // the quantity this register needs, not a ratio inferred from two studies.
  //     0 deg  81.4 +/- 15.5 kg      45 deg  57.9 +/- 9.7 kg
  //    15 deg  72.0 +/- 14.0 kg      60 deg  52.2 +/- 9.0 kg
  //    30 deg  63.3 +/- 12.3 kg
  //   63.3 / 81.4 = 0.778
  //   https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505/
  //
  // AND IT LANDS ON THE RIGHT ANGLE. This entry's own first cue says "Bench at
  // about 30 degrees -- steeper turns it into a shoulder press", so the 30 deg
  // row is the one that applies. Had the library not pinned an angle the study
  // would have been unusable here: 0.78 at 30 deg and 0.64 at 60 deg are the
  // same exercise name and a 22% difference in what goes on the bar.
  //
  // 'corroborated', not 'verified'. One sample of 30 measures those thirty
  // people. The commonly quoted population range for 30 deg is 80-85% of flat,
  // which brackets the measured value from ABOVE, so they disagree slightly
  // and 0.78 is the lower -- §8's asymmetry again, and the same direction
  // front-squat moved. 0.85 was the top of the population band being used as
  // if it were the middle.
  //
  // A widely repeated "flat is 28.6% higher than incline" traces to THIS
  // study and no other: 81.4 / 63.3 = 1.286. It is the same finding quoted
  // upside down, not independent support, and is not counted twice.
  "incline-bench-press"       : { coef: 0.78 , of: "bench-press"     , tag: 'corroborated' },
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
  // INVESTIGATED 2026-09-03 AND LEFT AT 1.00, because THERE IS NO POPULATION
  // RATIO TO FIND. This is rack-pull's outcome reached by a different road.
  //
  // The literature on sumo vs conventional is biomechanics -- joint moments,
  // EMG, bar path, lever distance -- and a joint moment is not a 1RM ratio, the
  // same category error rack-pull's note already rejects. The 1RM comparisons
  // that do exist are unusable in opposite ways:
  //   - Between-subject competition data is SELF-SELECTED. Lifters choose the
  //     style they are better at, and sumo "disproportionately rewards people
  //     who already have great leverages", so the best deadlifters are
  //     disproportionately sumo pullers. The elite "sumo is 20-25% more" figure
  //     describes who chose sumo, not what a ratio is.
  //   - The one within-subject comparison found conventional > sumo in subjects
  //     who ALSO had more conventional training experience. That is a skill
  //     effect wearing a leverage effect's clothes.
  // The honest conclusion is that this ratio is individual and dominated by
  // which style is trained -- the same finding as front-squat above, where the
  // spread runs 50-60% to 90% on training emphasis alone.
  //
  // SO WHY LEAVE 1.00, when front-squat moved on the same reasoning? Because
  // the failure mode is benign and unique in this register. A sumo pull that
  // is too heavy DOES NOT MOVE: the bar stays on the floor, which is the
  // safest miss in the library -- nothing is caught overhead, nothing has to
  // be escaped from under. §8's asymmetry is about the cost of being high, and
  // here that cost is a wasted set in both directions.
  "sumo-deadlift"             : { coef: 1    , of: "deadlift"        , tag: 'unverified' },
  "deficit-deadlift"          : { coef: 0.85 , of: "deadlift"        , tag: 'unverified' },
  // INVESTIGATED 2026-09-03 AND LEFT UNSOURCED, but the DIRECTION was checked
  // and it is the safe one.
  //
  // No primary literature. What exists is calculator sites and forums, and
  // this register has already rejected that class of source once, when
  // Strength Level's per-lift means implied a push jerk heavier than a split
  // jerk. Worse, those pages mix the two quantities freely: "use 50-70% of
  // your deadlift for RDLs" is a training prescription and "RDL 1RM is 70-85%
  // of deadlift 1RM" is a capacity, and the same page will print both.
  //
  // Every capacity band quoted -- 65-85%, 70-80%, 70-85% -- sits AT OR ABOVE
  // the inherited 0.70. So the number is not sourced, but it is at the bottom
  // of the range everyone claims, which is the direction §8 says to err. It
  // is left alone rather than raised toward a band no primary source supports:
  // raising it would put weight on the bar on the authority of an SEO page.
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
  // INVESTIGATED 2026-09-03 AND LEFT UNSOURCED, HAVING NEARLY BEEN "SOURCED"
  // BY A NUMBER THAT MEANS SOMETHING ELSE. Recorded because the trap is
  // subtle and the next pass will meet it too.
  //
  // Everett gives hang power clean loading as "about 70-80%", and 0.90 sits
  // above that, so it reads as an overload found. IT IS NOT A 1RM RATIO. That
  // is a PRESCRIPTION -- what to put on the bar on a lighter technique day --
  // and this register's coefficients are CAPACITIES, which the day type's
  // envelope then takes a percentage of. Using it would apply the training
  // percentage twice and halve the load.
  //   https://www.catalystathletics.com/article/1917/
  //
  // The same category error as rack-pull's force-plate data and sumo's joint
  // moments: three different quantities that all look like the one this file
  // needs. A number is only usable here if it answers "what is the most he
  // could lift", and a coach answering "what should he lift today" is not
  // answering it.
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
// Lowered 23 -> 21 on 2026-09-03 for front-squat and incline-bench-press, the
// FIRST SUB-PARITY entries to be paid off. Both were 0.85 and both moved to
// 0.78; both had been sitting at the top of a population band as though it
// were the middle of one.
// Lowered 21 -> 20 the same day for close-grip-bench-press, which went the
// OTHER WAY: 0.90 was below every estimate found, and it rose to 0.93. Worth
// recording that the register is not a one-way ratchet on the numbers even
// though it is one on the debt -- three of the four sub-parity entries sourced
// so far were wrong, and they were not all wrong in the safe direction.
// Two more were investigated and honestly left alone: pause-bench-press (no
// measurement of the ratio appears to exist) and sumo-deadlift (no population
// ratio exists to find). Negative results are recorded at their entries so the
// next pass does not re-spend the search.
// Lowered 20 -> 19 for safety-bar-squat, SOURCED AND UNCHANGED. Three
// within-subject studies put it at 0.890-0.902 and the inherited 0.90 is
// inside that. The debt falls when a number gains a source, not when it
// changes -- trap-bar established that and this is the second case. The work above the line is finished as far as reading can
// take it, so the remaining debt is the cheap-to-be-wrong half: an error
// under 1.00 wastes a set where an error above it is an overload. That does
// not make these free -- front-squat was 9% high against the only
// within-subject measurement there is.
export const UNVERIFIED_BUDGET = 19;
