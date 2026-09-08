import { SolanaChainConfig, ChainType } from '@kudi/types';

export interface SolanaDepositEvent {
  signature: string;
  userWalletAddress: string;
  amountUSDC: string;
  slot: number;
  confirmed: boolean;
}

export class SolanaListener {
  private config: SolanaChainConfig;

  constructor(config?: Partial<SolanaChainConfig>) {
    this.config = {
      id: 'solana-devnet',
      name: 'Solana Devnet',
      type: ChainType.SOLANA,
      rpcUrl: config?.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      usdcMintAddress: config?.usdcMintAddress || process.env.SOLANA_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      confirmationThreshold: 1,
      enabled: true
    };
  }

  public getConfig(): SolanaChainConfig {
    return this.config;
  }

  public async pollSolanaForDeposits(watchedAddresses: string[]): Promise<SolanaDepositEvent[]> {
    const events: SolanaDepositEvent[] = [];

    for (const address of watchedAddresses) {
      if (address.startsWith('Soluser_') || address.startsWith('Sol')) {
        // Skip mock testnet addresses or return empty
        continue;
      }

      try {
        const res = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getSignaturesForAddress',
            params: [address, { limit: 10 }],
            id: 1
          })
        });

        const data = await res.json();
        const sigs = data.result || [];

        for (const sigInfo of sigs) {
          if (sigInfo.err) continue;

          const txRes = await fetch(this.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'getTransaction',
              params: [sigInfo.signature, { encoding: 'jsonParsed', commitment: 'confirmed' }],
              id: 2
            })
          });

          const txData = await txRes.json();
          const tx = txData.result;
          if (!tx || !tx.meta) continue;

          const preBalances = tx.meta.preTokenBalances || [];
          const postBalances = tx.meta.postTokenBalances || [];

          // Find post balances for the watched address and configured mint
          const post = postBalances.find(
            (b: any) => b.owner === address && b.mint === this.config.usdcMintAddress
          );
          const pre = preBalances.find(
            (b: any) => b.owner === address && b.mint === this.config.usdcMintAddress
          );

          const postAmount = post?.uiTokenAmount?.uiAmount || 0;
          const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
          const diff = postAmount - preAmount;

          if (diff > 0) {
            events.push({
              signature: sigInfo.signature,
              userWalletAddress: address,
              amountUSDC: diff.toFixed(2),
              slot: sigInfo.slot || tx.slot || 0,
              confirmed: true
            });
          }
        }
      } catch (err) {
        console.warn(`Solana polling failed for address ${address}:`, err);
      }
    }

    return events;
  }
}
