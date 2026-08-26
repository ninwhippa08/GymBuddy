// Rules for the optional `cues` field. design-card-flip.md §3.
//
// Test-side rather than app-side on purpose: the library is authored in this
// repo and gated by this suite, so a malformed entry can never reach a user.
// The app does not need to re-check at runtime.

export const MAX_CUE_CHARS = 90;   // what keeps the back of a card the size of the front
export const MAX_CUES = 4;

// Pools whose cues are written. Adding a line here is how a backfill commit
// becomes permanent -- an entry added to a cued pool later cannot arrive blank.
// Empty until the first backfill; this plan ships the mechanism, not the text.
export const CUED_POOLS = ['mobility-static', 'mobility-dynamic', 'core', 'sprint', 'primary'];

export function cueProblems(entry) {
  const problems = [];
  if (!('cues' in entry) || entry.cues == null) return problems;   // optional

  if (!Array.isArray(entry.cues)) {
    problems.push('cues must be an array of lines, not a paragraph');
    return problems;                            // nothing else can be checked
  }
  if (entry.cues.length < 1 || entry.cues.length > MAX_CUES) {
    problems.push(`cues must hold 1-4 lines, found ${entry.cues.length}`);
  }
  entry.cues.forEach((c, i) => {
    if (typeof c !== 'string' || c.trim() === '') {
      problems.push(`cue ${i + 1} is empty`);
      return;
    }
    if (c.length > MAX_CUE_CHARS) {
      problems.push(`cue ${i + 1} is ${c.length} chars, over the ${MAX_CUE_CHARS} limit`);
    }
  });
  // A cue may not restate the entry's own load coefficient. The front of the
  // card already prints the multiplier the generator computed, so a percentage
  // in the prose is redundant AND it is a second copy of a number that can
  // drift -- the same failure the coefficient register exists to prevent, moved
  // into user-facing text where no test would otherwise look. Effort
  // percentages on unloaded movements ("reach about 90% by the end" on a
  // build-up run) are a different claim and are left alone.
  if (entry.loadable === true && entry.prCoef != null) {
    entry.cues.forEach((c, i) => {
      if (typeof c === 'string' && /\d+\s*%|\btimes your\b/.test(c)) {
        problems.push(
          `cue ${i + 1} quotes a load percentage; the card already prints the multiplier`);
      }
    });
  }

  const seen = new Set();
  for (const c of entry.cues) {
    const k = String(c).trim().toLowerCase();
    if (seen.has(k)) problems.push(`duplicate cue: "${c}"`);
    seen.add(k);
  }
  return problems;
}
