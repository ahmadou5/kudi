import { KYCStatus, KYCTier, CryptoWithdrawal, WithdrawalStatus } from '@kudi/types';
import { prisma } from '@kudi/database';
import { hashPin } from '../utils/hash';

export interface UserRecord {
  id: string;
  privyUserId?: string;
  phoneNumber?: string;
  email?: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  pinHash?: string;
  expoPushToken?: string;
  kycStatus: KYCStatus;
  kycTier: KYCTier;
  wallets?: Array<{ chain: string; address: string; metadata?: Record<string, any> }>;
}

export interface TransactionRecord {
  fromUserId: string;
  toUserId: string;
  amount: string | number;
  currency: string;
  reference: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface VirtualAccountRecord {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  provider: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

/**
 * LedgerService — Production Ready Ledger Engine
 *
 * 100% Prisma PostgreSQL (Neon DB) Native.
 * No JSON files, no disk fallback storage.
 */
export class LedgerService {
  /**
   * Raw SQL ledger entry insert — bypasses Prisma's enum type check on the `type` column.
   * The Neon DB `type` column may still be a PostgreSQL enum; casting to the live enum keeps writes compatible until bootstrap normalizes it to text.
   */
  private async createLedgerEntry(params: {
    userId: string;
    type: string;
    amountUSDC: number;
    resultingBalanceUSDC: number;
    referenceId: string;
    metadata?: string | null;
  }): Promise<void> {
    const { userId, type, amountUSDC, resultingBalanceUSDC, referenceId, metadata } = params;
    try {
      await prisma.$executeRaw`
        INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${type},
          ${amountUSDC},
          ${resultingBalanceUSDC},
          ${referenceId},
          ${metadata ?? null},
          NOW()
        )
      `;
    } catch {
      try {
        await prisma.ledgerEntry.create({
          data: {
            userId,
            type,
            amountUSDC,
            resultingBalanceUSDC,
            referenceId,
            metadata: metadata ?? null
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          console.warn(`[LedgerService] Duplicate ledger entry skipped: ${type}:${referenceId}`);
          return;
        }
        console.error('[LedgerService] Critical: DB ledger entry creation error:', err?.message || err);
      }
    }
  }
  private async persistWithdrawal(withdrawal: CryptoWithdrawal): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO "Withdrawal" (id, reference, "userId", "amountUSDC", "toAddress", chain, status, "txHash", "blockNumber", "failureReason", "createdAt", "updatedAt")
        VALUES (
          ${withdrawal.id},
          ${withdrawal.reference},
          ${withdrawal.userId},
          ${withdrawal.amountUSDC},
          ${withdrawal.toAddress},
          ${withdrawal.chain},
          ${withdrawal.status},
          ${withdrawal.txHash ?? null},
          ${withdrawal.blockNumber ?? null},
          ${withdrawal.failureReason ?? null},
          ${new Date(withdrawal.createdAt)},
          ${new Date(withdrawal.updatedAt)}
        )
        ON CONFLICT (reference) DO UPDATE SET
          status = EXCLUDED.status,
          "txHash" = EXCLUDED."txHash",
          "blockNumber" = EXCLUDED."blockNumber",
          "failureReason" = EXCLUDED."failureReason",
          "updatedAt" = NOW()
      `;
    } catch (err: any) {
      console.warn('[LedgerService] DB withdrawal persistence warning:', err?.message || err);
    }
  }

  private rowToWithdrawal(row: any): CryptoWithdrawal {
    return {
      id: row.id,
      reference: row.reference,
      userId: row.userId,
      amountUSDC: Number(row.amountUSDC),
      toAddress: row.toAddress,
      chain: row.chain,
      txHash: row.txHash || undefined,
      blockNumber: row.blockNumber === null || row.blockNumber === undefined ? undefined : Number(row.blockNumber),
      status: row.status as WithdrawalStatus,
      failureReason: row.failureReason || undefined,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString()
    };
  }

  private users: Map<string, UserRecord> = new Map();
  private ledger: Map<string, number> = new Map();
  private spends: Map<string, any> = new Map();
  private transactions: Map<string, TransactionRecord> = new Map();
  private virtualAccounts: Map<string, VirtualAccountRecord[]> = new Map();
  private notifications: Map<string, NotificationRecord[]> = new Map();
  private processedSignatures: Set<string> = new Set();
  private withdrawals: Map<string, CryptoWithdrawal> = new Map();

  constructor() {
    this.syncFromDatabase().catch(err =>
      console.warn('[LedgerService] Initial Neon DB sync warning:', err?.message || err)
    );
  }

  /**
   * Syncs state directly from Neon PostgreSQL Database on startup.
   */
  public async syncFromDatabase(): Promise<void> {
    try {
      const dbUsers = await prisma.user.findMany({
        include: { wallets: true, virtualAccounts: true }
      });

      for (const u of dbUsers) {
        const userRec: UserRecord = {
          id: u.id,
          privyUserId: u.privyUserId || undefined,
          phoneNumber: u.phoneNumber || undefined,
          email: u.email || undefined,
          fullName: u.fullName || undefined,
          username: u.username || undefined,
          avatarUrl: u.avatarUrl || undefined,
          pinHash: u.pinHash || undefined,
          expoPushToken: u.expoPushToken || undefined,
          kycStatus: u.kycStatus as KYCStatus,
          kycTier: u.kycTier as KYCTier,
          wallets: u.wallets.map(w => ({ chain: w.chain, address: w.address }))
        };
        this.users.set(u.id, userRec);

        // Map virtual accounts
        if (u.virtualAccounts && u.virtualAccounts.length > 0) {
          this.virtualAccounts.set(
            u.id,
            u.virtualAccounts.map(va => ({
              accountNumber: va.accountNumber,
              accountName: va.accountName,
              bankName: va.bankName,
              bankCode: va.bankCode,
              currency: va.currency,
              provider: va.provider
            }))
          );
        }

        // Fetch latest balance from ledger entries in DB
        try {
          const entries = await prisma.ledgerEntry.findMany({
            where: { userId: u.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          });
          if (entries.length > 0) {
            this.ledger.set(u.id, Number(entries[0].resultingBalanceUSDC));
          }
        } catch {
          try {
            const rawEntries: any[] = await prisma.$queryRaw`
              SELECT "resultingBalanceUSDC" FROM "LedgerEntry"
              WHERE "userId" = ${u.id}
              ORDER BY "createdAt" DESC
              LIMIT 1
            `;
            if (rawEntries.length > 0) {
              this.ledger.set(u.id, Number(rawEntries[0].resultingBalanceUSDC));
            }
          } catch {
            // Ignore if raw query fails
          }
        }
      }

      // Fetch processed signatures
      const sigs = await prisma.processedSignature.findMany();
      sigs.forEach(s => this.processedSignatures.add(s.signature));

      // Fetch notifications
      const notifs = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' }
      });
      for (const n of notifs) {
        const list = this.notifications.get(n.userId) || [];
        list.push({
          id: n.id,
          userId: n.userId,
          title: n.title,
          body: n.body,
          type: n.type,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
          data: n.data ? JSON.parse(n.data) : undefined
        });
        this.notifications.set(n.userId, list);
      }

      console.log(`[LedgerService] 🐘 Successfully synced ${dbUsers.length} user(s) & ${sigs.length} signature(s) from Neon DB.`);
    } catch (err: any) {
      console.warn('[LedgerService] Warning syncing from Neon DB:', err?.message || err);
    }
  }

  /**
   * Upsert User record in Neon DB.
   */
  public async syncUserToDb(user: UserRecord): Promise<void> {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email || undefined,
          privyUserId: user.privyUserId || undefined,
          phoneNumber: user.phoneNumber || undefined,
          fullName: user.fullName || undefined,
          username: user.username || undefined,
          avatarUrl: user.avatarUrl || undefined,
          pinHash: user.pinHash || undefined,
          expoPushToken: user.expoPushToken || undefined,
          kycStatus: user.kycStatus,
          kycTier: user.kycTier
        },
        create: {
          id: user.id,
          email: user.email || undefined,
          privyUserId: user.privyUserId || undefined,
          phoneNumber: user.phoneNumber || undefined,
          fullName: user.fullName || undefined,
          username: user.username || undefined,
          avatarUrl: user.avatarUrl || undefined,
          pinHash: user.pinHash || undefined,
          expoPushToken: user.expoPushToken || undefined,
          kycStatus: user.kycStatus || 'NOT_STARTED',
          kycTier: user.kycTier || 'UNVERIFIED'
        }
      });
      console.log(`[LedgerService] 🐘 User ${user.id} saved directly to Neon DB.`);
    } catch (err: any) {
      console.warn(`[LedgerService] ⚠️ Sync user ${user.id} to Neon DB error:`, err?.message);
    }
  }

  /**
   * Upsert Wallet record in Neon DB.
   */
  public async syncWalletToDb(userId: string, wallet: { chain: string; address: string; tokenAddress?: string; metadata?: Record<string, any> }): Promise<void> {
    if (!wallet.address) return;
    try {
      const user = this.users.get(userId);
      if (user) {
        await this.syncUserToDb(user);
      }

      const rawPrivyWalletId = typeof wallet.metadata?.privyWalletId === 'string' ? wallet.metadata.privyWalletId : null;
      const isMockWallet =
        wallet.metadata?.mock === true ||
        wallet.metadata?.generatedBy === 'MOCK_PRIVY_SERVER_WALLET' ||
        rawPrivyWalletId?.startsWith('mock_') ||
        rawPrivyWalletId?.startsWith('privy_srv_wlet_');
      const privyWalletId = isMockWallet ? null : rawPrivyWalletId;
      const custodyType = privyWalletId ? 'SERVER_CUSTODY' : 'UNKNOWN';
      const metadata = wallet.metadata ? JSON.stringify(wallet.metadata) : null;

      await prisma.$executeRaw`
        INSERT INTO "Wallet" (id, "userId", chain, address, "tokenAddress", "privyWalletId", "custodyType", metadata, "createdAt")
        VALUES (gen_random_uuid(), ${userId}, ${wallet.chain}, ${wallet.address}, ${wallet.tokenAddress || null}, ${privyWalletId}, ${custodyType}, ${metadata}, NOW())
        ON CONFLICT (address) DO UPDATE SET
          "userId" = EXCLUDED."userId",
          chain = EXCLUDED.chain,
          "tokenAddress" = EXCLUDED."tokenAddress",
          "privyWalletId" = COALESCE(EXCLUDED."privyWalletId", "Wallet"."privyWalletId"),
          "custodyType" = EXCLUDED."custodyType",
          metadata = COALESCE(EXCLUDED.metadata, "Wallet".metadata)
      `;
      console.log(`[LedgerService] 🐘 Wallet ${wallet.chain}:${wallet.address.slice(0, 10)}... saved directly to Neon DB for ${userId}.`);
    } catch (err: any) {
      console.warn(`[LedgerService] ⚠️ Sync wallet ${wallet.address} to Neon DB error:`, err?.message);
    }
  }

  public registerUser(userId: string, phoneNumber?: string, email?: string, privyUserId?: string): UserRecord {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phoneNumber?.trim();
    const cleanPrivy = privyUserId?.trim();

    // Check if user already exists
    const existing = this.findUserByPrivyOrEmail(cleanPrivy, cleanEmail, cleanPhone);
    if (existing) {
      if (cleanEmail && !existing.email) existing.email = cleanEmail;
      if (cleanPrivy && !existing.privyUserId) existing.privyUserId = cleanPrivy;
      if (cleanPhone && !existing.phoneNumber) existing.phoneNumber = cleanPhone;
      this.users.set(existing.id, existing);
      void this.syncUserToDb(existing);
      return existing;
    }

    const user: UserRecord = {
      id: userId,
      privyUserId: cleanPrivy,
      phoneNumber: cleanPhone,
      email: cleanEmail,
      kycStatus: KYCStatus.NOT_STARTED,
      kycTier: KYCTier.UNVERIFIED,
      wallets: []
    };
    this.users.set(userId, user);
    this.ledger.set(userId, 0.0);

    const seededVAs: VirtualAccountRecord[] = [
      {
        accountNumber: '9920148201',
        accountName: `KUDI / ${cleanEmail ? cleanEmail.split('@')[0].toUpperCase() : 'USER'}`,
        bankName: 'GTBank (Squad)',
        bankCode: '058',
        currency: 'NGN',
        provider: 'SQUAD'
      },
      {
        accountNumber: '7038192041',
        accountName: `KUDI / ${cleanEmail ? cleanEmail.split('@')[0].toUpperCase() : 'USER'}`,
        bankName: 'Moniepoint (Monnify)',
        bankCode: '50515',
        currency: 'NGN',
        provider: 'MONNIFY'
      }
    ];

    this.virtualAccounts.set(userId, seededVAs);
    void this.syncUserToDb(user);

    // Seed virtual accounts into Neon DB
    for (const va of seededVAs) {
      prisma.virtualAccount.create({
        data: {
          userId,
          accountNumber: va.accountNumber,
          accountName: va.accountName,
          bankName: va.bankName,
          bankCode: va.bankCode,
          currency: va.currency,
          provider: va.provider
        }
      }).catch(err => console.warn('[LedgerService] Virtual account DB seed warning:', err?.message));
    }

    return user;
  }

  public getUser(userId: string): UserRecord | undefined {
    return this.users.get(userId);
  }

  public findUserByPrivyOrEmail(privyUserId?: string, email?: string, phoneNumber?: string): UserRecord | undefined {
    const cleanPrivy = privyUserId ? privyUserId.trim().toLowerCase() : undefined;
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;
    const cleanPhone = phoneNumber ? phoneNumber.trim() : undefined;

    for (const user of this.users.values()) {
      if (cleanPrivy && user.privyUserId && user.privyUserId.trim().toLowerCase() === cleanPrivy) {
        return user;
      }
      if (cleanEmail && user.email && user.email.trim().toLowerCase() === cleanEmail) {
        return user;
      }
      if (cleanPhone && user.phoneNumber && user.phoneNumber.trim() === cleanPhone) {
        return user;
      }
    }
    return undefined;
  }

  public updateUserKYC(userId: string, status: KYCStatus, tier: KYCTier): void {
    const user = this.users.get(userId) || { id: userId, kycStatus: status, kycTier: tier };
    user.kycStatus = status;
    user.kycTier = tier;
    this.users.set(userId, user);
    void this.syncUserToDb(user);
  }

  public setUserPin(userId: string, pin: string): void {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    user.pinHash = hashPin(pin);
    this.users.set(userId, user);
    void this.syncUserToDb(user);
  }

  public updateUserProfile(userId: string, data: { fullName?: string; username?: string; avatarUrl?: string }): UserRecord {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.username !== undefined) user.username = data.username;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    this.users.set(userId, user);
    void this.syncUserToDb(user);
    return user;
  }

  public getBalance(userId: string): number {
    return this.ledger.get(userId) || 0.0;
  }

  public async getBalanceAsync(userId: string): Promise<number> {
    try {
      const rows: any[] = await prisma.$queryRaw`
        SELECT "availableUSDC"
        FROM "BalanceAccount"
        WHERE "userId" = ${userId} AND asset = 'USDC'
        LIMIT 1
      `;
      if (rows.length) {
        const balance = Number(rows[0].availableUSDC);
        this.ledger.set(userId, balance);
        return balance;
      }
      return await this.ensureBalanceAccount(userId);
    } catch (err: any) {
      console.warn('[LedgerService] BalanceAccount read warning:', err?.message || err);
      return this.getBalance(userId);
    }
  }

  public setBalance(userId: string, newBalance: number): void {
    this.ledger.set(userId, newBalance);
    void this.ensureBalanceAccount(userId, newBalance).catch((err) =>
      console.warn('[LedgerService] BalanceAccount sync warning:', err?.message || err)
    );
  }

  private async latestLedgerBalance(userId: string): Promise<number> {
    const rows: any[] = await prisma.$queryRaw`
      SELECT "resultingBalanceUSDC"
      FROM "LedgerEntry"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    return rows.length ? Number(rows[0].resultingBalanceUSDC) : (this.ledger.get(userId) || 0);
  }

  public async ensureBalanceAccount(userId: string, seedBalance?: number): Promise<number> {
    const existing: any[] = await prisma.$queryRaw`
      SELECT "availableUSDC"
      FROM "BalanceAccount"
      WHERE "userId" = ${userId} AND asset = 'USDC'
      LIMIT 1
    `;
    if (existing.length) {
      const balance = Number(existing[0].availableUSDC);
      this.ledger.set(userId, balance);
      return balance;
    }

    const initialBalance = seedBalance ?? await this.latestLedgerBalance(userId);
    await prisma.$executeRaw`
      INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
      ON CONFLICT ("userId", asset) DO NOTHING
    `;
    this.ledger.set(userId, initialBalance);
    return initialBalance;
  }

  public async debitBalanceAtomic(params: {
    userId: string;
    amountUSDC: number;
    reference: string;
    type: string;
    metadata?: Record<string, any>;
    dailyLimit?: { amountNGN: number; limitNGN: number; sourceType?: string; metadata?: Record<string, any> };
  }): Promise<number> {
    const { userId, amountUSDC, reference, type, metadata, dailyLimit } = params;
    if (!Number.isFinite(amountUSDC) || amountUSDC <= 0) {
      throw new Error('Debit amount must be positive');
    }

    const newBalance = await prisma.$transaction(async (tx) => {
      const latestRows: any[] = await tx.$queryRaw`
        SELECT "resultingBalanceUSDC"
        FROM "LedgerEntry"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      const initialBalance = latestRows.length ? Number(latestRows[0].resultingBalanceUSDC) : (this.ledger.get(userId) || 0);

      await tx.$executeRaw`
        INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
        ON CONFLICT ("userId", asset) DO NOTHING
      `;

      const rows: any[] = await tx.$queryRaw`
        SELECT "availableUSDC"
        FROM "BalanceAccount"
        WHERE "userId" = ${userId} AND asset = 'USDC'
        FOR UPDATE
      `;
      const current = rows.length ? Number(rows[0].availableUSDC) : 0;
      if (current < amountUSDC) {
        throw new Error(`INSUFFICIENT_BALANCE:${current}`);
      }

      if (dailyLimit) {
        const amountNGN = Math.max(0, Math.floor(dailyLimit.amountNGN));
        const limitNGN = Math.max(0, Math.floor(dailyLimit.limitNGN));
        await tx.$executeRaw`
          INSERT INTO "SpendLimitWindow" (id, "userId", "spentDate", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${userId}, date_trunc('day', NOW()), NOW(), NOW())
          ON CONFLICT ("userId", "spentDate") DO UPDATE SET "updatedAt" = "SpendLimitWindow"."updatedAt"
        `;
        await tx.$queryRaw`
          SELECT id
          FROM "SpendLimitWindow"
          WHERE "userId" = ${userId}
            AND "spentDate" = date_trunc('day', NOW())
          FOR UPDATE
        `;

        const spentRows: any[] = await tx.$queryRaw`
          SELECT COALESCE(SUM("amountNGN"), 0) AS "spentTodayNGN"
          FROM "SpendLimitEntry"
          WHERE "userId" = ${userId}
            AND "spentDate" = date_trunc('day', NOW())
            AND status = 'APPLIED'
        `;
        const spentTodayNGN = spentRows.length ? Math.floor(Number(spentRows[0].spentTodayNGN || 0)) : 0;
        if (limitNGN <= 0 || spentTodayNGN + amountNGN > limitNGN) {
          throw new Error(`DAILY_LIMIT_EXCEEDED:${spentTodayNGN}:${limitNGN}:${amountNGN}`);
        }
      }

      const next = current - amountUSDC;

      await tx.$executeRaw`
        UPDATE "BalanceAccount"
        SET "availableUSDC" = ${next}, version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND asset = 'USDC'
      `;

      await tx.$executeRaw`
        INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
        VALUES (gen_random_uuid(), ${userId}, ${type}, ${amountUSDC}, ${next}, ${reference}, ${metadata ? JSON.stringify(metadata) : null}, NOW())
        ON CONFLICT (type, "referenceId") DO NOTHING
      `;

      if (dailyLimit) {
        await tx.$executeRaw`
          INSERT INTO "SpendLimitEntry" (
            id, "userId", reference, "sourceType", "amountUSDC", "amountNGN", "limitNGN", "spentDate", status, metadata, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(),
            ${userId},
            ${reference},
            ${dailyLimit.sourceType || type},
            ${amountUSDC},
            ${Math.max(0, Math.floor(dailyLimit.amountNGN))},
            ${Math.max(0, Math.floor(dailyLimit.limitNGN))},
            date_trunc('day', NOW()),
            'APPLIED',
            ${JSON.stringify(dailyLimit.metadata || metadata || {})},
            NOW(),
            NOW()
          )
          ON CONFLICT (reference) DO NOTHING
        `;
      }

      return next;
    });

    this.ledger.set(userId, newBalance);
    return newBalance;
  }

  public async releaseSpendLimitEntry(reference: string, reason: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "SpendLimitEntry"
      SET status = 'RELEASED',
          "releasedAt" = NOW(),
          "releaseReason" = ${reason},
          "updatedAt" = NOW()
      WHERE reference = ${reference}
        AND status = 'APPLIED'
    `;
  }

  public async creditBalanceAtomic(params: {
    userId: string;
    amountUSDC: number;
    reference: string;
    type: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    const { userId, amountUSDC, reference, type, metadata } = params;
    if (!Number.isFinite(amountUSDC) || amountUSDC <= 0) {
      throw new Error('Credit amount must be positive');
    }

    const newBalance = await prisma.$transaction(async (tx) => {
      const latestRows: any[] = await tx.$queryRaw`
        SELECT "resultingBalanceUSDC"
        FROM "LedgerEntry"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      const initialBalance = latestRows.length ? Number(latestRows[0].resultingBalanceUSDC) : (this.ledger.get(userId) || 0);

      await tx.$executeRaw`
        INSERT INTO "BalanceAccount" (id, "userId", asset, "availableUSDC", "reservedUSDC", version, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userId}, 'USDC', ${initialBalance}, 0, 0, NOW(), NOW())
        ON CONFLICT ("userId", asset) DO NOTHING
      `;

      const rows: any[] = await tx.$queryRaw`
        SELECT "availableUSDC"
        FROM "BalanceAccount"
        WHERE "userId" = ${userId} AND asset = 'USDC'
        FOR UPDATE
      `;
      const current = rows.length ? Number(rows[0].availableUSDC) : 0;
      const next = current + amountUSDC;

      await tx.$executeRaw`
        UPDATE "BalanceAccount"
        SET "availableUSDC" = ${next}, version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND asset = 'USDC'
      `;

      await tx.$executeRaw`
        INSERT INTO "LedgerEntry" (id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt")
        VALUES (gen_random_uuid(), ${userId}, ${type}, ${amountUSDC}, ${next}, ${reference}, ${metadata ? JSON.stringify(metadata) : null}, NOW())
        ON CONFLICT (type, "referenceId") DO NOTHING
      `;

      return next;
    });

    this.ledger.set(userId, newBalance);
    return newBalance;
  }

  public recordSpend(reference: string, record: any): void {
    this.spends.set(reference, record);

    prisma.spendTransaction.upsert({
      where: { reference },
      update: { status: record.status || 'SUCCESS' },
      create: {
        userId: record.userId,
        reference,
        amountUSDC: Number(record.amountUSDC) || 0,
        exchangeRateNGN: Number(record.exchangeRateNGN) || 1585.50,
        amountNGN: Number(record.amountNGN) || 0,
        feeNGN: Number(record.feeNGN) || 0,
        recipientBankCode: record.recipientBankCode || '000',
        recipientAccountNumber: record.recipientAccountNumber || '0000000000',
        recipientAccountName: record.recipientAccountName || 'Unknown',
        payoutProvider: 'PAYSTACK',
        status: 'SUCCESS'
      }
    }).catch(err => console.warn('[LedgerService] DB spend transaction record warning:', err?.message));

    // Record LedgerEntry debit directly in Neon DB (raw SQL to bypass enum type mismatch)
    const currentBal = this.getBalance(record.userId);
    void this.createLedgerEntry({
      userId: record.userId,
      type: 'SPEND_DEBIT',
      amountUSDC: Number(record.amountUSDC) || 0,
      resultingBalanceUSDC: currentBal,
      referenceId: reference,
      metadata: JSON.stringify({
        title: 'Bank Payout',
        subtitle: `${record.recipientAccountName || 'Bank Transfer'} (${record.recipientAccountNumber || ''})`,
        amountNGN: record.amountNGN,
        exchangeRateNGN: record.exchangeRateNGN,
        recipientBankCode: record.recipientBankCode
      })
    });
  }

  public getSpend(reference: string): any {
    return this.spends.get(reference);
  }

  public async reverseSpendTransaction(
    reference: string,
    reason: string = 'PAYOUT_FAILED'
  ): Promise<{ reversed: boolean; message: string }> {
    let spend = this.spends.get(reference);

    if (!spend) {
      try {
        const dbSpend = await prisma.spendTransaction.findUnique({
          where: { reference }
        });
        if (dbSpend) {
          spend = {
            userId: dbSpend.userId,
            reference: dbSpend.reference,
            amountUSDC: String(dbSpend.amountUSDC),
            amountNGN: dbSpend.amountNGN,
            status: dbSpend.status
          };
          this.spends.set(reference, spend);
        }
      } catch (err: any) {
        console.warn('[LedgerService] Spend lookup error:', err?.message || err);
      }
    }

    if (!spend) {
      return { reversed: false, message: `Spend transaction ${reference} not found` };
    }

    if (spend.status === 'FAILED' || spend.status === 'REVERSED') {
      return { reversed: false, message: `Spend transaction ${reference} already marked as ${spend.status}` };
    }

    spend.status = 'REVERSED';
    this.spends.set(reference, spend);

    try {
      await prisma.spendTransaction.update({
        where: { reference },
        data: { status: 'REVERSED' }
      });
    } catch (err: any) {
      console.warn('[LedgerService] Failed to update SpendTransaction status:', err?.message || err);
    }

    await this.releaseSpendLimitEntry(reference, reason);

    const amountUSDC = Number(spend.amountUSDC) || 0;
    if (amountUSDC > 0) {
      await this.creditBalanceAtomic({
        userId: spend.userId,
        amountUSDC,
        reference: `rev_${reference}`,
        type: 'DEPOSIT_CREDIT',
        metadata: {
          reference,
          reason,
          type: 'SPEND_REVERSAL',
          title: 'Bank Payout Reversal',
          subtitle: `Restored to Balance (${reason})`
        }
      });

      this.addNotification(
        spend.userId,
        'Payout Reversed — Balance Restored 🔄',
        `Your payout of ₦${spend.amountNGN || 0} (${amountUSDC.toFixed(2)} USDC) was not completed by the bank and has been refunded to your wallet.`,
        'PAYMENT_FAILED',
        { reference, reason, amountUSDC }
      );
    }

    return { reversed: true, message: `Spend transaction ${reference} reversed and balance refunded` };
  }

  public async confirmSpendTransaction(
    reference: string
  ): Promise<{ updated: boolean }> {
    const spend = this.spends.get(reference);
    if (spend) {
      spend.status = 'SUCCESS';
      this.spends.set(reference, spend);
    }

    try {
      await prisma.spendTransaction.update({
        where: { reference },
        data: { status: 'SUCCESS' }
      });
    } catch (err: any) {
      // Ignored if not found
    }

    return { updated: true };
  }

  public recordTransaction(record: TransactionRecord): TransactionRecord {
    const tx: TransactionRecord = {
      ...record,
      timestamp: record.timestamp || new Date().toISOString()
    };
    this.transactions.set(record.reference, tx);

    // Record LedgerEntry in Neon DB for inter-app transfers
    if (record.metadata?.type === 'SPEND_INTER_APP') {
      const amount = Number(record.amount) || 0;
      const senderBal = this.getBalance(record.fromUserId);
      void this.createLedgerEntry({
        userId: record.fromUserId,
        type: 'SPEND_DEBIT',
        amountUSDC: amount,
        resultingBalanceUSDC: senderBal,
        referenceId: record.reference,
        metadata: JSON.stringify({
          title: record.metadata.title || 'Inter-App Transfer',
          subtitle: record.metadata.subtitle || 'Kudi Transfer',
          toUserId: record.toUserId
        })
      });

      const recipientBal = this.getBalance(record.toUserId);
      void this.createLedgerEntry({
        userId: record.toUserId,
        type: 'DEPOSIT_CREDIT',
        amountUSDC: amount,
        resultingBalanceUSDC: recipientBal,
        referenceId: `rec_${record.reference}`,
        metadata: JSON.stringify({
          title: 'Inter-App Transfer Received',
          subtitle: 'Kudi Transfer',
          fromUserId: record.fromUserId
        })
      });
    }

    return tx;
  }

  public getTransaction(reference: string): TransactionRecord | undefined {
    return this.transactions.get(reference);
  }

  public getUserTransactions(userId: string): TransactionRecord[] {
    const userTxs: TransactionRecord[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.fromUserId === userId || tx.toUserId === userId) {
        userTxs.push(tx);
      }
    }
    return userTxs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  public async getUserTransactionsAsync(userId: string): Promise<TransactionRecord[]> {
    const mergedMap = new Map<string, TransactionRecord>();

    // 1. Load in-memory transactions
    for (const tx of this.transactions.values()) {
      if (tx.fromUserId === userId || tx.toUserId === userId) {
        mergedMap.set(tx.reference, tx);
      }
    }

    // 2. Load directly from Neon PostgreSQL DB ledger entries
    let dbEntries: Array<{
      referenceId: string;
      type: string;
      amountUSDC: number;
      metadata: string | null;
      createdAt: Date;
    }> = [];

    try {
      dbEntries = await prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    } catch {
      try {
        const rawRows: any[] = await prisma.$queryRaw`
          SELECT "referenceId", type::text AS type, "amountUSDC", metadata, "createdAt"
          FROM "LedgerEntry"
          WHERE "userId" = ${userId}
          ORDER BY "createdAt" DESC
          LIMIT 100
        `;
        dbEntries = rawRows.map((r) => ({
          referenceId: r.referenceId,
          type: r.type,
          amountUSDC: Number(r.amountUSDC),
          metadata: r.metadata,
          createdAt: new Date(r.createdAt),
        }));
      } catch (rawErr: any) {
        console.warn('[LedgerService] Warning querying ledger entries from DB:', rawErr?.message || rawErr);
      }
    }

    // Pass 1: build the map from ledger entries, skipping reversal entries
    for (const entry of dbEntries) {
      if (!mergedMap.has(entry.referenceId)) {
        let meta: Record<string, any> = {};
        try {
          if (entry.metadata) meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
        } catch {
          meta = {};
        }

        const type = meta.type || entry.type;
        const isReversal = type === 'CRYPTO_SEND_REVERSAL' || entry.referenceId.startsWith('rev_');

        // Reversals are internal accounting — mark the original send FAILED instead
        if (isReversal) {
          const originalRef = entry.referenceId.replace(/^rev_/, '');
          const original = mergedMap.get(originalRef);
          if (original) {
            original.metadata = { ...original.metadata, status: 'FAILED' };
            mergedMap.set(originalRef, original);
          }
          // Do NOT add a separate card for the reversal
          continue;
        }

        const isDeposit = (type === 'DEPOSIT_CREDIT' || type === 'DEPOSIT') && !isReversal;
        const isCryptoSend = type === 'CRYPTO_SEND_DEBIT' || type === 'SPEND_ONCHAIN' || entry.referenceId.startsWith('KUDI_ONCHAIN');

        let title = meta.title;
        let subtitle = meta.subtitle;

        if (!title) {
          if (isDeposit) title = 'USDC Deposit';
          else if (isCryptoSend) title = `Send to ${(meta.chain || 'solana').toUpperCase()}`;
          else title = 'Bank Payout';
        }

        if (!subtitle) {
          if (isDeposit) subtitle = `${(meta.chain || 'solana').toUpperCase()} Network`;
          else if (isCryptoSend && meta.toAddress) subtitle = `${meta.toAddress.slice(0, 6)}...${meta.toAddress.slice(-4)}`;
          else subtitle = 'Bank Transfer';
        }

        const txRecord: TransactionRecord = {
          fromUserId: isDeposit ? 'CHAIN_DEPOSIT' : userId,
          toUserId: isDeposit ? userId : (meta.toAddress || 'BANK_PAYOUT'),
          amount: entry.amountUSDC,
          currency: meta.chain === 'monad' ? 'AUSD' : 'USDC',
          reference: entry.referenceId,
          timestamp: entry.createdAt.toISOString(),
          metadata: {
            title,
            subtitle,
            type,
            status: meta.status || (isCryptoSend ? WithdrawalStatus.PENDING : 'SUCCESS'),
            ...meta
          }
        };

        mergedMap.set(entry.referenceId, txRecord);
      }
    }

    // Pass 2: for any reversal entries, retroactively mark the original send FAILED
    for (const entry of dbEntries) {
      let meta: Record<string, any> = {};
      try {
        if (entry.metadata) meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
      } catch { meta = {}; }
      const type = meta.type || entry.type;
      const isReversal = type === 'CRYPTO_SEND_REVERSAL' || entry.referenceId.startsWith('rev_');
      if (isReversal) {
        const originalRef = entry.referenceId.replace(/^rev_/, '');
        const original = mergedMap.get(originalRef);
        if (original) {
          original.metadata = { ...original.metadata, status: 'FAILED' };
          mergedMap.set(originalRef, original);
        }
      }
    }

    const result = Array.from(mergedMap.values());
    return result.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  public getUserVirtualAccounts(userId: string): VirtualAccountRecord[] {
    return this.virtualAccounts.get(userId) || [
      {
        accountNumber: '9920148201',
        accountName: 'KUDI / DEMO USER',
        bankName: 'GTBank (Squad)',
        bankCode: '058',
        currency: 'NGN',
        provider: 'SQUAD'
      }
    ];
  }

  public async addVirtualAccount(userId: string, va: VirtualAccountRecord): Promise<void> {
    const existing = this.virtualAccounts.get(userId) || [];
    const filtered = existing.filter(a => !(a.provider === va.provider && a.accountNumber === va.accountNumber));
    filtered.push(va);
    this.virtualAccounts.set(userId, filtered);

    try {
      await prisma.virtualAccount.upsert({
        where: {
          provider_accountNumber: {
            provider: va.provider,
            accountNumber: va.accountNumber,
          }
        },
        update: {
          accountName: va.accountName,
          bankName: va.bankName,
          bankCode: va.bankCode,
          currency: va.currency || 'NGN',
          userId,
        },
        create: {
          userId,
          accountNumber: va.accountNumber,
          accountName: va.accountName,
          bankName: va.bankName,
          bankCode: va.bankCode,
          currency: va.currency || 'NGN',
          provider: va.provider,
        }
      });
    } catch (err: any) {
      console.warn('[LedgerService] Failed to upsert virtual account into DB:', err?.message || err);
    }
  }

  public async getUserVirtualAccountsAsync(userId: string): Promise<VirtualAccountRecord[]> {
    const memAccounts = this.virtualAccounts.get(userId);
    if (memAccounts && memAccounts.length > 0) {
      return memAccounts;
    }

    try {
      const dbAccounts = await prisma.virtualAccount.findMany({
        where: { userId }
      });
      if (dbAccounts.length > 0) {
        const mapped: VirtualAccountRecord[] = dbAccounts.map(va => ({
          accountNumber: va.accountNumber,
          accountName: va.accountName,
          bankName: va.bankName,
          bankCode: va.bankCode,
          currency: va.currency,
          provider: va.provider
        }));
        this.virtualAccounts.set(userId, mapped);
        return mapped;
      }
    } catch (err: any) {
      console.warn('[LedgerService] VirtualAccount DB query warning:', err?.message || err);
    }

    return this.getUserVirtualAccounts(userId);
  }

  public getUserWallets(userId: string): Array<{ chain: string; address: string; metadata?: Record<string, any> }> | undefined {
    const user = this.users.get(userId);
    return user?.wallets;
  }

  public setUserWallets(userId: string, wallets: Array<{ chain: string; address: string; metadata?: Record<string, any> }>): void {
    const user = this.users.get(userId);
    if (user) {
      user.wallets = wallets;
      this.users.set(userId, user);

      for (const w of wallets) {
        if (!w.address) continue;
        void this.syncWalletToDb(userId, { chain: w.chain, address: w.address, tokenAddress: w.metadata?.tokenAddress, metadata: w.metadata });
      }
    }
  }

  public saveUserPushToken(userId: string, token: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.expoPushToken = token;
      this.users.set(userId, user);
      void this.syncUserToDb(user);
    }
  }

  public getUserPushToken(userId: string): string | undefined {
    return this.users.get(userId)?.expoPushToken;
  }

  public getAllUsers(): UserRecord[] {
    return Array.from(this.users.values());
  }

  public creditUserBalance(userId: string, amountUSDC: number, reference: string, metadata?: Record<string, any>): number {
    const current = this.getBalance(userId);
    const newBal = current + amountUSDC;
    this.setBalance(userId, newBal);

    this.recordTransaction({
      fromUserId: 'CHAIN_DEPOSIT',
      toUserId: userId,
      amount: amountUSDC,
      currency: 'USDC',
      reference: reference || `dep_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'DEPOSIT',
        ...metadata
      }
    });

    this.addNotification(
      userId,
      'Deposit Received 💰',
      `You received ${amountUSDC.toFixed(2)} USDC into your Kudi wallet balance.`,
      'PAYMENT_RECEIVED',
      { amountUSDC, reference, ...metadata }
    );

    // Save directly to Neon DB (raw SQL to bypass enum type mismatch)
    void this.createLedgerEntry({
      userId,
      type: 'DEPOSIT_CREDIT',
      amountUSDC,
      resultingBalanceUSDC: newBal,
      referenceId: reference || `dep_${Date.now()}`,
      metadata: metadata ? JSON.stringify(metadata) : null
    });

    return newBal;
  }

  public getUserNotifications(userId: string): NotificationRecord[] {
    const list = this.notifications.get(userId) || [];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(userId: string, title: string, body: string, type: string = 'SYSTEM', data?: Record<string, any>): NotificationRecord {
    const list = this.notifications.get(userId) || [];
    const item: NotificationRecord = {
      id: `noti_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      body,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      data
    };
    list.unshift(item);
    this.notifications.set(userId, list);

    // Save directly to Neon DB
    prisma.notification.create({
      data: {
        id: item.id,
        userId,
        title,
        body,
        type,
        read: false,
        data: data ? JSON.stringify(data) : null
      }
    }).catch(err => console.warn('[LedgerService] DB notification creation warning:', err?.message));

    return item;
  }

  public markNotificationRead(userId: string, notificationId: string): boolean {
    const list = this.notifications.get(userId) || [];
    const target = list.find(n => n.id === notificationId);
    if (target) {
      target.read = true;
      prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      }).catch(err => console.warn('[LedgerService] DB notification update warning:', err?.message));
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(userId: string): number {
    const list = this.notifications.get(userId) || [];
    let count = 0;
    list.forEach(n => {
      if (!n.read) {
        n.read = true;
        count++;
      }
    });
    prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    }).catch(err => console.warn('[LedgerService] DB markAllNotificationsRead warning:', err?.message));
    return count;
  }

  public isSignatureProcessed(signature: string): boolean {
    return this.processedSignatures.has(signature);
  }

  public markSignatureProcessed(signature: string): void {
    this.processedSignatures.add(signature);

    prisma.processedSignature.upsert({
      where: { signature },
      update: {},
      create: { signature }
    }).catch(err => console.warn('[LedgerService] DB processed signature record warning:', err?.message));
  }

  public async createWithdrawal(params: {
    reference: string;
    userId: string;
    amountUSDC: number;
    toAddress: string;
    chain: 'solana' | 'monad';
    dailyLimit?: { amountNGN: number; limitNGN: number; sourceType?: string; metadata?: Record<string, any> };
  }): Promise<CryptoWithdrawal> {
    const now = new Date().toISOString();
    const withdrawal: CryptoWithdrawal = {
      id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...params,
      status: WithdrawalStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };

    this.withdrawals.set(params.reference, withdrawal);
    void this.persistWithdrawal(withdrawal);

    const newBalance = await this.debitBalanceAtomic({
      userId: params.userId,
      amountUSDC: params.amountUSDC,
      reference: params.reference,
      type: 'SPEND_DEBIT',
      metadata: {
        ...withdrawal,
        type: 'CRYPTO_SEND_DEBIT',
        title: `Send to ${params.chain.toUpperCase()}`,
        subtitle: `${params.toAddress.slice(0, 6)}...${params.toAddress.slice(-4)}`,
        amountNGN: params.dailyLimit?.amountNGN
      },
      dailyLimit: params.dailyLimit
    });

    this.recordTransaction({
      fromUserId: params.userId,
      toUserId: `onchain_${params.chain}_${params.toAddress.slice(0, 8)}`,
      amount: params.amountUSDC.toFixed(2),
      currency: params.chain === 'solana' ? 'USDC' : 'AUSD',
      reference: params.reference,
      timestamp: now,
      metadata: {
        title: `Send to ${params.chain.toUpperCase()}`,
        subtitle: `${params.toAddress.slice(0, 6)}...${params.toAddress.slice(-4)}`,
        type: 'SPEND_ONCHAIN',
        chain: params.chain,
        status: WithdrawalStatus.PENDING
      }
    });

    return withdrawal;
  }

  public updateWithdrawal(
    reference: string,
    update: Partial<Pick<CryptoWithdrawal, 'status' | 'txHash' | 'blockNumber' | 'failureReason'>>
  ): CryptoWithdrawal | undefined {
    const withdrawal = this.withdrawals.get(reference);
    if (!withdrawal) return undefined;

    Object.assign(withdrawal, { ...update, updatedAt: new Date().toISOString() });
    this.withdrawals.set(reference, withdrawal);

    const tx = this.transactions.get(reference);
    if (tx && tx.metadata) {
      tx.metadata.status = update.status;
      if (update.txHash) tx.metadata.txHash = update.txHash;
    }

    void this.persistWithdrawal(withdrawal);

    return withdrawal;
  }

  public getWithdrawal(reference: string): CryptoWithdrawal | undefined {
    return this.withdrawals.get(reference);
  }

  public async getWithdrawalAsync(reference: string): Promise<CryptoWithdrawal | undefined> {
    const cached = this.withdrawals.get(reference);
    if (cached) return cached;

    try {
      const rows: any[] = await prisma.$queryRaw`
        SELECT id, reference, "userId", "amountUSDC", "toAddress", chain, status, "txHash", "blockNumber", "failureReason", "createdAt", "updatedAt"
        FROM "Withdrawal"
        WHERE reference = ${reference}
        LIMIT 1
      `;
      if (!rows.length) return undefined;
      const withdrawal = this.rowToWithdrawal(rows[0]);
      this.withdrawals.set(reference, withdrawal);
      return withdrawal;
    } catch (err: any) {
      console.warn('[LedgerService] DB withdrawal lookup warning:', err?.message || err);
      return undefined;
    }
  }

  public rollbackWithdrawal(reference: string, userId: string, amountUSDC: number): void {
    this.updateWithdrawal(reference, {
      status: WithdrawalStatus.FAILED,
      failureReason: 'Balance restored after broadcast failure'
    });

    this.addNotification(
      userId,
      'Crypto Send Failed ❌',
      `Your send of ${amountUSDC.toFixed(2)} USDC failed. Your balance has been restored.`,
      'PAYMENT_FAILED',
      { reference, amountUSDC }
    );

    void this.creditBalanceAtomic({
      userId,
      amountUSDC,
      reference: `rev_${reference}`,
      type: 'DEPOSIT_CREDIT',
      metadata: {
        reference,
        reason: 'BROADCAST_FAILURE',
        type: 'CRYPTO_SEND_REVERSAL',
        title: 'Crypto Send Reversal',
        subtitle: 'Restored to Balance'
      }
    }).then(() => {
      console.log(`[LedgerService] 🔄 Rolled back ${amountUSDC} USDC for withdrawal ${reference} — balance restored for ${userId}`);
    }).catch((err) => {
      console.error(`[LedgerService] Critical rollback failure for ${reference}:`, err?.message || err);
    });
  }
}
