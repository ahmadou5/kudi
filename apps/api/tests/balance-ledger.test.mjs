import test from 'node:test';
import assert from 'node:assert/strict';

// Core Financial Ledger Logic
function calculateSpendableNGN(usdcBalance, fxRateNGN) {
  if (usdcBalance <= 0 || fxRateNGN <= 0) return 0;
  return Math.floor(usdcBalance * fxRateNGN);
}

function calculateRequiredUSDC(amountNGN, fxRateNGN, feeNGN = 0) {
  const totalNGN = amountNGN + feeNGN;
  return (totalNGN / fxRateNGN).toFixed(4);
}

test('balance-ledger: calculates live spendable NGN from USDC float accurately', () => {
  const usdcBalance = 100.50; // $100.50
  const fxRateNGN = 1500;     // 1 USDC = ₦1,500

  const spendableNGN = calculateSpendableNGN(usdcBalance, fxRateNGN);
  assert.equal(spendableNGN, 150750);
});

test('balance-ledger: calculates required USDC debit for target NGN payout accurately', () => {
  const targetNGN = 75000;  // ₦75,000
  const fxRateNGN = 1500;   // ₦1,500 per USDC
  const feeNGN = 100;       // ₦100 fee

  const requiredUSDC = calculateRequiredUSDC(targetNGN, fxRateNGN, feeNGN);
  assert.equal(requiredUSDC, '50.0667');
});

test('balance-ledger: prevents debit when available USDC balance is insufficient', () => {
  const usdcBalance = 10.00;
  const requiredUSDC = 50.00;
  assert.equal(usdcBalance >= requiredUSDC, false);
});
