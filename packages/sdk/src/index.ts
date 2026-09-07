import { PaymentProviderId } from '@kudi/types';

export interface KudiClientConfig {
  baseUrl: string;
}

export interface KudiClientConfig {
  baseUrl: string;
}

export class KudiSDK {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(config: KudiClientConfig = { baseUrl: 'https://kudiapi-production.up.railway.app' }) {
    let cleanUrl = (config?.baseUrl || '').trim().replace(/\/$/, '');
    if (cleanUrl.startsWith('hhttps://')) {
      cleanUrl = cleanUrl.replace('hhttps://', 'https://');
    }
    this.baseUrl = cleanUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/api/v1/health`);
    return res.json();
  }

  async authenticatePrivy(payload: {
    privyToken?: string;
    privyUserId: string;
    email?: string;
    phoneNumber?: string;
    name?: string;
  }) {
    const targetUrl = `${this.baseUrl}/api/v1/auth/privy-authenticate`;
    console.log('[Kudi SDK] Fetching Privy auth URL:', targetUrl);
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async sendPrivyOTP(email: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/privy-send-otp`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email })
    });
    return res.json();
  }

  async verifyPrivyOTP(email: string, code: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/privy-verify-otp`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, code })
    });
    return res.json();
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ refreshToken })
    });
    return res.json();
  }

  async registerUser(phoneNumber: string, email: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phoneNumber, email })
    });
    return res.json();
  }

  async getUserProfile(userId: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async updateUserProfile(userId: string, payload: { fullName?: string; username?: string; avatarUrl?: string }) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async getBalance(userId: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}/balance`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async getTransactions(userId: string, options: { limit?: number; offset?: number; type?: string } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));
    if (options.type) params.append('type', options.type);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}/transactions${queryString}`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async getVirtualAccounts(userId: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}/virtual-accounts`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async verifyKYCID(payload: {
    userId: string;
    idNumber: string;
    idType: 'BVN' | 'NIN';
    firstName: string;
    lastName: string;
    dob: string;
  }) {
    const res = await fetch(`${this.baseUrl}/api/v1/kyc/verify-id`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async setPin(userId: string, pin: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/set-pin`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return res.json();
  }

  async verifyPin(userId: string, pin: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/pin/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return res.json();
  }

  async getCurrentRates() {
    const res = await fetch(`${this.baseUrl}/api/v1/rates/current`);
    return res.json();
  }

  async getSupportedBanks() {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/banks`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async resolveAccount(accountNumber: string, bankCode: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/resolve-account`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ accountNumber, bankCode })
    });
    return res.json();
  }

  async spendToBank(payload: {
    userId: string;
    pin?: string;
    amountUSDC: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    narration?: string;
  }) {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/spend`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async spendToUser(payload: {
    fromUserId: string;
    toHandle: string;
    amountUSDC: number;
    pin?: string;
  }) {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/spend-user`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async spendOnChain(payload: {
    userId: string;
    pin?: string;
    amountUSDC: number;
    toAddress: string;
    chain: 'solana' | 'monad';
  }) {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/spend-onchain`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async overrideRate(newRateNGN: number) {
    const res = await fetch(`${this.baseUrl}/api/v1/admin/rate-override`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ newRateNGN })
    });
    return res.json();
  }

  async getReceiptHTML(reference: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/payout/receipt/${reference}`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async payBill(payload: {
    userId: string;
    billType: 'AIRTIME' | 'ELECTRICITY' | 'DATA';
    billerName: string;
    recipientIdentifier: string;
    amountNGN: number;
  }) {
    const res = await fetch(`${this.baseUrl}/api/v1/bills/pay`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async exportAuditCSV(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/admin/reconciliation/export-csv`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async getAdminConfig() {
    const res = await fetch(`${this.baseUrl}/api/v1/admin/config`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async setActivePaymentProvider(providerId: PaymentProviderId) {
    const res = await fetch(`${this.baseUrl}/api/v1/admin/set-active-provider`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ providerId })
    });
    return res.json();
  }
}

