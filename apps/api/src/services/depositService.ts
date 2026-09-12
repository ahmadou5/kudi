import { SolanaListener, EVMListener } from '@kudi/chains';
import { EVMChainConfig, ChainType } from '@kudi/types';
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
            // Idempotency: skip signatures we already credited
            if (this.ledgerService.isSignatureProcessed(ev.signature)) {
              continue;
            }

            const amount = Number(ev.amountUSDC);
            if (amount <= 0) continue;

            console.log(
              `[DepositService] 💸 New Solana deposit tx ${ev.signature.slice(0, 12)}...: ` +
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
            const privyWalletId = (solanaWallet as any).metadata?.privyWalletId as string | undefined;
            this.sweepService.sweepToTreasury(solanaWallet.address, privyWalletId, amount)
              .then(sweep => {
                if (sweep.success) {
                  console.log(`[DepositService] 🏦 Sweep successful: ${amount} USDC → treasury (${sweep.txHash?.slice(0, 12)}...)`);
                } else {
                  console.warn(`[DepositService] ⚠️ Sweep skipped/failed: ${sweep.error} — float model applies`);
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
          console.warn(`[DepositService] Error scanning Solana wallet ${solanaWallet.address.slice(0, 8)}...:`, err);
        }
      }

      // 2. Monad EVM Deposit Polling
      if (monadWallet?.address && monadWallet.address.startsWith('0x')) {
        try {
          const evmEvents = await this.evmListener.pollChainForDeposits('monad-testnet', [monadWallet.address]);

          for (const ev of evmEvents) {
            if (this.ledgerService.isSignatureProcessed(ev.txHash)) {
              continue;
            }

            const amount = Number(ev.amountToken);
            if (amount <= 0) continue;

            console.log(
              `[DepositService] 💸 New Monad deposit tx ${ev.txHash.slice(0, 12)}...: ` +
              `+${amount} AUSD → user ${user.id} (${monadWallet.address.slice(0, 8)}...)`
            );

            this.ledgerService.markSignatureProcessed(ev.txHash);

            const newBal = this.ledgerService.creditUserBalance(user.id, amount, ev.txHash, {
              chain: 'monad',
              walletAddress: monadWallet.address,
              signature: ev.txHash,
              blockNumber: ev.blockNumber,
              tokenSymbol: 'AUSD'
            });

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
