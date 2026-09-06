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
