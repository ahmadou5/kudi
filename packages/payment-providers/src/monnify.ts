import {
  PaymentProvider,
  PaymentProviderId,
  BankAccountResolution,
  TransferRequest,
  TransferResponse
} from '@kudi/types';

export class MonnifyProvider implements PaymentProvider {
  public readonly id = PaymentProviderId.MONNIFY;
  public readonly name = 'Monnify';

  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private sourceAccountNumber: string;

  constructor(
    apiKey?: string,
    secretKey?: string,
    baseUrl: string = 'https://api.monnify.com',
    sourceAccountNumber?: string
  ) {
    if (!apiKey || !secretKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[MonnifyProvider] MONNIFY_API_KEY and MONNIFY_SECRET_KEY are required in production environment.');
      }
    }
    this.apiKey = apiKey || '';
    this.secretKey = secretKey || '';
    this.baseUrl = baseUrl;
    this.sourceAccountNumber = sourceAccountNumber || '';
  }

  private async getAccessToken(): Promise<string> {
    const authString = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64')}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.requestSuccessful) {
      throw new Error(`Monnify Auth Failed: ${data.responseMessage || response.statusText}`);
    }

    return data.responseBody.accessToken;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.baseUrl}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const data = await response.json();
    if (!response.ok || !data.requestSuccessful) {
      throw new Error(`Monnify Account Resolution Failed: ${data.responseMessage}`);
    }

    return {
      accountNumber: data.responseBody.accountNumber || accountNumber,
      bankCode,
      accountName: data.responseBody.accountName || 'Monnify Verified Account',
      provider: this.id
    };
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/api/v2/disbursements/single`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: request.amountNGN,
        reference: request.reference,
        narration: request.narration || 'Kudi Instant Payout',
        destinationBankCode: request.bankCode,
        destinationAccountNumber: request.accountNumber,
        currency: 'NGN',
        sourceAccountNumber: this.sourceAccountNumber
      })
    });

    const data = await response.json();
    if (!response.ok || !data.requestSuccessful) {
      return {
        reference: request.reference,
        status: 'failed',
        provider: this.id,
        message: data.responseMessage || 'Monnify payout failed'
      };
    }

    return {
      reference: request.reference,
      transferCode: data.responseBody.reference,
      status: 'pending',
      provider: this.id,
      providerReference: data.responseBody.transactionReference
    };
  }

  async checkTransferStatus(reference: string): Promise<TransferResponse> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/api/v2/disbursements/single/summary?reference=${reference}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    return {
      reference,
      status: response.ok && data.responseBody?.status === 'SUCCESS' ? 'success' : 'pending',
      provider: this.id,
      message: data.responseMessage
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
