'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTitle,
  validateTitle,
  validateCompleted,
  parseTodoId,
  validatePatch,
} = require('../utils/validators');

test('normalizeTitle trims and collapses whitespace', () => {
  assert.equal(normalizeTitle('  buy   milk  '), 'buy milk');
});

test('validateTitle accepts a valid title and normalizes it', () => {
  assert.deepEqual(validateTitle('  write  tests '), { ok: true, value: 'write tests' });
});

test('validateTitle rejects empty and non-string titles', () => {
  assert.equal(validateTitle('   ').ok, false);
  assert.equal(validateTitle(42).ok, false);
  assert.equal(validateTitle(null).ok, false);
});

test('validateTitle enforces the 200 character limit', () => {
  assert.equal(validateTitle('a'.repeat(200)).ok, true);
  assert.equal(validateTitle('a'.repeat(201)).ok, false);
});

test('validateCompleted accepts booleans and boolean strings', () => {
  assert.deepEqual(validateCompleted(true), { ok: true, value: true });
  assert.deepEqual(validateCompleted('false'), { ok: true, value: false });
  assert.equal(validateCompleted('yes').ok, false);
});

test('parseTodoId accepts only positive integers', () => {
  assert.equal(parseTodoId('7'), 7);
  assert.equal(parseTodoId('0'), null);
  assert.equal(parseTodoId('-3'), null);
  assert.equal(parseTodoId('1.5'), null);
  assert.equal(parseTodoId('../etc/passwd'), null);
});

test('validatePatch requires at least one recognised field', () => {
  assert.equal(validatePatch({}).ok, false);
  assert.equal(validatePatch({ unknown: 1 }).ok, false);
  assert.deepEqual(validatePatch({ completed: 'true' }), {
    ok: true,
    value: { completed: true },
  });
});
