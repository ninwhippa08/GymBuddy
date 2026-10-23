// The sweeps that turn a counter complaint into a decision.
// design-library-expansion.md §31, §34, §36, §37.
//
//   node tools/measure.mjs reach              which entries no slot admits
//   node tools/measure.mjs daytypes           how often each day type comes up
//   node tools/measure.mjs repeats [pattern]  repeats per entry per 12-week block
//   node tools/measure.mjs gaps               realized repeat interval, per slot
//   node tools/measure.mjs ceiling            which load cap binds, and what it clips
//   node tools/measure.mjs veto [--without id]  48h veto rate, and bisection
//   node tools/measure.mjs ramp               what each ramp week delivers
//   node tools/measure.mjs compose [seeds]    what a lifting session is made of, by week
//   node tools/measure.mjs clock [seeds]      worst-case minutes on the four clocked days
//
// Prints and writes nothing else. Every number the design docs quote from a
// sweep came from one of these, and each was rebuilt from scratch more than
// once before it was worth keeping -- which is the same reason
// tools/playlist-diff.mjs exists.
//
// WHY THESE NINE. Each one answered a question that reasoning had got wrong:
//
//   reach     §25 -- 13 entries the app owned and could never prescribe.
//   daytypes  §31 -- no day type arrives more often than every 5.3 sessions,
//             which is what made a variety target look mis-scaled...
//   gaps      §34 -- ...and is what disproved it. Pool size stops governing the
//             repeat interval above ~16 entries, because selection is weighted
//             and not round-robin. The arithmetic in §31.3 was wrong and only
//             this sweep could say so.
//   repeats   §26, §28, §29 -- felt repetition, which is not pool size.
//   ceiling   §32 -- the standing cap binds 18.6% through the PRINTED number
//             and 1.6% through the own-max one. §24 argued about them as if
//             they were one cap.
//   veto      §37 -- bisecting which single entry moved a CNS ratchet.
//   ramp      2026-09-17 §7 -- the one that would have caught the flat spot
//             years earlier: per-BLOCK rounding made ramp weeks 1-3 identical
//             at a dose of 3, and no sweep looked at what a week delivered
//             against what it promised. Also the one that separates what the
//             ramp ASKED for from what the session's fill loop and the clock
//             let it DELIVER -- see the comment on `ramp()` below.
//
//   compose   2026-10-22 -- lifting days lost their clock (spec §1, §5), so
//             session size is now decided by weekly debt, session dose and
//             count caps alone. Nothing bounded it by construction any more,
//             and the ramp's promise ("week w delivers RAMP[w].volume of week
//             5") stopped being implied by a shared minute ceiling. This
//             sweep states both as measured numbers and gates the ramp (§4.4).
//   clock     2026-10-22 -- FLOOR_OVERRUN_ALLOWANCE_MIN was derived while
//             lifting days dominated the worst case. They no longer do, so the
//             four days that still have a clock are re-measured on their own.
//
// COST: the sweeps run thousands of sessions and take tens of seconds. That is
// the point. A number quoted in a design doc should cost something.

import { readFileSync } from 'node:fs';
import { generate, buildState, proposeDayType, countsTowardVolume } from '../js/generator.js';
import { TEMPLATES, PREP_BLOCK, COOLDOWN_BLOCK, PHASE_1_DAY_TYPES } from '../js/templates.js';
import { RAMP, TIME } from '../js/rules.js';

const LIB = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
).exercises;

const DAY = 86400e3;
const iso = t => new Date(t).toISOString().slice(0, 10);
// Long past the five-week ramp, so nothing here measures the ramp by accident.
const TRAINED = { returnDate: iso(Date.now() - 400 * DAY) };
const med = a => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : NaN; };

// --------------------------------------------------------------------------
// Slots
// --------------------------------------------------------------------------

// Every slot any template can present. A slot is anything carrying both a
// `slot` label and a selection filter; walking the exports finds the prep and
// cool-down variants too, which a hand-written list kept forgetting.
const SLOTS = [];
(function walk(node, path) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, path)); return; }
  if (node.slot && (node.tier || node.patterns)) SLOTS.push({ ...node, from: path });
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') walk(v, `${path}.${k}`);
  }
})({ TEMPLATES, PREP: PREP_BLOCK, COOLDOWN: COOLDOWN_BLOCK }, '');

// The entry-dependent half of generator.js's eligibleFor. Venue, soreness and
// equipment are per-session and would make these sweeps depend on a profile;
// everything below is a fact about the library and the templates.
function admits(slot, e) {
  if (slot.tier && !slot.tier.includes(e.tier)) return false;
  if (slot.patterns && !slot.patterns.includes(e.pattern)) return false;
  if (slot.modality && !(e.modalities || []).includes(slot.modality)) return false;
  if (slot.joints && !(e.joints || []).some(j => slot.joints.includes(j))) return false;
  if (slot.targets && !(e.targets || []).some(t => slot.targets.includes(t))) return false;
  if (slot.effortClass && e.effortClass !== slot.effortClass) return false;
  if (slot.plyoIntensity && !slot.plyoIntensity.includes(e.plyoIntensity)) return false;
  return true;
}

// --------------------------------------------------------------------------
// Simulation
// --------------------------------------------------------------------------

// One athlete's run, history fed forward, day type chosen by the app rather
// than forced. Forcing the day type is what made an earlier version of the
// repeats sweep useless: it measured a rotation nobody has.
function* run(blocks, sessions, lib = LIB, seed0 = 11) {
  for (let b = 0; b < blocks; b++) {
    let seed = b * 3301 + seed0;
    const history = [];
    const now = Date.now();
    for (let i = 0; i < sessions; i++) {
      const at = now - (sessions - i) * 3 * DAY;
      const s = generate({ library: lib, profile: TRAINED, history, soreness: {}, seed: seed++, now: at });
      yield { b, i, s };
      history.push({ date: iso(at), dayType: s.dayType, cnsLoad: s.cnsLoad,
                     patternSets: s.patternSets, blocks: s.blocks });
    }
  }
}

const isMain = b => b.role !== 'prep' && b.role !== 'mobility' && b.role !== 'core';

// --------------------------------------------------------------------------
// The six
// --------------------------------------------------------------------------

function reach() {
  const orphans = LIB.filter(e => !SLOTS.some(s => admits(s, e)));
  console.log(`${SLOTS.length} slots, ${LIB.length} entries\n`);
  console.log(`ADMITTED BY NOTHING (${orphans.length}):`);
  for (const e of orphans) {
    console.log(`  ${e.id.padEnd(32)} ${e.tier}/${e.pattern}/${(e.modalities || []).join('+')}`);
  }
  console.log('\nAn entry no slot admits is worse than no entry -- §25. Probe a new');
  console.log('entry HERE before authoring it, not after.');
}

function daytypes(blocks = 100, sessions = 36) {
  const count = {}; let total = 0;
  for (const { s } of run(blocks, sessions)) { count[s.dayType] = (count[s.dayType] || 0) + 1; total++; }
  console.log(`${total} sessions over ${blocks} blocks of ${sessions}\n`);
  console.log('day type          per block   share   sessions between two');
  for (const [k, v] of Object.entries(count).sort((a, b) => b[1] - a[1])) {
    const per = v / blocks;
    console.log(`${k.padEnd(17)} ${per.toFixed(2).padStart(9)} ${(100 * v / total).toFixed(1).padStart(6)}% ${(sessions / per).toFixed(1).padStart(21)}`);
  }
}

function repeats(patternFilter, blocks = 150, sessions = 36) {
  const tally = {}; const byId = Object.fromEntries(LIB.map(e => [e.id, e]));
  for (const { s } of run(blocks, sessions)) {
    for (const b of s.blocks || []) {
      const e = byId[b.exerciseId]; if (!e) continue;
      if (patternFilter && e.pattern !== patternFilter) continue;
      (tally[e.pattern] ||= {})[e.id] = ((tally[e.pattern] || {})[e.id] || 0) + 1;
    }
  }
  console.log(`${blocks} blocks x ${sessions} sessions. Repeats per DRAWN entry per block.\n`);
  for (const [pat, ids] of Object.entries(tally).sort()) {
    const draws = Object.values(ids).reduce((a, c) => a + c, 0);
    const n = Object.keys(ids).length;
    const pool = LIB.filter(e => e.pattern === pat).length;
    console.log(`${pat.padEnd(14)} ${String(pool).padStart(4)} entries, ${String(n).padStart(4)} drawn, ${(draws / blocks / n).toFixed(2).padStart(6)} repeats/entry/block`);
    if (patternFilter) {
      for (const [id, v] of Object.entries(ids).sort((a, b) => b[1] - a[1])) {
        console.log(`      ${id.padEnd(34)} ${(v / blocks).toFixed(2)}`);
      }
    }
  }
  console.log('\nPool SIZE is not pressure and this is not the variety counter -- §28, §29.');
}

function gaps(blocks = 120, sessions = 60) {
  const stat = {};
  let lastB = -1, last = {}, turns = {};
  for (const { b, i, s } of run(blocks, sessions)) {
    if (b !== lastB) { last = {}; turns = {}; lastB = b; }
    turns[s.dayType] = (turns[s.dayType] || 0) + 1;
    for (const blk of (s.blocks || []).filter(isMain)) {
      if (!blk.exerciseId || !blk.slot) continue;
      const pool = `${s.dayType}:${blk.slot}`;
      const st = (stat[pool] ||= { sess: [], turn: [], ids: new Set() });
      st.ids.add(blk.exerciseId);
      const key = `${pool}|${blk.exerciseId}`;
      if (last[key]) { st.sess.push(i - last[key].i); st.turn.push(turns[s.dayType] - last[key].t); }
      last[key] = { i, t: turns[s.dayType] };
    }
  }
  console.log('pool (day:slot)     drawn   median gap    median gap');
  console.log('                            in sessions    in turns\n');
  for (const [k, v] of Object.entries(stat).filter(([, v]) => v.sess.length > 50).sort()) {
    console.log(`${k.padEnd(20)} ${String(v.ids.size).padStart(5)} ${String(med(v.sess)).padStart(12)} ${String(med(v.turn)).padStart(13)}`);
  }
  console.log('\nMEASURE IN TURNS. Session gaps credit pool size with the day type\'s own');
  console.log('spacing -- the smallest pools sit on the most frequent days. In turns,');
  console.log('the interval saturates at 3 by ~16 entries and a pool of 49 buys nothing');
  console.log('a pool of 16 does not. §34, which disproved §31.3.');
}

function ceiling(seeds = 2000) {
  let load = 0, ladder = 0, pctCap = 0, dispCap = 0;
  const clipped = {};
  for (const dayType of ['max-strength', 'power', 'hypertrophy']) {
    for (let seed = 1; seed <= seeds; seed++) {
      const s = generate({ library: LIB, profile: TRAINED, history: [], soreness: {}, dayType, seed, now: Date.now() });
      for (const b of s.blocks || []) {
        if (b.displayMultiplier == null) continue;
        load++;
        if (b.architecture === 'ladder') ladder++;
        if (!b.ceilingLimited) continue;
        const coef = b.prCoef ?? 1;
        const would = b.pct * coef;
        if (coef > 1 && would > 0.95 + 1e-9) {
          dispCap++;
          const r = (clipped[b.exerciseId] ||= { n: 0, worst: 0, ref: b.prRef, coef });
          r.n++; r.worst = Math.max(r.worst, would);
        } else pctCap++;
      }
    }
  }
  console.log(`${load} load blocks past the ramp\n`);
  console.log(`ladder architecture       ${ladder} (${(100 * ladder / load).toFixed(1)}%)`);
  console.log(`bound by OWN-MAX cap      ${pctCap} (${(100 * pctCap / load).toFixed(1)}%)  <- the safety claim, near a no-op`);
  console.log(`bound by PRINTED cap      ${dispCap} (${(100 * dispCap / load).toFixed(1)}%)  <- against ANOTHER lift's PR\n`);
  for (const [id, r] of Object.entries(clipped).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${id.padEnd(24)} ${String(r.n).padStart(4)}x  ${r.coef} x ${String(r.ref).padEnd(15)} tops ${r.worst.toFixed(2)}, prints 0.95 -- ${(100 * (1 - 0.95 / r.worst)).toFixed(0)}% light`);
  }
  console.log('\nTwo caps, not one. §32. The athlete kept both on 2026-09-11.');
}

function veto(without, seeds = 60) {
  const lib = without ? LIB.filter(e => e.id !== without) : LIB;
  const HIGH = ['sprint', 'power', 'plyometric', 'max-strength'];
  const HOUR = 3600e3;
  const rate = (dayType, hours) => {
    let v = 0, t = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const mid = Date.parse('2030-01-01T00:00:00Z');
      const s = generate({ library: lib, dayType, seed, now: mid });
      const p = proposeDayType(buildState({}, [s], mid + hours * HOUR), {});
      for (const dt of HIGH) { const c = p.candidates.find(x => x.dayType === dt); t++; if (c && c.vetoed) v++; }
    }
    return 100 * v / t;
  };
  console.log(without ? `library MINUS ${without} (${lib.length} entries)\n` : `full library (${lib.length} entries)\n`);
  console.log('day type        1h      24h     48h     72h');
  for (const dt of HIGH) {
    console.log(`${dt.padEnd(15)} ${[1, 24, 48, 72].map(h => (rate(dt, h).toFixed(1) + '%').padStart(7)).join(' ')}`);
  }
  console.log('\nThe 48h figure is a POPULATION AVERAGE and moves with the library\'s');
  console.log('composition, so a fall is not automatically a regression -- one light');
  console.log('accessory is enough. BISECT with --without before believing it. §37.4.');
}

// ramp -- spec 2026-09-17 §7. The seventh, and the one that would have caught
// the flat spot years earlier: per-BLOCK rounding made ramp weeks 1-3
// identical at a dose of 3, and no sweep looked at what a week delivered
// against what it promised.
//
// THREE ratios, not one, because "vs full volume" alone flatters week 4 and
// buries week 1. `packToBudget`'s clock ceiling is fixed and never ramped --
// it trims week 5 far more often than any ramped week (task-3-report.md, 300
// seeds/cell: week 5 trimmed in 109-244/300, week 4 in 1-7/300), so week 5's
// OWN delivered total is itself cut down before anything divides by it.
// `session.rampSets = { drawn, budget, delivered }` (finalise(),
// generator.js) lets this sweep state the other two ratios exactly instead
// of inferring them:
//
//   budget/drawn      what the ramp ASKED for, per session -- tracks RAMP's
//                     own column almost exactly, because budget is just
//                     round(drawn x RAMP[week-1].volume).
//   delivered/drawn   what SURVIVED the clock ceiling and the ten-per-
//                     pattern cap, on top of that ask.
//   delivered/wk5     "share of full volume" -- the one the athlete feels on
//                     the card, and the clipped one, because week 5's own
//                     denominator is trimmed by that same fixed clock.
//
// `rampedMinutes` (the minute-based fill-loop cap) was REMOVED in v80 (spec
// §4.3-§4.4): lifting days no longer have a clock, so the ramp's promise is
// held by dose and count (`rampedSlots`, the session dose) and is checked per
// week by `compose`, not here. The "packToBudget trims week 5" reasoning
// above describes v79; on v80 lifting days `packToBudget` is not called, and
// `delivered/drawn` here reflects the ten-per-pattern cap and the ramp budget
// only. Task 3's old finding that removing a cap makes every day type
// overshoot (max-strength week 4 at 102%) was measured under v79 rules and is
// not evidence about v80.
function ramp(seeds = 3000) {
  const DAYS = ['max-strength', 'power', 'hypertrophy'];
  for (const dayType of DAYS) {
    // Every week is collected BEFORE anything is printed, because the
    // "vs full(wk5)" column divides by week 5 and computing it last would
    // divide by an empty cell.
    const rows = [1, 2, 3, 4, 5].map(week => {
      const profile = { returnDate: iso(Date.now() - ((week - 1) * 7 + 3) * DAY) };
      let drawn = 0, budget = 0, delivered = 0, blocks = 0, min = 0, worst = 0, floorForced = 0;
      const bySlot = {}, nSlot = {};
      for (let seed = 1; seed <= seeds; seed++) {
        const s = generate({ library: LIB, profile, history: [], soreness: {},
                             dayType, seed, now: Date.now() });
        const { drawn: d, budget: b, delivered: del } = s.rampSets;
        drawn += d; budget += b; delivered += del;
        // The signature of a floor-bound session: the block floors held the
        // total above what the budget asked for. rampSets makes this exact
        // (delivered > budget) instead of inferred from block counts.
        if (del > b) floorForced++;
        const work = s.blocks.filter(countsTowardVolume);
        blocks += work.length;
        min += s.durationMin;
        worst = Math.max(worst, s.durationMin);
        for (const blk of work) {
          bySlot[blk.slot] = (bySlot[blk.slot] || 0) + blk.sets;
          nSlot[blk.slot] = (nSlot[blk.slot] || 0) + 1;
        }
      }
      const slots = Object.keys(bySlot).sort()
        .map(k => `${k}:${(bySlot[k] / nSlot[k]).toFixed(1)}`).join(' ');
      return { week, drawn, budget, delivered, blocks, min, worst, floorForced, slots };
    });

    const wk5Delivered = rows[4].delivered;
    console.log(`\n=== ${dayType} (n=${seeds} per week) ===`);
    console.log('wk  RAMP   budget/drawn  delivered/drawn  vs full(wk5)  blocks  mean min  worst  floor-forced  sets by slot');
    for (const r of rows) {
      console.log(
        `${r.week}   ${(RAMP[r.week - 1].volume * 100).toFixed(0).padStart(3)}%  ` +
        `${(100 * r.budget / r.drawn).toFixed(1).padStart(11)}%  ` +
        `${(100 * r.delivered / r.drawn).toFixed(1).padStart(14)}%  ` +
        `${(100 * r.delivered / wk5Delivered).toFixed(1).padStart(11)}%  ` +
        `${(r.blocks / seeds).toFixed(2).padStart(6)}  ` +
        `${(r.min / seeds).toFixed(1).padStart(8)}  ` +
        `${String(r.worst).padStart(5)}  ` +
        `${(100 * r.floorForced / seeds).toFixed(1).padStart(11)}%  ${r.slots}`);
    }
  }
  console.log('\nThe three ratios differ because budget/drawn is what the ramp asked for,');
  console.log('delivered/drawn is what survived the clock ceiling and the ten-per-');
  console.log('pattern cap on top of that ask, and vs-full(wk5) additionally divides');
  console.log('by a week-5 total the SAME fixed clock has already cut down -- so');
  console.log('vs-full(wk5) is the one that flatters week 4 and buries week 1, not the');
  console.log('other two.');
  console.log('\nHYPERTROPHY WEEK 1: two mechanisms compound, not one. rampedSlots cuts');
  console.log('how many exercises a ramped session carries, THEN the session set budget');
  console.log('cuts the sets inside the exercises that survive. rampedMinutes, the');
  console.log('second fill-loop cap, was removed in v80 (spec §4.3-§4.4) along with the');
  console.log('lifting-day clock; `compose` is the sweep that gates the ramp now.');
}

// compose -- spec 2026-10-22 §4.4, §6. What a lifting session is made of, by
// ramp week, and the ramp gate. Profiles are built exactly as ramp() builds
// them. The gate: week w mean sets / week-5 mean sets must not exceed
// RAMP[w-1].volume. Percentages are ratios of MEANS, over the same seeds.
function compose(seeds = 300) {
  const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const p90 = a => { const x = [...a].sort((p, q) => p - q); return x[Math.min(x.length - 1, Math.floor(0.9 * x.length))]; };
  let anyOver = false;
  for (const dayType of LIFT_DAYS) {
    const rows = [1, 2, 3, 4, 5].map(week => {
      const profile = { returnDate: iso(Date.now() - ((week - 1) * 7 + 3) * DAY) };
      const ex = [], sets = [], dur = [], cns = [], perPat = {};
      for (let seed = 1; seed <= seeds; seed++) {
        const s = generate({ library: LIB, profile, history: [], soreness: {},
                             dayType, seed, now: Date.now() });
        const work = s.blocks.filter(countsTowardVolume);
        ex.push(work.length);
        sets.push(work.reduce((a, b) => a + b.sets, 0));
        dur.push(s.durationMin);
        cns.push(s.cnsLoad);
        for (const [p, n] of Object.entries(s.patternSets || {})) (perPat[p] ||= []).push(n);
      }
      // A pattern absent from a session contributes 0 to that session's mean.
      for (const p of Object.keys(perPat)) while (perPat[p].length < seeds) perPat[p].push(0);
      return { week, ex, sets, dur, cns, perPat };
    });
    const wk5 = mean(rows[4].sets);
    console.log(`\n=== ${dayType} (n=${seeds} per week) ===`);
    console.log('wk  exercises  sets   dur mean  p90  max   cns   RAMP   sets/wk5  gate');
    for (const r of rows) {
      const ratio = mean(r.sets) / wk5, cap = RAMP[r.week - 1].volume;
      const over = ratio > cap + 1e-9;
      if (over) anyOver = true;
      console.log(
        `${r.week}   ${mean(r.ex).toFixed(2).padStart(8)}  ${mean(r.sets).toFixed(2).padStart(5)}  ` +
        `${mean(r.dur).toFixed(1).padStart(8)}  ${String(p90(r.dur)).padStart(3)}  ${String(Math.max(...r.dur)).padStart(3)}  ` +
        `${mean(r.cns).toFixed(2).padStart(5)}  ${(cap * 100).toFixed(0).padStart(3)}%  ` +
        `${(100 * ratio).toFixed(1).padStart(7)}%  ${over ? 'OVER' : 'PASS'}`);
    }
    console.log('  sets per pattern (mean/max), weeks 1-5:');
    const pats = [...new Set(rows.flatMap(r => Object.keys(r.perPat)))].sort();
    for (const p of pats) {
      console.log('    ' + p.padEnd(14) + rows.map(r => {
        const a = r.perPat[p] || [0];
        return `${mean(a).toFixed(1)}/${Math.max(...a)}`.padStart(8);
      }).join(''));
    }
  }
  console.log(anyOver ? '\nRAMP GATE: OVER -- a ramp week delivers more than its column promises.'
                      : '\nRAMP GATE: PASS on every lifting day type and week.');
  console.log('\nSets = working sets on blocks passing countsTowardVolume (the line');
  console.log('patternSets and cnsLoad ride on). durationMin is the card\'s own number.');
}

// clock -- worst-case durationMin on the four days that still have a clock
// (aerobic-steady, interval, sprint, plyometric), full volume (no returnDate),
// seeds 1..N, same call shape as tests/session.test.mjs's duration sweep.
function clock(seeds = 3000) {
  const allowance = TIME.GYM_SESSION_TOTAL_MIN + TIME.FLOOR_OVERRUN_ALLOWANCE_MIN;
  console.log(`n=${seeds} per day type; ceiling = ${TIME.GYM_SESSION_TOTAL_MIN} + ${TIME.FLOOR_OVERRUN_ALLOWANCE_MIN} = ${allowance} min\n`);
  console.log('day type          mean   max   at seed  vs ceiling');
  for (const dayType of PHASE_1_DAY_TYPES.filter(d => !LIFT_DAYS.includes(d))) {
    let sum = 0, worst = -1, at = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const s = generate({ library: LIB, dayType, seed, now: 1e12 });
      sum += s.durationMin;
      if (s.durationMin > worst) { worst = s.durationMin; at = seed; }
    }
    const d = worst - allowance;
    console.log(`${dayType.padEnd(16)} ${(sum / seeds).toFixed(1).padStart(5)} ${String(worst).padStart(5)} ${String(at).padStart(9)}  ${d <= 0 ? 'within' : 'OVER'} (${d >= 0 ? '+' : ''}${d})`);
  }
}
const LIFT_DAYS = ['max-strength', 'power', 'hypertrophy'];

// --------------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
const argOf = f => { const i = rest.indexOf(f); return i === -1 ? null : rest[i + 1]; };
const CMDS = { reach, daytypes, gaps, ceiling,
               repeats: () => repeats(rest.find(a => !a.startsWith('--'))),
               veto: () => veto(argOf('--without')),
               ramp: () => ramp(rest[0] ? Number(rest[0]) : undefined),
               compose: () => compose(rest[0] ? Number(rest[0]) : undefined),
               clock: () => clock(rest[0] ? Number(rest[0]) : undefined) };

if (!CMDS[cmd]) {
  console.error('usage: measure.mjs <reach|daytypes|repeats|gaps|ceiling|veto|ramp|compose|clock>');
  console.error('  repeats [pattern]     e.g. repeats sprint');
  console.error('  veto [--without id]   bisect which entry moved a CNS ratchet');
  console.error('  ramp [seeds]          default 3000/cell; pass a small number to smoke-test');
  console.error('  compose [seeds]       default 300/cell; lifting-day makeup by week + the ramp gate');
  console.error('  clock [seeds]         default 3000/day type; worst-case minutes on clocked days');
  process.exit(2);
}
CMDS[cmd]();
