# Playlist fixtures

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
