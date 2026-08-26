// The load coefficients are the numbers that decide how much weight goes on
// the bar. design-library-expansion.md §8 requires each to carry provenance;
// this file is what makes that rule real instead of aspirational.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COEF_PROVENANCE, UNVERIFIED_BUDGET } from './coef-provenance.mjs';
import { prescribe, makeRng } from '../js/generator.js';

const DATA = JSON.parse(
  readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8')
);
const LIB = DATA.exercises;
const VALID_TAGS = new Set(['verified', 'corroborated', 'measured', 'unverified']);

// A coefficient CLAIM is any loadable entry priced off a lift other than
// itself. A PR root priced off itself at 1.00 is definitional, not a claim.
const claims = LIB.filter(e => e.loadable === true && e.prCoef != null && e.id !== e.prRef);

test('every load coefficient in the library has a provenance record', () => {
  const missing = claims.map(e => e.id).filter(id => !(id in COEF_PROVENANCE));
  assert.deepEqual(missing, [],
    'a loadable movement was added without registering its coefficient: ' + missing.join(', '));
});

test('the register describes nothing that is not in the library', () => {
  const ids = new Set(LIB.map(e => e.id));
  const stale = Object.keys(COEF_PROVENANCE).filter(id => !ids.has(id));
  assert.deepEqual(stale, [], 'register names entries that no longer exist: ' + stale.join(', '));
});

// The register is a second copy of each number, so it can drift from the data
// it describes. That drift is the whole risk of a sidecar, so it is asserted
// rather than trusted.
test('the register agrees with the library, coefficient and reference alike', () => {
  for (const e of claims) {
    const rec = COEF_PROVENANCE[e.id];
    if (!rec) continue;                       // reported by the test above
    assert.equal(rec.coef, e.prCoef, `${e.id}: register says ${rec.coef}, library says ${e.prCoef}`);
    assert.equal(rec.of, e.prRef, `${e.id}: register prices off ${rec.of}, library off ${e.prRef}`);
  }
});

test('every provenance tag is one the project actually defines', () => {
  for (const [id, rec] of Object.entries(COEF_PROVENANCE)) {
    assert.ok(VALID_TAGS.has(rec.tag), `${id} carries unknown tag "${rec.tag}"`);
  }
});

// The ratchet. The debt may shrink, never grow: a movement added tomorrow must
// arrive with a sourced coefficient rather than joining the backlog.
test('the number of unsourced coefficients never rises above the recorded debt', () => {
  const unverified = Object.entries(COEF_PROVENANCE)
    .filter(([, rec]) => rec.tag === 'unverified')
    .map(([id]) => id);
  assert.ok(unverified.length <= UNVERIFIED_BUDGET,
    `${unverified.length} unsourced coefficients against a budget of ${UNVERIFIED_BUDGET}. ` +
    'A new loadable movement must arrive with a sourced coefficient, and ' +
    'UNVERIFIED_BUDGET is lowered as the backlog is worked off, never raised.');
});

// --------------------------------------------------------------------------
// What a coefficient above 1.00 actually does to the number he reads.
//
// design-library-expansion.md §5.9. `prescribe` clamps twice -- on the
// fraction of the movement's own max, and again on the displayed multiplier --
// so for prCoef > 1.00 the second clamp binds almost everywhere during the
// ramp. These two tests keep that measured fact from silently changing, in
// either direction: if a future edit makes the coefficient matter earlier, or
// makes it matter less, one of them fails and the change has to be deliberate.

const WEEK_1_CEILING = 0.65;   // RAMP[0].pctCeiling
const above = LIB.filter(e => e.loadable && e.prCoef != null && e.prCoef > 1.0 && e.id !== e.prRef);

const slotFor = zone => ({
  slot: 'primary', role: 'main', mode: 'load', zone,
  sets: [3, 5], reps: [3, 5], restSec: [120, 180]
});

test('in week 1 back, a coefficient above 1.00 prints the ceiling and nothing else', () => {
  assert.ok(above.length >= 5, 'expected the above-1.00 group to exist');
  for (const ex of above) {
    for (const zone of ['powerMultiple', 'maxStrength', 'hypertrophy']) {
      for (let seed = 1; seed <= 50; seed++) {
        const b = prescribe(slotFor(zone), ex, { volumeMultiplier: 1, pctCeiling: WEEK_1_CEILING },
                            makeRng(seed), {});
        assert.equal(b.displayMultiplier, WEEK_1_CEILING,
          `${ex.id} in ${zone} seed ${seed} printed ${b.displayMultiplier}, not the ceiling`);
      }
    }
  }
});

// The sharper form of the same fact, and the reason §5.9 tempers §5.6: during
// the early ramp the coefficient is INERT. Corrupting it does not move the
// number he reads, which is also why thirty wrong coefficients could sit in the
// library for months without ever producing a surprising session.
test('during the early ramp the coefficient is inert -- corrupting it changes nothing', () => {
  for (const ex of above) {
    const wrong = { ...ex, prCoef: ex.prCoef * 1.5 };
    for (let seed = 1; seed <= 25; seed++) {
      const env = { volumeMultiplier: 1, pctCeiling: WEEK_1_CEILING };
      const good = prescribe(slotFor('powerMultiple'), ex,    env, makeRng(seed), {});
      const bad  = prescribe(slotFor('powerMultiple'), wrong, env, makeRng(seed), {});
      assert.equal(bad.displayMultiplier, good.displayMultiplier,
        `${ex.id}: a 50% wrong coefficient moved the week-1 number, which §5.9 says it cannot`);
    }
  }
});
