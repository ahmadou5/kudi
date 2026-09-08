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
      usdcMintAddress: config?.usdcMintAddress || process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      confirmationThreshold: 1,
      enabled: true
    };
  }

  public getConfig(): SolanaChainConfig {
    return this.config;
  }

  /**
   * Gets the actual on-chain USDC balance for a wallet address.
   * Calls getTokenAccountsByOwner to find the USDC SPL token account
   * and reads its balance directly.
   */
  public async getSolanaUSDCBalance(address: string): Promise<number> {
    try {
      const res = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTokenAccountsByOwner',
          params: [address, { mint: this.config.usdcMintAddress }, { encoding: 'jsonParsed' }],
          id: 1
        })
      });
      const data = await res.json() as any;
      const accounts = data.result?.value || [];
      if (accounts.length > 0) {
        const tokenAmount = accounts[0].account?.data?.parsed?.info?.tokenAmount;
        return Number(tokenAmount?.uiAmountString || tokenAmount?.uiAmount || 0);
      }
    } catch (err) {
      console.warn(`[SolanaListener] Balance check failed for ${address}:`, err);
    }
    return 0;
  }

  /**
   * Resolves the USDC SPL token account address for a given wallet owner.
   * Returns null if no USDC token account exists yet (wallet has never received USDC).
   * 
   * Why we need this: On Solana, USDC is an SPL token. Each user has a separate
   * "token account" for USDC (different from their main wallet address). Deposit
   * transactions appear on the TOKEN account, not on the main wallet address.
   */
  private async getUSDCTokenAccountAddress(walletAddress: string): Promise<string | null> {
    try {
      const res = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: this.config.usdcMintAddress },
            { encoding: 'jsonParsed' }
          ],
          id: 1
        })
      });
      const data = await res.json() as any;
      const accounts: any[] = data.result?.value || [];
      if (accounts.length > 0) {
        return accounts[0].pubkey as string;
      }
    } catch (err) {
      console.warn(`[SolanaListener] Failed to get USDC token account for ${walletAddress}:`, err);
    }
    return null;
  }

  /**
   * Polls Solana for incoming USDC deposits to the given wallet addresses.
   * 
   * Correct flow:
   * 1. Resolve the USDC SPL token account for each watched wallet
   * 2. Get recent transaction signatures for that TOKEN account (not the wallet)
   * 3. For each signature, fetch the full transaction and compute the token balance delta
   * 4. Return events where delta > 0 (incoming USDC)
   */
  public async pollSolanaForDeposits(watchedAddresses: string[]): Promise<SolanaDepositEvent[]> {
    const events: SolanaDepositEvent[] = [];

    for (const walletAddress of watchedAddresses) {
      if (!walletAddress || walletAddress.length < 20) continue;

      try {
        // Step 1: Find the USDC token account for this wallet
        const tokenAccountAddress = await this.getUSDCTokenAccountAddress(walletAddress);

        if (!tokenAccountAddress) {
          // Wallet has no USDC token account yet — no deposits possible
          console.log(`[SolanaListener] No USDC token account found for wallet ${walletAddress.slice(0, 8)}... (wallet has never received USDC)`);
          continue;
        }

        console.log(`[SolanaListener] Scanning token account ${tokenAccountAddress.slice(0, 8)}... for wallet ${walletAddress.slice(0, 8)}...`);

        // Step 2: Get recent transaction signatures for the TOKEN account (not wallet address)
        const sigRes = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getSignaturesForAddress',
            params: [tokenAccountAddress, { limit: 25 }],
            id: 1
          })
        });

        const sigData = await sigRes.json() as any;
        const sigs: any[] = sigData.result || [];

        if (sigs.length === 0) {
          console.log(`[SolanaListener] No transactions found for token account ${tokenAccountAddress.slice(0, 8)}...`);
          continue;
        }

        console.log(`[SolanaListener] Found ${sigs.length} transactions on token account, checking for USDC deposits...`);

        // Step 3: Fetch and parse each transaction
        for (const sigInfo of sigs) {
          // Skip failed transactions
          if (sigInfo.err) continue;

          const txRes = await fetch(this.config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'getTransaction',
              params: [sigInfo.signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
              id: 2
            })
          });

          const txData = await txRes.json() as any;
          const tx = txData.result;
          if (!tx || !tx.meta) continue;

          const preBalances: any[] = tx.meta.preTokenBalances || [];
          const postBalances: any[] = tx.meta.postTokenBalances || [];

          // Find balance entries for our wallet's USDC token account
          // Match by owner (wallet address) AND mint (USDC mint)
          const pre = preBalances.find(
            (b: any) => b.owner === walletAddress && b.mint === this.config.usdcMintAddress
          );
          const post = postBalances.find(
            (b: any) => b.owner === walletAddress && b.mint === this.config.usdcMintAddress
          );

          // If no post balance found for this owner/mint, this tx isn't relevant
          if (!post) continue;

          const postAmount = post.uiTokenAmount?.uiAmount ?? 0;
          // pre may not exist if this was the first USDC receipt (account created in same tx)
          const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
          const diff = postAmount - preAmount;

          if (diff > 0) {
            console.log(`[SolanaListener] ✅ Incoming USDC deposit detected: +${diff} USDC | sig: ${sigInfo.signature.slice(0, 12)}...`);
            events.push({
              signature: sigInfo.signature,
              userWalletAddress: walletAddress,
              amountUSDC: diff.toFixed(6),
              slot: sigInfo.slot ?? tx.slot ?? 0,
              confirmed: true
            });
          } else if (diff < 0) {
            console.log(`[SolanaListener] ↩️ Outgoing transfer detected (${diff} USDC), skipping.`);
          }
        }
      } catch (err) {
        console.warn(`[SolanaListener] Polling failed for wallet ${walletAddress.slice(0, 8)}...:`, err);
      }
    }

    return events;
  }
}
