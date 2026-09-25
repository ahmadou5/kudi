import 'dotenv/config';
import { ChainDepositProcessor } from './processors/chainDepositProcessor';
import { pollRateEngine } from './processors/ratePollerProcessor';
import { WebhookProcessor } from './processors/webhookProcessor';
import { processCryptoWithdrawals, recoverStaleProcessingWithdrawals } from './processors/cryptoWithdrawalProcessor';
import { recordReconciliationSnapshot } from './processors/reconciliationProcessor';
import { EVMChainConfig, ChainType, SolanaChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';
import { workerConfig, validateChainRuntimeConfig, redactRpcUrl } from '@kudi/config';

const monadTestnetConfig: EVMChainConfig = {
  id: 'monad-testnet',
  name: 'Monad Metropolis Testnet',
  chainId: workerConfig.MONAD_CHAIN_ID,
  type: ChainType.EVM,
  rpcUrl: workerConfig.MONAD_RPC_URL,
  tokenContractAddress: workerConfig.AUSD_TOKEN_ADDRESS,
  tokenSymbol: 'AUSD',
  tokenDecimals: 6,
  confirmationThreshold: 1,
  enabled: true
};

const solanaConfig: Partial<SolanaChainConfig> = {
  id: 'solana-devnet',
  name: 'Solana SPL-Token RPC',
  type: ChainType.SOLANA,
  rpcUrl: workerConfig.SOLANA_RPC_URL,
  usdcMintAddress: workerConfig.USDC_MINT_ADDRESS,
  confirmationThreshold: 1,
  enabled: true
};

// R6: fail closed on missing/invalid chain config before any polling starts.
// Secondary RPC endpoints (SOLANA_RPC_URL_FALLBACK / MONAD_RPC_URL_FALLBACK)
// are validated as URLs by the config schema; listeners keep single-rpcUrl
// behavior (see @kudi/chains) — the fallbacks are consumed via
// fetchJsonWithRpcFallback in RPC read paths until listener failover lands.
validateChainRuntimeConfig(
  {
    nodeEnv: workerConfig.NODE_ENV,
    solanaTreasuryAddress: workerConfig.KUDI_TREASURY_SOLANA_ADDRESS,
    evmTreasuryAddress: workerConfig.KUDI_TREASURY_EVM_ADDRESS,
    usdcMintAddress: workerConfig.USDC_MINT_ADDRESS,
    ausdTokenAddress: workerConfig.AUSD_TOKEN_ADDRESS,
    monadChainId: workerConfig.MONAD_CHAIN_ID,
    privyAppId: workerConfig.PRIVY_APP_ID,
    privyAppSecret: workerConfig.PRIVY_APP_SECRET
  },
  'worker'
);


async function recordWorkerHeartbeat(): Promise<void> {
  try {
    await prisma.workerHeartbeat.upsert({
      where: { id: 'kudi-background-worker' },
      update: {
        role: 'background-worker',
        hostname: workerConfig.HOSTNAME,
        pid: process.pid
      },
      create: {
        id: 'kudi-background-worker',
        role: 'background-worker',
        hostname: workerConfig.HOSTNAME,
        pid: process.pid
      }
    });
  } catch (err: any) {
    console.warn('[Worker] Heartbeat update failed:', err?.message || err);
  }
}

const depositProcessor = new ChainDepositProcessor(monadTestnetConfig, solanaConfig);
const webhookProcessor = new WebhookProcessor();

function runWorkerTask(name: string, task: () => Promise<unknown> | unknown): void {
  Promise.resolve()
    .then(task)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Worker] ' + name + ' failed: ' + message);
    });
}

console.log('⚡ Kudi Background Worker started');
console.log(`🔗 Listening on Solana USDC Mint: ${depositProcessor.getSolanaConfig().usdcMintAddress}`);
console.log(`🔗 Listening on EVM Chain: ${monadTestnetConfig.name} (${monadTestnetConfig.tokenSymbol})`);
if (workerConfig.SOLANA_RPC_URL_FALLBACK) {
  console.log(`🔗 Solana RPC failover configured: ${redactRpcUrl(workerConfig.SOLANA_RPC_URL_FALLBACK)}`);
}
if (workerConfig.MONAD_RPC_URL_FALLBACK) {
  console.log(`🔗 Monad RPC failover configured: ${redactRpcUrl(workerConfig.MONAD_RPC_URL_FALLBACK)}`);
}
console.log('📥 Webhook Processor active for Squad, Monnify, Paystack, Korapay, Privy');
console.log('📤 Crypto Withdrawal Processor active (polling every 5s)');
console.log('🧾 Reconciliation snapshots active (every 5m)');
console.log('🏦 Deposit sweep retry processor active (every 60s)');

setInterval(() => runWorkerTask('rate poller', pollRateEngine), 30000);
setInterval(() => runWorkerTask('chain deposit poller', () => depositProcessor.pollAllChains()), 15000);
setInterval(() => runWorkerTask('crypto withdrawal processor', processCryptoWithdrawals), 5000);
setInterval(() => runWorkerTask('stale withdrawal recovery', recoverStaleProcessingWithdrawals), 60000);
setInterval(() => runWorkerTask('stale deposit sweep recovery', () => depositProcessor.recoverStaleProcessingSweeps()), 60000);
setInterval(() => runWorkerTask('deposit sweep retries', () => depositProcessor.processSweepRetries()), 60000);
setInterval(() => runWorkerTask('reconciliation snapshot', recordReconciliationSnapshot), 300000);
setInterval(() => runWorkerTask('worker heartbeat', recordWorkerHeartbeat), 30000);

runWorkerTask('rate poller', pollRateEngine);
runWorkerTask('worker heartbeat', recordWorkerHeartbeat);
runWorkerTask('stale withdrawal recovery', recoverStaleProcessingWithdrawals);
runWorkerTask('stale deposit sweep recovery', () => depositProcessor.recoverStaleProcessingSweeps());
runWorkerTask('deposit sweep retries', () => depositProcessor.processSweepRetries());
runWorkerTask('reconciliation snapshot', recordReconciliationSnapshot);
