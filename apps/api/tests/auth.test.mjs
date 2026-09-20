import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Simulation of Auth Logic
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function validatePhoneNumber(phone) {
  return /^\+?[1-9]\d{9,14}$/.test(phone.trim());
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

test('auth: validates phone number & email format', () => {
  assert.equal(validatePhoneNumber('+2348012345678'), true);
  assert.equal(validatePhoneNumber('invalid_phone'), false);
  assert.equal(validateEmail('user@kudi.com'), true);
  assert.equal(validateEmail('invalid_email'), false);
});

test('auth: hashes transaction PIN securely', () => {
  const pin = '1234';
  const hashed = hashPin(pin);
  assert.notEqual(hashed, pin);
  assert.equal(hashed.length, 64);
  assert.equal(hashPin('1234'), hashed);
});
