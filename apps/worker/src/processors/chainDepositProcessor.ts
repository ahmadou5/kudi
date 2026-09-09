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
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️ [Chain Processor] Error polling Solana RPC: ${msg}`);
    }
  }
}
