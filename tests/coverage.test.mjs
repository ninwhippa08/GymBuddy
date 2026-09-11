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

// The athlete's own choice, stated as "about two months at his irregular
// 1-3x/week". A preference, not a finding. design-library-expansion.md §3.2.
//
// WHAT IT ACTUALLY DELIVERS, measured 2026-09-11 over 120 runs of 60 sessions
// and recorded because the gloss above describes a different quantity: a pool
// of this size does NOT stop a movement repeating inside 16 sessions. Only
// 13-21% of repeats in the governed gym pools fall inside 16, so the rule is
// neither met nor needed at face value.
//
// 16 is instead, near enough, THE POINT WHERE THE REALIZED INTERVAL SATURATES.
// Median gap between repeats of one movement in one slot, in turns of that
// day type: 1 entry -> 1 turn, 2-3 -> 2, 7 -> 2-3, and 14 through 49 all ->
// 3 turns / 24 sessions. A pool of 49 buys nothing a pool of 16 does not.
//
// So DO NOT LOWER THIS on the arithmetic that a day-type-specific pool "only
// needs two entries to clear sixteen sessions". That argument was made in
// §31.3, is wrong in outcome terms, and is withdrawn in §34: two entries
// measure at an 11-session interval. The arithmetic assumes round-robin
// selection and `scoreExercise` does not select that way.
const SESSIONS_BEFORE_REPEAT = 16;

// The smallest number that survives one option being banned and one being
// drawn earlier in the same session and still leaves a choice.
// [unverified] -- a design floor, open question 1.
const OPTIONS_PER_JOINT = 3;

// Pools drawn by a TEMPLATE slot normally carry VARIETY. These eight do not,
// and in seven cases the reason is that VARIETY's premise -- that novelty is
// what drives the adaptation -- fails, not that variety would do harm.
//
// Keyed on the POOL and not, as until 2026-09-06, on the modality. Three
// reasons. The jump pools carry `modality: null`, so a modality-keyed set
// cannot name them at all. A modality key silently covers every pool that ever
// gains that modality, which is how a rule governing thirty-two pools gets
// widened by a line that reads like it names one. And naming pools
// individually is what FLOOR_EXEMPT and CLOSED_POOLS already do in this file,
// for the reason FLOOR_EXEMPT states: so a fifteenth cannot appear silently.
//
// Settled 2026-09-06 by the athlete, on design-running-programming.md §11.0's
// recommendation. Not every pool §11.0 listed is here: after the venue fix
// in poolSize below, `primary+secondary :: jump :: (any)` holds 21 and closed
// on its own, and `primary :: jump :: (any)` is short 2 -- closeable by
// authoring, so it stays measured. An exemption is for a target that cannot be met, never for
// one that has not been.
//
// THE EIGHTH, added 2026-09-11, rests on a DIFFERENT ground and the difference
// is worth stating rather than blurring. The seven above are pools where the
// movements do not exist. The starts pool could be filled -- fifteen or so solo
// start positions are describable -- and it is exempt because the TARGET is
// mis-scaled for a pool tied to one day type, and because the pool already
// repeats less than anything else in the library. That is a claim about the
// formula, not about the catalogue, so it is argued in full at the entry
// itself and recorded as an open question rather than generalised silently.
const VARIETY_EXEMPT_POOLS = new Set([
  // Aerobic adaptation is accumulated time at intensity, which one movement
  // delivers as well as sixteen. Amended 2026-08-25, sourced in §3.2.
  'primary+secondary+accessory :: run/erg :: aerobic-steady',
  // The same pool at two other energy systems, split out on 2026-08-27. The
  // argument does not change with the work interval.
  'primary+secondary+accessory :: run/erg :: interval',
  'primary+secondary+accessory :: run/erg :: tempo',
  // Sprinting. Variety on a sprint day comes from distance, rest and effort.
  // The library holds 11 sprint entries because those are the sprints that
  // exist; a sixteenth invented to satisfy a counter is worse than the repeat
  // it replaces. Repeating the acceleration sprint IS sprint training.
  'primary :: sprint :: sprint :: maximal',
  'secondary :: sprint :: sprint :: maximal',
  'secondary+accessory :: sprint :: sprint :: submaximal',
  // The third sprint pool on the same day, and it did not exist as a pool when
  // the three above were settled -- opening the start slot on 2026-09-09 (§25)
  // made seven accessory-tier starts prescribable for the first time, and they
  // arrived carrying a target their two neighbours had been exempted from three
  // days earlier. Settled 2026-09-11 by the athlete, on two measurements.
  //
  // It is the LEAST REPEATED pool in the library: 0.60 repeats per entry per
  // twelve-week block over 150 blocks with history fed forward, against 1.41
  // for the primary sprints beside it and 1.55 for the run pool, which §29
  // called the least repetitive this project had worked on.
  //
  // And the target it misses is counting the wrong thing. SESSIONS_BEFORE_REPEAT
  // is 16 SESSIONS -- "about two months at his irregular 1-3x/week", §3.2. The
  // sprint day arrives every 8.5 sessions (measured, 3,600 sessions), so a pool
  // drawn only on that day needs TWO entries to clear a sixteen-session horizon.
  // It holds seven. `16 x drawMax` multiplies the horizon by the slot's draw and
  // never asks how often the DAY arrives. That looked like a finding about the
  // FORMULA and was logged as open question 7; it was MEASURED on 2026-09-11
  // and does not hold -- pool size stops governing the repeat interval above
  // about sixteen entries, so scaling the target by the day-type gap would have
  // licensed pools of 2-4 that measure at an 11-session interval against 24
  // today. Question 7 is CLOSED and the target stays. §34.
  //
  // THIS EXEMPTION IS UNAFFECTED, but it now rests on one leg rather than two:
  // §31.2's repetition measurement (0.60 repeats per entry per twelve-week
  // block, the lowest in the library) stands, and the seven starts realize a
  // 22-session interval. The mis-scaling half of the argument is withdrawn.
  'accessory :: sprint :: sprint :: maximal',
  // The low-intensity plyo finisher. Six exist; the ten more would be pogo-hop
  // and line-hop variants, which is the padding §11.0 declined by name. The
  // two moderate/high jump pools are NOT here -- they are close enough to
  // author, and one of them already passes.
  'secondary+accessory :: jump :: (any)'
]);

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
// Named individually so a fifteenth cannot appear silently. §5.
//
// The four running day types put ten more pools here, and they are all the
// same fact restated: you cannot run, sprint or jump on a hurt ankle, knee or
// hip, and every entry in those pools loads at least one of the three. The
// list is long because the running work is honest about which joints it
// needs, not because the exemption got looser. plan-03 tasks 5 and 7.
const FLOOR_EXEMPT = new Set([
  'core :: core/rotate :: (any)',
  'primary :: hinge/pull-h :: power',
  // Running prep -- the four stages of the warm-up.
  'accessory :: run :: aerobic-steady',
  'accessory :: sprint-drill/agility :: (any)',
  'secondary :: sprint :: sprint :: submaximal',
  // The starts, added to the sprint day 2026-09-09. Three accessory-tier
  // maximal sprints, all on ankle/knee/hip -- so a hurt ankle empties the
  // pool, which is the most literal case of the sentence above.
  // design-library-expansion.md §25.
  'accessory :: sprint :: sprint :: maximal',
  'secondary+accessory :: jump :: (any)',
  // Easy run and intervals.
  'primary+secondary+accessory :: run/erg :: aerobic-steady',
  'primary+secondary+accessory :: run/erg :: interval',
  // The tempo finisher, split out of the interval pool on 2026-08-27. Same
  // fact as its sibling above: every entry loads ankle, knee or hip.
  'primary+secondary+accessory :: run/erg :: tempo',
  'secondary+accessory :: sprint :: sprint :: submaximal',
  // Sprint day.
  'primary :: sprint :: sprint :: maximal',
  'secondary :: sprint :: sprint :: maximal',
  // Plyometric day.
  'primary :: jump :: (any)',
  'primary+secondary :: jump :: (any)',
  // Balance, added 2026-09-07 with the modality. Same fact as every line
  // above, and the most literal instance of it: all three entries are
  // joints ['ankle','knee','hip'], so a hurt ankle empties the pool. That is
  // the correct behaviour -- standing on one leg is the last thing a sore
  // ankle should be asked to do -- rather than a pool that needs more entries.
  'mobility :: balance :: balance'
]);

// Pools whose targets are met and must stay met. Adding a line here is how an
// authoring commit becomes permanent. Empty until the first pool is closed --
// the alternative, a suite left red for the length of the project, would hide
// every regression while it ran.
const CLOSED_POOLS = [
  'mobility :: mobility :: mobility-static',
  'mobility :: mobility :: mobility-dynamic',
  'core :: core/rotate :: (any)',
  // 'secondary+accessory :: sprint :: sprint' dropped out here: splitting
  // sprint-drill and agility out of the sprint pattern correctly shrank this
  // pool from 16 to 4 secondary+accessory members, below its variety floor
  // of 16. It stays in FLOOR_EXEMPT (still collapses to zero on an
  // ankle/knee/hip injury) but can't be asserted closed until Task 5's
  // effortClass-qualified poolKey (and/or Task 7's template rewrite)
  // resolves what this pool should actually require. plan-03 task-2.
  'primary+secondary :: jump/throw :: power',
  'primary :: squat/hinge/push-h/push-v/pull-v :: max-strength',
  'accessory :: lunge/carry/rotate :: hypertrophy',
  'primary+secondary :: squat/push-h/push-v :: power',
  'primary :: squat/hinge/push-h/push-v/pull-v :: hypertrophy',
  // The running prep, locked once its stages measured green. The tight one is
  // the hip/knee/ankle dynamic pool: floor 14, have exactly 14, so removing a
  // single drill starves stage 2 on a hurt hip. plan-03 task-9.
  'mobility :: mobility :: mobility-dynamic :: hip/knee/ankle',
  'accessory :: run :: aerobic-steady',
  'accessory :: sprint-drill/agility :: (any)',
  'secondary :: sprint :: sprint :: submaximal',
  'primary+secondary+accessory :: run/erg :: aerobic-steady',
  // Closed 2026-09-06 without authoring anything. §11.0 listed this pool among
  // the eight to exempt on the strength of a measured 12; correcting poolSize's
  // venue handling showed the app had been drawing from 21 all along. Locked
  // here so the fix cannot quietly regress.
  'primary+secondary :: jump :: (any)',
  // Closed 2026-09-07 by AUTHORING, which is what §11.0 said this pool was
  // short of and its sibling above was not. The library had no unilateral
  // VERTICAL jump at all -- every one-legged jump in it travelled forward or
  // sideways -- and nothing taking off from an approach. Both are gaps in the
  // movement rather than gaps in a counter. design-library-expansion.md §19.
  'primary :: jump :: (any)'
];

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

const MOBILITY_MODALITIES = new Set(['mobility-static', 'mobility-dynamic']);

// Which venues a prep or cool-down variant is actually used at. The gym
// variants serve gym and outdoor days alike, so they default to both.
// `running` serves the running day types only: measuring a build-up run at
// `gym` would report it missing from a squat session that never asks for it.
// Task 7 gives DAY_TYPES a `prep` key, at which point this can be derived
// rather than declared -- and plyometric's `venue: 'either'` revisited here.
const BLOCK_VENUES = { running: ['outdoor'] };

function poolKey(slot) {
  return [
    slot.tier.join('+'),
    (slot.patterns || []).join('/') || '(any)',
    slot.modality || '(any)',
    // Without these, a submaximal-strides slot and a maximal-sprint slot
    // share one key and the coverage numbers describe neither.
    slot.effortClass || null,
    slot.joints ? slot.joints.join('/') : null
  ].filter(Boolean).join(' :: ');
}

// `venue: 'either'` is a statement about the DAY, not about the exercise: a
// plyometric session runs indoors or out, so the generator drops the filter
// rather than applying it (js/generator.js:332). Passing 'either' straight
// through kept only exercises whose OWN venue was 'either', and measured the
// three jump pools at 8/12/5 when the app was drawing from 14/21/6. The app
// was never wrong; this file was. Fixed 2026-09-06,
// design-running-programming.md §11.0.
function poolSize(slot, venue, soreness = {}) {
  return eligibleFor(slot, LIB, {
    venue: venue === 'either' ? undefined : venue,
    soreness, banned: [], excludeIds: new Set()
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
    for (const [variant, groups] of Object.entries(block)) {
      for (const g of groups) {
        for (const venue of BLOCK_VENUES[variant] || ['gym', 'outdoor']) {
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
    // repetition, and so do the seven main-work pools named above, which are
    // the ones the rule's premise does not fit.
    const byRepetition = !r.fromTemplate || VARIETY_EXEMPT_POOLS.has(key);

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

test('the fifteen floor-exempt pools really are the ones that reach zero', () => {
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
    .map(p => p.key)
    .sort();
  assert.deepEqual(exempt, [...VARIETY_EXEMPT_POOLS].sort(),
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
    `- variety-exempt pools: ${[...VARIETY_EXEMPT_POOLS].join(', ')}` +
      ' -- pools where VARIETY’s premise fails, settled 2026-09-06;' +
      ' see design-running-programming.md §11.0',
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
