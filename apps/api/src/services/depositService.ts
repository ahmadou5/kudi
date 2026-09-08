import { SolanaListener, EVMListener } from '@kudi/chains';
import { LedgerService } from './ledgerService';
import { SweepService } from './sweepService';
import { sendPushNotification } from '../lib/notifications';
import { Server as SocketIOServer } from 'socket.io';

export class DepositService {
  private solanaListener: SolanaListener;
  private evmListener: EVMListener;
  private ledgerService: LedgerService;
  private sweepService: SweepService;
  private io?: SocketIOServer;
  private intervalId?: NodeJS.Timeout;

  constructor(ledgerService: LedgerService, io?: SocketIOServer) {
    this.solanaListener = new SolanaListener();
    this.evmListener = new EVMListener();
    this.ledgerService = ledgerService;
    this.sweepService = new SweepService(ledgerService);
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
   * 1. For each registered user, finds their Solana wallet address
   * 2. Resolves their USDC SPL token account on-chain
   * 3. Scans recent transactions on that token account for incoming USDC
   * 4. Credits the off-chain ledger for each new deposit (idempotent via signature tracking)
   * 5. Notifies the client via Socket.io and Push Notification
   * 
   * Why off-chain ledger? Because "Spend to NGN bank" is a local payment API call —
   * the USDC stays on-chain untouched. The ledger tracks "available balance for spending"
   * separately from the raw on-chain balance.
   */
  public async checkDeposits(): Promise<{ scannedUsers: number; newDeposits: number }> {
    const users = this.ledgerService.getAllUsers();
    let scannedUsers = 0;
    let newDeposits = 0;

    for (const user of users) {
      const wallets = user.wallets || [];
      const solanaWallet = wallets.find(w => w.chain === 'solana');

      if (!solanaWallet?.address) continue;

      scannedUsers++;

      try {
        const events = await this.solanaListener.pollSolanaForDeposits([solanaWallet.address]);

        if (events.length === 0) {
          console.log(`[DepositService] No new deposits for user ${user.id} (${solanaWallet.address.slice(0, 8)}...)`);
        }

        for (const ev of events) {
          // Idempotency: skip signatures we already credited
          if (this.ledgerService.isSignatureProcessed(ev.signature)) {
            console.log(`[DepositService] Signature ${ev.signature.slice(0, 12)}... already processed, skipping.`);
            continue;
          }

          const amount = Number(ev.amountUSDC);
          if (amount <= 0) continue;

          console.log(
            `[DepositService] 💸 New deposit tx ${ev.signature.slice(0, 12)}...: ` +
            `+${amount} USDC → user ${user.id} (${solanaWallet.address.slice(0, 8)}...)`
          );

          // Mark as processed FIRST before crediting to prevent double-credit on crash/retry
          this.ledgerService.markSignatureProcessed(ev.signature);

          // Credit the off-chain ledger balance
          const newBal = this.ledgerService.creditUserBalance(user.id, amount, ev.signature, {
            chain: 'solana',
            walletAddress: solanaWallet.address,
            signature: ev.signature,
            slot: ev.slot
          });

          newDeposits++;

          console.log(`[DepositService] ✅ Balance updated for user ${user.id}: ${newBal.toFixed(6)} USDC`);

          // Sweep deposited USDC from user's deposit address to Kudi treasury
          // Fire-and-forget: ledger credit is already done; sweep failure falls back to float model
          const privyWalletId = (solanaWallet as any).metadata?.privyWalletId as string | undefined;
          this.sweepService.sweepToTreasury(solanaWallet.address, privyWalletId, amount)
            .then(sweep => {
              if (sweep.success) {
                console.log(`[DepositService] 🏦 Sweep successful: ${amount} USDC → treasury (${sweep.txHash?.slice(0, 12)}...)`);
              } else {
                console.warn(`[DepositService] ⚠️  Sweep skipped/failed: ${sweep.error} — float model applies`);
              }
            })
            .catch(err => console.warn('[DepositService] Sweep error:', err?.message));

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
        console.warn(`[DepositService] Error scanning wallet ${solanaWallet.address.slice(0, 8)}...:`, err);
      }
    }

    console.log(`[DepositService] Scan complete — ${scannedUsers} user(s) scanned, ${newDeposits} new deposit(s) credited.`);
    return { scannedUsers, newDeposits };
  }
}
