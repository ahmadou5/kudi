import {
  PaymentProvider,
  PaymentProviderId,
  BankAccountResolution,
  TransferRequest,
  TransferResponse
} from '@kudi/types';

export class PaystackProvider implements PaymentProvider {
  public readonly id = PaymentProviderId.PAYSTACK;
  public readonly name = 'Paystack';

  private secretKey: string;

  constructor(secretKey: string = process.env.PAYSTACK_SECRET_KEY || '') {
    this.secretKey = secretKey;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution> {
    if (!this.secretKey) {
      // Return sandbox / mock resolution when secret key is not set
      return {
        accountNumber,
        bankCode,
        accountName: `Demo User (${bankCode})`,
        provider: this.id
      };
    }

    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`
        }
      }
    );

    const data = await response.json();
    if (!data.status) {
      throw new Error(`Paystack Account Resolution Failed: ${data.message}`);
    }

    return {
      accountNumber: data.data.account_number,
      bankCode,
      accountName: data.data.account_name,
      provider: this.id
    };
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    if (!this.secretKey) {
      // Mock successful transfer for sandbox testing
      return {
        reference: request.reference,
        transferCode: `TRF_PAYSTACK_MOCK_${Date.now()}`,
        status: 'success',
        provider: this.id,
        providerReference: `PAYSTACK_REF_${Date.now()}`,
        message: 'Mock payout completed successfully'
      };
    }

    // Step 1: Create Transfer Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'nuban',
        name: request.accountName,
        account_number: request.accountNumber,
        bank_code: request.bankCode,
        currency: 'NGN'
      })
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      throw new Error(`Paystack Recipient Creation Failed: ${recipientData.message}`);
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate Transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(request.amountNGN * 100), // convert to kobo
        recipient: recipientCode,
        reference: request.reference,
        reason: request.narration || 'Kudi Instant Spend Payout'
      })
    });

    const transferData = await transferRes.json();
    if (!transferData.status) {
      return {
        reference: request.reference,
        status: 'failed',
        provider: this.id,
        message: transferData.message
      };
    }

    return {
      reference: request.reference,
      transferCode: transferData.data.transfer_code,
      status: transferData.data.status === 'success' ? 'success' : 'pending',
      provider: this.id,
      providerReference: transferData.data.reference
    };
  }

  async checkTransferStatus(reference: string): Promise<TransferResponse> {
    if (!this.secretKey) {
      return {
        reference,
        status: 'success',
        provider: this.id,
        message: 'Mock status verified'
      };
    }

    const response = await fetch(`https://api.paystack.co/transfer/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`
      }
    });

    const data = await response.json();
    if (!data.status) {
      return { reference, status: 'failed', provider: this.id, message: data.message };
    }

    return {
      reference,
      transferCode: data.data.transfer_code,
      status: data.data.status === 'success' ? 'success' : data.data.status === 'failed' ? 'failed' : 'pending',
      provider: this.id,
      providerReference: data.data.reference
    };
  }

  async listSupportedBanks(): Promise<Array<{ code: string; name: string }>> {
    if (!this.secretKey) {
      return [
        { code: '058', name: 'GTBank' },
        { code: '011', name: 'First Bank' },
        { code: '057', name: 'Zenith Bank' },
        { code: '033', name: 'UBA' },
        { code: '044', name: 'Access Bank' },
        { code: '999992', name: 'OPay' },
        { code: '999991', name: 'Palmpay' },
        { code: '50515', name: 'Moniepoint Microfinance Bank' }
      ];
    }

    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      headers: { Authorization: `Bearer ${this.secretKey}` }
    });

    const data = await response.json();
    if (!data.status) return [];
    return data.data.map((b: { code: string; name: string }) => ({ code: b.code, name: b.name }));
  }
}
