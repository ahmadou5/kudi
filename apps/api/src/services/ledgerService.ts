import { KYCStatus, KYCTier } from '@kudi/types';

export interface UserRecord {
  id: string;
  privyUserId?: string;
  phoneNumber?: string;
  email?: string;
  pinHash?: string;
  kycStatus: KYCStatus;
  kycTier: KYCTier;
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
      kycTier: KYCTier.UNVERIFIED
    };
    this.users.set(userId, user);
    this.ledger.set(userId, 250.0); // Seed demo testnet balance

    // Seed virtual accounts for demo user
    this.virtualAccounts.set(userId, [
      {
        accountNumber: '9920148201',
        accountName: 'KUDI / AHMADOU SHUAIBU',
        bankName: 'Wema Bank (Squad)',
        bankCode: '035',
        currency: 'NGN',
        provider: 'SQUAD'
      },
      {
        accountNumber: '7038192041',
        accountName: 'KUDI / AHMADOU SHUAIBU',
        bankName: 'Moniepoint (Monnify)',
        bankCode: '50515',
        currency: 'NGN',
        provider: 'MONNIFY'
      }
    ]);

    // Seed sample initial transactions
    const now = Date.now();
    this.recordTransaction({
      fromUserId: 'squad_gateway',
      toUserId: userId,
      amount: '100.00',
      currency: 'USDC',
      reference: `TX_DEP_${now - 86400000}`,
      timestamp: new Date(now - 86400000).toISOString(),
      metadata: { title: 'USDC Deposit', subtitle: 'Solana Network', type: 'DEPOSIT_ONCHAIN' }
    });

    this.recordTransaction({
      fromUserId: userId,
      toUserId: 'bank_payout_gtbank',
      amount: '50.00',
      currency: 'USDC',
      reference: `TX_SPEND_${now - 43200000}`,
      timestamp: new Date(now - 43200000).toISOString(),
      metadata: { title: 'GTBank Transfer', subtitle: '79,275.00 NGN', type: 'SPEND_BANK' }
    });

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
}

