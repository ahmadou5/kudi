import fs from 'fs';
import path from 'path';
import { KYCStatus, KYCTier, CryptoWithdrawal, WithdrawalStatus } from '@kudi/types';
import { prisma } from '@kudi/database';

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

export class LedgerService {
  private users: Map<string, UserRecord> = new Map();
  private ledger: Map<string, number> = new Map();
  private spends: Map<string, any> = new Map();
  private transactions: Map<string, TransactionRecord> = new Map();
  private virtualAccounts: Map<string, VirtualAccountRecord[]> = new Map();
  private notifications: Map<string, NotificationRecord[]> = new Map();
  private processedSignatures: Set<string> = new Set();
  private withdrawals: Map<string, CryptoWithdrawal> = new Map();
  private storageFilePath: string;

  constructor() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err: any) {
        console.warn('[LedgerService] Could not create data directory:', err?.message);
      }
    }
    this.storageFilePath = path.join(dataDir, 'ledger_store.json');
    this.loadFromStorage();
    this.syncFromDatabase().catch(err => console.warn('[LedgerService] Async DB sync warning:', err));
  }

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

        // Fetch balance from ledger entries
        const entries = await prisma.ledgerEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 1 });
        if (entries.length > 0) {
          this.ledger.set(u.id, Number(entries[0].resultingBalanceUSDC));
        }
      }

      const sigs = await prisma.processedSignature.findMany();
      sigs.forEach(s => this.processedSignatures.add(s.signature));

      // Sync local users and wallets to Neon DB so background worker can scan them
      for (const user of this.users.values()) {
        try {
          await prisma.user.upsert({
            where: { id: user.id },
            update: { email: user.email || undefined, privyUserId: user.privyUserId || undefined, phoneNumber: user.phoneNumber || undefined },
            create: {
              id: user.id,
              email: user.email || undefined,
              privyUserId: user.privyUserId || undefined,
              phoneNumber: user.phoneNumber || undefined,
              kycTier: 'UNVERIFIED',
              kycStatus: 'NOT_STARTED'
            }
          });
          if (user.wallets) {
            for (const w of user.wallets) {
              if (!w.address) continue;
              await prisma.wallet.upsert({
                where: { address: w.address },
                update: { userId: user.id, chain: w.chain },
                create: { userId: user.id, chain: w.chain, address: w.address }
              });
            }
          }
        } catch (syncErr: any) {
          console.warn(`[LedgerService] Warning syncing user ${user.id} to Neon DB:`, syncErr?.message);
        }
      }

      this.saveToStorage();
      console.log(`[LedgerService] 🐘 Synced ${dbUsers.length} user(s) and ${sigs.length} processed signature(s) from Neon PostgreSQL DB.`);
    } catch (err: any) {
      console.warn('[LedgerService] Warning syncing from PostgreSQL DB:', err?.message || err);
    }
  }

  private loadFromStorage(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.users && Array.isArray(data.users)) {
          this.users = new Map(data.users);
        }
        if (data.ledger && Array.isArray(data.ledger)) {
          this.ledger = new Map(data.ledger);
        }
        if (data.spends && Array.isArray(data.spends)) {
          this.spends = new Map(data.spends);
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          this.transactions = new Map(data.transactions);
        }
        if (data.virtualAccounts && Array.isArray(data.virtualAccounts)) {
          this.virtualAccounts = new Map(data.virtualAccounts);
        }
        if (data.notifications && Array.isArray(data.notifications)) {
          this.notifications = new Map(data.notifications);
        }
        if (data.processedSignatures && Array.isArray(data.processedSignatures)) {
          this.processedSignatures = new Set(data.processedSignatures);
        }
        if (data.withdrawals && Array.isArray(data.withdrawals)) {
          this.withdrawals = new Map(data.withdrawals);
        }
        console.log(`[LedgerService] 💾 Loaded ${this.users.size} persisted user(s) from persistent storage.`);
      }
    } catch (err: any) {
      console.warn('[LedgerService] Warning reading persistent storage file:', err?.message);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        users: Array.from(this.users.entries()),
        ledger: Array.from(this.ledger.entries()),
        spends: Array.from(this.spends.entries()),
        transactions: Array.from(this.transactions.entries()),
        virtualAccounts: Array.from(this.virtualAccounts.entries()),
        notifications: Array.from(this.notifications.entries()),
        processedSignatures: Array.from(this.processedSignatures),
        withdrawals: Array.from(this.withdrawals.entries())
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[LedgerService] Warning writing persistent storage file:', err?.message);
    }
  }

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
          kycStatus: user.kycStatus || 'NOT_STARTED',
          kycTier: user.kycTier || 'UNVERIFIED'
        }
      });
      console.log(`[LedgerService] 🐘 User ${user.id} (${user.email || user.privyUserId || 'anon'}) saved/updated in Neon DB.`);
    } catch (err: any) {
      console.warn(`[LedgerService] ⚠️ Sync user ${user.id} to Neon DB warning:`, err?.message);
    }
  }

  public async syncWalletToDb(userId: string, wallet: { chain: string; address: string; tokenAddress?: string }): Promise<void> {
    if (!wallet.address) return;
    try {
      const user = this.users.get(userId);
      if (user) {
        await this.syncUserToDb(user);
      }
      await prisma.wallet.upsert({
        where: { address: wallet.address },
        update: {
          userId,
          chain: wallet.chain,
          tokenAddress: wallet.tokenAddress || undefined
        },
        create: {
          userId,
          chain: wallet.chain,
          address: wallet.address,
          tokenAddress: wallet.tokenAddress || undefined
        }
      });
      console.log(`[LedgerService] 🐘 Wallet ${wallet.chain}:${wallet.address.slice(0, 10)}... saved to Neon DB for ${userId}.`);
    } catch (err: any) {
      console.warn(`[LedgerService] ⚠️ Sync wallet ${wallet.address} to Neon DB warning:`, err?.message);
    }
  }

  public registerUser(userId: string, phoneNumber?: string, email?: string, privyUserId?: string): UserRecord {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phoneNumber?.trim();
    const cleanPrivy = privyUserId?.trim();

    // Check if user already exists by privyUserId, email, or phoneNumber
    const existing = this.findUserByPrivyOrEmail(cleanPrivy, cleanEmail, cleanPhone);
    if (existing) {
      if (cleanEmail && !existing.email) existing.email = cleanEmail;
      if (cleanPrivy && !existing.privyUserId) existing.privyUserId = cleanPrivy;
      if (cleanPhone && !existing.phoneNumber) existing.phoneNumber = cleanPhone;
      this.users.set(existing.id, existing);
      this.saveToStorage();
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

    // Seed virtual accounts for user
    this.virtualAccounts.set(userId, [
      {
        accountNumber: '9920148201',
        accountName: `KUDI / ${cleanEmail ? cleanEmail.split('@')[0].toUpperCase() : 'USER'}`,
        bankName: 'Wema Bank (Squad)',
        bankCode: '035',
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
    ]);

    this.saveToStorage();
    void this.syncUserToDb(user);
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
    this.saveToStorage();
  }

  public setUserPin(userId: string, pin: string): void {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    user.pinHash = `hashed_${pin}`;
    this.users.set(userId, user);
    this.saveToStorage();
  }

  public updateUserProfile(userId: string, data: { fullName?: string; username?: string; avatarUrl?: string }): UserRecord {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.username !== undefined) user.username = data.username;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    this.users.set(userId, user);
    this.saveToStorage();
    return user;
  }

  public getBalance(userId: string): number {
    return this.ledger.get(userId) || 0.0;
  }

  public setBalance(userId: string, newBalance: number): void {
    this.ledger.set(userId, newBalance);
    this.saveToStorage();
  }

  public recordSpend(reference: string, record: any): void {
    this.spends.set(reference, record);
    this.saveToStorage();

    // Async write-through to PostgreSQL (fire-and-forget; does not block local JSON flow)
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
    }).catch(err => console.warn('[LedgerService] DB write-through failed (spend):', err?.message));
  }

  public getSpend(reference: string): any {
    return this.spends.get(reference);
  }

  public recordTransaction(record: TransactionRecord): TransactionRecord {
    const tx: TransactionRecord = {
      ...record,
      timestamp: record.timestamp || new Date().toISOString()
    };
    this.transactions.set(record.reference, tx);
    this.saveToStorage();
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

  public getUserVirtualAccounts(userId: string): VirtualAccountRecord[] {
    return this.virtualAccounts.get(userId) || [
      {
        accountNumber: '9920148201',
        accountName: 'KUDI / DEMO USER',
        bankName: 'Wema Bank',
        bankCode: '035',
        currency: 'NGN',
        provider: 'SQUAD'
      }
    ];
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
      this.saveToStorage();

      // Write-through user and wallets to Neon DB so background worker scans real addresses
      for (const w of wallets) {
        if (!w.address) continue;
        void this.syncWalletToDb(userId, { chain: w.chain, address: w.address, tokenAddress: w.metadata?.tokenAddress });
      }
    }
  }

  public saveUserPushToken(userId: string, token: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.expoPushToken = token;
      this.users.set(userId, user);
      this.saveToStorage();
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

    // Async write-through to PostgreSQL (fire-and-forget; does not block local JSON flow)
    prisma.ledgerEntry.create({
      data: {
        userId,
        type: 'DEPOSIT_CREDIT',
        amountUSDC,
        resultingBalanceUSDC: newBal,
        referenceId: reference || `dep_${Date.now()}`,
        metadata: metadata as any
      }
    }).catch(err => console.warn('[LedgerService] DB write-through failed (deposit):', err?.message));

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
    this.saveToStorage();
    return item;
  }

  public markNotificationRead(userId: string, notificationId: string): boolean {
    const list = this.notifications.get(userId) || [];
    const target = list.find(n => n.id === notificationId);
    if (target) {
      target.read = true;
      this.saveToStorage();
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
    this.saveToStorage();
    return count;
  }

  public isSignatureProcessed(signature: string): boolean {
    return this.processedSignatures.has(signature);
  }

  public markSignatureProcessed(signature: string): void {
    this.processedSignatures.add(signature);
    this.saveToStorage();

    // Async write-through to PostgreSQL
    prisma.processedSignature.upsert({
      where: { signature },
      update: {},
      create: { signature }
    }).catch(err => console.warn('[LedgerService] DB write-through failed (signature):', err?.message));
  }

  // ============================================================
  // Crypto Withdrawal Lifecycle Methods
  // ============================================================

  /**
   * Create a new withdrawal record and optimistically debit the user's balance.
   * Balance is debited here to prevent double-spend. If broadcast fails,
   * call rollbackWithdrawal() to restore it.
   */
  public createWithdrawal(params: {
    reference: string;
    userId: string;
    amountUSDC: number;
    toAddress: string;
    chain: 'solana' | 'monad';
  }): CryptoWithdrawal {
    const now = new Date().toISOString();
    const withdrawal: CryptoWithdrawal = {
      id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...params,
      status: WithdrawalStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };

    this.withdrawals.set(params.reference, withdrawal);

    // Optimistic debit
    const currentBalance = this.getBalance(params.userId);
    this.setBalance(params.userId, currentBalance - params.amountUSDC);

    // Record in transaction feed
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

    this.saveToStorage();
    return withdrawal;
  }

  /**
   * Update a withdrawal's status and optionally set txHash / blockNumber.
   */
  public updateWithdrawal(
    reference: string,
    update: Partial<Pick<CryptoWithdrawal, 'status' | 'txHash' | 'blockNumber' | 'failureReason'>>
  ): CryptoWithdrawal | undefined {
    const withdrawal = this.withdrawals.get(reference);
    if (!withdrawal) return undefined;

    Object.assign(withdrawal, { ...update, updatedAt: new Date().toISOString() });
    this.withdrawals.set(reference, withdrawal);

    // Update the matching transaction record metadata too
    const tx = this.transactions.get(reference);
    if (tx && tx.metadata) {
      tx.metadata.status = update.status;
      if (update.txHash) tx.metadata.txHash = update.txHash;
    }

    this.saveToStorage();
    return withdrawal;
  }

  /**
   * Retrieve a withdrawal by reference for status polling.
   */
  public getWithdrawal(reference: string): CryptoWithdrawal | undefined {
    return this.withdrawals.get(reference);
  }

  /**
   * Rollback a failed withdrawal — restore the user's balance.
   */
  public rollbackWithdrawal(reference: string, userId: string, amountUSDC: number): void {
    const currentBalance = this.getBalance(userId);
    this.setBalance(userId, currentBalance + amountUSDC);

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

    console.log(`[LedgerService] 🔄 Rolled back ${amountUSDC} USDC for withdrawal ${reference} — balance restored for ${userId}`);
  }
}
