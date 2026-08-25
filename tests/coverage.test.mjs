// The coverage matrix -- the executable form of design-library-expansion.md.
//
// Nothing here writes a per-pool number down. Every target is DERIVED from the
// templates and measured against the real library, so changing a slot's count
// moves its target with it. Only two policy inputs are constants, and both
// carry their provenance. design-library-expansion.md §6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { eligibleFor } from '../js/generator.js';
import { TEMPLATES, DAY_TYPES, PREP_BLOCK, COOLDOWN_BLOCK } from '../js/templates.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

// ---------------------------------------------------------------------------
// Policy inputs -- the only two numbers in this file
// ---------------------------------------------------------------------------

// The athlete's own choice: about two months at his irregular 1-3x/week.
// A preference, not a finding. design-library-expansion.md §3.2.
const SESSIONS_BEFORE_REPEAT = 16;

// The smallest number that survives one option being banned and one being
// drawn earlier in the same session and still leaves a choice.
// [unverified] -- a design floor, open question 1.
const OPTIONS_PER_JOINT = 3;

// Pools drawn by a TEMPLATE slot normally carry VARIETY. aerobic-steady does
// not, and the reason is that VARIETY's premise fails there rather than that
// variety would do harm. See design-library-expansion.md §3.2.
const VARIETY_EXEMPT_MODALITIES = new Set(['aerobic-steady']);

const JOINTS = [
  'hip', 'knee', 'ankle', 'lumbar', 'thoracic', 'shoulder', 'scapula',
  'elbow', 'wrist'
];

// Which joints a pool is responsible for. Demanding three wrist options from
// the core pool is how a rule stops meaning anything. §3.3.
const COVERAGE_SCOPE = {
  'mobility-static': ['hip', 'knee', 'ankle', 'lumbar', 'thoracic', 'shoulder', 'scapula'],
  'mobility-dynamic': ['hip', 'knee', 'ankle', 'lumbar', 'thoracic', 'shoulder', 'scapula'],
  core: ['lumbar', 'thoracic', 'hip']
};

// Pools that lose EVERY entry to one hurt joint, because the joint is
// intrinsic to the movement class. An empty sprint pool on a hurt hip is the
// correct answer; proposing the day was the mistake. Handed to Project B.
// Named individually so a fifth cannot appear silently. §5.
const FLOOR_EXEMPT = new Set([
  'core :: core/rotate :: (any)',
  'primary+secondary+accessory :: locomotion :: aerobic-steady',
  'secondary+accessory :: sprint :: sprint',
  'primary :: hinge/pull-h :: power'
]);

// Pools whose targets are met and must stay met. Adding a line here is how an
// authoring commit becomes permanent. Empty until the first pool is closed --
// the alternative, a suite left red for the length of the project, would hide
// every regression while it ran.
const CLOSED_POOLS = [
  'mobility :: mobility :: mobility-static',
  'mobility :: mobility :: mobility-dynamic',
  'core :: core/rotate :: (any)'
];

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

const MOBILITY_MODALITIES = new Set(['mobility-static', 'mobility-dynamic']);

function poolKey(slot) {
  return [
    slot.tier.join('+'),
    (slot.patterns || []).join('/') || '(any)',
    slot.modality || '(any)'
  ].join(' :: ');
}

function poolSize(slot, venue, soreness = {}) {
  return eligibleFor(slot, LIB, {
    venue, soreness, banned: [], excludeIds: new Set()
  }).length;
}

// Every distinct pool the generator can ask for, with the draw its slot makes.
function buildPools() {
  const rows = [];
  for (const [dayType, template] of Object.entries(TEMPLATES)) {
    for (const slot of template) {
      rows.push({ slot, venue: DAY_TYPES[dayType].venue, drawMin: 1, drawMax: 1,
                  fromTemplate: true });
    }
  }
  for (const block of [PREP_BLOCK, COOLDOWN_BLOCK]) {
    for (const groups of Object.values(block)) {
      for (const g of groups) {
        for (const venue of ['gym', 'outdoor']) {
          rows.push({ slot: g, venue, drawMin: g.count[0], drawMax: g.count[1],
                      fromTemplate: false });
        }
      }
    }
  }

  const pools = new Map();
  for (const r of rows) {
    const key = poolKey(r.slot);
    const full = poolSize(r.slot, r.venue);

    // survival is MEASURED, not assumed -- which joint hurts a pool worst is a
    // fact about the data and moves as the data moves. §3.1.
    let worst = full;
    let worstJoint = null;
    for (const j of JOINTS) {
      const n = poolSize(r.slot, r.venue, { [j]: 'hurt' });
      if (n < worst) { worst = n; worstJoint = j; }
    }
    const survival = full ? worst / full : 0;

    // "Main-work pool" means a pool a TEMPLATE slot draws -- the work between
    // the prep and the cool-down. Derived from where the slot came from, not
    // from a list this file keeps. §3.2. The prep and cool-down pools adapt by
    // repetition, and so does aerobic-steady, which is the one main-work pool
    // the rule's premise does not fit.
    const byRepetition = !r.fromTemplate ||
                         VARIETY_EXEMPT_MODALITIES.has(r.slot.modality);

    const floor = survival > 0 ? Math.ceil(r.drawMin / survival) : null;
    const variety = byRepetition ? null : SESSIONS_BEFORE_REPEAT * r.drawMax;
    const need = Math.max(floor || 0, variety || 0);

    // Keep the venue that demands most of the pool.
    const prev = pools.get(key);
    const rec = {
      key, venue: r.venue, drawMin: r.drawMin, drawMax: r.drawMax,
      full, worst, worstJoint, survival, floor, variety, need,
      short: Math.max(0, need - full), byRepetition, fromTemplate: r.fromTemplate,
      modality: r.slot.modality, tier: r.slot.tier
    };
    if (!prev || rec.short > prev.short) pools.set(key, rec);
  }
  return [...pools.values()];
}

const POOLS = buildPools();

// Per-joint coverage for the pools that adapt by repetition rather than
// novelty. §3.3.
function jointCoverage(poolName) {
  const inPool = poolName === 'core'
    ? LIB.filter(e => e.tier === 'core')
    : LIB.filter(e => (e.modalities || []).includes(poolName));
  const counts = {};
  for (const j of COVERAGE_SCOPE[poolName]) {
    counts[j] = inPool.filter(e => (e.joints || []).includes(j)).length;
  }
  return { size: inPool.length, counts };
}

// ---------------------------------------------------------------------------
// The assertions
// ---------------------------------------------------------------------------

test('every pool the generator can ask for was found and measured', () => {
  assert.ok(POOLS.length >= 15, `only ${POOLS.length} pools discovered`);
  for (const p of POOLS) {
    assert.ok(p.full > 0, `${p.key} is empty at ${p.venue}`);
  }
});

test('the four floor-exempt pools really are the ones that reach zero', () => {
  const measured = POOLS.filter(p => p.survival === 0).map(p => p.key).sort();
  assert.deepEqual(measured, [...FLOOR_EXEMPT].sort(),
    'a pool started or stopped collapsing to zero -- design §5 needs revisiting');
});

test('a closed pool still meets its derived target', () => {
  for (const key of CLOSED_POOLS) {
    const p = POOLS.find(x => x.key === key);
    assert.ok(p, `CLOSED_POOLS names "${key}" but no such pool exists`);
    assert.ok(p.full >= p.need,
      `${key}: holds ${p.full}, needs ${p.need} ` +
      `(floor ${p.floor ?? 'exempt'}, variety ${p.variety ?? 'n/a'})`);
  }
});

test('a closed mobility pool covers every joint in its scope', () => {
  for (const key of CLOSED_POOLS) {
    const p = POOLS.find(x => x.key === key);
    const name = p.tier.includes('core') ? 'core' : p.modality;
    if (!COVERAGE_SCOPE[name]) continue;
    const { counts } = jointCoverage(name);
    for (const [joint, n] of Object.entries(counts)) {
      assert.ok(n >= OPTIONS_PER_JOINT,
        `${name}: ${joint} has ${n} option(s), needs ${OPTIONS_PER_JOINT}`);
    }
  }
});

test('VARIETY applies to every main-work pool except the named exemptions', () => {
  const exempt = POOLS
    .filter(p => p.fromTemplate && p.variety === null)
    .map(p => p.modality)
    .sort();
  assert.deepEqual(exempt, [...VARIETY_EXEMPT_MODALITIES].sort(),
    'a main-work pool gained or lost its VARIETY target -- design §3.2 needs revisiting');

  for (const p of POOLS) {
    if (!p.fromTemplate) {
      assert.equal(p.variety, null,
        `${p.key} is a prep/cool-down pool and must not carry a VARIETY target`);
    }
  }
});

// Not an assertion -- the derived table, written out so the targets can be read
// without running anything. §6.
test('the derived matrix is written to docs/coverage-matrix.md', () => {
  const lines = [
    '# Coverage matrix — derived, do not edit',
    '',
    'Generated by `tests/coverage.test.mjs` from the templates and the current',
    'library. Every number here is computed; none is written down. Regenerate by',
    'running the suite.',
    '',
    `- \`SESSIONS_BEFORE_REPEAT\` = ${SESSIONS_BEFORE_REPEAT} (athlete's preference)`,
    `- \`OPTIONS_PER_JOINT\` = ${OPTIONS_PER_JOINT} ([unverified] design floor)`,
    `- library holds ${LIB.length} entries`,
    `- closed pools: ${CLOSED_POOLS.length ? CLOSED_POOLS.join(', ') : 'none yet'}`,
    '',
    '| pool | draw | have | survival | floor | variety | need | short |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const p of [...POOLS].sort((a, b) => b.short - a.short)) {
    lines.push(
      `| \`${p.key}\` | ${p.drawMax} | ${p.full} | ` +
      `${Math.round(p.survival * 100)}%${p.worstJoint ? ` (${p.worstJoint})` : ''} | ` +
      `${p.floor ?? 'exempt'} | ${p.variety ?? (p.fromTemplate ? 'repetition' : 'coverage')} | ` +
      `${p.need} | ${p.short} |`
    );
  }
  lines.push('', '## Joint coverage', '');
  lines.push('| pool | ' + JOINTS.join(' | ') + ' |');
  lines.push('|---'.repeat(JOINTS.length + 1) + '|');
  for (const name of Object.keys(COVERAGE_SCOPE)) {
    const inPool = name === 'core'
      ? LIB.filter(e => e.tier === 'core')
      : LIB.filter(e => (e.modalities || []).includes(name));
    const cells = JOINTS.map(j => {
      const n = inPool.filter(e => (e.joints || []).includes(j)).length;
      const inScope = COVERAGE_SCOPE[name].includes(j);
      if (!inScope) return `${n}·`;
      return n >= OPTIONS_PER_JOINT ? `${n}` : `**${n}**`;
    });
    lines.push(`| \`${name}\` (${inPool.length}) | ` + cells.join(' | ') + ' |');
  }
  lines.push('', '`**n**` is below target. `n·` is outside that pool\'s scope.', '');

  const total = POOLS.reduce((a, p) => a + p.short, 0);
  lines.push(`Raw shortfall across all pools: **${total}** (pools overlap, so an`);
  lines.push('entry can close more than one).');
  lines.push('');

  writeFileSync(
    new URL('../docs/coverage-matrix.md', import.meta.url),
    lines.join('\n') + '\n'
  );
  assert.ok(true);
});
