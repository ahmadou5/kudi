import {
  PaymentProvider,
  PaymentProviderId,
  BankAccountResolution,
  TransferRequest,
  TransferResponse
} from '@kudi/types';

const BACHS_BASE_URL_SANDBOX = 'https://sandbox-api.bachs.io';
const BACHS_BASE_URL_LIVE = 'https://api.bachs.io';

type BachsErrorBody = {
  detail?: string;
  error_code?: string;
  message?: string;
};

type BachsPayoutDestination = {
  id: string;
  type?: string;
  currency?: string;
  bank_code?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  status?: string;
  is_usable?: boolean;
};

type BachsPayout = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount?: string;
  currency?: string;
  reference?: string | null;
  failure_reason?: string | null;
};

/**
 * Bachs payout rail. Docs: https://docs.bachs.io
 *
 * Payout flow: ensure a registered payout destination (bank_account, NGN),
 * then POST /v1/payouts naming it. Amounts are decimal strings ("5000.00").
 * Payouts settle asynchronously — confirm via payout.paid/payout.failed
 * webhooks or GET /v1/payouts?reference=... (checkTransferStatus).
 *
 * New destinations enter pending_review before they are is_usable; the
 * destination id is cached after creation so a retry after approval reuses it.
 *
 * Base URLs: sandbox https://sandbox-api.bachs.io (sk_sandbox_),
 * production https://api.bachs.io (sk_live_) — going live is a key swap.
 */
export class BachsProvider implements PaymentProvider {
  public readonly id = PaymentProviderId.BACHS;
  public readonly name = 'Bachs';

  private secretKey: string;
  private baseUrl: string;
  /** In-process cache: `${bankCode}:${accountNumber}` → payout destination id (`pd_...`). */
  private destinationCache = new Map<string, string>();

  constructor(secretKey?: string, baseUrl?: string) {
    if (!secretKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[BachsProvider] BACHS_SECRET_KEY is required in production environment.');
      }
    }
    this.secretKey = secretKey || '';
    this.baseUrl = baseUrl || BACHS_BASE_URL_SANDBOX;
    if (this.secretKey && !this.secretKey.includes('sk_')) {
      console.warn('[BachsProvider] Secret key does not start with "sk_", check configuration');
    }
  }

  private async request<T = any>(
    path: string,
    options: { method?: string; body?: string; extraHeaders?: Record<string, string> } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      ...options.extraHeaders
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // non-JSON body
    }

    if (!response.ok) {
      const body = data as BachsErrorBody | null;
      const detail = body?.detail || body?.message || response.statusText || 'Unknown error';
      const code = body?.error_code ? ` (${body.error_code})` : '';
      throw new Error(`Bachs API ${options.method || 'GET'} ${path} failed: ${detail}${code}`);
    }

    return data as T;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    const data = await this.request<{ resolved?: boolean; account_name?: string | null; account_number?: string | null; message?: string | null }>(
      '/v1/misc/bank-accounts/resolve',
      {
        method: 'POST',
        body: JSON.stringify({
          account_number: accountNumber,
          bank_code: bankCode,
          country: 'NG'
        })
      }
    );

    if (!data?.resolved || !data.account_name) {
      throw new Error(`Bachs account resolution failed: ${data?.message || 'account not found'}`);
    }

    return {
      accountNumber: data.account_number || accountNumber,
      bankCode,
      accountName: data.account_name,
      provider: this.id
    };
  }

  /**
   * Find an existing NGN payout destination for this beneficiary, or register
   * one. Bachs reviews new destinations (pending_review → approved); the id is
   * cached either way so the next payout reuses it once is_usable.
   */
  private async ensurePayoutDestination(request: TransferRequest): Promise<string> {
    const cacheKey = `${request.bankCode}:${request.accountNumber}`;
    const cached = this.destinationCache.get(cacheKey);
    if (cached) return cached;

    const list = await this.request<{ items?: BachsPayoutDestination[] } | BachsPayoutDestination[]>('/v1/payouts/destinations');
    const items: BachsPayoutDestination[] = Array.isArray(list) ? list : (list?.items ?? []);
    const existing = items.find(
      (d) =>
        d?.currency === 'NGN' &&
        String(d?.account_number || '') === String(request.accountNumber) &&
        (!d?.bank_code || String(d.bank_code) === String(request.bankCode))
    );
    if (existing?.id) {
      this.destinationCache.set(cacheKey, existing.id);
      return existing.id;
    }

    const created = await this.request<BachsPayoutDestination>('/v1/payouts/destinations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'bank_account',
        currency: 'NGN',
        bank_code: request.bankCode,
        account_number: request.accountNumber
      })
    });
    if (!created?.id) {
      throw new Error('Bachs payout destination creation returned no destination id');
    }
    this.destinationCache.set(cacheKey, created.id);
    return created.id;
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    try {
      const destinationId = await this.ensurePayoutDestination(request);

      const payout = await this.request<BachsPayout>('/v1/payouts', {
        method: 'POST',
        extraHeaders: { 'Idempotency-Key': request.reference },
        body: JSON.stringify({
          destination: destinationId,
          amount: request.amountNGN.toFixed(2),
          reference: request.reference,
          narration: (request.narration || 'Kudi Payout').slice(0, 100)
        })
      });

      if (payout?.status === 'failed') {
        return {
          reference: request.reference,
          status: 'failed',
          provider: this.id,
          providerReference: payout.id,
          message: payout.failure_reason || 'Bachs payout failed'
        };
      }

      // pending | processing → settled asynchronously via webhooks
      return {
        reference: request.reference,
        status: 'pending',
        provider: this.id,
        providerReference: payout.id
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        reference: request.reference,
        status: 'failed',
        provider: this.id,
        message
      };
    }
  }

  async checkTransferStatus(reference: string): Promise<TransferResponse> {
    const list = await this.request<{ items?: BachsPayout[] } | BachsPayout[]>(
      `/v1/payouts?reference=${encodeURIComponent(reference)}`
    );
    const items: BachsPayout[] = Array.isArray(list) ? list : (list?.items ?? []);
    const payout = items[0];
    if (!payout?.id) {
      return { reference, status: 'pending', provider: this.id, message: 'Payout not found yet' };
    }

    const status =
      payout.status === 'completed' ? 'success' : payout.status === 'failed' ? 'failed' : 'pending';
    return {
      reference,
      status,
      provider: this.id,
      providerReference: payout.id,
      message: payout.failure_reason || undefined
    };
  }

  async listSupportedBanks(): Promise<Array<{ code: string; name: string }>> {
    try {
      const data = await this.request<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        '/v1/reference/banks'
      );
      const raw: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data?.items ?? []);
      const banks = raw
        .map((b) => ({
          code: String(b?.code || ''),
          name: String(b?.name || b?.official_name || '')
        }))
        .filter((b) => b.code && b.name);
      if (banks.length > 0) return banks;
    } catch {
      // fall through to static list
    }

    return [
      { code: '011', name: 'First Bank' },
      { code: '033', name: 'UBA' },
      { code: '044', name: 'Access Bank' },
      { code: '057', name: 'Zenith Bank' },
      { code: '058', name: 'GTBank' },
      { code: '035', name: 'Wema Bank' },
      { code: '070', name: 'Fidelity Bank' },
      { code: '214', name: 'FCMB' },
      { code: '221', name: 'Stanbic IBTC' },
      { code: '232', name: 'Sterling Bank' },
      { code: '050', name: 'Ecobank' },
      { code: '076', name: 'Polaris Bank' },
      { code: '50515', name: 'Moniepoint MFB' },
      { code: '50211', name: 'Kuda Bank' },
      { code: '999992', name: 'OPay' },
      { code: '999991', name: 'PalmPay' }
    ];
  }
}
