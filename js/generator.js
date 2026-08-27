// generator.js -- the session pipeline from spec §4.
//
// Pure by construction: the exercise library, the profile, and the history all
// arrive as arguments. Nothing here reads localStorage or the DOM, so a session
// can be generated and inspected without a browser.
//
// Pipeline, in order:
//   1  LOAD       profile + recent history
//   2  STATE      rolling pattern volume, hours since each day type,
//                 decayed CNS account, ramp week
//   3  PROPOSE    score day types by neglect, veto on CNS and soreness
//   4  ENVELOPE   day type -> zone, clamped by the ramp ceiling
//   5  ARCHITECT  pick a session architecture
//   6  FILL       choose an exercise per slot
//   7  PRESCRIBE  sets/reps/percentage, or contacts, or time
//   8  PACK       estimate duration, trim to the main-work budget
//   9  PREP/COOL  dynamic prep and static cool-down + core, always appended
//  10  ORDER      enforce the fixed sequence -- prep first, cool-down last

import {
  ZONES, PCT_JITTER, VOLUME, RAMP, CNS_DECAY, CNS_VETO_THRESHOLD,
  HIGH_CNS_DAY_TYPES, PLYO_CONTACTS_PER_SESSION, PLYO_TRANSITION_WEEKLY_CAP,
  PLYO_TRANSITION_LAST_WEEK, PLYO_RECOVERY_HOURS, SPRINT, SESSION_ORDER, TIME
} from './rules.js';

import {
  DAY_TYPES, PHASE_1_DAY_TYPES, TEMPLATES, PREP_BLOCK, COOLDOWN_BLOCK,
  ARCHITECTURES, PHASE_1_ARCHITECTURE
} from './templates.js';

const MS_PER_HOUR = 3600e3;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// --------------------------------------------------------------------------
// Randomness
// --------------------------------------------------------------------------

// Seeded so a session is reproducible: same seed, same workout. That makes the
// generator testable, and means a reroll is a new seed rather than hidden state.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, [lo, hi]) => lo + rng() * (hi - lo);
const intBetween = (rng, [lo, hi]) => Math.floor(lo + rng() * (hi - lo + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Weighted pick. Weights need not sum to 1.
function weightedPick(rng, items, weightOf) {
  const weights = items.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(rng, items);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// --------------------------------------------------------------------------
// 1-2  LOAD and STATE
// --------------------------------------------------------------------------

export function buildState(profile, history, now = Date.now()) {
  const recent = (history || []).filter(
    s => now - Date.parse(s.date) <= VOLUME.HISTORY_DAYS * MS_PER_DAY
  );

  // Rolling 7-day set count per pattern. Never count days -- an irregular week
  // must not confuse the model. basis §2 rule 1.
  const patternSets = {};
  for (const s of recent) {
    if (now - Date.parse(s.date) > VOLUME.ROLLING_WINDOW_DAYS * MS_PER_DAY) continue;
    for (const [pattern, n] of Object.entries(s.patternSets || {})) {
      patternSets[pattern] = (patternSets[pattern] || 0) + n;
    }
  }

  // Hours since the most recent session of each day type. Infinity means never.
  const hoursSince = {};
  for (const dt of Object.keys(DAY_TYPES)) hoursSince[dt] = Infinity;
  for (const s of recent) {
    const h = (now - Date.parse(s.date)) / MS_PER_HOUR;
    if (s.dayType && h < (hoursSince[s.dayType] ?? Infinity)) hoursSince[s.dayType] = h;
  }

  // Decayed CNS account. basis §7.
  let cnsAccount = 0;
  for (const s of recent) {
    const h = (now - Date.parse(s.date)) / MS_PER_HOUR;
    const bucket = CNS_DECAY.find(b => h < b.withinHours);
    cnsAccount += (s.cnsLoad || 0) * (bucket ? bucket.retained : 0);
  }

  // Foot contacts and sprint metres inside the rolling week, for the budgets
  // in basis §4 and §5.
  let weekContacts = 0;
  let weekMeters = 0;
  for (const s of recent) {
    if (now - Date.parse(s.date) > VOLUME.ROLLING_WINDOW_DAYS * MS_PER_DAY) continue;
    weekContacts += s.footContacts || 0;
    weekMeters += s.sprintMeters || 0;
  }

  return {
    now,
    recent,
    patternSets,
    hoursSince,
    cnsAccount: Math.round(cnsAccount * 100) / 100,
    weekContacts,
    weekMeters,
    rampWeek: rampWeekFor(profile, now),
    recentExerciseIds: new Set(
      recent.flatMap(s => (s.blocks || []).map(b => b.exerciseId))
    )
  };
}

export function rampWeekFor(profile, now = Date.now()) {
  if (!profile || !profile.returnDate) return RAMP.length; // no ramp declared
  const days = (now - Date.parse(profile.returnDate)) / MS_PER_DAY;
  if (days < 0) return 1;
  return clamp(Math.floor(days / 7) + 1, 1, RAMP.length);
}

export function rampRow(rampWeek) {
  return RAMP[clamp(rampWeek, 1, RAMP.length) - 1];
}

// --------------------------------------------------------------------------
// 3  PROPOSE
// --------------------------------------------------------------------------

// Neglect scoring with vetoes. Returns the proposal plus every candidate's
// standing, so the UI can offer a reroll without regenerating state.
export function proposeDayType(state, { soreness = {}, rng, dayTypes = PHASE_1_DAY_TYPES } = {}) {
  const ramp = rampRow(state.rampWeek);
  const candidates = dayTypes.map(dt => {
    const hours = state.hoursSince[dt];
    const days = hours === Infinity ? 99 : hours / 24;
    let score = Math.min(days, 21);
    const vetoes = [];

    if (HIGH_CNS_DAY_TYPES.includes(dt) && state.cnsAccount > CNS_VETO_THRESHOLD) {
      vetoes.push(`CNS account at ${state.cnsAccount} (threshold ${CNS_VETO_THRESHOLD})`);
    }
    if (dt === 'plyometric' && state.hoursSince.plyometric < PLYO_RECOVERY_HOURS) {
      vetoes.push(`plyometrics ${Math.round(state.hoursSince.plyometric)} h ago`);
    }
    if (dt === 'sprint' && state.hoursSince.sprint < SPRINT.RECOVERY_HOURS) {
      vetoes.push(`sprinting ${Math.round(state.hoursSince.sprint)} h ago`);
    }
    // A gym day whose main patterns are all hurt is not worth proposing.
    if (DAY_TYPES[dt] && DAY_TYPES[dt].venue === 'gym' && allHurt(soreness)) {
      vetoes.push('too much is hurt for a lifting day');
    }
    // Isolation is always selectable, rarely proposed. basis §2 rule 3.
    if (dt === 'isolation') score *= (1 - VOLUME.ISOLATION_PROPOSAL_PENALTY);

    return { dayType: dt, score, days, vetoed: vetoes.length > 0, vetoes };
  });

  const open = candidates.filter(c => !c.vetoed);
  const pool = open.length ? open : candidates; // never return nothing
  const best = pool.reduce((a, b) => (b.score > a.score ? b : a));

  return {
    dayType: best.dayType,
    reason: reasonFor(best, state, ramp, open.length === 0),
    candidates: candidates.sort((a, b) => b.score - a.score)
  };
}

function allHurt(soreness) {
  const hurt = Object.values(soreness || {}).filter(v => v === 'hurt').length;
  return hurt >= 4;
}

function reasonFor(best, state, ramp, forced) {
  const label = {
    'max-strength': 'heavy lifting', power: 'anything explosive',
    hypertrophy: 'volume work', 'aerobic-steady': 'easy running'
  }[best.dayType] || best.dayType;

  const parts = [];
  if (best.days >= 99) parts.push(`no ${label} on record yet`);
  else parts.push(`nothing like ${label} in ${Math.round(best.days)} days`);

  if (state.rampWeek < RAMP.length) {
    parts.push(`week ${state.rampWeek} back, capped at ${Math.round(ramp.pctCeiling * 100)}%`);
  }
  if (forced) parts.push('everything else is vetoed today, so this is the safe option');

  return parts.join(' -- ');
}

// --------------------------------------------------------------------------
// 4  ENVELOPE
// --------------------------------------------------------------------------

export function envelopeFor(dayType, state) {
  const ramp = rampRow(state.rampWeek);
  return {
    dayType,
    rampWeek: state.rampWeek,
    pctCeiling: ramp.pctCeiling,
    volumeMultiplier: ramp.volume,
    venue: DAY_TYPES[dayType] ? DAY_TYPES[dayType].venue : 'gym'
  };
}

// --------------------------------------------------------------------------
// 5  ARCHITECT
// --------------------------------------------------------------------------

export function chooseArchitecture(dayType, rng, { phase1 = true } = {}) {
  const allowed = ARCHITECTURES[dayType] || [PHASE_1_ARCHITECTURE];
  return phase1 ? PHASE_1_ARCHITECTURE : pick(rng, allowed);
}

// --------------------------------------------------------------------------
// 6  FILL
// --------------------------------------------------------------------------

// 'hurt' excludes without exception; 'sore' downweights but can still be
// selected if nothing else fits. spec §4.1.
export function eligibleFor(slot, library, ctx) {
  const { soreness = {}, banned = [], venue, excludeIds = new Set() } = ctx;
  return library.filter(e => {
    if (excludeIds.has(e.id)) return false;
    if (banned.includes(e.id)) return false;
    if (!slot.tier.includes(e.tier)) return false;
    if (slot.patterns && !slot.patterns.includes(e.pattern)) return false;
    if (slot.modality && !e.modalities.includes(slot.modality)) return false;
    // A prep slot names the joints it prepares. Every dynamic drill shares
    // pattern 'mobility', so pattern alone cannot keep a shoulder dislocate
    // out of a running warm-up. design-running-programming.md §5.3.
    if (slot.joints && !(e.joints || []).some(j => slot.joints.includes(j))) {
      return false;
    }
    // The one field standing between a warm-up build-up and a maximal sprint.
    // Tier and pattern cannot separate them: resisted-sprint and
    // three-point-start are secondary-tier sprints too.
    // design-running-programming.md §5, §6.1.
    if (slot.effortClass && e.effortClass !== slot.effortClass) return false;
    if (venue && e.venue !== 'either' && e.venue !== venue) return false;
    if (e.requiresMeasuredGround) return false; // opt-in only, spec 9.1
    if ((e.joints || []).some(j => soreness[j] === 'hurt')) return false;
    return true;
  });
}

export function fillSlot(slot, library, ctx, rng) {
  const pool = eligibleFor(slot, library, ctx);
  if (pool.length === 0) return null;

  const { soreness = {}, state } = ctx;
  return weightedPick(rng, pool, e => {
    let w = 1;
    // Penalise anything used in the last 14 days. spec §4 step 6.
    if (state && state.recentExerciseIds.has(e.id)) w *= 0.25;
    // Sore joints are a downweight, not a ban.
    if ((e.joints || []).some(j => soreness[j] === 'sore')) w *= 0.2;
    // Favour neglected patterns using the rolling 7-day counts.
    if (state) {
      const used = state.patternSets[e.pattern] || 0;
      w *= 1 / (1 + used / VOLUME.SETS_PER_PATTERN_PER_WEEK_TARGET);
    }
    return w;
  });
}

// --------------------------------------------------------------------------
// 7  PRESCRIBE
// --------------------------------------------------------------------------

export function prescribe(slot, exercise, env, rng, state) {
  const block = {
    slot: slot.slot,
    role: slot.role,
    exerciseId: exercise.id,
    name: exercise.name,
    pattern: exercise.pattern,
    mode: slot.mode,
    optional: !!slot.optional,
    cnsCost: exercise.cnsCost
  };

  if (slot.mode === 'time') {
    const lo = slot.durationMin ? slot.durationMin[0] : 10;
    const hi = slot.durationMin ? slot.durationMin[1] : 20;
    block.durationMin = Math.round(between(rng, [lo, hi]) * env.volumeMultiplier);
    block.effort = slot.effort || 'steady';
    block.sets = 1;
    block.reps = 1;
    block.restSec = 0;
    return block;
  }

  let sets = intBetween(rng, slot.sets);
  const reps = intBetween(rng, slot.reps);

  // Ramp trims volume before anything else touches it. basis §3.
  sets = Math.max(1, Math.round(sets * env.volumeMultiplier));

  block.sets = sets;
  block.reps = reps;

  // An interval derives its rest from its own work, so it must come before the
  // restSec line below -- an interval slot names a ratio, not a rest range.
  if (slot.mode === 'interval') {
    const workSec = Math.round(between(rng, slot.workSec) / 5) * 5;
    block.workSec = workSec;
    // Work:rest, not a fixed rest. A 90 s effort and a 30 s effort do not
    // recover in the same time. INTERVAL_REST_RATIO 1-2x, [corroborated];
    // mirrors the SPRINT.WORK_REST_RATIO house style at js/rules.js:177.
    block.restSec = Math.round(workSec * between(rng, slot.restRatio) / 5) * 5;
    block.reps = 1;
    block.effort = slot.effort || 'hard, but repeatable to the last rep';
    return block;
  }

  block.restSec = Math.round(between(rng, slot.restSec) / 15) * 15;

  if (slot.mode === 'contacts') {
    // Default 0, not 1. Every plyometric exercise in the library carries an
    // explicit contactsPerRep, so a missing value means the movement has no
    // ground contact to count -- a med ball slam or throw. Defaulting to 1
    // would spend the foot-contact budget on work that never lands.
    const per = exercise.contactsPerRep == null ? 0 : exercise.contactsPerRep;
    block.footContacts = per * sets * reps;
    if (exercise.nominalMeters) block.sprintMeters = exercise.nominalMeters * sets * reps;
    block.effort = slot.effort || 'maximal intent, full recovery between sets';
    return block;
  }

  // mode === 'load'
  if (!exercise.loadable) {
    // No percentage is meaningful here -- bodyweight, machine, or dumbbell work
    // the app has no reference max for. Prescribe by reps and effort instead.
    block.mode = 'reps';
    block.effort = 'leave 2-3 reps in reserve';
    return block;
  }

  const zone = ZONES[slot.zone] || ZONES.hypertrophy;
  let pct = between(rng, zone.pct);
  pct += (rng() - 0.5) * 2 * PCT_JITTER;
  pct = clamp(pct, zone.pct[0] - PCT_JITTER, zone.pct[1] + PCT_JITTER);

  // The ramp ceiling is applied TWICE, and deliberately.
  //
  // First against the fraction of this movement's own max, which is what
  // "65% of what you can do on this lift" means physiologically.
  const capped = Math.min(pct, env.pctCeiling);
  let rampLimited = capped < pct - 1e-9;
  pct = capped;

  // Then against the number the user actually reads. A snatch pull has
  // prCoef 1.15, so 65% of its own max displays as 0.75 x snatch PR -- above
  // the ceiling the app just told him it was enforcing. For a returning
  // athlete reading one number at the gym door, a ceiling that the printed
  // figure exceeds is not a ceiling. The ramp is the one feature that should
  // err conservative, so the displayed multiplier is bounded too. basis §3.
  let display = pct * exercise.prCoef;
  if (display > env.pctCeiling) {
    display = env.pctCeiling;
    rampLimited = true;
  }

  block.rampLimited = rampLimited;
  block.pct = Math.round(pct * 100) / 100;
  block.prRef = exercise.prRef;
  block.prCoef = exercise.prCoef;
  // What the user actually reads: one multiplication against a PR he knows.
  // Folding prCoef in here is the whole point -- he should never do two.
  block.displayMultiplier = Math.round(display * 100) / 100;
  return block;
}

// --------------------------------------------------------------------------
// 8  PACK
// --------------------------------------------------------------------------

// Mobility work has no plates to change and no bar to load. Charging it the
// barbell transition put the 3 min prep block at 8 min.
const LIGHT_TRANSITION_ROLES = new Set(['prep', 'mobility', 'core']);
const transitionSec = b =>
  LIGHT_TRANSITION_ROLES.has(b.role)
    ? TIME.MOBILITY_TRANSITION_SEC
    : TIME.TRANSITION_SEC_PER_EXERCISE;

export function estimateMinutes(blocks) {
  let sec = 0;
  for (const b of blocks) {
    if (b.mode === 'time') { sec += (b.durationMin || 0) * 60; continue; }

    const sides = b.perSide ? 2 : 1;

    if (b.mode === 'drill') {
      sec += b.sets * b.reps * TIME.SECONDS_PER_REP * sides;
      sec += transitionSec(b);
      continue;
    }
    if (b.mode === 'hold') {
      sec += b.sets * b.holdSec * sides;
      sec += b.sets * (b.restSec || 0);
      sec += transitionSec(b);
      continue;
    }

    sec += b.sets * b.reps * TIME.SECONDS_PER_REP * sides;
    sec += b.sets * (b.restSec || TIME.DEFAULT_REST_SEC);
    sec += transitionSec(b);
  }
  return Math.round(sec / 60);
}

// Which blocks count as training volume. Mobility and core were excluded
// before the split too -- they were all mode 'time', which scored zero sets.
// Keeping them out is parity, not a new decision: the neglect model and the
// rolling pattern counts read these numbers, and design 4.4 is about to make
// the exercise count read them as well.
const VOLUME_MODES = new Set(['load', 'contacts', 'reps']);
export function countsTowardVolume(block) {
  if (!VOLUME_MODES.has(block.mode)) return false;
  return block.role !== 'core';
}

// Trim to the main-work budget: drop optional blocks last-first, then shave
// sets off the highest-volume block. Never drops a required block -- if the
// budget still cannot be met, the session is returned over budget and flagged,
// because silently gutting the main lift would be worse than a long session.
export function packToBudget(blocks, budgetMin = TIME.MAIN_WORK_MAX_MIN) {
  let out = blocks.slice();
  let trimmed = [];

  for (let i = out.length - 1; i >= 0 && estimateMinutes(out) > budgetMin; i--) {
    if (out[i].optional) { trimmed.push(out[i].slot); out.splice(i, 1); }
  }

  let guard = 0;
  while (estimateMinutes(out) > budgetMin && guard++ < 50) {
    const target = out
      .filter(b => b.mode !== 'time' && b.sets > 1)
      .sort((a, b) => b.sets * b.reps - a.sets * a.reps)[0];
    if (!target) break;
    target.sets -= 1;
  }

  return { blocks: out, trimmedSlots: trimmed, overBudget: estimateMinutes(out) > budgetMin };
}

// --------------------------------------------------------------------------
// 9  PREP and COOL-DOWN -- never randomised out
// --------------------------------------------------------------------------

// One block became two, because one block could not be in two places. Dynamic
// drills prepare the work and run before it; static stretching impairs
// explosive output and runs after. design 4.2, discrepancy 6.

export function buildPrep(dayType, library, ctx, rng) {
  return buildBlockGroups(groupsFor(PREP_BLOCK, dayType), library, ctx, rng);
}

export function buildCooldown(dayType, library, ctx, rng) {
  return buildBlockGroups(groupsFor(COOLDOWN_BLOCK, dayType), library, ctx, rng);
}

function groupsFor(block, dayType) {
  const kind = DAY_TYPES[dayType] ? DAY_TYPES[dayType].mobilityCore : 'full';
  return block[kind] || block.full;
}

// How many static stretches this day type's cool-down actually asks for at
// minimum. Read off the block rather than hardcoded: COOLDOWN_BLOCK.short
// asks for [2, 3], so two stretches there is the block SATISFIED, not a thin
// pool. Judging it against full's floor of 3 warned 49% of aerobic-steady
// sessions about a shortfall that never happened. T10 finding.
function staticFloorFor(dayType) {
  const group = groupsFor(COOLDOWN_BLOCK, dayType).find(g => g.role === 'mobility');
  return group ? group.count[0] : 0;
}

// Mutates ctx.excludeIds on purpose: prep, main work and cool-down draw from
// one library, and a movement should appear once in a session.
function buildBlockGroups(groups, library, ctx, rng) {
  const out = [];
  for (const group of groups) {
    const n = intBetween(rng, group.count);
    for (let i = 0; i < n; i++) {
      const e = fillSlot(group, library, ctx, rng);
      if (!e) break;                       // pool exhausted -- short block
      ctx.excludeIds.add(e.id);
      out.push(prescribeMobility(group, e, rng));
    }
  }
  return out;
}

const roundTo5 = v => Math.round(v / 5) * 5;

// Dosing follows from the tag, which is the point of the 4.1 split. Nothing
// here divides a budget by a movement count -- that arithmetic was the bug.
function prescribeMobility(group, e, rng) {
  const base = {
    slot: group.slot,
    role: group.role,
    exerciseId: e.id,
    name: e.name,
    pattern: e.pattern,
    perSide: !!e.unilateral,
    cnsCost: e.cnsCost,
    optional: false
  };

  if (group.mode === 'drill') {
    return {
      ...base, mode: 'drill',
      sets: 1, reps: intBetween(rng, group.reps),
      restSec: 0, effort: group.effort
    };
  }

  if (group.mode === 'hold') {
    return {
      ...base, mode: 'hold',
      sets: intBetween(rng, group.sets),
      holdSec: roundTo5(between(rng, group.holdSec)),
      reps: 1, restSec: 0, effort: group.effort
    };
  }

  // group.mode === 'core' -- resolved per exercise: a plank by time, an ab
  // wheel by reps. design 2.1.
  if (e.isometric) {
    return {
      ...base, mode: 'hold',
      sets: intBetween(rng, group.sets),
      holdSec: roundTo5(between(rng, group.holdSec)),
      reps: 1,
      restSec: intBetween(rng, group.restSec),
      effort: 'brace hard -- keep breathing'
    };
  }
  return {
    ...base, mode: 'reps',
    sets: intBetween(rng, group.sets),
    reps: intBetween(rng, group.reps),
    restSec: intBetween(rng, group.restSec),
    effort: 'leave 2-3 reps in reserve'
  };
}

// Hold the cool-down to its budget so the 60 min session total is a fact
// rather than an aspiration. Trims in order of how well sourced the number is:
// core sets are [unverified] (design 8, q4) so they go first; the ACSM hold
// dose is never shortened, and the stretch count never falls below three.
export function packCooldown(blocks, budgetMin = TIME.COOLDOWN_MIN) {
  const out = blocks.slice();
  let guard = 0;

  while (estimateMinutes(out) > budgetMin && guard++ < 20) {
    const core = out
      .filter(b => b.role === 'core' && b.sets > 2)
      .sort((a, b) => b.sets - a.sets)[0];
    if (core) { core.sets -= 1; continue; }

    const statics = out.filter(b => b.role === 'mobility');
    if (statics.length > 3) {
      out.splice(out.indexOf(statics[statics.length - 1]), 1);
      continue;
    }
    break;                                  // nothing left that may be trimmed
  }

  return { blocks: out, overBudget: estimateMinutes(out) > budgetMin };
}

// Ruling A2: the design-5 prep estimate (3 min) assumed bilateral drills, but
// 5 of the 12 mobility-dynamic movements are unilateral and the `sides`
// multiplier in estimateMinutes doubles their cost -- so a session that draws
// several per-side drills can run well past that estimate. Mirrors
// packCooldown's shape and its one lever: this trims drill COUNT, never the
// sourced 10-12 rep dose, and never below the sourced 3-drill floor.
export function packPrep(blocks, budgetMin = TIME.PREP_MIN) {
  const out = blocks.slice();
  let guard = 0;

  while (estimateMinutes(out) > budgetMin && out.length > 3 && guard++ < 20) {
    out.pop();
  }

  return { blocks: out, overBudget: estimateMinutes(out) > budgetMin };
}

// --------------------------------------------------------------------------
// 10  ORDER
// --------------------------------------------------------------------------

// Map a block to its position in the fixed sequence. Dynamic prep opens,
// lifting precedes conditioning, static mobility and core close.
// basis 6, 8; design 4.2.
function orderClass(block, slotZone) {
  // Role first: a prep drill and a cool-down stretch share pattern 'mobility'
  // and are told apart by role alone. Lumping them was discrepancy 6.
  if (block.role === 'prep') return 'prep';
  if (block.role === 'mobility' || block.role === 'core') return 'mobility';
  // A rotate or core movement that landed in a main-work accessory slot still
  // closes the session.
  if (block.pattern === 'core' || block.pattern === 'rotate') return 'mobility';
  if (block.pattern === 'sprint') return 'sprint';
  if (block.pattern === 'jump' || block.pattern === 'throw') return 'plyometric';
  // run, erg and march are all conditioning: they close the main work.
  // sprint-drill and agility never reach here -- the role === 'prep' branch
  // above catches them. design-running-programming.md §6.5.
  if (block.pattern === 'run' || block.pattern === 'erg' ||
      block.pattern === 'march') return 'conditioning';
  if (slotZone === 'powerSingle' || slotZone === 'powerMultiple' || slotZone === 'dynamicEffort') return 'power';
  if (slotZone === 'maxStrength') return 'max-strength';
  if (slotZone === 'muscularEndurance') return 'isolation';
  return 'hypertrophy';
}

export function orderSession(blocks, zoneBySlot = {}) {
  return blocks
    .map((b, i) => ({ b, i, k: SESSION_ORDER.indexOf(orderClass(b, zoneBySlot[b.slot])) }))
    .sort((x, y) => (x.k - y.k) || (x.i - y.i))
    .map(x => x.b);
}

// --------------------------------------------------------------------------
// The pipeline
// --------------------------------------------------------------------------

export function generate({
  library,
  profile = {},
  history = [],
  soreness = {},
  dayType = null,
  seed = Date.now(),
  now = Date.now()
} = {}) {
  if (!Array.isArray(library) || library.length === 0) {
    throw new Error('generate: library is required');
  }
  const rng = makeRng(seed);

  const state = buildState(profile, history, now);                       // 1-2
  const proposal = dayType
    ? { dayType, reason: 'chosen directly', candidates: [] }
    : proposeDayType(state, { soreness, rng });                          // 3
  const chosen = proposal.dayType;

  const env = envelopeFor(chosen, state);                                // 4
  const architecture = chooseArchitecture(chosen, rng);                  // 5

  const template = TEMPLATES[chosen];
  if (!template) throw new Error(`generate: no template for day type "${chosen}"`);

  const ctx = {
    soreness,
    banned: profile.banned || [],
    venue: env.venue,
    state,
    excludeIds: new Set()
  };

  const blocks = [];
  const zoneBySlot = {};
  const unfilled = [];
  for (const slot of template) {                                         // 6-7
    const exercise = fillSlot(slot, library, ctx, rng);
    if (!exercise) { unfilled.push(slot.slot); continue; }
    ctx.excludeIds.add(exercise.id);
    zoneBySlot[slot.slot] = slot.zone;
    blocks.push(prescribe(slot, exercise, env, rng, state));
  }

  const packed = packToBudget(blocks);                                   // 8
  const prep = buildPrep(chosen, library, ctx, rng);                     // 9a
  const cooled = packCooldown(
    buildCooldown(chosen, library, ctx, rng)                             // 9b
  );
  const ordered = orderSession(
    prep.concat(packed.blocks, cooled.blocks), zoneBySlot                // 10
  );

  return finalise({
    chosen, env, architecture, proposal, ordered, packed, cooled,
    unfilled, state, seed, now
  });
}

// Denormalise the counters at write time so the next generation never has to
// recompute them while reading history. spec §3.2.
function finalise({ chosen, env, architecture, proposal, ordered, packed, cooled, unfilled, state, seed, now }) {
  const patternSets = {};
  let footContacts = 0, sprintMeters = 0, cnsLoad = 0;
  for (const b of ordered) {
    if (countsTowardVolume(b)) {
      patternSets[b.pattern] = (patternSets[b.pattern] || 0) + b.sets;
    }
    footContacts += b.footContacts || 0;
    sprintMeters += b.sprintMeters || 0;
    cnsLoad += b.cnsCost || 0;
  }

  const warnings = [];
  if (packed.overBudget) warnings.push('over the 45 min main-work budget after trimming');
  if (cooled.overBudget) warnings.push('cool-down over its 12 min budget');
  if (unfilled.length) warnings.push(`no eligible exercise for slot ${unfilled.join(', ')}`);
  // Deviation 4: the static pool is thin, and a sore joint thins it further.
  // A short cool-down is acceptable; a silent one is not.
  const statics = ordered.filter(b => b.role === 'mobility').length;
  if (statics > 0 && statics < staticFloorFor(chosen)) {
    warnings.push(`only ${statics} static stretches available today`);
  }

  // Foot-contact budget: the transition cap wins during the ramp, as a weekly
  // budget rather than a per-session one. basis §4 discrepancy 3.
  const weeklyCap = PLYO_TRANSITION_WEEKLY_CAP[state.rampWeek];
  if (state.rampWeek <= PLYO_TRANSITION_LAST_WEEK && weeklyCap != null) {
    const projected = state.weekContacts + footContacts;
    if (projected > weeklyCap) {
      warnings.push(
        `foot contacts ${projected} would exceed the week ${state.rampWeek} cap of ${weeklyCap}`
      );
    }
  } else {
    const band = PLYO_CONTACTS_PER_SESSION.beginner;
    if (footContacts > band[1]) {
      warnings.push(`foot contacts ${footContacts} above the beginner band max of ${band[1]}`);
    }
  }

  if (sprintMeters > SPRINT.METERS_PER_SESSION[1]) {
    warnings.push(`sprint volume ${sprintMeters} m above the ${SPRINT.METERS_PER_SESSION[1]} m session budget`);
  }

  return {
    date: new Date(now).toISOString().slice(0, 10),
    dayType: chosen,
    venue: env.venue,
    architecture,
    rampWeek: state.rampWeek,
    pctCeiling: env.pctCeiling,
    reason: proposal.reason,
    candidates: proposal.candidates,
    soreness: [],
    blocks: ordered,
    patternSets,
    footContacts,
    sprintMeters,
    cnsLoad,
    durationMin: estimateMinutes(ordered),
    trimmedSlots: packed.trimmedSlots,
    warnings,
    seed
  };
}
