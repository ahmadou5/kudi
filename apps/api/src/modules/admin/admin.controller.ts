import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { PaymentProviderId } from '@kudi/types';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { prisma } from '@kudi/database';
import { getAuthenticatedUser } from '../../utils/authGuards';

export class AdminController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry,
    private rateService: RateService
  ) {}

  private async recordAdminAudit(request: FastifyRequest, params: { action: string; targetType: string; targetId: string; details?: Record<string, unknown> }): Promise<void> {
    const actor = getAuthenticatedUser(request);
    await prisma.$executeRaw`
      INSERT INTO "AdminAuditLog" (id, "actorId", "actorEmail", action, "targetType", "targetId", details, "createdAt")
      VALUES (
        gen_random_uuid(),
        ${actor?.userId ?? null},
        ${actor?.email ?? (request.headers['x-admin-key'] ? 'admin-key' : null)},
        ${params.action},
        ${params.targetType},
        ${params.targetId},
        ${params.details ? JSON.stringify(params.details) : null},
        NOW()
      )
    `;
  }

  private async upsertOperatorAlert(params: { type: string; severity: string; title: string; body: string; reference?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const reference = params.reference || params.type;
    await prisma.$executeRaw`
      INSERT INTO "OperatorAlert" (id, type, severity, status, title, body, reference, metadata, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${params.type},
        ${params.severity},
        'OPEN',
        ${params.title},
        ${params.body},
        ${reference},
        ${params.metadata ? JSON.stringify(params.metadata) : null},
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  }

  private async generateSweepAlerts(): Promise<void> {
    const exhaustedRows: any[] = await prisma.$queryRaw`
      SELECT signature, "amountUSDC", chain, "sweepStatus", "sweepError", "sweepAttemptCount"
      FROM "Deposit"
      WHERE "sweepStatus" IN ('SWEEP_FAILED', 'SWEEP_BLOCKED')
        AND "sweepAttemptCount" >= 4
      ORDER BY "updatedAt" DESC
      LIMIT 50
    `;

    for (const row of exhaustedRows) {
      await this.upsertOperatorAlert({
        type: 'SWEEP_EXHAUSTED',
        severity: 'HIGH',
        title: 'Deposit sweep retry exhausted',
        body: `${row.chain} deposit ${row.signature} is ${row.sweepStatus} after ${row.sweepAttemptCount} attempts`,
        reference: row.signature,
        metadata: {
          amountUSDC: Number(row.amountUSDC || 0),
          chain: row.chain,
          sweepStatus: row.sweepStatus,
          sweepError: row.sweepError
        }
      });
    }

    const driftRows: any[] = await prisma.$queryRaw`
      SELECT "totalLiabilityUSDC", "pendingSweepUSDC", "sweepFailedUSDC", "floatExposureUSDC", "unsupportedSweepUSDC", "createdAt"
      FROM "ReconciliationSnapshot"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const latest = driftRows[0];
    if (latest) {
      const exposed = Number(latest.pendingSweepUSDC || 0) + Number(latest.sweepFailedUSDC || 0) + Number(latest.floatExposureUSDC || 0) + Number(latest.unsupportedSweepUSDC || 0);
      if (exposed > 0) {
        await this.upsertOperatorAlert({
          type: 'TREASURY_EXPOSURE',
          severity: exposed > 1000 ? 'HIGH' : 'MEDIUM',
          title: 'Treasury exposure detected',
          body: `${exposed.toFixed(2)} USDC is not yet confirmed as swept/backed by treasury`,
          reference: 'latest-reconciliation',
          metadata: {
            exposedUSDC: exposed,
            totalLiabilityUSDC: Number(latest.totalLiabilityUSDC || 0),
            snapshotAt: latest.createdAt
          }
        });
      }
    }
  }

  public getCurrentRates = async (request: FastifyRequest, reply: FastifyReply) => {
    return successResponse(this.rateService.getRateState());
  };

  public overrideRate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { newRateNGN } = request.body as { newRateNGN: number };
    if (!newRateNGN || newRateNGN <= 0) {
      return reply.status(400).send(errorResponse('INVALID_RATE', 'Rate must be a positive number', 400));
    }
    const state = this.rateService.setRateOverride(newRateNGN);
    return successResponse({ rateState: state });
  };

  public getConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    return successResponse({
      activePaymentProvider: this.paymentRegistry.getActiveProviderId(),
      custodyTrack: this.custodyManager.getActiveTrack(),
      failoverOrder: this.paymentRegistry.getFailoverOrder(),
      rateState: this.rateService.getRateState()
    });
  };

  public getPayoutRails = async (_request: FastifyRequest, _reply: FastifyReply) => {
    const activeId = this.paymentRegistry.getActiveProviderId(); // 'paystack', 'monnify', 'squad'
    const rails = [
      {
        id: 'PAYSTACK',
        name: 'Paystack Transfers API',
        active: activeId === 'paystack',
        balanceNGN: 84500000,
        latencyMs: 310,
        successRate: 99.8,
        supportedRails: ['NIP Instant Transfer', 'Direct Debit', 'Dedicated Virtual Accounts']
      },
      {
        id: 'MONNIFY',
        name: 'Monnify Direct Payout',
        active: activeId === 'monnify',
        balanceNGN: 42300000,
        latencyMs: 420,
        successRate: 99.4,
        supportedRails: ['NIP Transfer', 'Sub-accounts', 'Reserved Accounts']
      },
      {
        id: 'SQUAD',
        name: 'Squad GTCO Payout',
        active: activeId === 'squad',
        balanceNGN: 25100000,
        latencyMs: 510,
        successRate: 98.9,
        supportedRails: ['GTCO Priority Rail', 'NIP Interbank', 'Dedicated Virtual Accounts']
      }
    ];
    return successResponse(rails);
  };

  public setActiveProvider = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { providerId } = request.body as { providerId: PaymentProviderId | string };
    const normalized = (typeof providerId === 'string' ? providerId.toLowerCase() : providerId) as PaymentProviderId;
    this.paymentRegistry.setActiveProvider(normalized);

    try {
      await prisma.providerConfiguration.upsert({
        where: { provider: normalized },
        update: { enabled: true, priority: 1 },
        create: {
          provider: normalized,
          name: normalized.toUpperCase(),
          enabled: true,
          priority: 1
        }
      });
      await prisma.providerConfiguration.updateMany({
        where: { provider: { not: normalized } },
        data: { priority: 2 }
      });
      await prisma.adminAuditLog.create({
        data: {
          actorEmail: (request as any).user?.email || 'admin@kudi.app',
          action: 'FAILOVER_SWITCH',
          targetType: 'PAYMENT_RAIL',
          targetId: normalized,
          details: `Switched primary payout rail to ${normalized.toUpperCase()}`
        }
      });
    } catch (err: any) {
      console.warn('[AdminController] DB persist error for active provider:', err?.message || err);
    }

    return successResponse({
      activeProviderId: normalized.toUpperCase(),
      activeProvider: normalized,
      message: `Active payout rail successfully switched to ${normalized.toUpperCase()}`
    });
  };


  public getDeposits = async (request: FastifyRequest, reply: FastifyReply) => {
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        d.id, d."userId", COALESCE(u."fullName", u.email, u."phoneNumber", d."userId") AS "userName",
        d.chain, d."tokenSymbol", d."amountUSDC", d.signature, d."blockNumber", d."creditStatus",
        d."sweepStatus", d."sweepTxHash", d."sweepError", d."sweepAttemptCount", d."nextSweepAttemptAt",
        d."creditedAt", d."sweptAt", d."createdAt"
      FROM "Deposit" d
      LEFT JOIN "User" u ON u.id = d."userId"
      ORDER BY d."createdAt" DESC
      LIMIT 100
    `;

    return successResponse(rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      chain: row.chain === 'solana' ? 'Solana' : 'Monad Testnet',
      txHash: row.signature,
      token: row.tokenSymbol,
      amount: Number(row.amountUSDC || 0),
      confirmations: row.blockNumber ? 1 : 0,
      status: row.creditStatus === 'CREDITED' ? 'CONFIRMED' : 'PENDING',
      sweepStatus: row.sweepStatus,
      sweepTxHash: row.sweepTxHash,
      sweepError: row.sweepError,
      sweepAttemptCount: Number(row.sweepAttemptCount || 0),
      nextSweepAttemptAt: row.nextSweepAttemptAt?.toISOString?.() || row.nextSweepAttemptAt,
      sweptAt: row.sweptAt?.toISOString?.() || row.sweptAt,
      createdAt: row.createdAt?.toISOString?.() || row.createdAt
    })));
  };

  public getSweepHealth = async (request: FastifyRequest, reply: FastifyReply) => {
    const summaryRows: any[] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_PENDING' THEN "amountUSDC" ELSE 0 END), 0) AS "pendingUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_PROCESSING' THEN "amountUSDC" ELSE 0 END), 0) AS "processingUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEPT' THEN "amountUSDC" ELSE 0 END), 0) AS "sweptUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_FAILED' THEN "amountUSDC" ELSE 0 END), 0) AS "failedUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_BLOCKED' THEN "amountUSDC" ELSE 0 END), 0) AS "blockedUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'FLOAT_EXPOSURE' THEN "amountUSDC" ELSE 0 END), 0) AS "floatExposureUSDC",
        COALESCE(SUM(CASE WHEN "sweepStatus" = 'SWEEP_UNSUPPORTED' THEN "amountUSDC" ELSE 0 END), 0) AS "unsupportedUSDC",
        COUNT(*)::int AS "totalDeposits",
        COALESCE(SUM(CASE WHEN "sweepStatus" IN ('SWEEP_FAILED', 'SWEEP_BLOCKED') AND "sweepAttemptCount" >= 4 THEN 1 ELSE 0 END), 0)::int AS "exhaustedCount"
      FROM "Deposit"
    `;

    const exhaustedRows: any[] = await prisma.$queryRaw`
      SELECT
        id, "userId", chain, "tokenSymbol", "amountUSDC", signature, "sweepStatus", "sweepError",
        "sweepAttemptCount", "nextSweepAttemptAt", "createdAt"
      FROM "Deposit"
      WHERE "sweepStatus" IN ('SWEEP_FAILED', 'SWEEP_BLOCKED')
        AND "sweepAttemptCount" >= 4
      ORDER BY "updatedAt" DESC
      LIMIT 50
    `;

    const summary = summaryRows[0] || {};
    return successResponse({
      summary: {
        pendingUSDC: Number(summary.pendingUSDC || 0),
        processingUSDC: Number(summary.processingUSDC || 0),
        sweptUSDC: Number(summary.sweptUSDC || 0),
        failedUSDC: Number(summary.failedUSDC || 0),
        blockedUSDC: Number(summary.blockedUSDC || 0),
        floatExposureUSDC: Number(summary.floatExposureUSDC || 0),
        unsupportedUSDC: Number(summary.unsupportedUSDC || 0),
        totalDeposits: Number(summary.totalDeposits || 0),
        exhaustedCount: Number(summary.exhaustedCount || 0)
      },
      exhausted: exhaustedRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        chain: row.chain,
        tokenSymbol: row.tokenSymbol,
        amountUSDC: Number(row.amountUSDC || 0),
        signature: row.signature,
        sweepStatus: row.sweepStatus,
        sweepError: row.sweepError,
        sweepAttemptCount: Number(row.sweepAttemptCount || 0),
        nextSweepAttemptAt: row.nextSweepAttemptAt?.toISOString?.() || row.nextSweepAttemptAt,
        createdAt: row.createdAt?.toISOString?.() || row.createdAt
      }))
    });
  };

  public requeueSweep = async (request: FastifyRequest, reply: FastifyReply) => {
    const { signature } = request.params as { signature: string };
    if (!signature) {
      return reply.status(400).send(errorResponse('INVALID_SIGNATURE', 'Deposit signature is required', 400));
    }

    const rows: Array<{ signature: string }> = await prisma.$queryRaw`
      UPDATE "Deposit"
      SET "sweepStatus" = 'SWEEP_PENDING',
          "sweepAttemptCount" = 0,
          "nextSweepAttemptAt" = NOW(),
          "sweepError" = NULL,
          "updatedAt" = NOW()
      WHERE signature = ${signature}
        AND "sweepStatus" IN ('SWEEP_FAILED', 'SWEEP_BLOCKED')
        AND "sweptAt" IS NULL
      RETURNING signature
    `;

    if (rows.length === 0) {
      return reply.status(404).send(errorResponse(
        'SWEEP_NOT_REQUEUEABLE',
        'No failed or blocked unswept deposit found for that signature',
        404
      ));
    }

    await this.recordAdminAudit(request, {
      action: 'SWEEP_REQUEUE',
      targetType: 'Deposit',
      targetId: signature,
      details: { status: 'SWEEP_PENDING' }
    });

    return successResponse({ signature, status: 'SWEEP_PENDING' }, 'Sweep requeued');
  };

  public getOperatorAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.generateSweepAlerts();
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, type, severity, status, title, body, reference, metadata, "createdAt", "updatedAt"
      FROM "OperatorAlert"
      WHERE status = 'OPEN'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        "createdAt" DESC
      LIMIT 100
    `;

    return successResponse(rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      body: row.body,
      reference: row.reference,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.createdAt?.toISOString?.() || row.createdAt,
      updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt
    })));
  };

  public exportReconciliationCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = [
      ['Reference', 'UserId', 'AmountUSDC', 'ExchangeRateNGN', 'AmountNGN', 'Provider', 'Status', 'Timestamp'],
      ['KUDI_SPEND_1725423120000', 'usr_demo_123', '50.00', '1585.50', '79275', 'PAYSTACK', 'SUCCESS', new Date().toISOString()]
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="kudi_compliance_audit.csv"')
      .send(csvContent);
  };
}
