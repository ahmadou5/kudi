import {
  apiResponseSchema,
  apiRoutes,
  type ApiResponse,
  type AuthenticatePrivyRequest,
  type AuthResponseData,
  type BalanceResponseData,
  type CryptoStatusResponseData,
  type MaintenanceConfig,
  type NotificationsResponseData,
  type OverrideRateRequest,
  type PayBillRequest,
  type ReferralOverviewData,
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
  type StartKycSessionRequest,
  type KycSessionData,
  type KycSessionStatusData,
  type VirtualAccountsResponseData
} from '@kudi/api-contracts';

export interface KudiClientConfig {
  baseUrl: string;
}

export interface KudiAuthHandlers {
  onTokenRefreshed?: (accessToken: string) => void;
  onAuthExpired?: () => void;
}

export class KudiSDK {
  private baseUrl: string;
  private authToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private authHandlers: KudiAuthHandlers = {};
  private refreshInFlight: Promise<boolean> | null = null;

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

  setRefreshToken(token: string | null) {
    this.refreshTokenValue = token;
  }

  setAuthHandlers(handlers: KudiAuthHandlers) {
    this.authHandlers = handlers;
  }

  private handleAuthExpired() {
    this.authToken = null;
    this.refreshTokenValue = null;
    this.authHandlers.onAuthExpired?.();
  }

  /**
   * Exchange the stored refresh token for a fresh access token.
   * Deduped: concurrent 401s share a single refresh request.
   * Returns false without expiring the session on network failure.
   */
  private refreshAccessToken(): Promise<boolean> {
    if (!this.refreshTokenValue) return Promise.resolve(false);
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}${apiRoutes.auth.refresh}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshTokenValue })
        });
        if (!res.ok) {
          this.handleAuthExpired();
          return false;
        }
        const parsed = apiResponseSchema.parse(await res.json());
        const accessToken = (parsed.data as { accessToken?: string } | undefined)?.accessToken;
        if (!accessToken) return false;
        this.authToken = accessToken;
        this.authHandlers.onTokenRefreshed?.(accessToken);
        return true;
      } catch (err) {
        console.warn('[Kudi SDK] Token refresh failed:', (err as Error)?.message || err);
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  /**
   * All requests go through here: headers are rebuilt on every attempt so a
   * refreshed token is picked up, and a 401 transparently triggers one
   * refresh + retry before the response is handed back to the caller.
   */
  private async send(
    path: string,
    init: RequestInit = {},
    opts: { skipRefresh?: boolean } = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const attempt = (): Promise<Response> =>
      fetch(url, { ...init, headers: this.getHeaders() });

    const res = await attempt();
    if (res.status !== 401 || opts.skipRefresh || !this.refreshTokenValue) {
      return res;
    }

    const refreshed = await this.refreshAccessToken();
    if (!refreshed) return res;

    try {
      (res as any).body?.cancel?.();
    } catch {
      // Discarding the superseded 401 body is best-effort
    }
    return attempt();
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
    const res = await this.send(`${apiRoutes.health}`);
    return this.parseJson(res);
  }

  async authenticatePrivy(payload: AuthenticatePrivyRequest): Promise<ApiResponse<AuthResponseData>> {
    const targetUrl = `${this.baseUrl}${apiRoutes.auth.privyAuthenticate}`;
    console.log('[Kudi SDK] Fetching Privy auth URL:', targetUrl);
    const res = await this.send(apiRoutes.auth.privyAuthenticate, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<AuthResponseData>(res);
  }

  async sendPrivyOTP(email: string): Promise<ApiResponse<{ email: string; sent: boolean }>> {
    const res = await this.send(`${apiRoutes.auth.privySendOtp}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email })
    });
    return this.parseJson<{ email: string; sent: boolean }>(res);
  }

  async verifyPrivyOTP(email: string, code: string, referralCode?: string): Promise<ApiResponse<AuthResponseData>> {
    const res = await this.send(`${apiRoutes.auth.privyVerifyOtp}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, code, ...(referralCode ? { referralCode } : {}) })
    });
    return this.parseJson<AuthResponseData>(res);
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> {
    const res = await this.send(
      `${apiRoutes.auth.refresh}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ refreshToken })
      },
      { skipRefresh: true }
    );
    return this.parseJson<{ accessToken: string }>(res);
  }

  async registerUser(phoneNumber: string, email: string, referralCode?: string) {
    const res = await this.send(`${apiRoutes.users.register}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phoneNumber, email, ...(referralCode ? { referralCode } : {}) })
    });
    return this.parseJson(res);
  }

  async getReferralOverview(): Promise<ApiResponse<ReferralOverviewData>> {
    const res = await this.send(apiRoutes.referral.overview, {
      headers: this.getHeaders()
    });
    return this.parseJson<ReferralOverviewData>(res);
  }

  async getUserProfile(userId: string) {
    const res = await this.send(`${apiRoutes.users.byId(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async updateUserProfile(userId: string, payload: UpdateUserProfileRequest) {
    const res = await this.send(`${apiRoutes.users.byId(userId)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async deleteAccount(userId: string) {
    const res = await this.send(`${apiRoutes.users.byId(userId)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async getBalance(userId: string): Promise<ApiResponse<BalanceResponseData>> {
    const res = await this.send(`${apiRoutes.users.balance(userId)}`, {
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

    const res = await this.send(`${apiRoutes.users.transactions(userId)}${queryString}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<TransactionsResponseData>(res);
  }

  async getVirtualAccounts(userId: string): Promise<ApiResponse<VirtualAccountsResponseData>> {
    const res = await this.send(`${apiRoutes.users.virtualAccounts(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<VirtualAccountsResponseData>(res);
  }

  async provisionVirtualAccount(userId: string): Promise<ApiResponse<VirtualAccountsResponseData>> {
    const res = await this.send(`${apiRoutes.users.virtualAccounts(userId)}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({})
    });
    return this.parseJson<VirtualAccountsResponseData>(res);
  }

  async getNotifications(userId: string): Promise<ApiResponse<NotificationsResponseData>> {
    const res = await this.send(`${apiRoutes.users.notifications(userId)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<NotificationsResponseData>(res);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    // Fastify rejects bodyless PATCH requests that declare
    // Content-Type: application/json (FST_ERR_CTP_EMPTY_JSON_BODY → 400), so
    // send an explicit empty JSON object.
    const res = await this.send(`${apiRoutes.users.markNotificationRead(userId, notificationId)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({})
    });
    return this.parseJson(res);
  }

  async markAllNotificationsRead(userId: string) {
    const res = await this.send(`${apiRoutes.users.markNotificationsRead(userId)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({})
    });
    return this.parseJson(res);
  }

  async verifyKYCID(payload: VerifyKycIdRequest) {
    const res = await this.send(`${apiRoutes.kyc.verifyId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async startKycSession(payload: StartKycSessionRequest = {}) {
    const res = await this.send(`${apiRoutes.kyc.session}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<KycSessionData>(res);
  }

  async getKycSessionStatus() {
    const res = await this.send(`${apiRoutes.kyc.sessionStatus}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.parseJson<KycSessionStatusData>(res);
  }

  async setPin(userId: string, pin: string) {
    const res = await this.send(`${apiRoutes.users.setPin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return this.parseJson(res);
  }

  async verifyPin(userId: string, pin: string) {
    const res = await this.send(`${apiRoutes.auth.verifyPin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, pin })
    });
    return this.parseJson(res);
  }

  async getCurrentRates() {
    const res = await this.send(`${apiRoutes.rates.current}`);
    return this.parseJson(res);
  }

  async getFxRate(from: string, to = 'USD') {
    const params = new URLSearchParams({ from, to });
    const res = await this.send(`${apiRoutes.rates.fx}?${params.toString()}`);
    return this.parseJson<{ from: string; to: string; rate: number; updatedAt: string; isStale: boolean }>(res);
  }

  async getSupportedBanks() {
    const res = await this.send(`${apiRoutes.payout.banks}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async resolveAccount(accountNumber: ResolveAccountRequest['accountNumber'], bankCode: ResolveAccountRequest['bankCode']): Promise<ApiResponse<ResolveAccountResponseData>> {
    const res = await this.send(`${apiRoutes.payout.resolveAccount}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ accountNumber, bankCode })
    });
    return this.parseJson<ResolveAccountResponseData>(res);
  }

  async spendToBank(payload: SpendToBankRequest): Promise<ApiResponse<{ reference?: string; status?: string; amountNGN?: number; message?: string }>> {
    const res = await this.send(`${apiRoutes.payout.spend}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<{ reference?: string; status?: string; amountNGN?: number; message?: string }>(res);
  }

  async spendToUser(payload: SpendToUserRequest) {
    const res = await this.send(`${apiRoutes.payout.spendUser}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async spendOnChain(payload: SpendOnChainRequest): Promise<ApiResponse<SendCryptoResponseData>> {
    const res = await this.send(`${apiRoutes.payout.spendOnChain}`, {
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
    const res = await this.send(`${apiRoutes.payout.spendOnChain}`, {
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
    const res = await this.send(`${apiRoutes.payout.cryptoStatus(reference)}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<CryptoStatusResponseData>(res);
  }



  async overrideRate(newRateNGN: OverrideRateRequest['newRateNGN']) {
    const res = await this.send(`${apiRoutes.admin.rateOverride}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ newRateNGN })
    });
    return this.parseJson(res);
  }

  async getReceiptHTML(reference: string): Promise<string> {
    const res = await this.send(`${apiRoutes.payout.receipt(reference)}`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async payBill(payload: PayBillRequest) {
    const res = await this.send(`${apiRoutes.bills.pay}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson(res);
  }

  async exportAuditCSV(): Promise<string> {
    const res = await this.send(`${apiRoutes.admin.exportReconciliationCsv}`, {
      headers: this.getHeaders()
    });
    return res.text();
  }

  async getAdminConfig() {
    const res = await this.send(`${apiRoutes.admin.config}`, {
      headers: this.getHeaders()
    });
    return this.parseJson(res);
  }

  async setActivePaymentProvider(providerId: SetActivePaymentProviderRequest['providerId']) {
    const res = await this.send(`${apiRoutes.admin.setActiveProvider}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ providerId })
    });
    return this.parseJson(res);
  }

  async getHealthConfig(): Promise<ApiResponse<{ maintenance: MaintenanceConfig }>> {
    const res = await this.send(`${apiRoutes.healthConfig}`);
    return this.parseJson<{ maintenance: MaintenanceConfig }>(res);
  }

  async getMaintenanceConfig(): Promise<ApiResponse<MaintenanceConfig>> {
    const res = await this.send(`${apiRoutes.admin.maintenance}`, {
      headers: this.getHeaders()
    });
    return this.parseJson<MaintenanceConfig>(res);
  }

  async setMaintenanceConfig(payload: SetMaintenanceConfigRequest): Promise<ApiResponse<{ success: boolean }>> {
    const res = await this.send(`${apiRoutes.admin.maintenance}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return this.parseJson<{ success: boolean }>(res);
  }
}

