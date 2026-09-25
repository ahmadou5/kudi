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

import { SelfCustodyProvider, resolveGasPaymentMode, resolveSweepAmount, type GasPaymentMode } from '@kudi/chains';
import { LedgerService } from './ledgerService';
import { prisma } from '@kudi/database';
import { fetchJsonWithRpcFallback, redactAddress } from '@kudi/config';

export interface SweepResult {
  success: boolean;
  txHash?: string;
  amountUSDC: number;
  /** On-chain amount actually swept (<= amountUSDC on partial sweeps). */
  actualSweptUSDC?: number;
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
  private evmTokenContract: string;

  public readonly solanaTreasuryAddress: string;
  public readonly evmTreasuryAddress: string;
  public readonly treasuryAddress: string;

  private async getGasPaymentMode(): Promise<GasPaymentMode> {
    try {
      const config = await prisma.appConfig.findUnique({
        where: { key: 'sweep_config' }
      });
      if (config?.value) {
        try {
          // DB sweep_config wins; resolveGasPaymentMode validates + falls back to env.
          return resolveGasPaymentMode(JSON.parse(config.value).gasPaymentMode);
        } catch {
          // ignore parse error, fall through to env/default
        }
      }
    } catch (err: any) {
      console.warn('[SweepService] Failed to fetch sweep config for gas payment mode:', err instanceof Error ? err.message : String(err));
    }
    return resolveGasPaymentMode(undefined);
  }

  private shouldSponsorTransactions(): boolean {
    return process.env.PRIVY_SPONSOR_TRANSACTIONS === 'true' || process.env.PRIVY_SPONSOR_SWEEPS === 'true';
  }

  constructor(private ledgerService: LedgerService) {
    this.privyAppId = process.env.PRIVY_APP_ID || '';
    this.privyAppSecret = process.env.PRIVY_APP_SECRET || '';
    this.solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.usdcMintAddress = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    this.evmTokenContract = process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3';
    this.solanaTreasuryAddress = process.env.KUDI_TREASURY_SOLANA_ADDRESS || 'KudiTreasurySolanaDevnet11111111111111111111';
    this.evmTreasuryAddress = process.env.KUDI_TREASURY_EVM_ADDRESS || '0xKudiTreasuryMonadMetropolisTestnet000';

    this.treasuryAddress = this.solanaTreasuryAddress;
    this.selfCustodyProvider = new SelfCustodyProvider();
    console.log(`[SweepService] 🏦 Solana Treasury: ${redactAddress(this.solanaTreasuryAddress)} | EVM Treasury: ${redactAddress(this.evmTreasuryAddress)}`);
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
      console.log(`[SweepService] ℹ️ Self-custody wallet (${chain.toUpperCase()}) ${redactAddress(walletAddress)} — Float Model active. On-chain balance preserved in user wallet.`);
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
      console.log(`[SweepService] 🔄 Initiating ${chain.toUpperCase()} sweep: ${amountUSDC} USDC from ${redactAddress(walletAddress)} → treasury (${redactAddress(targetTreasury)})...`);

      const gasPaymentMode = await this.getGasPaymentMode();

      // Pre-sweep on-chain balance check: never trust the detected amount.
      // Sweep min(detected, available - reserve); fail loudly on shortfall so a
      // partially-drained wallet settles the actual amount instead of failing
      // silently or corrupting the ledger.
      const tokenAddress = chain === 'monad' ? this.evmTokenContract : this.usdcMintAddress;
      const onChainBalance = Number(
        await this.selfCustodyProvider.getWalletBalance(walletAddress, chain, tokenAddress)
      );
      if (!Number.isFinite(onChainBalance) || onChainBalance <= 0) {
        const errMsg = `INSUFFICIENT_FUNDS: on-chain balance ${onChainBalance} USDC < detected ${amountUSDC} USDC for ${walletAddress}`;
        console.error(`[SweepService] ❌ ${errMsg.split(walletAddress).join(redactAddress(walletAddress))}`);
        return { success: false, amountUSDC, fromAddress: walletAddress, toAddress: targetTreasury, error: errMsg };
      }
      const { sweepAmount, shortfallUSDC } = resolveSweepAmount({
        detectedUSDC: amountUSDC,
        availableUSDC: onChainBalance,
        chain
      });
      if (sweepAmount <= 0) {
        const errMsg = `INSUFFICIENT_FUNDS: available ${onChainBalance} USDC covers only reserve for ${walletAddress} (detected ${amountUSDC} USDC)`;
        console.error(`[SweepService] ❌ ${errMsg.split(walletAddress).join(redactAddress(walletAddress))}`);
        return { success: false, amountUSDC, fromAddress: walletAddress, toAddress: targetTreasury, error: errMsg };
      }
      if (shortfallUSDC > 0) {
        console.warn(
          `[SweepService] ⚠️ Partial sweep: detected ${amountUSDC} USDC but only ${sweepAmount} USDC available on-chain ` +
          `(shortfall ${shortfallUSDC} USDC) for ${redactAddress(walletAddress)} — sweeping actual balance.`
        );
      }

      const result = await this.selfCustodyProvider.sendCrypto({
        treasuryWalletId: privyWalletId,
        fromAddress: walletAddress,
        toAddress: targetTreasury,
        amountUSDC: sweepAmount,
        chain,
        gasPaymentMode
      });

      console.log(`[SweepService] ✅ ${chain.toUpperCase()} sweep SUCCESSFUL: ${sweepAmount} USDC from ${redactAddress(walletAddress)} → treasury (${redactAddress(targetTreasury)}) | TxHash: ${result.txHash}`);

      return {
        success: true,
        txHash: result.txHash,
        amountUSDC,
        actualSweptUSDC: sweepAmount,
        fromAddress: walletAddress,
        toAddress: targetTreasury
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[SweepService] ❌ ${chain.toUpperCase()} sweep FAILED for ${redactAddress(walletAddress)} → treasury (${redactAddress(targetTreasury)}): ${errMsg}`);
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
      const data = await fetchJsonWithRpcFallback(
        [this.solanaRpcUrl, process.env.SOLANA_RPC_URL_FALLBACK],
        {
          jsonrpc: '2.0',
          method: 'getTokenAccountsByOwner',
          params: [this.treasuryAddress, { mint: this.usdcMintAddress }, { encoding: 'jsonParsed' }],
          id: 1
        },
        'SweepService treasury balance'
      ) as any;
      const accounts: any[] = data.result?.value || [];
      if (accounts.length > 0) {
        const tokenAmt = accounts[0].account?.data?.parsed?.info?.tokenAmount;
        return Number(tokenAmt?.uiAmount || 0);
      }
    } catch (err) {
      console.warn('[SweepService] Treasury balance check failed:', err instanceof Error ? err.message : String(err));
    }
    return 0;
  }
}
