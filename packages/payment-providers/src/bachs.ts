import {
  PaymentProvider,
  PaymentProviderId,
  BankAccountResolution,
  TransferRequest,
  TransferResponse
} from '@kudi/types';

const BACHS_BASE_URL_SANDBOX = 'https://sandbox-api.bachs.io';
const BACHS_BASE_URL_LIVE = 'https://api.bachs.io';

export class BachsProvider implements PaymentProvider {
  public readonly id = PaymentProviderId.BACHS;
  public readonly name = 'Bachs';

  private secretKey: string;
  private baseUrl: string;

  constructor(secretKey?: string, baseUrl?: string) {
    if (!secretKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[BachsProvider] BACHS_SECRET_KEY is required in production environment.');
      }
    }
    this.secretKey = secretKey || '';
    this.baseUrl = baseUrl || BACHS_BASE_URL_SANDBOX;
    if (!this.secretKey.includes('sk_')) {
      console.warn('[BachsProvider] Secret key does not start with "sk_", check configuration');
    }
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    const response = await fetch(`${this.baseUrl}/v1/virtual-accounts?currency=NGN`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.account_number) {
      throw new Error(`Bachs Account Resolution Failed: ${response.statusText || 'Unknown error'}`);
    }

    return {
      accountNumber: data.account_number,
      bankCode,
      accountName: data.bank_name || 'Bachs Virtual Account',
      provider: this.id
    };
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    const response = await fetch(`${this.baseUrl}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: request.reference,
            quantity: 1
          }
        ],
        customer: {
          email: request.accountName || 'customer@example.com'
        },
        success_url: 'https://yoursite.com/success',
        cancel_url: 'https://yoursite.com/cancelled'
      })
    });

    const data = await response.json();
    if (!response.ok || !data.id) {
      return {
        reference: request.reference,
        status: 'failed',
        provider: this.id,
        message: data.message || 'Bachs checkout session creation failed'
      };
    }

    return {
      reference: request.reference,
      status: 'pending',
      provider: this.id,
      providerReference: data.id
    };
  }

  async checkTransferStatus(reference: string): Promise<TransferResponse> {
    const response = await fetch(`${this.baseUrl}/v1/checkout-sessions/${reference}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { reference, status: 'failed', provider: this.id, message: data.message || 'Checkout session not found' };
    }

    const status = data.status || 'pending';
    return {
      reference,
      status: status === 'complete' || status === 'success' ? 'success' : status === 'expired' ? 'failed' : 'pending',
      provider: this.id,
      providerReference: data.id
    };
  }

  async listSupportedBanks(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: '058', name: 'GTBank' },
      { code: '011', name: 'First Bank' },
      { code: '057', name: 'Zenith Bank' },
      { code: '033', name: 'UBA' },
      { code: '044', name: 'Access Bank' },
      { code: '50515', name: 'Moniepoint MFB' }
    ];
  }
}
