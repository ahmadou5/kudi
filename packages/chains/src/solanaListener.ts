import { SolanaChainConfig, ChainType } from '@kudi/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


export interface SolanaDepositEvent {
  signature: string;
  userWalletAddress: string;
  amountUSDC: string;
  slot: number;
  /**
   * True only when the transaction reached the `finalized` commitment level.
   * Credit paths must gate on this — never credit when false.
   */
  confirmed: boolean;
  /** Raw Solana confirmation status (`finalized` | `confirmed` | `processed`). */
  confirmationStatus?: string;
}

export class SolanaListener {
  private config: SolanaChainConfig;

  constructor(config?: Partial<SolanaChainConfig>) {
    this.config = {
      id: 'solana-devnet',
      name: 'Solana Devnet',
      type: ChainType.SOLANA,
      rpcUrl: config?.rpcUrl || 'https://api.devnet.solana.com',
      usdcMintAddress: config?.usdcMintAddress || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
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


  private async getTransactionWithRetry(signature: string): Promise<any | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const txRes = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTransaction',
          // finalized: only credit-grade transactions are returned for deposits
          params: [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }],
          id: 2
        })
      });

      const txData = await txRes.json() as any;
      if (!txData.error) {
        await sleep(Number(process.env.SOLANA_TX_FETCH_DELAY_MS || 150));
        return txData.result || null;
      }

      const isRateLimited = txData.error?.code === 429;
      console.warn(
        `[SolanaListener] getTransaction failed for ${signature.slice(0, 12)}...${isRateLimited ? ' (rate limited; retrying)' : ''}:`,
        txData.error
      );
      if (!isRateLimited) return null;
      await sleep(500 * (attempt + 1));
    }

    return null;
  }

  /**
   * Reads live confirmation statuses in ONE batched RPC call (up to 256
   * signatures) with retry/backoff. Returns a map signature → status string.
   * Unknown/failed entries resolve to null (fail closed — not credited), but a
   * total RPC failure after retries returns null for the whole batch so the
   * caller can distinguish "unknown" from "checked and unfinalized".
   *
   * Why batched: per-signature status calls multiply RPC pressure (poll ×
   * wallets × signatures) and public endpoints 429, which fail-closed into
   * "listener hears nothing". One call per wallet per poll stays far under limits.
   */
  private async getConfirmationStatuses(signatures: string[]): Promise<Map<string, string | null> | null> {
    const out = new Map<string, string | null>();
    if (signatures.length === 0) return out;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(this.config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getSignatureStatuses',
            params: [signatures, { searchTransactionHistory: true }],
            id: 3
          })
        });
        const data = await res.json() as any;
        if (data.error) {
          const code = data.error?.code;
          console.warn(`[SolanaListener] getSignatureStatuses RPC error (attempt ${attempt + 1}/3):`, data.error);
          if (code === 429) {
            await sleep(750 * (attempt + 1));
            continue;
          }
          return null;
        }
        const values: any[] = data.result?.value || [];
        values.forEach((status, i) => {
          if (!status || status.err) {
            out.set(signatures[i], null);
          } else {
            out.set(signatures[i], typeof status.confirmationStatus === 'string' ? status.confirmationStatus : null);
          }
        });
        return out;
      } catch (err) {
        console.warn(`[SolanaListener] getSignatureStatuses fetch failed (attempt ${attempt + 1}/3):`, err instanceof Error ? err.message : err);
        await sleep(500 * (attempt + 1));
      }
    }
    console.warn(`[SolanaListener] getSignatureStatuses exhausted retries for ${signatures.length} signature(s) — treating as unknown.`);
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
  public async pollSolanaForDeposits(watchedAddresses: string[], processedSignatures: Set<string> = new Set()): Promise<SolanaDepositEvent[]> {
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

        // Step 2: Get recent transaction signatures for both the TOKEN account and owner wallet.
        // The token account is the normal path; the owner fallback catches first-time ATA creation flows.
        const signatureMap = new Map<string, any>();
        let fetchFailed = false;
        for (const addressToScan of [tokenAccountAddress, walletAddress]) {
          try {
            const sigRes = await fetch(this.config.rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'getSignaturesForAddress',
                params: [addressToScan, { limit: 25, commitment: 'finalized' }],
                id: 1
              })
            });

            const sigData = await sigRes.json() as any;
            if (sigData.error) {
              fetchFailed = true;
              console.warn(`[SolanaListener] getSignaturesForAddress failed for ${addressToScan.slice(0, 8)}...:`, sigData.error);
              continue;
            }

            for (const sigInfo of sigData.result || []) {
              if (sigInfo?.signature) signatureMap.set(sigInfo.signature, sigInfo);
            }
          } catch (err) {
            fetchFailed = true;
            console.warn(`[SolanaListener] getSignaturesForAddress fetch failed for ${addressToScan.slice(0, 8)}...:`, err instanceof Error ? err.message : err);
          }
        }

        const sigs: any[] = Array.from(signatureMap.values())
          .filter((sigInfo) => sigInfo?.signature && !processedSignatures.has(sigInfo.signature))
          .slice(0, Number(process.env.SOLANA_MAX_TX_FETCH_PER_WALLET || 8));

        if (sigs.length === 0) {
          console.log(
            `[SolanaListener] No unprocessed transactions for wallet ${walletAddress.slice(0, 8)}... ` +
            `(${signatureMap.size} seen${fetchFailed ? ', RPC fetch PARTIALLY FAILED — may have missed new deposits, will retry' : ', all already processed'})`
          );
          continue;
        }

        console.log(`[SolanaListener] Found ${signatureMap.size} unique transactions (${sigs.length} unprocessed this poll), checking for USDC deposits...`);

        // Step 3: Fetch and parse each transaction, collecting incoming
        // candidates first so Step 4 can status-check them in ONE batched call.
        const candidates: Array<{ sigInfo: any; diff: number }> = [];
        for (const sigInfo of sigs) {
          // Skip failed transactions
          if (sigInfo.err) continue;

          const tx = await this.getTransactionWithRetry(sigInfo.signature);
          if (!tx || !tx.meta) continue;

          const preBalances: any[] = tx.meta.preTokenBalances || [];
          const postBalances: any[] = tx.meta.postTokenBalances || [];
          const accountKeys: any[] = tx.transaction?.message?.accountKeys || [];

          const getPubkey = (idx: number): string => {
            const k = accountKeys[idx];
            if (!k) return '';
            return typeof k === 'string' ? k : (k.pubkey || '');
          };

          const isMatchingBalance = (b: any) => {
            const pubkeyMatches = getPubkey(b.accountIndex) === tokenAccountAddress;
            const ownerMatches = b.owner === walletAddress;
            const mintMatches = !b.mint || b.mint === this.config.usdcMintAddress;
            return (pubkeyMatches || ownerMatches) && mintMatches;
          };

          const pre = preBalances.find(isMatchingBalance);
          const post = postBalances.find(isMatchingBalance);

          // If no post balance found for this owner/token account, skip
          if (!post) continue;

          const parseUiAmount = (b: any): number => {
            if (!b || !b.uiTokenAmount) return 0;
            if (typeof b.uiTokenAmount.uiAmount === 'number') return b.uiTokenAmount.uiAmount;
            if (b.uiTokenAmount.uiAmountString) return Number(b.uiTokenAmount.uiAmountString);
            if (b.uiTokenAmount.amount) return Number(b.uiTokenAmount.amount) / 1e6;
            return 0;
          };

          const postAmount = parseUiAmount(post);
          const preAmount = parseUiAmount(pre);
          const diff = postAmount - preAmount;

          if (diff > 0) {
            candidates.push({ sigInfo, diff });
          } else if (diff < 0) {
            console.log(`[SolanaListener] ↩️ Outgoing transfer detected (${diff} USDC), skipping.`);
          }
        }

        // Step 4: Credit-grade check in one batched call — only finalized
        // transactions may be credited. Unknown status (RPC failure after
        // retries) fails closed per candidate but stays unprocessed for retry.
        if (candidates.length > 0) {
          const statuses = await this.getConfirmationStatuses(candidates.map((c) => c.sigInfo.signature));
          for (const { sigInfo, diff } of candidates) {
            const confirmationStatus = statuses?.get(sigInfo.signature) ?? null;
            if (confirmationStatus !== 'finalized') {
              console.log(
                `[SolanaListener] ⏳ Deposit ${sigInfo.signature.slice(0, 12)}... not finalized ` +
                `(status: ${confirmationStatus ?? 'unknown'}) — skipping until finalized.`
              );
              continue;
            }
            console.log(`[SolanaListener] ✅ Incoming USDC deposit detected: +${diff} USDC | sig: ${sigInfo.signature.slice(0, 12)}...`);
            events.push({
              signature: sigInfo.signature,
              userWalletAddress: walletAddress,
              amountUSDC: diff.toFixed(6),
              slot: sigInfo.slot ?? 0,
              confirmed: true,
              confirmationStatus
            });
          }
        }
      } catch (err) {
        console.warn(`[SolanaListener] Polling failed for wallet ${walletAddress.slice(0, 8)}...:`, err);
      }
    }

    return events;
  }
}
