// Scaffold a derived library entry. design-library-expansion.md §11.5.
//
//   node tools/derive.mjs --parent hip-thrust --id b-stance-hip-thrust \
//                         --name "B-Stance Hip Thrust"
//   node tools/derive.mjs --parent hip-thrust --id band-hip-thrust \
//                         --name "Band Hip Thrust" --equipment bands --venue either
//
// Prints a block to paste into data/exercises.json. It deliberately does NOT
// write to the file: the library is hand-formatted, one entry per aligned
// block, and a script that reflowed it would produce a diff nobody can read.
//
// WHY THIS EXISTS. §11.2's rule is that a derived variant moves exactly one
// axis and copies nine fields off its parent unchanged. That copying is
// mechanical, boring, and the single thing derivation-guard.mjs fails on. The
// judgement -- which parent, which axis, what the cue should now say -- is not
// mechanical and is left alone.
//
// WHAT IT DOES NOT DO, on purpose: it does not validate the finished entry.
// The suite already does that, comprehensively -- cue-guard, derivation-guard,
// coef-provenance, taxonomy, id uniqueness, pool depth. A second gate here
// would duplicate all of it and then drift from it. This tool's whole job is
// to hand you a draft that only fails on the part you have to write.

import { readFileSync } from 'node:fs';

// Kept in step with tests/derivation-guard.mjs's INHERITED. Not imported from
// it: tests/ is the suite's own directory and this is a tool, so the coupling
// is asserted in tests/derive-tool.test.mjs instead -- every inherited field
// must arrive on the draft, which fails loudly if the two lists diverge.
const COPIED = [
  'pattern', 'tier', 'joints',
  'cnsCost', 'technical', 'unilateral', 'modalities', 'isometric', 'targets'
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function derive({ parentId, id, name, equipment, venue }, library) {
  const byId = Object.fromEntries(library.map(e => [e.id, e]));

  if (!SLUG.test(String(id || ''))) {
    throw new Error(`id "${id}" must be a lower-case slug, e.g. b-stance-hip-thrust`);
  }
  if (byId[id]) throw new Error(`id "${id}" is already in the library`);
  if (!name || !String(name).trim()) throw new Error('a name is required');

  const parent = byId[parentId];
  if (!parent) throw new Error(`parent "${parentId}" is not in the library`);
  if (parent.derivedFrom != null) {
    throw new Error(
      `parent "${parentId}" is itself derived from "${parent.derivedFrom}"; ` +
      'derivation is one deep, so derive from that entry instead');
  }

  const movedImplement = equipment != null &&
    JSON.stringify([...equipment].sort()) !== JSON.stringify([...parent.equipment].sort());

  // VENUE_FOLLOWS_IMPLEMENT, checked here so the tool cannot emit a draft the
  // guard would reject. A variant that did not move the implement is available
  // exactly where its parent is.
  if (venue != null && venue !== parent.venue && !movedImplement) {
    throw new Error(
      `venue "${venue}" differs from parent "${parentId}" ("${parent.venue}") ` +
      'but the implement did not move; change the equipment or drop --venue');
  }

  const entry = {
    id, name: String(name).trim(),
    pattern: parent.pattern,
    tier: parent.tier,
    // A coefficient is a measurement taken on the parent, and derivation never
    // inherits a measurement. Sourcing one for the variant is what makes it
    // loadable, and that is a separate act with its own provenance record.
    loadable: false, prRef: null, prCoef: null,
    joints: [...parent.joints],
    equipment: equipment ? [...equipment] : [...parent.equipment],
    venue: venue ?? parent.venue,
    cnsCost: parent.cnsCost,
    technical: parent.technical,
    unilateral: parent.unilateral,
    // The parent's lines, verbatim and on purpose. The derivation guard
    // rejects a variant whose cues are byte-identical to its parent's, so a
    // draft pasted in and forgotten FAILS THE SUITE rather than shipping.
    // Rewrite the line the moved axis actually changed; keep the rest.
    cues: [...(parent.cues || [])],
    modalities: [...parent.modalities],
    derivedFrom: parentId
  };
  if ('isometric' in parent) entry.isometric = parent.isometric;
  if ('targets' in parent) entry.targets = [...parent.targets];

  // Field order for printing follows the library's own, so a pasted block
  // reads like its neighbours.
  return { entry, parent };
}

// Render in the library's hand-written shape: 2-space indent inside a 4-space
// entry, arrays inline, cues on their own line.
export function format(entry) {
  const j = v => JSON.stringify(v);
  const arr = v => '[' + v.map(x => j(x)).join(',') + ']';
  const L = [];
  L.push(`    { "id": ${j(entry.id)}, "name": ${j(entry.name)}, "pattern": ${j(entry.pattern)}, "tier": ${j(entry.tier)},`);
  L.push(`      "loadable": false, "prRef": null, "prCoef": null,`);
  L.push(`      "joints": ${arr(entry.joints)}, "equipment": ${arr(entry.equipment)}, "venue": ${j(entry.venue)},`);
  let line4 = `      "cnsCost": ${entry.cnsCost}, "technical": ${entry.technical}, "unilateral": ${entry.unilateral},`;
  if ('isometric' in entry) line4 += ` "isometric": ${entry.isometric},`;
  L.push(line4);
  L.push(`      "cues": ${arr(entry.cues)},`);
  if ('targets' in entry) L.push(`      "targets": ${arr(entry.targets)},`);
  L.push(`      "derivedFrom": ${j(entry.derivedFrom)},`);
  L.push(`      "modalities": ${arr(entry.modalities)} },`);
  return L.join('\n');
}

// ---- CLI ------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i], v = argv[i + 1];
    if (!k.startsWith('--')) throw new Error(`unexpected argument "${k}"`);
    out[k.slice(2)] = v;
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}` ||
               import.meta.url.endsWith(String(process.argv[1] || '').replace(/\\/g, '/'));

if (isMain) {
  try {
    const a = parseArgs(process.argv.slice(2));
    if (!a.parent || !a.id || !a.name) {
      console.error(
        'usage: node tools/derive.mjs --parent <id> --id <new-id> --name "<Name>"\n' +
        '                            [--equipment a,b] [--venue gym|either|outdoor]');
      process.exit(2);
    }
    const lib = JSON.parse(
      readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
    ).exercises;
    const { entry, parent } = derive({
      parentId: a.parent, id: a.id, name: a.name,
      equipment: a.equipment ? a.equipment.split(',') : undefined,
      venue: a.venue
    }, lib);

    console.log(format(entry));
    console.log('');
    console.log(`# derived from ${parent.name} (${parent.id})`);
    console.log('# STILL YOURS TO DO:');
    console.log('#   1. rewrite the cue line the moved axis changed -- the lines above');
    console.log('#      are the parent\'s verbatim, and the suite rejects that.');
    if (parent.loadable) {
      console.log('#   2. loadable is false. To load it, source a prCoef for THIS variant');
      console.log('#      and record the provenance in tests/coef-provenance.mjs.');
    }
    console.log('# then: node --test tests/*.test.mjs');
  } catch (err) {
    console.error(`derive: ${err.message}`);
    process.exit(1);
  }
}
