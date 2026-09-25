/**
 * SweepWorkerService — Persistent DB-Driven Sweep Retry Engine
 *
 * The original DepositService fired sweeps as fire-and-forget promises.
 * If Privy returned a 400 (stale blockhash, no gas, RPC hiccup), the sweep was
 * silently dropped and never retried. The Deposit table already has all the
 * tracking columns (sweepStatus, sweepAttemptCount, nextSweepAttemptAt, sweepError)
 * but nothing was reading them for automatic retries.
 *
 * This worker:
 *   1. Polls the Deposit table every POLL_INTERVAL_MS
 *   2. Picks up rows with sweepStatus IN ('SWEEP_PENDING','SWEEP_FAILED') where nextSweepAttemptAt <= NOW()
 *   3. Atomically marks them SWEEP_PROCESSING to prevent double-processing
 *   4. Calls sweepService.sweepToTreasury()
 *   5. On success → marks SWEPT
 *   6. On failure → increments attempt count, sets exponential backoff delay, marks SWEEP_FAILED
 *   7. After MAX_ATTEMPTS failures → marks SWEEP_BLOCKED for manual admin requeue
 *
 * Exponential backoff schedule:
 *   Attempt 1 failed → retry in  1 min
 *   Attempt 2 failed → retry in  2 min
 *   Attempt 3 failed → retry in  4 min
 *   Attempt 4 failed → retry in  8 min
 *   Attempt 5+ → SWEEP_BLOCKED (requires admin requeue)
 */

import { prisma } from '@kudi/database';
import { SweepService } from './sweepService';
import { LedgerService } from './ledgerService';

const POLL_INTERVAL_MS = 30_000;       // Check DB every 30 seconds
const MAX_ATTEMPTS = 5;                // Mark SWEEP_BLOCKED after this many failures
const BASE_BACKOFF_MIN = 1;            // Minimum backoff in minutes
const MAX_BACKOFF_MIN = 64;            // Maximum backoff cap in minutes
const CONCURRENCY = 3;                 // Max sweeps to process simultaneously

/** Classifies a Privy/RPC error as transient (retry) or permanent (block) */
function classifyError(errMsg: string): 'TRANSIENT' | 'PERMANENT' {
  const lower = errMsg.toLowerCase();

  // Permanent: insufficient funds / token balance issues — retrying won't help without human action
  if (
    lower.includes('insufficient funds') ||
    lower.includes('insufficient balance') ||
    lower.includes('account does not exist') ||
    lower.includes('self_custody_float_model')
  ) {
    return 'PERMANENT';
  }

  // Transient: network hiccups, stale blockhash, rate limits — will resolve on retry
  return 'TRANSIENT';
}

/** Compute next retry time using exponential backoff (capped) */
function computeNextRetryAt(attemptCount: number): Date {
  const delayMin = Math.min(BASE_BACKOFF_MIN * Math.pow(2, attemptCount - 1), MAX_BACKOFF_MIN);
  return new Date(Date.now() + delayMin * 60_000);
}

export class SweepWorkerService {
  private intervalId?: NodeJS.Timeout;
  private sweepService: SweepService;
  private isRunning = false;

  constructor(ledgerService: LedgerService) {
    this.sweepService = new SweepService(ledgerService);
  }

  public start(): void {
    if (this.intervalId) return;
    console.log(
      `[SweepWorker] 🚀 Starting sweep retry worker (interval: ${POLL_INTERVAL_MS / 1000}s, max attempts: ${MAX_ATTEMPTS})`
    );

    // Run immediately on start, then on interval
    this.processPendingSweeps().catch((err) =>
      console.error('[SweepWorker] Initial sweep run error:', err?.message || err)
    );

    this.intervalId = setInterval(() => {
      this.processPendingSweeps().catch((err) =>
        console.error('[SweepWorker] Periodic sweep run error:', err?.message || err)
      );
    }, POLL_INTERVAL_MS);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[SweepWorker] ⏹ Sweep worker stopped.');
    }
  }

  /**
   * Core worker loop — atomically claims pending deposits and processes them.
   */
  private async processPendingSweeps(): Promise<void> {
    if (this.isRunning) {
      console.log('[SweepWorker] Previous run still in progress — skipping tick.');
      return;
    }

    this.isRunning = true;
    try {
      // Atomically claim pending deposits → SWEEP_PROCESSING to prevent double-execution
      const claimed: Array<{
        id: string;
        userId: string;
        signature: string;
        walletAddress: string;
        chain: string;
        amountUSDC: number;
        sweepAttemptCount: number;
        privyWalletId?: string | null;
      }> = await prisma.$queryRaw`
        UPDATE "Deposit"
        SET "sweepStatus" = 'SWEEP_PROCESSING',
            "updatedAt" = NOW()
        WHERE id IN (
          SELECT id FROM "Deposit"
          WHERE "sweepStatus" IN ('SWEEP_PENDING', 'SWEEP_FAILED')
            AND "nextSweepAttemptAt" <= NOW()
          ORDER BY "nextSweepAttemptAt" ASC
          LIMIT ${CONCURRENCY}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING
          id, "userId", signature, "walletAddress", chain, "amountUSDC",
          "sweepAttemptCount", "privyWalletId"
      `;

      if (!claimed || claimed.length === 0) return;

      console.log(`[SweepWorker] 🔄 Processing ${claimed.length} pending sweep(s)...`);

      await Promise.allSettled(
        claimed.map((deposit) => this.processSingleSweep(deposit))
      );
    } catch (err: any) {
      console.error('[SweepWorker] ❌ Error during sweep processing loop:', err?.message || err);
    } finally {
      this.isRunning = false;
    }
  }

  private async processSingleSweep(deposit: {
    id: string;
    userId: string;
    signature: string;
    walletAddress: string;
    chain: string;
    amountUSDC: number;
    sweepAttemptCount: number;
    privyWalletId?: string | null;
  }): Promise<void> {
    const newAttemptCount = Number(deposit.sweepAttemptCount) + 1;
    const chain = (deposit.chain.toLowerCase().includes('monad') || deposit.chain === 'evm')
      ? 'monad'
      : 'solana';

    console.log(
      `[SweepWorker] 🔄 Sweep attempt #${newAttemptCount} for deposit ${deposit.signature.slice(0, 12)}... ` +
      `(${deposit.amountUSDC} USDC on ${chain.toUpperCase()}, user ${deposit.userId})`
    );

    let effectivePrivyWalletId = deposit.privyWalletId ?? undefined;
    if (!effectivePrivyWalletId) {
      try {
        const walletRecord = await prisma.wallet.findFirst({
          where: { address: deposit.walletAddress }
        });
        if (walletRecord?.privyWalletId) {
          effectivePrivyWalletId = walletRecord.privyWalletId;
          await prisma.deposit.update({
            where: { id: deposit.id },
            data: { privyWalletId: effectivePrivyWalletId }
          }).catch(() => {});
        }
      } catch {}
    }

    try {
      const result = await this.sweepService.sweepToTreasury(
        deposit.walletAddress,
        effectivePrivyWalletId,
        Number(deposit.amountUSDC),
        chain
      );

      if (result.success) {
        await prisma.$executeRaw`
          UPDATE "Deposit"
          SET "sweepStatus" = 'SWEPT',
              "sweepTxHash" = ${result.txHash ?? null},
              "sweepAttemptCount" = ${newAttemptCount},
              "sweepError" = NULL,
              "sweptAt" = NOW(),
              "updatedAt" = NOW()
          WHERE id = ${deposit.id}
        `;
        console.log(
          `[SweepWorker] ✅ SWEPT deposit ${deposit.signature.slice(0, 12)}... | TxHash: ${result.txHash}`
        );
      } else {
        const errMsg = result.error || 'Unknown sweep error';
        const errorType = classifyError(errMsg);

        if (errorType === 'PERMANENT' || newAttemptCount >= MAX_ATTEMPTS) {
          await prisma.$executeRaw`
            UPDATE "Deposit"
            SET "sweepStatus" = 'SWEEP_BLOCKED',
                "sweepError" = ${errMsg.slice(0, 1000)},
                "sweepAttemptCount" = ${newAttemptCount},
                "updatedAt" = NOW()
            WHERE id = ${deposit.id}
          `;
          console.warn(
            `[SweepWorker] 🚫 SWEEP_BLOCKED deposit ${deposit.signature.slice(0, 12)}... ` +
            `after ${newAttemptCount} attempt(s) — Error: ${errMsg.slice(0, 200)}`
          );
        } else {
          const nextRetry = computeNextRetryAt(newAttemptCount);
          await prisma.$executeRaw`
            UPDATE "Deposit"
            SET "sweepStatus" = 'SWEEP_FAILED',
                "sweepError" = ${errMsg.slice(0, 1000)},
                "sweepAttemptCount" = ${newAttemptCount},
                "nextSweepAttemptAt" = ${nextRetry},
                "updatedAt" = NOW()
            WHERE id = ${deposit.id}
          `;
          console.warn(
            `[SweepWorker] ⏳ SWEEP_FAILED — will retry at ${nextRetry.toISOString()} ` +
            `(attempt ${newAttemptCount}/${MAX_ATTEMPTS}) — ${errMsg.slice(0, 100)}`
          );
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errorType = classifyError(errMsg);

      if (errorType === 'PERMANENT' || newAttemptCount >= MAX_ATTEMPTS) {
        await prisma.$executeRaw`
          UPDATE "Deposit"
          SET "sweepStatus" = 'SWEEP_BLOCKED',
              "sweepError" = ${errMsg.slice(0, 1000)},
              "sweepAttemptCount" = ${newAttemptCount},
              "updatedAt" = NOW()
          WHERE id = ${deposit.id}
        `;
        console.error(
          `[SweepWorker] 🚫 SWEEP_BLOCKED (exception) deposit ${deposit.signature.slice(0, 12)}... — ${errMsg.slice(0, 200)}`
        );
      } else {
        const nextRetry = computeNextRetryAt(newAttemptCount);
        await prisma.$executeRaw`
          UPDATE "Deposit"
          SET "sweepStatus" = 'SWEEP_FAILED',
              "sweepError" = ${errMsg.slice(0, 1000)},
              "sweepAttemptCount" = ${newAttemptCount},
              "nextSweepAttemptAt" = ${nextRetry},
              "updatedAt" = NOW()
          WHERE id = ${deposit.id}
        `;
        console.error(
          `[SweepWorker] ❌ Sweep exception — retry at ${nextRetry.toISOString()} ` +
          `(attempt ${newAttemptCount}/${MAX_ATTEMPTS}): ${errMsg.slice(0, 150)}`
        );
      }
    }
  }

  /**
   * Returns a snapshot of the current sweep queue health.
   * Used for admin monitoring.
   */
  public async getQueueHealth(): Promise<{
    pending: number;
    failed: number;
    blocked: number;
    swept: number;
    processing: number;
  }> {
    const rows: Array<{ sweepStatus: string; count: string }> = await prisma.$queryRaw`
      SELECT "sweepStatus", COUNT(*)::int AS count
      FROM "Deposit"
      GROUP BY "sweepStatus"
    `;

    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.sweepStatus] = Number(r.count);
    }

    return {
      pending: counts['SWEEP_PENDING'] ?? 0,
      failed: counts['SWEEP_FAILED'] ?? 0,
      blocked: counts['SWEEP_BLOCKED'] ?? 0,
      swept: counts['SWEPT'] ?? 0,
      processing: counts['SWEEP_PROCESSING'] ?? 0,
    };
  }
}
