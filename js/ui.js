// ui.js -- DOM rendering. spec §7
//
// Pure rendering: every function takes data and returns a detached DOM node.
// Nothing here reads localStorage, generates a session, or attaches app
// behaviour -- app.js does the wiring. Handlers arrive as arguments.
//
// Built with createElement and textContent throughout, never innerHTML. The
// exercise library is a local file today, but a rendering path that cannot
// interpret markup is one less thing to be careful about later.
//
// The one import: `localDate`. The setup screen's date picker needs today's
// date, and a second copy of that four-line helper is how the UTC/local bug
// it fixes would come back in one place and not the other.

import { localDate } from './generator.js';
import {
  monthGrid, monthLabel, WEEKDAY_LABELS, DAY_TYPE_CODE
} from './calendar.js';

// --------------------------------------------------------------------------
// Element helper
// --------------------------------------------------------------------------

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // Before the falsy skip below: `checked: false` is meaningful and has to
    // reach the node as a property. setAttribute would not set it either --
    // an unticked box would come back with `checked` undefined.
    if (k === 'checked') { node.checked = Boolean(v); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

// 'back-squat' -> 'Back Squat'. Used for PR roots, which are ids, not names.
export function titleCase(slug) {
  return String(slug)
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatRest(sec) {
  if (!sec) return null;
  if (sec < 60) return `rest ${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `rest ${min}:${String(rem).padStart(2, '0')}` : `rest ${min} min`;
}

// A stretch of time inside a prescription: "1:30", "45 s". Distinct from
// formatRest, which prefixes the word "rest" and is a whole meta-line on its
// own. Seconds stay seconds under a minute -- "0:45" reads like a stopwatch
// bug rather than a recovery.
export function spanText(sec) {
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  return `${min}:${String(sec % 60).padStart(2, '0')}`;
}

// The one line the user reads mid-set. Never an absolute weight -- always a
// multiplier against a PR he already knows. spec §2, §10.
//
// prCoef is already folded into displayMultiplier by the generator, so this
// prints one multiplication and never two.
export function loadLine(block) {
  if (block.mode === 'time') {
    return `${block.durationMin} min`;
  }
  // Dosed in reps because that is the unit the source uses. Printing "3 min"
  // over a leg swing was the wrong unit, not merely the wrong amount.
  // design 2.1, discrepancy 4.
  if (block.mode === 'drill') {
    return block.perSide ? `${block.reps} reps per side` : `${block.reps} reps`;
  }
  if (block.mode === 'hold') {
    return block.perSide
      ? `${block.holdSec}s hold per side`
      : `${block.holdSec}s hold`;
  }
  if (block.mode === 'contacts') {
    // Strides have no ground contacts to count -- they are not plyometric work
    // -- but they DO carry distance: sprintMeters is the session total, so one
    // stride is that over the set count. It used to fall through to the effort
    // cue below and the card never said how far a stride was, while the number
    // sat on the block unprinted. The sourced prescription is 50-150 m per rep,
    // which makes the distance the prescription. Per rep, not the total: the
    // hero line is read between efforts, and "300 m" is not what he is about
    // to run.
    if (!block.footContacts && block.sprintMeters && block.sets) {
      return `${Math.round(block.sprintMeters / block.sets)} m`;
    }
    // Throws and slams have no ground contact to count -- the generator sets
    // footContacts to 0 on purpose -- and no distance either. "0 contacts" as
    // the headline tells the user nothing, so the effort cue becomes the
    // prescription instead.
    if (!block.footContacts) return block.effort || 'maximal intent';
    return block.sprintMeters
      ? `${block.footContacts} contacts · ${block.sprintMeters} m`
      : `${block.footContacts} contacts`;
  }
  if (block.mode === 'reps') {
    // NOT 'bodyweight'. The generator drops to this mode for anything it has
    // no reference max for -- bodyweight, machine AND dumbbell work, and 122
    // of the library's 151 non-loadable entries hold something. Printing
    // "bodyweight" over a Goblet Squat or a Barbell Hip Thrust is a wrong
    // instruction, not a vague one. The effort cue is the prescription.
    return block.effort || 'leave 2-3 reps in reserve';
  }
  // The whole prescription in one sentence. There is no load reference for an
  // interval, so the fallthrough below would read displayMultiplier off an
  // object that has none. design-running-programming.md §8.
  //
  // "8 × 90 s" was true and still unusable: it never said how long a round
  // was, how long the recovery ran, or what the recovery was for. Reported
  // from the phone, 2026-08-27.
  if (block.mode === 'interval') {
    return `${block.sets} rounds of ${block.workSec} s hard, ` +
           `${spanText(block.restSec)} easy between`;
  }
  return `${block.displayMultiplier.toFixed(2)} × ${titleCase(block.prRef)} PR`;
}

// The ladder, under the hero line. The hero keeps the WORKING load -- that is
// the number read mid-set and it must not move -- so this line carries only
// the steps up to it. design-mobility-and-warmup.md §4.3.
export function warmupLine(block) {
  const steps = (block.setPlan || []).filter(s => s.kind === 'warmup');
  if (!steps.length) return '';

  // Adjacent rungs that would print identically are collapsed into a set
  // count -- `2 × 3 × 0.30` is two sets of three at 0.30, the same sets × reps
  // × load reading the volume chip already uses. A technical: 3 lift gets its
  // extra technique set AT WARMUP.START, alongside rung 0, so its first two
  // rungs are identical by construction: measured over 24,355 ramped blocks,
  // 11,242 (46.2%) read `3 × 0.30  ·  3 × 0.30` and looked like a typo, and
  // the worst line ran 82 characters, wrapping mid-step on the phone. Every
  // one of those was a technical: 3 lift and no other lift collided, but this
  // compares the VALUES rather than the rating -- the ladder is computed, so
  // nothing guarantees which rungs repeat. Worst case is now 73 characters.
  const runs = [];
  for (const s of steps) {
    const last = runs[runs.length - 1];
    if (last && last.reps === s.reps &&
        last.displayMultiplier === s.displayMultiplier) {
      last.count += 1;
      continue;
    }
    runs.push({ count: 1, reps: s.reps, displayMultiplier: s.displayMultiplier });
  }

  return 'warm-up  ' + runs.map(r =>
    `${r.count > 1 ? `${r.count} × ` : ''}${r.reps} × ${r.displayMultiplier.toFixed(2)}`
  ).join('  ·  ');
}

// The WORKING sets, when they are not all the same. A straight block gets
// nothing back: its hero line already states the load every set uses, and
// repeating it would be noise. A ladder is the case this exists for -- its
// rungs differ from one another, so the hero line (which carries wave 1's
// first rung, the set he actually lifts first) is true of exactly one of them.
// Without this the card reads "6 × 4" over "0.85 × Squat PR" and instructs six
// sets at the lightest rung. design-architectures.md §3.3.
export function workLine(block) {
  if (block.architecture !== 'ladder') return '';
  const sets = (block.setPlan || []).filter(s => s.kind === 'work');
  if (!sets.length) return '';
  return 'sets  ' + sets
    .map(s => `${s.reps} × ${s.displayMultiplier.toFixed(2)}`)
    .join('  ·  ');
}


// A paired block has to say so, and has to say how many of its sets are
// actually paired -- a block with 4 sets in a 2-round pair performs 2 of them
// alongside its partner and 2 alone. Printing only "superset" would instruct
// four rounds of a pair whose other half has two sets.
// design-architectures.md 3.6.2.
export function supersetLine(block) {
  if (!block.group) return '';
  const label = block.groupRole === 'A1' ? 'superset A1' : 'superset A2';
  const left = block.sets - block.groupRounds;
  return left > 0
    ? `${label} · ${block.groupRounds} rounds paired, then ${left} alone`
    : `${label} · ${block.groupRounds} rounds`;
}

// What the athlete actually rests inside a pair, which is NOT block.restSec.
// The schedule is: A1, straight into A2, then the round rest. So A1's card
// must say there is no rest to take, and A2's must carry the rest for the
// whole round -- printing each block's own drawn rest would state a recovery
// he does not take, twice per round. The leftover sets of the longer block DO
// take its own rest, which is why A1's line says "between rounds".
// design-architectures.md 3.6.3.
export function supersetRestLine(block) {
  if (!block.group) return formatRest(block.restSec);
  return block.groupRole === 'A1'
    ? 'no rest between rounds -- go straight into the next movement'
    : formatRest(block.groupRestSec);
}

// The top-right of the card. Timed work has no set count, and its effort cue
// is a sentence -- too long for a header slot, so it drops to the meta line.
export function volumeLine(block) {
  if (block.mode === 'time') return '';
  // A drill is one set by definition; "1 × 12" is noise next to "12 reps".
  if (block.mode === 'drill') return '';
  // For a hold the hero line already carries the seconds, so the chip carries
  // how many of them.
  if (block.mode === 'hold') return `× ${block.sets}`;
  // The hero line carries work AND recovery, so the chip carries the one
  // thing left to ask: when am I finished. Work plus the recoveries BETWEEN
  // the rounds -- there is no recovery after the last one, which is why this
  // is not estimateMinutes' figure. That one keeps the extra rest on purpose,
  // as slack in the time budget it packs against.
  if (block.mode === 'interval') {
    const sec = block.sets * block.workSec + (block.sets - 1) * block.restSec;
    return `~${Math.round(sec / 60)} min`;
  }
  // A stride is one rep by definition and the hero line now carries its
  // distance, so the chip carries the count -- the same split as a hold.
  // "6 × 1" was noise for exactly the reason "1 × 12" is noise over a drill.
  if (block.mode === 'contacts' && !block.footContacts && block.sprintMeters) {
    return block.sets > 1 ? `× ${block.sets}` : '';
  }
  return `${block.sets} × ${block.reps}`;
}

// --------------------------------------------------------------------------
// Blocks
// --------------------------------------------------------------------------

export function blockCard(block, cuesFor, onSwap) {
  const volume = volumeLine(block);
  const warmup = warmupLine(block);
  const work = workLine(block);
  const superset = supersetLine(block);

  // The effort cue is already the headline for contact-less explosive work;
  // don't print it twice.
  // A stride's hero line is its distance, so its cue has NOT been printed yet
  // and has to drop to the meta line -- otherwise the one instruction that
  // keeps a stride submaximal disappears off the card entirely.
  const heroIsEffort =
    block.mode === 'reps' ||
    (block.mode === 'contacts' && !block.footContacts && !block.sprintMeters);
  // An interval's recovery is already in the hero line, and what matters
  // about it is not its length but that it is not a rest: standing still
  // between hard efforts is how the next one goes badly.
  const meta = [block.mode === 'interval'
    ? 'walk or jog the recovery -- never stand still'
    : supersetRestLine(block)];
  if (block.effort && !heroIsEffort) meta.push(block.effort);
  if (block.optional) meta.push('optional');

  const front = el('div', { class: 'block-face is-front' }, [
    el('div', { class: 'block-head' }, [
      el('h3', { class: 'block-name', text: block.name }),
      volume ? el('span', { class: 'block-volume', text: volume }) : null
    ]),
    el('p', {
      class: block.rampLimited ? 'block-load is-capped' : 'block-load',
      text: loadLine(block)
    }),
    // The ramp is not skippable and the user asked to be told when it bites.
    // basis §3, spec §9.
    block.rampLimited
      ? el('p', { class: 'block-note', text: 'held down by the return ramp' })
      : null,
    // Same shape and same reason as the ramp note above: the athlete is owed
    // the fact that the app changed something. This fires when a required
    // slot could only be filled by widening tier under an equipment
    // constraint. design-equipment-and-swap.md §4.2.
    //
    // The wording names no specific item. `tierRelaxed` is a bare flag -- the
    // block does not record WHICH absent item forced the substitution, and
    // with equipment as a conjunction there is often no single one. The plan
    // proposed "no barbell here", which would be a false statement on the card
    // whenever the missing item was anything else.
    block.tierRelaxed
      ? el('p', {
          class: 'block-note',
          text: 'needs equipment you do not have -- this is the closest movement available'
        })
      : null,
    // Above everything else it shares the card with: which movement this one
    // is paired with changes how the whole block is performed, so it is read
    // before the loads are.
    superset
      ? el('p', { class: 'block-meta block-superset', text: superset })
      : null,
    // Above the warm-up line, because it is what he does after it.
    work
      ? el('p', { class: 'block-meta block-work', text: work })
      : null,
    warmup
      ? el('p', { class: 'block-meta block-warmup', text: warmup })
      : null,
    meta.filter(Boolean).length
      ? el('p', { class: 'block-meta', text: meta.filter(Boolean).join(' · ') })
      : null
  ]);

  // A real button, and deliberately NOT a child of the front face. The front
  // face lives inside button.block-flip, and a button inside a button is not
  // valid HTML -- the parser closes the outer one and the card comes apart.
  // As a sibling it also cannot steal the flip gesture, so it needs no
  // stopPropagation. design-equipment-and-swap.md §7.
  const swap = typeof onSwap === 'function'
    ? el('button', {
        class: 'block-swap',
        type: 'button',
        'aria-label': `Swap ${block.name} for another movement`,
        onclick: () => onSwap(block.slot)
      }, 'swap')
    : null;

  const cues = typeof cuesFor === 'function' ? cuesFor(block.exerciseId) : null;

  // No cues yet means no flip and no affordance, rather than a card that turns
  // over to an empty back. design-card-flip.md §7.
  if (!cues || !cues.length) return el('li', { class: 'block' }, [front, swap]);

  const back = el('div', { class: 'block-face is-back', 'aria-hidden': 'true' }, [
    el('h3', { class: 'block-name', text: block.name }),
    el('ul', { class: 'cue-list' }, cues.map(c => el('li', { class: 'cue', text: c })))
  ]);

  const inner = el('div', { class: 'block-inner' }, [front, back]);

  // A real button, so keyboard access costs nothing and needs no extra code.
  // It holds no interactive descendants, so the nesting is legal.
  const btn = el('button', {
    class: 'block-flip',
    type: 'button',
    'aria-pressed': 'false',
    'aria-label': `${block.name} — show cues`
  }, inner);

  // The card takes the height of the face turned TOWARDS you, not the height
  // of the taller face. CSS alone already gets this right -- the turned-away
  // face is out of flow -- but auto heights cannot be eased, and a card that
  // doubles in height the instant it is clicked throws the list below it down
  // the screen. Writing the number the CSS would have produced lets the same
  // 0.45s transition carry it. design-card-flip.md §5.1.
  const fit = () => {
    const face = btn.classList.contains('is-flipped') ? back : front;
    // Detached, or the first frame: no measurement to trust yet. The CSS is
    // already correct without us, so leave it alone rather than pin the card
    // to zero and animate it open on load.
    if (face.offsetHeight) btn.style.height = `${face.offsetHeight}px`;
  };

  // The one handler ui.js owns. It is presentational: it toggles a class on
  // the node it was just given and touches nothing outside this card, so the
  // "app.js does the wiring" rule in the file header is intact.
  btn.addEventListener('click', () => {
    const flipped = btn.classList.toggle('is-flipped');
    btn.setAttribute('aria-pressed', String(flipped));
    // backface-visibility hides a face visually and leaves it in the a11y tree
    // and the tab order, so the turned-away face is hidden explicitly.
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    btn.setAttribute('aria-label', `${block.name} — ${flipped ? 'hide' : 'show'} cues`);
    fit();
  });

  // A cue that wraps onto another line changes the face's height -- a rotated
  // phone, a resized window, a font arriving late. One observer per card keeps
  // the pinned height honest without a resize listener to remember to remove,
  // and it fires once on its own the moment the card is laid out. Node has no
  // ResizeObserver, so the tests take the branch that skips it.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(fit);
    ro.observe(front);
    ro.observe(back);
  }

  return el('li', {
    class: block.group ? 'block has-cues superset' : 'block has-cues'
  }, [btn, swap]);
}

function blockGroup(title, blocks, cuesFor, onSwap) {
  if (!blocks.length) return null;
  return el('section', { class: 'group' }, [
    el('h2', { class: 'group-title', text: title }),
    // NOT blocks.map(blockCard) -- map passes the index as the second argument,
    // which would arrive where cuesFor belongs.
    el('ul', { class: 'block-list' },
      blocks.map(b => blockCard(b, cuesFor, onSwap)))
  ]);
}

// --------------------------------------------------------------------------
// Session screen
// --------------------------------------------------------------------------

// "What's missing today?" -- the equipment THIS session asks for, every item
// ticked because the default is that he has everything. Unticking regenerates.
// The caller supplies the items; this function never reads the library.
// design-equipment-and-swap.md §7.
export function equipmentControl(items, selected = [], onChange = () => {}, open = false) {
  // Collapsed by default, with the state on the closed line -- see the note on
  // sorenessMap below for why both controls fold away.
  return el('details', { class: 'equip', open }, [
    el('summary', {
      text: selected.length
        ? `What's missing today? — no ${selected.join(', ')}`
        : "What's missing today? — you have everything"
    }),
    ...items.map(item => el('label', { class: 'equip-item' }, [
      el('input', {
        type: 'checkbox',
        checked: !selected.includes(item),
        onchange: () => onChange(item)
      }),
      el('span', { text: item })
    ]))
  ]);
}

// The soreness body map. spec §4.1.
//
// Where each joint sits on the figure, as percentages of the box. These are
// layout, not training rules, so they live here rather than in rules.js. The
// vocabulary and its order arrive from the caller -- ui.js imports nothing and
// reads no library, exactly like equipmentControl above -- and this map only
// says where to draw each name it is given.
const JOINT_AT = {
  neck:     [50, 7],
  shoulder: [31, 17],
  scapula:  [69, 17],
  thoracic: [50, 25],
  elbow:    [24, 34],
  lumbar:   [50, 38],
  wrist:    [20, 47],
  hip:      [50, 50],
  knee:     [43, 69],
  ankle:    [43, 88]
};

// Clear -> sore -> hurt -> clear. The cycle lives here and nowhere else: three
// states in a fixed order is exactly the rule that drifts when the control and
// its caller both know it. The caller is handed the level it should store.
function nextLevel(current) {
  if (current === 'sore') return 'hurt';
  if (current === 'hurt') return null;
  return 'sore';
}

// The figure is drawn in CSS, not SVG. `document.createElement('svg')` builds
// an HTMLUnknownElement that never renders -- real SVG needs createElementNS,
// which would put a second element-building path into a file that has exactly
// one. Divs with border-radius cost nothing and keep el() the only way nodes
// are made here.
export function sorenessMap(joints = [], soreness = {}, onCycle = () => {}, open = false) {
  const marked = joints.filter(j => soreness[j]).map(j => `${j} ${soreness[j]}`);

  // Collapsed by default. Measured 2026-08-30: expanded, this control is 460px
  // and the equipment list 125px, which put the first exercise card at 884px --
  // past the fold on an 844px phone. The app's promise is that you open it at
  // the gym door and see the session, so the session leads and the controls
  // fold, with everything that is set still readable on the closed line.
  //
  // <details> rather than a class and a click handler: native, keyboard
  // operable, announced by a screen reader as expandable, and it still works if
  // the script never runs.
  return el('details', { class: 'soreness', open }, [
    el('summary', {
      text: marked.length
        ? `What's sore today? — ${marked.join(' · ')}`
        : "What's sore today? — nothing marked"
    }),
    el('div', { class: 'body' }, [
      // Decorative only. The buttons carry every name a screen reader needs,
      // so announcing the drawing as well would be noise.
      el('div', { class: 'figure', 'aria-hidden': 'true' }, [
        el('span', { class: 'fig fig-head' }),
        el('span', { class: 'fig fig-torso' }),
        el('span', { class: 'fig fig-arm fig-arm-l' }),
        el('span', { class: 'fig fig-arm fig-arm-r' }),
        el('span', { class: 'fig fig-leg fig-leg-l' }),
        el('span', { class: 'fig fig-leg fig-leg-r' })
      ]),
      ...joints.map(joint => {
        const level = soreness[joint] || null;
        const [x, y] = JOINT_AT[joint] || [50, 50];
        return el('button', {
          type: 'button',
          class: `joint${level ? ` is-${level}` : ''}`,
          style: `left:${x}%;top:${y}%`,
          // The state is in the label, not only in the colour: red is not an
          // accessible way to say a joint is excluded from every movement.
          'aria-label': `${joint} — ${level || 'fine'}`,
          title: `${joint} — ${level || 'fine'}`,
          onclick: () => onCycle(joint, nextLevel(level))
        });
      })
    ])
  ]);
}

// Capture a movement at the rack; send it to GitHub as an issue later.
//
// The Send control is a plain link to GitHub's pre-filled new-issue form. The
// app holds NO credential and writes nothing: he is already signed in on his
// phone, and he submits the issue himself. Writing to a file in the repo would
// have needed a token with write access living in a public app on a phone,
// which is not a trade worth making to save one tap.
//
// A draft is a name and a note, and stays out of the library: pattern, tier,
// modalities, joints and a sourced prCoef decide what a movement is allowed to
// do to him, and none of those can be guessed from a sentence typed between
// sets.
export function addMoveControl(drafts = [], issueBase = '', handlers = {}, open = false) {
  const { onSave = () => {}, onRemove = () => {} } = handlers;
  const name = el('input', { type: 'text', class: 'draft-name',
                             placeholder: 'Dumbbell Clean' });
  const note = el('textarea', { class: 'draft-note', rows: '2',
                                placeholder: 'what it is, in a sentence' });

  const save = () => {
    // Read off the node, not off a keystroke handler: one source of truth for
    // what is in the box, and nothing to keep in sync while he types.
    const n = String(name.value || '').trim();
    if (!n) return;                       // a nameless row tells me nothing
    onSave(n, String(note.value || '').trim());
    name.value = '';
    note.value = '';
  };

  return el('details', { class: 'addmove', open }, [
    el('summary', {
      text: drafts.length
        ? `Add a move — ${drafts.length} waiting to send`
        : 'Add a move'
    }),
    el('div', { class: 'draft-form' }, [
      name,
      note,
      el('button', { type: 'button', class: 'btn btn-secondary', text: 'Save',
                     onclick: save })
    ]),
    el('ul', { class: 'draft-list' }, drafts.map(d => el('li', { class: 'draft' }, [
      el('span', { class: 'draft-title', text: d.name }),
      // encodeURIComponent on both halves: `&` ends a query parameter and `#`
      // ends the URL, so an unencoded note silently loses everything after the
      // first one it contains.
      el('a', {
        class: 'draft-send',
        href: `${issueBase}?title=${encodeURIComponent(`New movement: ${d.name}`)}`
            + `&body=${encodeURIComponent(d.note || '')}`,
        target: '_blank',
        rel: 'noopener',
        text: 'send'
      }),
      el('button', {
        type: 'button', class: 'draft-remove', text: 'remove',
        'aria-label': `remove ${d.name}`,
        onclick: () => onRemove(d.id)
      })
    ])))
  ]);
}

// spec §6 limitation 1. Also NOT renderError -- nothing is broken. Generating a
// session marks it done, so opening the app on a rest day writes a workout he
// never did; this is the app asking the one question only he can answer, once,
// about a day that is already over. Never mid-session: he is not interrupted
// between sets.
export function renderConfirmPrevious(session, { onYes, onNo } = {}) {
  return el('section', { class: 'empty confirm' }, [
    el('h2', { text: 'Did you finish this?' }),
    el('p', { class: 'confirm-what', text: `${titleCase(session.dayType)} — ${session.date}` }),
    el('p', {
      text: 'Opening the app writes the session down. If you did not train that day, say so and it will not count toward your load or your neglect scores.'
    }),
    el('div', { class: 'actions' }, [
      el('button', { class: 'btn', type: 'button', text: 'I did it',
                     onclick: () => onYes && onYes() }),
      el('button', { class: 'btn btn-secondary', type: 'button', text: "I didn't",
                     onclick: () => onNo && onNo() })
    ])
  ]);
}

// design §6.1. Deliberately NOT renderError: that screen is for a broken app,
// and this is the app working correctly on a hard input.
export function renderNothingBuildable() {
  return el('section', { class: 'empty' }, [
    el('h2', { text: 'Nothing to build' }),
    el('p', { text: "With what you've got there's no session here worth calling a session. Untick less, or take a rest day." })
  ]);
}

export function renderSession(
  session,
  { onReroll, onDone, onUndo, cuesFor, offer, equipment, soreness, addMove,
    onSwap, swapNote, onHome, readOnly = false } = {}
) {
  // One gate, not eight. A past day is rendered by the same function as a live
  // one -- the block rendering, the load lines and the flip cards are a few
  // hundred lines that must not fork (design §7) -- so read-only is expressed
  // by withholding the inputs rather than by branching through the renderer.
  //
  // onHome is deliberately NOT withheld: on a past day it is the only way
  // back, and suppressing it would strand him on the card.
  if (readOnly) {
    onReroll = onDone = onUndo = onSwap = undefined;
    equipment = soreness = addMove = undefined;
    offer = null;
    swapNote = null;
  }
  // Three groups, not two. Prep and cool-down do different jobs at opposite
  // ends of the session, and one "Mobility & core" heading hid that.
  // design 4.2, discrepancy 6.
  const COOLDOWN_ROLES = ['mobility', 'core'];
  const prep = session.blocks.filter(b => b.role === 'prep');
  const cooldown = session.blocks.filter(b => COOLDOWN_ROLES.includes(b.role));
  const main = session.blocks.filter(
    b => b.role !== 'prep' && !COOLDOWN_ROLES.includes(b.role)
  );

  const facts = [
    session.venue,
    `~${session.durationMin} min`,
    `ramp week ${session.rampWeek}`
  ];

  return el('div', { class: 'screen' }, [
    el('header', { class: 'session-head' }, [
      // Only rendered when there is somewhere to go. Before the home screen
      // existed the card WAS the app, and nothing wired this.
      onHome
        ? el('button', {
            class: 'session-home', type: 'button',
            'aria-label': 'Back to home', onclick: () => onHome()
          }, '‹ Home')
        : null,
      el('h1', { class: 'day-type', text: titleCase(session.dayType) }),
      el('p', { class: 'facts', text: facts.join(' · ') }),
      session.reason ? el('p', { class: 'reason', text: session.reason }) : null
    ]),

    session.warnings.length
      ? el('ul', { class: 'warnings' },
          session.warnings.map(w => el('li', { text: w })))
      : null,

    // Never a silent substitution: when the day type he would have got cannot
    // be built from what he has, the app says which one it was and why this
    // one is here instead. design-equipment-and-swap.md §4.1.
    // The plan paired this with session.reason, but the header three lines up
    // already prints it -- the athlete would read the same sentence twice.
    offer
      ? el('p', { class: 'offer' },
          `A ${titleCase(offer.blocked)} day needs equipment you said isn't here.`)
      : null,
    // A dead control that silently does nothing is the failure mode this
    // design exists to avoid. design §5.3.
    swapNote ? el('p', { class: 'offer', text: swapNote }) : null,
    // Soreness sits above equipment: what hurts decides what the session may
    // contain at all, while missing equipment only decides how it is loaded.
    // `open` is threaded from app.js: every tap rebuilds this whole tree, so a
    // panel that defaulted to closed would shut under his finger between joints.
    soreness
      ? sorenessMap(soreness.joints, soreness.current, soreness.onCycle, soreness.open)
      : null,
    equipment
      ? equipmentControl(equipment.items, equipment.selected, equipment.onToggle,
                         equipment.open)
      : null,
    // Last of the three: it changes nothing about today's session, it only
    // writes something down for later.
    addMove
      ? addMoveControl(addMove.drafts, addMove.issueBase,
                       { onSave: addMove.onSave, onRemove: addMove.onRemove },
                       addMove.open)
      : null,

    // Prep and cool-down are fixed blocks with no template slot, so only the
    // main work is swappable.
    blockGroup('Prep', prep, cuesFor),
    blockGroup('Main work', main, cuesFor, onSwap),
    blockGroup('Cool-down', cooldown, cuesFor),

    // Confirming is the end of the day's decisions: it says the session on the
    // record is training he actually did, so there is nothing left to reroll.
    // Leaving Reroll here would let one tap replace a workout he has just
    // reported doing -- and the replacement would arrive unconfirmed, losing
    // the record. spec §6 limitation 1.
    readOnly ? null : session.confirmed
      ? el('div', { class: 'done-note' }, [
          el('span', { text: 'Done · logged for today' }),
          // Confirming was a one-way door until the date rolled over, and he
          // ran into it: "I cannot click anything anymore". Undo lifts the
          // confirmation and nothing else -- the session is untouched, the
          // card unlocks, Reroll comes back. Deliberately quiet: this is the
          // rare correction, not the thing the screen is for.
          el('button', {
            class: 'btn-undo',
            type: 'button',
            onclick: onUndo
          }, 'Undo')
        ])
      : el('div', { class: 'actions' }, [
          // First and full width: at the foot of the card the session is over,
          // and this is the tap that day is for. Reroll is a decision from the
          // START of a session and sits under it. Nothing interrupts the
          // workout itself -- §8's "no logging, no confirmation prompt" is a
          // rule about the sets, not about the end of the day.
          el('button', {
            class: 'btn btn-done',
            type: 'button',
            onclick: onDone
          }, 'I did this workout'),
          el('button', {
            class: 'btn btn-secondary',
            type: 'button',
            onclick: onReroll
          }, 'Reroll')
        ]),

    el('p', { class: 'footnote', text: `${session.date} · seed ${session.seed}` })
  ]);
}

// --------------------------------------------------------------------------
// First-run setup
// --------------------------------------------------------------------------

// One question. The ramp is active from week 1 and not skippable, so the app
// cannot generate anything safe without knowing when training resumed. spec §9.
export function renderSetup({ onSubmit } = {}) {
  const input = el('input', {
    class: 'date-input',
    type: 'date',
    id: 'return-date',
    // Local, not UTC: west of UTC an evening visitor was offered a `max` of
    // tomorrow, and east of UTC could not pick the day they were standing in.
    max: localDate(),
    value: localDate()
  });

  return el('div', { class: 'screen screen-setup' }, [
    el('h1', { class: 'day-type', text: 'GymBuddy' }),
    el('p', { class: 'setup-copy', text:
      'When did you start training again? The first five weeks ramp the ' +
      'volume and the load ceiling. Be honest — backdating it skips the ramp.' }),
    el('label', { class: 'setup-label', for: 'return-date', text: 'Return date' }),
    input,
    el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => onSubmit && onSubmit(input.value)
      }, 'Start')
    ])
  ]);
}

export function renderError(message) {
  return el('div', { class: 'screen' }, [
    el('h1', { class: 'day-type', text: 'Stuck' }),
    el('p', { class: 'setup-copy', text: message })
  ]);
}

export function mount(root, node) {
  root.replaceChildren(node);
  window.scrollTo(0, 0);
}

// --------------------------------------------------------------------------
// The calendar. design-home-and-calendar.md §5, §8.
// --------------------------------------------------------------------------

// Colour is never the only encoding: every trained cell carries its two-letter
// code as text, and the accessible name spells the day type out in full. Seven
// hues separable by every form of colour vision do not exist. design §8.
export function renderCalendar({
  year, month, history, today, onPrev, onNext, onPick
} = {}) {
  const weeks = monthGrid(year, month, history, today);
  const monthName = monthLabel(year, month).split(' ')[0];

  const head = el('div', { class: 'cal-head' }, [
    el('button', {
      class: 'cal-prev', type: 'button',
      'aria-label': 'Previous month', onclick: () => onPrev && onPrev()
    }, '‹'),
    el('h2', { class: 'cal-title', text: monthLabel(year, month) }),
    el('button', {
      class: 'cal-next', type: 'button',
      'aria-label': 'Next month', onclick: () => onNext && onNext()
    }, '›')
  ]);

  const weekdays = el('div', { class: 'cal-weekdays' },
    WEEKDAY_LABELS.map(d => el('div', { class: 'cal-weekday', text: d })));

  const grid = el('div', { class: 'cal-grid' }, weeks.flat().map(cell => {
    const num = String(Number(cell.date.slice(8, 10)));
    const classes = extra => [
      'cal-cell', ...extra, cell.isToday ? 'is-today' : ''
    ].filter(Boolean).join(' ');

    // Not a button when there is nothing behind it. A focusable element that
    // does nothing is worse than no element -- it costs a tab stop per empty
    // day, thirty-odd of them a month, to reach the one that matters.
    if (!cell.session) {
      return el('div', {
        class: classes([cell.inMonth ? '' : 'is-outside']),
        text: cell.inMonth ? num : ''
      });
    }

    const type = cell.session.dayType;
    return el('button', {
      class: classes(['is-trained', `type-${type}`]),
      type: 'button',
      'aria-label': `${num} ${monthName}, ${titleCase(type)}`,
      onclick: () => onPick && onPick(cell.date)
    }, [
      el('span', { class: 'cal-num', text: num }),
      el('span', { class: 'cal-code', text: DAY_TYPE_CODE[type] || '??' })
    ]);
  }));

  // Only what is on screen. A fixed legend of all seven every month explains
  // marks that are not there and buries the two that are.
  const present = [];
  for (const cell of weeks.flat()) {
    if (cell.session && !present.includes(cell.session.dayType)) {
      present.push(cell.session.dayType);
    }
  }
  const legend = el('div', { class: 'cal-legend' }, present.map(type =>
    el('span', { class: `cal-key type-${type}` }, [
      el('span', { class: 'cal-code', text: DAY_TYPE_CODE[type] || '??' }),
      el('span', { text: ` ${titleCase(type)}` })
    ])
  ));

  return el('section', { class: 'calendar' }, [head, weekdays, grid, legend]);
}

// --------------------------------------------------------------------------
// The home screen. design-home-and-calendar.md §6.
// --------------------------------------------------------------------------

// Two facts, not a dashboard. Both are things the app knows and shows nowhere
// else, and the screen is otherwise one button and a grid.
function statusLine(rampWeek, daysSince) {
  const parts = [];
  if (rampWeek != null) parts.push(`Return week ${rampWeek}`);
  // null means never trained. daysSinceLastSession returns it rather than a
  // sentinel number precisely so that a number can never reach this sentence.
  if (daysSince === null || daysSince === undefined) parts.push('No sessions yet');
  else if (daysSince === 0) parts.push('Trained today');
  else if (daysSince === 1) parts.push('Last trained 1 day ago');
  else parts.push(`Last trained ${daysSince} days ago`);
  return parts.join(' · ');
}

export function renderHome({
  rampWeek, daysSince, todaySession, soreness, calendar, backup,
  onGenerate, onOpenToday
} = {}) {
  const children = [
    el('h1', { class: 'day-type', text: 'GymBuddy' }),
    el('p', { class: 'home-status', text: statusLine(rampWeek, daysSince) })
  ];

  // Before the button, not after it: the ordering IS the fix. Flag what is
  // sore, then generate, so soreness informs the first build instead of
  // rebuilding the session already on screen. design §6.1.
  if (soreness) {
    children.push(el('div', { class: 'home-soreness' }, [
      el('p', { class: 'setup-label', text: 'Anything sore?' }),
      sorenessMap(soreness.joints, soreness.current, soreness.onCycle)
    ]));
  }

  if (!todaySession) {
    children.push(el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn home-generate', type: 'button',
        onclick: () => onGenerate && onGenerate()
      }, "Generate today's workout")
    ]));
  } else {
    // Nothing to generate either way -- today is already on the record. The
    // difference is only whether training is over. Whether a second session in
    // one day is ever wanted is left open in design §12; until it is asked
    // for, the button is simply absent rather than guessed at.
    const doneToday = todaySession.confirmed === true;
    children.push(el('p', {
      class: 'home-today',
      text: doneToday
        ? `Done today — ${titleCase(todaySession.dayType)}`
        : `Today: ${titleCase(todaySession.dayType)}`
    }));
    children.push(el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn home-open', type: 'button',
        onclick: () => onOpenToday && onOpenToday()
      }, doneToday ? 'View it' : 'Open it')
    ]));
  }

  if (calendar) children.push(renderCalendar(calendar));
  // Last on the screen on purpose. It is touched a handful of times a year and
  // must not push the month grid, or the one button this screen exists for,
  // any further down the phone.
  if (backup) children.push(backupControl(backup));

  return el('div', { class: 'screen screen-home' }, children);
}

// --------------------------------------------------------------------------
// Backup. spec §6 "no export or import"
// --------------------------------------------------------------------------

// Collapsed by default and sitting at the foot of the home screen, for the
// same reason the add-move panel is: this is a control touched a handful of
// times a year, and the home screen exists for one button.
//
// The shape here is driven entirely by the fact that RESTORING DESTROYS
// EVERYTHING. A file picker opens on a tap and returns on a tap, so if the
// restore fired on `change` the whole history would be gone two gestures after
// an idle poke at a panel. So choosing a file only ever produces a `pending`
// summary, and this function renders the confirmation for it; the write is a
// second, separate, deliberate tap. `storage.readImport` and
// `storage.applyImport` are split down the same seam.
//
// No `window.confirm`. The app builds its own UI everywhere else, a native
// dialog in an installed PWA looks like a browser error, and a modal cannot
// show the counts that make the confirmation mean anything.
export function backupControl({
  pending = null,          // a summary from storage.readImport, or null
  existing = null,         // { sessions } that would be destroyed
  error = '',              // why the chosen file was refused
  onExport = () => {},
  onFile = () => {},
  onApply = () => {},
  onCancel = () => {},
  open = false
} = {}) {
  const file = el('input', {
    type: 'file',
    class: 'backup-file',
    // The picker on a phone lists everything unless it is told not to.
    accept: 'application/json,.json',
    onchange: e => onFile(e && e.target && e.target.files && e.target.files[0])
  });

  // Wrapped in a label rather than labelled beside one. Measured in Chrome at
  // 320-430px, a bare file input lays out 25px tall while every other control
  // on this screen is 44px; the label carries the height and makes the visible
  // text part of the same hit target. It is also the accessible name, so the
  // input needs no aria-label -- semantic HTML before ARIA.
  const restore = el('label', { class: 'backup-restore' }, [
    el('span', { class: 'setup-label', text: 'Restore from a file' }),
    file
  ]);

  const children = [
    el('summary', { text: 'Backup' }),
    el('p', {
      class: 'backup-note',
      text: 'Your training history lives only on this phone. A backup is the '
          + 'only way to get it onto another one.'
    }),
    el('div', { class: 'backup-actions' }, [
      el('button', {
        type: 'button', class: 'btn btn-secondary backup-save',
        text: 'Save a backup', onclick: () => onExport()
      })
    ]),
    restore
  ];

  if (error) {
    // role=alert, because choosing a file re-mounts the whole screen: a
    // message that is only visible is one a screen reader never receives.
    children.push(el('p', { class: 'backup-error', role: 'alert', text: error }));
  }

  if (pending) {
    // Named, not counted vaguely. "Replace your history?" is a question he
    // cannot answer; "replace 12 sessions with 47" is one he can.
    const span = pending.from
      ? `${pending.sessions} session${pending.sessions === 1 ? '' : 's'} `
        + `from ${pending.from} to ${pending.to}`
      // An empty backup is a real file and a real answer -- restoring one is
      // how the app gets wiped deliberately. It must not read as a no-op.
      : '0 sessions — this backup is empty';
    const have = existing && typeof existing.sessions === 'number'
      ? existing.sessions : 0;

    children.push(el('div', { class: 'backup-confirm' }, [
      el('p', { class: 'backup-what', text: `This file holds ${span}.` }),
      el('p', {
        class: 'backup-cost',
        text: `Restoring will replace the ${have} session`
            + `${have === 1 ? '' : 's'} on this phone. That cannot be undone.`
      }),
      el('div', { class: 'backup-actions' }, [
        // NOT the plain `.btn`. That is `--accent`, the colour worn by
        // "Generate today's workout" -- the most inviting thing on the screen,
        // and the wrong dress for the only control that can destroy the
        // history. Seen in the browser; no assertion above caught it.
        el('button', {
          type: 'button', class: 'btn btn-danger backup-apply',
          text: 'Replace everything', onclick: () => onApply()
        }),
        el('button', {
          type: 'button', class: 'btn btn-secondary backup-cancel',
          text: 'Cancel', onclick: () => onCancel()
        })
      ])
    ]));
  }

  return el('details', { class: 'backup', open }, children);
}
