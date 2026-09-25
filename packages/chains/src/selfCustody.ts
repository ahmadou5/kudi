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
  type Address,
  type Blockhash
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

/**
 * Structured sweep-failure classifier (drip hardening / farming defense).
 *
 * The treasury native-gas drip exists for ONE reason: deposit wallets start
 * with zero native balance, so a sweep can fail purely because the signer
 * cannot pay fees. Dripping on any other failure — especially token
 * shortfalls — lets anyone mint dust deposits and harvest treasury native on
 * every retry, so the classifier is deliberately narrow:
 *
 * - GAS: native fee-payment shortfall only (lamports, fee payer, rent, Privy
 *   "Signer had insufficient balance", EVM gas phrasing). ONLY this class may
 *   trigger a treasury drip.
 * - TOKEN: token-side shortfall/config (mint, ATA, token balance/amount,
 *   USDC/AUSD phrasing). NEVER drips — throws immediately.
 * - BLOCKHASH: stale blockhash. Retried once WITHOUT dripping.
 * - OTHER: everything else, including ambiguous "insufficient funds" with no
 *   native qualifier, and ExceededMaxRepresentationSize (explicitly excluded
 *   from GAS — it is a transaction-size error, not a fee shortfall). Never
 *   drips — throws immediately.
 *
 * Tie-break direction is fail-safe: a message matching both TOKEN-strong and
 * GAS-strong phrases classifies as TOKEN (no drip beats a wasted/minted drip).
 */
export type SweepFailureClass = 'GAS' | 'TOKEN' | 'BLOCKHASH' | 'OTHER';

/** Token-side phrases: strong enough to VETO a drip on their own. */
const TOKEN_STRONG_PATTERNS: readonly string[] = [
  'insufficient token',
  'insufficient usdc',
  'insufficient ausd',
  'not enough usdc',
  'not enough ausd',
  'not enough token',
  'token balance',
  'token amount',
  'tokenamount',
  'token account',
  'tokenaccount',
  'associated token',
  'associatedtoken',
  'invalid mint',
  'unknown mint',
  'no mint',
  'transferchecked',
  'transfer checked',
  'spl token',
  'spl-token',
  'token program',
  'tokenkeg'
];

/** Native fee-payment phrases: the ONLY signals that may trigger a drip. */
const GAS_STRONG_PATTERNS: readonly string[] = [
  'lamport',
  'fee payer',
  'feepayer',
  'rent',
  'signer had insufficient balance',
  'insufficient funds for fee',
  'insufficient balance for fee',
  'insufficient funds to cover',
  'insufficient balance to cover',
  'insufficient sol',
  'insufficient mon',
  'insufficient native',
  'not enough sol',
  'not enough mon',
  'not enough native',
  'native balance',
  'insufficient gas',
  'not enough gas',
  'for gas',
  'out of gas',
  'intrinsic gas',
  'underpriced',
  'attempt to debit an account but found no record'
];

export function classifySweepFailure(msg: unknown): SweepFailureClass {
  const raw = typeof msg === 'string' ? msg : msg instanceof Error ? msg.message : String(msg ?? '');
  // Normalize separators so 'fee-payer'/'fee_payer' match 'fee payer', etc.
  const lower = raw.toLowerCase().replace(/[-_]+/g, ' ');

  // Transaction-size error, never a fee shortfall — excluded from GAS.
  if (lower.includes('exceededmaxrepresentationsize')) return 'OTHER';

  if (
    lower.includes('blockhash') &&
    (lower.includes('not found') || lower.includes('notfound') || lower.includes('expired') || lower.includes('stale'))
  ) {
    return 'BLOCKHASH';
  }

  // Fail-safe order: TOKEN veto is checked before GAS so an ambiguous message
  // mentioning both sides never mints a drip.
  for (const p of TOKEN_STRONG_PATTERNS) {
    if (lower.includes(p)) return 'TOKEN';
  }
  if (/\bata\b/.test(lower) || lower.includes('mint')) return 'TOKEN';

  for (const p of GAS_STRONG_PATTERNS) {
    if (lower.includes(p)) return 'GAS';
  }

  return 'OTHER';
}

/**
 * Native gas drip receipt: who got how much native on which chain, and in
 * which transaction. Returned by dripNativeGas/sendCryptoWithGasRetry so
 * sweep engines can persist the drip (farming-defense ledger) without
 * restructuring their retry logic.
 */
export interface GasDripReceipt {
  txHash: string;
  amountNative: number;
  chain: 'solana' | 'monad';
  toAddress: string;
}

/** Validated drip tuning (env-tunable, parse-time validated — see below). */
export interface DripTuning {
  solMinBalance: number;
  solDripAmount: number;
  monMinBalance: number;
  monDripAmount: number;
}

/**
 * Parse a non-negative finite env float. Throws a clear error on garbage
 * (NaN/Infinity/negative/non-numeric) INSTEAD of feeding it into BigInt
 * conversions downstream, where it would surface as an obscure crash.
 */
function parseDripEnvFloat(name: string, raw: string | undefined, def: number): number {
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    throw new Error(`[SelfCustody] Invalid ${name}=${JSON.stringify(raw)}: must be a finite number (default ${def}). Refusing to drip on garbage env.`);
  }
  if (v < 0) {
    throw new Error(`[SelfCustody] Invalid ${name}=${v}: must be non-negative (default ${def}). Refusing to drip on garbage env.`);
  }
  return v;
}

/**
 * Validated drip tuning. Env knobs (all optional, defaults shown):
 * - SWEEP_SOL_MIN_BALANCE (default 0.002): skip drip when the Solana wallet
 *   already holds at least this much SOL.
 * - SWEEP_SOL_DRIP_AMOUNT (default 0.005): SOL sent per drip.
 * - SWEEP_MON_MIN_BALANCE (default 0.001): skip drip when the Monad wallet
 *   already holds at least this much MON.
 * - SWEEP_MON_DRIP_AMOUNT (default 0.005): MON sent per drip.
 */
export function getDripTuning(): DripTuning {
  return {
    solMinBalance: parseDripEnvFloat('SWEEP_SOL_MIN_BALANCE', process.env.SWEEP_SOL_MIN_BALANCE, 0.002),
    solDripAmount: parseDripEnvFloat('SWEEP_SOL_DRIP_AMOUNT', process.env.SWEEP_SOL_DRIP_AMOUNT, 0.005),
    monMinBalance: parseDripEnvFloat('SWEEP_MON_MIN_BALANCE', process.env.SWEEP_MON_MIN_BALANCE, 0.001),
    monDripAmount: parseDripEnvFloat('SWEEP_MON_DRIP_AMOUNT', process.env.SWEEP_MON_DRIP_AMOUNT, 0.005)
  };
}

/**
 * Optional drip-guard hooks for sendCryptoWithGasRetry. The chains package
 * has no DB dependency by design, so sweep engines (which own the DB) inject
 * eligibility + persistence here. When hooks are absent (e.g. non-sweep
 * callers), classification/drip behavior is unchanged but nothing is
 * persisted. `depositAmountUSDC` feeds the dust floor inside the eligibility
 * check; `trigger` defaults to 'SWEEP_RETRY' at the persistence layer.
 */
export interface DripHooks {
  depositAmountUSDC?: number;
  checkDripEligibility?: (ctx: {
    walletAddress: string;
    chain: 'solana' | 'monad';
    depositAmountUSDC?: number;
    dripAmountNative?: number;
  }) => Promise<{ eligible: boolean; reason?: string }>;
  recordDrip?: (rec: {
    walletAddress: string;
    chain: 'solana' | 'monad';
    amountNative: number;
    txHash: string;
    trigger: string;
    status: string;
  }) => Promise<void>;
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
  private evmTreasuryAddress: string;
  private evmTreasuryWalletId: string;
  private cachedEvmTreasuryAddress?: string;
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
    solanaTreasuryWalletId = process.env.KUDI_SOLANA_TREASURY_WALLET_ID || '',
    evmTreasuryAddress = process.env.KUDI_TREASURY_EVM_ADDRESS || '',
    evmTreasuryWalletId = process.env.KUDI_EVM_TREASURY_WALLET_ID || ''
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
    this.evmTreasuryAddress = evmTreasuryAddress;
    this.evmTreasuryWalletId = evmTreasuryWalletId;
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

    // Hoisted helpers — only populated by the Solana branch, but referenced by the
    // outer blockhash-retry handler so they must live at the sendCrypto scope level.
    let fetchFreshBlockhash: (() => Promise<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>) | null = null;
    let buildSerializedTx: ((blockhash: { blockhash: Blockhash; lastValidBlockHeight: bigint }) => string) | null = null;

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

      // Blockhash is fetched AFTER all slow RPC lookups (ATA derivation, account checks)
      // so it is as fresh as possible when Privy receives and simulates the transaction.
      // We will fetch it below, right before building the transaction message.

      // Create Solana JSON-RPC client (HTTP only — no WebSocket needed)
      const rpc = createSolanaRpc(this.rpcUrlSolana);

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

      // ─── Fetch blockhash as LATE as possible (after all slow RPC lookups) ─────────────
      // Using 'processed' commitment returns the very latest slot seen by this node,
      // minimising the gap between our fetch and Privy's simulation clock.
      // Solana blockhashes are valid for ~150 blocks (~60-90 s) so 'processed' still
      // gives plenty of runway while being the freshest option available.
      fetchFreshBlockhash = async () => {
        const { value } = await rpc.getLatestBlockhash({ commitment: 'processed' }).send();
        return value;
      };
      const latestBlockhash = await fetchFreshBlockhash();
      // ─────────────────────────────────────────────────────────────────────────────────

      /**
       * Build the unsigned wire-format transaction bytes for Privy.
       * Extracted as a helper so we can rebuild with a fresh blockhash on retry.
       */
      buildSerializedTx = (blockhash: { blockhash: Blockhash; lastValidBlockHeight: bigint }): string => {
        let txMessage;
        if (!destAtaExists) {
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
          txMessage = pipe(
            createTransactionMessage({ version: 0 as const }),
            (tx) => setTransactionMessageFeePayer(feePayerAddr, tx),
            (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
            (tx) => appendTransactionMessageInstruction(createDestAtaIx, tx),
            (tx) => appendTransactionMessageInstruction(transferIx, tx)
          );
        } else {
          txMessage = pipe(
            createTransactionMessage({ version: 0 as const }),
            (tx) => setTransactionMessageFeePayer(feePayerAddr, tx),
            (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
            (tx) => appendTransactionMessageInstruction(transferIx, tx)
          );
        }
        const compiled = compileTransaction(txMessage);
        const msgBytes = compiled.messageBytes as unknown as Uint8Array;
        const numSigs = Object.keys(compiled.signatures).length || 1;
        const wireBytes = new Uint8Array(1 + (numSigs * 64) + msgBytes.length);
        wireBytes[0] = numSigs;
        wireBytes.set(msgBytes, 1 + (numSigs * 64));
        return Buffer.from(wireBytes).toString('base64');
      };

      if (!destAtaExists) {
        console.log(`[SelfCustody] ℹ️ Destination ATA for treasury does not exist yet — including CreateIdempotent ATA instruction (user wallet pays).`);
      }

      requestBody = {
        method: 'signAndSendTransaction',
        caip2: this.solanaCaip2,
        ...(sponsorFlag ? { sponsor: true } : {}),
        params: { transaction: buildSerializedTx(latestBlockhash), encoding: 'base64' }
      };
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

    // Helper to send requestBody to Privy and handle gas-sponsorship fallback
    const sendToPrivy = async (body: Record<string, unknown>): Promise<Response> => {
      let res = await fetch(`https://api.privy.io/v1/wallets/${treasuryWalletId}/rpc`, {
        method: 'POST',
        headers: {
          'privy-app-id': this.appId,
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        // Retry without sponsor flag if Privy dashboard has gas sponsorship disabled
        if (sponsorFlag && errText.includes('Gas sponsorship is not configured')) {
          console.warn('[SelfCustody] ℹ️ Privy gas sponsorship not enabled in dashboard; retrying without sponsor flag...');
          const { sponsor: _omitted, ...bodyWithoutSponsor } = body;
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
      return res;
    };

    try {
      let res: Response;

      try {
        res = await sendToPrivy(requestBody);
      } catch (firstErr: any) {
        // ── Blockhash not found: automatic single retry with fresh blockhash ────────────
        // Privy's RPC node may lag behind ours by a slot or two, causing it to reject the
        // blockhash we embedded. We fetch a brand-new 'processed' blockhash and rebuild the
        // serialized transaction, then retry once. This is always safe — the tx hasn't been
        // signed or broadcast yet, so there is no double-spend risk.
        const isBlockhashError =
          firstErr?.message?.includes('Blockhash not found') ||
          firstErr?.message?.includes('blockhash not found') ||
          firstErr?.message?.includes('BlockhashNotFound') ||
          firstErr?.message?.includes('block hash not found');

        if (isSolana && isBlockhashError && fetchFreshBlockhash && buildSerializedTx) {
          console.warn('[SelfCustody] ⚠️ Privy blockhash rejected — fetching fresh blockhash and rebuilding tx (1 retry)...');
          try {
            const freshHash = await fetchFreshBlockhash();
            const freshTx = buildSerializedTx(freshHash);
            const retryBody = { ...requestBody, params: { transaction: freshTx, encoding: 'base64' } };
            res = await sendToPrivy(retryBody);
            console.log('[SelfCustody] ✅ Blockhash retry succeeded with fresh hash.');
          } catch (retryErr: any) {
            console.error('[SelfCustody] ❌ Blockhash retry also failed:', retryErr?.message);
            throw retryErr;
          }
        } else {
          throw firstErr;
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
   * Resolve the treasury EVM address: explicit env first, else the address of
   * the configured Privy EVM server wallet (fetched once and cached).
   */
  private async getEvmTreasuryAddress(): Promise<string> {
    if (this.evmTreasuryAddress) return this.evmTreasuryAddress;
    if (this.cachedEvmTreasuryAddress) return this.cachedEvmTreasuryAddress;
    if (!this.evmTreasuryWalletId) {
      throw new Error(
        '[SelfCustody] EVM treasury address unresolved: set KUDI_TREASURY_EVM_ADDRESS or KUDI_EVM_TREASURY_WALLET_ID.'
      );
    }
    const res = await fetch(`https://api.privy.io/v1/wallets/${this.evmTreasuryWalletId}`, {
      headers: {
        'privy-app-id': this.appId,
        Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`
      }
    });
    if (!res.ok) {
      throw new Error(`[SelfCustody] Could not resolve EVM treasury address from Privy wallet ${this.evmTreasuryWalletId}: ${res.status}`);
    }
    const data = await res.json() as any;
    const address = data.address || data.data?.address;
    if (!address) throw new Error('[SelfCustody] Privy wallet lookup returned no address for EVM treasury.');
    this.cachedEvmTreasuryAddress = address;
    return address;
  }

  /** Compile an unsigned @solana/kit transaction message to Privy wire format. */
  private compileUnsignedBase64(txMessage: any): string {
    const compiled = compileTransaction(txMessage);
    const msgBytes = compiled.messageBytes as unknown as Uint8Array;
    const numSigs = Object.keys(compiled.signatures).length || 1;
    const wireBytes = new Uint8Array(1 + (numSigs * 64) + msgBytes.length);
    wireBytes[0] = numSigs;
    wireBytes.set(msgBytes, 1 + (numSigs * 64));
    return Buffer.from(wireBytes).toString('base64');
  }

  private privyRpc(walletId: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
      method: 'POST',
      headers: {
        'privy-app-id': this.appId,
        Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  /**
   * Treasury gas drip: fund a deposit wallet's NATIVE balance from treasury so
   * it can pay its own transaction fees. The treasury signs its OWN transfer
   * (single signer — no 2-signer problem). Skips when the wallet already holds
   * at least the minimum. Amounts/thresholds are env-tunable and validated at
   * parse time (see getDripTuning — garbage env throws a clear error instead
   * of feeding NaN into BigInt).
   *
   * Returns the drip receipt (amountNative/chain/toAddress) alongside the
   * broadcast hash so sweep engines can persist it. `confirmed` reports the
   * waitForConfirmation outcome — broadcast failures still throw, but a
   * confirmation TIMEOUT is returned (not thrown) so the caller can persist a
   * TIMEOUT drip record instead of losing it inside an exception.
   */
  async dripNativeGas(params: { toAddress: string; chain: 'solana' | 'monad' }): Promise<{
    dripped: boolean;
    txHash?: string;
    amountNative?: number;
    chain?: 'solana' | 'monad';
    toAddress?: string;
    drip?: GasDripReceipt;
    confirmed?: boolean;
  }> {
    const { toAddress, chain } = params;
    const isSolana = chain === 'solana';
    const tuning = getDripTuning();
    const minBalance = isSolana ? tuning.solMinBalance : tuning.monMinBalance;
    const dripAmount = isSolana ? tuning.solDripAmount : tuning.monDripAmount;

    const current = Number(await this.getWalletBalance(toAddress, chain));
    if (Number.isFinite(current) && current >= minBalance) {
      return { dripped: false };
    }

    if (isSolana) {
      if (!this.solanaTreasuryAddress || !this.solanaTreasuryWalletId) {
        throw new Error('[SelfCustody] Cannot drip SOL: KUDI_TREASURY_SOLANA_ADDRESS / KUDI_SOLANA_TREASURY_WALLET_ID not configured.');
      }
      const fromAddr = solanaAddress(this.solanaTreasuryAddress as Address);
      const toAddr = solanaAddress(toAddress as Address);
      const lamports = BigInt(Math.floor(dripAmount * 1e9));
      // SystemProgram.transfer (index 2): u32 LE discriminator + u64 LE lamports.
      const data = new Uint8Array(12);
      const view = new DataView(data.buffer);
      view.setUint32(0, 2, true);
      view.setBigUint64(4, lamports, true);
      const transferIx = {
        programAddress: solanaAddress('11111111111111111111111111111111' as Address),
        accounts: [
          { address: fromAddr, role: 3 as const }, // Writable Signer (treasury pays + signs)
          { address: toAddr, role: 1 as const }    // Writable (deposit wallet)
        ],
        data
      };
      const rpc = createSolanaRpc(this.rpcUrlSolana);
      const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
      const txMessage = pipe(
        createTransactionMessage({ version: 0 as const }),
        (tx) => setTransactionMessageFeePayer(fromAddr, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstruction(transferIx, tx)
      );
      const res = await this.privyRpc(this.solanaTreasuryWalletId, {
        method: 'signAndSendTransaction',
        caip2: this.solanaCaip2,
        params: { transaction: this.compileUnsignedBase64(txMessage), encoding: 'base64' }
      });
      if (!res.ok) {
        throw new Error(`[SelfCustody] Treasury SOL drip failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
      const data2 = await res.json() as any;
      const txHash = data2.data?.signature || data2.signature || data2.data?.hash || data2.hash || data2.result;
      if (!txHash) throw new Error('[SelfCustody] Treasury SOL drip returned no signature.');
      console.log(`[SelfCustody] 💧 Dripped ${dripAmount} SOL treasury → deposit wallet for gas: ${String(txHash).slice(0, 20)}...`);
      const confirmed = await this.waitForConfirmation(txHash, 'solana');
      if (!confirmed) {
        console.warn(`[SelfCustody] ⏰ Treasury SOL drip ${String(txHash).slice(0, 20)}... broadcast but NOT confirmed before timeout (persist as TIMEOUT).`);
      }
      const drip: GasDripReceipt = { txHash, amountNative: dripAmount, chain, toAddress };
      return { dripped: true, txHash, amountNative: dripAmount, chain, toAddress, drip, confirmed };
    }

    // Monad/EVM native transfer: treasury signs its own tx (treasury pays itself).
    await this.getEvmTreasuryAddress();
    const dripWei = BigInt(Math.floor(dripAmount * 1e18));
    const res = await this.privyRpc(this.evmTreasuryWalletId, {
      method: 'eth_sendTransaction',
      caip2: `eip155:${this.monadChainId}`,
      params: { transaction: { to: toAddress, value: `0x${dripWei.toString(16)}` } }
    });
    if (!res.ok) {
      throw new Error(`[SelfCustody] Treasury MON drip failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    const data3 = await res.json() as any;
    const txHash = data3.data?.hash || data3.hash || data3.result;
    if (!txHash) throw new Error('[SelfCustody] Treasury MON drip returned no hash.');
    console.log(`[SelfCustody] 💧 Dripped ${dripAmount} MON treasury → deposit wallet for gas: ${String(txHash).slice(0, 20)}...`);
    const confirmed = await this.waitForConfirmation(txHash, 'monad');
    if (!confirmed) {
      console.warn(`[SelfCustody] ⏰ Treasury MON drip ${String(txHash).slice(0, 20)}... broadcast but NOT confirmed before timeout (persist as TIMEOUT).`);
    }
    const drip: GasDripReceipt = { txHash, amountNative: dripAmount, chain, toAddress };
    return { dripped: true, txHash, amountNative: dripAmount, chain, toAddress, drip, confirmed };
  }

  /**
   * Sweep send with one automatic recovery retry, gated by the structured
   * failure classifier (farming defense):
   * - GAS (native fee shortfall ONLY): drip-guard hooks run first (eligibility
   *   BEFORE dripping — ineligible throws DripBlocked loudly with no drip),
   *   then drip + persist (CONFIRMED only after waitForConfirmation, else
   *   TIMEOUT), then retry once.
   * - BLOCKHASH: retry once WITHOUT dripping.
   * - TOKEN/OTHER: throw immediately — never drip on token shortfall or
   *   ambiguous errors.
   */
  async sendCryptoWithGasRetry(
    params: Parameters<SelfCustodyProvider['sendCrypto']>[0],
    signerAddress: string,
    dripHooks?: DripHooks
  ): Promise<{ txHash: string; drip?: GasDripReceipt }> {
    try {
      return await this.sendCrypto(params);
    } catch (err: any) {
      const originalMsg = err?.message || String(err);
      const failureClass = classifySweepFailure(originalMsg);
      if (failureClass === 'BLOCKHASH') {
        console.log(`[SelfCustody] 🔄 Stale blockhash (${failureClass}), retrying broadcast once WITHOUT drip (${params.chain})...`);
        return await this.sendCrypto(params);
      }
      if (failureClass !== 'GAS') {
        // TOKEN/OTHER: dripping cannot help (token shortfall, config error,
        // ambiguous failure) — and dripping on it would be farmable. Loud.
        console.error(`[SelfCustody] 🛑 Sweep failure classified as ${failureClass} — NOT dripping, throwing immediately.`);
        throw err;
      }
      if (!signerAddress) throw err;
      console.log(`[SelfCustody] ⛽ Signer lacks gas (classified GAS), dripping from treasury then retrying (${params.chain})...`);
      // Drip-guard: eligibility BEFORE any drip. Ineligible → fail loudly with
      // a greppable DripBlocked reason and NO drip broadcast.
      if (dripHooks?.checkDripEligibility) {
        let decision: { eligible: boolean; reason?: string };
        try {
          const tuning = getDripTuning();
          decision = await dripHooks.checkDripEligibility({
            walletAddress: signerAddress,
            chain: params.chain,
            depositAmountUSDC: dripHooks.depositAmountUSDC,
            dripAmountNative: params.chain === 'solana' ? tuning.solDripAmount : tuning.monDripAmount
          });
        } catch (guardErr: any) {
          throw new Error(`DripBlocked:ELIGIBILITY_CHECK_FAILED: ${guardErr?.message || guardErr} [sweep error: ${originalMsg}]`);
        }
        if (!decision.eligible) {
          throw new Error(`DripBlocked:${decision.reason || 'INELIGIBLE'}: treasury drip refused for ${signerAddress} on ${params.chain} [sweep error: ${originalMsg}]`);
        }
      }
      let dripResult: Awaited<ReturnType<SelfCustodyProvider['dripNativeGas']>>;
      try {
        dripResult = await this.dripNativeGas({ toAddress: signerAddress, chain: params.chain });
      } catch (dripErr: any) {
        throw new Error(`${originalMsg} [gas drip also failed: ${dripErr?.message || dripErr}]`);
      }
      const dripReceipt = dripResult.drip;
      if (dripReceipt && dripHooks?.recordDrip) {
        try {
          await dripHooks.recordDrip({
            walletAddress: signerAddress,
            chain: params.chain,
            amountNative: dripReceipt.amountNative,
            txHash: dripReceipt.txHash,
            trigger: 'SWEEP_RETRY',
            status: dripResult.confirmed ? 'CONFIRMED' : 'TIMEOUT'
          });
        } catch (recordErr: any) {
          // Loud but non-fatal: the money movement (sweep retry) matters more
          // than the bookkeeping row. A DB outage here is observable via logs;
          // caps resume enforcing once the DB is back.
          console.error(`[SelfCustody] ⚠️ Drip broadcast succeeded but recordDrip failed (caps may under-count until DB recovers): ${recordErr?.message || recordErr}`);
        }
      }
      const retryRes = await this.sendCrypto(params);
      return { txHash: retryRes.txHash, drip: dripReceipt };
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
