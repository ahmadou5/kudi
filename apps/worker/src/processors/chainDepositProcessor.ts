import { GeneralizedEVMListener, SolanaListener, EVMDepositEvent, SolanaDepositEvent } from '@kudi/chains';
import { EVMChainConfig } from '@kudi/types';

export class ChainDepositProcessor {
  private evmListener: GeneralizedEVMListener;
  private solanaListener: SolanaListener;
  private watchedAddresses: string[] = [
    '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    '0x1234567890abcdef1234567890abcdef12345678'
  ];

  constructor(monadConfig: EVMChainConfig) {
    this.evmListener = new GeneralizedEVMListener([monadConfig]);
    this.solanaListener = new SolanaListener();
  }

  public getSolanaConfig() {
    return this.solanaListener.getConfig();
  }

  public registerWatchAddress(address: string) {
    if (!this.watchedAddresses.includes(address)) {
      this.watchedAddresses.push(address);
    }
  }

  public async pollAllChains(): Promise<void> {
    const enabledEVMs = this.evmListener.getEnabledChains();

    for (const chain of enabledEVMs) {
      console.log(`🔗 [Chain Processor] Polling EVM RPC (${chain.name} - ${chain.rpcUrl})...`);
      try {
        const events: EVMDepositEvent[] = await this.evmListener.pollChainForDeposits(chain.id, this.watchedAddresses);
        for (const ev of events) {
          console.log(`✅ [Chain Processor] Confirmed EVM Deposit: ${ev.amountToken} ${chain.tokenSymbol} on ${chain.name} (Tx: ${ev.txHash})`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`⚠️ [Chain Processor] Error polling EVM chain ${chain.id}: ${msg}`);
      }
    }

    console.log(`🔗 [Chain Processor] Polling Solana SPL-Token RPC (${this.solanaListener.getConfig().usdcMintAddress})...`);
    try {
      const solEvents: SolanaDepositEvent[] = await this.solanaListener.pollSolanaForDeposits(this.watchedAddresses);
      for (const ev of solEvents) {
        console.log(`✅ [Chain Processor] Confirmed Solana Deposit: ${ev.amountUSDC} USDC (Signature: ${ev.signature})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️ [Chain Processor] Error polling Solana RPC: ${msg}`);
    }
  }
}
