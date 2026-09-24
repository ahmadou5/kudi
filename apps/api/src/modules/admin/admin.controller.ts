import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { PaymentProviderId } from '@kudi/types';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { prisma } from '@kudi/database';
import { getAuthenticatedUser } from '../../utils/authGuards';
import { MaintenanceService } from '../../services/maintenanceService';
import { LedgerService } from '../../services/ledgerService';

export class AdminController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry,
    private rateService: RateService,
    private maintenanceService?: MaintenanceService,
    private ledgerService?: LedgerService
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
      rateState: this.rateService.getRateState(),
      treasuryAddresses: {
        solana: process.env.KUDI_TREASURY_SOLANA_ADDRESS || 'KudiTreasurySolanaDevnet11111111111111111111',
        monad: process.env.KUDI_TREASURY_EVM_ADDRESS || '0xKudiTreasuryMonadMetropolisTestnet000'
      }
    });
  };

  public getMaintenanceConfig = async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (this.maintenanceService) {
      const config = await this.maintenanceService.getMaintenanceConfig();
      return successResponse(config, 'Maintenance mode config retrieved');
    }

    let maintenance = { enabled: false, message: '', estimatedMinutes: null as number | null, updatedAt: null as string | null };
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
      console.warn('[AdminController] Failed to fetch maintenance config:', err?.message || err);
    }

    return successResponse(maintenance, 'Maintenance mode config retrieved');
  };

  public setMaintenanceConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { enabled?: boolean; message?: string; estimatedMinutes?: number | null };
    if (typeof body?.enabled !== 'boolean') {
      return reply.status(400).send(errorResponse('INVALID_BODY', 'Field "enabled" is required as boolean', 400));
    }

    let updated;
    if (this.maintenanceService) {
      updated = await this.maintenanceService.setMaintenanceConfig({
        enabled: body.enabled,
        message: body.message,
        estimatedMinutes: body.estimatedMinutes
      });
    } else {
      const payload = {
        enabled: body.enabled,
        message: body.message?.trim() || '',
        estimatedMinutes: typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : null,
        updatedAt: new Date().toISOString()
      };
      const configValue = JSON.stringify(payload);
      await prisma.appConfig.upsert({
        where: { key: 'maintenance' },
        update: { value: configValue },
        create: { key: 'maintenance', value: configValue }
      });
      updated = payload;
    }

    await this.recordAdminAudit(request, {
      action: updated.enabled ? 'MAINTENANCE_ENABLE' : 'MAINTENANCE_DISABLE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'maintenance',
      details: { ...updated }
    });

    return successResponse(updated, 'Maintenance mode updated');
  };

  public getSweepConfig = async (_request: FastifyRequest, _reply: FastifyReply) => {
    let sweepConfig = { mode: 'AUTO', updatedAt: null as string | null };
    try {
      const config = await prisma.appConfig.findUnique({
        where: { key: 'sweep_config' }
      });
      if (config?.value) {
        try {
          const parsed = JSON.parse(config.value);
          sweepConfig = {
            mode: parsed.mode || 'AUTO',
            updatedAt: parsed.updatedAt || config.updatedAt?.toISOString?.() || null
          };
        } catch {}
      }
    } catch (err: any) {
      console.warn('[AdminController] Failed to fetch sweep config:', err?.message || err);
    }
    return successResponse(sweepConfig, 'Sweep configuration retrieved');
  };

  public setSweepConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { mode?: string };
    const validModes = ['AUTO', 'SPONSORED', 'TREASURY_FEE_PAYER'];
    if (!body?.mode || !validModes.includes(body.mode)) {
      return reply.status(400).send(errorResponse('INVALID_BODY', `Field "mode" must be one of: ${validModes.join(', ')}`, 400));
    }

    const payload = {
      mode: body.mode,
      updatedAt: new Date().toISOString()
    };
    const configValue = JSON.stringify(payload);

    await prisma.appConfig.upsert({
      where: { key: 'sweep_config' },
      update: { value: configValue },
      create: { key: 'sweep_config', value: configValue }
    });

    await this.recordAdminAudit(request, {
      action: 'SWEEP_CONFIG_UPDATE',
      targetType: 'SYSTEM_CONFIG',
      targetId: 'sweep_config',
      details: { ...payload }
    });

    return successResponse(payload, 'Sweep configuration updated successfully');
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
        d."creditedAt", d."sweptAt", d."walletAddress", d."privyWalletId", d."createdAt"
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
      walletAddress: row.walletAddress,
      privyWalletId: row.privyWalletId,
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

    const accessibilityRows: any[] = await prisma.$queryRaw`
      SELECT
        d."sweepStatus",
        d.chain,
        CASE
          WHEN w."privyWalletId" IS NULL THEN 'NO_PRIVY_WALLET_ID'
          WHEN w."custodyType" <> 'SERVER_CUSTODY' THEN 'NOT_SERVER_CUSTODY'
          ELSE 'SERVER_CUSTODY'
        END AS "accessMode",
        COUNT(*)::int AS count,
        COALESCE(SUM(d."amountUSDC"), 0) AS "amountUSDC"
      FROM "Deposit" d
      LEFT JOIN "Wallet" w ON w.address = d."walletAddress"
      WHERE d."sweepStatus" <> 'SWEPT'
      GROUP BY d."sweepStatus", d.chain, "accessMode"
      ORDER BY d."sweepStatus", d.chain, "accessMode"
    `;

    const staleProcessingRows: any[] = await prisma.$queryRaw`
      SELECT id, "userId", chain, "tokenSymbol", "amountUSDC", signature, "sweepAttemptCount", "updatedAt", "createdAt"
      FROM "Deposit"
      WHERE "sweepStatus" = 'SWEEP_PROCESSING'
        AND "sweptAt" IS NULL
        AND "updatedAt" < NOW() - INTERVAL '10 minutes'
      ORDER BY "updatedAt" ASC
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
      accessibility: accessibilityRows.map((row) => ({
        sweepStatus: row.sweepStatus,
        chain: row.chain,
        accessMode: row.accessMode,
        count: Number(row.count || 0),
        amountUSDC: Number(row.amountUSDC || 0)
      })),
      staleProcessing: staleProcessingRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        chain: row.chain,
        tokenSymbol: row.tokenSymbol,
        amountUSDC: Number(row.amountUSDC || 0),
        signature: row.signature,
        sweepAttemptCount: Number(row.sweepAttemptCount || 0),
        updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
        createdAt: row.createdAt?.toISOString?.() || row.createdAt
      })),
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

  public recheckSweep = async (request: FastifyRequest, reply: FastifyReply) => {
    const { signature } = request.params as { signature: string };
    if (!signature) {
      return reply.status(400).send(errorResponse('INVALID_SIGNATURE', 'Deposit signature is required', 400));
    }

    const rows: Array<{ signature: string; sweepStatus: string }> = await prisma.$queryRaw`
      UPDATE "Deposit"
      SET "sweepStatus" = 'SWEEP_PENDING',
          "nextSweepAttemptAt" = NOW(),
          "sweepError" = NULL,
          "updatedAt" = NOW()
      WHERE signature = ${signature}
        AND "sweptAt" IS NULL
        AND "sweepStatus" <> 'SWEPT'
      RETURNING signature, "sweepStatus"
    `;

    if (rows.length === 0) {
      return reply.status(404).send(errorResponse(
        'SWEEP_NOT_RECHECKABLE',
        'No unswept deposit found for that signature',
        404
      ));
    }

    await this.recordAdminAudit(request, {
      action: 'SWEEP_RECHECK',
      targetType: 'Deposit',
      targetId: signature,
      details: { status: 'SWEEP_PENDING' }
    });

    return successResponse({ signature, status: 'SWEEP_PENDING' }, 'Sweep recheck scheduled');
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

  private formatDate(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'string' ? value : new Date().toISOString();
  }

  private mapLedgerTransaction(row: any, rate: number) {
    const amountUSDC = Math.abs(Number(row.amountUSDC || 0));
    return {
      id: row.id,
      reference: row.referenceId,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail || '',
      amountUSDC,
      exchangeRateNGN: rate,
      amountNGN: amountUSDC * rate,
      feeNGN: 0,
      recipientBankName: row.type,
      recipientBankCode: '',
      recipientAccountNumber: '',
      recipientAccountName: row.type,
      payoutProvider: 'LEDGER',
      status: 'SUCCESS',
      createdAt: this.formatDate(row.createdAt),
      sweepStatus: row.sweepStatus || undefined,
      sweepTxHash: row.sweepTxHash || undefined,
      sweepError: row.sweepError || undefined,
      sweepAttemptCount: row.sweepAttemptCount === undefined ? undefined : Number(row.sweepAttemptCount || 0)
    };
  }

  private mapDeposit(row: any) {
    return {
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
      createdAt: this.formatDate(row.createdAt)
    };
  }

  public getDashboard = async (_request: FastifyRequest, _reply: FastifyReply) => {
    const rateState = this.rateService.getRateState();
    const rate = rateState.currentRateNGN;
    const activeId = this.paymentRegistry.getActiveProviderId();
    const payoutRails = [
      { id: 'PAYSTACK', name: 'Paystack Transfers API', active: activeId === 'paystack', balanceNGN: 0, latencyMs: 0, successRate: 0, supportedRails: ['NIP Instant Transfer'] },
      { id: 'MONNIFY', name: 'Monnify Direct Payout', active: activeId === 'monnify', balanceNGN: 0, latencyMs: 0, successRate: 0, supportedRails: ['NIP Transfer'] },
      { id: 'SQUAD', name: 'Squad GTCO Payout', active: activeId === 'squad', balanceNGN: 0, latencyMs: 0, successRate: 0, supportedRails: ['NIP Interbank'] }
    ];

    const [userStats, balanceStats, depositStats, recentDeposits, recentTransactions] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN \"kycTier\" = 'TIER_1' THEN 1 ELSE 0 END), 0)::int AS tier1, COALESCE(SUM(CASE WHEN \"kycTier\" = 'TIER_2' THEN 1 ELSE 0 END), 0)::int AS tier2, COALESCE(SUM(CASE WHEN \"kycStatus\" = 'VERIFIED' THEN 1 ELSE 0 END), 0)::int AS verified FROM \"User\""),
      prisma.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(\"availableUSDC\"), 0) AS \"availableUSDC\", COUNT(*)::int AS wallets FROM \"BalanceAccount\""),
      prisma.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(\"amountUSDC\"), 0) AS \"depositUSDC\", COUNT(*)::int AS count, COALESCE(SUM(CASE WHEN \"sweepStatus\" = 'SWEPT' THEN \"amountUSDC\" ELSE 0 END), 0) AS \"sweptUSDC\", COALESCE(SUM(CASE WHEN \"sweepStatus\" <> 'SWEPT' THEN \"amountUSDC\" ELSE 0 END), 0) AS \"unsweptUSDC\" FROM \"Deposit\" WHERE \"createdAt\" >= NOW() - INTERVAL '24 hours'"),
      prisma.$queryRawUnsafe<any[]>("SELECT d.id, d.\"userId\", COALESCE(u.\"fullName\", u.email, u.\"phoneNumber\", d.\"userId\") AS \"userName\", d.chain, d.\"tokenSymbol\", d.\"amountUSDC\", d.signature, d.\"blockNumber\", d.\"creditStatus\", d.\"sweepStatus\", d.\"sweepTxHash\", d.\"sweepError\", d.\"sweepAttemptCount\", d.\"nextSweepAttemptAt\", d.\"sweptAt\", d.\"createdAt\" FROM \"Deposit\" d LEFT JOIN \"User\" u ON u.id = d.\"userId\" ORDER BY d.\"createdAt\" DESC LIMIT 10"),
      prisma.$queryRawUnsafe<any[]>("SELECT le.id, le.\"referenceId\", le.\"userId\", COALESCE(u.\"fullName\", u.email, u.\"phoneNumber\", le.\"userId\") AS \"userName\", u.email AS \"userEmail\", le.type, le.\"amountUSDC\", le.\"createdAt\", d.\"sweepStatus\", d.\"sweepTxHash\", d.\"sweepError\", d.\"sweepAttemptCount\" FROM \"LedgerEntry\" le LEFT JOIN \"User\" u ON u.id = le.\"userId\" LEFT JOIN \"Deposit\" d ON d.signature = le.\"referenceId\" ORDER BY le.\"createdAt\" DESC LIMIT 10")
    ]);

    const users = userStats[0] || {};
    const balances = balanceStats[0] || {};
    const deposits = depositStats[0] || {};
    const totalUsers = Number(users.total || 0);
    const depositUSDC = Number(deposits.depositUSDC || 0);

    return successResponse({
      kpis: [
        { label: '24h Deposit Volume', value: '$' + depositUSDC.toFixed(2), delta: Number(deposits.count || 0) + ' deposits', tone: 'primary', description: 'NGN ' + Math.round(depositUSDC * rate).toLocaleString() + ' equivalent' },
        { label: 'User Liabilities', value: '$' + Number(balances.availableUSDC || 0).toFixed(2), delta: Number(balances.wallets || 0) + ' accounts', tone: 'success', description: 'Current internal available USDC liability' },
        { label: 'Live Exchange Rate', value: 'NGN ' + rate.toFixed(2), delta: "LIVE", tone: 'warning', description: 'Current rate engine value' },
        { label: 'Unswept Exposure', value: '$' + Number(deposits.unsweptUSDC || 0).toFixed(2), delta: '$' + Number(deposits.sweptUSDC || 0).toFixed(2) + ' swept', tone: 'muted', description: '24h deposits not marked SWEPT' }
      ],
      volumeChart: [],
      recentTransactions: recentTransactions.map((row) => this.mapLedgerTransaction(row, rate)),
      recentDeposits: recentDeposits.map((row) => this.mapDeposit(row)),
      rateState,
      payoutRails,
      custodyTrack: this.custodyManager.getActiveTrack(),
      usersSummary: { total: totalUsers, tier1: Number(users.tier1 || 0), tier2: Number(users.tier2 || 0), verifiedKycPct: totalUsers ? Math.round((Number(users.verified || 0) / totalUsers) * 100) : 0 }
    });
  };

  public getUsers = async (_request: FastifyRequest, _reply: FastifyReply) => {
    const rate = this.rateService.getRateState().currentRateNGN;
    try {
      const rows: any[] = await prisma.$queryRawUnsafe("SELECT u.id, u.\"fullName\", u.email, u.\"phoneNumber\", COALESCE(u.\"role\", 'USER') AS \"role\", COALESCE(u.\"status\", 'ACTIVE') AS \"status\", u.\"kycTier\", u.\"kycStatus\", u.\"createdAt\", COALESCE(ba.\"availableUSDC\", 0) AS \"balanceUSDC\", COALESCE(SUM(CASE WHEN le.\"amountUSDC\" < 0 THEN ABS(le.\"amountUSDC\") ELSE 0 END), 0) AS \"totalSpendUSDC\", COUNT(CASE WHEN le.\"amountUSDC\" < 0 THEN 1 END)::int AS \"spendCount\" FROM \"User\" u LEFT JOIN \"BalanceAccount\" ba ON ba.\"userId\" = u.id AND ba.asset = 'USDC' LEFT JOIN \"LedgerEntry\" le ON le.\"userId\" = u.id GROUP BY u.id, ba.\"availableUSDC\" ORDER BY u.\"createdAt\" DESC LIMIT 100");
      if (rows && rows.length > 0) {
        return successResponse(rows.map((row) => ({
          id: row.id,
          fullName: row.fullName || row.email || row.phoneNumber || row.id,
          email: row.email || '',
          phoneNumber: row.phoneNumber || '',
          role: row.role || 'USER',
          status: row.status || 'ACTIVE',
          kycTier: row.kycTier,
          kycStatus: row.kycStatus,
          balanceUSDC: Number(row.balanceUSDC || 0),
          totalSpendNGN: Number(row.totalSpendUSDC || 0) * rate,
          spendCount: Number(row.spendCount || 0),
          wallets: [],
          virtualAccounts: [],
          createdAt: this.formatDate(row.createdAt),
          lastActive: this.formatDate(row.createdAt)
        })));
      }
    } catch (err: any) {
      console.warn('[AdminController] DB getUsers query warning, using ledgerService:', err?.message || err);
    }

    const inMem = this.ledgerService ? this.ledgerService.getAllUsers() : [];
    return successResponse(inMem.map((u) => ({
      id: u.id,
      fullName: u.fullName || u.email || u.phoneNumber || u.id,
      email: u.email || '',
      phoneNumber: u.phoneNumber || '',
      role: u.role || 'USER',
      status: u.status || 'ACTIVE',
      kycTier: u.kycTier,
      kycStatus: u.kycStatus,
      balanceUSDC: this.ledgerService?.getBalance(u.id) || 0,
      totalSpendNGN: 0,
      spendCount: 0,
      wallets: u.wallets || [],
      virtualAccounts: [],
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    })));
  };

  public updateUserRole = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const { role } = request.body as { role: string };
    if (!role || !['ADMIN', 'OPERATOR', 'USER'].includes(role.toUpperCase())) {
      return reply.status(400).send(errorResponse('INVALID_ROLE', 'Valid role (ADMIN, OPERATOR, USER) is required', 400));
    }

    const normalizedRole = role.toUpperCase();
    const updated = this.ledgerService?.updateUserRole(userId, normalizedRole);
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { role: normalizedRole }
      });
    } catch (err: any) {
      console.warn('[AdminController] DB update user role warning:', err?.message || err);
    }

    const safeUser = updated ? {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
      kycStatus: updated.kycStatus,
      kycTier: updated.kycTier,
      wallets: updated.wallets
    } : null;

    return successResponse({
      userId,
      role: normalizedRole,
      user: safeUser
    }, `User role updated to ${normalizedRole}`);
  };

  public getTransactions = async (_request: FastifyRequest, _reply: FastifyReply) => {
    const rows: any[] = await prisma.$queryRawUnsafe("SELECT le.id, le.\"referenceId\", le.\"userId\", COALESCE(u.\"fullName\", u.email, u.\"phoneNumber\", le.\"userId\") AS \"userName\", u.email AS \"userEmail\", le.type, le.\"amountUSDC\", le.\"createdAt\", d.\"sweepStatus\", d.\"sweepTxHash\", d.\"sweepError\", d.\"sweepAttemptCount\" FROM \"LedgerEntry\" le LEFT JOIN \"User\" u ON u.id = le.\"userId\" LEFT JOIN \"Deposit\" d ON d.signature = le.\"referenceId\" ORDER BY le.\"createdAt\" DESC LIMIT 100");
    const rate = this.rateService.getRateState().currentRateNGN;
    return successResponse(rows.map((row) => this.mapLedgerTransaction(row, rate)));
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
