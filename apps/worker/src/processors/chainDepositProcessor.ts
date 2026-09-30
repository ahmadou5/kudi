import { GeneralizedEVMListener, SolanaListener, EVMDepositEvent, SolanaDepositEvent } from '@kudi/chains';
import { parseDepositAmount } from '@kudi/chains';
import { EVMChainConfig, SolanaChainConfig } from '@kudi/types';
import { prisma } from '@kudi/database';
import { REDACTED, redactAddress, redactRpcUrl } from '@kudi/config';

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

  constructor(monadConfig: EVMChainConfig, solanaConfig?: Partial<SolanaChainConfig>) {
    this.evmListener = new GeneralizedEVMListener([monadConfig]);
    this.solanaListener = new SolanaListener(solanaConfig);
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

  private watchedEvmAddresses: string[] = [];
  private watchedSolanaAddresses: string[] = [];

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

  private async processDepositEvent(params: {
    address: string;
    amountUSDC: number;
    signature: string;
    chain: string;
    tokenSymbol: string;
    blockNumber?: number;
    confirmed?: boolean;
  }): Promise<void> {
    if (!params.signature) return;
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

        const privyWalletId = wallet.privyWalletId || (wallet as any).metadata?.privyWalletId || null;

        await tx.$executeRaw`
          INSERT INTO "Deposit" (id, "userId", "walletAddress", chain, "tokenSymbol", "amountUSDC", signature, "blockNumber", "creditStatus", "privyWalletId", "creditedAt", "createdAt", "updatedAt")
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
            ${privyWalletId},
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (signature) DO UPDATE SET
            "creditStatus" = 'CREDITED',
            "privyWalletId" = COALESCE("Deposit"."privyWalletId", ${privyWalletId}),
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

      console.log(`[Chain Processor] 🐘 Successfully credited +${params.amountUSDC.toFixed(2)} ${params.tokenSymbol} to user ${wallet.userId} in Neon DB (New Balance: $${newBal.toFixed(2)} USDC)`);

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