// Six frames of a movement demo, tiled into ONE image.
// design-library-expansion.md §14.1.
//
//   node tools/contact-sheet.mjs --url "https://www.youtube.com/watch?v=..." --name elvis
//   node tools/contact-sheet.mjs --url "..." --name elvis --out C:\some\dir
//
// Prints the path of the .jpg it wrote. Look at that one image and you can
// usually settle `joints`, `unilateral`, `pattern` and `technical` -- and write
// honest cues, which a name alone does not let you do.
//
// WHY NOT /watch. These clips are 4-15 seconds and SILENT: no narration, so no
// captions, so the transcript path returns nothing at all (tested on both
// playlists). What is left is frames, and frames are the expensive thing to
// look at. One tiled sheet per movement is roughly a fifteenth of the cost of a
// frame dump and has been enough every time it was needed.
//
// WHAT IT CANNOT TELL YOU. `prCoef` -- a load coefficient is a measurement and
// no video is one; the coefficient ratchet refuses it and is right to. And it
// is not always enough: "3 Way Ab." was watched and still could not be filed,
// so it was declined rather than guessed at. A movement nobody can describe
// accurately does not get invented cues.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const argOf = flag => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};

const url = argOf('--url');
const name = argOf('--name');
const outDir = argOf('--out') || join(tmpdir(), 'gymbuddy-sheets');

if (!url || !name) {
  console.error('usage: contact-sheet.mjs --url <video> --name <slug> [--out <dir>]');
  process.exit(2);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error(`--name "${name}" should be a lower-case slug, e.g. mini-band-elvis`);
  process.exit(2);
}

// WinGet puts both shims here and adds it to the persisted PATH, which a
// running shell may predate. Try the bare name first so a normal install works,
// then the shim directory, rather than making the caller know which.
const WINGET = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links`;
function run(names, argv, opts = {}) {
  let lastErr = null;
  for (const bin of names) {
    try { return execFileSync(bin, argv, { encoding: 'utf8', stdio: 'pipe', ...opts }); }
    catch (e) { lastErr = e; }
  }
  throw new Error(`could not run ${names[0]}: ${lastErr && lastErr.message}`);
}
const YTDLP = ['yt-dlp', join(WINGET, 'yt-dlp.exe')];
const FFMPEG = ['ffmpeg', join(WINGET, 'ffmpeg.exe')];
const FFPROBE = ['ffprobe', join(WINGET, 'ffprobe.exe')];

mkdirSync(outDir, { recursive: true });
const work = join(tmpdir(), `gymbuddy-cs-${process.pid}`);
mkdirSync(work, { recursive: true });

try {
  // Lowest resolution that still shows a body clearly. The sheet is scaled to
  // 320px wide per frame anyway, so a 1080p download is pure waste.
  process.stderr.write(`downloading ${name} ...\n`);
  run(YTDLP, ['-f', 'worstvideo[height>=360]/worst', '--no-playlist',
              '-o', join(work, 'clip.%(ext)s'), url]);

  const file = readdirSync(work).map(f => join(work, f))[0];
  if (!file) throw new Error('yt-dlp produced no file');

  // Duration decides the frame spacing: six frames spread across the whole
  // clip, not six frames of the first second. A 4 s clip and a 15 s clip both
  // want the movement's start, middle and end.
  let seconds = 8;
  try {
    const out = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration',
                              '-of', 'default=noprint_wrappers=1:nokey=1', file]);
    const parsed = parseFloat(out.trim());
    if (Number.isFinite(parsed) && parsed > 0) seconds = parsed;
  } catch { /* the default is fine; a sheet is better than an error here */ }

  const fps = Math.max(6 / seconds, 0.1);
  const sheet = join(outDir, `${name}.jpg`);
  run(FFMPEG, ['-y', '-i', file,
               '-vf', `fps=${fps.toFixed(4)},scale=320:-1,tile=3x2`,
               '-frames:v', '1', sheet]);

  if (!existsSync(sheet)) throw new Error('ffmpeg produced no sheet');
  console.log(sheet);
} finally {
  rmSync(work, { recursive: true, force: true });
}
