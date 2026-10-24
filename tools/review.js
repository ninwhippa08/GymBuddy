// The desk-review page. tools/review-server.mjs explains the why; this file is
// the screen.
//
// It builds sessions with the REAL generator and draws them with the REAL card
// (js/ui.js renderSession, read-only), so nothing here can drift from what the
// phone would show. The only thing it adds is a simulated calendar: each
// session he counts as done goes into a pretend history, the date moves on by
// a gap, and the next session is built from that history -- so the rotation,
// the weekly volume and the recency rules all react the way they would in the
// gym. The pretend history lives in .reviews/reviews.jsonl, never in the
// phone app's storage.

import { resolveSession, localDate, rampWeekFor } from '../js/generator.js';
import { renderSession, mount, el, titleCase } from '../js/ui.js';
import { APP_VERSION } from '../js/version.js';

const root = document.getElementById('app');
const PENDING_KEY = 'gymbuddy-review-pending';

// What a move can be flagged with. Free text rides alongside every one.
const MOVE_FLAGS = [
  ['', 'Looks fine'],
  ['swap-dislike', "I'd swap it - don't like it"],
  ['unknown', "Don't know this move"],
  ['wrong-fit', "Doesn't fit this day / this order"],
  ['too-much', 'Too many sets or reps'],
  ['too-little', 'Too little'],
  ['load-odd', 'Load / % looks wrong'],
  ['cue', 'Cue unclear or wrong'],
  ['equipment', "My gym can't do this"]
];

const VERDICTS = [
  ['too-easy', 'Too easy / too short'],
  ['about-right', 'About right'],
  ['too-much', 'Too much / too long'],
  ['would-not-do', "I wouldn't do this one"]
];

// Days between sessions. Random by default because his weeks are irregular
// (1-3 sessions); a fixed gap would test a cadence he does not train at.
const GAPS = [['random', 'Random, 2-5 days'], ['1', '1 day'], ['2', '2 days'],
              ['3', '3 days'], ['4', '4 days'], ['7', '7 days']];

// --------------------------------------------------------------------------
// Dates. Built from local y/m/d parts, never toISOString -- generator.js's
// localDate explains the evening-session bug that caused.
// --------------------------------------------------------------------------

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n, 12).getTime());
}

// A session "happens" at 6pm on its simulated day.
function atEvening(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 18).getTime();
}

function pickGap(choice) {
  if (choice !== 'random') return Number(choice);
  return 2 + Math.floor(Math.random() * 4);
}

// localStorage is a convenience here (keeps the same session across a
// reload), never the record -- the record is the server's file.
function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; }
}
function writePending(p) {
  try { p ? localStorage.setItem(PENDING_KEY, JSON.stringify(p)) : localStorage.removeItem(PENDING_KEY); } catch { /* fine */ }
}

// --------------------------------------------------------------------------
// Server
// --------------------------------------------------------------------------

async function getState() {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error(`/api/state: HTTP ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}

// --------------------------------------------------------------------------
// Screens
// --------------------------------------------------------------------------

let library = null;

function showSetup() {
  const today = localDate();
  // Six weeks back: the five-week return ramp is over, so sessions come out
  // full size -- the size he is testing now. Today = ramp week 1.
  const returnInput = el('input', { type: 'date', value: addDays(today, -42) });
  const startInput = el('input', { type: 'date', value: today });
  mount(root, el('div', { class: 'screen review-panel', style: 'position:static;max-width:520px;margin:0 auto' }, [
    el('h2', { text: 'Desk review - set up the pretend athlete' }),
    el('p', { class: 'sim', text:
      'Sessions are built as if you trained on a pretend calendar. Nothing here touches the app on your phone.' }),
    el('fieldset', {}, [
      el('legend', { text: 'Return date (sets the ramp)' }),
      el('p', { class: 'sim', text:
        'Six weeks ago = past the ramp, full-size sessions. Set it to the start date to review ramp weeks 1-5.' }),
      returnInput
    ]),
    el('fieldset', {}, [el('legend', { text: 'First pretend session date' }), startInput]),
    el('button', {
      class: 'btn btn-done', type: 'button',
      onclick: async () => {
        await post('/api/config', { returnDate: returnInput.value, startDate: startInput.value });
        start();
      }
    }, 'Start reviewing')
  ]));
}

// Which date the next session is for, and with what seed. Stable across a
// reload: a pending session is rebuilt from the same date and seed.
function nextSlot(config, reviews, gapChoice) {
  const pending = readPending();
  if (pending && pending.after === reviews.length) return pending;

  const last = reviews[reviews.length - 1];
  let date, gapDays = null;
  if (last && last.feedback.skipped) {
    // A skip is a reroll: same day, a different session.
    date = last.simDate;
  } else {
    const counted = reviews.filter(r => !r.feedback.skipped);
    const prev = counted[counted.length - 1];
    if (prev) { gapDays = pickGap(gapChoice); date = addDays(prev.simDate, gapDays); }
    else date = config.startDate;
  }
  const slot = { after: reviews.length, date, gapDays, seed: Date.now() };
  writePending(slot);
  return slot;
}

async function start() {
  let state;
  try { state = await getState(); } catch (err) {
    return mount(root, el('div', { class: 'screen' }, [el('p', { class: 'review-error', text:
      `Could not reach the review server (${err.message}). Start it with: node tools/review-server.mjs` })]));
  }
  if (!state.config) return showSetup();
  showSession(state.config, state.reviews);
}

function showSession(config, reviews) {
  let gapChoice = 'random';
  try { gapChoice = localStorage.getItem('gymbuddy-review-gap') || 'random'; } catch { /* fine */ }

  const slot = nextSlot(config, reviews, gapChoice);
  const profile = { returnDate: config.returnDate, banned: [], plyoLevel: 'beginner' };
  // Only sessions he counted as done are training history. Marked confirmed,
  // the way "I did this workout" would on the phone.
  const history = reviews
    .filter(r => !r.feedback.skipped)
    .map(r => ({ ...r.session, confirmed: true }));
  const now = atEvening(slot.date);

  // A skip is the phone's Reroll, and Reroll walks down the day-type ranking
  // rather than rebuilding the same day: every day type already turned down
  // on this date counts as offered. generator.js proposeDayType.
  const offeredDayTypes = reviews
    .filter(r => r.feedback.skipped && r.simDate === slot.date)
    .map(r => r.session.dayType);

  const { session } = resolveSession({
    library, profile, history, soreness: {}, seed: slot.seed, now, offeredDayTypes
  });
  if (!session) {
    return mount(root, el('div', { class: 'screen' }, [el('p', { text: 'Nothing buildable for this day.' })]));
  }

  const cuesFor = id => {
    const e = library.find(x => x.id === id);
    return e && e.cues && e.cues.length ? e.cues : null;
  };
  const card = renderSession(session, { readOnly: true, cuesFor });

  mount(root, el('div', { class: 'review-layout' }, [
    card,
    reviewPanel({ config, reviews, slot, session, gapChoice })
  ]));
  window.scrollTo(0, 0);
}

function radioGroup(name, options) {
  const inputs = options.map(([value]) => el('input', { type: 'radio', name, value }));
  return {
    nodes: options.map(([, label], i) => el('label', {}, [inputs[i], label])),
    value: () => (inputs.find(i => i.checked) || {}).value || null
  };
}

function reviewPanel({ config, reviews, slot, session, gapChoice }) {
  const counted = reviews.filter(r => !r.feedback.skipped).length;
  const moves = session.blocks.map(b => {
    const flag = el('select', {}, MOVE_FLAGS.map(([v, l]) => el('option', { value: v }, l)));
    const note = el('input', { type: 'text', placeholder: 'note (optional)' });
    const group = b.role === 'prep' ? 'prep' : b.role === 'core' ? 'core'
      : b.role === 'mobility' ? 'cool-down' : 'main';
    return {
      block: b, flag, note,
      node: el('div', { class: 'move-row' }, [
        el('div', {}, [el('span', { class: 'move-name', text: b.name }),
                       el('span', { class: 'move-group', text: group })]),
        el('div', { class: 'row2' }, [flag, note])
      ])
    };
  });
  const comment = el('textarea', { placeholder:
    'Anything: would you do this as written? what would you change? does the order make sense?' });
  const status = el('p', { class: 'review-status' });
  const verdicts = radioGroup('verdict', VERDICTS);
  const gapSelect = el('select', {
    onchange: e => { try { localStorage.setItem('gymbuddy-review-gap', e.target.value); } catch { /* fine */ } }
  }, GAPS.map(([v, l]) => el('option', { value: v, selected: v === gapChoice }, l)));

  // One save per session. Building the next one takes a moment, and a second
  // click inside it would log the same session twice.
  let saving = false;
  async function submit(skipped) {
    if (saving) return;
    const verdict = verdicts.value();
    if (!skipped && !verdict) { status.textContent = 'Pick an overall verdict first.'; return; }
    const feedback = {
      skipped,
      verdict,
      comment: comment.value.trim(),
      moves: moves.map(m => ({
        exerciseId: m.block.exerciseId, name: m.block.name, role: m.block.role,
        slot: m.block.slot, flag: m.flag.value, note: m.note.value.trim()
      }))
    };
    saving = true;
    status.textContent = 'Saving...';
    try {
      await post('/api/review', {
        appVersion: APP_VERSION,
        simDate: slot.date,
        gapDays: slot.gapDays,
        returnDate: config.returnDate,
        session,
        feedback
      });
    } catch (err) { saving = false; status.textContent = `Not saved: ${err.message}`; return; }
    writePending(null);
    start();
  }

  return el('aside', { class: 'review-panel' }, [
    el('h2', { text: `Review #${reviews.length + 1}` }),
    el('p', { class: 'sim', text:
      `Pretend date ${slot.date}` +
      (slot.gapDays ? ` (${slot.gapDays} days after the last one)` : '') +
      ` · ramp week ${rampWeekFor({ returnDate: config.returnDate }, atEvening(slot.date))}` +
      ` · ${counted} counted so far · app ${APP_VERSION}` }),
    el('fieldset', {}, [el('legend', { text: `Overall: this ${titleCase(session.dayType)} day is...` }),
      ...verdicts.nodes]),
    el('fieldset', {}, [el('legend', { text: 'Each move' }), ...moves.map(m => m.node)]),
    el('fieldset', {}, [el('legend', { text: 'Comments' }), comment]),
    el('fieldset', {}, [el('legend', { text: 'Next pretend session comes' }), gapSelect]),
    el('div', { class: 'review-actions' }, [
      el('button', { class: 'btn btn-done', type: 'button', onclick: () => submit(false) },
        'Save & count as done'),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => submit(true) },
        'Skip (reroll this day)')
    ]),
    el('p', { class: 'sim', text:
      '"Count as done" puts it in the pretend history, so the next session reacts to it. ' +
      '"Skip" still saves your comments, but the day is rebuilt as if you rerolled.' }),
    status
  ]);
}

async function boot() {
  try {
    const res = await fetch('../data/exercises.json');
    if (!res.ok) throw new Error(`exercises.json: HTTP ${res.status}`);
    library = (await res.json()).exercises;
  } catch (err) {
    return mount(root, el('p', { class: 'review-error', text: err.message }));
  }
  start();
}

boot();
