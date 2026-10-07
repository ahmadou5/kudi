/**
 * Durable crypto withdrawal processor.
 *
 * The API creates Withdrawal rows after debiting the user's ledger. This worker
 * claims pending rows from the database, broadcasts from treasury, then marks
 * them confirmed or failed. No financial job state lives in process memory.
 */

import { SelfCustodyProvider, resolveGasPaymentMode } from '@kudi/chains';
import { WithdrawalStatus } from '@kudi/types';
import { prisma } from '@kudi/database';

const selfCustody = new SelfCustodyProvider();

// DB sweep_config wins for gas mode (same shared resolver as the sweep paths);
// env vars are only the fallback. Never trust an unvalidated stored value.
async function getWithdrawalGasPaymentMode() {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: 'sweep_config' } });
    if (config?.value) {
      return resolveGasPaymentMode(JSON.parse(config.value).gasPaymentMode);
    }
  } catch (err) {
    console.warn('[Worker CryptoWithdrawalProcessor] Failed to read sweep_config gas mode:', err instanceof Error ? err.message : err);
  }
  return resolveGasPaymentMode(undefined);
}

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
    const revReference = `rev_${job.reference}`;

    // 1. Idempotency check: if reversal is already recorded, return immediately
    const existingRev: any[] = await tx.$queryRaw`
      SELECT id FROM "LedgerEntry"
      WHERE type = 'DEPOSIT_CREDIT' AND "referenceId" = ${revReference}
      LIMIT 1
    `;
    if (existingRev.length > 0) {
      console.log(`[Worker CryptoWithdrawalProcessor] Reversal ${revReference} already applied — skipping duplicate credit.`);
      return;
    }

    // 2. Matching debit check: ensure a SPEND_DEBIT was actually recorded for this reference
    const matchingDebit: any[] = await tx.$queryRaw`
      SELECT id FROM "LedgerEntry"
      WHERE type = 'SPEND_DEBIT' AND "referenceId" = ${job.reference}
      LIMIT 1
    `;
    if (matchingDebit.length === 0) {
      console.warn(`[Worker CryptoWithdrawalProcessor] ⚠️ Skipping reversal for ${job.reference}: original SPEND_DEBIT was never recorded in LedgerEntry.`);
      return;
    }

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
        ${revReference},
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
      const gasPaymentMode = await getWithdrawalGasPaymentMode();
      const treasuryAddr = job.chain === 'solana' 
        ? process.env.KUDI_TREASURY_SOLANA_ADDRESS 
        : process.env.KUDI_TREASURY_EVM_ADDRESS;
      const treasuryWalletId = treasuryWalletIdFor(job.chain);

      // Find user's target-chain wallet
      const userTargetWallet = await prisma.wallet.findFirst({
        where: {
          userId: job.userId,
          chain: job.chain === 'solana' ? 'solana' : { in: ['monad-testnet', 'monad', 'evm'] }
        }
      });

      const userTargetPrivyId = userTargetWallet?.privyWalletId || (userTargetWallet as any)?.metadata?.privyWalletId;
      const userTargetAddress = userTargetWallet?.address || '';

      // Check on-chain balance on target chain wallet
      let targetChainBalance = 0;
      if (userTargetAddress) {
        try {
          const tokenAddr = job.chain === 'solana'
            ? process.env.USDC_MINT_ADDRESS
            : process.env.AUSD_TOKEN_ADDRESS;
          const balStr = await selfCustody.getWalletBalance(userTargetAddress, job.chain, tokenAddr);
          targetChainBalance = parseFloat(balStr) || 0;
        } catch (balErr) {
          console.warn(`[Worker CryptoWithdrawalProcessor] ⚠️ Could not fetch live balance for ${userTargetAddress.slice(0, 8)}...:`, balErr instanceof Error ? balErr.message : balErr);
          targetChainBalance = job.amountUSDC; // Fallback to optimistic assumption
        }
      }

      let primaryTxHash = '';

      if (targetChainBalance >= job.amountUSDC || !userTargetPrivyId) {
        // CASE A: Single wallet has enough balance on target chain (or falling back to Treasury)
        const signingWalletId = userTargetPrivyId || treasuryWalletId;
        const depositWalletAddress = userTargetAddress || treasuryAddr || '';

        console.log(`[Worker CryptoWithdrawalProcessor] 📤 Single-wallet send: ${job.amountUSDC} USDC on ${job.chain} from ${depositWalletAddress.slice(0, 8)}... (${signingWalletId}) → ${job.toAddress.slice(0, 8)}...`);

        const { txHash } = await selfCustody.sendCrypto({
          treasuryWalletId: signingWalletId,
          fromAddress: depositWalletAddress,
          depositWalletId: depositWalletAddress,
          toAddress: job.toAddress,
          amountUSDC: job.amountUSDC,
          chain: job.chain,
          gasPaymentMode,
          idempotencyKey: job.reference,
          feeUSDC: Number(process.env.USDC_FEE || 0.01),
          feePayerAddress: treasuryAddr
        });
        primaryTxHash = txHash;
      } else {
        // CASE B: Target wallet balance is less than requested spend amount.
        // Execute Cross-Chain Netting via Privy:
        // 1. Send available balance from User's target-chain wallet to Recipient.
        // 2. Treasury sends remaining shortfall to Recipient on target chain.
        // 3. User's secondary chain wallet sends shortfall amount to Treasury on secondary chain.

        const userDirectAmount = Math.max(0, Math.floor(targetChainBalance * 100) / 100);
        const treasuryShortfall = Math.round((job.amountUSDC - userDirectAmount) * 100) / 100;

        console.log(`[Worker CryptoWithdrawalProcessor] 🔀 Multi-chain netting send for ${job.reference}: User Target Wallet has $${userDirectAmount}, Treasury covering $${treasuryShortfall}`);

        // Step 1: User target wallet sends available balance directly to Recipient
        if (userDirectAmount > 0) {
          try {
            const res1 = await selfCustody.sendCrypto({
              treasuryWalletId: userTargetPrivyId,
              fromAddress: userTargetAddress,
              depositWalletId: userTargetAddress,
              toAddress: job.toAddress,
              amountUSDC: userDirectAmount,
              chain: job.chain,
              gasPaymentMode,
              idempotencyKey: `${job.reference}_user_direct`,
              feeUSDC: Number(process.env.USDC_FEE || 0.01),
              feePayerAddress: treasuryAddr
            });
            console.log(`[Worker CryptoWithdrawalProcessor] ✅ Step 1 User Direct Send Tx: ${res1.txHash}`);
          } catch (e1) {
            console.warn(`[Worker CryptoWithdrawalProcessor] ⚠️ Step 1 User Direct Send warning:`, e1 instanceof Error ? e1.message : e1);
          }
        }

        // Step 2: Treasury sends shortfall to Recipient on target chain
        const res2 = await selfCustody.sendCrypto({
          treasuryWalletId,
          fromAddress: treasuryAddr || '',
          depositWalletId: treasuryAddr || '',
          toAddress: job.toAddress,
          amountUSDC: treasuryShortfall,
          chain: job.chain,
          gasPaymentMode,
          idempotencyKey: `${job.reference}_treasury_cover`,
          feeUSDC: Number(process.env.USDC_FEE || 0.01),
          feePayerAddress: treasuryAddr
        });
        primaryTxHash = res2.txHash;
        console.log(`[Worker CryptoWithdrawalProcessor] ✅ Step 2 Treasury Cover Send Tx: ${res2.txHash}`);

        // Step 3: Secondary chain wallet transfers shortfall to Treasury on secondary chain
        const secondaryChain = job.chain === 'solana' ? 'monad' : 'solana';
        const userSecondaryWallet = await prisma.wallet.findFirst({
          where: {
            userId: job.userId,
            chain: secondaryChain === 'solana' ? 'solana' : { in: ['monad-testnet', 'monad', 'evm'] }
          }
        });

        const userSecondaryPrivyId = userSecondaryWallet?.privyWalletId || (userSecondaryWallet as any)?.metadata?.privyWalletId;
        const secondaryTreasuryAddr = secondaryChain === 'solana'
          ? process.env.KUDI_TREASURY_SOLANA_ADDRESS
          : process.env.KUDI_TREASURY_EVM_ADDRESS;

        if (userSecondaryPrivyId && userSecondaryWallet?.address && secondaryTreasuryAddr) {
          try {
            const res3 = await selfCustody.sendCrypto({
              treasuryWalletId: userSecondaryPrivyId,
              fromAddress: userSecondaryWallet.address,
              depositWalletId: userSecondaryWallet.address,
              toAddress: secondaryTreasuryAddr,
              amountUSDC: treasuryShortfall,
              chain: secondaryChain as 'solana' | 'monad',
              gasPaymentMode,
              idempotencyKey: `${job.reference}_secondary_netting`,
              feeUSDC: Number(process.env.USDC_FEE || 0.01)
            });
            console.log(`[Worker CryptoWithdrawalProcessor] ✅ Step 3 Secondary Wallet Netting Tx: ${res3.txHash} (${treasuryShortfall} USDC on ${secondaryChain})`);
          } catch (e3) {
            console.warn(`[Worker CryptoWithdrawalProcessor] ⚠️ Step 3 Secondary Wallet Netting warning:`, e3 instanceof Error ? e3.message : e3);
          }
        }
      }

      await markWithdrawal(job.reference, WithdrawalStatus.BROADCAST, { txHash: primaryTxHash });
      const confirmed = await selfCustody.waitForConfirmation(primaryTxHash, job.chain);

      if (!confirmed) {
        throw new Error(`Transaction ${primaryTxHash} was not confirmed before timeout`);
      }

      await markWithdrawal(job.reference, WithdrawalStatus.CONFIRMED, { txHash: primaryTxHash });
      console.log(`[Worker CryptoWithdrawalProcessor] Confirmed withdrawal ${job.reference}: ${primaryTxHash}`);
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
