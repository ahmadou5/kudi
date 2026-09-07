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

  public registerUser(userId: string, phoneNumber?: string, email?: string, privyUserId?: string): UserRecord {
    const user: UserRecord = {
      id: userId,
      privyUserId,
      phoneNumber,
      email,
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
        accountName: `KUDI / ${email ? email.split('@')[0].toUpperCase() : 'USER'}`,
        bankName: 'Wema Bank (Squad)',
        bankCode: '035',
        currency: 'NGN',
        provider: 'SQUAD'
      },
      {
        accountNumber: '7038192041',
        accountName: `KUDI / ${email ? email.split('@')[0].toUpperCase() : 'USER'}`,
        bankName: 'Moniepoint (Monnify)',
        bankCode: '50515',
        currency: 'NGN',
        provider: 'MONNIFY'
      }
    ]);

    return user;
  }

  public getUser(userId: string): UserRecord | undefined {
    return this.users.get(userId);
  }

  public findUserByPrivyOrEmail(privyUserId?: string, email?: string, phoneNumber?: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (privyUserId && user.privyUserId === privyUserId) return user;
      if (email && user.email === email) return user;
      if (phoneNumber && user.phoneNumber === phoneNumber) return user;
    }
    return undefined;
  }

  public updateUserKYC(userId: string, status: KYCStatus, tier: KYCTier): void {
    const user = this.users.get(userId) || { id: userId, kycStatus: status, kycTier: tier };
    user.kycStatus = status;
    user.kycTier = tier;
    this.users.set(userId, user);
  }

  public setUserPin(userId: string, pin: string): void {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    user.pinHash = `hashed_${pin}`;
    this.users.set(userId, user);
  }

  public updateUserProfile(userId: string, data: { fullName?: string; username?: string; avatarUrl?: string }): UserRecord {
    const user = this.users.get(userId) || { id: userId, kycStatus: KYCStatus.NOT_STARTED, kycTier: KYCTier.UNVERIFIED };
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.username !== undefined) user.username = data.username;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    this.users.set(userId, user);
    return user;
  }

  public getBalance(userId: string): number {
    return this.ledger.get(userId) || 0.0;
  }

  public setBalance(userId: string, newBalance: number): void {
    this.ledger.set(userId, newBalance);
  }

  public recordSpend(reference: string, record: any): void {
    this.spends.set(reference, record);
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
    }
  }
}

