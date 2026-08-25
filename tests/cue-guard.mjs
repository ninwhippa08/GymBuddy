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
export const CUED_POOLS = ['mobility-static', 'mobility-dynamic', 'core'];

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
  const seen = new Set();
  for (const c of entry.cues) {
    const k = String(c).trim().toLowerCase();
    if (seen.has(k)) problems.push(`duplicate cue: "${c}"`);
    seen.add(k);
  }
  return problems;
}
