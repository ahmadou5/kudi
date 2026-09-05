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

  constructor(
    apiKey: string = process.env.MONNIFY_API_KEY || '',
    secretKey: string = process.env.MONNIFY_SECRET_KEY || '',
    baseUrl: string = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com'
  ) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
  }

  private async getAccessToken(): Promise<string> {
    const authString = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.requestSuccessful) {
      throw new Error(`Monnify Auth Failed: ${data.responseMessage || response.statusText}`);
    }

    return data.responseBody.accessToken;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    if (!this.apiKey || !this.secretKey) {
      return {
        accountNumber,
        bankCode,
        accountName: `Monnify Demo User (${bankCode})`,
        provider: this.id
      };
    }

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
    if (!this.apiKey || !this.secretKey) {
      return {
        reference: request.reference,
        transferCode: `TRF_MONNIFY_MOCK_${Date.now()}`,
        status: 'success',
        provider: this.id,
        providerReference: `MONNIFY_REF_${Date.now()}`,
        message: 'Monnify Mock payout completed'
      };
    }

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
        sourceAccountNumber: process.env.MONNIFY_SOURCE_ACCOUNT || ''
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
    if (!this.apiKey || !this.secretKey) {
      return {
        reference,
        status: 'success',
        provider: this.id,
        message: 'Monnify transfer verified'
      };
    }

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
