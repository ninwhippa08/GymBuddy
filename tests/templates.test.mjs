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
    assert.equal(g.modality, 'mobility-dynamic');
    assert.equal(g.role, 'prep');
    assert.equal(g.mode, 'drill');
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
  for (const g of groups) assert.equal(g.optional, false);
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
