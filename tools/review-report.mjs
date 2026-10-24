// Summarise the desk reviews in .reviews/reviews.jsonl.
//
//   node tools/review-report.mjs
//
// Prints and writes nothing else. The raw file is the record; this is the
// first look at it -- verdicts against session size, and every move he
// flagged, with his own words.

import { readReviews } from './review-server.mjs';
import { countsTowardVolume } from '../js/generator.js';

const reviews = readReviews(new URL('../.reviews/reviews.jsonl', import.meta.url));
if (!reviews.length) {
  console.log('No reviews yet. Start the server: node tools/review-server.mjs');
  process.exit(0);
}

const workingSets = s => s.blocks.filter(countsTowardVolume).reduce((n, b) => n + (b.sets || 0), 0);
const avg = a => (a.length ? (a.reduce((p, q) => p + q, 0) / a.length).toFixed(1) : '-');

const counted = reviews.filter(r => !r.feedback.skipped);
console.log(`${reviews.length} reviews (${counted.length} counted, ${reviews.length - counted.length} skipped)`);
console.log(`versions: ${[...new Set(reviews.map(r => r.appVersion))].join(', ')}\n`);

console.log('By day type          n  verdicts');
const byDay = {};
for (const r of reviews) (byDay[r.session.dayType] ||= []).push(r);
for (const [day, rs] of Object.entries(byDay)) {
  const v = {};
  for (const r of rs) v[r.feedback.verdict || 'skipped'] = (v[r.feedback.verdict || 'skipped'] || 0) + 1;
  console.log(`  ${day.padEnd(18)} ${String(rs.length).padStart(2)}  ${Object.entries(v).map(([k, n]) => `${k} ${n}`).join(', ')}`);
}

console.log('\nBy verdict           n  avg min  avg main moves  avg working sets');
const byVerdict = {};
for (const r of reviews) (byVerdict[r.feedback.verdict || 'skipped'] ||= []).push(r);
for (const [v, rs] of Object.entries(byVerdict)) {
  const main = rs.map(r => r.session.blocks.filter(countsTowardVolume).length);
  console.log(`  ${v.padEnd(18)} ${String(rs.length).padStart(2)}  ${avg(rs.map(r => r.session.durationMin)).padStart(7)}` +
    `  ${avg(main).padStart(14)}  ${avg(rs.map(r => workingSets(r.session))).padStart(16)}`);
}

console.log('\nFlagged moves');
const flags = {};
for (const r of reviews) for (const m of r.feedback.moves) {
  if (!m.flag && !m.note) continue;
  (flags[m.name] ||= []).push(`${m.flag || 'note'}${m.note ? `: "${m.note}"` : ''} (#${reviews.indexOf(r) + 1} ${r.session.dayType})`);
}
const flagged = Object.entries(flags).sort((a, b) => b[1].length - a[1].length);
if (!flagged.length) console.log('  none');
for (const [name, items] of flagged) {
  console.log(`  ${name} x${items.length}`);
  for (const i of items) console.log(`    - ${i}`);
}

console.log('\nComments');
reviews.forEach((r, i) => {
  if (r.feedback.comment) console.log(`  #${i + 1} ${r.simDate} ${r.session.dayType} [${r.feedback.verdict || 'skipped'}]: ${r.feedback.comment}`);
});
