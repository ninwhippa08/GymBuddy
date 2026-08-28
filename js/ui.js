// ui.js -- DOM rendering. spec §7
//
// Pure rendering: every function takes data and returns a detached DOM node.
// Nothing here reads localStorage, generates a session, or attaches app
// behaviour -- app.js does the wiring. Handlers arrive as arguments.
//
// Built with createElement and textContent throughout, never innerHTML. The
// exercise library is a local file today, but a rendering path that cannot
// interpret markup is one less thing to be careful about later.

// --------------------------------------------------------------------------
// Element helper
// --------------------------------------------------------------------------

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
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
    // Throws and slams have no ground contact to count -- the generator sets
    // footContacts to 0 on purpose. "0 contacts" as the headline tells the
    // user nothing, so the effort cue becomes the prescription instead.
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
  return `${block.sets} × ${block.reps}`;
}

// --------------------------------------------------------------------------
// Blocks
// --------------------------------------------------------------------------

export function blockCard(block, cuesFor) {
  const volume = volumeLine(block);

  // The effort cue is already the headline for contact-less explosive work;
  // don't print it twice.
  const heroIsEffort =
    block.mode === 'reps' || (block.mode === 'contacts' && !block.footContacts);
  // An interval's recovery is already in the hero line, and what matters
  // about it is not its length but that it is not a rest: standing still
  // between hard efforts is how the next one goes badly.
  const meta = [block.mode === 'interval'
    ? 'walk or jog the recovery -- never stand still'
    : formatRest(block.restSec)];
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
    meta.filter(Boolean).length
      ? el('p', { class: 'block-meta', text: meta.filter(Boolean).join(' · ') })
      : null
  ]);

  const cues = typeof cuesFor === 'function' ? cuesFor(block.exerciseId) : null;

  // No cues yet means no flip and no affordance, rather than a card that turns
  // over to an empty back. design-card-flip.md §7.
  if (!cues || !cues.length) return el('li', { class: 'block' }, front);

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

  return el('li', { class: 'block has-cues' }, btn);
}

function blockGroup(title, blocks, cuesFor) {
  if (!blocks.length) return null;
  return el('section', { class: 'group' }, [
    el('h2', { class: 'group-title', text: title }),
    // NOT blocks.map(blockCard) -- map passes the index as the second argument,
    // which would arrive where cuesFor belongs.
    el('ul', { class: 'block-list' }, blocks.map(b => blockCard(b, cuesFor)))
  ]);
}

// --------------------------------------------------------------------------
// Session screen
// --------------------------------------------------------------------------

export function renderSession(session, { onReroll, cuesFor } = {}) {
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
      el('h1', { class: 'day-type', text: titleCase(session.dayType) }),
      el('p', { class: 'facts', text: facts.join(' · ') }),
      session.reason ? el('p', { class: 'reason', text: session.reason }) : null
    ]),

    session.warnings.length
      ? el('ul', { class: 'warnings' },
          session.warnings.map(w => el('li', { text: w })))
      : null,

    blockGroup('Prep', prep, cuesFor),
    blockGroup('Main work', main, cuesFor),
    blockGroup('Cool-down', cooldown, cuesFor),

    el('div', { class: 'actions' }, [
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
    max: new Date().toISOString().slice(0, 10),
    value: new Date().toISOString().slice(0, 10)
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
