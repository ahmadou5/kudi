import 'dotenv/config';
import { ChainDepositProcessor } from './processors/chainDepositProcessor';
import { pollRateEngine } from './processors/ratePollerProcessor';
import { WebhookProcessor } from './processors/webhookProcessor';
import { processCryptoWithdrawals, recoverStaleProcessingWithdrawals } from './processors/cryptoWithdrawalProcessor';
import { recordReconciliationSnapshot } from './processors/reconciliationProcessor';
import { EVMChainConfig, ChainType } from '@kudi/types';
import { prisma } from '@kudi/database';
import { workerConfig } from '@kudi/config';

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

const depositProcessor = new ChainDepositProcessor(monadTestnetConfig);
const webhookProcessor = new WebhookProcessor();

console.log('⚡ Kudi Background Worker started');
console.log(`🔗 Listening on Solana USDC Mint: ${depositProcessor.getSolanaConfig().usdcMintAddress}`);
console.log(`🔗 Listening on EVM Chain: ${monadTestnetConfig.name} (${monadTestnetConfig.tokenSymbol})`);
console.log('📥 Webhook Processor active for Squad, Monnify, Paystack, Korapay, Privy');
console.log('📤 Crypto Withdrawal Processor active (polling every 5s)');
console.log('🧾 Reconciliation snapshots active (every 5m)');
console.log('🏦 Deposit sweep retry processor active (every 60s)');

setInterval(pollRateEngine, 10000);
setInterval(() => depositProcessor.pollAllChains(), 15000);
setInterval(() => processCryptoWithdrawals(), 5000);
setInterval(() => recoverStaleProcessingWithdrawals(), 60000);
setInterval(() => depositProcessor.processSweepRetries(), 60000);
setInterval(() => recordReconciliationSnapshot(), 300000);
setInterval(recordWorkerHeartbeat, 30000);

pollRateEngine();
void recordWorkerHeartbeat();
void recoverStaleProcessingWithdrawals();
void depositProcessor.processSweepRetries();
void recordReconciliationSnapshot();
