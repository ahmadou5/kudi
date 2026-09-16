import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const apiServer = read('apps/api/src/server.ts');
assert(!apiServer.includes('startPolling('), 'API server must not start polling loops');
assert(!apiServer.includes('setInterval(() => processCryptoWithdrawals'), 'API server must not run withdrawal intervals');

const workerIndex = read('apps/worker/src/index.ts');
assert(workerIndex.includes('WorkerHeartbeat'), 'Worker must update liveness heartbeat');
assert(workerIndex.includes('ratePoller') || workerIndex.includes('startRatePolling'), 'Worker must own rate polling startup');
assert(workerIndex.includes('chainDeposit') || workerIndex.includes('processChainDeposits'), 'Worker must own chain deposit processing startup');

const sdk = read('packages/sdk/src/index.ts');
assert(sdk.includes('@kudi/api-contracts'), 'SDK must consume shared API contracts');
assert(!sdk.match(/interface\s+KudiClientConfig[\s\S]*interface\s+KudiClientConfig/), 'SDK must not duplicate KudiClientConfig');

const contracts = read('packages/api-contracts/src/index.ts');
assert(contracts.includes('apiRoutes'), 'API contracts must export centralized route constants');
assert(contracts.includes('z.'), 'API contracts must expose Zod schemas');

const chainsPackage = read('packages/chains/package.json');
const chainsCorePackage = read('packages/chains-core/package.json');
assert(chainsPackage.includes('@kudi/chains-core'), '@kudi/chains must depend on pure @kudi/chains-core helpers');
assert(!chainsCorePackage.includes('ethers') && !chainsCorePackage.includes('@solana/kit'), '@kudi/chains-core must stay free of RPC/runtime chain SDKs');

if (failures.length > 0) {
  console.error('Smoke architecture checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smoke architecture checks passed');
