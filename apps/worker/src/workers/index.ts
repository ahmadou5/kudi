import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { prisma } from '@kudi/database';
import { recordWorkerHeartbeat } from '../index';
import { pollRateEngine } from '../processors/ratePollerProcessor';
import { processCryptoWithdrawals, recoverStaleProcessingWithdrawals } from '../processors/cryptoWithdrawalProcessor';
import { recordReconciliationSnapshot } from '../processors/reconciliationProcessor';
import { ChainDepositProcessor } from '../processors/chainDepositProcessor';
import { WebhookProcessor } from '../processors/webhookProcessor';
import { PerformTransferJob, PerformTransferResult, TransferMetadata } from '../jobs/performTransfer';
import { processPerformTransferJob } from './transferWorker';
import { SelfCustodyProvider } from '@kudi/provider-privy';

const selfCustody = new SelfCustodyProvider();

// Config without 'type' field - ChainDepositProcessor uses the config for
// RPC URLs, addresses, and other settings. The chain type is inferred
// from the config structure (EVM vs Solana).
const monadConfig = {
  id: 'monad-testnet',
  name: 'Monad Metropolis Testnet',
  chainId: Number(process.env.MONAD_CHAIN_ID),
  rpcUrl: process.env.MONAD_RPC_URL,
  tokenContractAddress: process.env.AUSD_TOKEN_ADDRESS,
  tokenSymbol: 'AUSD',
  tokenDecimals: 6,
  confirmationThreshold: 1,
  enabled: true
};

const solanaConfig = {
  id: 'solana-devnet',
  name: 'Solana SPL-Token RPC',
  rpcUrl: process.env.SOLANA_RPC_URL,
  rpcUrlFallback: process.env.SOLANA_RPC_URL_FALLBACK,
  usdcMintAddress: process.env.USDC_MINT_ADDRESS,
  confirmationThreshold: 1,
  enabled: true
};

const depositProcessor = new ChainDepositProcessor(monadConfig, solanaConfig);
const webhookProcessor = new WebhookProcessor();

// --- PerformTransfer Worker ---

export const performTransferWorker = new Worker(
  'perform-transfer',
  async (job) => {
    const result = await processPerformTransferJob(job);
    return result;
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 10,
    // Apply idempotency at the worker level: skip if job with same data already processed
    // BullMQ automatically handles this via job keys if specified, but we also check in the job handler
  }
);

performTransferWorker.on('completed', (job) => {
  console.log(`[Worker] perform-transfer job ${job.id} completed`);
});

performTransferWorker.on('failed', (job, err) => {
  console.error(`[Worker] perform-transfer job ${job?.id} failed:`, err.message);
});

// --- Rate Poller Worker (replaces setInterval) ---

export const ratePollerWorker = new Worker(
  'rate-poller',
  async () => {
    await pollRateEngine();
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 1,
  }
);

ratePollerWorker.on('completed', () => {
  console.log('[Worker] rate-poller completed');
});

ratePollerWorker.on('failed', (err) => {
  console.error('[Worker] rate-poller failed:', err.message);
});

// --- Chain Deposit Poller Worker (replaces setInterval) ---

export const chainDepositPollerWorker = new Worker(
  'chain-deposit-poller',
  async () => {
    await depositProcessor.pollAllChains();
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 1,
  }
);

chainDepositPollerWorker.on('completed', () => {
  console.log('[Worker] chain-deposit-poller completed');
});

chainDepositPollerWorker.on('failed', (err) => {
  console.error('[Worker] chain-deposit-poller failed:', err.message);
});

// --- Crypto Withdrawal Processor Worker (replaces setInterval) ---

export const cryptoWithdrawalWorker = new Worker(
  'crypto-withdrawal',
  async () => {
    await processCryptoWithdrawals();
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 5,
  }
);

cryptoWithdrawalWorker.on('completed', () => {
  console.log('[Worker] crypto-withdrawal completed');
});

cryptoWithdrawalWorker.on('failed', (err) => {
  console.error('[Worker] crypto-withdrawal failed:', err.message);
});

// --- Stale Withdrawal Recovery Worker (replaces setInterval) ---

export const staleWithdrawalRecoveryWorker = new Worker(
  'stale-withdrawal-recovery',
  async () => {
    const recovered = await recoverStaleProcessingWithdrawals(5);
    if (recovered > 0) {
      console.log(`[Worker] Recovered ${recovered} stale withdrawal(s).`);
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 1,
  }
);

staleWithdrawalRecoveryWorker.on('completed', () => {
  console.log('[Worker] stale-withdrawal-recovery completed');
});

staleWithdrawalRecoveryWorker.on('failed', (err) => {
  console.error('[Worker] stale-withdrawal-recovery failed:', err.message);
});

// --- Reconciliation Snapshot Worker (replaces setInterval) ---

export const reconciliationWorker = new Worker(
  'reconciliation',
  async () => {
    const metrics = await recordReconciliationSnapshot();
    if (metrics) {
      console.log(`[Reconciliation] 📊 Liability: $${metrics.totalLiabilityUSDC.toFixed(2)} | Available: $${metrics.totalAvailableUSDC.toFixed(2)}`);
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 1,
  }
);

reconciliationWorker.on('completed', () => {
  console.log('[Worker] reconciliation completed');
});

reconciliationWorker.on('failed', (err) => {
  console.error('[Worker] reconciliation failed:', err.message);
});

// --- Webhook Processor Worker ---

export const webhookWorker = new Worker(
  'webhook',
  async (job) => {
    await webhookProcessor.processJob(job.data);
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 10,
  }
);

webhookWorker.on('completed', (job) => {
  console.log(`[Worker] webhook job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`[Worker] webhook job ${job?.id} failed:`, err.message);
});

// --- Worker Heartbeat Worker ---

export const heartbeatWorker = new Worker(
  'worker-heartbeat',
  async () => {
    await recordWorkerHeartbeat();
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 1,
  }
);

heartbeatWorker.on('completed', () => {
  console.log('[Worker] heartbeat completed');
});

heartbeatWorker.on('failed', (err) => {
  console.error('[Worker] heartbeat failed:', err.message);
});

// Export all workers for registration
export const allWorkers = [
  performTransferWorker,
  ratePollerWorker,
  chainDepositPollerWorker,
  cryptoWithdrawalWorker,
  staleWithdrawalRecoveryWorker,
  reconciliationWorker,
  webhookWorker,
  heartbeatWorker,
];