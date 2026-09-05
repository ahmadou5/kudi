import {
  PaymentProvider,
  PaymentProviderId,
  BankAccountResolution,
  TransferRequest,
  TransferResponse
} from '@kudi/types';

export class SquadProvider implements PaymentProvider {
  public readonly id = PaymentProviderId.SQUAD;
  public readonly name = 'Squad';

  private secretKey: string;
  private baseUrl: string;

  constructor(
    secretKey: string = process.env.SQUAD_SECRET_KEY || '',
    baseUrl: string = process.env.SQUAD_BASE_URL || 'https://api-d.squadco.com'
  ) {
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    if (!this.secretKey) {
      return {
        accountNumber,
        bankCode,
        accountName: `Squad Demo User (${bankCode})`,
        provider: this.id
      };
    }

    const response = await fetch(`${this.baseUrl}/payout/account/lookup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_number: accountNumber,
        bank_code: bankCode
      })
    });

    const data = await response.json();
    if (!response.ok || data.status !== 200) {
      throw new Error(`Squad Account Resolution Failed: ${data.message || response.statusText}`);
    }

    return {
      accountNumber: data.data.account_number || accountNumber,
      bankCode,
      accountName: data.data.account_name || 'Squad Verified Account',
      provider: this.id
    };
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    if (!this.secretKey) {
      return {
        reference: request.reference,
        transferCode: `TRF_SQUAD_MOCK_${Date.now()}`,
        status: 'success',
        provider: this.id,
        providerReference: `SQUAD_REF_${Date.now()}`,
        message: 'Squad Mock payout completed'
      };
    }

    const response = await fetch(`${this.baseUrl}/payout/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(request.amountNGN * 100),
        bank_code: request.bankCode,
        account_number: request.accountNumber,
        account_name: request.accountName,
        transaction_reference: request.reference,
        remark: request.narration || 'Kudi Payout'
      })
    });

    const data = await response.json();
    if (!response.ok || data.status !== 200) {
      return {
        reference: request.reference,
        status: 'failed',
        provider: this.id,
        message: data.message || 'Squad transfer failed'
      };
    }

    return {
      reference: request.reference,
      transferCode: data.data.transaction_reference,
      status: 'success',
      provider: this.id,
      providerReference: data.data.squad_ref
    };
  }

  async checkTransferStatus(reference: string): Promise<TransferResponse> {
    if (!this.secretKey) {
      return {
        reference,
        status: 'success',
        provider: this.id,
        message: 'Squad transfer verified'
      };
    }

    const response = await fetch(`${this.baseUrl}/payout/requery/${reference}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` }
    });

    const data = await response.json();
    return {
      reference,
      status: response.ok && data.data?.transaction_status === 'success' ? 'success' : 'pending',
      provider: this.id,
      message: data.message
    };
  }

  async listSupportedBanks(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: '058', name: 'GTBank' },
      { code: '011', name: 'First Bank' },
      { code: '057', name: 'Zenith Bank' },
      { code: '033', name: 'UBA' },
      { code: '044', name: 'Access Bank' },
      { code: '50515', name: 'Moniepoint MFB' },
      { code: '999992', name: 'OPay' },
      { code: '999991', name: 'PalmPay' }
    ];
  }
}
