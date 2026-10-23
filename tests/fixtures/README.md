# Fixtures

## `full-volume-v77.json`

`generate()` output for `max-strength`, `power` and `hypertrophy`, seeds 1-40,
captured from the tree at v77 (35221f3, before the ramp's percentage became a
session-level budget) with `profile: {}` -- no `returnDate` declared, which
`rampWeekFor` treats as "no ramp declared" and returns `RAMP.length` (5)
directly, so `env.volumeMultiplier` is 1 and the ramp is a no-op. Verified
against `atWeek(5)` (a completed ramp, which lands on the same `RAMP[4]` row)
across all three day types and all 40 seeds before capture: 0 mismatches.
Each entry is `blocks.map(b => [b.slot, b.sets, b.reps, b.footContacts ?? null, b.sprintMeters ?? null])`
-- `footContacts`/`sprintMeters` null, not omitted, on any block that never
carried either, so every entry has the same shape.

Committed because `tests/ramp-budget.test.mjs`'s "full volume is unchanged,
block for block" test used to compare two live full-volume profiles against
each other -- `atWeek(5)` against a second profile. Both go through the same
code, so a change that moved both by the same amount would pass undetected;
the test could not see the one failure mode it was named for. This fixture is
the tree's actual output from before the behavioural change, so the same test
can now assert against a value that cannot drift with the code it is checking.

**Widened to `footContacts`/`sprintMeters` in the fix round after `5beb094`.**
`[slot, sets, reps]` alone cannot see the round's Critical -- `prescribe()`
denormalises both counters from the set count as drawn, and
`rampToBudget`/`packToBudget`/`capPatternSets` can all remove sets afterward
via `dropWorkingSet` without either counter following. `rampToBudget` is a
no-op at full volume, but `packToBudget` and `capPatternSets` are not, so a
contacts block shaved by either at full volume would drift here too -- this
40-seed sample just does not happen to exercise that path (checked directly:
'full volume is unchanged, block for block' stayed green with the fix
reverted). The comprehensive guard, run across all five ramp weeks
('footContacts and sprintMeters track delivered sets, not drawn ones'), is
what actually caught the bug; this widening is a second, independent net for
the same defect, not the one that found it. Recaptured from a worktree at
`af71716` (`git worktree add <tmpdir> af71716`), not from HEAD: HEAD already
carries the fix, so regenerating there would assert the new code against
itself -- the exact mistake this fixture exists to avoid. `af71716` is the
fixture-only commit right before the behavioural change (`5beb094`), so its
`generate()` is the last one that predates both defects this fixture now has
to catch (the ramp defect and the counter desync).

**This is the second capture.** The first (git history only, superseded by
this commit) used `profile: { returnDate: '2020-01-01' }`, copied verbatim
from the original test's comparison profile. That was wrong: the test harness
fixes `now: 1e12`, which is 2001-09-09, and `2020-01-01` is *after* that fake
"now" -- so `rampWeekFor` computed a negative `days` and took its `days < 0`
branch, returning ramp week 1 (volume 0.50, pctCeiling 0.65), not a completed
ramp. The first fixture pinned week-1-ramped output under the old per-block
rounding while its own name and the test it fed claimed to pin full volume.
Caught by running the comparison it would be asserted as -- `atWeek(5)`
against the candidate full-volume profile -- and finding 120/120 mismatches
before ever trusting the fixture.

## `work-v78.json`

The working sets of `generate()` for every day type in `PHASE_1_DAY_TYPES` (7),
ramp weeks 1-5, seeds 1-20 (700 sessions), keyed `fixture[dayType][week][seed]`.
Each value is `blocks.map(workPrint)`, where `workPrint` (in
`tests/work-held.test.mjs`) is `[slot, exerciseId, sets, reps,
displayMultiplier, architecture, [[reps, displayMultiplier], ...]]`, the last
item taken from the `work` entries of `setPlan`. Warm-up entries are left out
on purpose: they are what the v79 change alters. Weeks use the same
`atWeek(w)` and `now: 1e12` as `tests/ramp-budget.test.mjs`.

Captured from `eaf4f92`, whose `generate()` is v78's (the commits since
`5758824` only touch docs).

Why it exists: warm-up sets are priced into the session's time budget, so
cutting rungs frees time, and freed time can let the packer keep a working set
it used to drop. The warm-up change must leave the work untouched, and that can
only be shown against output from before it.

**Never regenerate this from a tree that carries the warm-up change.** That
would assert the new code against itself, the mistake `full-volume-v77.json`
was recaptured to avoid. If it must be rebuilt, check out `eaf4f92` in a
worktree and run `CAPTURE_WORK=1 node --test tests/work-held.test.mjs` there.

## `nonlifting-v79.json`

`generate()` output for every day type that declares no `targets` --
`aerobic-steady`, `interval`, `sprint`, `plyometric` and `mobility` -- at ramp
weeks 1 and 5, seeds 1-20 (200 sessions), keyed `fixture[dayType][week][seed]`.
Each value is `{ blocks, durationMin }`, where `blocks` is
`s.blocks.map(b => [b.slot, b.exerciseId, b.sets, b.reps ?? null, b.durationMin ?? null])`.
Weeks use the same `atWeek(w)` and `now: 1e12` as `tests/ramp-budget.test.mjs`.

Captured from `00dafd7` (v79's behaviour; the commits after `22cd07c` only touch
docs) with `CAPTURE_NONLIFTING=1 node --test tests/compose.test.mjs`, BEFORE
any line of the session-composition change was written.

Why it exists: `docs/superpowers/specs/2026-10-22-session-composition-design.md`
changes how lifting sessions are composed and lists the non-lifting day types
as a non-goal -- unchanged, including their `packToBudget` call. The fill loop
and the packer they share are exactly what that change edits, so "unchanged"
can only be shown against output from before it. Read by
`'non-lifting day types are unchanged'` in `tests/compose.test.mjs`.

**Never regenerate this from a tree that carries the composition change.** If
it must be rebuilt, check out `00dafd7` in a worktree and run the capture there.

## Playlist fixtures

Title lists pulled from YouTube channels, kept so `tools/playlist-diff.mjs`
can be re-run and tested without a network call.

**Format is one title per line, nothing else.** `playlist-diff.mjs --titles`
treats every line as a title -- it has no comment syntax -- so a `#` header
inside one of these files becomes a phantom entry in the diff. Provenance
belongs here, not in the data.

## `movement-as-medicine-titles.txt`

[@MovementAsMedicine](https://www.youtube.com/@MovementAsMedicine), pulled
2026-09-06 with `yt-dlp --flat-playlist` across all 40 channel playlists.

**218 unique videos on the channel, 107 kept.** The athlete's brief was that
the playlists are polluted, and the pollution came in two layers:

| Removed | n | What |
|---|---|---|
| talk-only playlists | 94 | podcast (median 60 min), webinars (median 79 min), MBSC.tv, Training Talk, Slidin' In The DMs, Misc Educational, Example Workouts, Fitness Fundamentals, The Movement |
| over 5 min inside a MOVEMENT playlist | 3 | a 15 min warm-up compilation, a deadlift teaching video, a 5 min stick circuit |
| multi-movement or educational | 12 | compilations ("Top 5 Exercises…"), routines, a kettlebell complex that is three lifts, two talks |
| duplicate titles | 2 | same movement filmed twice |

Duration is what separates the two populations, not the playlist name: every
movement playlist has a median of 30-80 s, the podcast 3632 s. But duration
alone is not enough -- the 200-300 s band still held compilations and a talk,
which is why there is an explicit exclusion list in the pull script.

The channel files one clip under several playlists (**400 memberships for 218
videos**), so the plane / laterality / pattern playlists are re-filings rather
than new content. Deduped by video id before anything else.

Committed because the v53 Depth Training pull was **not**, and had to be
re-pulled to build a fixture at all.

## `e3-rehab-titles.txt`

[@e3rehabexerciselibrary](https://www.youtube.com/@e3rehabexerciselibrary),
pulled 2026-09-07 with `yt-dlp --flat-playlist` across all 80 channel
playlists.

**2224 unique videos on the channel, 2205 kept.** This is ten times the size of
any previous pull and it is polluted in a different way, so the two filters that
did the work before both come off.

**There is no duration signal here, because there are not two populations.**
Every video on the channel is a short silent clip: 7 s to 67 s, median 14. The
podcast-versus-movement split that separated Movement As Medicine does not
exist, and a duration cutoff would remove nothing.

**Re-filing is low.** 2562 memberships for 2224 videos, 1.15 each, against
Movement As Medicine's 400-for-218. The playlists are a joint-and-action index
rather than the same clips re-shelved by plane and laterality, so a playlist
name is a usable classifier here in a way it was not there.

| Removed | n | What |
|---|---|---|
| assessment playlists | 18 | Wrist, Elbow and Cervical Spine assessments plus Neurodynamics / Upper Limb Tension Tests -- a **measurement**, not a prescription. "Wrist Flexion Range of Motion" is 14 s of a clinician reading a goniometer. |
| tutorial | 1 | "How to Set Up Your Bands at Home" |

**Not one of the 19 is filed anywhere else on the channel**, so the exclusion is
by whole playlist and needs no per-video judgement. The assessment category is
new -- no previous playlist contained any -- and `tools/playlist-diff.mjs` does
not detect it, because a title like "Elbow Flexion and Extension Range of
Motion" is indistinguishable from a mobility drill by name alone. It is the
playlist that gives it away.

**A pull delimiter bit.** The first pass used `|` to separate fields, and both
the playlist titles and 64 video titles contain one -- so those 64 arrived
truncated to the fragment after their last pipe, and collapsed onto each other
as duplicates. Re-pulled with tabs. If this is pulled again, do not use `|`.
