import { SolanaListener, EVMListener, parseDepositAmount } from '@kudi/chains';
import { EVMChainConfig, ChainType } from '@kudi/types';
import { LedgerService } from './ledgerService';
import { sendPushNotification } from '../lib/notifications';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@kudi/database';

export class DepositService {
  private solanaListener: SolanaListener;
  private evmListener: EVMListener;
  private ledgerService: LedgerService;
  private io?: SocketIOServer;
  private intervalId?: NodeJS.Timeout;

  constructor(ledgerService: LedgerService, io?: SocketIOServer) {
    this.solanaListener = new SolanaListener();
    
    const monadConfig: EVMChainConfig = {
      id: 'monad-testnet',
      name: 'Monad Metropolis Testnet',
      chainId: 10143,
      type: ChainType.EVM,
      rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      tokenContractAddress: process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3',
      tokenSymbol: 'AUSD',
      tokenDecimals: 6,
      confirmationThreshold: 1,
      enabled: true
    };
    this.evmListener = new EVMListener([monadConfig]);

    this.ledgerService = ledgerService;
    this.io = io;
  }

  public setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  public startPolling(intervalMs: number = 10_000): void {
    if (this.intervalId) return;
    console.log(`[DepositService] 📡 Starting chain deposit monitoring (interval: ${intervalMs}ms)...`);

    // Immediately check on startup
    this.checkDeposits().catch(err => console.warn('[DepositService] Initial check error:', err));

    this.intervalId = setInterval(() => {
      this.checkDeposits().catch(err => console.warn('[DepositService] Polling error:', err));
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Transactional credit path (single DB transaction):
   * ProcessedSignature insert (idempotency) + BalanceAccount credit +
   * LedgerEntry insert + Deposit row insert all commit atomically. Returns
   * credited:false when the signature was already processed or the amount is
   * invalid. In-memory ledger sets are updated only as cache after commit —
   * the DB is the source of truth, so restarts can neither double-credit nor
   * credit-without-a-sweep-row.
   */
  private async creditDepositTransactionally(params: {
    userId: string;
    walletAddress: string;
    chain: string;
    tokenSymbol: string;
    rawAmount: unknown;
    signature: string;
    blockNumber?: number | null;
    sweepStatus: string;
    privyWalletId?: string | null;
  }): Promise<{ credited: boolean; newBalance: number; amount: number }> {
    const amount = parseDepositAmount(params.rawAmount);
    if (amount === null) {
      console.warn(`[DepositService] ⚠️ Rejected invalid deposit amount for ${params.signature.slice(0, 12)}...: ${String(params.rawAmount)}`);
      return { credited: false, newBalance: 0, amount: 0 };
    }

    let credited = false;
    let newBal = 0;

    await prisma.$transaction(async (tx) => {
      const inserted: Array<{ signature: string }> = await tx.$queryRaw`
        INSERT INTO "ProcessedSignature" (signature, "createdAt")
        VALUES (${params.signature}, NOW())
        ON CONFLICT (signature) DO NOTHING
        RETURNING signature
      `;
      if (inserted.length === 0) return;

      const latestLedger: any[] = await tx.$queryRaw`
        SELECT "resultingBalanceUSDC"
        FROM "LedgerEntry"
        WHERE "userId" = ${params.userId}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      const initialBalance = latestLedger.length ? Number(latestLedger[0].resultingBalanceUSDC) : 0;

      await tx.$executeRaw`
        INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${params.userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
        ON CONFLICT ("userId", asset) DO NOTHING
      `;

      const balanceRows: any[] = await tx.$queryRaw`
        SELECT "availableUSDC"
        FROM "BalanceAccount"
        WHERE "userId" = ${params.userId} AND asset = 'USDC'
        FOR UPDATE
      `;
      const currentBal = balanceRows.length ? Number(balanceRows[0].availableUSDC) : initialBalance;
      newBal = currentBal + amount;

      await tx.$executeRaw`
        UPDATE "BalanceAccount"
        SET "availableUSDC" = ${newBal}, version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = ${params.userId} AND asset = 'USDC'
      `;

      await tx.$executeRaw`
        INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
        VALUES (
          gen_random_uuid(),
          ${params.userId},
          'DEPOSIT_CREDIT',
          ${amount},
          ${newBal},
          ${params.signature},
          ${JSON.stringify({
            chain: params.chain,
            walletAddress: params.walletAddress,
            signature: params.signature,
            blockNumber: params.blockNumber ?? null,
            tokenSymbol: params.tokenSymbol,
            title: `${params.tokenSymbol} Deposit`,
            status: 'CONFIRMED'
          })},
          NOW()
        )
        ON CONFLICT (type, "referenceId") DO NOTHING
      `;

      await tx.$executeRaw`
        INSERT INTO "Deposit" (id, "userId", "walletAddress", chain, "tokenSymbol", "amountUSDC", signature, "blockNumber", "creditStatus", "sweepStatus", "privyWalletId", "sweepAttemptCount", "nextSweepAttemptAt", "creditedAt", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${params.userId},
          ${params.walletAddress},
          ${params.chain},
          ${params.tokenSymbol},
          ${amount},
          ${params.signature},
          ${params.blockNumber ?? null},
          'CREDITED',
          ${params.sweepStatus},
          ${params.privyWalletId ?? null},
          0,
          NOW(),
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (signature) DO NOTHING
      `;

      credited = true;
    });

    if (credited) {
      // Cache-only in-memory updates after the DB commit (source of truth).
      this.ledgerService.markSignatureProcessed(params.signature);
      this.ledgerService.setBalance(params.userId, newBal);
      this.ledgerService.recordTransaction({
        fromUserId: 'CHAIN_DEPOSIT',
        toUserId: params.userId,
        amount,
        currency: 'USDC',
        reference: params.signature,
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'DEPOSIT',
          chain: params.chain,
          walletAddress: params.walletAddress,
          signature: params.signature,
          blockNumber: params.blockNumber ?? null,
          tokenSymbol: params.tokenSymbol
        }
      });
    }

    return { credited, newBalance: newBal, amount };
  }

  /**
   * Manually trigger a deposit rescan immediately.
   * Used by the /deposits/rescan API endpoint for testing and debugging.
   */
  public async rescanNow(): Promise<{ scannedUsers: number; newDeposits: number }> {
    console.log('[DepositService] 🔄 Manual rescan triggered...');
    const result = await this.checkDeposits();
    return result;
  }

  /**
   * Core deposit processing engine:
   * 
   * 1. For each registered user, finds their Solana and Monad EVM wallet addresses
   * 2. Polls Solana SPL token accounts and Monad EVM ERC-20 log transfers
   * 3. Credits the off-chain ledger for each new deposit (idempotent via signature tracking)
   * 4. Notifies the client via Socket.io and Push Notification
   */
  public async checkDeposits(): Promise<{ scannedUsers: number; newDeposits: number }> {
    const users = this.ledgerService.getAllUsers();
    let scannedUsers = 0;
    let newDeposits = 0;

    for (const user of users) {
      const wallets = user.wallets || [];
      const solanaWallet = wallets.find(w => w.chain === 'solana');
      const monadWallet = wallets.find(w => w.chain.includes('monad') || w.chain === 'evm');

      if (!solanaWallet?.address && !monadWallet?.address) continue;

      scannedUsers++;

      // 1. Solana Deposit Polling
      if (solanaWallet?.address) {
        try {
          const events = await this.solanaListener.pollSolanaForDeposits([solanaWallet.address]);

          for (const ev of events) {
            // Confirmation gate: only finalized Solana deposits may be credited.
            // Unconfirmed events are skipped/logged, never credited.
            if (!ev.confirmed) {
              console.log(`[DepositService] ⏳ Skipping unconfirmed Solana deposit ${ev.signature.slice(0, 12)}... (status: ${ev.confirmationStatus ?? 'unknown'})`);
              continue;
            }

            // Idempotency: skip signatures we already credited (memory fast-path;
            // the DB transaction below is the authoritative guard)
            if (this.ledgerService.isSignatureProcessed(ev.signature)) {
              continue;
            }

            console.log(
              `[DepositService] 💸 New Solana deposit tx ${ev.signature.slice(0, 12)}...: ` +
              `+${ev.amountUSDC} USDC → user ${user.id} (${solanaWallet.address.slice(0, 8)}...)`
            );

            // Float-model wallets (mock / user-held) don't need sweeping — mark SWEEP_UNSUPPORTED
            const privyWalletId = (solanaWallet as any).privyWalletId || (solanaWallet as any).metadata?.privyWalletId as string | undefined;
            const isMockWallet = !!(solanaWallet as any).metadata?.mock || privyWalletId?.startsWith?.('mock_');

            // Single DB transaction: credit + Deposit insert + ProcessedSignature insert
            const { credited, newBalance, amount } = await this.creditDepositTransactionally({
              userId: user.id,
              walletAddress: solanaWallet.address,
              chain: 'solana',
              tokenSymbol: 'USDC',
              rawAmount: ev.amountUSDC,
              signature: ev.signature,
              blockNumber: ev.slot ?? null,
              sweepStatus: isMockWallet || !privyWalletId ? 'SWEEP_UNSUPPORTED' : 'SWEEP_PENDING',
              privyWalletId: privyWalletId ?? null
            });
            if (!credited) continue;
            const newBal = newBalance;

            newDeposits++;

            console.log(`[DepositService] ✅ Balance updated for user ${user.id}: ${newBal.toFixed(6)} USDC`);

            // Real-time notification via Socket.io
            if (this.io) {
              this.io.to(user.id).emit('deposit:received', {
                amountUSDC: amount,
                newBalanceUSDC: newBal,
                chain: 'solana',
                txHash: ev.signature
              });
            }

            // Push notification
            const pushToken = this.ledgerService.getUserPushToken(user.id);
            if (pushToken) {
              await sendPushNotification(pushToken, 'DEPOSIT_RECEIVED', {
                amountUSDC: amount,
                chain: 'Solana Devnet',
                newBalance: newBal
              }).catch(err => console.warn('[DepositService] Push notification failed:', err));
            }
          }
        } catch (err) {
          console.warn(`[DepositService] Error scanning Solana wallet ${solanaWallet.address.slice(0, 8)}...:`, err);
        }
      }

      // 2. Monad EVM Deposit Polling
      if (monadWallet?.address && monadWallet.address.startsWith('0x')) {
        try {
          const evmEvents = await this.evmListener.pollChainForDeposits('monad-testnet', [monadWallet.address]);

          for (const ev of evmEvents) {
            // Confirmation gate: only deposits at/above the chain threshold may
            // be credited. Unconfirmed logs are skipped/logged, never credited.
            if (!ev.confirmed) {
              console.log(`[DepositService] ⏳ Skipping unconfirmed Monad deposit ${ev.txHash.slice(0, 12)}... (block ${ev.blockNumber})`);
              continue;
            }

            if (this.ledgerService.isSignatureProcessed(ev.txHash)) {
              continue;
            }

            console.log(
              `[DepositService] 💸 New Monad deposit tx ${ev.txHash.slice(0, 12)}...: ` +
              `+${ev.amountToken} AUSD → user ${user.id} (${monadWallet.address.slice(0, 8)}...)`
            );

            // Write deposit record to DB with SWEEP_PENDING for the SweepWorkerService to pick up.
            const monadPrivyWalletId = (monadWallet as any).privyWalletId || (monadWallet as any).metadata?.privyWalletId as string | undefined;
            const isMockMonadWallet = !!(monadWallet as any).metadata?.mock || monadPrivyWalletId?.startsWith?.('mock_');

            const { credited, newBalance, amount } = await this.creditDepositTransactionally({
              userId: user.id,
              walletAddress: monadWallet.address,
              chain: 'monad',
              tokenSymbol: 'AUSD',
              rawAmount: ev.amountToken,
              signature: ev.txHash,
              blockNumber: ev.blockNumber ?? null,
              sweepStatus: isMockMonadWallet || !monadPrivyWalletId ? 'SWEEP_UNSUPPORTED' : 'SWEEP_PENDING',
              privyWalletId: monadPrivyWalletId ?? null
            });
            if (!credited) continue;
            const newBal = newBalance;

            newDeposits++;

            console.log(`[DepositService] ✅ Monad Balance updated for user ${user.id}: ${newBal.toFixed(6)} AUSD/USDC`);

            if (this.io) {
              this.io.to(user.id).emit('deposit:received', {
                amountUSDC: amount,
                newBalanceUSDC: newBal,
                chain: 'monad',
                txHash: ev.txHash
              });
            }

            const pushToken = this.ledgerService.getUserPushToken(user.id);
            if (pushToken) {
              await sendPushNotification(pushToken, 'DEPOSIT_RECEIVED', {
                amountUSDC: amount,
                chain: 'Monad Testnet',
                newBalance: newBal
              }).catch(err => console.warn('[DepositService] Push notification failed:', err));
            }
          }
        } catch (err) {
          console.warn(`[DepositService] Error scanning Monad EVM wallet ${monadWallet.address.slice(0, 8)}...:`, err);
        }
      }
    }

    console.log(`[DepositService] Scan complete — ${scannedUsers} user(s) scanned, ${newDeposits} new deposit(s) credited.`);
    return { scannedUsers, newDeposits };
  }
}
