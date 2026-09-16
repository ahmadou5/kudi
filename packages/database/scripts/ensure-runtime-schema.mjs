import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `ALTER TABLE "LedgerEntry" ALTER COLUMN type TYPE TEXT USING type::text`,
  `CREATE TABLE IF NOT EXISTS "LedgerEntryDuplicateArchive" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "ledgerEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "resultingBalanceUSDC" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT NOT NULL,
    metadata JSONB,
    "originalCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "LedgerEntryDuplicateArchive_reference_idx" ON "LedgerEntryDuplicateArchive" (type, "referenceId")`,
  `WITH ranked AS (
    SELECT id, "userId", type::text AS type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt",
           ROW_NUMBER() OVER (PARTITION BY type::text, "referenceId" ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM "LedgerEntry"
  )
  INSERT INTO "LedgerEntryDuplicateArchive" (id, "ledgerEntryId", "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "originalCreatedAt", reason)
  SELECT gen_random_uuid()::text, id, "userId", type, "amountUSDC", "resultingBalanceUSDC", "referenceId", metadata, "createdAt", 'DEDUP_BEFORE_LEDGER_UNIQUE_INDEX'
  FROM ranked
  WHERE rn > 1
  ON CONFLICT (id) DO NOTHING`,
  `WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY type::text, "referenceId" ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM "LedgerEntry"
  )
  DELETE FROM "LedgerEntry" le
  USING ranked r
  WHERE le.id = r.id AND r.rn > 1`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LedgerEntry_type_referenceId_key" ON "LedgerEntry" (type, "referenceId")`,
  `CREATE TABLE IF NOT EXISTS "Deposit" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "walletAddress" TEXT NOT NULL,
    chain TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    signature TEXT NOT NULL UNIQUE,
    "blockNumber" INTEGER,
    "creditStatus" TEXT NOT NULL DEFAULT 'CREDITED',
    "sweepStatus" TEXT NOT NULL DEFAULT 'SWEEP_PENDING',
    "sweepTxHash" TEXT,
    "sweepError" TEXT,
    "sweepAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextSweepAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sweptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Deposit_userId_createdAt_idx" ON "Deposit" ("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Deposit_sweepStatus_nextSweepAttemptAt_idx" ON "Deposit" ("sweepStatus", "nextSweepAttemptAt")`,
  `CREATE INDEX IF NOT EXISTS "Deposit_sweepStatus_createdAt_idx" ON "Deposit" ("sweepStatus", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Deposit_chain_createdAt_idx" ON "Deposit" (chain, "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "BalanceAccount" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    asset TEXT NOT NULL DEFAULT 'USDC',
    "availableUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceAccount_userId_asset_key" UNIQUE ("userId", asset)
  )`,
  `CREATE INDEX IF NOT EXISTS "BalanceAccount_userId_idx" ON "BalanceAccount" ("userId")`,

  `CREATE TABLE IF NOT EXISTS "Withdrawal" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reference TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "toAddress" TEXT NOT NULL,
    chain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Withdrawal_status_nextAttemptAt_idx" ON "Withdrawal" (status, "nextAttemptAt")`,
  `CREATE INDEX IF NOT EXISTS "Withdrawal_userId_createdAt_idx" ON "Withdrawal" ("userId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "WorkerHeartbeat" (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    hostname TEXT,
    pid INTEGER,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "WorkerHeartbeat_role_lastSeen_idx" ON "WorkerHeartbeat" (role, "lastSeen")`,

  `CREATE TABLE IF NOT EXISTS "SpendLimitWindow" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "spentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpendLimitWindow_userId_spentDate_key" UNIQUE ("userId", "spentDate")
  )`,
  `CREATE INDEX IF NOT EXISTS "SpendLimitWindow_userId_spentDate_idx" ON "SpendLimitWindow" ("userId", "spentDate")`,

  `CREATE TABLE IF NOT EXISTS "SpendLimitEntry" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    "sourceType" TEXT NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "amountNGN" DOUBLE PRECISION NOT NULL,
    "limitNGN" DOUBLE PRECISION NOT NULL,
    "spentDate" TIMESTAMP(3) NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPLIED',
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    metadata TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "SpendLimitEntry_userId_spentDate_status_idx" ON "SpendLimitEntry" ("userId", "spentDate", status)`,
  `CREATE INDEX IF NOT EXISTS "SpendLimitEntry_reference_idx" ON "SpendLimitEntry" (reference)`,

  `CREATE TABLE IF NOT EXISTS "ReconciliationSnapshot" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "totalLiabilityUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAvailableUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReservedUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingSweepUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingSweepUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweptUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweepFailedUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floatExposureUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unsupportedSweepUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingWithdrawalUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingWithdrawalUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "broadcastWithdrawalUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    metadata TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "ReconciliationSnapshot_createdAt_idx" ON "ReconciliationSnapshot" ("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "actorId" TEXT,
    "actorEmail" TEXT,
    action TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    details TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog" (action, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog" ("targetType", "targetId")`,

  `CREATE TABLE IF NOT EXISTS "OperatorAlert" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    reference TEXT,
    metadata TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "OperatorAlert_status_createdAt_idx" ON "OperatorAlert" (status, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "OperatorAlert_type_reference_idx" ON "OperatorAlert" (type, reference)`,

  `ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "privyWalletId" TEXT`,
  `ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "custodyType" TEXT NOT NULL DEFAULT 'SERVER_CUSTODY'`,
  `ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS metadata TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinHash" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT`
];

try {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('[database] Runtime schema bootstrap complete');
} finally {
  await prisma.$disconnect();
}
