import {
  apiResponseSchema,
  apiRoutes,
  type ApiResponse,
  type AuthenticatePrivyRequest,
  type AuthResponseData,
  type BalanceResponseData,
  type CryptoStatusResponseData,
  type MaintenanceConfig,
  type OverrideRateRequest,
  type PayBillRequest,
  type ResolveAccountRequest,
  type ResolveAccountResponseData,
  type SendCryptoResponseData,
  type SetActivePaymentProviderRequest,
  type SetMaintenanceConfigRequest,
  type SpendOnChainRequest,
  type SpendToBankRequest,
  type SpendToUserRequest,
  type TransactionsResponseData,
  type UpdateUserProfileRequest,
  type VerifyKycIdRequest,
  type VirtualAccountsResponseData
} from '@kudi/api-contracts';

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

  private async parseJson<T = any>(res: Response): Promise<ApiResponse<T>> {
    const payload = await res.json();
    return apiResponseSchema.parse(payload) as ApiResponse<T>;
  }

  async getHealth() {
    const res = await fetch(`${this.baseUrl}${apiRoutes.health}`);
    return this.parseJson(res);
  }

  async authenticatePrivy(payload: AuthenticatePrivyRequest): Promise<ApiResponse<AuthResponseData>> {
    const targetUrl = `${this.baseUrl}${apiRoutes.auth.privyAuthenticate}`;
    console.log('[Kudi SDK] Fetching Privy auth URL:', targetUrl);
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<AuthResponseData>(res);
  }

  async sendPrivyOTP(email: string): Promise<ApiResponse<{ email: string; sent: boolean }>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.auth.privySendOtp}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email })
    });
    return this.parseJson<{ email: string; sent: boolean }>(res);
  }

  async verifyPrivyOTP(email: string, code: string): Promise<ApiResponse<AuthResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.auth.privyVerifyOtp}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, code })
    });
    return this.parseJson<AuthResponseData>(res);
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.auth.refresh}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ refreshToken })
    });
    return this.parseJson<{ accessToken: string }>(res);
  }

  async registerUser(phoneNumber: string, email: string) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.register}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phoneNumber, email })
    });
    return this.parseJson(res);
  }

  async getUserProfile(userId: string) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.byId(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async updateUserProfile(userId: string, payload: UpdateUserProfileRequest) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.byId(userId)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async deleteAccount(userId: string) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.byId(userId)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async getBalance(userId: string): Promise<ApiResponse<BalanceResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.balance(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<BalanceResponseData>(res);
  }

  async getTransactions(userId: string, options: { limit?: number; offset?: number; type?: string } = {}): Promise<ApiResponse<TransactionsResponseData>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));
    if (options.type) params.append('type', options.type);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${this.baseUrl}${apiRoutes.users.transactions(userId)}${queryString}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<TransactionsResponseData>(res);
  }

  async getVirtualAccounts(userId: string): Promise<ApiResponse<VirtualAccountsResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.virtualAccounts(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<VirtualAccountsResponseData>(res);
  }

  async verifyKYCID(payload: VerifyKycIdRequest) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.kyc.verifyId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async setPin(userId: string, pin: string) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.users.setPin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return this.parseJson(res);
  }

  async verifyPin(userId: string, pin: string) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.auth.verifyPin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return this.parseJson(res);
  }

  async getCurrentRates() {
    const res = await fetch(`${this.baseUrl}${apiRoutes.rates.current}`);
    return this.parseJson(res);
  }

  async getSupportedBanks() {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.banks}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async resolveAccount(accountNumber: ResolveAccountRequest['accountNumber'], bankCode: ResolveAccountRequest['bankCode']): Promise<ApiResponse<ResolveAccountResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.resolveAccount}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ accountNumber, bankCode })
    });
    return this.parseJson<ResolveAccountResponseData>(res);
  }

  async spendToBank(payload: SpendToBankRequest): Promise<ApiResponse<{ reference?: string; status?: string; amountNGN?: number; message?: string }>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.spend}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<{ reference?: string; status?: string; amountNGN?: number; message?: string }>(res);
  }

  async spendToUser(payload: SpendToUserRequest) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.spendUser}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async spendOnChain(payload: SpendOnChainRequest): Promise<ApiResponse<SendCryptoResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.spendOnChain}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<SendCryptoResponseData>(res);
  }

  /**
   * Send USDC on-chain from the user's Kudi balance to any external wallet.
   * Returns a reference and PENDING status immediately.
   * Poll getCryptoWithdrawalStatus() to track PENDING → BROADCAST → CONFIRMED.
   */
  async sendCrypto(payload: SpendOnChainRequest): Promise<ApiResponse<SendCryptoResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.spendOnChain}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<SendCryptoResponseData>(res);
  }

  /**
   * Poll the status of a crypto withdrawal by reference.
   * Status lifecycle: PENDING → BROADCAST → CONFIRMED | FAILED
   */
  async getCryptoWithdrawalStatus(reference: string): Promise<ApiResponse<CryptoStatusResponseData>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.cryptoStatus(reference)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<CryptoStatusResponseData>(res);
  }



  async overrideRate(newRateNGN: OverrideRateRequest['newRateNGN']) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.rateOverride}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ newRateNGN })
    });
    return this.parseJson(res);
  }

  async getReceiptHTML(reference: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.payout.receipt(reference)}`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async payBill(payload: PayBillRequest) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.bills.pay}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async exportAuditCSV(): Promise<string> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.exportReconciliationCsv}`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async getAdminConfig() {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.config}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async setActivePaymentProvider(providerId: SetActivePaymentProviderRequest['providerId']) {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.setActiveProvider}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ providerId })
    });
    return this.parseJson(res);
  }

  async getHealthConfig(): Promise<ApiResponse<{ maintenance: MaintenanceConfig }>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.healthConfig}`);
    return this.parseJson<{ maintenance: MaintenanceConfig }>(res);
  }

  async getMaintenanceConfig(): Promise<ApiResponse<MaintenanceConfig>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.maintenance}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<MaintenanceConfig>(res);
  }

  async setMaintenanceConfig(payload: SetMaintenanceConfigRequest): Promise<ApiResponse<{ success: boolean }>> {
    const res = await fetch(`${this.baseUrl}${apiRoutes.admin.maintenance}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<{ success: boolean }>(res);
  }
}

