// The playlist matcher's boilerplate strip. design-library-expansion.md §30.
//
// THE THIRD TIME THE MATCHER WAS THE BUG. §16.3 was the hyphen, §18 was the
// asymmetric score, and this one is the input: a channel that brands every
// title sinks every score, because `f1` measures precision against the whole
// token set and nine words of channel outweigh three words of movement.
//
// Measured on the NASM playlist the day it was mined: 1 title recognised and
// 72 reported as candidates, against 46 and 28 once the branding came off.
// The direction of that error is what makes it worth a test. A missed
// duplicate gets caught by eye and dropped; a FALSE candidate gets authored,
// and then the library holds the same movement twice under two names.
//
// The fixture is the real shape rather than a minimal one, because the bug was
// never in one title -- it was in a repeated suffix, and a rule about
// repetition cannot be tested on a single row.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deboilerplate } from '../tools/playlist-diff.mjs';

// Eight real titles from the playlist, carrying the two segments the channel
// appends to nearly everything, plus the two it does not.
const NASM = [
  'How to do a Plank | Proper Form & Technique | NASM',
  'How to do a Side Plank  | Proper Form & Technique | NASM',
  'How to do a Goblet Squat  | Proper Form & Technique | NASM',
  'How to do a Barbell Bench Press | Proper Form & Technique | NASM',
  'How to do a Dead Bug | Proper Form & Technique | NASM',
  'How to do a Face Pull | Proper Form & Technique | NASM',
  'How to Do Wrist Flexion',
  'How to Do a Static Latissimus Dorsi Ball Stretch'
];

test('a repeated pipe segment is channel branding and comes off', () => {
  const { titles, dropped } = deboilerplate(NASM);
  assert.deepEqual(dropped.sort(), ['NASM', 'Proper Form & Technique']);
  assert.ok(titles.includes('Plank'), `got ${JSON.stringify(titles)}`);
  assert.ok(titles.includes('Barbell Bench Press'));
});

test('the how-to prefix comes off even where there is no pipe at all', () => {
  // These two carry no branding, so the empirical rule sees nothing. The
  // prefix is glued to the name with no delimiter and needs its own rule.
  const { titles } = deboilerplate(NASM);
  assert.ok(titles.includes('Wrist Flexion'));
  assert.ok(titles.includes('Static Latissimus Dorsi Ball Stretch'));
});

test('a segment that is not repeated is part of the movement and stays', () => {
  // The threshold is a share of the playlist, so a one-off qualifier must
  // survive. "Close Grip" is the movement here, not the channel.
  const titles = [
    ...NASM,
    'How to Do a Seated Machine Row | Close Grip'
  ];
  const { titles: out } = deboilerplate(titles);
  assert.ok(out.some(t => /Close Grip/.test(t)),
    'a unique qualifier was stripped as if it were branding');
});

test('the movement is never the thing stripped, even first', () => {
  // Only segments AFTER the first are eligible. A channel that led with its
  // own name would otherwise take the movement with it.
  const titles = Array.from({ length: 10 }, (_, i) => `NASM | Movement ${i}`);
  const { titles: out, dropped } = deboilerplate(titles);
  assert.deepEqual(dropped, [], 'the head segment must never be eligible');
  assert.ok(out.every(t => t.startsWith('NASM')));
});

test('a title that is nothing but branding keeps its original text', () => {
  // An empty title matches every entry at once, which is the most confident
  // possible way of being wrong -- worse than leaving the row untouched.
  const titles = [...NASM, 'Proper Form & Technique'];
  const { titles: out } = deboilerplate(titles);
  assert.ok(out.every(t => t.trim().length > 0), 'a title was emptied');
});

test('a playlist with no branding at all is returned unchanged', () => {
  // The shape of every earlier pull. The rule must be inert on those, or it
  // silently rewrites four playlists' worth of settled results.
  const plain = ['Hex Bar Deadlift', 'Row Machine', 'Cat and Camel Stretch',
                 'Tempo Front Squat', 'Lean Fall Run (side view)'];
  const { titles, dropped } = deboilerplate(plain);
  assert.deepEqual(dropped, []);
  assert.deepEqual(titles, plain);
});
