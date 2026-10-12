import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { apiConfig } from '@kudi/config';
import { prisma } from '../../lib/prisma';
import { MaintenanceService } from '../../services/maintenanceService';
import { computeUnbackedExposure, UNBACKED_SWEEP_STATUSES } from '@kudi/chains';

export class HealthController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry,
    private maintenanceService?: MaintenanceService
  ) {}

  public getHealth = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'kudi-api',
      custodyTrack: this.custodyManager.getActiveTrack(),
      activePaymentProvider: this.paymentRegistry.getActiveProviderId(),
      sentryEnabled: Boolean(apiConfig.SENTRY_DSN),
      timestamp: new Date().toISOString(),
    });
  };

  public getHealthConfig = async (_request: FastifyRequest, reply: FastifyReply) => {
    let maintenance = {
      enabled: false,
      message: '',
      estimatedMinutes: null as number | null,
      updatedAt: null as string | null
    };

    if (this.maintenanceService) {
      maintenance = await this.maintenanceService.getMaintenanceConfig();
    } else {
      try {
        const config = await prisma.appConfig.findUnique({
          where: { key: 'maintenance' }
        });
        if (config?.value) {
          try {
            const parsed = JSON.parse(config.value);
            maintenance = {
              enabled: Boolean(parsed.enabled),
              message: parsed.message || '',
              estimatedMinutes: parsed.estimatedMinutes ?? null,
              updatedAt: parsed.updatedAt || config.updatedAt?.toISOString?.() || null
            };
          } catch {
            // ignore parse error
          }
        }
      } catch (err: any) {
        // Safe fallback if database is not reachable
      }
    }

    return reply.send({
      success: true,
      message: 'App config fetched',
      data: { maintenance }
    });
  };

  public getSweepHealth = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows: Array<{ sweepStatus: string; amountUSDC: number | string | null }> = await prisma.$queryRaw`
        SELECT "sweepStatus", "amountUSDC"
        FROM "Deposit"
        WHERE "sweepStatus" = ANY(${UNBACKED_SWEEP_STATUSES})
      `;

      const { totalUSDC, byStatus } = computeUnbackedExposure(rows);

      const statusCounts: Array<{ sweepStatus: string; count: string }> = await prisma.$queryRaw`
        SELECT "sweepStatus", COUNT(*)::int AS count
        FROM "Deposit"
        GROUP BY "sweepStatus"
      `;

      const counts: Record<string, number> = {};
      for (const r of statusCounts) {
        counts[r.sweepStatus] = Number(r.count);
      }

      const latestSnapshot: Array<{ unbackedExposureUSDC: number; createdAt: Date }> = await prisma.$queryRaw`
        SELECT metadata->>'unbackedExposureUSDC' as "unbackedExposureUSDC", "createdAt"
        FROM "ReconciliationSnapshot"
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;

      const latestUnbacked = latestSnapshot[0] ? Number(latestSnapshot[0].unbackedExposureUSDC) : null;

      return reply.send({
        success: true,
        data: {
          sweepQueue: {
            pending: counts['SWEEP_PENDING'] ?? 0,
            processing: counts['SWEEP_PROCESSING'] ?? 0,
            failed: counts['SWEEP_FAILED'] ?? 0,
            blocked: counts['SWEEP_BLOCKED'] ?? 0,
            swept: counts['SWEPT'] ?? 0,
            floatExposure: counts['FLOAT_EXPOSURE'] ?? 0,
            unsupported: counts['SWEEP_UNSUPPORTED'] ?? 0
          },
          unbackedExposureUSDC: totalUSDC,
          unbackedByStatus: byStatus,
          latestSnapshotUnbackedUSDC: latestUnbacked,
          alertThresholdUSDC: apiConfig.RECONCILIATION_ALERT_THRESHOLD_USDC ?? 10000,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch sweep health',
        message: err?.message || String(err)
      });
    }
  };
}

