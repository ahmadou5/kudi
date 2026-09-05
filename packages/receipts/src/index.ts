import { SpendTransaction, PaymentProviderId } from '@kudi/types';

export interface ReceiptData {
  reference: string;
  timestamp: string;
  amountUSDC: string;
  exchangeRateNGN: number;
  amountNGN: number;
  feeNGN: number;
  recipientBank: string;
  recipientAccountNumber: string;
  recipientAccountName: string;
  payoutProvider: PaymentProviderId;
  status: string;
}

export class ReceiptGenerator {
  public static generateHTML(data: ReceiptData): string {
    const formattedAmountNGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(data.amountNGN);
    const maskedAccount = `******${data.recipientAccountNumber.slice(-4)}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kudi Transaction Receipt - ${data.reference}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #fff; padding: 40px; }
    .receipt-card { max-width: 480px; margin: 0 auto; background: #161b26; border-radius: 20px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); }
    .logo-badge { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin: 0 auto 16px; }
    .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 13px; color: #9ca3af; margin-bottom: 24px; }
    .amount-box { text-align: center; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 14px; padding: 16px; margin-bottom: 24px; }
    .amount-ngn { font-size: 32px; font-weight: bold; color: #10b981; }
    .amount-usdc { font-size: 14px; color: #a78bfa; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
    .label { color: #9ca3af; }
    .value { font-weight: 500; }
    .status-tag { display: inline-block; padding: 4px 12px; border-radius: 20px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: bold; font-size: 12px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="logo-badge">K</div>
    <div class="title">Transaction Receipt</div>
    <div class="subtitle">Kudi Instant Spend Payout</div>

    <div class="amount-box">
      <div class="amount-ngn">${formattedAmountNGN}</div>
      <div class="amount-usdc">Sent via ${data.amountUSDC} USDC Float</div>
    </div>

    <div class="row">
      <span class="label">Reference</span>
      <span class="value">${data.reference}</span>
    </div>
    <div class="row">
      <span class="label">Status</span>
      <span class="value"><span class="status-tag">${data.status.toUpperCase()}</span></span>
    </div>
    <div class="row">
      <span class="label">Recipient Account</span>
      <span class="value">${data.recipientAccountName}</span>
    </div>
    <div class="row">
      <span class="label">Bank & Account Number</span>
      <span class="value">${data.recipientBank} (${maskedAccount})</span>
    </div>
    <div class="row">
      <span class="label">Exchange Rate</span>
      <span class="value">₦${data.exchangeRateNGN.toLocaleString()} / USDC</span>
    </div>
    <div class="row">
      <span class="label">Payout Rail</span>
      <span class="value">${data.payoutProvider.toUpperCase()}</span>
    </div>
    <div class="row">
      <span class="label">Date & Time</span>
      <span class="value">${new Date(data.timestamp).toLocaleString()}</span>
    </div>

    <div class="footer">
      Kudi — Monad Metropolis Hackathon Track A Demo
    </div>
  </div>
</body>
</html>
    `;
  }
}
