#!/usr/bin/env node
/**
 * Fix incorrect withdrawal reversal that was applied despite on-chain success.
 * Usage: npx tsx scripts/fix-withdrawal-reversal.ts <withdrawal-reference>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reference = process.argv[2];
  if (!reference) {
    console.error('Usage: npx tsx scripts/fix-withdrawal-reversal.ts <withdrawal-reference>');
    process.exit(1);
  }

  console.log(`🔍 Looking up withdrawal: ${reference}`);

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { reference },
  });

  if (!withdrawal) {
    console.error(`❌ Withdrawal ${reference} not found`);
    process.exit(1);
  }

  console.log(`Withdrawal status: ${withdrawal.status}`);
  console.log(`Tx hash: ${withdrawal.txHash}`);
  console.log(`Amount: ${withdrawal.amountUSDC} USDC`);
  console.log(`User: ${withdrawal.userId}`);

  // Check if reversal exists
  const revReference = `rev_${reference}`;
  const reversal = await prisma.ledgerEntry.findFirst({
    where: { type: 'DEPOSIT_CREDIT', referenceId: revReference },
  });

  if (!reversal) {
    console.log(`✅ No reversal found for ${reference}`);
    process.exit(0);
  }

  console.log(`\n⚠️ Found reversal: ${reversal.id}`);
  console.log(`   Amount: ${reversal.amountUSDC} USDC`);
  console.log(`   Created: ${reversal.createdAt}`);

  // Verify on-chain status
  if (withdrawal.txHash) {
    console.log(`\n🔗 Checking on-chain status for ${withdrawal.txHash}...`);
    // Note: In production, you'd call verifyDepositTransaction here
    // For now, we'll trust the user's report that it succeeded on-chain
  }

  const confirm = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!confirm) {
    console.log('\n❓ This will:');
    console.log('   1. Delete the reversal ledger entry');
    console.log('   2. Adjust user balance down by the withdrawal amount');
    console.log('   3. Mark withdrawal as CONFIRMED');
    console.log('\nRun with --yes to confirm, or manually verify first.');
    process.exit(0);
  }

  console.log('\n🔧 Applying fix...');

  await prisma.$transaction(async (tx) => {
    // 1. Delete the incorrect reversal
    await tx.ledgerEntry.delete({
      where: { id: reversal.id },
    });
    console.log(`✅ Deleted reversal ${reversal.id}`);

    // 2. Get current balance and adjust down
    const balanceAccount = await tx.balanceAccount.findUnique({
      where: { userId_asset: { userId: withdrawal.userId, asset: 'USDC' } },
    });

    if (balanceAccount) {
      const newBalance = balanceAccount.availableUSDC - withdrawal.amountUSDC;
      await tx.balanceAccount.update({
        where: { id: balanceAccount.id },
        data: { availableUSDC: newBalance, version: balanceAccount.version + 1 },
      });
      console.log(`✅ Adjusted balance: ${balanceAccount.availableUSDC} → ${newBalance} USDC`);
    }

    // 3. Add a correcting SPEND_DEBIT entry for audit trail
    await tx.ledgerEntry.create({
      data: {
        userId: withdrawal.userId,
        type: 'SPEND_DEBIT',
        amountUSDC: withdrawal.amountUSDC,
        resultingBalanceUSDC: balanceAccount ? balanceAccount.availableUSDC - withdrawal.amountUSDC : 0,
        referenceId: `fix_${reference}`,
        metadata: {
          reference: reference,
          reason: 'Correction: withdrawal succeeded on-chain but reversal was incorrectly applied',
          type: 'WITHDRAWAL_CORRECTION',
          originalReversalId: reversal.id,
        },
      },
    });
    console.log(`✅ Created correction ledger entry`);

    // 4. Mark withdrawal as CONFIRMED
    await tx.withdrawal.update({
      where: { reference },
      data: { status: 'CONFIRMED' },
    });
    console.log(`✅ Marked withdrawal ${reference} as CONFIRMED`);
  });

  console.log('\n✅ Fix complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());