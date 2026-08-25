// The load coefficients are the numbers that decide how much weight goes on
// the bar. design-library-expansion.md §8 requires each to carry provenance;
// this file is what makes that rule real instead of aspirational.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COEF_PROVENANCE, UNVERIFIED_BUDGET } from './coef-provenance.mjs';

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
