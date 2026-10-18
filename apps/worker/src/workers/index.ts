import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { ChainType, type EVMChainConfig } from '@kudi/types';
import { pollRateEngine } from '../processors/ratePollerProcessor';
import { processCryptoWithdrawals, recoverStaleProcessingWithdrawals } from '../processors/cryptoWithdrawalProcessor';
import { recordReconciliationSnapshot } from '../processors/reconciliationProcessor';
import { ChainDepositProcessor } from '../processors/chainDepositProcessor';
import { WebhookProcessor } from '../processors/webhookProcessor';
import { PerformTransferJob } from '../jobs/performTransfer';
import { processPerformTransferJob } from './transferWorker';

// ---------------------------------------------------------------------------
// Shared Redis connection factory — parsed from REDIS_URL so it works on
// Railway / Upstash / Redis Cloud without individual REDIS_HOST/PORT/PASS vars.
// ---------------------------------------------------------------------------
export function buildRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // Log clearly so Railway logs show the real cause
    console.error(
      '[Worker] ❌ REDIS_URL is not set. BullMQ workers cannot start without a Redis connection.\n' +
      '         Set REDIS_URL in Railway → worker service → Variables tab.'
    );
    // Return undefined — callers must guard against this
    return undefined;
  }

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username && url.username !== 'default' ? url.username : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (err) {
    console.error('[Worker] ❌ Failed to parse REDIS_URL:', redisUrl, err);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Worker factory — called ONCE after dotenv has loaded, not at import time.
// Returns all BullMQ Worker instances. Exits process if Redis is unavailable.
// ---------------------------------------------------------------------------
export function createAllWorkers(
  heartbeatFn: () => Promise<void>
): Worker[] {
  const connection = buildRedisConnection();

  if (!connection) {
    console.error('[Worker] ❌ Cannot create BullMQ workers without a Redis connection. Exiting.');
    process.exit(1);
  }

  console.log(`[Worker] ✅ Redis connection: ${connection.host}:${connection.port}`);

  // Chain configs — resolved here so env is definitely loaded
  const monadConfig: EVMChainConfig = {
    id: 'monad-testnet',
    name: 'Monad Metropolis Testnet',
    chainId: Number(process.env.MONAD_CHAIN_ID) || 10143,
    type: ChainType.EVM,
    rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
    tokenContractAddress: process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    tokenSymbol: 'AUSD',
    tokenDecimals: 6,
    confirmationThreshold: 1,
    enabled: true,
  };

  const solanaConfig = {
    id: 'solana-devnet',
    name: 'Solana SPL-Token RPC',
    rpcUrl: process.env.SOLANA_RPC_URL,
    rpcUrlFallback: process.env.SOLANA_RPC_URL_FALLBACK,
    usdcMintAddress: process.env.USDC_MINT_ADDRESS,
    confirmationThreshold: 1,
    enabled: true,
  };

  const depositProcessor = new ChainDepositProcessor(monadConfig, solanaConfig);
  const webhookProcessor = new WebhookProcessor();

  // --- PerformTransfer Worker ---
  const performTransferWorker = new Worker<PerformTransferJob>(
    'perform-transfer',
    async (job: Job<PerformTransferJob>) => processPerformTransferJob(job.data),
    { connection, concurrency: 10 }
  );
  performTransferWorker.on('completed', (job) =>
    console.log(`[Worker] perform-transfer job ${job.id} completed`)
  );
  performTransferWorker.on('failed', (job, err) =>
    console.error(`[Worker] perform-transfer job ${job?.id} failed:`, err.message)
  );

  // --- Rate Poller Worker ---
  const ratePollerWorker = new Worker(
    'rate-poller',
    async () => { await pollRateEngine(); },
    { connection, concurrency: 1 }
  );
  ratePollerWorker.on('completed', () => console.log('[Worker] rate-poller completed'));
  ratePollerWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] rate-poller failed:', err.message)
  );

  // --- Chain Deposit Poller Worker ---
  const chainDepositPollerWorker = new Worker(
    'chain-deposit-poller',
    async () => { await depositProcessor.pollAllChains(); },
    { connection, concurrency: 1 }
  );
  chainDepositPollerWorker.on('completed', () =>
    console.log('[Worker] chain-deposit-poller completed')
  );
  chainDepositPollerWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] chain-deposit-poller failed:', err.message)
  );

  // --- Crypto Withdrawal Processor Worker ---
  const cryptoWithdrawalWorker = new Worker(
    'crypto-withdrawal',
    async () => { await processCryptoWithdrawals(); },
    { connection, concurrency: 5 }
  );
  cryptoWithdrawalWorker.on('completed', () =>
    console.log('[Worker] crypto-withdrawal completed')
  );
  cryptoWithdrawalWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] crypto-withdrawal failed:', err.message)
  );

  // --- Stale Withdrawal Recovery Worker ---
  const staleWithdrawalRecoveryWorker = new Worker(
    'stale-withdrawal-recovery',
    async () => {
      const recovered = await recoverStaleProcessingWithdrawals(5);
      if (recovered > 0) console.log(`[Worker] Recovered ${recovered} stale withdrawal(s).`);
    },
    { connection, concurrency: 1 }
  );
  staleWithdrawalRecoveryWorker.on('completed', () =>
    console.log('[Worker] stale-withdrawal-recovery completed')
  );
  staleWithdrawalRecoveryWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] stale-withdrawal-recovery failed:', err.message)
  );

  // --- Reconciliation Snapshot Worker ---
  const reconciliationWorker = new Worker(
    'reconciliation',
    async () => {
      const metrics = await recordReconciliationSnapshot();
      if (metrics) {
        console.log(
          `[Reconciliation] 📊 Liability: $${metrics.totalLiabilityUSDC.toFixed(2)} | ` +
          `Available: $${metrics.totalAvailableUSDC.toFixed(2)}`
        );
      }
    },
    { connection, concurrency: 1 }
  );
  reconciliationWorker.on('completed', () => console.log('[Worker] reconciliation completed'));
  reconciliationWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] reconciliation failed:', err.message)
  );

  // --- Webhook Processor Worker ---
  const webhookWorker = new Worker(
    'webhook',
    async (job) => { await webhookProcessor.processJob(job.data); },
    { connection, concurrency: 10 }
  );
  webhookWorker.on('completed', (job) =>
    console.log(`[Worker] webhook job ${job.id} completed`)
  );
  webhookWorker.on('failed', (job, err) =>
    console.error(`[Worker] webhook job ${job?.id} failed:`, err.message)
  );

  // --- Heartbeat Worker ---
  const heartbeatWorker = new Worker(
    'worker-heartbeat',
    async () => { await heartbeatFn(); },
    { connection, concurrency: 1 }
  );
  heartbeatWorker.on('completed', () => console.log('[Worker] heartbeat completed'));
  heartbeatWorker.on('failed', (_job, err: Error) =>
    console.error('[Worker] heartbeat failed:', err.message)
  );

  return [
    performTransferWorker,
    ratePollerWorker,
    chainDepositPollerWorker,
    cryptoWithdrawalWorker,
    staleWithdrawalRecoveryWorker,
    reconciliationWorker,
    webhookWorker,
    heartbeatWorker,
  ];
}