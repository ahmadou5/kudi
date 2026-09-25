import { GeneralizedEVMListener, SolanaListener, EVMDepositEvent, SolanaDepositEvent, SelfCustodyProvider } from '@kudi/chains';
import {
  SWEEP_RETRY_POLICY,
  parseDepositAmount,
  resolveGasPaymentMode,
  resolveSweepAmount
} from '@kudi/chains';
import { EVMChainConfig, SolanaChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';
import { REDACTED, redactAddress, redactRpcUrl } from '@kudi/config';

// Retry schedule is owned by SWEEP_RETRY_POLICY (single shared definition in
// @kudi/chains; API SweepWorkerService is the designated sweep owner). This
// processor reuses the same cap/backoff so the two engines converge instead
// of flapping between divergent policies.
const SWEEP_MAX_ATTEMPTS = SWEEP_RETRY_POLICY.MAX_ATTEMPTS;

interface DepositWalletRow {
  id: string;
  userId: string;
  address: string;
  chain: string;
  privyWalletId?: string | null;
  custodyType?: string | null;
}

export class ChainDepositProcessor {
  private evmListener: GeneralizedEVMListener;
  private solanaListener: SolanaListener;
  private watchedEvmAddresses: string[] = [];
  private watchedSolanaAddresses: string[] = [];
  private selfCustody: SelfCustodyProvider;

  constructor(monadConfig: EVMChainConfig, solanaConfig?: Partial<SolanaChainConfig>) {
    this.evmListener = new GeneralizedEVMListener([monadConfig]);
    this.solanaListener = new SolanaListener(solanaConfig);
    this.selfCustody = new SelfCustodyProvider();
  }

  public getSolanaConfig() {
    return this.solanaListener.getConfig();
  }

  /**
   * Resolve the effective gas payment mode: DB sweep_config wins, env only as
   * fallback, always a validated union member (never undefined).
   */
  private async getStoredGasPaymentMode() {
    try {
      const config = await prisma.appConfig.findUnique({ where: { key: 'sweep_config' } });
      if (config?.value) {
        return resolveGasPaymentMode(JSON.parse(config.value).gasPaymentMode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChainDepositProcessor] Could not read sweep_config, using env/default gas mode: ${msg}`);
    }
    return resolveGasPaymentMode(undefined);
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

  private async getRecentProcessedSignatures(limit = 5000): Promise<Set<string>> {
    try {
      const rows: Array<{ signature: string }> = await prisma.$queryRaw`
        SELECT signature
        FROM "ProcessedSignature"
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `;
      return new Set(rows.map((row) => row.signature));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ChainDepositProcessor] Could not load processed signatures before Solana poll: ${msg}`);
      return new Set();
    }
  }

  public async pollAllChains(): Promise<void> {
    const { evm: evmAddresses, solana: solanaAddresses } = await this.getActiveAddresses();
    const enabledEVMs = this.evmListener.getEnabledChains();

    for (const chain of enabledEVMs) {
      if (evmAddresses.length === 0) {
        console.log(`🔗 [Chain Processor] No EVM user deposit addresses registered in DB.`);
        continue;
      }
      console.log(`🔗 [Chain Processor] Polling EVM RPC (${chain.name} - ${redactRpcUrl(chain.rpcUrl)}) for ${evmAddresses.length} wallet(s)...`);
      try {
        const events: EVMDepositEvent[] = await this.evmListener.pollChainForDeposits(chain.id, evmAddresses);
        for (const ev of events) {
          // Confirmation gate: unconfirmed logs are skipped/logged, never credited.
          if (!ev.confirmed) {
            console.log(`⏳ [Chain Processor] Skipping unconfirmed EVM deposit ${ev.txHash.slice(0, 12)}... (block ${ev.blockNumber})`);
            continue;
          }
            console.log(`✅ [Chain Processor] Confirmed EVM Deposit: ${ev.amountToken} ${chain.tokenSymbol} on ${chain.name} (Tx: ${ev.txHash.slice(0, 12)}...)`);
          await this.processDepositEvent({
            address: ev.userWalletAddress,
            amountUSDC: Number(ev.amountToken),
            signature: ev.txHash,
            chain: chain.id,
            tokenSymbol: chain.tokenSymbol,
            blockNumber: ev.blockNumber,
            confirmed: ev.confirmed
          });
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
      const processedSignatures = await this.getRecentProcessedSignatures();
      const solEvents: SolanaDepositEvent[] = await this.solanaListener.pollSolanaForDeposits(solanaAddresses, processedSignatures);
      for (const ev of solEvents) {
        // Confirmation gate (defense in depth — the listener only emits
        // finalized events, but credit still requires confirmed === true).
        if (!ev.confirmed) {
          console.log(`⏳ [Chain Processor] Skipping unconfirmed Solana deposit ${ev.signature.slice(0, 12)}...`);
          continue;
        }
        console.log(`✅ [Chain Processor] Confirmed Solana Deposit: ${ev.amountUSDC} USDC (Signature: ${ev.signature.slice(0, 12)}...)`);
        await this.processDepositEvent({
          address: ev.userWalletAddress,
          amountUSDC: Number(ev.amountUSDC),
          signature: ev.signature,
          chain: 'solana',
          tokenSymbol: 'USDC',
          confirmed: ev.confirmed
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️ [Chain Processor] Error polling Solana RPC: ${msg}`);
    }
  }


  private targetTreasuryFor(chain: string): string | undefined {
    if (chain === 'solana') return process.env.KUDI_TREASURY_SOLANA_ADDRESS;
    return process.env.KUDI_TREASURY_EVM_ADDRESS || process.env.KUDI_MONAD_TREASURY_ADDRESS || process.env.KUDI_TREASURY_EVM_ADDRESS;
  }

  private async updateDepositSweep(signature: string, status: string, txHash?: string, error?: string, actualSweptUSDC?: number): Promise<void> {
    const shouldRetry = status === 'SWEEP_FAILED' || status === 'SWEEP_BLOCKED';
    await prisma.$executeRaw`
      UPDATE "Deposit"
      SET "sweepStatus" = ${status},
          "sweepTxHash" = COALESCE(${txHash ?? null}, "sweepTxHash"),
          -- Record the ACTUAL swept amount (no dedicated column exists without a
          -- migration, so amountUSDC is corrected to on-chain reality on SWEPT).
          "amountUSDC" = COALESCE(${actualSweptUSDC ?? null}, "amountUSDC"),
          "sweepError" = ${error ?? null},
          "sweepAttemptCount" = CASE
            WHEN ${status} = 'SWEEP_PROCESSING' THEN "sweepAttemptCount" + 1
            ELSE "sweepAttemptCount"
          END,
          "nextSweepAttemptAt" = CASE
            -- Shared retry schedule: 2^(attempt-1) minutes, capped at 64 (mirrors
            -- SWEEP_RETRY_POLICY in @kudi/chains; SQL-side equivalent).
            WHEN ${shouldRetry} THEN NOW() + (LEAST(64, POWER(2, GREATEST("sweepAttemptCount", 1) - 1)) * INTERVAL '1 minute')
            WHEN ${status} = 'SWEPT' THEN "nextSweepAttemptAt"
            ELSE NOW()
          END,
          "sweptAt" = CASE WHEN ${status} = 'SWEPT' THEN NOW() ELSE "sweptAt" END,
          "updatedAt" = NOW()
      WHERE signature = ${signature}
    `;
  }

  private async attemptSweep(params: {
    signature: string;
    wallet: DepositWalletRow;
    chain: string;
    amountUSDC: number;
    alreadyMarkedProcessing?: boolean;
  }): Promise<void> {
    const normalizedChain = params.chain === 'solana' ? 'solana' : 'monad';
    const targetTreasury = this.targetTreasuryFor(normalizedChain);

    if (!targetTreasury) {
      const errMsg = `Missing treasury address for ${normalizedChain}`;
      console.error(`[Chain Processor] ❌ ${normalizedChain.toUpperCase()} sweep BLOCKED: ${errMsg}`);
      await this.updateDepositSweep(params.signature, 'SWEEP_BLOCKED', undefined, errMsg);
      return;
    }

    if (!params.wallet.privyWalletId) {
      const errMsg = `Wallet ${params.wallet.address} has no privyWalletId stored in DB`;
      console.error(`[Chain Processor] ❌ ${normalizedChain.toUpperCase()} sweep SKIPPED: ${errMsg.split(params.wallet.address).join(redactAddress(params.wallet.address))}`);
      await this.updateDepositSweep(params.signature, 'FLOAT_EXPOSURE', undefined, errMsg);
      return;
    }

    try {
      if (!params.alreadyMarkedProcessing) {
        await this.updateDepositSweep(params.signature, 'SWEEP_PROCESSING');
      }
      const gasPaymentMode = await this.getStoredGasPaymentMode();
      const parsedAmount = parseDepositAmount(params.amountUSDC);
      if (parsedAmount === null) {
        throw new Error(`Invalid sweep amount for ${params.signature}: ${String(params.amountUSDC)}`);
      }

      // Pre-sweep on-chain balance check: sweep min(detected, available - reserve).
      const tokenAddress = normalizedChain === 'solana'
        ? (process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
        : (process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3');
      const available = Number(
        await this.selfCustody.getWalletBalance(params.wallet.address, normalizedChain, tokenAddress)
      );
      if (!Number.isFinite(available) || available <= 0) {
        throw new Error(`INSUFFICIENT_FUNDS: on-chain balance ${available} < detected ${parsedAmount} for ${params.wallet.address}`);
      }
      const { sweepAmount, shortfallUSDC } = resolveSweepAmount({
        detectedUSDC: parsedAmount,
        availableUSDC: available,
        chain: normalizedChain
      });
      if (sweepAmount <= 0) {
        throw new Error(`INSUFFICIENT_FUNDS: available ${available} covers only reserve for ${params.wallet.address} (detected ${parsedAmount})`);
      }
      if (shortfallUSDC > 0) {
        console.warn(
          `[Chain Processor] ⚠️ Partial sweep: detected ${parsedAmount} but only ${sweepAmount} available on-chain ` +
          `(shortfall ${shortfallUSDC}) for ${params.wallet.address} — sweeping actual balance.`
        );
      }

      console.log(`[Chain Processor] 🔄 Sweeping ${sweepAmount} USDC from deposit ${params.wallet.address} → treasury (${targetTreasury})...`);
      const { txHash } = await this.selfCustody.sendCrypto({
        treasuryWalletId: params.wallet.privyWalletId,
        fromAddress: normalizedChain === 'solana' ? params.wallet.address : undefined,
        // feePayerAddress intentionally omitted: user wallet (signerAddr) always pays its own fees.
        // TREASURY_FEE_PAYER is rejected loudly inside sendCrypto (2nd signer unavailable via Privy).
        toAddress: targetTreasury,
        amountUSDC: sweepAmount,
        chain: normalizedChain,
        gasPaymentMode
      });
      const confirmed = await this.selfCustody.waitForConfirmation(txHash, normalizedChain);
      if (!confirmed) {
        throw new Error(`Sweep transaction ${txHash} was not confirmed before timeout`);
      }
      await this.updateDepositSweep(params.signature, 'SWEPT', txHash, undefined, sweepAmount);
      console.log(`[Chain Processor] 🏦 ${normalizedChain.toUpperCase()} sweep CONFIRMED for ${params.signature.slice(0, 12)}... | TxHash: ${txHash} | swept ${sweepAmount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.updateDepositSweep(params.signature, 'SWEEP_FAILED', undefined, message);
      console.error(`[Chain Processor] ❌ ${normalizedChain.toUpperCase()} sweep FAILED for signature ${params.signature.slice(0, 12)}...: ${message}`);
    }
  }

  public async recoverStaleProcessingSweeps(maxAgeMinutes = 10): Promise<void> {
    const rows: Array<{ signature: string }> = await prisma.$queryRaw`
      UPDATE "Deposit"
      SET "sweepStatus" = 'SWEEP_FAILED',
          "sweepError" = CONCAT('Recovered stale SWEEP_PROCESSING after ', ${maxAgeMinutes}, ' minutes; will retry'),
          "nextSweepAttemptAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "sweepStatus" = 'SWEEP_PROCESSING'
        AND "sweptAt" IS NULL
        AND "updatedAt" < NOW() - (${maxAgeMinutes} * INTERVAL '1 minute')
      RETURNING signature
    `;

    if (rows.length > 0) {
      console.warn('[Chain Processor] Recovered ' + rows.length + ' stale sweep(s) from SWEEP_PROCESSING.');
    }
  }
  public async processSweepRetries(): Promise<void> {
    const rows: any[] = await prisma.$transaction(async (tx) => {
      // LEFT JOIN: deposits whose wallet row is missing must surface here so
      // they can be dead-lettered below — an inner JOIN would strand them
      // silently with no status change, no alert, and no retry.
      // NOTE: no FOR UPDATE here — Postgres forbids locking the nullable side
      // of an outer join. The atomic claim happens in the UPDATE below, which
      // only touches "Deposit" rows still in a retryable status and RETURNs
      // the signatures it actually claimed (losers are dropped).
      const due: any[] = await tx.$queryRaw`
        SELECT
          d.signature, d.chain, d."amountUSDC", d."walletAddress", d."userId",
          w.id AS "walletId", w.address, w."privyWalletId", w."custodyType"
        FROM "Deposit" d
        LEFT JOIN "Wallet" w ON w.address = d."walletAddress"
        WHERE d."sweepStatus" IN ('SWEEP_PENDING', 'SWEEP_FAILED', 'SWEEP_BLOCKED')
          AND d."nextSweepAttemptAt" <= NOW()
          AND d."sweepAttemptCount" < ${SWEEP_MAX_ATTEMPTS}
        ORDER BY d."nextSweepAttemptAt" ASC, d."createdAt" ASC
        LIMIT 10
      `;

      if (due.length === 0) return due;

      const signatures = due.map((row) => row.signature);
      const claimed: Array<{ signature: string }> = await tx.$queryRaw`
        UPDATE "Deposit"
        SET "sweepStatus" = 'SWEEP_PROCESSING',
            "sweepAttemptCount" = "sweepAttemptCount" + 1,
            "updatedAt" = NOW()
        WHERE signature = ANY(${signatures})
          AND "sweepStatus" IN ('SWEEP_PENDING', 'SWEEP_FAILED', 'SWEEP_BLOCKED')
        RETURNING signature
      `;

      const claimedSet = new Set(claimed.map((row) => row.signature));
      return due.filter((row) => claimedSet.has(row.signature));
    });

    if (rows.length > 0) {
      console.log(`[Chain Processor] Retrying ${rows.length} due sweep(s).`);
    }

    for (const row of rows) {
      // Dead-letter: no wallet row (or no address) means this deposit can never
      // sweep. Pin attemptCount at the cap so it is never re-queued, mark it
      // BLOCKED with an explicit orphan error for manual review/alerting.
      if (!row.walletId || !row.address) {
        const errMsg = `ORPHAN_WALLET (dead-letter): no Wallet row for deposit address ${row.walletAddress}; cannot sweep, needs manual review`;
        console.error(`[Chain Processor] 🚫 ${errMsg}`);
        await prisma.$executeRaw`
          UPDATE "Deposit"
          SET "sweepStatus" = 'SWEEP_BLOCKED',
              "sweepError" = ${errMsg},
              "sweepAttemptCount" = ${SWEEP_MAX_ATTEMPTS},
              "updatedAt" = NOW()
          WHERE signature = ${row.signature}
        `;
        continue;
      }
      await this.attemptSweep({
        signature: row.signature,
        chain: row.chain,
        amountUSDC: Number(row.amountUSDC),
        alreadyMarkedProcessing: true,
        wallet: {
          id: row.walletId,
          userId: row.userId,
          address: row.address,
          chain: row.chain,
          privyWalletId: row.privyWalletId,
          custodyType: row.custodyType
        }
      });
    }
  }

  /**
   * Processes deposit event: checks idempotency, credits LedgerEntry in Neon DB, and sends notification.
   */
  private async processDepositEvent(params: {
    address: string;
    amountUSDC: number;
    signature: string;
    chain: string;
    tokenSymbol: string;
    blockNumber?: number;
    /** Fail closed: only credit when explicitly true. */
    confirmed?: boolean;
  }): Promise<void> {
    if (!params.signature) return;
    // Confirmation gate (defense in depth — callers already filter, but an
    // unconfirmed event must never reach the credit transaction).
    if (params.confirmed !== true) {
      console.log(`⏳ [Chain Processor] Skipping unconfirmed deposit event ${params.signature.slice(0, 12)}... — never credited.`);
      return;
    }
    const parsedAmount = parseDepositAmount(params.amountUSDC);
    if (parsedAmount === null) {
      console.warn(`[Chain Processor] ⚠️ Rejected invalid deposit amount for ${params.signature.slice(0, 12)}...: ${String(params.amountUSDC)}`);
      return;
    }
    params = { ...params, amountUSDC: parsedAmount };

    try {
      // 1. Resolve wallet owner in Neon DB before entering the credit transaction.
      const searchAddresses = params.address.startsWith('0x')
        ? [params.address, params.address.toLowerCase()]
        : [params.address];

      const walletRows: DepositWalletRow[] = await prisma.$queryRaw`
        SELECT id, "userId", address, chain, "privyWalletId", "custodyType"
        FROM "Wallet"
        WHERE address IN (${searchAddresses[0]}, ${searchAddresses[1] ?? searchAddresses[0]})
        LIMIT 1
      `;
      const wallet = walletRows[0];

      if (!wallet) {
        console.warn(`[Chain Processor] ⚠️ No registered user found for deposit address ${redactAddress(params.address)}`);
        return;
      }

      let credited = false;
      let newBal = 0;

      await prisma.$transaction(async (tx) => {
        const inserted: Array<{ signature: string }> = await tx.$queryRaw`
          INSERT INTO "ProcessedSignature" (signature, "createdAt")
          VALUES (${params.signature}, NOW())
          ON CONFLICT (signature) DO NOTHING
          RETURNING signature
        `;

        if (inserted.length === 0) {
          return;
        }

        const latestLedger: any[] = await tx.$queryRaw`
          SELECT "resultingBalanceUSDC"
          FROM "LedgerEntry"
          WHERE "userId" = ${wallet.userId}
          ORDER BY "createdAt" DESC
          LIMIT 1
        `;
        const initialBalance = latestLedger.length ? Number(latestLedger[0].resultingBalanceUSDC) : 0;

        await tx.$executeRaw`
          INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${wallet.userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
          ON CONFLICT ("userId", asset) DO NOTHING
        `;

        const balanceRows: any[] = await tx.$queryRaw`
          SELECT "availableUSDC"
          FROM "BalanceAccount"
          WHERE "userId" = ${wallet.userId} AND asset = 'USDC'
          FOR UPDATE
        `;
        const currentBal = balanceRows.length ? Number(balanceRows[0].availableUSDC) : initialBalance;
        newBal = currentBal + params.amountUSDC;

        await tx.$executeRaw`
          UPDATE "BalanceAccount"
          SET "availableUSDC" = ${newBal}, version = version + 1, "updatedAt" = NOW()
          WHERE "userId" = ${wallet.userId} AND asset = 'USDC'
        `;

        await tx.$executeRaw`
          INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${wallet.userId},
            'DEPOSIT_CREDIT',
            ${params.amountUSDC},
            ${newBal},
            ${params.signature},
            ${JSON.stringify({
              chain: params.chain,
              walletAddress: params.address,
              signature: params.signature,
              tokenSymbol: params.tokenSymbol,
              blockNumber: params.blockNumber,
              title: `${params.tokenSymbol} Deposit`,
              subtitle: `${params.chain.toUpperCase()} Network`,
              status: 'CONFIRMED'
            })},
            NOW()
          )
          ON CONFLICT (type, "referenceId") DO NOTHING
        `;

        await tx.$executeRaw`
          INSERT INTO "Deposit" (id, "userId", "walletAddress", chain, "tokenSymbol", "amountUSDC", signature, "blockNumber", "creditStatus", "sweepStatus", "sweepAttemptCount", "nextSweepAttemptAt", "creditedAt", "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid(),
            ${wallet.userId},
            ${params.address},
            ${params.chain},
            ${params.tokenSymbol},
            ${params.amountUSDC},
            ${params.signature},
            ${params.blockNumber ?? null},
            'CREDITED',
            'SWEEP_PENDING',
            0,
            NOW(),
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (signature) DO UPDATE SET
            "creditStatus" = 'CREDITED',
            "sweepStatus" = CASE
              WHEN "Deposit"."sweepStatus" IN ('SWEPT', 'SWEEP_PROCESSING') THEN "Deposit"."sweepStatus"
              ELSE 'SWEEP_PENDING'
            END,
            "nextSweepAttemptAt" = CASE
              WHEN "Deposit"."sweepStatus" = 'SWEPT' THEN "Deposit"."nextSweepAttemptAt"
              ELSE NOW()
            END,
            "updatedAt" = NOW()
        `;

        await tx.notification.create({
          data: {
            userId: wallet.userId,
            title: 'Deposit Received 💰',
            body: `You received ${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} into your Kudi wallet balance.`,
            type: 'PAYMENT_RECEIVED',
            data: JSON.stringify({
              amountUSDC: params.amountUSDC,
              chain: params.chain,
              txHash: params.signature,
              reference: params.signature
            })
          }
        });

        credited = true;
      });

      if (!credited) {
        return;
      }

      console.log(`[Chain Processor] 🐘 Successfully credited +${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} to user ${wallet.userId} in Neon DB (New Balance: $${newBal.toFixed(2)} USDC; Sweep: PENDING)`);

      await this.attemptSweep({
        signature: params.signature,
        wallet,
        chain: params.chain,
        amountUSDC: params.amountUSDC
      });

      // 7. Dispatch Expo Push Notification to user's mobile device
      try {
        const user = await prisma.user.findUnique({
          where: { id: wallet.userId },
          select: { expoPushToken: true }
        });

        if (user?.expoPushToken) {
          await sendExpoPushNotification(
            user.expoPushToken,
            'Deposit Received 💰',
            `You received ${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} into your Kudi wallet balance.`,
            {
              amountUSDC: params.amountUSDC,
              chain: params.chain,
              txHash: params.signature,
              type: 'DEPOSIT_RECEIVED'
            }
          );
        }
      } catch (pushErr: unknown) {
        console.warn(`[Chain Processor] Push notification error:`, pushErr instanceof Error ? pushErr.message : String(pushErr));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Chain Processor] ⚠️ Error writing deposit ${params.signature.slice(0, 12)}... to Neon DB: ${msg}`);
    }
  }
}

/**
 * Helper function to dispatch Expo Push Notifications via HTTPS REST API.
 */
async function sendExpoPushNotification(pushToken: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
  if (!pushToken || typeof pushToken !== 'string') return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {}
      })
    });

    const resData = await response.json();
    console.log(`[Push Engine] 📲 Push notification dispatched to ${REDACTED}:`, resData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Push Engine] ⚠️ Error dispatching push notification: ${msg}`);
  }
}
