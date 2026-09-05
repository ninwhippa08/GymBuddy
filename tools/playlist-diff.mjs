// Diff a coach's YouTube playlist against the library.
// design-library-expansion.md §14, §15.
//
//   node tools/playlist-diff.mjs --url "https://www.youtube.com/playlist?list=..."
//   node tools/playlist-diff.mjs --titles scratch/titles.txt
//
// Prints four buckets and writes nothing. The judgement -- is this movement
// genuinely new, what are its joints, what should the cues say -- is not
// mechanical and is left alone, exactly as tools/derive.mjs leaves it.
//
// WHY THIS EXISTS. Two playlists were mined by hand on 2026-09-05 and the same
// filtering was rebuilt from scratch both times. It is not hard, but it is
// fiddly and easy to do slightly differently on the second pass, which is how a
// duplicate reaches the library. The decline categories below are the ones both
// passes settled on, so they are written down once.
//
// COST NOTE, because it is the whole reason this is cheap: `yt-dlp
// --flat-playlist` reads titles from the playlist index and downloads NO video.
// A 260-video playlist costs a few seconds. Identifying a movement from a
// SILENT clip is the expensive half, and that is tools/contact-sheet.mjs.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

// --------------------------------------------------------------------------
// What is not a movement
// --------------------------------------------------------------------------

// A METHOD written onto a lift. This app prescribes tempo, dose and effort
// separately from the exercise, so "Tempo Front Squat" is front-squat with an
// instruction attached -- one row, not two. The landing progressions
// (with Stick / mini bounce / Continuous) are the same claim about a jump.
// 45 of playlist 2's 262 titles were this. §15.1.
const METHOD = /^(tempo|eccentric|isometric|continuous)\b|1 and a half|one and a half|with stick|with mini ?bounce|with minibounce|\b\d-\d-\d\b|\btempo\b/i;

// A DISTANCE or a TIME is a prescription too: "10 Yd Sprint" is a sprint.
const DISTANCE = /\b\d+\s*(yd|yard|yards|m|metre|meter)\b|^timed\b/i;

// A trailing "2" is the facility filming a second camera angle or a
// progression of a clip already in the list. 13 of playlist 1's titles. §14.2.
const SECOND_ANGLE = /\s\(?2\)?$/;

// Two drills chained. The generator draws single movements; a combo would have
// to be two rows, and then it is just the two rows.
const COMBO = /\binto\b|x\s?[23]\s*-|-\s*sprint$|w\/ pass|\b\d command/i;

const NOT_A_MOVEMENT = [
  ['method-on-a-lift', METHOD],
  ['distance-or-time', DISTANCE],
  ['second-camera-angle', SECOND_ANGLE],
  ['chained-combo', COMBO]
];

// --------------------------------------------------------------------------
// Matching
// --------------------------------------------------------------------------

// The abbreviations these facilities actually use, accumulated over two
// playlists. Expanding them before matching is what stops "1 Arm KB Swing"
// reading as unrelated to `single-arm-kettlebell-swing`.
const ABBREV = {
  db: 'dumbbell', kb: 'kettlebell', mb: 'med ball', bb: 'barbell',
  oh: 'overhead', tk: 'tall kneeling', rfe: 'rear foot elevated',
  sldl: 'single leg deadlift', rdl: 'romanian deadlift',
  er: 'external rotation', ir: 'internal rotation', pnf: 'pnf',
  ml: 'lateral', lat: 'lateral', ant: 'anterior', post: 'posterior',
  quad: 'quadruped', add: 'adductor', abd: 'abduction',
  rot: 'rotation', mob: 'mobilization', ext: 'extension',
  alt: 'alternating', opp: 'opposite', pos: 'position', ecc: 'eccentric',
  ss: 'split stance', trx: 'suspension', lax: 'lacrosse', medball: 'med ball',
  't-spine': 'thoracic', tspine: 'thoracic', '1': 'single', '2': 'double'
};

const norm = s => s
  .toLowerCase()
  .replace(/[().:,\/&+]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .map(w => ABBREV[w.replace(/\.$/, '')] || w.replace(/\.$/, ''))
  .join(' ');

const INDEX = LIB.map(e => ({
  id: e.id,
  tokens: new Set(norm(e.name).split(' ').concat(e.id.split('-')))
}));

// Token overlap against the library. Deliberately generous: this is a triage
// step whose output a human reads, and a false "already have it" that stops an
// entry being written is worse than a false "new" that gets checked and
// dropped. The 0.7 threshold was the one that surfaced real duplicates
// (Linear March = a-march) without burying genuine gaps.
function bestMatch(title) {
  const tokens = norm(title).split(' ').filter(w => w.length > 2);
  if (!tokens.length) return { id: null, score: 0 };
  let best = { id: null, score: 0 };
  for (const entry of INDEX) {
    const hits = tokens.filter(w => entry.tokens.has(w)).length;
    const score = hits / tokens.length;
    if (score > best.score) best = { id: entry.id, score };
  }
  return best;
}

// --------------------------------------------------------------------------
// Input
// --------------------------------------------------------------------------

function titlesFromPlaylist(url) {
  // Windows installs yt-dlp to the WinGet shim directory, which is on the
  // persisted PATH but not always on a running shell's. Try the bare name
  // first and fall back rather than making the caller care.
  const candidates = ['yt-dlp', `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\yt-dlp.exe`];
  let lastErr = null;
  for (const bin of candidates) {
    try {
      return execFileSync(bin, ['--flat-playlist', '--print', '%(title)s', url],
                          { encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (e) { lastErr = e; }
  }
  throw new Error(`could not run yt-dlp (${lastErr && lastErr.message}). ` +
                  'Install it, or pass --titles with a file of titles.');
}

const args = process.argv.slice(2);
const argOf = flag => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};

const url = argOf('--url');
const file = argOf('--titles');
if (!url && !file) {
  console.error('usage: playlist-diff.mjs --url <playlist> | --titles <file>');
  process.exit(2);
}

const raw = file ? readFileSync(file, 'utf8') : titlesFromPlaylist(url);

let titles = raw.replace(/^﻿/, '').split(/\r?\n/)
  .map(s => s.trim()).filter(Boolean);
const rawCount = titles.length;

const seen = new Set();
const dupes = [];
titles = titles.filter(t => {
  const k = t.toLowerCase().replace(/\s+/g, ' ');
  if (seen.has(k)) { dupes.push(t); return false; }
  seen.add(k);
  return true;
});

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------

const notMovements = [];
const present = [];
const candidates = [];

// MATCH BEFORE CLASSIFYING, and the order is load-bearing. "tempo run" starts
// with a method word and is also a real library entry (`tempo-run`); "Sled
// Sprint" reads like a distance. A title the library already answers is
// answered, whatever its name looks like -- so the library gets first refusal
// and only what it does not recognise is put through the decline rules.
for (const t of titles) {
  const m = bestMatch(t);
  if (m.score >= 0.7) { present.push([t, m.id]); continue; }
  const rule = NOT_A_MOVEMENT.find(([, re]) => re.test(t));
  if (rule || t === 'NA') { notMovements.push([t, rule ? rule[0] : 'junk-title']); continue; }
  candidates.push([t, m.id, m.score]);
}

const pct = n => `${((100 * n) / titles.length).toFixed(1)}%`;

console.log(`library ${LIB.length} entries | playlist ${rawCount} titles, ` +
            `${titles.length} unique (${dupes.length} exact duplicates)`);

console.log(`\n=== NOT MOVEMENTS (${notMovements.length}, ${pct(notMovements.length)}) ===`);
for (const [t, why] of notMovements) console.log(`  ${why.padEnd(20)} ${t}`);

console.log(`\n=== ALREADY IN THE LIBRARY (${present.length}, ${pct(present.length)}) ===`);
for (const [t, id] of present) console.log(`  ${t}  ->  ${id}`);

console.log(`\n=== CANDIDATES (${candidates.length}, ${pct(candidates.length)}) ===`);
console.log('  Nearest library entry shown so a duplicate under another name is');
console.log('  caught by eye. Low score does not mean new -- CHECK EACH ONE.\n');
for (const [t, id, s] of candidates) {
  console.log(`  ${t.padEnd(46)} nearest: ${String(id).padEnd(32)} ${s.toFixed(2)}`);
}

console.log('\nNext: for any name you cannot classify, tools/contact-sheet.mjs.');
