/**
 * SweepService — USDC Sweep from User Deposit Addresses to Kudi Treasury
 *
 * This service handles the critical business logic gap:
 * When a user deposits USDC to their Kudi-assigned address and we credit
 * their ledger balance, we also need to physically move that USDC to Kudi's
 * treasury wallet so Kudi has the funds to pay NGN via Paystack/Monnify.
 *
 * Flow:
 *   User deposits USDC → DepositService detects it → LedgerService credits ledger
 *   → SweepService signs a transfer: [user deposit address] → [KUDI_TREASURY_ADDRESS]
 *
 * Implementation:
 * Since wallet addresses are generated via Privy Server Wallet API (Kudi controls
 * the keys server-side), Kudi can sign outbound USDC transfers from those wallets
 * using the Privy `/v1/wallets/:wallet_id/sign` or `/v1/wallets/:wallet_id/rpc` API.
 *
 * For wallets NOT generated via Privy Server API (e.g. user's own embedded wallet),
 * the sweep is skipped — the float model applies instead (Kudi maintains a float
 * and reconciles periodically).
 */

import { SelfCustodyProvider } from '@kudi/chains';
import { LedgerService } from './ledgerService';

export interface SweepResult {
  success: boolean;
  txHash?: string;
  amountUSDC: number;
  fromAddress: string;
  toAddress: string;
  error?: string;
}

export class SweepService {
  private privyAppId: string;
  private privyAppSecret: string;
  private solanaRpcUrl: string;
  private usdcMintAddress: string;
  private selfCustodyProvider: SelfCustodyProvider;

  public readonly solanaTreasuryAddress: string;
  public readonly evmTreasuryAddress: string;
  public readonly treasuryAddress: string;

  private shouldSponsorTransactions(): boolean {
    return process.env.PRIVY_SPONSOR_TRANSACTIONS === 'true' || process.env.PRIVY_SPONSOR_SWEEPS === 'true';
  }

  constructor(private ledgerService: LedgerService) {
    this.privyAppId = process.env.PRIVY_APP_ID || '';
    this.privyAppSecret = process.env.PRIVY_APP_SECRET || '';
    this.solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.usdcMintAddress = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    this.solanaTreasuryAddress = process.env.KUDI_TREASURY_SOLANA_ADDRESS || 'KudiTreasurySolanaDevnet11111111111111111111';
    this.evmTreasuryAddress = process.env.KUDI_TREASURY_EVM_ADDRESS || '0xKudiTreasuryMonadMetropolisTestnet000';

    this.treasuryAddress = this.solanaTreasuryAddress;
    this.selfCustodyProvider = new SelfCustodyProvider();
    console.log(`[SweepService] 🏦 Solana Treasury: ${this.solanaTreasuryAddress} | EVM Treasury: ${this.evmTreasuryAddress}`);
  }

  /**
   * Sweep USDC/AUSD from a deposit wallet to Kudi's central treasury.
   *
   * @param walletAddress - The user's deposit wallet address
   * @param privyWalletId - The Privy wallet ID (from metadata for server wallets)
   * @param amountUSDC - Amount to sweep
   * @param chain - 'solana' | 'monad'
   */
  public async sweepToTreasury(
    walletAddress: string,
    privyWalletId: string | undefined,
    amountUSDC: number,
    chain: 'solana' | 'monad' = 'solana'
  ): Promise<SweepResult> {
    const targetTreasury = chain === 'monad' ? this.evmTreasuryAddress : this.solanaTreasuryAddress;

    if (!privyWalletId) {
      // Self-custody wallet (Track A): Keys are held on user's device/Privy embedded session.
      // Kudi backend cannot unilaterally sign outbound transactions.
      // Float Model Applies: On-chain funds remain in user deposit address while ledger balance is credited for spending.
      console.log(`[SweepService] ℹ️ Self-custody wallet (${chain.toUpperCase()}) ${walletAddress.slice(0, 8)}... — Float Model active. On-chain balance preserved in user wallet.`);
      return {
        success: false,
        amountUSDC,
        fromAddress: walletAddress,
        toAddress: targetTreasury,
        error: 'SELF_CUSTODY_FLOAT_MODEL: Keys user-held. Float model credits ledger; on-chain funds stay in user deposit address.'
      };
    }

    if (walletAddress === targetTreasury) {
      return { success: true, amountUSDC, fromAddress: walletAddress, toAddress: targetTreasury };
    }

    try {
      console.log(`[SweepService] 🔄 Initiating ${chain.toUpperCase()} sweep: ${amountUSDC} USDC from ${walletAddress} → treasury (${targetTreasury})...`);

      const result = await this.selfCustodyProvider.sendCrypto({
        treasuryWalletId: privyWalletId,
        fromAddress: walletAddress,
        toAddress: targetTreasury,
        amountUSDC,
        chain
      });

      console.log(`[SweepService] ✅ ${chain.toUpperCase()} sweep SUCCESSFUL: ${amountUSDC} USDC from ${walletAddress} → treasury (${targetTreasury}) | TxHash: ${result.txHash}`);

      return {
        success: true,
        txHash: result.txHash,
        amountUSDC,
        fromAddress: walletAddress,
        toAddress: targetTreasury
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[SweepService] ❌ ${chain.toUpperCase()} sweep FAILED for ${walletAddress} → treasury (${targetTreasury}): ${errMsg}`, err);
      return {
        success: false,
        amountUSDC,
        fromAddress: walletAddress,
        toAddress: targetTreasury,
        error: errMsg
      };
    }
  }


  /**
   * Get the current USDC balance in Kudi's treasury wallet.
   * Used for monitoring and ensuring float is sufficient.
   */
  public async getTreasuryBalance(): Promise<number> {
    if (!this.treasuryAddress) return 0;
    try {
      const res = await fetch(this.solanaRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getTokenAccountsByOwner',
          params: [this.treasuryAddress, { mint: this.usdcMintAddress }, { encoding: 'jsonParsed' }],
          id: 1
        })
      });
      const data = await res.json() as any;
      const accounts: any[] = data.result?.value || [];
      if (accounts.length > 0) {
        const tokenAmt = accounts[0].account?.data?.parsed?.info?.tokenAmount;
        return Number(tokenAmt?.uiAmount || 0);
      }
    } catch (err) {
      console.warn('[SweepService] Treasury balance check failed:', err);
    }
    return 0;
  }
}
