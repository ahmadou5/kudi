import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { CustodyProvider, CustodyTrack, DepositWallet } from '@kudi/types';
import {
  address as solanaAddress,
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address
} from '@solana/kit';
import { getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS, ASSOCIATED_TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

/**
 * Shared sweep/deposit security policy.
 *
 * Single home for gas-mode resolution, amount validation, and sweep retry
 * constants so the API sweep engine, the worker sweep engine, and the
 * withdrawal path all apply identical rules. Kept in this module (rather than
 * a new file) so it is exported through the existing `export *` barrel with
 * no new build wiring.
 */
export type GasPaymentMode = 'PRIVY_SPONSOR' | 'TREASURY_FEE_PAYER';

export const GAS_PAYMENT_MODES: readonly GasPaymentMode[] = ['PRIVY_SPONSOR', 'TREASURY_FEE_PAYER'];

export function isGasPaymentMode(value: unknown): value is GasPaymentMode {
  return value === 'PRIVY_SPONSOR' || value === 'TREASURY_FEE_PAYER';
}

/**
 * Resolve the effective gas payment mode.
 *
 * Precedence: stored DB `sweep_config` value wins; env (`GAS_PAYMENT_MODE` /
 * legacy `PRIVY_SPONSOR_*` flags) is fallback only. Always returns a validated
 * union member — never `undefined`, never an unknown string.
 *
 * Callers that have DB access must read `sweep_config` themselves and pass the
 * stored value in (this module has no DB dependency by design).
 */
export function resolveGasPaymentMode(stored?: unknown): GasPaymentMode {
  if (isGasPaymentMode(stored)) return stored;

  const explicitEnv = process.env.GAS_PAYMENT_MODE;
  if (isGasPaymentMode(explicitEnv)) return explicitEnv;

  // Legacy boolean flags only ever select sponsorship; they can never select
  // treasury-pays (which now fails loudly unless genuinely honored).
  if (process.env.PRIVY_SPONSOR_TRANSACTIONS === 'true' || process.env.PRIVY_SPONSOR_SWEEPS === 'true') {
    return 'PRIVY_SPONSOR';
  }

  // Safe default: attempt Privy sponsorship, signer pays when unavailable.
  // (Previously defaulted to TREASURY_FEE_PAYER, which was never genuinely
  // honored on Solana — see sendCrypto — so defaulting to it risked loud
  // failures on every sweep.)
  return 'PRIVY_SPONSOR';
}

/** Upper bound for a single credited deposit (Float columns kept; rejects absurd values). */
export const MAX_DEPOSIT_USDC = 10_000_000;

/**
 * Centralized deposit amount parsing/validation.
 * Returns the finite positive amount, or `null` when the value must be rejected
 * (NaN, non-finite, <= 0, or absurdly large). Used at every credit boundary.
 */
export function parseDepositAmount(raw: unknown): number | null {
  const amount = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT_USDC) return null;
  return amount;
}

/**
 * Single sweep retry policy shared by the API SweepWorkerService and the
 * worker ChainDepositProcessor engines.
 *
 * Single-owner note: the API `SweepWorkerService` is the designated sweep
 * owner (DB-claimed queue with exponential backoff). The worker
 * `ChainDepositProcessor.processSweepRetries` is a legacy second engine kept
 * for coverage; it MUST reuse these constants so deposits converge on one
 * status set, one attempt cap, and one backoff schedule instead of flapping
 * between divergent policies.
 */
export const SWEEP_RETRY_POLICY = {
  MAX_ATTEMPTS: 5,
  BASE_BACKOFF_MIN: 1,
  MAX_BACKOFF_MIN: 64
} as const;

/** Next retry time under the shared exponential-backoff schedule (capped). */
export function computeSweepRetryDelay(attemptCount: number): Date {
  const delayMin = Math.min(
    SWEEP_RETRY_POLICY.BASE_BACKOFF_MIN * Math.pow(2, Math.max(1, attemptCount) - 1),
    SWEEP_RETRY_POLICY.MAX_BACKOFF_MIN
  );
  return new Date(Date.now() + delayMin * 60_000);
}

/** Deposit sweep statuses that represent credited-but-unbacked liability. */
export const UNBACKED_SWEEP_STATUSES: readonly string[] = [
  'SWEEP_PENDING',
  'SWEEP_PROCESSING',
  'SWEEP_FAILED',
  'SWEEP_BLOCKED'
];

/**
 * Pure helper computing total un-swept (unbacked) exposure from Deposit rows.
 * Consumed by reconciliation alerting (e.g. SweepWorkerService.getQueueHealth)
 * without restructuring the reconciliation pipeline.
 */
export function computeUnbackedExposure(
  deposits: Array<{ sweepStatus?: string | null; amountUSDC?: number | string | null }>
): { totalUSDC: number; byStatus: Record<string, number> } {
  const byStatus: Record<string, number> = {};
  let totalUSDC = 0;
  for (const d of deposits) {
    const status = d.sweepStatus ?? 'UNKNOWN';
    const amount = Number(d.amountUSDC ?? 0);
    if (!UNBACKED_SWEEP_STATUSES.includes(status)) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    byStatus[status] = (byStatus[status] ?? 0) + amount;
    totalUSDC += amount;
  }
  return { totalUSDC, byStatus };
}

/** Reserve held back from each sweep for rent/dust/rounding (per chain, USDC). */
export const SWEEP_RESERVE_USDC: Record<'solana' | 'monad', number> = {
  solana: 0.01,
  monad: 0.01
};

/**
 * Clamp a sweep to on-chain reality: sweep min(detected, available - reserve).
 * Returns the amount safe to broadcast plus any shortfall vs detected.
 */
export function resolveSweepAmount(params: {
  detectedUSDC: number;
  availableUSDC: number;
  chain: 'solana' | 'monad';
}): { sweepAmount: number; shortfallUSDC: number } {
  const reserve = SWEEP_RESERVE_USDC[params.chain] ?? 0;
  const spendable = Math.max(0, params.availableUSDC - reserve);
  const sweepAmount = Math.min(params.detectedUSDC, spendable);
  return { sweepAmount, shortfallUSDC: Math.max(0, params.detectedUSDC - sweepAmount) };
}

/** Commitment at which Solana deposits are eligible for ledger credit. */
export const SOLANA_CREDIT_COMMITMENT = 'finalized' as const;

export class SelfCustodyProvider implements CustodyProvider {
  public readonly track = CustodyTrack.TRACK_A_SELF_CUSTODY;
  public readonly name = 'Privy / KMS Self Custody (Track A)';

  private privyAppId: string;
  private privyAppSecret: string;
  private defaultRpcUrl: string;
  private solanaRpcUrl: string;
  private solanaUsdcMintAddress: string;
  private solanaTreasuryAddress: string;
  private solanaTreasuryWalletId: string;
  private solanaCaip2: string;
  private ausdTokenAddress: string;
  private monadChainId: number;

  private get appId(): string {
    return this.privyAppId;
  }

  private get appSecret(): string {
    return this.privyAppSecret;
  }

  private get rpcUrlSolana(): string {
    return this.solanaRpcUrl || 'https://api.devnet.solana.com';
  }

  private get rpcUrlDefault(): string {
    return this.defaultRpcUrl || 'https://testnet-rpc.monad.xyz';
  }

  private shouldSponsorTransactions(): boolean {
    return process.env.PRIVY_SPONSOR_TRANSACTIONS === 'true' || process.env.PRIVY_SPONSOR_SWEEPS === 'true';
  }

  private getGasPaymentMode(): 'PRIVY_SPONSOR' | 'TREASURY_FEE_PAYER' {
    // Env-only fallback (this module has no DB access). Callers with DB access
    // must pass the stored sweep_config value through resolveGasPaymentMode()
    // so the DB value wins; this is only the env/default leg.
    return resolveGasPaymentMode(undefined);
  }

  private allowsMockWalletFallback(): boolean {
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_PRIVY_WALLETS === 'true';
  }

  constructor(
    privyAppId = process.env.PRIVY_APP_ID || '',
    privyAppSecret = process.env.PRIVY_APP_SECRET || '',
    defaultRpcUrl = process.env.MONAD_RPC_URL || process.env.EVM_RPC_URL || '',
    solanaRpcUrl = process.env.SOLANA_RPC_URL || '',
    solanaUsdcMintAddress = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    solanaTreasuryAddress = process.env.KUDI_TREASURY_SOLANA_ADDRESS || '',
    solanaCaip2 = process.env.SOLANA_CAIP2 || 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    ausdTokenAddress = process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    monadChainId = Number(process.env.MONAD_CHAIN_ID || 10143),
    solanaTreasuryWalletId = process.env.KUDI_SOLANA_TREASURY_WALLET_ID || ''
  ) {
    this.privyAppId = privyAppId;
    this.privyAppSecret = privyAppSecret;
    this.defaultRpcUrl = defaultRpcUrl;
    this.solanaRpcUrl = solanaRpcUrl;
    this.solanaUsdcMintAddress = solanaUsdcMintAddress;
    this.solanaTreasuryAddress = solanaTreasuryAddress;
    this.solanaCaip2 = solanaCaip2;
    this.ausdTokenAddress = ausdTokenAddress;
    this.monadChainId = monadChainId;
    this.solanaTreasuryWalletId = solanaTreasuryWalletId;
  }

  async generateWallet(userId: string, chain: string): Promise<DepositWallet> {
    let privyFailure: string | null = null;

    if (this.appId && this.appSecret) {
      try {
        // Call Privy Server Wallet API to generate server-side wallet for user across Solana or EVM
        const res = await fetch('https://api.privy.io/v1/wallets', {
          method: 'POST',
          headers: {
            'privy-app-id': this.appId,
            Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chain_type: chain.includes('solana') ? 'solana' : 'ethereum'
          })
        });

        if (res.ok) {
          const data = await res.json();
          return {
            address: data.address,
            chain,
            metadata: {
              privyWalletId: data.id,
              createdAt: new Date().toISOString()
            }
          };
        }

        const errText = await res.text();
        privyFailure = `Privy Server Wallet API response (${res.status}): ${errText}`;
        console.warn(`⚠️ [SelfCustody] ${privyFailure}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        privyFailure = `Privy API call error: ${msg}`;
        console.warn(`⚠️ [SelfCustody] ${privyFailure}`);
      }
    } else {
      privyFailure = 'PRIVY_APP_ID/PRIVY_APP_SECRET are not configured';
    }

    if (!this.allowsMockWalletFallback()) {
      throw new Error(`[SelfCustody] Cannot create deposit wallet: ${privyFailure || 'Privy wallet creation failed'}`);
    }

    // Return deterministic sandbox testnet deposit address for local/dev testing only.
    // These wallets are intentionally marked mock so the API never treats them as sweepable server custody.
    const mockAddress = chain.includes('solana')
      ? `Sol${Buffer.from(`user_${userId}_${chain}`).toString('hex').slice(0, 32)}`
      : `0x${Buffer.from(`user_${userId}_${chain}`).toString('hex').slice(0, 40)}`;

    return {
      address: mockAddress,
      chain,
      metadata: {
        mock: true,
        generatedBy: 'MOCK_PRIVY_SERVER_WALLET',
        mockReason: privyFailure || 'Privy wallet creation failed',
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Token balance read with explicit decimals. Throws on transport/RPC errors
   * so callers can distinguish "balance unknown → retry" from genuine zero.
   * '0.00' is returned ONLY for a valid empty/zero result.
   */
  async getWalletBalance(address: string, chain: string, tokenAddress?: string, tokenDecimals?: number): Promise<string> {
    const isSolana = chain.includes('solana') || address.startsWith('Sol');

    if (isSolana) {
      try {
        if (tokenAddress) {
          // Query Solana SPL Token Account balance
          const res = await fetch(this.solanaRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'getTokenAccountsByOwner',
              params: [address, { mint: tokenAddress }, { encoding: 'jsonParsed' }],
              id: 1
            })
          });
          const data = await res.json();
          if (data.error) {
            throw new Error(`Solana RPC getTokenAccountsByOwner failed: ${JSON.stringify(data.error).slice(0, 200)}`);
          }
          const accounts = data.result?.value || [];
          if (accounts.length > 0) {
            const tokenAmount = accounts[0].account?.data?.parsed?.info?.tokenAmount;
            return tokenAmount?.uiAmountString || (Number(tokenAmount?.amount || 0) / 1e6).toFixed(2);
          }
          return '0.00';
        } else {
          // Query native SOL balance
          const res = await fetch(this.solanaRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'getBalance',
              params: [address],
              id: 1
            })
          });
          const data = await res.json();
          if (data.error) {
            throw new Error(`Solana RPC getBalance failed: ${JSON.stringify(data.error).slice(0, 200)}`);
          }
          if (typeof data.result?.value === 'number') {
            return (data.result.value / 1e9).toFixed(4);
          }
          return '0.00';
        }
      } catch (err) {
        // Unknown balance must NOT look like zero (see EVM branch note).
        console.warn('Solana RPC Balance query failed:', err instanceof Error ? err.message : err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!this.defaultRpcUrl) {
      return '0.00';
    }

    try {
      if (tokenAddress) {
        // ERC20 balanceOf(address) eth_call query
        const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
        const callData = `0x70a08231000000000000000000000000${cleanAddress.padStart(40, '0')}`;
        const res = await fetch(this.defaultRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: tokenAddress, data: callData }, 'latest'],
            id: 1
          })
        });

        const data = await res.json();
        if (data.error) {
          throw new Error(`EVM RPC eth_call balance failed: ${JSON.stringify(data.error).slice(0, 200)}`);
        }
        if (data.result && data.result !== '0x') {
          const raw = BigInt(data.result);
          // Decimals: explicit param wins, then known 6-decimal stablecoins
          // (USDC mint + AUSD contract), else standard ERC-20 18. Never guess
          // from address substrings — AUSD misread as 18 decimals once caused
          // every Monad sweep to see balance 0 (INSUFFICIENT_FUNDS loop).
          const knownSix = new Set(
            [this.solanaUsdcMintAddress, this.ausdTokenAddress].map((a) => a.toLowerCase())
          );
          const decimals = tokenDecimals
            ?? (tokenAddress && knownSix.has(tokenAddress.toLowerCase()) ? 6 : 18);
          const balance = Number(raw) / Math.pow(10, decimals);
          return balance.toFixed(decimals === 6 ? 2 : 4);
        }
        throw new Error('EVM RPC eth_call balance returned no result');
      } else {
        // JSON-RPC eth_getBalance query for EVM native currency
        const res = await fetch(this.defaultRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });

        const data = await res.json();
        if (data.error) {
          throw new Error(`EVM RPC eth_getBalance failed: ${JSON.stringify(data.error).slice(0, 200)}`);
        }
        if (data.result) {
          const wei = BigInt(data.result);
          const eth = Number(wei) / 1e18;
          return eth.toFixed(4);
        }
        return '0.00';
      }
    } catch (err) {
      // Unknown balance (transport/RPC failure) must NOT look like zero —
      // callers treat zero as INSUFFICIENT_FUNDS (permanent), unknown must retry.
      console.warn('EVM RPC Balance query failed:', err instanceof Error ? err.message : err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async verifyDepositTransaction(txHash: string, chain: string): Promise<{
    confirmed: boolean;
    amount: string;
    sender: string;
    tokenAddress: string;
    blockNumber?: number;
  }> {
    const isEvm = txHash.startsWith('0x');

    if (isEvm && this.defaultRpcUrl) {
      try {
        const [receiptRes, txRes] = await Promise.all([
          fetch(this.defaultRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [txHash],
              id: 1
            })
          }),
          fetch(this.defaultRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionByHash',
              params: [txHash],
              id: 2
            })
          })
        ]);

        const receiptData = await receiptRes.json();
        const txData = await txRes.json();

        if (receiptData.result) {
          const receipt = receiptData.result;
          const tx = txData.result || {};
          const confirmed = receipt.status === '0x1';
          const blockNumber = receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : undefined;

          // Check for ERC-20 Transfer log (topic0 = Transfer(address,address,uint256))
          const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const transferLog = receipt.logs?.find((l: any) => l.topics && l.topics[0]?.toLowerCase() === transferTopic);

          if (transferLog && transferLog.topics.length >= 3) {
            const sender = `0x${transferLog.topics[1].slice(26)}`;
            const tokenAddress = transferLog.address;
            const rawAmount = BigInt(transferLog.data || '0x0');
            const decimals = tokenAddress.toLowerCase().includes('usdc') ? 6 : 18;
            const amount = (Number(rawAmount) / Math.pow(10, decimals)).toFixed(2);

            return {
              confirmed,
              amount,
              sender,
              tokenAddress,
              blockNumber
            };
          }

          // Native EVM transfer value (never synthesized — report what is on-chain,
          // even if zero; credit paths validate positivity separately)
          const rawValue = BigInt(tx.value || '0x0');
          const nativeAmount = (Number(rawValue) / 1e18).toFixed(4);

          return {
            confirmed,
            amount: nativeAmount,
            sender: receipt.from || tx.from || '',
            tokenAddress: receipt.to || tx.to || 'native',
            blockNumber
          };
        }
      } catch (err) {
        console.warn('RPC Tx receipt query failed:', err);
      }
    } else if (!isEvm) {
      // Solana JSON-RPC getTransaction query
      try {
        const res = await fetch(this.solanaRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getTransaction',
            params: [txHash, { encoding: 'jsonParsed', commitment: 'finalized' }],
            id: 1
          })
        });

        const data = await res.json();
        if (data.result) {
          const tx = data.result;
          const meta = tx.meta;
          const confirmed = meta && meta.err === null;
          const blockNumber = tx.slot;
          const keys = tx.transaction?.message?.accountKeys || [];
          const sender = keys[0]?.pubkey || keys[0] || 'SolanaSender';

          // Extract token balance difference if present (default zero — never synthesize)
          let parsedAmount = '0.00';
          if (meta?.preTokenBalances?.length && meta?.postTokenBalances?.length) {
            const pre = meta.preTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
            const post = meta.postTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
            const diff = Math.abs(post - pre);
            if (diff > 0) parsedAmount = diff.toFixed(2);
          }

          return {
            confirmed,
            amount: parsedAmount,
            sender,
            tokenAddress: meta?.postTokenBalances[0]?.mint || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
            blockNumber
          };
        }
      } catch (err) {
        console.warn('Solana RPC Tx verification query failed:', err);
      }
    }

    // Fail closed on any RPC/parse failure: confirmed:false with a zero amount.
    // This function must NEVER synthesize a confirmed deposit — no credit path
    // may trust a fallback value, and RPC outages must not become spendable
    // ledger balance. Callers gate credit on `confirmed === true`.
    console.warn(`[SelfCustody] ⚠️ Could not verify transaction ${txHash.slice(0, 20)}... on ${chain} — returning unconfirmed (fail closed).`);
    return {
      confirmed: false,
      amount: '0.00',
      sender: '',
      tokenAddress: isEvm ? '' : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      blockNumber: undefined
    };
  }

  /**
   * Send USDC from the Kudi treasury wallet to any external address.
   *
   * Custodial model (Track B): Kudi signs from its own treasury Privy wallet
   * on behalf of the user. Supports Solana and Monad (EVM).
   *
   * @param treasuryWalletId  - Privy wallet ID of the signing wallet
   * @param fromAddress       - Optional Solana owner address for non-treasury signing wallets
   * @param toAddress         - Recipient on-chain address
   * @param amountUSDC        - Amount in USDC (will be converted to token units)
   * @param chain             - 'solana' | 'monad'
   * @returns { txHash }      - Broadcast transaction hash
   */
  async sendCrypto(params: {
    treasuryWalletId: string;
    toAddress: string;
    amountUSDC: number;
    chain: 'solana' | 'monad';
    usdcMintAddress?: string;
    usdcContractAddress?: string;
    fromAddress?: string;
    feePayerAddress?: string;
    gasPaymentMode?: 'PRIVY_SPONSOR' | 'TREASURY_FEE_PAYER';
  }): Promise<{ txHash: string }> {
    const { treasuryWalletId, toAddress, amountUSDC, chain, usdcMintAddress, usdcContractAddress, fromAddress } = params;

    if (!this.appId || !this.appSecret || !treasuryWalletId) {
      const missing = {
        hasAppId: !!this.appId,
        hasAppSecret: !!this.appSecret,
        hasTreasuryWalletId: !!treasuryWalletId,
        treasuryWalletIdProvided: treasuryWalletId,
        chain
      };

      throw new Error(`[SelfCustody] Missing chain-send credentials: ${JSON.stringify(missing)}`);
    }

    const authHeader = `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`;
    const isSolana = chain === 'solana';

    let requestBody: Record<string, unknown>;

    // Determine gas payment mode: explicit param wins (already DB-resolved by
    // callers via resolveGasPaymentMode), otherwise env/default fallback.
    // Invalid values never pass through — resolveGasPaymentMode validates.
    const gasPaymentMode = resolveGasPaymentMode(params.gasPaymentMode);

    // TREASURY_FEE_PAYER decision (documented, do not silently downgrade):
    // Genuine treasury-pays would require the treasury wallet to sign as fee
    // payer alongside the user authority (2-signer transaction), but Privy only
    // ever signs with the single wallet passed as treasuryWalletId, so the
    // second signature slot would stay empty and verification would fail.
    // Implementing it for real needs the treasury as the signing wallet plus a
    // funded + monitored treasury balance — until then, selecting this mode
    // fails loudly instead of silently behaving as user-pays.
    if (gasPaymentMode === 'TREASURY_FEE_PAYER') {
      throw new Error(
        `[SelfCustody] TREASURY_FEE_PAYER is not implemented for ${chain}: treasury-as-fee-payer needs a second signer Privy cannot provide. ` +
        `Select PRIVY_SPONSOR (or fund the signing wallet) instead. No silent fallback to user-pays.`
      );
    }

    // PRIVY_SPONSOR: request Privy gas sponsorship; if the dashboard has it
    // disabled we retry once unsponsored below (signer pays ~$0.001 on Solana).
    const sponsorFlag = true;

    if (isSolana) {
      // Solana: Build a real SPL USDC transfer via @solana/kit (v2 — no rpc-websockets dep)
      // Uses functional transaction message API, then passes unsigned wire-format tx to Privy.
      const mintAddr = usdcMintAddress || this.solanaUsdcMintAddress;
      const USDC_DECIMALS = 6; // USDC always has 6 decimals

      const signerAddrStr = fromAddress || this.solanaTreasuryAddress;

      if (!signerAddrStr) {
        throw new Error('Solana signing address is not configured. Cannot build Solana transaction.');
      }

      const mintPubkey = solanaAddress(mintAddr as Address);
      const signerAddr = solanaAddress(signerAddrStr as Address);
      const recipientAddr = solanaAddress(toAddress as Address);

      // Create Solana JSON-RPC client (no WebSocket — HTTP only for blockhash fetch)
      const rpc = createSolanaRpc(this.rpcUrlSolana);

      // Fetch recent blockhash with confirmed commitment for a fresh hash that is less likely to
      // expire before Privy's RPC node processes the transaction.
      // (finalized = ~32 slots old / ~20s; confirmed = ~1-2 slots old / ~1s — safer window)
      const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();

      // Derive source and destination Associated Token Accounts (ATAs)
      // ATA = PDA([owner, TOKEN_PROGRAM, mint], ATA_PROGRAM)
      const addrEncoder = getAddressEncoder();
      const SYSTEM_PROGRAM_ADDRESS = solanaAddress('11111111111111111111111111111111' as Address);

      const [derivedSourceAta] = await getProgramDerivedAddress({
        programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        seeds: [
          addrEncoder.encode(signerAddr),
          addrEncoder.encode(TOKEN_PROGRAM_ADDRESS),
          addrEncoder.encode(mintPubkey)
        ]
      });

      let sourceAta = derivedSourceAta;
      try {
        const tokenAccountsRes = await rpc.getTokenAccountsByOwner(signerAddr, { mint: mintPubkey }, { encoding: 'jsonParsed' }).send();
        if (tokenAccountsRes.value?.[0]?.pubkey) {
          sourceAta = solanaAddress(tokenAccountsRes.value[0].pubkey as Address);
        }
      } catch (err: unknown) {
        // Fall back to derived ATA if RPC lookup fails
      }

      const [destAta] = await getProgramDerivedAddress({
        programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        seeds: [
          addrEncoder.encode(recipientAddr),
          addrEncoder.encode(TOKEN_PROGRAM_ADDRESS),
          addrEncoder.encode(mintPubkey)
        ]
      });

      // Check if destination Associated Token Account already exists on-chain
      let destAtaExists = false;
      try {
        const destAtaInfo = await rpc.getAccountInfo(destAta, { encoding: 'jsonParsed' }).send();
        if (destAtaInfo.value !== null) {
          destAtaExists = true;
        }
      } catch {
        // Fall back to creating ATA if check fails
      }

      // IMPORTANT: Fee payer MUST be the same wallet as the signer (signerAddr / user wallet).
      // Using a different address (e.g. treasury) as fee payer would create a 2-signer transaction
      // (user authority + treasury fee payer), but Privy only signs with the single wallet passed
      // as treasuryWalletId → the treasury signature slot is empty → signature verification fails.
      // Solution: user wallet always pays its own fees (Solana fees are ~0.000005 SOL / ~$0.001).
      const feePayerAddr = signerAddr; // always single-signer: user wallet pays fees

      // SPL Token transferChecked instruction
      const amountRaw = BigInt(Math.floor(amountUSDC * Math.pow(10, USDC_DECIMALS)));
      const transferIx = getTransferCheckedInstruction({
        source: sourceAta,
        mint: mintPubkey,
        destination: destAta,
        authority: signerAddr,
        amount: amountRaw,
        decimals: USDC_DECIMALS
      });

      // Compose transaction message (functional pipe style — v2 API).
      // NOTE: We do NOT include a createDestAta instruction here even if destAtaExists=false.
      // Reason: createDestAta requires the fee payer to be a WritableSigner. If fee payer ≠ user
      // wallet it would add a second required signer. Instead we rely on Privy gas sponsorship
      // (sponsor:true) to handle ATA creation, or the treasury ATA is pre-created.
      // In practice the treasury ATA always exists once the treasury has received any USDC before.
      if (!destAtaExists) {
        // Create destination ATA instruction — fee payer is signerAddr (single signer)
        const createDestAtaIx = {
          programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
          accounts: [
            { address: feePayerAddr, role: 3 as const },           // Writable Signer (Payer = user)
            { address: destAta,      role: 1 as const },           // Writable (ATA to create)
            { address: recipientAddr, role: 0 as const },          // Readonly (Owner = treasury)
            { address: mintPubkey,   role: 0 as const },           // Readonly (Mint)
            { address: SYSTEM_PROGRAM_ADDRESS, role: 0 as const }, // Readonly (System Program)
            { address: TOKEN_PROGRAM_ADDRESS,  role: 0 as const }  // Readonly (SPL Token Program)
          ],
          data: new Uint8Array([1]) // 1 = CreateIdempotent
        };
        console.log(`[SelfCustody] ℹ️ Destination ATA for treasury does not exist yet — including CreateIdempotent ATA instruction (user wallet pays).`);

        const txMessage = pipe(
          createTransactionMessage({ version: 0 as const }),
          (tx) => setTransactionMessageFeePayer(feePayerAddr, tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstruction(createDestAtaIx, tx),
          (tx) => appendTransactionMessageInstruction(transferIx, tx)
        );

        const compiled = compileTransaction(txMessage);
        const msgBytes = compiled.messageBytes as unknown as Uint8Array;
        const numSigs = Object.keys(compiled.signatures).length || 1;
        const wireBytes = new Uint8Array(1 + (numSigs * 64) + msgBytes.length);
        wireBytes[0] = numSigs;
        wireBytes.set(msgBytes, 1 + (numSigs * 64));
        const serializedTx = Buffer.from(wireBytes).toString('base64');

        requestBody = {
          method: 'signAndSendTransaction',
          caip2: this.solanaCaip2,
          ...(sponsorFlag ? { sponsor: true } : {}),
          params: { transaction: serializedTx, encoding: 'base64' }
        };
      } else {
        // Treasury ATA already exists — simple single-instruction transfer (fastest path)
        const txMessage = pipe(
          createTransactionMessage({ version: 0 as const }),
          (tx) => setTransactionMessageFeePayer(feePayerAddr, tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstruction(transferIx, tx)
        );

        // Compile to wire format. v2 compileTransaction returns { messageBytes, signatures }.
        // Privy needs an unsigned wire-format transaction:
        //   [compact-u16 numSigs] [numSigs * 64 zero bytes for empty signature slots] [message bytes]
        // IMPORTANT: Do NOT read msgBytes[0] as numSigs — for versioned (v0) transactions the
        // first byte of messageBytes is the version prefix 0x80, not the signer count.
        // The signer count comes from compiled.signatures.size.
        const compiled = compileTransaction(txMessage);
        const msgBytes = compiled.messageBytes as unknown as Uint8Array;
        const numSigs = Object.keys(compiled.signatures).length || 1;
        const wireBytes = new Uint8Array(1 + (numSigs * 64) + msgBytes.length);
        wireBytes[0] = numSigs;
        wireBytes.set(msgBytes, 1 + (numSigs * 64));
        const serializedTx = Buffer.from(wireBytes).toString('base64');

        requestBody = {
          method: 'signAndSendTransaction',
          caip2: this.solanaCaip2,
          ...(sponsorFlag ? { sponsor: true } : {}),
          params: { transaction: serializedTx, encoding: 'base64' }
        };
      }
    } else {
      // Monad EVM: ERC-20 transfer(address,uint256) via eth_sendTransaction
      const contract = usdcContractAddress || this.ausdTokenAddress;
      const amountWei = BigInt(Math.floor(amountUSDC * 1_000_000)).toString(16).padStart(64, '0');
      const recipientPadded = toAddress.replace('0x', '').padStart(64, '0');
      // ERC-20 transfer(address,uint256) = selector 0xa9059cbb
      const data = `0xa9059cbb${recipientPadded}${amountWei}`;
      requestBody = {
        method: 'eth_sendTransaction',
        caip2: `eip155:${this.monadChainId}`,
        ...(sponsorFlag ? { sponsor: true } : {}),
        params: {
          transaction: {
            to: contract,
            data,
            value: '0x0'
          }
        }
      };
    }

    try {
      let res = await fetch(`https://api.privy.io/v1/wallets/${treasuryWalletId}/rpc`, {
        method: 'POST',
        headers: {
          'privy-app-id': this.appId,
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        if (sponsorFlag && errText.includes('Gas sponsorship is not configured')) {
          console.warn('[SelfCustody] ℹ️ Privy gas sponsorship not enabled in dashboard; retrying standard transfer...');
          const { sponsor: _omitted, ...bodyWithoutSponsor } = requestBody;
          res = await fetch(`https://api.privy.io/v1/wallets/${treasuryWalletId}/rpc`, {
            method: 'POST',
            headers: {
              'privy-app-id': this.appId,
              Authorization: authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyWithoutSponsor)
          });
        }
        if (!res.ok) {
          const finalErrText = await res.text().catch(() => '');
          throw new Error(`Privy RPC error ${res.status}: ${finalErrText || errText}`);
        }
      }

      const data = await res.json() as any;
      const txHash = data.data?.hash || data.hash || data.data?.signature || data.signature || data.result;

      if (!txHash) {
        throw new Error(`Privy RPC returned success but no transaction hash/signature was found in response: ${JSON.stringify(data)}`);
      }

      console.log(`[SelfCustody] ✅ Broadcast ${amountUSDC} USDC on ${chain}${sponsorFlag ? ' (gas sponsored)' : ''}: ${txHash.slice(0, 20)}...`);
      return { txHash };
    } catch (err: any) {
      console.error(`[SelfCustody] ❌ Privy broadcast failed: ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Poll the chain until a transaction is confirmed or timeout is reached.
   *
   * @param txHash   - Transaction hash / signature to poll
   * @param chain    - 'solana' | 'monad'
   * @param timeoutMs - How long to poll before giving up (default: 90s)
   * @returns true if confirmed, false if timed out or failed
   */
  async waitForConfirmation(
    txHash: string,
    chain: 'solana' | 'monad',
    timeoutMs = 90_000
  ): Promise<boolean> {
    const pollIntervalMs = 4_000;
    const deadline = Date.now() + timeoutMs;
    const isSolana = chain === 'solana';

    // Sandbox shortcut: mock hashes always confirm instantly
    if (
      (!this.appId || !this.appSecret) ||
      txHash.startsWith('mock_') ||
      (isSolana && !txHash.startsWith('0x') && txHash.length < 20) ||
      (!isSolana && !txHash.startsWith('0x'))
    ) {
      console.log(`[SelfCustody] 🧪 Instant confirmation for ${txHash.slice(0, 20)}...`);
      return true;
    }

    while (Date.now() < deadline) {
      try {
        const result = await this.verifyDepositTransaction(txHash, chain);
        if (result.confirmed) {
          console.log(`[SelfCustody] ✅ Confirmed on ${chain}: ${txHash.slice(0, 20)}...`);
          return true;
        }
      } catch (err) {
        // Transient RPC error — keep polling
        console.warn(`[SelfCustody] Polling error (will retry):`, err);
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    console.warn(`[SelfCustody] ⏰ Confirmation timeout for ${txHash.slice(0, 20)}...`);
    return false;
  }
}
