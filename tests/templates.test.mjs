import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREP_BLOCK, COOLDOWN_BLOCK, TEMPLATES, validateSlots } from '../js/templates.js';
import { MODALITIES } from '../js/rules.js';

const groups = [
  ...Object.values(PREP_BLOCK).flat(),
  ...Object.values(COOLDOWN_BLOCK).flat()
];

test('prep draws dynamic, cool-down draws static', () => {
  for (const g of Object.values(PREP_BLOCK).flat()) {
    assert.equal(g.role, 'prep');
    // A prep stage may raise, integrate or potentiate as well as mobilise
    // (design-running-programming.md §5), so mode and modality vary. What
    // must never vary is which mobility pool prep draws from: static
    // stretching before the work is the thing this guards against.
    assert.notEqual(g.modality, 'mobility-static',
      `prep slot ${g.slot} draws static stretching`);
    if (g.mode === 'drill') assert.equal(g.modality, 'mobility-dynamic');
  }
  const stretch = COOLDOWN_BLOCK.full.find(g => g.role === 'mobility');
  assert.equal(stretch.modality, 'mobility-static');
  assert.equal(stretch.mode, 'hold');
});

test('the full cool-down carries core, the short one does not', () => {
  assert.ok(COOLDOWN_BLOCK.full.some(g => g.role === 'core'));
  assert.ok(!COOLDOWN_BLOCK.short.some(g => g.role === 'core'));
});

test('no block is optional -- it is never randomised out', () => {
  // One exception, named so a second cannot appear silently: the running
  // prep's potentiation stage. design-running-programming.md §5.1 gives the
  // easy run no stage 4, because build-ups before a conversational-pace run
  // make it something other than an easy run.
  const optional = groups.filter(g => g.optional).map(g => g.slot);
  assert.deepEqual(optional, ['P4']);
  assert.equal(PREP_BLOCK.running[3].slot, 'P4');
  for (const g of groups) {
    if (g === PREP_BLOCK.running[3]) continue;
    assert.equal(g.optional, false, `slot ${g.slot} is optional`);
  }
});

test('every modality named anywhere is in the vocabulary', () => {
  const all = [...Object.values(TEMPLATES).flat(), ...groups];
  for (const g of all) {
    if (g.modality == null) continue;
    assert.ok(MODALITIES.includes(g.modality),
      `slot ${g.slot} names unknown modality "${g.modality}"`);
  }
});

test('guard throws for unknown modality with locatable message', () => {
  const bogusSlot = { slot: 'TEST', modality: 'unknown-modality', zone: null };
  const slotGroups = [['test.location', bogusSlot]];

  assert.throws(
    () => validateSlots(slotGroups),
    /unknown modality "unknown-modality"/
  );

  // Also verify the message includes the slot and location
  try {
    validateSlots(slotGroups);
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('TEST'), 'message should name the slot');
    assert.ok(e.message.includes('unknown-modality'), 'message should name the modality');
  }
});
