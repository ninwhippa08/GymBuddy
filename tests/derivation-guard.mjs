// Rules for the optional `derivedFrom` field. design-library-expansion.md §11.
//
// Test-side rather than app-side for the same reason as the cue guard and
// `coef-provenance.mjs`: the library is authored in this repo and gated by this
// suite, so a malformed entry can never reach a user, and design §2's "this
// project does not change the schema" holds.
//
// WHAT THIS GUARD IS FOR. A derived variant copies eight fields off a reviewed
// parent. Derivation rots in one specific way: the parent changes -- a joint is
// added, a cnsCost is repriced -- and the children keep the old values. Nothing
// else in the suite would notice, because both entries still look well-formed
// on their own. This makes the parent link load-bearing: repricing a parent
// fails the suite until its children are repriced with it.

// The inherited set is the definition of a derived variant, not a convenience.
// Each field is an input to something that breaks silently if a variant drifts:
// `joints` is the soreness filter's only input; `cnsCost` and `technical` price
// the session; `tier` and `pattern` decide which slot the entry can ever reach.
//
// `venue` is NOT on the list, and that was measured rather than assumed. In
// this library venue is a FUNCTION of the implement -- barbell, cable, machine,
// plates, landmine and bench are `gym` in every one of their entries;
// bodyweight, kettlebell, bands and wall are `either` in all but one. So
// inheriting venue across a moved implement axis is self-contradictory: it is
// the same axis under another name, and it would forbid exactly the variants
// worth having (a band Pallof press is the one you can do away from the gym).
// The rule that survives is VENUE_FOLLOWS_IMPLEMENT below: a variant that did
// not move the implement may not move the venue either.
//
// `isometric` joined the list on 2026-09-04, during the core pilot and before
// any entry was authored. It is the switch at generator.js:1214 that decides
// whether the card prescribes a HOLD IN SECONDS or REPS, which makes it a
// dose-shaping field of exactly the same kind as cnsCost. A variant that flips
// it has not moved one axis -- it has changed what the movement is, and that
// is authored fresh under design §8 rather than derived. It is absent on
// rep-based entries, and absent inherits as absent.
//
// `targets` joined on 2026-09-05, and it is the same argument as `pattern`.
// It names the movement patterns a drill or stretch serves, and the prep and
// cool-down select on it (design-mobility-and-warmup.md §9), so it decides
// which DAY an entry can ever be drawn for exactly as `pattern` decides which
// SLOT. It was added to the library in v38 without being added here, which
// left a variant free to re-aim itself silently -- a lateral leg swing filed
// under `squat`/`lunge` while its parent prepares a hinge would simply stop
// appearing on the days its parent appears on, and nothing would say so.
// Closed before the first derived mobility entry exists (15 derived entries
// at the time, none of them tier `mobility`, zero mismatches), which is the
// only moment a guard like this is free. Absent inherits as absent, as with
// `isometric`: only the 38 mobility entries carry the field at all.
export const INHERITED = [
  'pattern', 'tier', 'joints',
  'cnsCost', 'technical', 'unilateral', 'modalities', 'isometric', 'targets'
];

export const VENUES = ['gym', 'either', 'outdoor'];

// Order in a joints or modalities list carries no meaning, so it is not a
// difference. Everything else compares by value.
const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length &&
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return a === b;
};

const show = v => Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v);

export function derivationProblems(entry, byId) {
  const problems = [];
  if (!('derivedFrom' in entry) || entry.derivedFrom == null) return problems; // optional

  const ref = entry.derivedFrom;
  if (typeof ref !== 'string' || ref.trim() === '') {
    problems.push('derivedFrom must name a parent id');
    return problems;                            // nothing else can be checked
  }
  if (ref === entry.id) {
    problems.push('an entry cannot be derived from itself');
    return problems;
  }
  const parent = byId[ref];
  if (!parent) {
    problems.push(`derivedFrom names "${ref}", which is not in the library`);
    return problems;
  }
  // Depth is one, so every variant is a single edit away from a line a human
  // reviewed. Chains would let three small drifts add up to an entry nobody
  // has ever checked.
  if (parent.derivedFrom != null) {
    problems.push(
      `derivation is one deep; parent "${ref}" is itself derived from "${parent.derivedFrom}"`);
    return problems;
  }

  for (const field of INHERITED) {
    if (!same(entry[field], parent[field])) {
      problems.push(
        `${field} is ${show(entry[field])} but parent "${ref}" has ${show(parent[field])}`);
    }
  }

  // VENUE_FOLLOWS_IMPLEMENT. A stance or angle variant uses the parent's kit,
  // so it is available exactly where the parent is; drift there is the silent
  // kind and is caught. A variant that moved the implement declares its own
  // venue, because that is the consequence the implement axis exists to have.
  if (!VENUES.includes(entry.venue)) {
    problems.push(`venue ${show(entry.venue)} is not one of ${VENUES.join(', ')}`);
  } else if (same(entry.equipment, parent.equipment) && entry.venue !== parent.venue) {
    problems.push(
      `venue is ${show(entry.venue)} but parent "${ref}" has ${show(parent.venue)}, ` +
      'and the implement did not move');
  }

  // A variant whose cues are byte-identical to its parent's has not moved an
  // axis worth an entry. The method is: inherit the parent's lines, rewrite
  // only the line the moved axis actually changes.
  if (Array.isArray(entry.cues) && Array.isArray(parent.cues) &&
      JSON.stringify(entry.cues) === JSON.stringify(parent.cues)) {
    problems.push(`cues are identical to parent "${ref}" -- no axis has moved`);
  }

  // A prCoef is a dose measured on the parent, and derivation never inherits a
  // measurement. An entry whose coefficient really was measured in its own
  // right is not a derivation -- it is authored fresh under design §8.
  if (entry.loadable === true && parent.loadable === true &&
      entry.prCoef != null && entry.prCoef === parent.prCoef &&
      entry.prRef === parent.prRef) {
    problems.push(
      `load coefficient ${entry.prCoef} off ${entry.prRef} is copied from parent "${ref}"; ` +
      'a coefficient is a measurement and is never inherited');
  }

  return problems;
}
