import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

console.log('🚀 Starting Metropolis (Kudi) Monorepo End-to-End & Feature Test Runner...\n');

const testSuites = [
  { name: '@kudi/chains-core (Address Validation)', path: 'packages/chains-core/tests/chains-core.test.mjs' },
  { name: '@kudi/payment-providers (Failover Registry)', path: 'packages/payment-providers/tests/payment-providers.test.mjs' },
  { name: '@kudi/receipts (Digital Receipts)', path: 'packages/receipts/tests/receipts.test.mjs' },
  { name: '@kudi/sdk (Client SDK Contracts)', path: 'packages/sdk/tests/sdk.test.mjs' },
  { name: 'API Auth & PIN Security Module', path: 'apps/api/tests/auth.test.mjs' },
  { name: 'API Balance & Float Ledger Engine', path: 'apps/api/tests/balance-ledger.test.mjs' },
  { name: 'API Payout & Multi-Provider Failover', path: 'apps/api/tests/payout-failover.test.mjs' },
  { name: 'API KYC & Tier Verification Engine', path: 'apps/api/tests/kyc.test.mjs' },
  { name: 'API Virtual Cards & Utility Bills', path: 'apps/api/tests/cards-bills.test.mjs' },
  { name: 'API Sweep & Treasury Backing Engine', path: 'apps/api/tests/sweep-treasury.test.mjs' },
  { name: 'API Admin Ops & SEC/CBN Audit Engine', path: 'apps/api/tests/admin-ops.test.mjs' }
];

const results = [];
const overallStart = performance.now();

for (const suite of testSuites) {
  const start = performance.now();
  try {
    execSync(`node --test ${suite.path}`, { stdio: 'pipe' });
    const elapsed = Math.round(performance.now() - start);
    results.push({ name: suite.name, status: 'PASSED', timeMs: elapsed });
    console.log(`  ✅ PASSED: ${suite.name} (${elapsed}ms)`);
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    results.push({ name: suite.name, status: 'FAILED', timeMs: elapsed, error: err.message });
    console.log(`  ❌ FAILED: ${suite.name} (${elapsed}ms)`);
  }
}

const totalTime = Math.round(performance.now() - overallStart);
const passedCount = results.filter(r => r.status === 'PASSED').length;
const totalCount = results.length;
const passRate = ((passedCount / totalCount) * 100).toFixed(1);

console.log('\n======================================================');
console.log(`📊 TEST SUITE RUNNER SUMMARY MATRIX`);
console.log(`======================================================`);
console.log(`Passed: ${passedCount} / ${totalCount} (${passRate}%)`);
console.log(`Total Execution Time: ${totalTime} ms`);
console.log('======================================================\n');

if (passedCount < totalCount) {
  process.exit(1);
}
