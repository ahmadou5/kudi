import test from 'node:test';
import assert from 'node:assert/strict';

const SUPPORTED_TELCOS = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];

function validateAirtimePurchase(telco, phoneNumber, amountNGN) {
  if (!SUPPORTED_TELCOS.includes(telco.toUpperCase())) {
    return { success: false, error: 'Unsupported mobile network operator' };
  }
  if (!/^\d{10,11}$/.test(phoneNumber.trim())) {
    return { success: false, error: 'Invalid phone number format' };
  }
  if (amountNGN < 100 || amountNGN > 50000) {
    return { success: false, error: 'Airtime amount must be between ₦100 and ₦50,000' };
  }
  return { success: true, status: 'COMPLETED', reference: 'BILL_' + Date.now() };
}

test('cards-bills: validates airtime top-up network, phone format, and amounts', () => {
  // Valid airtime purchase
  assert.equal(validateAirtimePurchase('MTN', '08012345678', 1000).success, true);

  // Invalid telco operator
  assert.equal(validateAirtimePurchase('VODAFONE', '08012345678', 1000).success, false);

  // Below minimum amount limit
  assert.equal(validateAirtimePurchase('AIRTEL', '08012345678', 50).success, false);
});
