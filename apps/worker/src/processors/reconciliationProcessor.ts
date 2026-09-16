import { prisma } from '@kudi/database';

type NumericRow = Record<string, unknown>;

function numberFrom(row: NumericRow | undefined, key: string): number {
  if (!row || row[key] === null || row[key] === undefined) return 0;
  return Number(row[key]) || 0;
}

export async function recordReconciliationSnapshot(): Promise<void> {
  const balanceRows: NumericRow[] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM("availableUSDC"), 0) AS "totalAvailableUSDC",
      COALESCE(SUM("reservedUSDC"), 0) AS "totalReservedUSDC"
    FROM "BalanceAccount"
  `;

  const depositRows: NumericRow[] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_PENDING' THEN "amountUSDC" ELSE 0 END), 0) AS "pendingSweepUSDC",
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_PROCESSING' THEN "amountUSDC" ELSE 0 END), 0) AS "processingSweepUSDC",
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEPT' THEN "amountUSDC" ELSE 0 END), 0) AS "sweptUSDC",
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_FAILED' THEN "amountUSDC" ELSE 0 END), 0) AS "sweepFailedUSDC",
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'FLOAT_EXPOSURE' THEN "amountUSDC" ELSE 0 END), 0) AS "floatExposureUSDC",
      COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_UNSUPPORTED' THEN "amountUSDC" ELSE 0 END), 0) AS "unsupportedSweepUSDC"
    FROM "Deposit"
  `;

  const withdrawalRows: NumericRow[] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN "amountUSDC" ELSE 0 END), 0) AS "pendingWithdrawalUSDC",
      COALESCE(SUM(CASE WHEN status = 'PROCESSING' THEN "amountUSDC" ELSE 0 END), 0) AS "processingWithdrawalUSDC",
      COALESCE(SUM(CASE WHEN status = 'BROADCAST' THEN "amountUSDC" ELSE 0 END), 0) AS "broadcastWithdrawalUSDC"
    FROM "Withdrawal"
  `;

  const balance = balanceRows[0];
  const deposits = depositRows[0];
  const withdrawals = withdrawalRows[0];
  const totalAvailableUSDC = numberFrom(balance, 'totalAvailableUSDC');
  const totalReservedUSDC = numberFrom(balance, 'totalReservedUSDC');
  const totalLiabilityUSDC = totalAvailableUSDC + totalReservedUSDC;

  await prisma.$executeRaw`
    INSERT INTO "ReconciliationSnapshot" (
      id,
      "totalLiabilityUSDC",
      "totalAvailableUSDC",
      "totalReservedUSDC",
      "pendingSweepUSDC",
      "processingSweepUSDC",
      "sweptUSDC",
      "sweepFailedUSDC",
      "floatExposureUSDC",
      "unsupportedSweepUSDC",
      "pendingWithdrawalUSDC",
      "processingWithdrawalUSDC",
      "broadcastWithdrawalUSDC",
      metadata,
      "createdAt"
    ) VALUES (
      gen_random_uuid(),
      ${totalLiabilityUSDC},
      ${totalAvailableUSDC},
      ${totalReservedUSDC},
      ${numberFrom(deposits, 'pendingSweepUSDC')},
      ${numberFrom(deposits, 'processingSweepUSDC')},
      ${numberFrom(deposits, 'sweptUSDC')},
      ${numberFrom(deposits, 'sweepFailedUSDC')},
      ${numberFrom(deposits, 'floatExposureUSDC')},
      ${numberFrom(deposits, 'unsupportedSweepUSDC')},
      ${numberFrom(withdrawals, 'pendingWithdrawalUSDC')},
      ${numberFrom(withdrawals, 'processingWithdrawalUSDC')},
      ${numberFrom(withdrawals, 'broadcastWithdrawalUSDC')},
      ${JSON.stringify({ source: 'worker', version: 1 })},
      NOW()
    )
  `;
}
