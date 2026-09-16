import { GeneralizedEVMListener, SolanaListener, EVMDepositEvent, SolanaDepositEvent, SelfCustodyProvider } from '@kudi/chains';
import { EVMChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';

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

  constructor(monadConfig: EVMChainConfig) {
    this.evmListener = new GeneralizedEVMListener([monadConfig]);
    this.solanaListener = new SolanaListener();
    this.selfCustody = new SelfCustodyProvider();
  }

  public getSolanaConfig() {
    return this.solanaListener.getConfig();
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

  public async pollAllChains(): Promise<void> {
    const { evm: evmAddresses, solana: solanaAddresses } = await this.getActiveAddresses();
    const enabledEVMs = this.evmListener.getEnabledChains();

    for (const chain of enabledEVMs) {
      if (evmAddresses.length === 0) {
        console.log(`🔗 [Chain Processor] No EVM user deposit addresses registered in DB.`);
        continue;
      }
      console.log(`🔗 [Chain Processor] Polling EVM RPC (${chain.name} - ${chain.rpcUrl}) for ${evmAddresses.length} wallet(s)...`);
      try {
        const events: EVMDepositEvent[] = await this.evmListener.pollChainForDeposits(chain.id, evmAddresses);
        for (const ev of events) {
          console.log(`✅ [Chain Processor] Confirmed EVM Deposit: ${ev.amountToken} ${chain.tokenSymbol} on ${chain.name} (Tx: ${ev.txHash})`);
          await this.processDepositEvent({
            address: ev.userWalletAddress,
            amountUSDC: Number(ev.amountToken),
            signature: ev.txHash,
            chain: chain.id,
            tokenSymbol: chain.tokenSymbol,
            blockNumber: ev.blockNumber
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
      const solEvents: SolanaDepositEvent[] = await this.solanaListener.pollSolanaForDeposits(solanaAddresses);
      for (const ev of solEvents) {
        console.log(`✅ [Chain Processor] Confirmed Solana Deposit: ${ev.amountUSDC} USDC (Signature: ${ev.signature})`);
        await this.processDepositEvent({
          address: ev.userWalletAddress,
          amountUSDC: Number(ev.amountUSDC),
          signature: ev.signature,
          chain: 'solana',
          tokenSymbol: 'USDC'
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

  private async updateDepositSweep(signature: string, status: string, txHash?: string, error?: string): Promise<void> {
    const shouldRetry = status === 'SWEEP_FAILED' || status === 'SWEEP_BLOCKED';
    await prisma.$executeRaw`
      UPDATE "Deposit"
      SET "sweepStatus" = ${status},
          "sweepTxHash" = COALESCE(${txHash ?? null}, "sweepTxHash"),
          "sweepError" = ${error ?? null},
          "sweepAttemptCount" = CASE
            WHEN ${status} = 'SWEEP_PROCESSING' THEN "sweepAttemptCount" + 1
            ELSE "sweepAttemptCount"
          END,
          "nextSweepAttemptAt" = CASE
            WHEN ${shouldRetry} THEN NOW() + (LEAST(GREATEST("sweepAttemptCount", 1), 3) * INTERVAL '5 minutes')
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
      await this.updateDepositSweep(params.signature, 'SWEEP_BLOCKED', undefined, `Missing treasury address for ${normalizedChain}`);
      return;
    }

    if (!params.wallet.privyWalletId || params.wallet.custodyType !== 'SERVER_CUSTODY') {
      await this.updateDepositSweep(params.signature, 'FLOAT_EXPOSURE', undefined, 'Wallet is not server-custody sweepable');
      return;
    }

    try {
      if (!params.alreadyMarkedProcessing) {
        await this.updateDepositSweep(params.signature, 'SWEEP_PROCESSING');
      }
      const { txHash } = await this.selfCustody.sendCrypto({
        treasuryWalletId: params.wallet.privyWalletId,
        fromAddress: normalizedChain === 'solana' ? params.wallet.address : undefined,
        toAddress: targetTreasury,
        amountUSDC: params.amountUSDC,
        chain: normalizedChain
      });
      const confirmed = await this.selfCustody.waitForConfirmation(txHash, normalizedChain);
      if (!confirmed) {
        throw new Error(`Sweep transaction ${txHash} was not confirmed before timeout`);
      }
      await this.updateDepositSweep(params.signature, 'SWEPT', txHash);
      console.log(`[Chain Processor] 🏦 ${normalizedChain.toUpperCase()} sweep confirmed for ${params.signature.slice(0, 12)}...: ${txHash}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.updateDepositSweep(params.signature, 'SWEEP_FAILED', undefined, message);
      console.warn(`[Chain Processor] ⚠️ ${normalizedChain.toUpperCase()} sweep failed for ${params.signature.slice(0, 12)}...: ${message}`);
    }
  }

  public async processSweepRetries(): Promise<void> {
    const rows: any[] = await prisma.$transaction(async (tx) => {
      const due: any[] = await tx.$queryRaw`
        SELECT
          d.signature, d.chain, d."amountUSDC", d."walletAddress", d."userId",
          w.id AS "walletId", w.address, w."privyWalletId", w."custodyType"
        FROM "Deposit" d
        JOIN "Wallet" w ON w.address = d."walletAddress"
        WHERE d."sweepStatus" IN ('SWEEP_PENDING', 'SWEEP_FAILED', 'SWEEP_BLOCKED')
          AND d."nextSweepAttemptAt" <= NOW()
          AND d."sweepAttemptCount" < 4
        ORDER BY d."nextSweepAttemptAt" ASC, d."createdAt" ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `;

      if (due.length === 0) return due;

      const signatures = due.map((row) => row.signature);
      await tx.$executeRaw`
        UPDATE "Deposit"
        SET "sweepStatus" = 'SWEEP_PROCESSING',
            "sweepAttemptCount" = "sweepAttemptCount" + 1,
            "updatedAt" = NOW()
        WHERE signature = ANY(${signatures})
      `;

      return due;
    });

    if (rows.length > 0) {
      console.log(`[Chain Processor] Retrying ${rows.length} due sweep(s).`);
    }

    for (const row of rows) {
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
  }): Promise<void> {
    if (!params.signature || params.amountUSDC <= 0) return;

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
        console.warn(`[Chain Processor] ⚠️ No registered user found for deposit address ${params.address}`);
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
            'DEPOSIT_CREDIT'::"LedgerEntryType",
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
              subtitle: `${params.chain.toUpperCase()} Network`
            })}::jsonb,
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
        console.warn(`[Chain Processor] Push notification error:`, pushErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Chain Processor] ⚠️ Error writing deposit ${params.signature} to Neon DB: ${msg}`);
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
    console.log(`[Push Engine] 📲 Push notification dispatched to ${pushToken.slice(0, 25)}...:`, resData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Push Engine] ⚠️ Error dispatching push notification: ${msg}`);
  }
}
