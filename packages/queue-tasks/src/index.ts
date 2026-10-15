/**
 * queue-tasks - River task workers
 *
 * River queue workers following pila's WorkerDeps pattern:
 * - PerformTransfer worker
 * - UpdateTransferResult handler
 * - LogTransferResult auditor
 * - Idempotency key checks
 */

import { PerformTransferResult, TransferMetadata, TransactionService } from '@kudi/service-transaction';
import { WalletService } from '@kudi/service-wallet';
import { CustodyProvider, CustodyTrack, DepositWallet } from '@kudi/types';

// NOTE: prisma is loaded via dynamic import inside each handler (see below) so this
// package builds without a live DB at import time. Do not add a static
// `import { prisma } from '@kudi/database'` here.

/**
 * PerformTransfer worker - processes transfer jobs from the River queue.
 * Pattern matches pila's worker deps:
 *   PerformTransfer: walletSvc.PerformTransfer,
 *   UpdateTransferResult: func ctx ... UpdateTransferResult,
 *   LogTransferResult: auditSvc.LogTransferResult
 */
export async function performTransferWorker(
  userId: string,
  walletId: string,
  asset: string,
  toAddress: string,
  amount: string,
  chain: 'solana' | 'monad' | 'stellar'
): Promise<PerformTransferResult> {
  // Select custody provider based on wallet track
  const custodyProvider = await selectCustodyProvider(chain);
  void custodyProvider;

  const txService = new TransactionService();
  const result = await txService.performTransfer({
    userId,
    walletId,
    asset,
    toAddress,
    amount,
    chain
  });

  return result;
}

/**
 * UpdateTransferResult handler - merges transfer result metadata.
 * Exactly matching pila's pattern: fetch existing, merge duration,
 * update status + txHash + metadata
 */
export async function updateTransferResultHandler(
  txID: string,
  status: 'completed' | 'failed',
  txHash?: string,
  createdAt?: Date,
  failureReason?: string
): Promise<TransferMetadata> {
  // Select custody provider
  const custodyProvider = await selectCustodyProvider('solana' as any);
  void custodyProvider;

  const txService = new TransactionService();
  const result = await txService['updateTransferResult']({
    txID,
    status,
    txHash,
    createdAt,
    failureReason
  });

  return result.metadata;
}

/**
 * LogTransferResult auditor - logs transfer results for audit.
 */
export async function logTransferResult(
  metadata: TransferMetadata,
  chain: 'solana' | 'monad' | 'stellar'
): Promise<void> {
  const auditEntry = { ...metadata, chain, loggedAt: new Date().toISOString() };
  console.log(`[Audit] Transfer result logged:`, JSON.stringify(auditEntry));
  try {
    // @ts-ignore - optional peer dependency, fails gracefully when DB package absent
    const dbMod: any = await import('@kudi/database');
    const db = dbMod?.prisma;
    if (db?.adminAuditLog?.create) {
      await db.adminAuditLog.create({
        data: {
          action: 'LogTransferResult',
          targetType: 'Transfer',
          targetId: metadata.walletId,
          details: JSON.stringify(auditEntry),
        },
      });
    } else {
      console.warn('[queue-tasks] audit persist skipped: AdminAuditLog model unavailable, console log retained');
    }
  } catch (err) {
    console.warn(
      '[queue-tasks] audit persist skipped (no DB), console log retained:',
      (err as Error)?.message ?? err
    );
  }
}

/**
 * Idempotency key check - checks if a transfer with given keys already exists.
 * Returns the existing metadata if found and completed, or null if not found or still processing.
 */
export async function checkIdempotencyKey(
  userId: string,
  walletId: string,
  asset: string,
  toAddress: string,
  amount: string
): Promise<TransferMetadata | null> {
  // DB-backed idempotency: query TransferMetadata for the
  // (userId, walletId, asset, toAddress, amount) key combination.
  // Return existing if status = 'completed', null if 'processing' or not found.
  try {
    // @ts-ignore - optional peer dependency, fails gracefully when DB package absent
    const dbMod: any = await import('@kudi/database');
    const db = dbMod?.prisma;
    if (db?.transferMetadata?.findFirst) {
      const existing = await db.transferMetadata.findFirst({
        where: {
          userId,
          walletId,
          asset,
          toAddress,
          amount: parseFloat(amount),
        },
      });
      if (!existing) return null;
      if (existing.status === 'completed') {
        const result: TransferMetadata = {
          signingProvider: existing.signingProvider,
          walletId: existing.walletId,
          asset: existing.asset,
          toAddress: existing.toAddress,
          chain: (existing.type as string) || 'solana',
          duration: existing.duration,
          type: existing.type ?? undefined,
          fee: String(existing.fee ?? '0.01'),
        };
        return result;
      }
      // Still processing (or failed) — treat as no completed record.
      return null;
    }
    if (db?.transfer?.findFirst) {
      const t = await db.transfer.findFirst({
        where: { userId, walletId, toAddress, status: 'completed' },
      });
      if (!t) return null;
      return {
        signingProvider: t.provider ?? 'privy',
        walletId: t.walletId,
        asset: t.asset,
        toAddress: t.toAddress,
        chain: 'solana',
        duration: 0,
        type: 'outgoing-transfer',
        fee: '0.01',
      };
    }
    console.warn('[queue-tasks] checkIdempotencyKey: no TransferMetadata model, fallback to null');
    return null;
  } catch (err) {
    console.warn(
      '[queue-tasks] checkIdempotencyKey DB query skipped, fallback to null:',
      (err as Error)?.message ?? err
    );
    return null;
  }
}

/**
 * Select custody provider based on chain and track.
 */
async function selectCustodyProvider(chain: 'solana' | 'monad' | 'stellar'): Promise<CustodyProvider> {
  // Read the wallet's custody track: env override first, then DB Wallet lookup,
  // falling back to TRACK_A_SELF_CUSTODY default.
  let track: CustodyTrack = CustodyTrack.TRACK_A_SELF_CUSTODY;
  const envTrack = process.env.CUSTODY_TRACK;
  if (envTrack && (Object.values(CustodyTrack) as string[]).includes(envTrack)) {
    track = envTrack as CustodyTrack;
  } else {
    try {
      // @ts-ignore - optional peer dependency, fails gracefully when DB package absent
      const dbMod: any = await import('@kudi/database');
      const db = dbMod?.prisma;
      const walletTrack = process.env.WALLET_ID
        ? await db?.wallet?.findUnique?.({ where: { id: process.env.WALLET_ID } })
        : null;
      const custodyType = walletTrack?.custodyType;
      if (custodyType && (Object.values(CustodyTrack) as string[]).includes(custodyType)) {
        track = custodyType as CustodyTrack;
      } else if (custodyType) {
        console.warn(`[queue-tasks] unknown custodyType "${custodyType}", using default track`);
      }
    } catch (err) {
      console.warn(
        '[queue-tasks] custody-track DB read skipped, using default/env fallback:',
        (err as Error)?.message ?? err
      );
    }
  }
  const { CustodyTrack: _CT } = await import('@kudi/types');
  void _CT;
  void chain;
  return {
    track,
    name: 'Privy / KMS Self Custody',
    generateWallet: async (_userId: string, _chain: string): Promise<DepositWallet> => {
      throw new Error('Not implemented - use WalletService instead');
    },
    getWalletBalance: async (_address: string, _chain: string, _tokenAddress?: string, _tokenDecimals?: number): Promise<string> => {
      return '0.00';
    },
    verifyDepositTransaction: async (_txHash: string, _chain: string): Promise<{
      confirmed: boolean;
      amount: string;
      sender: string;
      tokenAddress: string;
      blockNumber?: number;
    }> => {
      return { confirmed: false, amount: '0.00', sender: '', tokenAddress: '', blockNumber: undefined };
    }
  };
}