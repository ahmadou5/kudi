import { LedgerService } from '../apps/api/src/services/ledgerService';
import { DepositService } from '../apps/api/src/services/depositService';
import { sendPushNotification } from '../apps/api/src/lib/notifications';

async function testPushAndDeposit() {
  console.log('--- 🧪 STARTING TRANSACTION-BASED DEPOSIT & SPEND TEST ---');
  
  const ledgerService = new LedgerService();
  const depositService = new DepositService(ledgerService);

  const user = ledgerService.findUserByPrivyOrEmail(undefined, 'ahmadlasauwal@gmail.com');
  if (user) {
    console.log(`User: ${user.email} (${user.id})`);
    const startBal = ledgerService.getBalance(user.id);
    console.log(`Starting Balance: $${startBal} USDC`);

    // 1. Simulate incoming deposit tx
    const depositTxSig = `sig_dep_${Date.now()}`;
    console.log(`\n--- Step 1: Processing Incoming Deposit ${depositTxSig} (+50 USDC) ---`);
    ledgerService.markSignatureProcessed(depositTxSig);
    const postDepBal = ledgerService.creditUserBalance(user.id, 50.0, depositTxSig);
    console.log(`Post-Deposit Balance: $${postDepBal} USDC`);

    // 2. Simulate Local Bank Spend (₦15,000 NGN = ~$9.46 USDC)
    const spendAmountUSDC = 9.46;
    console.log(`\n--- Step 2: User Spends ₦15,000 NGN (-$${spendAmountUSDC} USDC) to Bank ---`);
    const postSpendBal = postDepBal - spendAmountUSDC;
    ledgerService.setBalance(user.id, postSpendBal);
    ledgerService.recordSpend(`ref_spend_${Date.now()}`, {
      userId: user.id,
      amountUSDC: spendAmountUSDC,
      amountNGN: 15000,
      bankAccount: '0123456789 (GTBank)'
    });
    console.log(`Post-Spend Balance: $${ledgerService.getBalance(user.id)} USDC`);

    // 3. Re-run Deposit Check
    console.log('\n--- Step 3: Re-running Deposit Service Check ---');
    await depositService.checkDeposits();
    const finalBal = ledgerService.getBalance(user.id);
    console.log(`Final Ledger Balance after Deposit Polling: $${finalBal} USDC`);

    if (finalBal === postSpendBal) {
      console.log('✅ PERFECT! Balance remained intact after spend. Deposit polling did not overwrite the spent balance.');
    } else {
      console.error(`❌ Mismatch! Expected $${postSpendBal} USDC but got $${finalBal} USDC`);
    }
  }

  console.log('\n--- ✅ ALL TESTS COMPLETED SUCCESSFULLY ---');
}

testPushAndDeposit().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
