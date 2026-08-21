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

// The one line the user reads mid-set. Never an absolute weight -- always a
// multiplier against a PR he already knows. spec §2, §10.
//
// prCoef is already folded into displayMultiplier by the generator, so this
// prints one multiplication and never two.
export function loadLine(block) {
  if (block.mode === 'time') {
    return `${block.durationMin} min`;
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
  return `${block.displayMultiplier.toFixed(2)} × ${titleCase(block.prRef)} PR`;
}

// The top-right of the card. Timed work has no set count, and its effort cue
// is a sentence -- too long for a header slot, so it drops to the meta line.
export function volumeLine(block) {
  if (block.mode === 'time') return '';
  return `${block.sets} × ${block.reps}`;
}

// --------------------------------------------------------------------------
// Blocks
// --------------------------------------------------------------------------

function blockCard(block) {
  const volume = volumeLine(block);

  // The effort cue is already the headline for contact-less explosive work;
  // don't print it twice.
  const heroIsEffort =
    block.mode === 'reps' || (block.mode === 'contacts' && !block.footContacts);
  const meta = [formatRest(block.restSec)];
  if (block.effort && !heroIsEffort) meta.push(block.effort);
  if (block.optional) meta.push('optional');

  return el('li', { class: 'block' }, [
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
    meta.filter(Boolean).length
      ? el('p', { class: 'block-meta', text: meta.filter(Boolean).join(' · ') })
      : null
  ]);
}

function blockGroup(title, blocks) {
  if (!blocks.length) return null;
  return el('section', { class: 'group' }, [
    el('h2', { class: 'group-title', text: title }),
    el('ul', { class: 'block-list' }, blocks.map(blockCard))
  ]);
}

// --------------------------------------------------------------------------
// Session screen
// --------------------------------------------------------------------------

export function renderSession(session, { onReroll } = {}) {
  const mobility = session.blocks.filter(b => b.role === 'mobility' || b.role === 'core');
  const main = session.blocks.filter(b => !(b.role === 'mobility' || b.role === 'core'));

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

    blockGroup('Main work', main),
    blockGroup('Mobility & core', mobility),

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
