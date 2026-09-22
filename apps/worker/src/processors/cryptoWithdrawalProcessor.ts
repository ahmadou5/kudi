/**
 * Durable crypto withdrawal processor.
 *
 * The API creates Withdrawal rows after debiting the user's ledger. This worker
 * claims pending rows from the database, broadcasts from treasury, then marks
 * them confirmed or failed. No financial job state lives in process memory.
 */

import { SelfCustodyProvider } from '@kudi/chains';
import { WithdrawalStatus } from '@kudi/types';
import { prisma } from '@kudi/database';

const selfCustody = new SelfCustodyProvider();

interface PendingWithdrawalRow {
  id: string;
  reference: string;
  userId: string;
  amountUSDC: number;
  toAddress: string;
  chain: 'solana' | 'monad';
  attemptCount: number;
}

function treasuryWalletIdFor(chain: 'solana' | 'monad'): string {
  if (chain === 'monad') {
    return process.env.KUDI_EVM_TREASURY_WALLET_ID
      || process.env.KUDI_TREASURY_EVM_WALLET_ID
      || process.env.PRIVY_EVM_TREASURY_WALLET_ID
      || process.env.EVM_TREASURY_WALLET_ID
      || process.env.MONAD_TREASURY_WALLET_ID
      || process.env.PRIVY_TREASURY_WALLET_ID
      || process.env.KUDI_TREASURY_EVM_ADDRESS
      || '';
  }

  return process.env.KUDI_SOLANA_TREASURY_WALLET_ID
    || process.env.KUDI_TREASURY_SOLANA_WALLET_ID
    || process.env.PRIVY_SOLANA_TREASURY_WALLET_ID
    || process.env.SOLANA_TREASURY_WALLET_ID
    || process.env.PRIVY_TREASURY_WALLET_ID
    || process.env.KUDI_TREASURY_SOLANA_ADDRESS
    || '';
}

async function claimPendingWithdrawals(): Promise<PendingWithdrawalRow[]> {
  const rows: any[] = await prisma.$transaction(async (tx) => {
    const claimed: any[] = await tx.$queryRaw`
      SELECT id, reference, "userId", "amountUSDC", "toAddress", chain, "attemptCount"
      FROM "Withdrawal"
      WHERE status = 'PENDING'
        AND "nextAttemptAt" <= NOW()
      ORDER BY "createdAt" ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `;

    if (claimed.length === 0) return claimed;

    const references = claimed.map((row) => row.reference);
    await tx.$executeRaw`
      UPDATE "Withdrawal"
      SET status = 'PROCESSING',
          "attemptCount" = "attemptCount" + 1,
          "updatedAt" = NOW()
      WHERE reference = ANY(${references})
    `;

    return claimed;
  });

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    amountUSDC: Number(row.amountUSDC),
    toAddress: row.toAddress,
    chain: row.chain,
    attemptCount: Number(row.attemptCount || 0)
  }));
}

export async function recoverStaleProcessingWithdrawals(staleAfterMinutes = 5): Promise<number> {
  const recovered = await prisma.$executeRaw`
    UPDATE "Withdrawal"
    SET status = 'PENDING',
        "nextAttemptAt" = NOW(),
        "failureReason" = 'Recovered stale PROCESSING withdrawal with no tx hash',
        "updatedAt" = NOW()
    WHERE status = 'PROCESSING'
      AND "txHash" IS NULL
      AND "updatedAt" < NOW() - (${staleAfterMinutes} * INTERVAL '1 minute')
  `;

  if (recovered > 0) {
    console.warn(`[Worker CryptoWithdrawalProcessor] Recovered ${recovered} stale PROCESSING withdrawal(s).`);
  }

  return recovered;
}

async function markWithdrawal(reference: string, status: WithdrawalStatus, update: { txHash?: string; failureReason?: string; nextAttemptSeconds?: number } = {}): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Withdrawal"
    SET status = ${status},
        "txHash" = COALESCE(${update.txHash ?? null}, "txHash"),
        "failureReason" = ${update.failureReason ?? null},
        "nextAttemptAt" = CASE
          WHEN ${update.nextAttemptSeconds ?? null}::int IS NULL THEN "nextAttemptAt"
          ELSE NOW() + (${update.nextAttemptSeconds ?? 0} * INTERVAL '1 second')
        END,
        "updatedAt" = NOW()
    WHERE reference = ${reference}
  `;
}

async function recordWithdrawalReversal(job: PendingWithdrawalRow, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const latest: any[] = await tx.$queryRaw`
      SELECT "resultingBalanceUSDC"
      FROM "LedgerEntry"
      WHERE "userId" = ${job.userId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const initialBalance = latest.length ? Number(latest[0].resultingBalanceUSDC) : 0;

    await tx.$executeRaw`
      INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${job.userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
      ON CONFLICT ("userId", asset) DO NOTHING
    `;

    const rows: any[] = await tx.$queryRaw`
      SELECT "availableUSDC"
      FROM "BalanceAccount"
      WHERE "userId" = ${job.userId} AND asset = 'USDC'
      FOR UPDATE
    `;
    const currentBalance = rows.length ? Number(rows[0].availableUSDC) : initialBalance;
    const restoredBalance = currentBalance + job.amountUSDC;

    await tx.$executeRaw`
      UPDATE "BalanceAccount"
      SET "availableUSDC" = ${restoredBalance}, version = version + 1, "updatedAt" = NOW()
      WHERE "userId" = ${job.userId} AND asset = 'USDC'
    `;

    await tx.$executeRaw`
      INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
      VALUES (
        gen_random_uuid(),
        ${job.userId},
        'DEPOSIT_CREDIT',
        ${job.amountUSDC},
        ${restoredBalance},
        ${`rev_${job.reference}`},
        ${JSON.stringify({
          reference: job.reference,
          reason,
          type: 'CRYPTO_SEND_REVERSAL',
          title: 'Crypto Send Reversal',
          subtitle: 'Restored to Balance'
        })},
        NOW()
      )
      ON CONFLICT (type, "referenceId") DO NOTHING
    `;
  });
}

export async function processCryptoWithdrawals(): Promise<void> {
  const jobs = await claimPendingWithdrawals();
  if (jobs.length === 0) return;

  console.log(`[Worker CryptoWithdrawalProcessor] Found ${jobs.length} pending withdrawal(s).`);

  for (const job of jobs) {
    const attemptsAfterThisRun = job.attemptCount + 1;

    try {
      const treasuryWalletId = treasuryWalletIdFor(job.chain);
      const { txHash } = await selfCustody.sendCrypto({
        treasuryWalletId,
        toAddress: job.toAddress,
        amountUSDC: job.amountUSDC,
        chain: job.chain
      });

      await markWithdrawal(job.reference, WithdrawalStatus.BROADCAST, { txHash });
      const confirmed = await selfCustody.waitForConfirmation(txHash, job.chain);

      if (!confirmed) {
        throw new Error(`Transaction ${txHash} was not confirmed before timeout`);
      }

      await markWithdrawal(job.reference, WithdrawalStatus.CONFIRMED, { txHash });
      console.log(`[Worker CryptoWithdrawalProcessor] Confirmed withdrawal ${job.reference}: ${txHash}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Worker CryptoWithdrawalProcessor] Withdrawal ${job.reference} failed: ${message}`);

      if (attemptsAfterThisRun < 3) {
        const delay = attemptsAfterThisRun === 1 ? 15 : 45;
        await markWithdrawal(job.reference, WithdrawalStatus.PENDING, { failureReason: message, nextAttemptSeconds: delay });
        continue;
      }

      await markWithdrawal(job.reference, WithdrawalStatus.FAILED, { failureReason: message });
      await recordWithdrawalReversal(job, message);
    }
  }
}
