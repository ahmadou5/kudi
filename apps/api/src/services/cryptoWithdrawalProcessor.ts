/**
 * cryptoWithdrawalProcessor.ts
 *
 * Background processor for crypto withdrawal broadcast jobs.
 *
 * Flow:
 *  1. Dequeue pending jobs from CryptoWithdrawalQueue
 *  2. Broadcast via Privy treasury wallet (SelfCustodyProvider.sendCrypto)
 *  3. Poll for on-chain confirmation (SelfCustodyProvider.waitForConfirmation)
 *  4. Update withdrawal status in LedgerService
 *  5. On failure: rollback balance + mark FAILED + notify user
 *
 * Retry policy: up to 3 attempts with exponential backoff (5s, 15s, 45s).
 */

import { SelfCustodyProvider, CryptoWithdrawalQueue } from '@kudi/chains';
import { WithdrawalStatus } from '@kudi/types';
import { LedgerService } from './ledgerService';

const selfCustody = new SelfCustodyProvider();
let defaultLedgerService: LedgerService | null = null;

// Kudi treasury Privy wallet ID used for all custodial sends
const TREASURY_WALLET_ID = process.env.PRIVY_TREASURY_WALLET_ID || '';

// Backoff delays by attempt: 5s, 15s, 45s
const BACKOFF_MS = [5_000, 15_000, 45_000];

export async function processCryptoWithdrawals(ledgerServiceInstance?: LedgerService): Promise<void> {
  const ledgerService = ledgerServiceInstance || (defaultLedgerService ??= new LedgerService());
  const queue = CryptoWithdrawalQueue.getInstance();
  const jobs = queue.dequeueAll();

  if (jobs.length === 0) return;

  console.log(`[CryptoWithdrawalProcessor] ⚙️  Processing ${jobs.length} pending job(s)...`);

  for (const job of jobs) {
    const { reference, userId, amountUSDC, toAddress, chain, attempts } = job;

    // Wait for backoff period if this is a retry
    if (attempts > 0) {
      const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      const enqueuedAt = new Date(job.enqueuedAt).getTime();
      if (Date.now() - enqueuedAt < backoff) {
        continue; // Not ready to retry yet
      }
    }

    const shouldRetry = queue.recordAttempt(reference);

    try {
      console.log(`[CryptoWithdrawalProcessor] 📤 Broadcasting withdrawal ${reference} (attempt ${attempts + 1})...`);

      // Step 1: Broadcast tx via Privy treasury wallet
      const { txHash } = await selfCustody.sendCrypto({
        treasuryWalletId: TREASURY_WALLET_ID,
        toAddress,
        amountUSDC,
        chain
      });

      // Step 2: Mark as broadcast
      ledgerService.updateWithdrawal(reference, {
        status: WithdrawalStatus.BROADCAST,
        txHash
      });
      console.log(`[CryptoWithdrawalProcessor] 🔗 Broadcast OK: ${txHash.slice(0, 20)}... Waiting for confirmation...`);

      // Step 3: Wait for on-chain confirmation
      const confirmed = await selfCustody.waitForConfirmation(txHash, chain);

      if (confirmed) {
        // Step 4: Mark confirmed — job done
        ledgerService.updateWithdrawal(reference, {
          status: WithdrawalStatus.CONFIRMED
        });

        // Notify user
        ledgerService.addNotification(
          userId,
          'Crypto Send Confirmed ✅',
          `Your transfer of ${amountUSDC.toFixed(2)} ${chain === 'solana' ? 'USDC' : 'AUSD'} has been confirmed on ${chain.toUpperCase()}.`,
          'PAYMENT_SENT',
          { reference, txHash, amountUSDC, chain }
        );

        queue.remove(reference);
        console.log(`[CryptoWithdrawalProcessor] ✅ Withdrawal ${reference} CONFIRMED.`);
      } else {
        throw new Error(`Transaction ${txHash.slice(0, 20)}... not confirmed within timeout`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[CryptoWithdrawalProcessor] ❌ Withdrawal ${reference} failed (attempt ${attempts + 1}): ${errorMessage}`);

      if (!shouldRetry) {
        // Max retries exceeded — rollback balance
        ledgerService.rollbackWithdrawal(reference, userId, amountUSDC);
        console.error(`[CryptoWithdrawalProcessor] 🔄 Rolled back ${amountUSDC} USDC for ${reference}`);
      } else {
        console.warn(`[CryptoWithdrawalProcessor] 🔁 Will retry ${reference} (backoff: ${BACKOFF_MS[attempts]}ms)`);
        // Mark as still in-flight (do not rollback yet)
        ledgerService.updateWithdrawal(reference, {
          status: WithdrawalStatus.PENDING,
          failureReason: `Attempt ${attempts + 1} failed: ${errorMessage}`
        });
      }
    }
  }
}
