import test from 'node:test';
import assert from 'node:assert/strict';

// Tier Limit & Provider Failover Simulation
const KYC_TIER_LIMITS = {
  TIER_0: 0,
  TIER_1: 50000,      // ₦50,000 per day
  TIER_2: 5000000     // ₦5,000,000 per day
};

function checkKycLimit(tier, dailySpentNGN, requestedNGN) {
  const maxLimit = KYC_TIER_LIMITS[tier] || 0;
  return (dailySpentNGN + requestedNGN) <= maxLimit;
}

async function simulateFailoverPayout(request, mockProviders) {
  const logs = [];
  for (const provider of mockProviders) {
    logs.push(`Attempting ${provider.name}`);
    if (provider.shouldSucceed) {
      return { status: 'SUCCESS', provider: provider.name, reference: 'REF_' + Date.now(), logs };
    }
  }
  throw new Error(`All providers failed: ${logs.join(', ')}`);
}

test('payout-failover: enforces Tier 1 vs Tier 2 daily NGN spending limits', () => {
  // Tier 1 user trying to spend ₦60,000 (exceeds ₦50k limit)
  assert.equal(checkKycLimit('TIER_1', 0, 60000), false);

  // Tier 1 user spending ₦30,000 (within ₦50k limit)
  assert.equal(checkKycLimit('TIER_1', 0, 30000), true);

  // Tier 2 user spending ₦2,000,000 (within ₦5M limit)
  assert.equal(checkKycLimit('TIER_2', 1000000, 2000000), true);
});

test('payout-failover: automatically fails over from Paystack to Monnify when Paystack is down', async () => {
  const providers = [
    { name: 'PAYSTACK', shouldSucceed: false },
    { name: 'MONNIFY', shouldSucceed: true },
    { name: 'SQUAD', shouldSucceed: true }
  ];

  const res = await simulateFailoverPayout({ amount: 10000 }, providers);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.provider, 'MONNIFY');
  assert.deepEqual(res.logs, ['Attempting PAYSTACK', 'Attempting MONNIFY']);
});

test('payout-failover: throws error when all payment providers fail', async () => {
  const providers = [
    { name: 'PAYSTACK', shouldSucceed: false },
    { name: 'MONNIFY', shouldSucceed: false },
    { name: 'SQUAD', shouldSucceed: false }
  ];

  await assert.rejects(async () => {
    await simulateFailoverPayout({ amount: 10000 }, providers);
  }, /All providers failed/);
});
