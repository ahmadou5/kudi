export interface VirtualCard {
  id: string;
  userId: string;
  cardNumberMasked: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  currency: 'USD' | 'NGN';
  balanceUSDC: number;
  status: 'active' | 'frozen' | 'terminated';
  createdAt: string;
}

export interface BillPaymentRequest {
  userId: string;
  billType: 'AIRTIME' | 'ELECTRICITY' | 'DATA';
  billerName: string; // e.g., 'MTN', 'AIRTEL', 'IKEDC', 'EKEDC'
  recipientIdentifier: string; // Phone number or meter number
  amountNGN: number;
}

export interface BillPaymentResponse {
  reference: string;
  status: 'success' | 'failed';
  tokenOrReceipt?: string;
  message: string;
}

export class VirtualCardProvider {
  async issueCard(userId: string, currency: 'USD' | 'NGN', initialFundUSDC: number): Promise<VirtualCard> {
    const cardId = `card_${Date.now()}`;
    const last4 = Math.floor(1000 + Math.random() * 9000).toString();

    return {
      id: cardId,
      userId,
      cardNumberMasked: `4111 2222 3333 ${last4}`,
      expiryMonth: '12',
      expiryYear: '2028',
      cvv: '999',
      currency,
      balanceUSDC: initialFundUSDC,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }
}

export class BillPaymentProvider {
  async processBill(request: BillPaymentRequest): Promise<BillPaymentResponse> {
    const reference = `BILL_${Date.now()}`;
    const token = request.billType === 'ELECTRICITY' ? `TOKEN-${Math.floor(100000000000 + Math.random() * 900000000000)}` : undefined;

    return {
      reference,
      status: 'success',
      tokenOrReceipt: token,
      message: `${request.billType} purchase of ₦${request.amountNGN.toLocaleString()} for ${request.recipientIdentifier} completed successfully`
    };
  }
}
