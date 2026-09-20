import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceiptGenerator } from '../dist/index.js';
import { PaymentProviderId } from '@kudi/types';

test('receipts: HTML receipt generator produces valid HTML document', () => {
  const data = {
    reference: 'REF_TEST_123',
    timestamp: new Date().toISOString(),
    amountUSDC: '50.00',
    exchangeRateNGN: 1550,
    amountNGN: 77500,
    feeNGN: 100,
    recipientBank: 'GTBank',
    recipientAccountNumber: '0123456789',
    recipientAccountName: 'Ahmadou Test',
    payoutProvider: PaymentProviderId.PAYSTACK,
    status: 'SUCCESS'
  };

  const html = ReceiptGenerator.generateHTML(data);
  assert.ok(html.includes('REF_TEST_123'));
  assert.ok(html.includes('Ahmadou Test'));
  assert.ok(html.includes('GTBank'));
  assert.ok(html.includes('PAYSTACK'));
  assert.ok(html.includes('Transaction Receipt'));
});
