import fs from 'fs';
import path from 'path';
import { KYCStatus, KYCTier } from '@kudi/types';

export interface UserRecord {
  id: string;
  privyUserId?: string;
  phoneNumber?: string;
  email?: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  pinHash?: string;
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

export class LedgerService {
  private users: Map<string, UserRecord> = new Map();
  private ledger: Map<string, number> = new Map();
  private spends: Map<string, any> = new Map();
  private transactions: Map<string, TransactionRecord> = new Map();
  private virtualAccounts: Map<string, VirtualAccountRecord[]> = new Map();
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
        virtualAccounts: Array.from(this.virtualAccounts.entries())
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[LedgerService] Warning writing persistent storage file:', err?.message);
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
    }
  }
}
