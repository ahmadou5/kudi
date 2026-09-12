import { GeneralizedEVMListener, SolanaListener, EVMDepositEvent, SolanaDepositEvent } from '@kudi/chains';
import { EVMChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';

export class ChainDepositProcessor {
  private evmListener: GeneralizedEVMListener;
  private solanaListener: SolanaListener;
  private watchedEvmAddresses: string[] = [];
  private watchedSolanaAddresses: string[] = [];

  constructor(monadConfig: EVMChainConfig) {
    this.evmListener = new GeneralizedEVMListener([monadConfig]);
    this.solanaListener = new SolanaListener();
  }

  public getSolanaConfig() {
    return this.solanaListener.getConfig();
  }

  public registerWatchAddress(address: string) {
    if (!address) return;
    if (address.startsWith('0x')) {
      if (!this.watchedEvmAddresses.includes(address)) {
        this.watchedEvmAddresses.push(address);
      }
    } else {
      if (!this.watchedSolanaAddresses.includes(address)) {
        this.watchedSolanaAddresses.push(address);
      }
    }
  }

  /**
   * Fetches all registered user deposit addresses directly from Neon DB.
   */
  private async getActiveAddresses(): Promise<{ evm: string[]; solana: string[] }> {
    const evmSet = new Set<string>(this.watchedEvmAddresses);
    const solanaSet = new Set<string>(this.watchedSolanaAddresses);

    try {
      const wallets = await prisma.wallet.findMany({
        select: { address: true, chain: true }
      });
      for (const w of wallets) {
        if (!w.address) continue;
        if (w.chain === 'solana' || !w.address.startsWith('0x')) {
          solanaSet.add(w.address);
        } else {
          evmSet.add(w.address);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChainDepositProcessor] Could not fetch wallets from Neon DB: ${msg}`);
    }

    return {
      evm: Array.from(evmSet),
      solana: Array.from(solanaSet)
    };
  }

  public async pollAllChains(): Promise<void> {
    const { evm: evmAddresses, solana: solanaAddresses } = await this.getActiveAddresses();
    const enabledEVMs = this.evmListener.getEnabledChains();

    for (const chain of enabledEVMs) {
      if (evmAddresses.length === 0) {
        console.log(`🔗 [Chain Processor] No EVM user deposit addresses registered in DB.`);
        continue;
      }
      console.log(`🔗 [Chain Processor] Polling EVM RPC (${chain.name} - ${chain.rpcUrl}) for ${evmAddresses.length} wallet(s)...`);
      try {
        const events: EVMDepositEvent[] = await this.evmListener.pollChainForDeposits(chain.id, evmAddresses);
        for (const ev of events) {
          console.log(`✅ [Chain Processor] Confirmed EVM Deposit: ${ev.amountToken} ${chain.tokenSymbol} on ${chain.name} (Tx: ${ev.txHash})`);
          await this.processDepositEvent({
            address: ev.userWalletAddress,
            amountUSDC: Number(ev.amountToken),
            signature: ev.txHash,
            chain: chain.id,
            tokenSymbol: chain.tokenSymbol,
            blockNumber: ev.blockNumber
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`⚠️ [Chain Processor] Error polling EVM chain ${chain.id}: ${msg}`);
      }
    }

    if (solanaAddresses.length === 0) {
      console.log(`🔗 [Chain Processor] No Solana user deposit addresses registered in DB.`);
      return;
    }

    console.log(`🔗 [Chain Processor] Polling Solana SPL-Token RPC (${this.solanaListener.getConfig().usdcMintAddress}) for ${solanaAddresses.length} wallet(s)...`);
    try {
      const solEvents: SolanaDepositEvent[] = await this.solanaListener.pollSolanaForDeposits(solanaAddresses);
      for (const ev of solEvents) {
        console.log(`✅ [Chain Processor] Confirmed Solana Deposit: ${ev.amountUSDC} USDC (Signature: ${ev.signature})`);
        await this.processDepositEvent({
          address: ev.userWalletAddress,
          amountUSDC: Number(ev.amountUSDC),
          signature: ev.signature,
          chain: 'solana',
          tokenSymbol: 'USDC'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️ [Chain Processor] Error polling Solana RPC: ${msg}`);
    }
  }

  /**
   * Processes deposit event: checks idempotency, credits LedgerEntry in Neon DB, and sends notification.
   */
  private async processDepositEvent(params: {
    address: string;
    amountUSDC: number;
    signature: string;
    chain: string;
    tokenSymbol: string;
    blockNumber?: number;
  }): Promise<void> {
    if (!params.signature || params.amountUSDC <= 0) return;

    try {
      // 1. Idempotency check: skip signatures already processed in DB
      const existingSig = await prisma.processedSignature.findUnique({
        where: { signature: params.signature }
      });
      if (existingSig) {
        return;
      }

      // 2. Resolve wallet owner in Neon DB
      const searchAddresses = params.address.startsWith('0x')
        ? [params.address, params.address.toLowerCase()]
        : [params.address];

      const wallet = await prisma.wallet.findFirst({
        where: {
          address: { in: searchAddresses }
        }
      });

      if (!wallet) {
        console.warn(`[Chain Processor] ⚠️ No registered user found for deposit address ${params.address}`);
        return;
      }

      // 3. Mark signature as processed in Neon DB
      await prisma.processedSignature.create({
        data: { signature: params.signature }
      });

      // 4. Compute user's latest balance from DB
      const latestLedger = await prisma.ledgerEntry.findFirst({
        where: { userId: wallet.userId },
        orderBy: { createdAt: 'desc' }
      });

      const currentBal = latestLedger ? Number(latestLedger.resultingBalanceUSDC) : 0;
      const newBal = currentBal + params.amountUSDC;

      // 5. Create LedgerEntry in Neon DB
      await prisma.ledgerEntry.create({
        data: {
          userId: wallet.userId,
          type: 'DEPOSIT_CREDIT',
          amountUSDC: params.amountUSDC,
          resultingBalanceUSDC: newBal,
          referenceId: params.signature,
          metadata: JSON.stringify({
            chain: params.chain,
            walletAddress: params.address,
            signature: params.signature,
            tokenSymbol: params.tokenSymbol,
            blockNumber: params.blockNumber,
            title: `${params.tokenSymbol} Deposit`,
            subtitle: `${params.chain.toUpperCase()} Network`
          })
        }
      });

      // 6. Create Notification in Neon DB
      await prisma.notification.create({
        data: {
          userId: wallet.userId,
          title: 'Deposit Received 💰',
          body: `You received ${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} into your Kudi wallet balance.`,
          type: 'PAYMENT_RECEIVED',
          data: JSON.stringify({
            amountUSDC: params.amountUSDC,
            chain: params.chain,
            txHash: params.signature,
            reference: params.signature
          })
        }
      });

      console.log(`[Chain Processor] 🐘 Successfully credited +${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} to user ${wallet.userId} in Neon DB (New Balance: $${newBal.toFixed(2)} USDC)`);

      // 7. Dispatch Expo Push Notification to user's mobile device
      try {
        const user = await prisma.user.findUnique({
          where: { id: wallet.userId },
          select: { expoPushToken: true }
        });

        if (user?.expoPushToken) {
          await sendExpoPushNotification(
            user.expoPushToken,
            'Deposit Received 💰',
            `You received ${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} into your Kudi wallet balance.`,
            {
              amountUSDC: params.amountUSDC,
              chain: params.chain,
              txHash: params.signature,
              type: 'DEPOSIT_RECEIVED'
            }
          );
        }
      } catch (pushErr: unknown) {
        console.warn(`[Chain Processor] Push notification error:`, pushErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Chain Processor] ⚠️ Error writing deposit ${params.signature} to Neon DB: ${msg}`);
    }
  }
}

/**
 * Helper function to dispatch Expo Push Notifications via HTTPS REST API.
 */
async function sendExpoPushNotification(pushToken: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
  if (!pushToken || typeof pushToken !== 'string') return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {}
      })
    });

    const resData = await response.json();
    console.log(`[Push Engine] 📲 Push notification dispatched to ${pushToken.slice(0, 25)}...:`, resData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Push Engine] ⚠️ Error dispatching push notification: ${msg}`);
  }
}
