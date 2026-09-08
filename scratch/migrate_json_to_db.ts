import dotenv from 'dotenv';
import path from 'path';

// Load master central environment variables BEFORE loading Prisma
dotenv.config({ path: path.join(__dirname, '../.env') });

import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { KYCTier, KYCStatus } from '@kudi/types';

const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g.us-east-2.aws.neon.tech/neondb?sslmode=require";
console.log('Connecting Prisma to:', dbUrl);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

async function migrateJsonToDb() {
  console.log('--- 🐘 MIGRATING JSON FILE DATA TO NEON POSTGRESQL DATABASE ---');

  const jsonPath = path.join(__dirname, '../apps/api/data/ledger_store.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('ledger_store.json file not found at:', jsonPath);
    return;
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  const usersMap = new Map<string, any>(data.users || []);
  const ledgerMap = new Map<string, number>(data.ledger || []);
  const spendsMap = new Map<string, any>(data.spends || []);
  const virtualAccountsMap = new Map<string, any[]>(data.virtualAccounts || []);
  const notificationsMap = new Map<string, any[]>(data.notifications || []);
  const processedSignatures = data.processedSignatures || [];

  console.log(`Found ${usersMap.size} user(s), ${spendsMap.size} spend(s), ${notificationsMap.size} notification group(s), and ${processedSignatures.length} signature(s).`);

  // 1. Migrate Users & Wallets & Virtual Accounts & Balances
  for (const [userId, user] of usersMap.entries()) {
    console.log(`\nMigrating User: ${user.email} (${userId})...`);
    
    // Upsert User
    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: {
        privyUserId: user.privyUserId || null,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        fullName: user.fullName || null,
        username: user.username || null,
        avatarUrl: user.avatarUrl || null,
        pinHash: user.pinHash || null,
        expoPushToken: user.expoPushToken || null,
        kycStatus: (user.kycStatus as KYCStatus) || 'NOT_STARTED',
        kycTier: (user.kycTier as KYCTier) || 'UNVERIFIED'
      },
      create: {
        id: userId,
        privyUserId: user.privyUserId || null,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        fullName: user.fullName || null,
        username: user.username || null,
        avatarUrl: user.avatarUrl || null,
        pinHash: user.pinHash || null,
        expoPushToken: user.expoPushToken || null,
        kycStatus: (user.kycStatus as KYCStatus) || 'NOT_STARTED',
        kycTier: (user.kycTier as KYCTier) || 'UNVERIFIED'
      }
    });

    // Migrate Wallets
    const wallets = user.wallets || [];
    for (const w of wallets) {
      if (w.address) {
        await prisma.wallet.upsert({
          where: { address: w.address },
          update: {
            userId: dbUser.id,
            chain: w.chain
          },
          create: {
            userId: dbUser.id,
            chain: w.chain,
            address: w.address
          }
        });
        console.log(`  + Saved Wallet: ${w.chain} -> ${w.address}`);
      }
    }

    // Migrate Virtual Accounts
    const vAccounts = virtualAccountsMap.get(userId) || [];
    for (const va of vAccounts) {
      const existing = await prisma.virtualAccount.findFirst({
        where: { userId: dbUser.id, accountNumber: va.accountNumber, provider: va.provider }
      });
      if (!existing) {
        await prisma.virtualAccount.create({
          data: {
            userId: dbUser.id,
            accountNumber: va.accountNumber,
            accountName: va.accountName,
            bankName: va.bankName,
            bankCode: va.bankCode,
            currency: va.currency || 'NGN',
            provider: va.provider
          }
        });
        console.log(`  + Saved Virtual Account: ${va.bankName} - ${va.accountNumber}`);
      }
    }

    // Migrate Ledger Entry Balance
    const balance = ledgerMap.get(userId) || 0;
    const existingLedger = await prisma.ledgerEntry.findFirst({
      where: { userId: dbUser.id }
    });
    if (!existingLedger) {
      await prisma.ledgerEntry.create({
        data: {
          userId: dbUser.id,
          type: 'DEPOSIT_CREDIT',
          amountUSDC: balance,
          resultingBalanceUSDC: balance,
          referenceId: `init_balance_${Date.now()}`,
          metadata: { initialMigration: true }
        }
      });
      console.log(`  + Saved Initial Ledger Entry Balance: $${balance} USDC`);
    } else {
      await prisma.ledgerEntry.create({
        data: {
          userId: dbUser.id,
          type: 'DEPOSIT_CREDIT',
          amountUSDC: 0,
          resultingBalanceUSDC: balance,
          referenceId: `sync_balance_${Date.now()}`,
          metadata: { synced: true }
        }
      });
      console.log(`  + Updated Ledger Entry Balance: $${balance} USDC`);
    }
  }

  // 2. Migrate Spend Transactions
  for (const [ref, spend] of spendsMap.entries()) {
    const existing = await prisma.spendTransaction.findUnique({
      where: { reference: ref }
    });
    if (!existing && spend.userId) {
      await prisma.spendTransaction.create({
        data: {
          userId: spend.userId,
          reference: ref,
          amountUSDC: spend.amountUSDC || 0,
          exchangeRateNGN: spend.exchangeRateNGN || 1585.50,
          amountNGN: spend.amountNGN || 0,
          feeNGN: 0,
          recipientBankCode: spend.recipientBankCode || '035',
          recipientAccountNumber: spend.recipientAccountNumber || '0123456789',
          recipientAccountName: spend.recipientAccountName || 'Bank Recipient',
          payoutProvider: 'PAYSTACK',
          status: 'SUCCESS'
        }
      });
      console.log(`  + Saved Spend Transaction: ${ref} ($${spend.amountUSDC} USDC)`);
    }
  }

  // 3. Migrate Notifications
  for (const [userId, notis] of notificationsMap.entries()) {
    for (const n of notis) {
      const existing = await prisma.notification.findFirst({
        where: { userId, title: n.title, createdAt: new Date(n.createdAt) }
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId,
            title: n.title,
            body: n.body,
            type: n.type || 'SYSTEM',
            read: Boolean(n.read),
            data: n.data || undefined,
            createdAt: new Date(n.createdAt)
          }
        });
      }
    }
    console.log(`  + Migrated Notifications for ${userId}`);
  }

  // 4. Migrate Processed Signatures
  for (const sig of processedSignatures) {
    const existing = await prisma.processedSignature.findUnique({
      where: { signature: sig }
    });
    if (!existing) {
      await prisma.processedSignature.create({
        data: { signature: sig }
      });
    }
  }
  console.log(`  + Migrated ${processedSignatures.length} Processed Signatures`);

  console.log('\n--- 🎉 MIGRATION COMPLETE! ALL JSON DATA SUCCESSFULLY MOVED TO NEON POSTGRESQL DB ---');
}

migrateJsonToDb().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
