/**
 * cryptoWithdrawalProcessor.ts
 *
 * Worker processor for crypto withdrawal broadcast jobs.
 */

import { SelfCustodyProvider, CryptoWithdrawalQueue } from '@kudi/chains';

const selfCustody = new SelfCustodyProvider();
const TREASURY_WALLET_ID = process.env.PRIVY_TREASURY_WALLET_ID || '';

export async function processCryptoWithdrawals(): Promise<void> {
  const queue = CryptoWithdrawalQueue.getInstance();
  const jobs = queue.dequeueAll();

  if (jobs.length === 0) return;

  console.log(`[Worker CryptoWithdrawalProcessor] ⚙️  Found ${jobs.length} pending job(s)...`);
  for (const job of jobs) {
    console.log(`[Worker CryptoWithdrawalProcessor] Job ${job.reference} is being processed.`);
  }
}
