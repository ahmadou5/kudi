import { prisma } from '@kudi/database';
import { workerConfig } from '@kudi/config';

type NumericRow = Record<string, unknown>;

function numberFrom(row: NumericRow | undefined, key: string): number {
  if (!row || row[key] === null || row[key] === undefined) return 0;
  return Number(row[key]) || 0;
}

export interface ReconciliationMetrics {
  totalLiabilityUSDC: number;
  totalAvailableUSDC: number;
  totalReservedUSDC: number;
  pendingSweepUSDC: number;
  processingSweepUSDC: number;
  sweptUSDC: number;
  sweepFailedUSDC: number;
  floatExposureUSDC: number;
  unsupportedSweepUSDC: number;
  pendingWithdrawalUSDC: number;
  processingWithdrawalUSDC: number;
  broadcastWithdrawalUSDC: number;
  unbackedExposureUSDC: number;
}

const UNBACKED_STATUSES = ['SWEEP_PENDING', 'SWEEP_PROCESSING', 'SWEEP_FAILED', 'FLOAT_EXPOSURE', 'SWEEP_UNSUPPORTED'];

export async function recordReconciliationSnapshot(): Promise<ReconciliationMetrics | null> {
  try {
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
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEPT' THEN COALESCE("sweptAmountUSDC", "amountUSDC") ELSE 0 END), 0) AS "sweptUSDC",
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

    const pendingSweepUSDC = numberFrom(deposits, 'pendingSweepUSDC');
    const processingSweepUSDC = numberFrom(deposits, 'processingSweepUSDC');
    const sweptUSDC = numberFrom(deposits, 'sweptUSDC');
    const sweepFailedUSDC = numberFrom(deposits, 'sweepFailedUSDC');
    const floatExposureUSDC = numberFrom(deposits, 'floatExposureUSDC');
    const unsupportedSweepUSDC = numberFrom(deposits, 'unsupportedSweepUSDC');
    const pendingWithdrawalUSDC = numberFrom(withdrawals, 'pendingWithdrawalUSDC');
    const processingWithdrawalUSDC = numberFrom(withdrawals, 'processingWithdrawalUSDC');
    const broadcastWithdrawalUSDC = numberFrom(withdrawals, 'broadcastWithdrawalUSDC');

    // Unbacked exposure = deposits credited but not yet swept to treasury
    const unbackedExposureUSDC = pendingSweepUSDC + processingSweepUSDC + sweepFailedUSDC + floatExposureUSDC + unsupportedSweepUSDC;

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
        ${pendingSweepUSDC},
        ${processingSweepUSDC},
        ${sweptUSDC},
        ${sweepFailedUSDC},
        ${floatExposureUSDC},
        ${unsupportedSweepUSDC},
        ${pendingWithdrawalUSDC},
        ${processingWithdrawalUSDC},
        ${broadcastWithdrawalUSDC},
        ${JSON.stringify({ source: 'worker', version: 1, unbackedExposureUSDC })},
        NOW()
      )
    `;

    // Alert if unbacked exposure exceeds threshold
    const alertThreshold = workerConfig.RECONCILIATION_ALERT_THRESHOLD_USDC ?? 10000;
    if (unbackedExposureUSDC >= alertThreshold) {
      await createOrUpdateAlert({
        type: 'UNBACKED_EXPOSURE_THRESHOLD',
        severity: unbackedExposureUSDC >= alertThreshold * 5 ? 'CRITICAL' : 'WARNING',
        title: `Unbacked Exposure Alert: $${unbackedExposureUSDC.toFixed(2)} USDC`,
        body: `Unbacked on-chain exposure (${UNBACKED_STATUSES.join(', ')}) has exceeded threshold of $${alertThreshold.toFixed(2)} USDC. Current: $${unbackedExposureUSDC.toFixed(2)} USDC.`,
        reference: `unbacked-${Date.now()}`,
        metadata: JSON.stringify({
          unbackedExposureUSDC,
          thresholdUSDC: alertThreshold,
          breakdown: {
            pendingSweepUSDC,
            processingSweepUSDC,
            sweepFailedUSDC,
            floatExposureUSDC,
            unsupportedSweepUSDC
          }
        })
      });
    }

    return {
      totalLiabilityUSDC,
      totalAvailableUSDC,
      totalReservedUSDC,
      pendingSweepUSDC,
      processingSweepUSDC,
      sweptUSDC,
      sweepFailedUSDC,
      floatExposureUSDC,
      unsupportedSweepUSDC,
      pendingWithdrawalUSDC,
      processingWithdrawalUSDC,
      broadcastWithdrawalUSDC,
      unbackedExposureUSDC
    };
  } catch (err: any) {
    console.error('[Reconciliation] Snapshot failed:', err?.message || err);
    return null;
  }
}

async function createOrUpdateAlert(params: {
  type: string;
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  reference: string;
  metadata: string;
}): Promise<void> {
  try {
    // Use upsert on unique (type, reference) to avoid duplicate alerts
    await prisma.$executeRaw`
      INSERT INTO "OperatorAlert" (id, type, severity, status, title, body, reference, metadata, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${params.type}, ${params.severity}, 'OPEN', ${params.title}, ${params.body}, ${params.reference}, ${params.metadata}, NOW(), NOW())
      ON CONFLICT (type, reference) DO UPDATE SET
        severity = ${params.severity},
        title = ${params.title},
        body = ${params.body},
        metadata = ${params.metadata},
        "updatedAt" = NOW()
    `;
    console.warn(`[Reconciliation] 🚨 ${params.severity} alert created: ${params.title}`);
  } catch (err: any) {
    console.error('[Reconciliation] Failed to create alert:', err?.message || err);
  }
}
