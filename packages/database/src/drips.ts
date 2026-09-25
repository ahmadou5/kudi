/**
 * Gas-drip farming defense (shared by the API sweep engine and the worker
 * sweep engine — both call sites import these helpers from @kudi/database).
 *
 * Every treasury native-gas drip is gated BEFORE broadcast and recorded AFTER:
 * - checkDripEligibility: per-wallet 24h limit, global daily cap per chain,
 *   treasury native floor (live RPC read), and a minimum sweepable-deposit
 *   floor so dust deposits never mint a drip.
 * - recordDrip: persists the broadcast drip (CONFIRMED only after
 *   waitForConfirmation, else TIMEOUT/BROADCAST).
 *
 * Raw SQL via $queryRaw/$executeRaw is used deliberately so the helpers work
 * with any generated Prisma client version (the GasDrip delegate may not
 * exist in a stale generated client, but the table does once the runtime
 * schema bootstrap has run).
 *
 * Env knobs (all optional; validated at parse time — garbage throws a clear
 * error instead of feeding NaN into BigInt/SQL):
 * - SWEEP_MAX_DRIPS_PER_WALLET_PER_DAY (default 1): max drips per wallet / 24h.
 * - SWEEP_DAILY_DRIP_CAP_SOL (default 0.5): global daily drip cap, SOL.
 * - SWEEP_DAILY_DRIP_CAP_MON (default 0.5): global daily drip cap, MON.
 * - SWEEP_TREASURY_FLOOR_SOL (default 0.5): drip refused when the SOL
 *   treasury native balance is below this (SOL).
 * - SWEEP_TREASURY_FLOOR_MON (default 0.5): same for the MON treasury.
 * - SWEEP_MIN_DRIP_DEPOSIT_USDC (default 1.0): deposits below this (USDC)
 *   never trigger a drip (dust defense).
 * - SWEEP_SOL_DRIP_AMOUNT / SWEEP_MON_DRIP_AMOUNT (defaults 0.005/0.005):
 *   per-drip native amounts (owned by @kudi/chains getDripTuning; re-read
 *   here only to size cap accounting when the caller omits dripAmountNative).
 */

export type DripChain = 'solana' | 'monad';

export type DripStatus = 'BROADCAST' | 'CONFIRMED' | 'TIMEOUT';

export interface DripEligibilityRequest {
  walletAddress: string;
  chain: DripChain;
  /** Sweepable deposit size — dust below the floor never drips. */
  depositAmountUSDC?: number;
  /** Native amount about to be dripped — sizes global-cap accounting. */
  dripAmountNative?: number;
}

export interface DripEligibilityDecision {
  eligible: boolean;
  /** Machine-readable block reason (surfaced as DripBlocked:<REASON>). */
  reason?: string;
}

export interface DripRecord {
  walletAddress: string;
  chain: DripChain;
  amountNative: number;
  txHash: string;
  trigger?: string;
  status: DripStatus | string;
}

/** Minimal Prisma surface used (raw SQL only — no generated delegate). */
export interface DripPrisma {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

export interface DripPolicy {
  maxDripsPerWalletPerDay: number;
  dailyCapSol: number;
  dailyCapMon: number;
  treasuryFloorSol: number;
  treasuryFloorMon: number;
  minDepositUSDC: number;
  solDripAmount: number;
  monDripAmount: number;
}

function parsePolicyFloat(name: string, raw: string | undefined, def: number, positive: boolean): number {
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    throw new Error(`[drips] Invalid ${name}=${JSON.stringify(raw)}: must be a finite number (default ${def}).`);
  }
  if (v < 0) {
    throw new Error(`[drips] Invalid ${name}=${v}: must be non-negative (default ${def}).`);
  }
  if (positive && !(v > 0)) {
    throw new Error(`[drips] Invalid ${name}=${v}: must be > 0 (default ${def}).`);
  }
  return v;
}

function parsePolicyInt(name: string, raw: string | undefined, def: number): number {
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || !Number.isInteger(v)) {
    throw new Error(`[drips] Invalid ${name}=${JSON.stringify(raw)}: must be a finite integer (default ${def}).`);
  }
  if (v < 0) {
    throw new Error(`[drips] Invalid ${name}=${v}: must be non-negative (default ${def}).`);
  }
  return v;
}

/** Validated drip policy (throws a clear error on garbage env). */
export function getDripPolicy(): DripPolicy {
  return {
    maxDripsPerWalletPerDay: parsePolicyInt(
      'SWEEP_MAX_DRIPS_PER_WALLET_PER_DAY', process.env.SWEEP_MAX_DRIPS_PER_WALLET_PER_DAY, 1
    ),
    dailyCapSol: parsePolicyFloat('SWEEP_DAILY_DRIP_CAP_SOL', process.env.SWEEP_DAILY_DRIP_CAP_SOL, 0.5, true),
    dailyCapMon: parsePolicyFloat('SWEEP_DAILY_DRIP_CAP_MON', process.env.SWEEP_DAILY_DRIP_CAP_MON, 0.5, true),
    treasuryFloorSol: parsePolicyFloat('SWEEP_TREASURY_FLOOR_SOL', process.env.SWEEP_TREASURY_FLOOR_SOL, 0.5, false),
    treasuryFloorMon: parsePolicyFloat('SWEEP_TREASURY_FLOOR_MON', process.env.SWEEP_TREASURY_FLOOR_MON, 0.5, false),
    minDepositUSDC: parsePolicyFloat('SWEEP_MIN_DRIP_DEPOSIT_USDC', process.env.SWEEP_MIN_DRIP_DEPOSIT_USDC, 1.0, false),
    solDripAmount: parsePolicyFloat('SWEEP_SOL_DRIP_AMOUNT', process.env.SWEEP_SOL_DRIP_AMOUNT, 0.005, false),
    monDripAmount: parsePolicyFloat('SWEEP_MON_DRIP_AMOUNT', process.env.SWEEP_MON_DRIP_AMOUNT, 0.005, false)
  };
}

/** Live treasury native balance (SOL/MON), or null when unreadable. */
async function getTreasuryNativeBalance(chain: DripChain): Promise<number | null> {
  const timeoutMs = 10_000;
  try {
    if (chain === 'solana') {
      const treasury = process.env.KUDI_TREASURY_SOLANA_ADDRESS || '';
      if (!treasury) return null;
      const rpcUrls = [process.env.SOLANA_RPC_URL, process.env.SOLANA_RPC_URL_FALLBACK].filter(Boolean) as string[];
      if (rpcUrls.length === 0) return null;
      for (const rpcUrl of rpcUrls) {
        try {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'getBalance', params: [treasury], id: 1 }),
            signal: AbortSignal.timeout(timeoutMs)
          });
          const data = (await res.json()) as { result?: { value?: number }; error?: unknown };
          if (typeof data.result?.value === 'number') return data.result.value / 1e9;
        } catch {
          continue; // try next RPC URL
        }
      }
      return null;
    }
    const treasury =
      process.env.KUDI_TREASURY_EVM_ADDRESS || process.env.KUDI_MONAD_TREASURY_ADDRESS || '';
    if (!treasury) return null;
    const rpcUrls = [process.env.MONAD_RPC_URL, process.env.EVM_RPC_URL, process.env.MONAD_RPC_URL_FALLBACK].filter(
      Boolean
    ) as string[];
    if (rpcUrls.length === 0) return null;
    for (const rpcUrl of rpcUrls) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [treasury, 'latest'], id: 1 }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        const data = (await res.json()) as { result?: string; error?: unknown };
        if (typeof data.result === 'string' && data.result.startsWith('0x')) {
          return Number(BigInt(data.result)) / 1e18;
        }
      } catch {
        continue; // try next RPC URL
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gate a treasury drip BEFORE broadcast. Checks, cheapest first:
 * (d) dust floor — deposit below SWEEP_MIN_DRIP_DEPOSIT_USDC never drips;
 * (a) per-wallet 24h limit; (b) global daily cap per chain (native units);
 * (c) treasury native floor via live RPC balance.
 * Fail-closed: an unreadable treasury balance or missing treasury address is
 * INELIGIBLE (fail loudly via the returned reason — the caller throws
 * DripBlocked — rather than dripping blind).
 */
export async function checkDripEligibility(
  prisma: DripPrisma,
  req: DripEligibilityRequest
): Promise<DripEligibilityDecision> {
  if (req.chain !== 'solana' && req.chain !== 'monad') {
    throw new Error(`[drips] Invalid chain=${JSON.stringify((req as { chain?: unknown }).chain)}: must be 'solana' | 'monad'.`);
  }
  if (!req.walletAddress) {
    throw new Error('[drips] walletAddress is required for drip eligibility.');
  }
  const policy = getDripPolicy(); // throws on garbage env — fail loudly, never NaN
  const dripAmount =
    req.dripAmountNative !== undefined ? req.dripAmountNative : req.chain === 'solana' ? policy.solDripAmount : policy.monDripAmount;
  if (!Number.isFinite(dripAmount) || dripAmount < 0) {
    throw new Error(`[drips] Invalid dripAmountNative=${String(req.dripAmountNative)}: must be a finite non-negative number.`);
  }

  // (d) Dust floor — no DB/RPC I/O needed.
  if (req.depositAmountUSDC !== undefined && Number.isFinite(req.depositAmountUSDC)) {
    if (req.depositAmountUSDC < policy.minDepositUSDC) {
      return { eligible: false, reason: `MIN_DEPOSIT_FLOOR: deposit ${req.depositAmountUSDC} USDC < floor ${policy.minDepositUSDC} USDC` };
    }
  }

  // (a) Per-wallet 24h limit.
  const walletRows = (await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "GasDrip"
    WHERE "walletAddress" = ${req.walletAddress}
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `) as Array<{ count: number }>;
  const walletCount = Number(walletRows?.[0]?.count ?? 0);
  if (walletCount >= policy.maxDripsPerWalletPerDay) {
    return {
      eligible: false,
      reason: `WALLET_DAILY_LIMIT: ${walletCount} drip(s) for wallet in last 24h (max ${policy.maxDripsPerWalletPerDay})`
    };
  }

  // (b) Global daily cap per chain (native units).
  const cap = req.chain === 'solana' ? policy.dailyCapSol : policy.dailyCapMon;
  const sumRows = (await prisma.$queryRaw`
    SELECT COALESCE(SUM("amountNative"), 0)::float AS total
    FROM "GasDrip"
    WHERE chain = ${req.chain}
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
  `) as Array<{ total: number }>;
  const spent = Number(sumRows?.[0]?.total ?? 0);
  if (spent + dripAmount > cap) {
    return {
      eligible: false,
      reason: `GLOBAL_DAILY_CAP: ${spent} + ${dripAmount} native on ${req.chain} would exceed daily cap ${cap}`
    };
  }

  // (c) Treasury native floor via live RPC. Fail closed on unreadable balance.
  const floor = req.chain === 'solana' ? policy.treasuryFloorSol : policy.treasuryFloorMon;
  const treasuryBalance = await getTreasuryNativeBalance(req.chain);
  if (treasuryBalance === null || !Number.isFinite(treasuryBalance)) {
    return { eligible: false, reason: 'TREASURY_BALANCE_UNKNOWN: cannot verify treasury native balance — refusing to drip blind' };
  }
  if (treasuryBalance < floor) {
    return {
      eligible: false,
      reason: `TREASURY_FLOOR: treasury native balance ${treasuryBalance} < floor ${floor} on ${req.chain}`
    };
  }

  return { eligible: true };
}

/**
 * Persist a broadcast drip. `status` is CONFIRMED only after
 * waitForConfirmation, else TIMEOUT/BROADCAST (decided by the caller).
 * Idempotent on txHash — a re-record keeps the first row (confirmation
 * upgrades should pass status CONFIRMED on the first record path).
 */
export async function recordDrip(prisma: DripPrisma, rec: DripRecord): Promise<void> {
  if (rec.chain !== 'solana' && rec.chain !== 'monad') {
    throw new Error(`[drips] Invalid chain=${JSON.stringify((rec as { chain?: unknown }).chain)}: must be 'solana' | 'monad'.`);
  }
  if (!rec.walletAddress) throw new Error('[drips] walletAddress is required to record a drip.');
  if (!rec.txHash) throw new Error('[drips] txHash is required to record a drip.');
  if (!Number.isFinite(rec.amountNative) || rec.amountNative < 0) {
    throw new Error(`[drips] Invalid amountNative=${String(rec.amountNative)}: must be a finite non-negative number.`);
  }
  const allowed = new Set(['BROADCAST', 'CONFIRMED', 'TIMEOUT']);
  if (!allowed.has(String(rec.status))) {
    throw new Error(`[drips] Invalid status=${JSON.stringify(rec.status)}: must be one of BROADCAST|CONFIRMED|TIMEOUT.`);
  }
  const trigger = rec.trigger || 'SWEEP_RETRY';
  await prisma.$executeRaw`
    INSERT INTO "GasDrip" (id, "walletAddress", chain, "amountNative", "txHash", trigger, status, "createdAt")
    VALUES (gen_random_uuid()::text, ${rec.walletAddress}, ${rec.chain}, ${rec.amountNative}, ${rec.txHash}, ${trigger}, ${String(rec.status)}, NOW())
    ON CONFLICT ("txHash") DO NOTHING
  `;
}
