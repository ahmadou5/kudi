import 'dotenv/config';
import { ChainDepositProcessor } from './processors/chainDepositProcessor';
import { pollRateEngine } from './processors/ratePollerProcessor';
import { WebhookProcessor } from './processors/webhookProcessor';
import { processCryptoWithdrawals, recoverStaleProcessingWithdrawals } from './processors/cryptoWithdrawalProcessor';
import { recordReconciliationSnapshot } from './processors/reconciliationProcessor';
import { EVMChainConfig, ChainType, SolanaChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';
import { workerConfig, validateChainRuntimeConfig, redactRpcUrl } from '@kudi/config';
import { allWorkers } from './workers';
import { performTransferWorker } from './workers/transferWorker';
import { processPerformTransferJob } from './workers/transferWorker';
import { PerformTransferJob, PerformTransferResult } from './jobs/performTransfer';
import { Queue, QueueEvents } from 'bullmq';

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
  rpcUrlFallback: workerConfig.SOLANA_RPC_URL_FALLBACK,
  usdcMintAddress: workerConfig.USDC_MINT_ADDRESS,
  confirmationThreshold: 1,
  enabled: true
};

// R6: fail closed on missing/invalid chain config before any polling starts.
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

// ---------------------------------------------------------------------------
// Initialise all BullMQ workers after the heartbeat function is defined.
// ---------------------------------------------------------------------------
const allWorkers = createAllWorkers(recordWorkerHeartbeat);

const depositProcessor = new ChainDepositProcessor(monadTestnetConfig, solanaConfig);
const webhookProcessor = new WebhookProcessor();

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
console.log('📤 Crypto Withdrawal Processor active');
console.log('🧾 Reconciliation snapshots active');
console.log('📥 Chain deposit poller active');
console.log('⚡ PerformTransfer worker active');
console.log('⚡ Rate poller worker active');

/**
 * River / bullmq worker replacement for the legacy setInterval polling.
 * 
 * Each worker runs as a bullmq Worker connected to Redis, replacing the
 * previous setInterval-based polling pattern. This provides:
 * - Durable job processing with persistence in Redis
 * - Configurable concurrency per task type
 * - Automatic retry and failure handling
 * - Job state tracking and monitoring
 * - Idempotency enforcement at the job level
 * 
 * Legacy setInterval functions have been deprecated in favor of this
 * River/bullmq-based pattern. The old polling intervals are kept as
 * commented reference but will be removed in a future release.
 */

// Start all bullmq workers
console.log('🚀 Starting bullmq workers...');
allWorkers.forEach((worker) => {
  worker.run();
  console.log(`  Started worker: ${worker.name}`);
});

// PerformTransfer manual dispatch helper (for API/trigger usage)
// Enqueues a durable BullMQ job; awaits completion when the worker is live,
// otherwise returns a queued receipt. Falls back to inline execution if Redis
// is unavailable. Returned shape extends PerformTransferResult with jobId.
async function dispatchPerformTransfer(transferData: {
  userID: string;
  walletID: string;
  asset: string;
  toAddress: string;
  amount: number;
  chain: 'solana' | 'monad' | 'stellar';
}): Promise<PerformTransferResult & { jobId: string }> {
  const redisUrl = process.env.REDIS_URL;
  let connection: { host: string; port: number; password?: string; username?: string; tls?: object };
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      connection = {
        host: url.hostname,
        port: Number(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
        tls: url.protocol === 'rediss:' ? {} : undefined,
      };
    } catch {
      connection = { host: 'localhost', port: 6379 };
    }
  } else {
    connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }
  const startedAt = Date.now();
  const buildQueuedReceipt = (jobId: string): PerformTransferResult & { jobId: string } => ({
    success: true,
    jobId,
    status: 'processing' as unknown as PerformTransferResult['status'],
    duration: (Date.now() - startedAt) / 1000,
    metadata: {
      signingProvider: 'privy',
      walletID: transferData.walletID,
      asset: transferData.asset,
      toAddress: transferData.toAddress,
      chain: transferData.chain,
      duration: (Date.now() - startedAt) / 1000,
      type: 'outgoing-transfer',
      fee: 0.01,
      txHash: undefined,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  let queue: Queue | null = null;
  try {
    queue = new Queue('perform-transfer', { connection });

    const job = await queue.add('perform-transfer', transferData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    const jobId = job.id ?? `transfer-${Date.now()}`;
    console.log(`[Transfer] 📦 Dispatched PerformTransfer job ${jobId} for user ${transferData.userID}`);

    // Await worker completion for synchronous callers; on timeout the worker
    // continues async and we return a queued/processing receipt with jobId.
    try {
      const queueEvents = new QueueEvents('perform-transfer', { connection });
      await queueEvents.waitUntilReady();
      try {
        const result = await job.waitUntilFinished(queueEvents, 15000);
        await queueEvents.close().catch(() => undefined);
        await queue.close().catch(() => undefined);
        return { ...(result as PerformTransferResult), jobId };
      } catch (waitErr: any) {
        await queueEvents.close().catch(() => undefined);
        await queue.close().catch(() => undefined);
        console.log(`[Transfer] ⏳ Job ${jobId} queued (worker processing async): ${waitErr?.message || waitErr}`);
        return buildQueuedReceipt(jobId);
      }
    } catch (eventsErr: any) {
      await queue.close().catch(() => undefined);
      console.log(`[Transfer] ⏳ Job ${jobId} queued (QueueEvents unavailable): ${eventsErr?.message || eventsErr}`);
      return buildQueuedReceipt(jobId);
    }
  } catch (err: any) {
    await queue?.close().catch(() => undefined);
    console.warn(`[Transfer] ⚠️ Redis unavailable, executing PerformTransfer inline for user ${transferData.userID}: ${err?.message || err}`);
    const direct = await processPerformTransferJob({
      ...transferData,
      signingProvider: 'privy',
    } as PerformTransferJob);
    return { ...direct, jobId: `inline-${Date.now()}` };
  }
}

export { recordWorkerHeartbeat };

// Run initial processing tasks on startup (equivalent to the old immediate setInterval runs)
async function runInitialTasks(): Promise<void> {
  // Immediately process heartbeat on startup
  await recordWorkerHeartbeat();

  // Process stale withdrawal recovery immediately
  const recovered = await recoverStaleProcessingWithdrawals(5);
  if (recovered > 0) {
    console.log(`[Worker] Recovered ${recovered} stale withdrawal(s) on startup.`);
  }

  // Process crypto withdrawals immediately
  await processCryptoWithdrawals();
}

runInitialTasks().catch((err) => {
  console.error('[Worker] Initial tasks failed:', err instanceof Error ? err.message : err);
});

// Export for use by other modules
export { dispatchPerformTransfer };

console.log('✅ Kudi Background Worker fully initialized with bullmq River pattern');