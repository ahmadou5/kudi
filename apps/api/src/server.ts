import Fastify from 'fastify';
import dotenv from 'dotenv';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { apiConfig, validateChainRuntimeConfig } from '@kudi/config';
import corsPlugin from './plugins/cors';
import helmetPlugin from './plugins/helmet';
import compressPlugin from './plugins/compress';
import jwtPlugin from './plugins/jwt';
import rateLimitPlugin from './plugins/rateLimit';
import redisPlugin from './plugins/redis';
import swaggerPlugin from './plugins/swagger';
import prismaPlugin from './plugins/prisma';
import { prisma } from './lib/prisma';
import { initSentry } from './lib/sentry';
import { RateService } from './services/rateService';
import { LedgerService } from './services/ledgerService';
import { DepositService } from './services/depositService';
import { SweepService } from './services/sweepService';
import { SweepWorkerService } from './services/sweepWorkerService';
import { MaintenanceService } from './services/maintenanceService';

import { HealthController } from './modules/health/health.controller';
import { healthRoutes } from './modules/health/health.routes';

import { AuthController } from './modules/auth/auth.controller';
import { authRoutes } from './modules/auth/auth.routes';

import { BalanceController } from './modules/balance/balance.controller';
import { balanceRoutes } from './modules/balance/balance.routes';

import { KYCController } from './modules/kyc/kyc.controller';
import { kycRoutes } from './modules/kyc/kyc.routes';

import { PayoutController } from './modules/payout/payout.controller';
import { payoutRoutes } from './modules/payout/payout.routes';

import { AdminController } from './modules/admin/admin.controller';
import { adminRoutes } from './modules/admin/admin.routes';

import { BillsController } from './modules/bills/bills.controller';
import { billsRoutes } from './modules/bills/bills.routes';

import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { webhooksRoutes } from './modules/webhooks/webhooks.routes';

import { DepositsController } from './modules/deposits/deposits.controller';
import { depositsRoutes } from './modules/deposits/deposits.routes';

import { Server as SocketIOServer, Socket } from 'socket.io';

dotenv.config();

// Initialize Sentry error monitoring & performance profiling
initSentry(apiConfig);

const server = Fastify({ logger: true, pluginTimeout: 30000 });

// Attach Socket.io server instance to Fastify's HTTP server
const io = new SocketIOServer(server.server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket: Socket) => {
  server.log.info(`⚡ [Socket.io] Client connected: ${socket.id}`);

  // Send initial maintenance state to connecting clients
  maintenanceService.getMaintenanceConfig().then((m) => {
    if (m.enabled) {
      socket.emit('system:maintenance', m);
    }
  }).catch(() => {});

  socket.on('join:room', (userId: string) => {
    if (userId) {
      socket.join(userId);
      server.log.info(`⚡ [Socket.io] Socket ${socket.id} joined user room: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    server.log.info(`⚡ [Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Core shared infrastructure services
const custodyManager = new CustodyManager({
  privyAppId: apiConfig.PRIVY_APP_ID,
  privyAppSecret: apiConfig.PRIVY_APP_SECRET,
  defaultRpcUrl: apiConfig.MONAD_RPC_URL,
  solanaRpcUrl: apiConfig.SOLANA_RPC_URL,
  partnerApiKey: apiConfig.VASP_PARTNER_API_KEY,
  partnerApiUrl: apiConfig.VASP_PARTNER_API_URL,
  solanaUsdcMintAddress: apiConfig.USDC_MINT_ADDRESS,
  solanaTreasuryAddress: apiConfig.KUDI_TREASURY_SOLANA_ADDRESS,
  solanaCaip2: apiConfig.SOLANA_CAIP2,
  ausdTokenAddress: apiConfig.AUSD_TOKEN_ADDRESS,
  monadChainId: apiConfig.MONAD_CHAIN_ID
});
const paymentRegistry = new PaymentProviderRegistry({
  paystackSecretKey: apiConfig.PAYSTACK_SECRET_KEY,
  monnifyApiKey: apiConfig.MONNIFY_API_KEY,
  monnifySecretKey: apiConfig.MONNIFY_SECRET_KEY,
  monnifyBaseUrl: apiConfig.MONNIFY_BASE_URL,
  monnifySourceAccountNumber: apiConfig.MONNIFY_SOURCE_ACCOUNT,
  squadSecretKey: apiConfig.SQUAD_SECRET_KEY,
  squadBaseUrl: apiConfig.SQUAD_BASE_URL
});
const rateService = new RateService();
const ledgerService = new LedgerService();
const depositService = new DepositService(ledgerService, io);
const sweepService = new SweepService(ledgerService);
const sweepWorker = new SweepWorkerService(ledgerService);
const maintenanceService = new MaintenanceService(io);

// Domain Controllers
const healthController = new HealthController(custodyManager, paymentRegistry, maintenanceService);
const authController = new AuthController(custodyManager, ledgerService);
const balanceController = new BalanceController(ledgerService, rateService);
const kycController = new KYCController(ledgerService);
const payoutController = new PayoutController(paymentRegistry, ledgerService, rateService);
const adminController = new AdminController(custodyManager, paymentRegistry, rateService, maintenanceService, ledgerService);
const billsController = new BillsController(ledgerService, rateService);
const webhooksController = new WebhooksController(ledgerService, rateService);
const depositsController = new DepositsController(depositService, sweepService);

async function main() {
  // R6: fail closed on missing/invalid chain config before anything else boots.
  validateChainRuntimeConfig(
    {
      nodeEnv: apiConfig.NODE_ENV,
      solanaTreasuryAddress: apiConfig.KUDI_TREASURY_SOLANA_ADDRESS,
      evmTreasuryAddress: apiConfig.KUDI_TREASURY_EVM_ADDRESS,
      usdcMintAddress: apiConfig.USDC_MINT_ADDRESS,
      ausdTokenAddress: apiConfig.AUSD_TOKEN_ADDRESS,
      monadChainId: apiConfig.MONAD_CHAIN_ID,
      solanaCaip2: apiConfig.SOLANA_CAIP2,
      privyAppId: apiConfig.PRIVY_APP_ID,
      privyAppSecret: apiConfig.PRIVY_APP_SECRET
    },
    'api'
  );

  // Register Infrastructure Plugins
  await server.register(corsPlugin);
  await server.register(helmetPlugin);
  await server.register(compressPlugin);

  await server.register(jwtPlugin);
  await server.register(rateLimitPlugin);
  try {
    await server.register(redisPlugin);
  } catch (err) {
    server.log.warn('Redis plugin registration skipped');
  }
  await server.register(swaggerPlugin);
  await server.register(prismaPlugin);

  // Restore persisted primary payment rail from database
  try {
    const primaryConfig = await prisma.providerConfiguration.findFirst({
      where: { enabled: true },
      orderBy: { priority: 'asc' }
    });
    if (primaryConfig?.provider) {
      paymentRegistry.setActiveProvider(primaryConfig.provider as any);
      server.log.info(`[Startup] Loaded primary payment rail from DB: ${primaryConfig.provider.toUpperCase()}`);
    }
  } catch (err: any) {
    server.log.warn(`[Startup] Could not load provider configuration from DB: ${err?.message || err}`);
  }

  // Maintenance mode gatekeeper
  server.addHook('preHandler', async (request, reply) => {
    if (maintenanceService.isBypassedUrl(request.url)) {
      return;
    }

    const maintenance = await maintenanceService.getMaintenanceConfig();
    if (maintenance.enabled) {
      return reply.status(503).send({
        success: false,
        code: 'MAINTENANCE_MODE',
        message: maintenance.message || 'Metropolis is currently undergoing scheduled maintenance. Please try again shortly.',
        data: {
          maintenance: {
            enabled: true,
            message: maintenance.message,
            estimatedMinutes: maintenance.estimatedMinutes,
            updatedAt: maintenance.updatedAt
          }
        }
      });
    }
  });

  // Register Domain Modules (Percel Standard Architecture)
  await healthRoutes(server, healthController);
  await authRoutes(server, authController);
  await balanceRoutes(server, balanceController);
  await kycRoutes(server, kycController);
  await payoutRoutes(server, payoutController);
  await adminRoutes(server, adminController);
  await billsRoutes(server, billsController);
  await webhooksRoutes(server, webhooksController);
  await depositsRoutes(server, depositsController);

  server.get('/', async (_request, reply) => {
    return reply.send({
      name: 'Kudi API Engine',
      status: 'running',
      port,
      health: '/api/v1/health',
      docs: '/documentation',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    });
  });

  const port = apiConfig.PORT;
  await server.listen({ port, host: '0.0.0.0' });

  rateService.onRateUpdate((rateState) => {
    io.emit('rate:updated', rateState);
  });
  rateService.startPolling(30_000);

  // Single sweep ownership (ADR-0001): the dedicated worker process
  // (apps/worker ChainDepositProcessor.processSweepRetries) is the sole
  // recurring sweep claimer. The in-API SweepWorkerService loop is a legacy
  // second engine and stays OFF unless explicitly opted in via
  // API_SWEEP_WORKER_ENABLED=true (never enable alongside the worker —
  // both engines claim the same Deposit rows → double-sweeps).
  // The instance above is still constructed so read-only helpers
  // (e.g. getQueueHealth) remain available without running the claim loop.
  const apiSweepWorkerEnabled = process.env.API_SWEEP_WORKER_ENABLED === 'true';
  if (apiSweepWorkerEnabled) {
    server.log.warn(
      '[Startup] API_SWEEP_WORKER_ENABLED=true — starting LEGACY in-API sweep claim loop. ' +
      'Ensure apps/worker sweep claiming is DISABLED, or both engines will double-claim Deposit rows.'
    );
    sweepWorker.start();
  } else {
    server.log.info(
      '[Startup] In-API sweep loop FENCED per ADR-0001 (API_SWEEP_WORKER_ENABLED != "true"). ' +
      'Sole sweep owner: apps/worker ChainDepositProcessor.processSweepRetries.'
    );
  }

  console.log(`🚀 Kudi API server running on http://localhost:${port}`);
}

main().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
