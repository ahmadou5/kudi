import test from 'node:test';
import assert from 'node:assert/strict';

function validateBvn(bvn) {
  return /^\d{11}$/.test(String(bvn).trim());
}

function validateNin(nin) {
  return /^\d{11}$/.test(String(nin).trim());
}

function processKycVerification(idNumber, idType) {
  const isValid = idType === 'BVN' ? validateBvn(idNumber) : validateNin(idNumber);
  if (!isValid) {
    return { success: false, status: 'REJECTED', message: `Invalid ${idType} format` };
  }
  return { success: true, status: 'VERIFIED', tier: 'TIER_1' };
}

test('kyc: validates BVN & NIN 11-digit format strictly', () => {
  assert.equal(validateBvn('22233344455'), true);
  assert.equal(validateBvn('12345'), false);
  assert.equal(validateNin('99988877766'), true);
  assert.equal(validateNin('abc'), false);
});

test('kyc: upgrades user to TIER_1 upon successful BVN verification', () => {
  const res = processKycVerification('22233344455', 'BVN');
  assert.equal(res.success, true);
  assert.equal(res.status, 'VERIFIED');
  assert.equal(res.tier, 'TIER_1');
});
